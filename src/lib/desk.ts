"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MayorState } from "./actions";
import { guardianAbi } from "./abis";
import { publicClient } from "./chain";
import type { DeskCtx, ServiceCat, ServiceRow } from "./coach";
import { ADDR } from "./config";
import { getAgents, getBook, getLeaderboard, type LeaderRow } from "./relayer";
import type { CityView, Hex } from "./types";

/** Data tambahan untuk Meja Walikota yang bukan dari vault: peringkat dan penduduk, staf yang disewa, rencana, tren dana. */

export interface Hired { satpam: boolean; analis: boolean; humas: boolean }

async function readHired(vault: Hex): Promise<Hired> {
  const list = (await getAgents()).agents;
  const now = Math.floor(Date.now() / 1000);
  const res = await publicClient.multicall({
    allowFailure: true,
    contracts: list.map((a) => ({ address: ADDR.guardian, abi: guardianAbi, functionName: "agents", args: [vault, (a.address ?? "0x0000000000000000000000000000000000000000") as Hex] }) as const),
  });
  const out: Hired = { satpam: false, analis: false, humas: false };
  list.forEach((a, i) => {
    const r = res[i];
    if (r.status !== "success") return;
    const [role, expiry] = r.result as readonly [number, bigint];
    if (role === a.role && Number(expiry) > now) out[a.id] = true;
  });
  return out;
}

export interface DeskExtras {
  board: LeaderRow | null;
  minRankedAusd: number;
  hired: Hired | null;
  bookCount: number | null;
  loading: boolean;
}

/** Membaca data tambahan sekali lalu tiap 25 detik; setiap sumber boleh gagal tanpa mematikan yang lain. */
export function useDeskExtras(vault: Hex | undefined, owner: Hex | undefined): DeskExtras & { refresh: () => void } {
  const [data, setData] = useState<DeskExtras>({ board: null, minRankedAusd: 1, hired: null, bookCount: null, loading: true });
  const alive = useRef(true);
  const load = useCallback(async () => {
    if (!vault) return;
    const [lb, hired, book] = await Promise.allSettled([getLeaderboard(), readHired(vault), owner ? getBook(owner) : Promise.reject(new Error("no owner"))]);
    if (!alive.current) return;
    setData((d) => ({
      board: lb.status === "fulfilled" ? lb.value.cities.find((c) => c.vault.toLowerCase() === vault.toLowerCase()) ?? null : d.board,
      minRankedAusd: lb.status === "fulfilled" ? Number(lb.value.minRankedTvl) / 1e6 : d.minRankedAusd,
      hired: hired.status === "fulfilled" ? hired.value : d.hired,
      bookCount: book.status === "fulfilled" ? book.value.entries.length : d.bookCount,
      loading: false,
    }));
  }, [vault, owner]);
  useEffect(() => {
    alive.current = true;
    if (!vault) return;
    queueMicrotask(() => void load());
    const id = window.setInterval(() => void load(), 25_000);
    return () => { alive.current = false; window.clearInterval(id); };
  }, [vault, load]);
  return { ...data, refresh: () => void load() };
}

interface Point { t: number; v: number }
const trendKey = (vault: string) => `nusastakes.tvl.v1.${vault.toLowerCase()}`;
const DAY = 24 * 3600 * 1000;

/**
 * Momentum dana: perubahan total dana dibanding titik tertua dalam 24 jam, dari catatan di browser ini (belum ada
 * pencatat riwayat di relayer). Null sampai ada dua titik yang berjarak minimal 3 menit.
 */
export function useTvlTrend(vault: Hex | undefined, total: number | undefined): { pct: number; hours: number } | null {
  const [trend, setTrend] = useState<{ pct: number; hours: number } | null>(null);
  useEffect(() => {
    if (!vault || total === undefined) return;
    let pts: Point[] = [];
    try { pts = JSON.parse(localStorage.getItem(trendKey(vault)) ?? "[]") as Point[]; } catch { pts = []; }
    const now = Date.now();
    pts = pts.filter((p) => now - p.t < DAY && Number.isFinite(p.v));
    const last = pts.at(-1);
    if (!last || now - last.t > 5 * 60_000 || Math.abs(last.v - total) > Math.max(0.5, last.v * 0.005)) pts.push({ t: now, v: total });
    pts = pts.slice(-60);
    try { localStorage.setItem(trendKey(vault), JSON.stringify(pts)); } catch { /* penyimpanan diblokir */ }
    const first = pts[0];
    const next = first && now - first.t >= 3 * 60_000 && first.v > 0 ? { pct: ((total - first.v) / first.v) * 100, hours: (now - first.t) / 3_600_000 } : null;
    queueMicrotask(() => setTrend(next));
  }, [vault, total]);
  return trend;
}

/** Konteks pelatih (`DeskCtx`) untuk satu kota: gabungan keadaan vault, relayer, dan catatan tren di browser. */
export function useDeskCtx(city: CityView, state: MayorState | undefined, owner: Hex | undefined, styleChanged: boolean) {
  const extras = useDeskExtras(city.vault, owner);
  const total = state ? Number(state.total) / 1e6 : undefined;
  const trend = useTvlTrend(city.vault, total);
  const ctx: DeskCtx | null = useMemo(() => {
    if (!state || total === undefined) return null;
    const idle = Number(state.slots.find((s) => s.id === "idle")?.assets ?? 0n) / 1e6;
    const working = Math.max(0, total - idle);
    const main = [...city.districts].filter((d) => d.kind !== "idle" && d.apyBps !== null).sort((a, b) => b.assets - a.assets)[0];
    const services: ServiceRow[] = city.districts.filter((d) => d.kind !== "idle").map((d) => {
      const slot = state.slots.find((s) => s.id === d.id);
      const assets = slot ? Number(slot.assets) / 1e6 : d.assets;
      return { id: d.id, name: d.label, category: (d.category ?? (d.kind === "vault" ? "vault" : d.kind === "staking" ? "staking" : d.kind === "market" ? "market" : "bank")) as ServiceCat, assets, share: working > 0 ? assets / working : 0, apyBps: d.apyBps };
    });
    const yearlyYield = services.some((s) => s.apyBps !== null) ? services.reduce((sum, s) => sum + s.assets * ((s.apyBps ?? 0) / 10_000), 0) : null;
    return {
      services, yearlyYield,
      total, idle, working, workingPct: total > 0 ? (working / total) * 100 : 0,
      apyBps: main?.apyBps ?? null, feeBps: city.feeBps,
      residents: extras.board ? extras.board.residents : null,
      rank: extras.board?.ranked ? extras.board.rank : null,
      hired: extras.hired, bookCount: extras.bookCount, styleChanged, deputy: !!state.deputy, trend,
    };
  }, [state, total, city.districts, city.feeBps, extras.board, extras.hired, extras.bookCount, styleChanged, trend]);
  return { ctx, extras, trend };
}
