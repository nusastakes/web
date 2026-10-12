"use client";

import type { CityTick, SceneApi } from "./CityCanvas";
import type { Inspect } from "@/lib/scene/life";
import { Card, cx } from "./ui";

const SPEEDS = [{ label: "1×", sph: 16 }, { label: "4×", sph: 4 }, { label: "16×", sph: 1 }];
const TONE: Record<string, string> = { blue: "#3f6bff", green: "#10b981", amber: "#f59e0b", red: "#ef4444", violet: "#7a5cff", gold: "#f5b301" };

/** Jam kota, kecepatan waktu, dan ringkasan kegiatan (simulasi tampilan, bukan data onchain). */
export function LifeClock({ tick, api, speed, onSpeed }: { tick: CityTick | null; api: SceneApi | null; speed: number; onSpeed: (sph: number) => void }) {
  if (!tick) return null;
  const s = tick.stats;
  return (
    <Card className="pointer-events-auto w-[260px] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-mono text-lg font-semibold leading-none text-ink">{tick.time}</div>
          <div className="mt-0.5 text-[11px] font-medium text-ink-soft">{tick.phase}</div>
        </div>
        <div className="flex gap-1">
          {SPEEDS.map((o) => (
            <button key={o.label} onClick={() => { api?.setClockSpeed(o.sph); onSpeed(o.sph); }}
              className={cx("rounded-lg px-2 py-1 text-[11px] font-semibold", speed === o.sph ? "bg-accent text-white" : "bg-slate-900/5 text-ink")}>{o.label}</button>
          ))}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1 text-[10.5px] leading-tight text-ink-soft">
        <span><b className="text-ink">{s.vehicles}</b> vehicles</span>
        <span><b className="text-ink">{s.people}</b> people</span>
        <span><b className="text-ink">{s.buses}</b> buses</span>
        <span><b className="text-ink">{s.tripsToday}</b> trips</span>
        <span><b className="text-ink">{s.deliveriesToday}</b> deliveries</span>
        <span><b className="text-ink">{s.salesToday}</b> sales</span>
      </div>
      <p className="mt-1.5 text-[10px] text-ink-soft/80">Simulated city life. Click a car, bus, or person to see what they are doing.</p>
    </Card>
  );
}

export function InspectCard({ info, onClose }: { info: Inspect | null; onClose: () => void }) {
  if (!info) return null;
  return (
    <Card className="pointer-events-auto flex max-w-[320px] items-start gap-2.5 px-3 py-2.5">
      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TONE[info.tone] ?? TONE.blue }} />
      <div className="min-w-0 text-xs">
        <div className="font-semibold text-ink">{info.title}</div>
        <div className="text-ink-soft">{info.detail}</div>
      </div>
      <button onClick={onClose} aria-label="Close" className="ml-auto rounded-md px-1 text-ink-soft hover:bg-slate-900/5">×</button>
    </Card>
  );
}
