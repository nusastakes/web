"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cityServicesAbi, erc20Abi } from "./abis";
import { contractTx, type Step } from "./actions";
import { publicClient, readMonBalance } from "./chain";
import { ADDR } from "./config";
import { requestGas } from "./relayer";
import type { Hex } from "./types";
import type { WalletApi } from "./wallet";

/**
 * Panggung: layanan peluncur token di Loket kota (`CityServices`, jenis 1). Walikota menyalakan layanan dan memilih fee
 * (0 sampai 3%); pengunjung meluncurkan token (bayar 1 AUSD) lalu siapa pun jual-beli token itu di kurva harga. Setiap
 * fee dialirkan ke vault kota selama sekitar 12 jam, jadi penduduk yang menikmatinya; walikota hanya mendapat fee
 * kinerja atas keuntungan itu. Semua di testnet.
 */

export const LAUNCHPAD = 1;
export const MAX_FEE_BPS = 300;
const TOKEN_LIST_CAP = 12;
const SLIPPAGE_KEEP = 98n; // terima paling sedikit 98% dari kutipan

export interface TokenRow { address: Hex; name: string; symbol: string; priceAusd: number; reserve: bigint; held: bigint }
export interface PanggungState {
  on: boolean; feeBps: number; launchFee: bigint;
  stats: { volume: bigint; fees: bigint; uses: number };
  stream: { due: bigint; pending: bigint };
  tokens: TokenRow[];
  ausdBalance: bigint | null;
}

const sv = ADDR.cityServices;

export async function readPanggung(city: Hex, owner?: Hex): Promise<PanggungState> {
  const [service, stats, launchFee, stream, list] = await Promise.all([
    publicClient.readContract({ address: sv, abi: cityServicesAbi, functionName: "services", args: [city, LAUNCHPAD] }),
    publicClient.readContract({ address: sv, abi: cityServicesAbi, functionName: "stats", args: [city, LAUNCHPAD] }),
    publicClient.readContract({ address: sv, abi: cityServicesAbi, functionName: "launchFee" }),
    publicClient.readContract({ address: sv, abi: cityServicesAbi, functionName: "releasable", args: [city] }),
    publicClient.readContract({ address: sv, abi: cityServicesAbi, functionName: "tokensOf", args: [city] }),
  ]);
  const recent = [...list].reverse().slice(0, TOKEN_LIST_CAP) as Hex[];
  const per = 5;
  const res = recent.length
    ? await publicClient.multicall({
        allowFailure: true,
        contracts: recent.flatMap((tk) => [
          { address: tk, abi: erc20Abi, functionName: "name" } as const,
          { address: tk, abi: erc20Abi, functionName: "symbol" } as const,
          { address: sv, abi: cityServicesAbi, functionName: "price", args: [tk] } as const,
          { address: sv, abi: cityServicesAbi, functionName: "curves", args: [tk] } as const,
          { address: tk, abi: erc20Abi, functionName: "balanceOf", args: [owner ?? "0x0000000000000000000000000000000000000000"] } as const,
        ]),
      })
    : [];
  const tokens: TokenRow[] = recent.map((address, i) => {
    const r = res.slice(i * per, i * per + per);
    const ok = <T,>(x: (typeof res)[number] | undefined, fb: T): T => (x && x.status === "success" ? (x.result as T) : fb);
    const curve = ok<readonly [Hex, bigint, bigint] | null>(r[3], null);
    return {
      address,
      // Nama dan simbol ditulis pengunjung: hanya ditampilkan sebagai teks biasa.
      name: String(ok(r[0], "?")).slice(0, 32),
      symbol: String(ok(r[1], "?")).slice(0, 8),
      priceAusd: Number(ok<bigint>(r[2], 0n)) / 1e6,
      reserve: curve ? curve[1] : 0n,
      held: owner ? ok<bigint>(r[4], 0n) : 0n,
    };
  });
  const ausdBalance = owner ? await publicClient.readContract({ address: ADDR.ausd, abi: erc20Abi, functionName: "balanceOf", args: [owner] }).catch(() => null) : null;
  return {
    on: service[0], feeBps: Number(service[1]), launchFee,
    stats: { volume: stats[0], fees: stats[1], uses: Number(stats[2]) },
    stream: { due: stream[0], pending: stream[1] },
    tokens, ausdBalance,
  };
}

