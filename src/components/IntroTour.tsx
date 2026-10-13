"use client";

import { useState, useSyncExternalStore } from "react";
import { Card } from "./ui";

/** Perkenalan untuk pengunjung pertama: lima kartu singkat, lalu pilihan menonton demo atau mencoba sendiri. */

const KEY = "nusastakes.intro.v1";
const STEPS = [
  { title: "Every city is a savings pool", body: "Residents deposit AUSD into a city. Each city is an ERC-4626 vault on Monad, and the 3D city grows with the money in it." },
  { title: "The mayor runs the city", body: "The mayor places the funds in districts that earn yield. The mayor earns a fee only from residents' profit, and the contract never lets them send funds to their own wallet." },
  { title: "One passkey, no seed phrase", body: "Your account comes from a passkey (Mera). The same passkey also locks the mayor's sealed strategy book: plans written before the results, revealed at the end of the season." },
  { title: "AI staff with hard limits", body: "Mayors hire AI staff: Satpam (a Chainlink CRE workflow) can only pull funds back to safety, the Analyst only proposes, Humas writes the weekly report." },
  { title: "Testnet, simulated yield", body: "This is Monad testnet. Yield follows a live mainnet AUSD vault and is labelled simulated. Test money is free." },
];

const subscribe = () => () => undefined;
const seen = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return true; } };

export default function IntroTour({ onDemo, onExplore }: { onDemo: () => void; onExplore: () => void }) {
  const wasSeen = useSyncExternalStore(subscribe, seen, () => true);
  const [closed, setClosed] = useState(false);
  const [i, setI] = useState(0);
  if (wasSeen || closed) return null;
  const close = () => { try { localStorage.setItem(KEY, "1"); } catch { /* abaikan */ } setClosed(true); };
  const last = i === STEPS.length - 1;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/20 p-3 sm:items-center">
      <Card solid className="w-full max-w-[460px] px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-accent">Welcome to Nusastakes · {i + 1}/{STEPS.length}</div>
        <h2 className="mt-1 text-lg font-semibold text-ink">{STEPS[i].title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{STEPS[i].body}</p>
        <div className="mt-3 flex gap-1">{STEPS.map((_, k) => <span key={k} className={`h-1 flex-1 rounded-full ${k <= i ? "bg-accent" : "bg-slate-900/10"}`} />)}</div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!last ? (
            <>
              <button className="btn btn-primary" onClick={() => setI(i + 1)}>Next</button>
              <button className="btn btn-ghost" onClick={close}>Skip</button>
            </>
          ) : (
            <>
              <button className="btn btn-primary" onClick={() => { close(); onDemo(); }}>Watch the 80-second demo</button>
              <button className="btn btn-ghost" onClick={() => { close(); onExplore(); }}>Explore cities</button>
              <button className="btn btn-ghost" onClick={close}>Look around</button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
