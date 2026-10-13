"use client";

import { useState } from "react";

import type { CityTick, SceneApi } from "./CityCanvas";
import type { Inspect } from "@/lib/scene/life";
import type { InteriorInfo } from "@/lib/scene/interior";
import { Card, cx } from "./ui";

const SPEEDS = [{ label: "1×", sph: 16 }, { label: "4×", sph: 4 }, { label: "16×", sph: 1 }];
const TONE: Record<string, string> = { blue: "#3f6bff", green: "#10b981", amber: "#f59e0b", red: "#ef4444", violet: "#7a5cff", gold: "#f5b301" };

/** Jam kota, kecepatan waktu, dan ringkasan kegiatan (simulasi tampilan, bukan data onchain). */
export function LifeClock({ tick, api, speed, onSpeed, onDemo }: { tick: CityTick | null; api: SceneApi | null; speed: number; onSpeed: (sph: number) => void; onDemo?: () => void }) {
  const [weather, setWeather] = useState<"auto" | "clear" | "rain">("auto");
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
      <div className="mt-1.5 flex gap-1">
        {(["auto", "clear", "rain"] as const).map((m) => (
          <button key={m} onClick={() => { api?.setWeather(m); setWeather(m); }}
            className={cx("rounded-lg px-2 py-0.5 text-[10.5px] font-semibold capitalize", weather === m ? "bg-slate-900/80 text-white" : "bg-slate-900/5 text-ink")}>{m === "auto" ? "Weather: auto" : m}</button>
        ))}
      </div>
      {onDemo && <button onClick={onDemo} className="mt-1.5 w-full rounded-lg bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent">▶ Watch the demo (80 s)</button>}
      <p className="mt-1.5 text-[10px] text-ink-soft/80">Simulated city life. Click a building to look inside, or a car, bus, or person to see what they are doing.</p>
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

/** Isi gedung yang sedang dibelah: lantai yang ramai dan agenda kota yang terkait. */
export function BuildingCard({ info, onClose, onFloor }: { info: InteriorInfo | null; onClose: () => void; onFloor?: (level: number) => void }) {
  if (!info) return null;
  return (
    <Card className="pointer-events-auto w-[320px] max-w-[calc(100vw-1.5rem)] px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{info.title}</div>
          <div className="text-[11px] text-ink-soft">{info.subtitle} · {info.occupants} people inside</div>
        </div>
        <button onClick={onClose} aria-label="Close building" className="rounded-md px-1.5 text-ink-soft hover:bg-slate-900/5">×</button>
      </div>
      <ul className="mt-2 space-y-1.5">
        {info.floors.map((f) => (
          <li key={f.level} className="text-xs leading-snug">
            <button onClick={() => onFloor?.(f.level)} className="w-full rounded-md px-1 py-0.5 text-left hover:bg-slate-900/5">
              <span className="font-semibold text-ink">Fl {f.level} · {f.label}</span>
              <span className="block text-ink-soft">{f.doing}</span>
            </button>
          </li>
        ))}
      </ul>
      {info.agenda.length > 0 && (
        <div className="mt-2 border-t border-slate-900/5 pt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">City agenda</div>
          {info.agenda.map((a, i) => <div key={i} className="text-[11px] text-ink">{a}</div>)}
        </div>
      )}
    </Card>
  );
}
