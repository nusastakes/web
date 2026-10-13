import { WORKS, developmentOf, fundsForDevelopment } from "./scene/themes";

/**
 * Pelatih walikota: mengubah keadaan kota di chain menjadi bahasa awam (tahap kota, langkah berikutnya, kesehatan dana,
 * saran). Semuanya aturan sederhana yang bisa diperiksa, bukan model AI dan bukan nasihat keuangan. Teksnya ada di
 * `copy-desk.ts`; berkas ini hanya memutuskan APA yang ditampilkan.
 */

/** Batas tahap kota menurut perkembangan 0..1 (`developmentOf`): 40, 400, 4.000, dan 20.000 AUSD kira-kira. */
export const STAGE_DEV = [0, 0.1, 0.33, 0.63, 0.85] as const;
export const STAGE_IDS = ["land", "hamlet", "town", "city", "metro"] as const;
export type StageId = (typeof STAGE_IDS)[number];

export interface StageInfo {
  index: number;
  id: StageId;
  /** 0..1 menuju tahap berikutnya; 1 di tahap terakhir. */
  progress: number;
  /** Dana (AUSD) kira-kira yang membuka tahap berikutnya; null di tahap terakhir. */
  nextAt: number | null;
  /** Karya sipil berikutnya yang terbuka dan dana kira-kira yang dibutuhkan; null bila semua sudah terbuka. */
  nextWork: { id: string; label: string; at: number } | null;
}

export function stageOf(assets: number): StageInfo {
  const dev = developmentOf(assets);
  let index = 0;
  for (let i = 0; i < STAGE_DEV.length; i++) if (dev >= STAGE_DEV[i]) index = i;
  const last = index === STAGE_DEV.length - 1;
  const lo = STAGE_DEV[index], hi = last ? 1 : STAGE_DEV[index + 1];
  const work = WORKS.find((w) => w.unlockAt > dev);
  return {
    index, id: STAGE_IDS[index],
    progress: last ? 1 : Math.max(0, Math.min(1, (dev - lo) / (hi - lo))),
    nextAt: last ? null : fundsForDevelopment(hi),
    nextWork: work ? { id: work.id, label: work.label, at: fundsForDevelopment(work.unlockAt) } : null,
  };
}

export type ServiceCat = "bank" | "vault" | "staking" | "market";
export interface ServiceRow { id: string; name: string; category: ServiceCat; assets: number; /** bagian dari dana yang bekerja, 0..1 */ share: number; apyBps: number | null }

export interface DeskCtx {
  /** Layanan protokol (distrik selain Alun-alun) beserta dana dan imbal hasilnya. */
  services: ServiceRow[];
  /** Perkiraan imbal hasil setahun dari dana yang bekerja (AUSD), dari APY tiap layanan. */
  yearlyYield: number | null;
  total: number;
  idle: number;
  working: number;
  /** Persentase dana yang bekerja di distrik (0..100). */
  workingPct: number;
  apyBps: number | null;
  feeBps: number;
  residents: number | null;
  rank: number | null;
  hired: { satpam: boolean; analis: boolean; humas: boolean } | null;
  bookCount: number | null;
  styleChanged: boolean;
  deputy: boolean;
  trend: { pct: number; hours: number } | null;
}

export type StepId = "fund" | "invite" | "work" | "spread" | "analyst" | "book" | "design" | "deputy";
export interface StepState { id: StepId; /** null = belum diketahui */ done: boolean | null }

export function stepsFor(c: DeskCtx): StepState[] {
  const many = c.services.length >= 2;
  return [
    { id: "fund", done: c.total > 0 },
    { id: "invite", done: c.residents === null ? null : c.residents >= 2 },
    { id: "work", done: c.total > 0 && c.workingPct >= 20 },
    ...(many ? [{ id: "spread" as const, done: c.services.filter((s) => s.assets > 0).length >= 2 }] : []),
    { id: "analyst", done: c.hired ? c.hired.analis : null },
    { id: "book", done: c.bookCount === null ? null : c.bookCount > 0 },
    { id: "design", done: c.styleChanged },
    { id: "deputy", done: c.deputy },
  ];
}

export type AdviceId = "empty" | "idleHigh" | "trendDown" | "lockedHigh" | "concentrated" | "bestRate" | "singleService" | "noResidents" | "hireAnalyst" | "feeHigh" | "feeZero" | "trendUp" | "allGood";

/** Paling banyak tiga saran, urut dari yang paling mendesak. */
export function adviceFor(c: DeskCtx): AdviceId[] {
  const out: AdviceId[] = [];
  if (c.total <= 0) out.push("empty");
  if (c.total > 0 && c.workingPct < 20) out.push("idleHigh");
  if (c.trend && c.trend.pct <= -5) out.push("trendDown");
  if (c.total > 0 && c.workingPct > 85) out.push("lockedHigh");
  const top = [...c.services].sort((a, b) => b.share - a.share)[0];
  if (c.services.length >= 2 && c.working > 0 && top && top.share > 0.7) out.push("concentrated");
  const rated = c.services.filter((s) => s.apyBps !== null);
  if (rated.length >= 2 && c.working > 0) {
    const best = [...rated].sort((a, b) => (b.apyBps ?? 0) - (a.apyBps ?? 0))[0];
    const avg = rated.reduce((s, x) => s + (x.apyBps ?? 0), 0) / rated.length;
    if (best.share < 0.2 && (best.apyBps ?? 0) >= avg + 150) out.push("bestRate");
  }
  if (c.services.length === 1 && c.total > 0) out.push("singleService");
  if (c.total > 0 && c.residents !== null && c.residents <= 1) out.push("noResidents");
  if (c.total > 0 && c.hired && !c.hired.analis) out.push("hireAnalyst");
  if (c.feeBps > 1500) out.push("feeHigh");
  if (c.feeBps === 0 && c.total > 0) out.push("feeZero");
  if (c.trend && c.trend.pct >= 5) out.push("trendUp");
  return out.length ? out.slice(0, 3) : ["allGood"];
}

