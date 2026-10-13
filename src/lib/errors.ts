/** Mengubah galat mentah (kontrak, relayer, Mera, browser) menjadi kalimat yang bisa dipahami pengguna. */

const KNOWN: [RegExp, string][] = [
  [/PermitNotHonoured|Erc2612InvalidSignature|invalid signature/i, "The signature was rejected or has expired. Try again."],
  [/ERC4626ExceededMaxDeposit|exceeds? (the )?(city )?deposit|deposit cap/i, "This city is full. Choose another city or deposit less."],
  [/ERC4626ExceededMaxRedeem|exceeds? your shares/i, "You are trying to withdraw more than you hold."],
  [/ShiftTooHigh/i, "That move is larger than the city's per-move limit."],
  [/NotMayor|NotAuthorizedToRebalance/i, "Only the mayor (or the mayor's session key) can do this."],
  [/InsufficientIdle/i, "Not enough idle funds in the plaza for that move."],
  [/InsufficientLiquidity/i, "The district cannot return that much right now."],
  [/QuarantineActive/i, "One district is in withdraw-only mode, so this action is paused until it recovers."],
  [/AdapterIsQuarantined/i, "That district is in withdraw-only mode and cannot receive funds."],
  [/SessionBudgetExceeded/i, "The session key used its hourly budget. Use your passkey for larger moves."],
  [/RoleConflict/i, "That wallet already holds another role in this city. Release it first."],
  [/TermsChanged|PriceChanged/i, "The listing changed while you were confirming. Reopen the staff market and try again."],
  [/QuarantineExitsAreSelfOnly/i, "While a district is in withdraw-only mode, only you can withdraw your own funds, from your own account."],
  [/ListingStale|ListingInactive|UnknownListing/i, "That listing is out of date. Reopen the staff market and try again."],
  [/FeeTooHigh/i, "That fee is above the platform maximum."],
  [/EmptyName/i, "Give the city a name."],
  [/insufficient funds|Missing or invalid parameters|exceeds the balance/i, "Not enough testnet MON for gas. Use the gas button or the faucet."],
  [/User rejected|rejected the request|denied/i, "You cancelled the request."],
];

export function humanError(e: unknown): string {
  const raw = e instanceof Error ? `${e.name} ${e.message}` : typeof e === "string" ? e : JSON.stringify(e);
  const code = (e as { code?: string } | null)?.code;
  if (code === "PRF_UNAVAILABLE") {
    return "This browser or password manager does not support passkey keys (PRF). Use Chrome signed in to Google Password Manager, Safari with iCloud Keychain, or Android Chrome.";
  }
  if (code === "PASSKEY_OPERATION_FAILED") return "The passkey prompt was dismissed or failed. Try again.";
  if (code === "CRYPTO_UNAVAILABLE") return "Passkeys need a secure page (HTTPS).";
  if (code === "SESSION_ENDED") return "Your session ended. Unlock with your passkey to continue.";
  for (const [re, msg] of KNOWN) if (re.test(raw)) return msg;
  const short = ((e as { shortMessage?: string } | null)?.shortMessage || (e instanceof Error ? e.message : String(e))).split("\n")[0];
  return short.length > 160 ? `${short.slice(0, 157)}…` : short;
}
