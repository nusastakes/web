/** Mengubah galat mentah (kontrak, relayer, Mera, browser) menjadi kalimat yang bisa dipahami pengguna, dalam bahasa toggle. */

import { tr } from "./lang";
import { loc } from "./l10n";

const KNOWN: [RegExp, string, string][] = [
  [/PermitNotHonoured|Erc2612InvalidSignature|invalid signature/i, "The signature was rejected or has expired. Try again.", "Tanda tangan ditolak atau sudah kedaluwarsa. Coba lagi."],
  [/ERC4626ExceededMaxDeposit|exceeds? (the )?(city )?deposit|deposit cap/i, "This city is full. Choose another city or deposit less.", "Kota ini sudah penuh. Pilih kota lain atau setor lebih sedikit."],
  [/ERC4626ExceededMaxRedeem|exceeds? your shares/i, "You are trying to withdraw more than you hold.", "Anda mencoba menarik lebih banyak dari yang Anda punya."],
  [/ShiftTooHigh/i, "That move is larger than the city's per-move limit.", "Pemindahan itu melebihi batas sekali pindah kota ini."],
  [/NotMayor|NotAuthorizedToRebalance/i, "Only the mayor (or the mayor's session key) can do this.", "Hanya walikota (atau kunci sesi walikota) yang bisa melakukan ini."],
  [/InsufficientIdle/i, "Not enough idle funds in the plaza for that move.", "Dana menganggur di alun-alun tidak cukup untuk pemindahan itu."],
  [/InsufficientLiquidity/i, "The district cannot return that much right now.", "Distrik itu belum bisa mengembalikan sebanyak itu sekarang."],
  [/QuarantineActive/i, "One district is in withdraw-only mode, so this action is paused until it recovers.", "Satu distrik sedang dalam mode tarik saja, jadi aksi ini ditahan sampai distrik itu pulih."],
  [/AdapterIsQuarantined/i, "That district is in withdraw-only mode and cannot receive funds.", "Distrik itu sedang dalam mode tarik saja dan tidak bisa menerima dana."],
  [/SessionBudgetExceeded/i, "The session key used its hourly budget. Use your passkey for larger moves.", "Kunci sesi sudah memakai jatah per jamnya. Pakai passkey untuk pemindahan yang lebih besar."],
  [/RoleConflict/i, "That wallet already holds another role in this city. Release it first.", "Dompet itu sudah memegang peran lain di kota ini. Lepaskan dulu."],
  [/TermsChanged|PriceChanged/i, "The listing changed while you were confirming. Reopen the staff market and try again.", "Penawaran berubah saat Anda mengonfirmasi. Buka ulang bursa staf lalu coba lagi."],
  [/QuarantineExitsAreSelfOnly/i, "While a district is in withdraw-only mode, only you can withdraw your own funds, from your own account.", "Selama sebuah distrik dalam mode tarik saja, hanya Anda yang bisa menarik dana Anda sendiri, dari akun Anda sendiri."],
  [/ListingStale|ListingInactive|UnknownListing/i, "That listing is out of date. Reopen the staff market and try again.", "Penawaran itu sudah usang. Buka ulang bursa staf lalu coba lagi."],
  [/FeeTooHigh/i, "That fee is above the platform maximum.", "Fee itu melebihi batas maksimum platform."],
  [/EmptyName/i, "Give the city a name.", "Beri nama kota ini."],
  [/insufficient funds|Missing or invalid parameters|exceeds the balance/i, "Not enough testnet MON for gas. Use the gas button or the faucet.", "MON testnet untuk gas tidak cukup. Pakai tombol gas atau faucet."],
  [/User rejected|rejected the request|denied/i, "You cancelled the request.", "Anda membatalkan permintaan."],
];

export function humanError(e: unknown): string {
  const raw = e instanceof Error ? `${e.name} ${e.message}` : typeof e === "string" ? e : JSON.stringify(e);
  const code = (e as { code?: string } | null)?.code;
  if (code === "PRF_UNAVAILABLE") {
    return tr(
      "This browser or password manager does not support passkey keys (PRF). Use Chrome signed in to Google Password Manager, Safari with iCloud Keychain, Android Chrome, or Windows Hello on Windows 11 25H2 or later.",
      "Browser atau pengelola sandi ini tidak mendukung kunci passkey (PRF). Pakai Chrome yang masuk ke Google Password Manager, Safari dengan iCloud Keychain, Chrome Android, atau Windows Hello di Windows 11 25H2 ke atas.",
    );
  }
  if (code === "PASSKEY_OPERATION_FAILED") return tr("The passkey prompt was dismissed or failed. Try again.", "Prompt passkey ditutup atau gagal. Coba lagi.");
  if (code === "CRYPTO_UNAVAILABLE") return tr("Passkeys need a secure page (HTTPS).", "Passkey butuh halaman aman (HTTPS).");
  if (code === "SESSION_ENDED") return tr("Your session ended. Unlock with your passkey to continue.", "Sesi Anda berakhir. Buka dengan passkey untuk melanjutkan.");
  for (const [re, en, id] of KNOWN) if (re.test(raw)) return tr(en, id);
  const short = loc(((e as { shortMessage?: string } | null)?.shortMessage || (e instanceof Error ? e.message : String(e))).split("\n")[0]);
  return short.length > 160 ? `${short.slice(0, 157)}…` : short;
}
