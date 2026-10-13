"use client";

import { decodeAbiParameters, encodeAbiParameters, encodeFunctionData, parseAbiParameters } from "viem";
import { tunedAdapterAbi } from "./abis";
import type { Step } from "./actions";
import { publicClient } from "./chain";
import { monadTestnet, rpcTransport } from "./config";
import type { Knobs } from "./catalog";
import type { Tuning } from "./relayer";
import type { Hex } from "./types";
import type { WalletApi } from "./wallet";

/**
 * Setelan layanan (vault TC67.10): walikota menyetel tiap protokol sebatas hak penyetor di protokol aslinya. Setelan
 * disimpan di adapter bersetelan (`TunedMirrorAdapter`) sebagai
 * `abi.encode(uint8 version, uint16 loopX100, bool takeRewards, uint16 rangeBps, uint256 centerPriceE8)`. Relayer
 * menghitung APY efektif dengan rumus yang sama seperti `effectiveApy` di bawah, lalu menulisnya ke ApyFeed.
 */

const TUNING_PARAMS = parseAbiParameters("uint8 version, uint16 loopX100, bool takeRewards, uint16 rangeBps, uint256 centerPriceE8");

export const DEFAULT_TUNING: Tuning = { loopX100: 100, takeRewards: true, rangeBps: 0, centerPriceE8: "0" };

export function encodeTuning(t: Tuning): Hex {
  return encodeAbiParameters(TUNING_PARAMS, [1, t.loopX100, t.takeRewards, t.rangeBps, BigInt(t.centerPriceE8)]);
}

export function decodeTuning(data: Hex | null | undefined): Tuning {
  if (!data || data === "0x") return { ...DEFAULT_TUNING };
  try {
    const [, loopX100, takeRewards, rangeBps, center] = decodeAbiParameters(TUNING_PARAMS, data);
    return { loopX100, takeRewards, rangeBps, centerPriceE8: center.toString() };
  } catch {
    return { ...DEFAULT_TUNING };
  }
}

export async function readTuning(adapter: Hex): Promise<{ tuning: Tuning; tunedAt: number }> {
  const [raw, at] = await Promise.all([
    publicClient.readContract({ address: adapter, abi: tunedAdapterAbi, functionName: "tuning" }),
    publicClient.readContract({ address: adapter, abi: tunedAdapterAbi, functionName: "tunedAt" }),
  ]);
  return { tuning: decodeTuning(raw), tunedAt: Number(at) };
}

/** Efisiensi modal posisi likuiditas terkonsentrasi dengan rentang simetris ±r (perkalian), relatif terhadap rentang penuh. */
const efficiency = (rangeBps: number) => (rangeBps <= 0 ? 1 : 1 / (1 - Math.pow(1 + rangeBps / 10_000, -0.5)));

export interface Effective {
  /** Yang ditulis ke feed: dibulatkan dan dibatasi 0..5000 bps. */
  apyBps: number;
  /** Tanpa batas; bisa negatif (posisi rugi) atau di atas batas feed. */
  uncappedBps: number;
  inRange: boolean | null;
  parts: { base: number; reward: number; loop: number; rangeFactor: number };
}

/** Perkiraan APY efektif dari setelan dan data mainnet di katalog; rumus yang sama dengan relayer `tuning.mjs`. */
export function effectiveApy(knobs: Knobs | undefined, t: Tuning, fallbackBps: number | null, priceUsd?: number): Effective {
  const rew = knobs?.rewards;
  const base = rew ? rew.baseApyBps : knobs?.range ? knobs.range.baseApyBps : knobs?.loop ? knobs.loop.supplyApyBps : fallbackBps ?? 0;
  const reward = rew && t.takeRewards ? (rew.rewardApyBps * (10_000 - rew.haircutBps)) / 10_000 : 0;
  let apy = base + reward;
  let loop = 1;
  const lp = knobs?.loop;
  if (lp?.allowed && lp.borrowApyBps !== null) {
    loop = Math.min(t.loopX100, lp.maxX100) / 100;
    apy = loop * apy - (loop - 1) * lp.borrowApyBps;
  }
  let rangeFactor = 1;
  let inRange: boolean | null = null;
  const rg = knobs?.range;
  if (rg) {
    rangeFactor = efficiency(t.rangeBps) / efficiency(rg.refRangeBps);
    const center = Number(t.centerPriceE8) / 1e8;
    const price = priceUsd ?? rg.priceUsd;
    inRange = t.rangeBps <= 0 || center <= 0 ? true : price >= center / (1 + t.rangeBps / 10_000) && price <= center * (1 + t.rangeBps / 10_000);
    apy = inRange ? apy * rangeFactor : 0;
  }
  const uncapped = Math.round(apy);
  return { apyBps: Math.max(0, Math.min(5000, uncapped)), uncappedBps: uncapped, inRange, parts: { base, reward: Math.round(reward), loop, rangeFactor } };
}

export const TUNE_STEPS: Step[] = [
  { id: "sign", label: "Sign the new setting", state: "todo" },
  { id: "send", label: "Sent to Monad", state: "todo" },
  { id: "confirm", label: "Setting saved on the adapter", state: "todo" },
];

/**
 * Menyimpan setelan baru di adapter. Kunci wakil dipakai bila ia memang wakil kota yang masih berlaku (tanpa prompt);
 * selain itu kunci utama walikota lewat ceremony passkey.
 */
export async function setTuningFlow(args: { wallet: WalletApi; adapter: Hex; owner: Hex; tuning: Tuning; useDeputy: boolean; report: (id: string, patch: Partial<Step>) => void }): Promise<{ hash: Hex }> {
  const { wallet, adapter, owner, tuning, useDeputy, report } = args;
  const data = encodeFunctionData({ abi: tunedAdapterAbi, functionName: "setTuning", args: [encodeTuning(tuning)] });
  const signer = useDeputy ? (wallet.deputy as Hex) : owner;
  report("sign", { state: "active", detail: useDeputy ? undefined : "Confirm with your passkey" });
  const [estimate, block] = await Promise.all([
    publicClient.estimateGas({ account: signer, to: adapter, data }),
    publicClient.getBlock(),
  ]);
  const tip = 2_000_000_000n;
  const base = block.baseFeePerGas ?? 50_000_000_000n;
  const tx = { to: adapter, data, gas: (estimate * 125n) / 100n, maxFeePerGas: (base * 3n) / 2n + tip, maxPriorityFeePerGas: tip };
  const hash = useDeputy
    ? await wallet.sendAsDeputy(tx)
    : await wallet.withCeremony("Confirm the new setting with your passkey…", async (account) => {
        const { createWalletClient } = await import("viem");
        return createWalletClient({ account, chain: monadTestnet, transport: rpcTransport() }).sendTransaction(tx as never);
      });
  report("sign", { state: "done", detail: undefined });
  report("send", { state: "done", hash });
  report("confirm", { state: "active" });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The transaction was reverted.");
  report("confirm", { state: "done" });
  return { hash };
}
