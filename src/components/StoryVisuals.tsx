"use client";

import { useEffect, useState } from "react";
import { fmtAusd } from "@/lib/format";
import type { Copy } from "@/lib/copy";
import { IconCheck, IconKey, IconLock } from "./icons";

/** Gambar kecil di kartu kisah halaman depan. Semuanya CSS dan SVG; teksnya dari `copy.ts` supaya dua bahasa. */

type V = Copy["visuals"];

export function LegendVisual({ legend }: { legend: Copy["legend"] }) {
  return (
    <div className="mt-4 rounded-2xl bg-slate-900/[0.04] p-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{legend.title}</div>
      <ul className="mt-2 space-y-1.5">
        {legend.items.map(([color, name, what]) => (
          <li key={name} className="flex items-start gap-2 text-[12px] leading-snug">
            <span className="mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-white" style={{ background: color }} />
            <span><b className="font-semibold text-ink">{name}</b> <span className="text-ink-soft">· {what}</span></span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10.5px] text-ink-soft">{legend.note}</p>
    </div>
  );
}

export function DepositVisual({ v, funds, level }: { v: V; funds: number; level: number }) {
  return (
    <div className="mt-4 rounded-2xl bg-slate-900/[0.04] p-3.5">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] font-medium text-ink-soft">{v.money}</div>
          <div className="text-2xl font-semibold tabular-nums">{fmtAusd(funds)} <span className="text-xs font-medium text-ink-soft">AUSD</span></div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-medium text-ink-soft">{v.level}</div>
          <div className="text-sm font-semibold text-accent">{v.levels[Math.min(v.levels.length - 1, level)]}</div>
        </div>
      </div>
      <div className="mt-3 flex gap-1">{v.levels.map((l, i) => <span key={l} className={`h-1.5 flex-1 rounded-full transition-colors duration-700 ${i <= level ? "bg-accent" : "bg-slate-900/10"}`} />)}</div>
      <p className="mt-2 text-[11px] text-ink-soft">{v.depositHint}</p>
    </div>
  );
}

export function MayorVisual({ v }: { v: V }) {
  const rows = [[v.plazaNote, 16, "#9aa6cf"], [v.lendNote, 58, "#3f6bff"], [v.vaultNote, 26, "#7a5cff"]] as const;
  return (
    <div className="mt-4 space-y-2 rounded-2xl bg-slate-900/[0.04] p-3.5">
      {rows.map(([name, pct, color]) => (
        <div key={name}>
          <div className="flex justify-between text-[11px]"><span className="font-medium text-ink">{name}</span><span className="text-ink-soft">{pct}%</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-900/10"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5 pt-1 text-[10.5px] font-semibold">
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">{v.atMost}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700"><IconLock width={10} height={10} /> {v.neverWallet}</span>
      </div>
    </div>
  );
}

export function ProfitVisual({ v }: { v: V }) {
  const pts: [number, number][] = [[0, 70], [18, 58], [36, 40], [52, 52], [66, 60], [80, 36], [100, 22]];
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x * 2.4 + 8},${y + 8}`).join(" ");
  return (
    <div className="mt-4 rounded-2xl bg-slate-900/[0.04] p-3.5">
      <svg viewBox="0 0 250 100" className="w-full" role="img" aria-label={v.best}>
        <line x1="8" y1="48" x2="242" y2="48" stroke="#94a3d8" strokeDasharray="4 4" />
        <text x="10" y="44" fontSize="8" fill="#5b6486">{v.best}</text>
        <path d={d} fill="none" stroke="#3f6bff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={`M${80 * 2.4 + 8},44 L${80 * 2.4 + 8},${36 + 8} L${100 * 2.4 + 8},${22 + 8}`} fill="none" stroke="#f5b301" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
        <text x="104" y="14" fontSize="8" fill="#b57f00">{v.cutHere}</text>
      </svg>
      <div className="mt-2 flex gap-2 text-[11px]">
        <div className="flex-1 rounded-xl bg-white p-2"><div className="font-semibold text-ink">{v.profit}</div><div className="text-ink-soft">{v.keep}</div></div>
        <div className="flex-1 rounded-xl bg-white p-2"><div className="font-semibold text-ink">{v.cut}</div><div className="text-ink-soft">{v.onlyProfit}</div></div>
        <div className="flex-1 rounded-xl bg-white p-2"><div className="font-semibold text-ink">{v.loss}</div><div className="text-ink-soft">{v.noCut}</div></div>
      </div>
    </div>
  );
}

export function KeysVisual({ v }: { v: V }) {
  const colors = ["#3f6bff", "#7a5cff", "#10b3a3"];
  return (
    <div className="mt-4 rounded-2xl bg-slate-900/[0.04] p-3.5">
      <div className="flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-md"><IconKey width={14} height={14} /> {v.onePasskey}</span>
      </div>
      <div className="mx-auto h-4 w-px bg-slate-900/20" />
      <div className="grid grid-cols-3 gap-2 border-t border-slate-900/20">
        {v.keys.map(([name, what], i) => (
          <div key={name} className="relative pt-3 text-center">
            <span className="absolute left-1/2 top-0 h-3 w-px bg-slate-900/20" />
            <span className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl text-white" style={{ background: colors[i] }}><IconKey width={15} height={15} /></span>
            <div className="text-[11px] font-semibold text-ink">{name}</div>
            <div className="text-[10px] leading-tight text-ink-soft">{what}</div>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-center text-[10.5px] text-ink-soft">{v.noStore}</p>
    </div>
  );
}

export function BookVisual({ v, active }: { v: V; active: boolean }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setRevealed((r) => !r), 3200);
    return () => window.clearInterval(id);
  }, [active]);
  return (
    <div className="mt-4 rounded-2xl bg-slate-900/[0.04] p-3.5">
      <div className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wide text-ink-soft">
        <span className={revealed ? "" : "text-accent"}>{v.before}</span>
        <span className={revealed ? "text-accent" : ""}>{v.end}</span>
      </div>
      <div className="mt-2 rounded-xl bg-white p-3 text-xs">
        {revealed ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-good"><IconCheck width={13} height={13} strokeWidth={3} /> {v.matches}</div>
            <div className="text-ink">{v.quote}</div>
            <div className="text-[10px] text-ink-soft">{v.written}</div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-ink"><IconLock width={13} height={13} /> {v.sealed}</div>
            <div className="break-all font-mono text-[10px] leading-tight text-ink-soft blur-[1.5px]">0x9cc18c61 e4f0 7a21 b9d3 55a0 3c1e 88b2 6d70 f4a9 12c8</div>
            <div className="text-[10.5px] text-ink-soft">{v.sealedNote}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function StaffVisual({ v }: { v: V }) {
  const colors = ["#ef4444", "#7a5cff", "#10b981"];
  return (
    <div className="mt-4 space-y-2 rounded-2xl bg-slate-900/[0.04] p-3">
      {v.staff.map(([name, kind, can, cannot], i) => (
        <div key={name} className="rounded-xl bg-white p-2.5 text-[11px]">
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i] }} /><b className="text-ink">{name}</b><span className="text-ink-soft">{kind}</span></div>
          <div className="mt-1 text-good">✓ {can}</div>
          <div className="text-bad">✕ {cannot}</div>
        </div>
      ))}
    </div>
  );
}