/** Keadaan Panggung satu kota; dibaca ulang tiap 20 detik dan setelah tiap aksi (`refresh`). */
export function usePanggung(city?: Hex, owner?: Hex) {
  const [state, setState] = useState<PanggungState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const load = useCallback(async () => {
    if (!city) return;
    try {
      const s = await readPanggung(city, owner);
      if (alive.current) { setState(s); setError(null); }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    }
  }, [city, owner]);
  useEffect(() => {
    alive.current = true;
    if (!city) return;
    queueMicrotask(() => void load());
    const id = window.setInterval(() => void load(), 20_000);
    return () => { alive.current = false; window.clearInterval(id); };
  }, [city, load]);
  return { state, error, refresh: load };
}

type Report = (id: string, patch: Partial<Step>) => void;

/** Langkah untuk kartu aktivitas: bensin (MON), izin pakai token, lalu transaksinya. */
export const PANGGUNG_STEPS = (labels: { gas: string; approve: string; sign: string; send: string; confirm: string }, withApprove: boolean): Step[] => [
  { id: "gas", label: labels.gas, state: "todo" },
  ...(withApprove ? [{ id: "approve", label: labels.approve, state: "todo" as const }] : []),
  { id: "sign", label: labels.sign, state: "todo" },
  { id: "send", label: labels.send, state: "todo" },
  { id: "confirm", label: labels.confirm, state: "todo" },
];

/** Transaksi dibayar akun pengguna sendiri: minta sedikit MON uji dari relayer bila saldo hampir habis. */
async function ensureGas(owner: Hex, report?: Report) {
  report?.("gas", { state: "active" });
  try {
    const bal = await readMonBalance(owner);
    if (bal < 50_000_000_000_000_000n) await requestGas(owner).catch(() => undefined);
  } catch { /* RPC lambat: lanjut, galat gas akan terlihat di langkah kirim */ }
  report?.("gas", { state: "done" });
}

/** Izin pakai token untuk Loket kota, sebesar yang dibutuhkan (tidak tak terbatas). Satu konfirmasi passkey. */
async function ensureAllowance(wallet: WalletApi, owner: Hex, token: Hex, amount: bigint, label: string, report?: Report) {
  const current = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, sv] });
  if (current >= amount) { report?.("approve", { state: "done" }); return; }
  report?.("approve", { state: "active" });
  await contractTx(wallet, { address: token, abi: erc20Abi, functionName: "approve", args: [sv, amount] }, { ceremony: true, label, report: (id, p) => { if (id === "confirm" && p.state === "done") report?.("approve", { state: "done", hash: p.hash }); else if (p.state === "error") report?.("approve", { state: "error" }); } });
  report?.("approve", { state: "done" });
}

/** Walikota menyalakan atau mematikan Panggung dan memilih fee (basis poin, 0..300). Mengubah pengaturan butuh passkey. */
export async function setLaunchpad(args: { wallet: WalletApi; owner: Hex; city: Hex; on: boolean; feeBps: number; label: string; report?: Report }) {
  const { wallet, owner, city, on, feeBps, label, report } = args;
  if (feeBps < 0 || feeBps > MAX_FEE_BPS) throw new Error("FeeTooHigh");
  await ensureGas(owner, report);
  return contractTx(wallet, { address: sv, abi: cityServicesAbi, functionName: "setService", args: [city, LAUNCHPAD, on, feeBps] }, { ceremony: true, label, report });
}

