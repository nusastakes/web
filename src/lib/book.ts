import { bytesToHex, hexToBytes, keccak256 } from "viem";
import { getBook, getBookEntry, putBook, type BookMeta } from "./relayer";
import type { Hex } from "./types";
import type { WalletApi } from "./wallet";

/**
 * Buku strategi tersegel (PRD R10, bounty B17).
 *
 * - Kunci induk: keluaran PRF passkey dengan salt `sha256("nusastakes/buku-strategi/v1")`, namespace yang terpisah dari akun.
 *   Hanya ada di memori selama sesi (lihat `wallet.tsx`).
 * - Kunci per entri: HKDF-SHA256(kunci induk, info = "nusastakes.book.entry.v1:<id>"). Membuka satu kunci entri tidak
 *   membuka entri lain, dan perangkat lain dengan passkey yang sama menurunkan kunci yang sama.
 * - Isi dienkripsi AES-256-GCM di browser. Relayer hanya menyimpan ciphertext (`PUT /book`); `keccak256(ciphertext)`
 *   dicatat on-chain sebagai `planHash` di `rebalance`.
 * - Akhir musim: walikota memanggil `revealPlanKey(planHash, kunci entri)`; siapa pun bisa mendekripsi dan mencocokkan hash.
 */

export interface PlanEntry {
  v: 1;
  city: Hex;
  cityName: string;
  from: string;
  to: string;
  amount: string;
  note: string;
  writtenAt: number;
}

const BOOK_DOMAIN = { name: "Nusastakes", version: "1", chainId: 10143 } as const;
const BOOK_TYPES = {
  BookEntry: [
    { name: "owner", type: "address" },
    { name: "id", type: "string" },
    { name: "ciphertextHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
} as const;
const FORMAT = 1;

/** Id entri: pendek, unik, dan cocok dengan aturan relayer (huruf, angka, . _ : -). */
export function newEntryId(vault: Hex): string {
  const rand = crypto.getRandomValues(new Uint8Array(4));
  return `${vault.slice(2, 10).toLowerCase()}-${Date.now().toString(36)}-${bytesToHex(rand).slice(2)}`;
}

/** Kunci AES 32 byte untuk satu entri, diturunkan dengan HKDF dari kunci induk. */
export async function entryKey(root: Uint8Array, id: string): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey("raw", root as Uint8Array<ArrayBuffer>, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: new TextEncoder().encode(`nusastakes.book.entry.v1:${id}`) },
    base,
    256,
  );
  return new Uint8Array(bits);
}

async function aes(key: Uint8Array, usage: "encrypt" | "decrypt") {
  return crypto.subtle.importKey("raw", key as Uint8Array<ArrayBuffer>, "AES-GCM", false, [usage]);
}

/** Format ciphertext: [versi 1 byte][iv 12 byte][AES-GCM ciphertext + tag]. Id entri ikut sebagai data tambahan. */
export async function sealEntry(key: Uint8Array, id: string, entry: PlanEntry): Promise<Hex> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(id) },
    await aes(key, "encrypt"),
    new TextEncoder().encode(JSON.stringify(entry)),
  ));
  const out = new Uint8Array(1 + iv.length + ct.length);
  out[0] = FORMAT;
  out.set(iv, 1);
  out.set(ct, 1 + iv.length);
  return bytesToHex(out);
}

export async function openEntry(key: Uint8Array, id: string, ciphertext: Hex): Promise<PlanEntry> {
  const bytes = hexToBytes(ciphertext);
  if (bytes[0] !== FORMAT) throw new Error("Unknown strategy book format.");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.slice(1, 13), additionalData: new TextEncoder().encode(id) },
    await aes(key, "decrypt"),
    bytes.slice(13),
  );
  return JSON.parse(new TextDecoder().decode(pt)) as PlanEntry;
}

/** Menulis satu entri: enkripsi di perangkat, tanda tangan pemilik (tanpa prompt di dalam sesi), simpan di relayer. */
export async function writeEntry(wallet: WalletApi, owner: Hex, input: Omit<PlanEntry, "writtenAt">): Promise<{ id: string; planHash: Hex }> {
  const entry: PlanEntry = { ...input, writtenAt: Math.floor(Date.now() / 1000) };
  const id = newEntryId(entry.city);
  const ciphertext = await wallet.withBookKey(async (root) => sealEntry(await entryKey(root, id), id, entry));
  const planHash = keccak256(ciphertext);
  const list = await getBook(owner).catch(() => ({ nonce: "-1" }));
  const nonce = (BigInt(list.nonce ?? "-1") + 1n).toString();
  const signature = await wallet.signTypedData({
    domain: BOOK_DOMAIN,
    types: BOOK_TYPES,
    primaryType: "BookEntry",
    message: { owner, id, ciphertextHash: planHash, nonce: BigInt(nonce) },
  });
  const saved = await putBook({ owner, id, ciphertext, nonce, signature });
  if (saved.hash.toLowerCase() !== planHash.toLowerCase()) throw new Error("The relayer stored a different ciphertext than the one sent.");
  return { id, planHash };
}

export interface OpenedEntry extends BookMeta { entry?: PlanEntry; key?: Hex; error?: string }

/** Membaca dan membuka semua entri milik `owner` dengan kunci di sesi ini. */
export async function readAll(wallet: WalletApi, owner: Hex): Promise<OpenedEntry[]> {
  const list = await getBook(owner);
  return wallet.withBookKey(async (root) => {
    const out: OpenedEntry[] = [];
    for (const meta of [...list.entries].sort((a, b) => b.createdAt - a.createdAt)) {
      try {
        const full = await getBookEntry(owner, meta.id);
        if (keccak256(full.ciphertext).toLowerCase() !== meta.hash.toLowerCase()) throw new Error("hash mismatch");
        const key = await entryKey(root, meta.id);
        out.push({ ...meta, entry: await openEntry(key, meta.id, full.ciphertext), key: bytesToHex(key) });
      } catch (e) {
        out.push({ ...meta, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return out;
  });
}

/** Siapa pun: mencocokkan entri yang dibuka di akhir musim (kunci publik dari event `PlanKeyRevealed`). */
export async function verifyRevealed(owner: Hex, id: string, keyHex: Hex, planHash: Hex): Promise<PlanEntry> {
  const full = await getBookEntry(owner, id);
  if (keccak256(full.ciphertext).toLowerCase() !== planHash.toLowerCase()) throw new Error("The stored ciphertext does not match the on-chain plan hash.");
  return openEntry(hexToBytes(keyHex), id, full.ciphertext);
}
