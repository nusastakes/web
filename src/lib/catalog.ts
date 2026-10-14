"use client";

import { useEffect, useState } from "react";
import { keccak256, toHex } from "viem";
import { ADDR, RELAYER_URL, SOURCE_ID } from "./config";
import { currentLang, type Lang } from "./lang";
import type { DistrictKind, Hex } from "./types";

/**
 * Katalog layanan protokol (TC67, B2.28): tiap distrik kota adalah cermin satu protokol Monad mainnet (APY dan TVL langsung
 * dari DefiLlama lewat relayer `GET /catalog`); dana di testnet tetap AUSD faucet. Bila relayer belum punya `/catalog`,
 * dipakai daftar statis yang sama; hanya layanan yang punya alamat implementasi adapter (`impl`) yang bisa dipilih saat
 * mendirikan kota.
 */

export type ServiceCategory = "bank" | "vault" | "staking" | "market";
export const CATEGORY_KIND: Record<ServiceCategory, DistrictKind> = { bank: "lending", vault: "vault", staking: "staking", market: "market" };

export interface Service {
  id: string;
  name: string;
  protocol: string;
  category: ServiceCategory;
  asset: "AUSD" | "MON";
  /** Implementasi adapter yang diizinkan factory; null bila belum disebar (belum bisa dipilih). */
  impl: Hex | null;
  sourceId: Hex;
  apyBps: number | null;
  tvlUsd: number | null;
  observedAt: number | null;
  pool: string;
  /** True bila angka berasal dari relayer; false untuk potret statis. */
  live: boolean;
  /** Teks bawaan relayer; tampilan memakai teks dua bahasa dari `copy-catalog.ts` bila id dikenal. */
  blurb?: string; flow?: string; risk?: string;
  /** Setelan yang boleh dipakai penyetor di protokol aslinya (TC67.10); kosong bila protokol tidak memberi setelan. */
  knobs?: Knobs; knobsNote?: string;
}

/** Setelan per protokol dari relayer `/catalog`: angka APY dalam basis poin dari data mainnet. */
export interface Knobs {
  loop?: { allowed: boolean; reason?: string; maxX100: number; supplyApyBps: number; borrowApyBps: number | null; ltv: number | null };
  rewards?: { baseApyBps: number; rewardApyBps: number; haircutBps: number };
  range?: { priceUsd: number; options: number[]; refRangeBps: number; baseApyBps: number };
}

const sid = (pool: string) => keccak256(toHex(pool)) as Hex;