/** Strategi cepat: bagian dana yang dibiarkan bekerja di distrik; sisanya tetap di Alun-alun sebagai kas penarikan. */
export const PRESETS = [
  { id: "safe", pct: 30 },
  { id: "balanced", pct: 60 },
  { id: "bold", pct: 90 },
] as const;
export type PresetId = (typeof PRESETS)[number]["id"];

export function nearestPreset(workingPct: number): PresetId | null {
  if (workingPct <= 0) return null;
  let best: PresetId = PRESETS[0].id, d = Infinity;
  for (const p of PRESETS) { const x = Math.abs(p.pct - workingPct); if (x < d) { d = x; best = p.id; } }
  return d <= 3 ? best : null;
}

/** Perkiraan penghasilan walikota per bulan (AUSD): dana yang bekerja x APY x fee, dikurangi 10% bagian platform. */
export function monthlyIncome(working: number, apyBps: number | null, feeBps: number): number | null {
  if (apyBps === null || working <= 0) return null;
  return (working * (apyBps / 10_000) * (feeBps / 10_000) * 0.9) / 12;
}


// ---------------------------------------------------------------------------------------------------------------
// Strategi cepat lintas layanan: dari porsi dana yang bekerja dan campuran jenis layanan menjadi daftar pemindahan.
// ---------------------------------------------------------------------------------------------------------------

export interface PlanSlot { id: string; address: string; assets: bigint; idle: boolean; category?: ServiceCat }
export interface PlanMove { from: PlanSlot; to: PlanSlot; amount: bigint }

/** Campuran jenis layanan per strategi: "inti" = bank dan brankas, "tepi" = pasar dan staking. */
const MIX: Record<PresetId, { core: number; edge: number }> = { safe: { core: 1, edge: 0 }, balanced: { core: 0.7, edge: 0.3 }, bold: { core: 0.4, edge: 0.6 } };
const MIN_MOVE = 10_000n; // 0,01 AUSD

/**
 * Menyusun pemindahan agar `pct` persen dana bekerja, dibagi rata di dalam tiap kelompok (inti, tepi) sesuai campuran
 * strategi; kelompok yang tidak ada diganti kelompok lain. Pertama kelebihan dikembalikan ke Alun-alun, lalu kekurangan
 * diisi dari Alun-alun. Tiap pemindahan paling besar `limitBps` dari total (aturan kota); paling banyak `maxMoves`.
 */
export function planPreset(slots: PlanSlot[], pct: number, preset: PresetId, limitBps: number, maxMoves = 6): PlanMove[] {
  const idle = slots.find((s) => s.idle);
  const work = slots.filter((s) => !s.idle);
  if (!idle || work.length === 0) return [];
  const total = slots.reduce((s, x) => s + x.assets, 0n);
  const core = work.filter((s) => s.category === "bank" || s.category === "vault" || !s.category);
  const edge = work.filter((s) => s.category === "market" || s.category === "staking");
  let mix = MIX[preset];
  if (edge.length === 0) mix = { core: 1, edge: 0 }; else if (core.length === 0) mix = { core: 0, edge: 1 };
  const pool = (Number(total) * pct) / 100;
  const target = new Map<string, bigint>();
  for (const s of core) target.set(s.id, BigInt(Math.floor((pool * mix.core) / core.length)));
  for (const s of edge) target.set(s.id, BigInt(Math.floor((pool * mix.edge) / edge.length)));
  const cap = (total * BigInt(limitBps)) / 10_000n;
  if (cap <= 0n) return [];
  const moves: PlanMove[] = [];
  let idleLeft = idle.assets;
  const take = (n: bigint) => (n > cap ? cap : n);
  // 1) kelebihan kembali ke Alun-alun
  for (const s of work) {
    let over = s.assets - (target.get(s.id) ?? 0n);
    while (over > MIN_MOVE && moves.length < maxMoves) {
      const a = take(over);
      moves.push({ from: s, to: idle, amount: a });
      idleLeft += a; over -= a;
    }
  }
  // 2) kekurangan diisi dari Alun-alun
  for (const s of work) {
    let need = (target.get(s.id) ?? 0n) - s.assets;
    while (need > MIN_MOVE && idleLeft > MIN_MOVE && moves.length < maxMoves) {
      const a = take(need < idleLeft ? need : idleLeft);
      moves.push({ from: idle, to: s, amount: a });
      idleLeft -= a; need -= a;
    }
  }
  return moves;
}
