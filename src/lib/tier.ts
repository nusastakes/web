"use client";

import { useEffect, useState } from "react";
import { vaultAbi } from "./abis";
import { publicClient } from "./chain";
import { getScore, type CityScore } from "./relayer";
import type { CityView, Hex } from "./types";

/**
 * Membuka layanan bertahap (vault TC67.10, arahan user 14 Okt): walikota baru memasang sedikit layanan, lalu membuka
 * lebih banyak dengan syarat yang DIRAIH, bukan dibeli: tahap kota terbaik yang pernah ia bangun (skor relayer) atau
 * dana miliknya sendiri yang ikut ditaruh di kotanya (skin in the game, seperti manajer reksa dana). Tidak ada top-up
 * ke platform. Ini aturan permainan di aplikasi; kontrak tetap mengizinkan paling banyak 8 layanan per kota.
 */

export const TIERS = [
  { slots: 3, stage: null, ownFunds: 0 },
  { slots: 5, stage: "town", ownFunds: 100 },
  { slots: 8, stage: "city", ownFunds: 1000 },
] as const;
const STAGE_RANK: Record<string, number> = { empty: 0, village: 1, town: 2, city: 3, metropolis: 4 };

export interface MayorTier { level: 0 | 1 | 2; slots: number; bestStage: CityScore["stage"] | null; ownFunds: number; next: (typeof TIERS)[number] | null; ready: boolean }

export function useMayorTier(owner: Hex | undefined, cities: CityView[]): MayorTier {
  const mine = cities.filter((c) => !c.preview && c.vault && c.mayor && owner && c.mayor.toLowerCase() === owner.toLowerCase());
  const key = mine.map((c) => c.vault).join(",");
  const [state, setState] = useState<{ key: string; bestStage: CityScore["stage"] | null; ownFunds: number } | null>(null);

  useEffect(() => {
    if (!owner) return;
    let cancelled = false;
    const vaults = key ? (key.split(",") as Hex[]) : [];
    (async () => {
      const scores = await Promise.all(vaults.map((v) => getScore(v).catch(() => null)));
      const funds = vaults.length
        ? await publicClient.multicall({ allowFailure: true, contracts: vaults.map((v) => ({ address: v, abi: vaultAbi, functionName: "balanceOf", args: [owner] }) as const) })
        : [];
      const assets = await Promise.all(vaults.map((v, i) => {
        const r = funds[i];
        const shares = r?.status === "success" ? (r.result as bigint) : 0n;
        return shares > 0n ? publicClient.readContract({ address: v, abi: vaultAbi, functionName: "convertToAssets", args: [shares] }).catch(() => 0n) : Promise.resolve(0n);
      }));
      let best: CityScore["stage"] | null = null;
      for (const s of scores) if (s && (best === null || STAGE_RANK[s.stage] > STAGE_RANK[best])) best = s.stage;
      const own = assets.reduce((sum, a) => sum + Number(a) / 1e6, 0);
      if (!cancelled) setState({ key, bestStage: best, ownFunds: own });
    })().catch(() => { if (!cancelled) setState({ key, bestStage: null, ownFunds: 0 }); });
    return () => { cancelled = true; };
  }, [owner, key]);

  const cur = state && state.key === key ? state : null;
  const rank = cur?.bestStage ? STAGE_RANK[cur.bestStage] : 0;
  const own = cur?.ownFunds ?? 0;
  const level: 0 | 1 | 2 = rank >= STAGE_RANK.city || own >= TIERS[2].ownFunds ? 2 : rank >= STAGE_RANK.town || own >= TIERS[1].ownFunds ? 1 : 0;
  return { level, slots: TIERS[level].slots, bestStage: cur?.bestStage ?? null, ownFunds: own, next: level < 2 ? TIERS[level + 1] : null, ready: !!cur || !owner };
}