interface Seed { id: string; name: string; protocol: string; category: ServiceCategory; asset: "AUSD" | "MON"; pool: string; apyBps: number | null; tvlUsd: number | null; sourceId?: Hex }
/** Potret DefiLlama Yields (Monad), 13 Okt 2026 sekitar 22.38 WIB; angka hidup datang dari `/catalog`. */
const SEEDS: Seed[] = [
  { id: "morpho-grove", name: "Morpho · Grove x Steakhouse AUSD", protocol: "Morpho", category: "bank", asset: "AUSD", pool: "morpho-grove", apyBps: null, tvlUsd: null, sourceId: SOURCE_ID },
  { id: "aave-ausd", name: "Aave v3 · AUSD", protocol: "Aave v3", category: "bank", asset: "AUSD", pool: "d795cb4c-e30f-52c0-8447-bf0853763a20", apyBps: 584, tvlUsd: 3_161_784 },
  { id: "euler-ausd", name: "Euler v2 · eAUSD", protocol: "Euler v2", category: "bank", asset: "AUSD", pool: "e150c112-d6f3-42f5-8c8d-78580058e1fd", apyBps: 895, tvlUsd: 1_632_724 },
  { id: "curvance-ausd", name: "Curvance · AUSD", protocol: "Curvance", category: "bank", asset: "AUSD", pool: "90924439-8fb8-4e6a-afe3-9ba393e68fdc", apyBps: 600, tvlUsd: 2_186_245 },
  { id: "upshift-earnausd", name: "Upshift · earnAUSD", protocol: "Upshift", category: "vault", asset: "AUSD", pool: "e10580de-1ad2-4bbc-a0e8-ad4db95df4a3", apyBps: 615, tvlUsd: 19_197_987 },
  { id: "curve-ausd-3pool", name: "Curve · AUSD/USDC/USDT0", protocol: "Curve", category: "market", asset: "AUSD", pool: "ceb80408-8ab8-4293-b274-162efff518a6", apyBps: 551, tvlUsd: 2_292_934 },
  { id: "balancer-avusd", name: "Balancer v3 · AVUSD/AUSD", protocol: "Balancer v3", category: "market", asset: "AUSD", pool: "86d04138-6712-5be0-85f4-1d92331ca1d5", apyBps: 885, tvlUsd: 2_060_330 },
  { id: "shmonad", name: "ShMonad · staking MON", protocol: "ShMonad", category: "staking", asset: "MON", pool: "ee40513c-9356-4c53-9f26-446b484a8ae2", apyBps: 1439, tvlUsd: 8_642_117 },
  // Perluasan (TC68.12): 10 layanan lagi dari DefiLlama Yields; belum punya `impl` sampai adapter disebar.
  { id: "accountable-ausd", name: "Accountable · AUSD", protocol: "Accountable", category: "bank", asset: "AUSD", pool: "4baffdfd-8015-4713-bad4-10a199b30157", apyBps: 668, tvlUsd: 100_581_342 },
  { id: "neverland-ausd", name: "Neverland · AUSD", protocol: "Neverland", category: "bank", asset: "AUSD", pool: "ba0f675f-9f14-407b-b278-66d8f59f49ca", apyBps: 941, tvlUsd: 251_540 },
  { id: "morpho-hyperusdc", name: "Morpho · HyperUSDC", protocol: "Morpho", category: "bank", asset: "AUSD", pool: "ec6a71a7-41ae-4e72-942f-b4bc99c3b3cb", apyBps: 745, tvlUsd: 51_778_924 },
  { id: "yuzu-syzusd", name: "Yuzu Money · syzUSD", protocol: "Yuzu Money", category: "vault", asset: "AUSD", pool: "c51e151e-44ad-4f25-9911-102bd00811dc", apyBps: 795, tvlUsd: 10_609_630 },
  { id: "beefy-usdc", name: "Beefy · USDC", protocol: "Beefy", category: "vault", asset: "AUSD", pool: "70f959a9-0167-54b4-a89b-53e35d75cd8e", apyBps: 603, tvlUsd: 3_818_993 },
  { id: "infinifi-siusd", name: "infiniFi · siUSD", protocol: "infiniFi", category: "vault", asset: "AUSD", pool: "9d102f42-e9e8-51dc-9eb4-83e1b02ccd1e", apyBps: 696, tvlUsd: 2_038_540 },
  { id: "pendle-ausd-fixed", name: "Pendle v2 · PT-AUSD (fixed rate)", protocol: "Pendle v2", category: "vault", asset: "AUSD", pool: "653d8a8d-d221-5482-884b-1f936df4cd9e", apyBps: 541, tvlUsd: 2_531_713 },
  { id: "mento-ausd-usdm", name: "Mento · AUSD/USDm", protocol: "Mento", category: "market", asset: "AUSD", pool: "ce74b9e0-376d-45ea-b1a4-362de60c12ce", apyBps: 1349, tvlUsd: 2_322_443 },
  { id: "uniswap-wmon-usdc", name: "Uniswap v3 · WMON/USDC (volatile)", protocol: "Uniswap v3", category: "market", asset: "AUSD", pool: "82b60bc0-ec94-561a-a9e4-c481d47746dd", apyBps: 12_425, tvlUsd: 1_250_673 },
  { id: "kintsu-smon", name: "Kintsu · sMON (staking MON)", protocol: "Kintsu", category: "staking", asset: "MON", pool: "73c511a9-4dc0-4397-babe-e578fd75f0dd", apyBps: 1702, tvlUsd: 1_799_864 },
];

/**
 * Nama layanan menurut bahasa toggle: nama protokol dan token tetap, hanya keterangan dalam kurung yang diterjemahkan.
 * Objek layanan memakai getter `name`, jadi nama ikut berganti saat toggle bahasa berubah.
 */
export function serviceName(name: string, lang: Lang = currentLang()): string {
  if (lang === "en") return name;
  return name.replace("(fixed rate)", "(bunga tetap)").replace("(volatile)", "(harga bergejolak)");
}

export function staticCatalog(): Service[] {
  return SEEDS.map((s) => ({
    id: s.id, get name() { return serviceName(s.name); }, protocol: s.protocol, category: s.category, asset: s.asset,
    impl: s.id === "morpho-grove" ? ADDR.mirrorAdapterImpl : null,
    sourceId: s.sourceId ?? sid(s.pool), apyBps: s.apyBps, tvlUsd: s.tvlUsd, observedAt: null, pool: s.pool, live: false,
  }));
}

