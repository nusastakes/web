"use client";

import { useState } from "react";
import type { MayorState, Step } from "@/lib/actions";
import { CATEGORY_KIND } from "@/lib/catalog";
import { ausd, useCityHistory, useCityScore } from "@/lib/cityStats";
import { PRESETS, adviceFor, monthlyIncome, nearestPreset, stageOf, stepsFor, type PresetId, type StepId } from "@/lib/coach";
import { CATALOG_COPY } from "@/lib/copy-catalog";
import { DISTRICT_COLORS } from "@/lib/palette";
import { DESK } from "@/lib/copy-desk";
import { useDeskCtx } from "@/lib/desk";
import { fmtAusd, fmtBps, fmtWhole } from "@/lib/format";
import { useLang } from "@/lib/lang";
import type { CityView, Hex } from "@/lib/types";
import StepList from "../StepList";
import { Badge, Notice, Spinner, cx } from "../ui";

/**
 * Meja Walikota: untuk walikota awam. Menjawab "kota saya sedang di tahap apa, apa langkah berikutnya, apakah dana saya
 * sehat, dan strategi apa yang bisa saya pilih dengan satu ketukan", tanpa istilah teknis. Semua angka dibaca dari kota
 * (vault, relayer); saran adalah aturan sederhana di `lib/coach.ts`.
 */

type Tab = "funds" | "book" | "staff" | "design";

/** Tahap dari skor relayer (`score.mjs` STAGES) dipetakan ke nama tahap yang sudah ada di teks Meja Walikota. */
const SCORE_STAGES = [
  { id: "empty", copy: "land", min: 0 },
  { id: "village", copy: "hamlet", min: 5 },
  { id: "town", copy: "town", min: 20 },
  { id: "city", copy: "city", min: 40 },
  { id: "metropolis", copy: "metro", min: 65 },
] as const;
interface Props {
  city: CityView;
  state: MayorState;
  owner: Hex;
  styleChanged: boolean;
  go: (tab: Tab) => void;
  openDeposit: () => void;
  openFound: () => void;
  applyPreset: (preset: PresetId, pct: number) => void;
  presetBusy: boolean;
  presetSteps: Step[] | null;
  presetNote: { tone: "good" | "info"; text: string } | null;
  /** Batas satu perubahan (persen dari kota) untuk kunci yang sedang dipakai. */
  limitBps: number;
}


