"use client";

import { useEffect, useRef, useState } from "react";
import type { SceneApi } from "./CityCanvas";
import { Card } from "./ui";

/**
 * Mode demo terskrip (untuk video dan juri): satu putaran sekitar 70 detik di kota contoh yang memperlihatkan setor,
 * tata ulang dengan rencana tersegel, usulan Analis, isi balai kota, evakuasi Satpam, acara, dan malam hari.
 * Semua kejadian di sini adalah contoh tampilan, bukan transaksi.
 */

interface Beat { at: number; caption: string; run: (s: SceneApi) => void }

const BEATS: Beat[] = [
  { at: 0, caption: "A city on Monad. Residents deposit AUSD with a passkey: no seed phrase, no gas.", run: (s) => { s.closeBuilding(); s.setWeather("clear"); s.setHour(7.6); s.setClockSpeed(16); s.resetCamera(); s.emit({ type: "deposit", amount: 500 }); } },
  { at: 7, caption: "Deposits arrive at the plaza as trucks of crates. The city grows with its funds.", run: (s) => { s.focusDistrict("idle"); s.emit({ type: "deposit", amount: 1200 }); } },
  { at: 14, caption: "The mayor writes the plan first, sealed with a key only their passkey can recreate, then moves funds to the lending district.", run: (s) => { s.emit({ type: "agenda", kind: "seal", text: "Mayor writes a sealed plan in the strategy book" }); s.emit({ type: "transfer", from: "idle", to: "lend", amount: 1200 }); s.focusDistrict("lend"); } },
  { at: 23, caption: "The AI Analyst proposes a move with its reason. Nothing moves until the mayor approves with one tap.", run: (s) => { s.emit({ type: "propose", id: "demo", from: "lend", to: "vault", amount: 800 }); s.focusDistrict("vault"); } },
  { at: 30, caption: "Approved: the contract moves the funds, within its limits.", run: (s) => { s.emit({ type: "approve", id: "demo" }); } },
  { at: 36, caption: "Inside the town hall: the mayor at work, the council discussing the move, the AI staff at their desks.", run: (s) => { s.openTownHall(); } },
  { at: 47, caption: "Satpam, a Chainlink CRE workflow, sees risk and pulls the funds back to the plaza. It can never send them anywhere else.", run: (s) => { s.closeBuilding(); s.emit({ type: "alert", at: "lend", amount: 900, label: "Satpam: evacuating Lending district" }); s.focusDistrict("lend"); } },
  { at: 56, caption: "The mayor earns only from residents' profit, and hosts an event to bring more people in.", run: (s) => { s.emit({ type: "harvest", amount: 12.4 }); s.emit({ type: "festival", at: "vault", label: "Mayor's event" }); s.focusDistrict("vault"); } },
  { at: 64, caption: "Night falls. The city keeps living: night market, lit windows, fireworks.", run: (s) => { s.setHour(19.4); s.emit({ type: "fireworks" }); s.resetCamera(); } },
  { at: 72, caption: "That is Nusastakes. Sign in with a passkey to deposit, or found your own city.", run: () => undefined },
];
const LENGTH = 80;

export default function DemoDirector({ api, running, onStop, onBefore }: { api: SceneApi | null; running: boolean; onStop: () => void; onBefore: () => void }) {
  const [t, setT] = useState(0);
  const done = useRef(new Set<number>());
  const start = useRef(0);

  useEffect(() => {
    if (!running || !api) return;
    onBefore();
    done.current.clear();
    start.current = performance.now();
    const id = window.setInterval(() => {
      const sec = (performance.now() - start.current) / 1000;
      setT(sec);
      BEATS.forEach((b, i) => { if (sec >= b.at && !done.current.has(i)) { done.current.add(i); b.run(api); } });
      if (sec >= LENGTH) { window.clearInterval(id); onStop(); }
    }, 250);
    return () => window.clearInterval(id);
  }, [running, api, onStop, onBefore]);

  if (!running) return null;
  const beat = [...BEATS].reverse().find((b) => t >= b.at) ?? BEATS[0];
  const idx = BEATS.indexOf(beat);
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-24 z-30 flex justify-center sm:bottom-28">
      <Card solid className="pointer-events-auto w-full max-w-[640px] px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">{idx + 1}/{BEATS.length}</span>
          <p className="min-w-0 flex-1 text-sm leading-snug text-ink">{beat.caption}</p>
          <button onClick={onStop} className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-ink-soft hover:bg-slate-900/5">Stop</button>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-900/5"><div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${Math.min(100, (t / LENGTH) * 100)}%` }} /></div>
        <p className="mt-1 text-[10px] text-ink-soft">Demo with sample events, not transactions.</p>
      </Card>
    </div>
  );
}
