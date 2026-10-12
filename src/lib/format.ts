/** AUSD, dua desimal; jumlah sangat kecil tetap terlihat (bukan "0.00"). */
export function fmtAusd(n: number, opts: { max?: number } = {}): string {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  const max = opts.max ?? (abs >= 1000 ? 0 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6);
  return n.toLocaleString("en-US", { minimumFractionDigits: abs >= 1000 ? 0 : 2, maximumFractionDigits: Math.max(max, abs >= 1000 ? 0 : 2) });
}

export const fmtPct = (n: number, digits = 2) => `${n >= 0 ? "" : "-"}${Math.abs(n).toFixed(digits)}%`;
export const fmtBps = (bps: number) => fmtPct(bps / 100, bps % 100 === 0 ? 0 : 2);
export const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

/** 6 desimal AUSD ke angka JS (aman untuk tampilan; jangan dipakai untuk hitungan uang). */
export const ausdToNumber = (raw: bigint) => Number(raw) / 1e6;

/** "12.5" ke satuan terkecil AUSD (6 desimal), tanpa kehilangan presisi. Mengembalikan null bila tidak valid. */
export function parseAusd(input: string): bigint | null {
  const s = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{0,6})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * 1_000_000n + BigInt((frac + "000000").slice(0, 6));
}

export function timeAgo(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.floor(seconds))}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