async function needAusd(owner: Hex, amount: bigint) {
  const bal = await publicClient.readContract({ address: ADDR.ausd, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
  if (bal < amount) throw new Error(`NotEnoughAusd:${(Number(amount) / 1e6).toFixed(2)}:${(Number(bal) / 1e6).toFixed(2)}`);
}

/** Meluncurkan token: bayar `launchFee` ke kota, opsional langsung membeli sebanyak `firstBuy` AUSD. */
export async function launchToken(args: { wallet: WalletApi; owner: Hex; city: Hex; name: string; symbol: string; firstBuy: bigint; launchFee: bigint; labels: { approve: string; send: string }; report?: Report }) {
  const { wallet, owner, city, name, symbol, firstBuy, launchFee, labels, report } = args;
  const n = name.trim(), sym = symbol.trim().toUpperCase();
  if (!n || n.length > 32 || !sym || sym.length > 8) throw new Error("BadName");
  const total = launchFee + firstBuy;
  await needAusd(owner, total);
  await ensureGas(owner, report);
  await ensureAllowance(wallet, owner, ADDR.ausd, total, labels.approve, report);
  // Token baru belum ada saat kutipan, jadi pembelian pertama memakai harga awal kurva: batas minimal 1 unit saja.
  return contractTx(wallet, { address: sv, abi: cityServicesAbi, functionName: "launch", args: [city, n, sym, firstBuy, firstBuy > 0n ? 1n : 0n] }, { ceremony: false, label: labels.send, report });
}

export async function buyToken(args: { wallet: WalletApi; owner: Hex; token: Hex; amount: bigint; labels: { approve: string; send: string }; report?: Report }) {
  const { wallet, owner, token, amount, labels, report } = args;
  if (amount <= 0n) throw new Error("ZeroAmount");
  await needAusd(owner, amount);
  await ensureGas(owner, report);
  await ensureAllowance(wallet, owner, ADDR.ausd, amount, labels.approve, report);
  const [quote] = await publicClient.readContract({ address: sv, abi: cityServicesAbi, functionName: "quoteBuy", args: [token, amount] });
  const min = (quote * SLIPPAGE_KEEP) / 100n;
  return contractTx(wallet, { address: sv, abi: cityServicesAbi, functionName: "buy", args: [token, amount, min > 0n ? min : 1n] }, { ceremony: false, label: labels.send, report });
}

export async function sellToken(args: { wallet: WalletApi; owner: Hex; token: Hex; tokensIn: bigint; labels: { approve: string; send: string }; report?: Report }) {
  const { wallet, owner, token, tokensIn, labels, report } = args;
  if (tokensIn <= 0n) throw new Error("ZeroAmount");
  await ensureGas(owner, report);
  await ensureAllowance(wallet, owner, token, tokensIn, labels.approve, report);
  const [quote] = await publicClient.readContract({ address: sv, abi: cityServicesAbi, functionName: "quoteSell", args: [token, tokensIn] });
  const min = (quote * SLIPPAGE_KEEP) / 100n;
  return contractTx(wallet, { address: sv, abi: cityServicesAbi, functionName: "sell", args: [token, tokensIn, min] }, { ceremony: false, label: labels.send, report });
}

/** Kutipan beli (token yang diterima, fee kota) atau jual (AUSD yang diterima, fee kota). */
export async function quote(token: Hex, side: "buy" | "sell", amount: bigint): Promise<{ out: bigint; fee: bigint }> {
  if (amount <= 0n) return { out: 0n, fee: 0n };
  const [out, fee] = await publicClient.readContract({ address: sv, abi: cityServicesAbi, functionName: side === "buy" ? "quoteBuy" : "quoteSell", args: [token, amount] });
  return { out, fee };
}

/** Angka token (18 desimal) yang ringkas: 1.2K, 3.4M. */
export function fmtTokens(raw: bigint): string {
  const n = Number(raw) / 1e18;
  if (n === 0) return "0";
  if (n < 1) return n.toPrecision(2);
  if (n < 1e3) return n.toFixed(2);
  if (n < 1e6) return `${(n / 1e3).toFixed(1)}K`;
  if (n < 1e9) return `${(n / 1e6).toFixed(2)}M`;
  return `${(n / 1e9).toFixed(2)}B`;
}

/** Harga per token dalam AUSD, tetap terbaca untuk harga sangat kecil. */
export const fmtPrice = (p: number) => (p === 0 ? "0" : p < 0.01 ? p.toPrecision(3) : p.toFixed(4));
