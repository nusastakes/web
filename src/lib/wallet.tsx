"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createWalletClient, http, type LocalAccount } from "viem";
import type { Secp256k1SigningSession } from "@category-labs/mera";
import brand from "./brand.json";
import { RPC_URL, monadTestnet } from "./config";
import { markCeremony, markStart } from "./metrics";
import type { Hex } from "./types";

/**
 * Akun Mera: satu passkey menghasilkan satu akun EVM biasa (EOA) tanpa seed phrase dan tanpa server.
 *
 * - Satu ceremony membuat passkey sekaligus membuka sesi penandatanganan (onboarding satu prompt).
 * - Selama sesi hidup, tanda tangan tidak memunculkan prompt. Kunci hanya ada di memori halaman.
 * - Sesi berakhir otomatis setelah 10 menit tanpa dipakai (`IDLE_MS`); membukanya lagi butuh satu ceremony.
 * - Aksi yang memindahkan uang keluar (tarik) memakai `withCeremony`: ceremony baru untuk tiap aksi.
 * - Dari keluaran PRF yang sama diturunkan juga kunci wakil (indeks 1). Kunci ini hanya didaftarkan di vault untuk
 *   `rebalance` dalam batas dan masa berlaku, jadi sesi walikota bisa menata ulang tanpa prompt. Di perangkat baru kunci
 *   yang sama diturunkan ulang. Catatan jujur: sesi halaman v1 masih memegang kunci utama juga (untuk permit setor).
 * - Tidak ada rahasia di localStorage; hanya id credential dan alamat terakhir (metadata publik).
 * - Buku strategi memakai namespace PRF sendiri (salt `sha256("nusastakes/buku-strategi/v1")`), terpisah dari akun. Kuncinya
 *   hanya ada di memori selama sesi dan dibuang saat sesi dikunci; tidak pernah disimpan atau dikirim.
 */

const STORE_KEY = "nusastakes.credential.v1";
const ADDRESS_KEY = "nusastakes.address.v1";
export const IDLE_MS = 10 * 60 * 1000;

interface StoredCredential { credentialId: string; transports?: string[] }
type Phase = "idle" | "busy" | "ready";
export type WalletStatus = "out" | "busy" | "ready" | "locked";

// --- Penyimpanan publik di browser, dibaca lewat useSyncExternalStore supaya aman dari ketidakcocokan hidrasi. -----
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
};
const snapshot = () => {
  try { return `${localStorage.getItem(STORE_KEY) ?? ""}\n${localStorage.getItem(ADDRESS_KEY) ?? ""}`; } catch { return "\n"; }
};
const serverSnapshot = () => "\n";

function readStored(): StoredCredential | undefined {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as StoredCredential) : undefined;
  } catch {
    return undefined;
  }
}
function writeStored(cred?: StoredCredential, address?: Hex) {
  try {
    if (cred) localStorage.setItem(STORE_KEY, JSON.stringify(cred)); else localStorage.removeItem(STORE_KEY);
    if (address) localStorage.setItem(ADDRESS_KEY, address); else if (!cred) localStorage.removeItem(ADDRESS_KEY);
  } catch { /* penyimpanan diblokir: abaikan */ }
  notify();
}

export interface TxRequest {
  to: Hex;
  data?: Hex;
  value?: bigint;
  gas?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

export interface WalletApi {
  status: WalletStatus;
  address?: Hex;
  /** Ada passkey tersimpan di browser ini. */
  hasPasskey: boolean;
  busyLabel?: string;
  error?: string;
  /** Detik tersisa sebelum sesi dikunci otomatis. */
  secondsLeft?: number;
  createAccount: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => void;
  /** Mengakhiri sesi sekarang (kunci dihapus dari memori); akun tetap diingat. */
  lock: () => void;
  clearError: () => void;
  /** Menandatangani EIP-712 dengan sesi yang hidup (tanpa prompt). Gagal bila terkunci. */
  signTypedData: LocalAccount["signTypedData"];
  /** Menjalankan `fn` dengan ceremony passkey baru; kunci dibuang segera setelah selesai. */
  withCeremony: <T>(label: string, fn: (account: LocalAccount) => Promise<T>) => Promise<T>;
  /** Mengirim transaksi yang dibayar akun ini sendiri (aksi walikota). Butuh sesi hidup. */
  sendTransaction: (tx: TxRequest) => Promise<Hex>;
  /** Alamat kunci wakil yang diturunkan dari passkey yang sama; ada selama sesi hidup. */
  deputy?: Hex;
  /** Mengirim transaksi dengan kunci wakil (tanpa prompt). Hanya `rebalance` yang diterima vault dari kunci ini. */
  sendAsDeputy: (tx: TxRequest) => Promise<Hex>;
  /** Kunci induk buku strategi sudah dibuka di sesi ini. */
  bookUnlocked: boolean;
  /** Menjalankan `fn` dengan kunci induk buku strategi (32 byte). Membuka kunci butuh satu ceremony bila belum. */
  withBookKey: <T>(fn: (root: Uint8Array) => Promise<T>) => Promise<T>;
}

/** Salt PRF buku strategi: namespace terpisah dari akun (salt Mera bawaan). */
async function bookSalt(): Promise<Uint8Array<ArrayBuffer>> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("nusastakes/buku-strategi/v1"));
  return new Uint8Array(d);
}

