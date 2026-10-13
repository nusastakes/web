"use client";

import { useState, useSyncExternalStore } from "react";
import { APP } from "@/lib/copy-app";
import { useLang } from "@/lib/lang";
import { Card } from "./ui";

/** Perkenalan untuk pengunjung pertama: lima kartu singkat, lalu pilihan menonton demo atau mencoba sendiri. */

const KEY = "nusastakes.intro.v1";
const subscribe = () => () => undefined;
const seen = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return true; } };

export default function IntroTour({ onDemo, onExplore }: { onDemo: () => void; onExplore: () => void }) {
  const wasSeen = useSyncExternalStore(subscribe, seen, () => true);
  const [lang] = useLang();
  const c = APP[lang].intro;
  const STEPS = c.steps;
  const [closed, setClosed] = useState(false);
  const [i, setI] = useState(0);
  if (wasSeen || closed) return null;
  const close = () => { try { localStorage.setItem(KEY, "1"); } catch { /* abaikan */ } setClosed(true); };
  const last = i === STEPS.length - 1;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/20 p-3 sm:items-center">
      <Card solid className="w-full max-w-[460px] px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-accent">{c.kicker} · {i + 1}/{STEPS.length}</div>
        <h2 className="mt-1 text-lg font-semibold text-ink">{STEPS[i][0]}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{STEPS[i][1]}</p>
        <div className="mt-3 flex gap-1">{STEPS.map((_, k) => <span key={k} className={`h-1 flex-1 rounded-full ${k <= i ? "bg-accent" : "bg-slate-900/10"}`} />)}</div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!last ? (
            <>
              <button className="btn btn-primary" onClick={() => setI(i + 1)}>{c.next}</button>
              <button className="btn btn-ghost" onClick={close}>{c.skip}</button>
            </>
          ) : (
            <>
              <button className="btn btn-primary" onClick={() => { close(); onDemo(); }}>{c.demo}</button>
              <button className="btn btn-ghost" onClick={() => { close(); onExplore(); }}>{c.explore}</button>
              <button className="btn btn-ghost" onClick={close}>{c.look}</button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
