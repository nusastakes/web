"use client";

import { DESK } from "@/lib/copy-desk";
import { stageOf, stepsFor } from "@/lib/coach";
import { fmtWhole } from "@/lib/format";
import { useDeskCtx } from "@/lib/desk";
import { useMayorState } from "@/lib/hooks";
import { useLang } from "@/lib/lang";
import type { CityView, Hex } from "@/lib/types";
import { Card, cx } from "./ui";

/**
 * Kartu kecil di layar utama untuk walikota: tahap kota dan satu langkah berikutnya, supaya "apa yang harus saya lakukan
 * sekarang" terlihat tanpa membuka balai kota. Tombolnya membuka Meja Walikota (tab Ringkasan di Kelola).
 */
export default function MayorStrip({ city, owner, styleChanged, hideClass, onOpen }: { city: CityView; owner: Hex; styleChanged: boolean; hideClass?: string; onOpen: () => void }) {
  const [lang] = useLang();
  const t = DESK[lang];
  const { state } = useMayorState(city.vault, city.districts);
  const { ctx } = useDeskCtx(city, state, owner, styleChanged);
  if (!ctx) return null;
  const stage = stageOf(ctx.total);
  const steps = stepsFor(ctx);
  const next = steps.find((s) => s.done !== true);
  const pct = Math.round(stage.progress * 100);
  return (
    <div className={cx("pointer-events-none fixed left-3 top-[10.5rem] z-10 w-[min(17.5rem,calc(100vw-1.5rem))] sm:left-4", hideClass)}>
      <Card className="pointer-events-auto space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{t.stageHdr}</div>
            <div className="truncate text-sm font-semibold text-ink">{t.stage[stage.id].name}</div>
          </div>
          <div className="shrink-0 text-right text-[11px] text-ink-soft">{stage.nextAt === null ? t.stageTop : `${pct}% · ${fmtWhole(stage.nextAt)} AUSD`}</div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-900/10"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} /></div>
        <div className="text-xs leading-snug text-ink-soft">
          {next ? <><span className="font-medium text-ink">{t.stripNext}:</span> {t.steps[next.id].title}</> : <span className="font-medium text-ink">{t.stripDone}</span>}
        </div>
        <button type="button" className="btn btn-primary w-full !py-1.5 text-xs" onClick={onOpen}>{t.stripOpen}</button>
      </Card>
    </div>
  );
}