const Ctx = createContext<WalletApi | null>(null);
export const useWallet = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet harus dipakai di dalam <WalletProvider>");
  return v;
};

const PATH_MAIN = "m/44'/60'/0'/0/0";
const PATH_DEPUTY = "m/44'/60'/0'/0/1";

async function deriveKeys(prfOutput: Uint8Array, withDeputy: boolean): Promise<{ main: Uint8Array; deputy?: Uint8Array }> {
  const [{ HDKey }, { entropyToMnemonic, mnemonicToSeedSync }, { wordlist }] = await Promise.all([
    import("@scure/bip32"),
    import("@scure/bip39"),
    import("@scure/bip39/wordlists/english"),
  ]);
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const root = HDKey.fromMasterSeed(seed);
  const pick = (path: string) => {
    const key = root.derive(path).privateKey;
    if (key === null) throw new Error("derivation produced no key");
    return key;
  };
  return { main: pick(PATH_MAIN), deputy: withDeputy ? pick(PATH_DEPUTY) : undefined };
}

interface Opened {
  session: Secp256k1SigningSession;
  account: LocalAccount;
  deputy?: { session: Secp256k1SigningSession; account: LocalAccount };
}

async function openSession(prfOutput: Uint8Array, withDeputy = false): Promise<Opened> {
  const [{ createSecp256k1SigningSession }, { toViemAccount }] = await Promise.all([
    import("@category-labs/mera"),
    import("@category-labs/mera/viem"),
  ]);
  const keys = await deriveKeys(prfOutput, withDeputy);
  const session = createSecp256k1SigningSession({ privateKey: keys.main });
  const out: Opened = { session, account: toViemAccount(session) };
  if (keys.deputy) {
    const ds = createSecp256k1SigningSession({ privateKey: keys.deputy });
    out.deputy = { session: ds, account: toViemAccount(ds) };
  }
  return out;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [liveAddress, setLiveAddress] = useState<Hex>();
  const [deputyAddress, setDeputyAddress] = useState<Hex>();
  const [busyLabel, setBusyLabel] = useState<string>();
  const [error, setError] = useState<string>();
  const [secondsLeftState, setSecondsLeft] = useState<number>();

  const stored = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [credRaw, storedAddress] = stored.split("\n");
  const hasPasskey = credRaw !== "";

  const sessionRef = useRef<Secp256k1SigningSession | null>(null);
  const accountRef = useRef<LocalAccount | null>(null);
  const deputySessionRef = useRef<Secp256k1SigningSession | null>(null);
  const deputyAccountRef = useRef<LocalAccount | null>(null);
  const bookRef = useRef<Uint8Array | null>(null);
  const [bookUnlocked, setBookUnlocked] = useState(false);
  const lastUsed = useRef(0);
  const touch = () => { lastUsed.current = Date.now(); };

  const endSession = useCallback(() => {
    sessionRef.current?.end();
    deputySessionRef.current?.end();
    sessionRef.current = null;
    accountRef.current = null;
    deputySessionRef.current = null;
    deputyAccountRef.current = null;
    bookRef.current?.fill(0);
    bookRef.current = null;
    setBookUnlocked(false);
  }, []);

  const startFrom = useCallback(async (prfOutput: Uint8Array, cred: StoredCredential) => {
    endSession();
    const { session, account, deputy } = await openSession(prfOutput, true);
    sessionRef.current = session;
    accountRef.current = account;
    deputySessionRef.current = deputy?.session ?? null;
    deputyAccountRef.current = deputy?.account ?? null;
    touch();
    writeStored(cred, account.address);
    setLiveAddress(account.address);
    setDeputyAddress(deputy?.account.address);
    setPhase("ready");
  }, [endSession]);

  // Kunci otomatis saat idle, dan hitung mundur untuk UI. State hanya diubah di dalam callback timer.
  useEffect(() => {
    if (phase !== "ready") return;
    const id = window.setInterval(() => {
      const left = IDLE_MS - (Date.now() - lastUsed.current);
      if (left <= 0) { endSession(); setPhase("idle"); setDeputyAddress(undefined); setSecondsLeft(undefined); }
      else setSecondsLeft(Math.ceil(left / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, endSession]);

  useEffect(() => () => endSession(), [endSession]);

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setError(undefined);
    setBusyLabel(label);
    setPhase("busy");
    try {
      await fn();
    } catch (e) {
      const { humanError } = await import("./errors");
      setError(humanError(e));
      setPhase("idle");
    } finally {
      setBusyLabel(undefined);
    }
  }, []);

  const createAccount = useCallback(() => run("Creating your passkey…", async () => {
    markStart();
    const { createPasskeyWithPrfOutput } = await import("@category-labs/mera");
    const day = new Date().toISOString().slice(0, 10);
    const created = await createPasskeyWithPrfOutput({
      rp: { id: location.hostname, name: brand.name },
      user: { name: `${brand.name.toLowerCase()}-${day}`, displayName: `${brand.name} account (${day})` },
    });
    markCeremony();
    await startFrom(created.prfOutput, { credentialId: created.credentialId, transports: created.transports as string[] | undefined });
  }), [run, startFrom]);

  const signIn = useCallback(() => run("Waiting for your passkey…", async () => {
    const { getPasskeyPrfOutput } = await import("@category-labs/mera");
    const known = readStored();
    const got = await getPasskeyPrfOutput({
      rpId: location.hostname,
      credential: known ? { credentialId: known.credentialId, transports: known.transports } : undefined,
    });
    markCeremony();
    await startFrom(got.prfOutput, known?.credentialId === got.credentialId ? known : { credentialId: got.credentialId });
  }), [run, startFrom]);

  const signOut = useCallback(() => {
    endSession();
    setPhase("idle");
    setLiveAddress(undefined);
    setDeputyAddress(undefined);
    setSecondsLeft(undefined);
    writeStored(undefined, undefined);
  }, [endSession]);

  const lock = useCallback(() => {
    endSession();
    setPhase("idle");
    setDeputyAddress(undefined);
    setSecondsLeft(undefined);
  }, [endSession]);

  const signTypedData: LocalAccount["signTypedData"] = useCallback(async (...args) => {
    const account = accountRef.current;
    if (!account) throw Object.assign(new Error("session ended"), { code: "SESSION_ENDED" });
    touch();
    return account.signTypedData(...args);
  }, []);

  const address = (phase === "ready" ? liveAddress : (storedAddress as Hex)) || undefined;

  const withCeremony = useCallback(async <T,>(label: string, fn: (account: LocalAccount) => Promise<T>): Promise<T> => {
    const { getPasskeyPrfOutput } = await import("@category-labs/mera");
    const known = readStored();
    setBusyLabel(label);
    let fresh: Opened | undefined;
    try {
      const got = await getPasskeyPrfOutput({
        rpId: location.hostname,
        credential: known ? { credentialId: known.credentialId, transports: known.transports } : undefined,
      });
      markCeremony();
      fresh = await openSession(got.prfOutput);
      if (address && fresh.account.address.toLowerCase() !== address.toLowerCase()) {
        throw new Error("This passkey belongs to a different account than the one you are signed in with.");
      }
      return await fn(fresh.account);
    } finally {
      fresh?.session.end();
      fresh?.deputy?.session.end();
      setBusyLabel(undefined);
      touch();
    }
  }, [address]);

  const sendWith = useCallback(async (account: LocalAccount | null, tx: TxRequest) => {
    if (!account) throw Object.assign(new Error("session ended"), { code: "SESSION_ENDED" });
    touch();
    return createWalletClient({ account, chain: monadTestnet, transport: http(RPC_URL) }).sendTransaction(tx as never);
  }, []);
  const sendTransaction = useCallback((tx: TxRequest) => sendWith(accountRef.current, tx), [sendWith]);
  const sendAsDeputy = useCallback((tx: TxRequest) => sendWith(deputyAccountRef.current, tx), [sendWith]);

  const withBookKey = useCallback(async <T,>(fn: (root: Uint8Array) => Promise<T>): Promise<T> => {
    if (!accountRef.current) throw Object.assign(new Error("session ended"), { code: "SESSION_ENDED" });
    if (!bookRef.current) {
      const { getPasskeyPrfOutput } = await import("@category-labs/mera");
      const known = readStored();
      setBusyLabel("Unlock your strategy book with your passkey…");
      try {
        const got = await getPasskeyPrfOutput({
          rpId: location.hostname,
          credential: known ? { credentialId: known.credentialId, transports: known.transports } : undefined,
          prfSalt: await bookSalt(),
        });
        markCeremony();
        bookRef.current = new Uint8Array(got.prfOutput);
        setBookUnlocked(true);
      } finally {
        setBusyLabel(undefined);
      }
    }
    touch();
    return fn(bookRef.current!);
  }, []);

  const status: WalletStatus = phase === "busy" ? "busy" : phase === "ready" ? "ready" : storedAddress ? "locked" : "out";

  const value = useMemo<WalletApi>(
    () => ({
      status, address, hasPasskey, busyLabel, error,
      secondsLeft: status === "ready" ? secondsLeftState : undefined,
      deputy: status === "ready" ? deputyAddress : undefined,
      createAccount, signIn, signOut, lock, clearError: () => setError(undefined), signTypedData, withCeremony, sendTransaction, sendAsDeputy,
      bookUnlocked: status === "ready" && bookUnlocked, withBookKey,
    }),
    [status, address, hasPasskey, busyLabel, error, secondsLeftState, deputyAddress, createAccount, signIn, signOut, lock, signTypedData, withCeremony, sendTransaction, sendAsDeputy, bookUnlocked, withBookKey],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
