"use client";

import { useState } from "react";
import { DEFAULT_STYLE, THEMES, THEME_IDS, WORKS, developmentOf, fundsForDevelopment, type CityStyle, type WorkId } from "@/lib/scene/themes";
import { REBALANCE_STEPS, DEPUTY_STEPS, planHashOf, rebalanceFlow, setDeputyFlow, type Slot, type Step } from "@/lib/actions";
import { humanError } from "@/lib/errors";
import { fmtAusd, fmtBps } from "@/lib/format";
import { emitChange, useBalances, useMayorState } from "@/lib/hooks";
import { requestGas } from "@/lib/relayer";
import type { CityView, Hex } from "@/lib/types";
import { useWallet } from "@/lib/wallet";
import { IconKey, IconSwap } from "../icons";
import StepList from "../StepList";
import { Badge, Field, Notice, Sheet, Spinner, inputCls } from "../ui";
import NeedAccount from "./NeedAccount";

interface Props {
  city: CityView;
  onClose: () => void;
  onDone: () => void;
  /** Gaya kota yang sedang berlaku dan cara menyimpannya (tampilan saja). */
  style?: CityStyle;
  styleCode?: string;
  onStyle?: (s: CityStyle) => void;
}

const DEPUTY_TTL = 24 * 3600;
const DEPUTY_SHIFT_BPS = 2500;
/** Di bawah ini kunci perlu isi ulang gas; relayer hanya mengisi bila saldo di bawah 0,25 MON. */
const LOW_GAS = 200_000_000_000_000_000n;
const ausd = (raw: bigint) => fmtAusd(Number(raw) / 1e6);