interface RelayerService {
  id: string; name?: string; protocol?: string; category?: string; asset?: string; impl?: string; sourceId?: string;
  apyBps?: number; tvlUsd?: number; observedAt?: number; pool?: string; blurb?: string; flow?: string; risk?: string;
  knobs?: Knobs; knobsNote?: string;
}
const isAddr = (v: unknown): v is Hex => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
const isHex32 = (v: unknown): v is Hex => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
const CATS = new Set<string>(["bank", "vault", "staking", "market"]);

/** Katalog dari relayer digabung ke daftar statis: nilai hidup menimpa potret; layanan baru di relayer ikut tampil. */
function merge(rows: RelayerService[]): Service[] {
  const base = new Map(staticCatalog().map((s) => [s.id, s]));
  const out: Service[] = [];
  for (const r of rows) {
    if (typeof r.id !== "string" || !/^[a-z0-9-]{2,40}$/.test(r.id)) continue;
    const s = base.get(r.id);
    const category = CATS.has(String(r.category)) ? (r.category as ServiceCategory) : s?.category;
    if (!category) continue;
    const rawName = SEEDS.find((x) => x.id === r.id)?.name ?? String(r.name ?? r.id).slice(0, 60);
    out.push({
      id: r.id,
      get name() { return serviceName(rawName); },
      protocol: s?.protocol ?? String(r.protocol ?? r.id).slice(0, 40),
      category, asset: (r.asset === "MON" ? "MON" : s?.asset ?? "AUSD"),
      impl: isAddr(r.impl) ? r.impl : s?.impl ?? null,
      sourceId: isHex32(r.sourceId) ? r.sourceId : s?.sourceId ?? sid(String(r.pool ?? r.id)),
      apyBps: Number.isFinite(r.apyBps) ? Number(r.apyBps) : s?.apyBps ?? null,
      tvlUsd: Number.isFinite(r.tvlUsd) ? Number(r.tvlUsd) : s?.tvlUsd ?? null,
      observedAt: Number.isFinite(r.observedAt) ? Number(r.observedAt) : null,
      pool: String(r.pool ?? s?.pool ?? r.id), live: true,
      // Teks relayer tidak tepercaya sepenuhnya: dipotong, ditampilkan sebagai teks biasa.
      blurb: typeof r.blurb === "string" ? r.blurb.slice(0, 200) : undefined,
      flow: typeof r.flow === "string" ? r.flow.slice(0, 200) : undefined,
      risk: typeof r.risk === "string" ? r.risk.slice(0, 200) : undefined,
      knobs: r.knobs && typeof r.knobs === "object" ? r.knobs : undefined,
      knobsNote: typeof r.knobsNote === "string" ? r.knobsNote.slice(0, 200) : undefined,
    });
  }
  return out.length ? out : staticCatalog();
}

let cache: { at: number; services: Service[] } | null = null;
let inflight: Promise<Service[]> | null = null;
const TTL = 60_000;

export async function loadCatalog(force = false): Promise<Service[]> {
  if (cache && (cache.at > Date.now() || (!force && Date.now() - cache.at < TTL))) return cache.services;
  if (inflight) return inflight;
  inflight = (async () => {
    let services = staticCatalog();
    let ok = false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${RELAYER_URL}/catalog`, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
      if (res.ok) {
        const json = (await res.json()) as { services?: RelayerService[] };
        if (Array.isArray(json.services)) { services = merge(json.services); ok = true; }
      }
    } catch { /* relayer belum punya /catalog: pakai daftar statis */ }
    // Bila relayer belum punya /catalog, jangan menanyakan lagi tiap menit: coba ulang sekitar lima menit kemudian.
    cache = { at: ok ? Date.now() : Date.now() + 4 * TTL, services };
    return services;
  })().finally(() => { inflight = null; });
  return inflight;
}

/** Layanan menurut `sourceId` adapter (tanpa membedakan huruf besar-kecil). */
export function serviceBySource(services: Service[], sourceId: string | null | undefined): Service | undefined {
  if (!sourceId) return undefined;
  const k = sourceId.toLowerCase();
  return services.find((s) => s.sourceId.toLowerCase() === k);
}

export function useCatalog(): { services: Service[]; ready: boolean } {
  const [state, setState] = useState<{ services: Service[]; ready: boolean }>({ services: cache?.services ?? staticCatalog(), ready: !!cache });
  useEffect(() => {
    let cancelled = false;
    void loadCatalog().then((services) => { if (!cancelled) setState({ services, ready: true }); });
    const id = window.setInterval(() => { void loadCatalog().then((services) => { if (!cancelled) setState({ services, ready: true }); }); }, 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);
  return state;
}