export default function MayorDesk({ city, state, owner, styleChanged, go, openDeposit, openFound, applyPreset, presetBusy, presetSteps, presetNote, limitBps }: Props) {
  const [lang] = useLang();
  const t = DESK[lang];
  const { ctx: maybeCtx, extras, trend } = useDeskCtx(city, state, owner, styleChanged);
  const total = Number(state.total) / 1e6;
  const [copied, setCopied] = useState(false);
  const score = useCityScore(city.preview ? undefined : city.vault);
  const history = useCityHistory(city.preview ? undefined : city.vault, 7);
  if (!maybeCtx) return <div className="flex items-center gap-2 text-sm text-ink-soft"><Spinner /> {t.reading}</div>;
  const ctx = maybeCtx;

  const stage = stageOf(total);
  const steps = stepsFor(ctx);
  const doneCount = steps.filter((s) => s.done).length;
  const open = steps.filter((s) => s.done !== true);
  const advice = adviceFor(ctx);
  const current = nearestPreset(ctx.workingPct);
  const income = monthlyIncome(ctx.working, ctx.apyBps, ctx.feeBps);
  const nextStage = stage.index < 4 ? t.stage[(["land", "hamlet", "town", "city", "metro"] as const)[stage.index + 1]].name : "";

  const copyLink = () => {
    if (!city.vault) return;
    navigator.clipboard?.writeText(`${location.origin}/city?c=${city.vault}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  const toPresets = () => document.getElementById("desk-presets")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const stepAction: Record<StepId, () => void> = { fund: openDeposit, invite: copyLink, work: toPresets, spread: toPresets, analyst: () => go("staff"), book: () => go("book"), design: () => go("design"), deputy: () => go("funds") };
  const adviceAction: Record<string, () => void> = { empty: openDeposit, idleHigh: toPresets, lockedHigh: toPresets, concentrated: toPresets, bestRate: () => go("funds"), singleService: openFound, trendDown: () => go("staff"), noResidents: copyLink, hireAnalyst: () => go("staff"), feeHigh: () => go("funds"), feeZero: () => go("funds"), trendUp: () => go("book") };

  const trendText = trend === null ? t.trendNone
    : Math.abs(trend.pct) < 1 ? t.trendFlat(trend.hours.toFixed(1))
    : trend.pct > 0 ? t.trendUp(trend.pct.toFixed(1), trend.hours.toFixed(1)) : t.trendDown(Math.abs(trend.pct).toFixed(1), trend.hours.toFixed(1));
  const dot = (tone: "good" | "warn" | "none") => <span className={cx("mt-1 h-2 w-2 shrink-0 rounded-full", tone === "good" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : "bg-slate-300")} aria-hidden />;
  const workingTone = total <= 0 ? "none" : ctx.workingPct >= 20 && ctx.workingPct <= 85 ? "good" : "warn";
  const tiles: { key: string; label: string; value: string; note: string; tone: "good" | "warn" | "none" }[] = [
    { key: "working", label: t.health.working[0], value: total > 0 ? `${ctx.workingPct.toFixed(0)}%` : "—", note: t.health.working[1], tone: workingTone },
    { key: "reserve", label: t.health.reserve[0], value: `${fmtAusd(ctx.idle)} AUSD`, note: t.health.reserve[1], tone: "none" },
    { key: "apy", label: t.health.apy[0], value: ctx.apyBps === null ? "—" : t.perYear((ctx.apyBps / 100).toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 2 })), note: `${t.health.apy[1]} (${t.simulated})`, tone: "none" },
    { key: "income", label: t.health.income[0], value: income === null ? "—" : t.perMonth(fmtAusd(income)), note: t.health.income[1], tone: "none" },
    { key: "residents", label: t.health.residents[0], value: ctx.residents === null ? "…" : ctx.residents > 0 ? String(ctx.residents) : t.none, note: t.health.residents[1], tone: ctx.residents !== null && ctx.residents <= 1 && total > 0 ? "warn" : "none" },
    { key: "rank", label: t.health.rank[0], value: ctx.rank ? t.rankOf(ctx.rank) : extras.board ? t.rankNo(fmtAusd(extras.minRankedAusd)) : "…", note: t.health.rank[1], tone: "none" },
    { key: "momentum", label: t.health.momentum[0], value: trendText, note: t.health.momentum[1], tone: trend && trend.pct <= -5 ? "warn" : trend && trend.pct >= 5 ? "good" : "none" },
  ];

  const bestId = ctx.services.filter((s) => s.apyBps !== null).sort((a, b) => (b.apyBps ?? 0) - (a.apyBps ?? 0))[0]?.id;
  const yearly = ctx.yearlyYield;
  const flowLines = t.flow({ total: fmtAusd(ctx.total), working: fmtAusd(ctx.working), n: ctx.services.filter((s) => s.assets > 0).length, yearly: yearly === null ? "—" : fmtAusd(yearly), mayor: yearly === null ? "—" : fmtAusd(yearly * (ctx.feeBps / 10_000) * 0.9) });
  const district = state.slots.find((s) => s.id !== "idle");
  const limitText = fmtBps(limitBps);

  // Ukuran kota dari relayer: skor 0..100 dari variasi layanan, layanan aktif, dan ekonomi kota sendiri.
  const scoreIdx = score ? Math.max(0, SCORE_STAGES.findIndex((x) => x.id === score.stage)) : -1;
  const scoreNext = scoreIdx >= 0 && scoreIdx < SCORE_STAGES.length - 1 ? SCORE_STAGES[scoreIdx + 1] : null;
  const kindLabel = (k: string) => (k === "launchpad" || k === "staff" ? t.score.kindName[k] : k in CATALOG_COPY[lang].category ? CATALOG_COPY[lang].category[k as keyof typeof CATALOG_COPY["en"]["category"]].name : k);
  const levelBars = score ? ([["wealth", score.levels.wealth], ["income", score.levels.income], ["traffic", score.levels.traffic]] as const) : [];
  const totals = history?.totals;

  return (
    <div className="space-y-4">
      {score ? (
        <section className="space-y-2 rounded-2xl bg-accent-soft/70 p-3" aria-label={t.score.hdr}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{t.score.hdr}</div>
              <div className="text-lg font-semibold tracking-tight text-ink">{t.stage[SCORE_STAGES[scoreIdx].copy].name}</div>
            </div>
            <Badge tone="accent">{t.score.points(score.score)}</Badge>
          </div>
          <p className="text-xs leading-relaxed text-ink-soft">{t.stage[SCORE_STAGES[scoreIdx].copy].blurb}</p>
          <div className="h-2 overflow-hidden rounded-full bg-white/80" role="progressbar" aria-valuenow={score.score} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${score.score}%` }} />
          </div>
          <p className="text-[11px] text-ink-soft">{scoreNext ? t.score.next(Math.max(1, scoreNext.min - score.score), t.stage[scoreNext.copy].name) : t.score.top}</p>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <Badge>{t.score.kinds(score.variety.kinds.length, score.variety.of)}</Badge>
            <Badge>{score.activeServices > 0 ? t.score.active(score.activeServices) : t.score.noKinds}</Badge>
            {score.variety.kinds.map((k) => <span key={k} className="rounded-full bg-white/80 px-2 py-0.5 font-medium text-ink">{kindLabel(k)}</span>)}
          </div>
          <div className="space-y-1">
            {levelBars.map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-[11px] text-ink-soft">
                <span className="w-32 shrink-0">{t.score.levels[k]}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/80"><div className="h-full rounded-full bg-accent/80" style={{ width: `${Math.round(v * 100)}%` }} /></div>
              </div>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-ink-soft">{t.score.why}</p>
          <p className="text-[10px] leading-snug text-ink-soft/80">{t.score.levelsNote}</p>
        </section>
      ) : (
        <section className="space-y-2 rounded-2xl bg-accent-soft/70 p-3" aria-label={t.stageHdr}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{t.stageHdr}</div>
              <div className="text-lg font-semibold tracking-tight text-ink">{t.stage[stage.id].name}</div>
            </div>
            <Badge tone="accent">{stage.index + 1}/5</Badge>
          </div>
          <p className="text-xs leading-relaxed text-ink-soft">{t.stage[stage.id].blurb}</p>
          <div className="h-2 overflow-hidden rounded-full bg-white/80" role="progressbar" aria-valuenow={Math.round(stage.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(stage.progress * 100)}%` }} />
          </div>
          <p className="text-[11px] text-ink-soft">{stage.nextAt === null ? t.stageTop : t.stageProgress(Math.round(stage.progress * 100), nextStage, fmtWhole(stage.nextAt))}</p>
          {stage.nextWork && <p className="text-[11px] text-ink-soft">{t.nextWork(stage.nextWork.label, fmtWhole(stage.nextWork.at))}</p>}
          {!city.preview && <p className="text-[10px] leading-snug text-ink-soft/80">{t.score.offline}</p>}
        </section>
      )}

      <section className="space-y-2" aria-label={t.econ.hdr}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.econ.hdr}</h3>
        <p className="text-[11px] leading-relaxed text-ink-soft">{t.econ.intro}</p>
        <div className="grid gap-2">
          <div className="rounded-xl border border-slate-900/5 bg-white/70 p-2.5">
            <div className="text-[11px] font-medium text-ink-soft">{t.econ.traffic.title}</div>
            <div className="text-sm font-semibold text-ink">{totals ? t.econ.traffic.value(fmtAusd(ausd(totals.outsideTraffic))) : "…"}</div>
            <p className="text-[11px] leading-snug text-ink-soft">{totals ? t.econ.traffic.sub(totals.trafficCount, totals.uniqueUsers) : t.econ.waiting}</p>
          </div>
          <div className="rounded-xl border border-slate-900/5 bg-white/70 p-2.5">
            <div className="text-[11px] font-medium text-ink-soft">{t.econ.income.title}</div>
            <div className="text-sm font-semibold text-ink">{score ? t.econ.income.value(fmtAusd(ausd(score.inputs.income7d))) : "…"}</div>
            <p className="text-[11px] leading-snug text-ink-soft">{score ? t.econ.income.sub(fmtAusd(ausd(score.inputs.yield7d)), fmtAusd(ausd(score.inputs.serviceFees7d))) : t.econ.waiting}</p>
          </div>
          <div className="rounded-xl border border-slate-900/5 bg-white/70 p-2.5">
            <div className="text-[11px] font-medium text-ink-soft">{t.econ.coins.title}</div>
            <div className="text-sm font-semibold text-ink">{t.econ.coins.value(fmtAusd(ctx.working), fmtAusd(ctx.idle))}</div>
            <p className="text-[11px] leading-snug text-ink-soft">{totals ? t.econ.coins.sub(`${ausd(totals.netFlow) >= 0 ? "+" : "−"}${fmtAusd(Math.abs(ausd(totals.netFlow)))}`, fmtAusd(ausd(totals.rebalanceVolume)), totals.rebalanceCount) : t.econ.waiting}</p>
          </div>
        </div>
      </section>

      <section className="space-y-2" aria-label={t.servicesHdr}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.servicesHdr}</h3>
        <p className="text-[11px] leading-relaxed text-ink-soft">{t.servicesIntro}</p>
        <ul className="space-y-1.5">
          {ctx.services.map((s) => {
            const color = DISTRICT_COLORS[CATEGORY_KIND[s.category]];
            const best = bestId === s.id && ctx.services.length >= 2;
            return (
              <li key={s.id} className="rounded-xl border border-slate-900/5 bg-white/70 p-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-ink">{s.name}</span>
                      <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: color }}>{CATALOG_COPY[lang].category[s.category].name}</span>
                      {best && <Badge tone="good">{t.svcBest}</Badge>}
                    </div>
                    <div className="mt-0.5 text-ink-soft">{s.assets > 0 ? `${fmtAusd(s.assets)} AUSD · ${t.svcShare(`${Math.round(s.share * 100)}%`)}` : t.svcNone}</div>
                  </div>
                  <div className="shrink-0 text-right font-semibold text-ink">{s.apyBps === null ? "—" : `${(s.apyBps / 100).toFixed(2)}%`}</div>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-900/10"><div className="h-full rounded-full" style={{ width: `${Math.round(s.share * 100)}%`, background: color }} /></div>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => go("funds")}>{t.moveBtn}</button>
      </section>

      <section className="space-y-2" aria-label={t.stepsHdr}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.stepsHdr}</h3>
          <span className="text-[11px] font-medium text-ink-soft">{t.stepsDone(doneCount, steps.length)}</span>
        </div>
        {open.length === 0 ? <Notice tone="good">{t.allDone}</Notice> : (
          <ul className="space-y-2">
            {open.slice(0, 3).map((s) => (
              <li key={s.id} className="rounded-xl border border-slate-900/5 bg-white/70 p-2.5">
                <div className="text-sm font-semibold text-ink">{t.steps[s.id].title}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{t.steps[s.id].why}</p>
                <button type="button" className="btn btn-primary mt-2 !px-3 !py-1.5 text-xs" onClick={stepAction[s.id]}>
                  {s.id === "invite" && copied ? "✓" : t.steps[s.id].cta}
                </button>
              </li>
            ))}
          </ul>
        )}
        {open.length > 3 && (
          <details className="text-xs text-ink-soft">
            <summary className="cursor-pointer font-medium text-accent">+{open.length - 3}</summary>
            <ul className="mt-1.5 space-y-1.5">
              {open.slice(3).map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-2 rounded-lg bg-slate-900/[0.04] px-2.5 py-2">
                  <span><b className="text-ink">{t.steps[s.id].title}</b><br />{t.steps[s.id].why}</span>
                  <button type="button" className="btn btn-ghost !px-2 !py-1 text-[11px]" onClick={stepAction[s.id]}>{t.steps[s.id].cta}</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="space-y-2 border-t border-slate-900/5 pt-3" aria-label={t.healthHdr}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.healthHdr}</h3>
        <div className="grid grid-cols-2 gap-2">
          {tiles.map((x) => (
            <div key={x.key} className={cx("rounded-xl border border-slate-900/5 bg-white/70 p-2.5", x.key === "momentum" || x.key === "rank" ? "col-span-2" : "")}>
              <div className="flex items-start gap-1.5">{dot(x.tone)}<div className="min-w-0">
                <div className="text-[11px] font-medium text-ink-soft">{x.label}</div>
                <div className="text-sm font-semibold leading-snug text-ink">{x.value}</div>
              </div></div>
              <p className="mt-1 text-[11px] leading-snug text-ink-soft">{x.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2 border-t border-slate-900/5 pt-3" aria-label={t.flowHdr}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.flowHdr}</h3>
        <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-ink-soft">
          {flowLines.map((l) => <li key={l}>{l}</li>)}
        </ol>
      </section>

      <section id="desk-presets" className="space-y-2 border-t border-slate-900/5 pt-3" aria-label={t.presetsHdr}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.presetsHdr}</h3>
        <p className="text-xs leading-relaxed text-ink-soft">{t.presetsIntro}</p>
        <ul className="space-y-2">
          {PRESETS.map((p) => {
            const info = t.presets[p.id];
            const on = current === p.id;
            const blocked = total <= 0 ? t.presetNoFunds : !district ? t.presetNoDistrict : null;
            return (
              <li key={p.id} className={cx("rounded-xl border p-2.5", on ? "border-accent bg-accent-soft/50" : "border-slate-900/5 bg-white/70")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-ink">{info.name} {on && <Badge tone="accent">{t.current}</Badge>}</div>
                    <div className="text-xs font-medium text-ink">{info.line}</div>
                    <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">{info.risk}</p>
                  </div>
                  <button type="button" className="btn btn-ghost shrink-0 !px-3 !py-1.5 text-xs" disabled={presetBusy || !!blocked || on} onClick={() => applyPreset(p.id, p.pct)} title={blocked ?? undefined}>
                    {presetBusy ? <Spinner /> : on ? t.matches : t.apply}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] text-ink-soft">{t.presetStep(limitText)}</p>
        {presetSteps && <StepList steps={presetSteps} />}
        {presetNote && <Notice tone={presetNote.tone}>{presetNote.text}</Notice>}
      </section>

      <section className="space-y-2 border-t border-slate-900/5 pt-3" aria-label={t.adviceHdr}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.adviceHdr}</h3>
        <ul className="space-y-2">
          {advice.map((id) => {
            const a = t.advice[id];
            const act = adviceAction[id];
            return (
              <li key={id} className="rounded-xl border border-slate-900/5 bg-white/70 p-2.5">
                <div className="text-sm font-semibold text-ink">{a.title}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{a.body}</p>
                {a.cta && act && <button type="button" className="btn btn-ghost mt-2 !px-2.5 !py-1 text-[11px]" onClick={act}>{id === "noResidents" && copied ? "✓" : a.cta}</button>}
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] text-ink-soft">{t.adviceNote}</p>
      </section>

      <section className="space-y-1.5 border-t border-slate-900/5 pt-3">
        <details>
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.principlesHdr}</summary>
          <ol className="mt-2 list-decimal space-y-2 pl-4 text-xs leading-relaxed text-ink-soft">
            {t.principles.map(([h, b]) => <li key={h}><b className="text-ink">{h}.</b> {b}</li>)}
          </ol>
        </details>
        <details>
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.glossaryHdr}</summary>
          <dl className="mt-2 space-y-1.5 text-xs leading-relaxed text-ink-soft">
            {t.glossary.map(([k, v]) => <div key={k}><dt className="inline font-semibold text-ink">{k}: </dt><dd className="inline">{v}</dd></div>)}
          </dl>
        </details>
      </section>
    </div>
  );
}