export default function ManageSheet({ city, onClose, onDone, style = DEFAULT_STYLE, styleCode = "", onStyle }: Props) {
  const w = useWallet();
  const ready = w.status === "ready" && !!w.address;
  const isMayor = ready && !!city.mayor && city.mayor.toLowerCase() === w.address!.toLowerCase();
  const { state, refresh } = useMayorState(isMayor ? city.vault : undefined, city.districts);

  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [permille, setPermille] = useState(500);
  const [note, setNote] = useState("");
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [deputySteps, setDeputySteps] = useState<Step[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gasBusy, setGasBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const deputyActive = !!state?.deputy && !!w.deputy && state.deputy.address.toLowerCase() === w.deputy.toLowerCase();
  const signer = deputyActive ? w.deputy : w.address;
  const { balances, refresh: refreshBalances } = useBalances(isMayor ? signer : undefined);
  const lowGas = !!balances && balances.mon < LOW_GAS;

  const slots: Slot[] = state?.slots ?? [];
  const from = slots.find((s) => s.id === fromId && s.assets > 0n) ?? [...slots].sort((a, b) => (b.assets > a.assets ? 1 : -1))[0];
  const to = slots.find((s) => s.id === toId && s.id !== from?.id) ?? slots.find((s) => s.id !== from?.id);
  const limitBps = state ? (deputyActive ? Math.min(state.maxShiftBps, state.deputy!.maxShiftBps) : state.maxShiftBps) : 0;
  const cap = from && state ? (() => { const m = (state.total * BigInt(limitBps)) / 10_000n; return from.assets < m ? from.assets : m; })() : 0n;
  const amount = (cap * BigInt(permille)) / 1000n;
  const problem = !from || !to ? "This city has nowhere to move funds yet." : from.assets === 0n ? "There is nothing to move yet." : amount <= 0n ? "Pick an amount to move." : null;

  const reportR = (id: string, patch: Partial<Step>) => setSteps((s) => (s ?? REBALANCE_STEPS).map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const reportD = (id: string, patch: Partial<Step>) => setDeputySteps((s) => (s ?? DEPUTY_STEPS).map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const failActive = (set: typeof setSteps) => set((s) => s?.map((x) => (x.state === "active" ? { ...x, state: "error" } : x)) ?? null);

  const move = async () => {
    if (!w.address || !city.vault || !from || !to) return;
    setError(null); setDone(null);
    setSteps(REBALANCE_STEPS.map((s) => ({ ...s })));
    try {
      await rebalanceFlow({
        wallet: w, useDeputy: deputyActive, report: reportR,
        input: { vault: city.vault, owner: w.address, from: from.address, to: to.address, amount, planHash: planHashOf(note) },
      });
      setDone(`Moved ${ausd(amount)} AUSD from ${from.label} to ${to.label}.`);
      setNote("");
      emitChange();
      await Promise.all([refresh(), refreshBalances()]);
      onDone();
    } catch (e) { setError(humanError(e)); failActive(setSteps); }
  };

  const setDeputy = async (enable: boolean) => {
    if (!city.vault || (enable && !w.deputy)) return;
    setError(null);
    setDeputySteps(DEPUTY_STEPS.map((s) => ({ ...s })));
    try {
      await setDeputyFlow({ wallet: w, vault: city.vault, deputy: enable ? (w.deputy as Hex) : null, ttlSeconds: DEPUTY_TTL, shiftBps: DEPUTY_SHIFT_BPS, report: reportD });
      emitChange();
      await refresh();
    } catch (e) { setError(humanError(e)); failActive(setDeputySteps); }
  };

  const getGas = async () => {
    if (!signer) return;
    setGasBusy(true); setError(null);
    try { await requestGas(signer); await refreshBalances(); } catch (e) { setError(humanError(e)); } finally { setGasBusy(false); }
  };

  const busy = (steps?.some((s) => s.state === "active") ?? false) || (deputySteps?.some((s) => s.state === "active") ?? false);
  const expiry = state?.deputy ? new Date(state.deputy.expiry * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <Sheet title={`Manage ${city.name}`} subtitle="Move funds between districts. The contract never lets you send them to your own wallet." onClose={onClose}>
      {city.preview || !city.vault ? <Notice tone="warn">This is a preview city. Found your own city to manage it.</Notice>
        : !ready ? <NeedAccount />
        : !isMayor ? <Notice tone="info">Only the mayor of this city can manage it. Found your own city from the dock.</Notice>
        : !state ? <div className="flex items-center gap-2 text-sm text-ink-soft"><Spinner /> Reading the city…</div>
        : (
          <div className="space-y-4">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Move funds</h3>
                <Badge tone={deputyActive ? "good" : "neutral"}>{deputyActive ? "Deputy key · no prompt" : "Passkey · prompt"}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="From">
                  <select className={inputCls} value={from?.id ?? ""} onChange={(e) => setFromId(e.target.value)} disabled={busy}>
                    {slots.map((s) => <option key={s.id} value={s.id}>{s.label} · {ausd(s.assets)}</option>)}
                  </select>
                </Field>
                <Field label="To">
                  <select className={inputCls} value={to?.id ?? ""} onChange={(e) => setToId(e.target.value)} disabled={busy}>
                    {slots.filter((s) => s.id !== from?.id).map((s) => <option key={s.id} value={s.id}>{s.label} · {ausd(s.assets)}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Amount" hint={<span className="font-semibold text-ink">{ausd(amount)} AUSD</span>}>
                <input type="range" min={0} max={1000} step={10} value={permille} onChange={(e) => setPermille(Number(e.target.value))} disabled={busy || cap === 0n} className="w-full accent-[var(--accent)]" aria-label="Amount to move" />
              </Field>
              <p className="text-[11px] leading-relaxed text-ink-soft">One change can move at most {fmtBps(limitBps)} of the city ({ausd(cap)} AUSD from here).</p>
              <Field label="Your reasoning (optional)">
                <textarea className={`${inputCls} min-h-[60px] resize-none`} value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} placeholder="Why this move? Only its fingerprint goes on-chain." disabled={busy} />
              </Field>
              {lowGas && (
                <Notice tone="info">
                  <div className="flex items-center justify-between gap-3">
                    <span>The {deputyActive ? "deputy key" : "account"} needs a little MON for gas ({(Number(balances!.mon) / 1e18).toFixed(2)} MON now).</span>
                    <button className="btn btn-primary !px-3 !py-1.5 text-xs" onClick={getGas} disabled={gasBusy}>{gasBusy ? <Spinner /> : null} Get gas</button>
                  </div>
                </Notice>
              )}
              {steps && <StepList steps={steps} />}
              {done && <Notice tone="good">{done}</Notice>}
              <button className="btn btn-primary w-full" disabled={busy || !!problem || lowGas} onClick={move}>
                {busy ? <Spinner /> : <IconSwap />} {busy ? "Working…" : problem ?? "Move funds"}
              </button>
            </section>

            <section className="space-y-2 border-t border-slate-900/5 pt-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft"><IconKey width={14} height={14} /> Deputy key</h3>
              {state.deputy ? (
                <p className="text-xs leading-relaxed text-ink-soft">
                  Active until {expiry}, up to {fmtBps(state.deputy.maxShiftBps)} per change. It can only move funds between districts, never withdraw them.
                  {!deputyActive && " This browser session holds a different deputy key, so changes here use your passkey."}
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-ink-soft">Register a second key so day-to-day changes need no prompt. It can only move funds between districts (up to {fmtBps(DEPUTY_SHIFT_BPS)} per change, for 24 hours) and can never withdraw.</p>
              )}
              {deputySteps && <StepList steps={deputySteps} />}
              <div className="flex gap-2">
                <button className="btn btn-ghost flex-1" disabled={busy} onClick={() => setDeputy(true)}>{state.deputy ? "Renew" : "Register deputy key"}</button>
                {state.deputy && <button className="btn btn-ghost" disabled={busy} onClick={() => setDeputy(false)}>Remove</button>}
              </div>
            </section>
            <section className="space-y-2 border-t border-slate-900/5 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">City design</h3>
              <p className="text-xs leading-relaxed text-ink-soft">Make your city beautiful. This is looks only: it never changes residents&apos; money. Bigger cities unlock more civic works.</p>
              <div className="flex flex-wrap gap-1.5">
                {THEME_IDS.map((id) => (
                  <button key={id} onClick={() => onStyle?.({ ...style, theme: id })} aria-pressed={style.theme === id}
                    className={`btn btn-ghost !px-2.5 !py-1.5 text-xs ${style.theme === id ? "ring-2 ring-accent" : ""}`}>
                    <span className="h-3 w-3 rounded-full" style={{ background: THEMES[id].swatch }} /> {THEMES[id].label}
                  </button>
                ))}
              </div>
              <ul className="space-y-1.5">
                {WORKS.map((w) => {
                  const open = developmentOf(city.totalAssets) >= w.unlockAt;
                  const on = style.works.includes(w.id as WorkId);
                  return (
                    <li key={w.id}>
                      <label className={`flex items-start gap-2 text-xs ${open ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                        <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={on} disabled={!open}
                          onChange={(e) => onStyle?.({ ...style, works: e.target.checked ? [...style.works, w.id] : style.works.filter((x) => x !== w.id) })} />
                        <span><b className="font-semibold text-ink">{w.label}</b><br /><span className="text-ink-soft">{open ? w.blurb : `Unlocks at about ${fundsForDevelopment(w.unlockAt).toLocaleString("en-US")} AUSD in the city`}</span></span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {styleCode && <p className="text-[11px] text-ink-soft">Share this look: add <code className="rounded bg-slate-900/5 px-1">?style={styleCode}</code> to the link. It is saved in this browser for now.</p>}
            </section>
            {error && <Notice tone="error">{error}</Notice>}
          </div>
        )}
    </Sheet>
  );
}
