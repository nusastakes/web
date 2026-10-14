import { stepText } from "./copy-mayor";
import { currentLang, type Lang } from "./lang";

/**
 * Terjemahan teks yang dibuat di logika (bukan di berkas copy): label langkah transaksi, teks prompt passkey, dan pesan
 * galat yang dilempar kode kita sendiri. Teks dasarnya bahasa Inggris; saat toggle ID teks itu dicari di sini, lalu di
 * kamus langkah `copy-mayor.ts`. Teks yang tidak dikenal (misalnya galat dari relayer atau dompet) dikembalikan apa adanya.
 */

const ID: Record<string, string> = {
  // Langkah transaksi dan prompt passkey.
  "Getting a little test gas": "Mengambil sedikit gas uji",
  "Confirm the withdrawal with your passkey…": "Konfirmasi penarikan dengan passkey Anda…",
  "Confirm the change with your passkey…": "Konfirmasi perubahan dengan passkey Anda…",
  "Confirm the new deputy key…": "Konfirmasi kunci wakil baru…",
  "Confirm removing the deputy key…": "Konfirmasi penghapusan kunci wakil…",
  "Sign the new setting": "Tandatangani setelan baru",
  "Setting saved on the adapter": "Setelan tersimpan di adapter",
  "Confirm the new setting with your passkey…": "Konfirmasi setelan baru dengan passkey Anda…",
  "Creating your passkey…": "Membuat passkey Anda…",
  "Waiting for your passkey…": "Menunggu passkey Anda…",
  "Unlock your strategy book with your passkey…": "Buka buku strategi dengan passkey Anda…",
  // Galat yang dilempar kode kita sendiri.
  "The city factory was updated and this page still has an old service address. Reload the page; if it keeps happening, tell the team.":
    "Pabrik kota sudah diperbarui dan halaman ini masih memakai alamat layanan lama. Muat ulang halaman; bila terus terjadi, beri tahu tim.",
  "The transaction was reverted.": "Transaksi ditolak jaringan (revert).",
  "This action needs a fresh passkey confirmation.": "Aksi ini butuh konfirmasi passkey yang baru.",
  "Sign in first.": "Masuk dulu.",
  "This passkey belongs to a different account than the one you are signed in with.": "Passkey ini milik akun lain, bukan akun yang sedang Anda pakai.",
  "Unknown strategy book format.": "Format buku strategi tidak dikenal.",
  "The relayer stored a different ciphertext than the one sent.": "Relayer menyimpan ciphertext yang berbeda dari yang dikirim.",
  "The stored ciphertext does not match the on-chain plan hash.": "Ciphertext yang tersimpan tidak cocok dengan hash rencana di chain.",
  "hash mismatch": "hash tidak cocok",
  "There are almost no buildings mapped here. Try a busier place.": "Hampir tidak ada bangunan yang dipetakan di sini. Coba tempat yang lebih ramai.",
  "The relayer is not reachable. Deposits and withdrawals need it to pay gas.": "Relayer tidak bisa dihubungi. Setoran dan penarikan membutuhkannya untuk membayar gas.",
  "session ended": "sesi berakhir",
};

const PATTERNS: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^Confirm hiring (.+) with your passkey…$/, (m) => `Konfirmasi sewa ${m[1]} dengan passkey Anda…`],
  [/^OpenStreetMap servers are busy \((.*)\)\. Try again in a minute\.$/, (m) => `Server OpenStreetMap sedang sibuk (${m[1]}). Coba lagi sebentar lagi.`],
  [/^Place search failed \((\d+)\)\.$/, (m) => `Pencarian tempat gagal (${m[1]}).`],
  [/^Relayer error \((\d+)\)$/, (m) => `Galat relayer (${m[1]})`],
];

/** Teks logika dalam bahasa `lang` (bawaan: bahasa saat ini). Teks yang tidak dikenal dikembalikan apa adanya. */
export function loc(s: string, lang: Lang = currentLang()): string {
  if (lang === "en" || !s) return s;
  if (ID[s]) return ID[s];
  for (const [re, f] of PATTERNS) {
    const m = re.exec(s);
    if (m) return f(m);
  }
  return stepText(lang, s);
}
