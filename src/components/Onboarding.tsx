"use client";

import { useState } from "react";
import { APP } from "@/lib/copy-app";
import { humanError } from "@/lib/errors";
import { shortAddr } from "@/lib/format";
import { emitChange } from "@/lib/hooks";
import { useLang } from "@/lib/lang";
import { setOnb, type Onb, type StepId } from "@/lib/onboarding";
import { requestAusdPatient } from "@/lib/relayer";
import type { CityView } from "@/lib/types";
import { useWallet } from "@/lib/wallet";
import { IconArrowDown, IconBuilding, IconCheck, IconChevron, IconCoins, IconPlus } from "./icons";
import { Card, Notice, Spinner, cx } from "./ui";

/**
 * Panduan mulai setelah masuk: sapaan sekali, lalu daftar langkah (akun, uang uji, setoran pertama) yang tercentang
 * sendiri mengikuti keadaan chain, dan ucapan selamat dengan langkah tambahan. Keadaannya dihitung di `lib/onboarding.ts`.
 */

interface Props {
  ob: Onb;
  city: CityView;
  /** Kelas tambahan untuk menyembunyikan panduan saat kartu lain memakai tempat yang sama. */
  hideClass?: string;
  onDeposit: () => void;
  onExplore: () => void;
  onFound: () => void;
}

function Ring({ done, total }: { done: number; total: number }) {
  const c = 2 * Math.PI * 9;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden className="shrink-0 text-accent">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="3" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - done / total)} transform="rotate(-90 12 12)" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
    </svg>
  );
}

export default function Onboarding({ ob, city, hideClass, onDeposit, onExplore, onFound }: Props) {
  const w = useWallet();
  const [lang] = useLang();
  const t = APP[lang].onb;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [queued, setQueued] = useState<number | null>(null);

  const getMoney = async () => {
    if (!w.address) return;
    setBusy(true); setErr(null);
    try { await requestAusdPatient(w.address, (s) => setQueued(s)); emitChange(); } catch (e) { setErr(humanError(e)); } finally { setBusy(false); setQueued(null); }
  };

  const noCity = city.preview || !city.vault;
  const action = (id: StepId) => {
    if (id === "money") {
      return (
        <>
          <button className="btn btn-primary mt-2.5 !py-2 text-sm" disabled={busy} onClick={getMoney}>
            {busy ? <><Spinner /> {t.sending}</> : <><IconCoins /> {t.getMoney}</>}
          </button>
          {queued !== null && <div className="mt-2"><Notice tone="info">{t.queued(queued)}</Notice></div>}
          {err && <div className="mt-2"><Notice tone="error"><b className="font-semibold">{t.moneyFail}</b><span className="mt-0.5 block">{err}</span><span className="mt-1 block">{t.moneyHint}</span></Notice></div>}
        </>
      );
    }
    if (id === "deposit") {
      return (
        <button className="btn btn-primary mt-2.5 !py-2 text-sm" onClick={noCity ? onExplore : onDeposit}>
          {noCity ? <><IconBuilding /> {t.chooseCity}</> : <><IconArrowDown /> {t.depositTo(city.name)}</>}
        </button>
      );
    }
    return null;
  };

  const core = ob.steps.filter((s) => !s.optional);
  const extras = ob.steps.filter((s) => s.optional);
  const row = (id: StepId, done: boolean, n: number, active: boolean, optional = false) => {
    const [title, body] = t.steps[id];
    return (
      <li key={id} className="flex gap-3">
        <span className={cx("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", done ? "bg-good text-white" : active ? "bg-accent text-white" : "bg-slate-900/10 text-ink-soft")}>
          {done ? <IconCheck width={13} height={13} strokeWidth={3} /> : optional ? (id === "look" ? <IconBuilding width={13} height={13} /> : <IconPlus width={13} height={13} />) : n}
        </span>
        <div className="min-w-0 flex-1">
          <div className={cx("text-sm font-semibold", done ? "text-ink-soft" : "text-ink")}>
            {title}{optional && !done && <span className="ml-1.5 rounded-full bg-slate-900/5 px-1.5 py-0.5 align-middle text-[10px] font-medium text-ink-soft">{t.optional}</span>}
          </div>
          {(active || (optional && !done)) && <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{body}</p>}
          {active && action(id)}
        </div>
      </li>
    );
  };

  return (
    <>
      {ob.welcome && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/25 p-3 sm:items-center">
          <Card solid className="ns-rise w-full max-w-[460px] p-5 sm:p-6" >
            <span className="ns-pop flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-good"><IconCheck width={24} height={24} strokeWidth={3} /></span>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink">{t.welcomeTitle}</h2>
            {w.address && <div className="mt-0.5 font-mono text-xs text-ink-soft">{shortAddr(w.address)}</div>}
            <p className="mt-3 text-sm text-ink-soft">{t.welcomeLead}</p>
            <ul className="mt-3 space-y-3">
              {t.welcomePoints.map(([title, body]) => (
                <li key={title} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><IconCheck width={11} height={11} strokeWidth={3} /></span>
                  <span><b className="font-semibold text-ink">{title}.</b> <span className="text-ink-soft">{body}</span></span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={() => setOnb({ welcomed: true, open: true, hidden: false })}>{t.start}</button>
              <button className="btn btn-ghost" onClick={() => setOnb({ welcomed: true, open: false })}>{t.skip}</button>
            </div>
          </Card>
        </div>
      )}

      {ob.show && (
        <div className={cx("pointer-events-none fixed left-3 top-[11.25rem] z-[5] sm:left-4", hideClass)}>
          {!ob.state.open && !ob.celebrate ? (
            <button className="glass pointer-events-auto flex items-center gap-2 rounded-full py-1.5 pl-2 pr-3.5 text-sm font-semibold text-ink shadow-md" onClick={() => setOnb({ open: true })} aria-label={t.expand}>
              <Ring done={ob.coreDone} total={ob.coreTotal} /> {t.title} · {ob.coreDone}/{ob.coreTotal}
            </button>
          ) : ob.celebrate ? (
            <Card solid className="ns-rise pointer-events-auto w-[min(340px,calc(100vw-1.5rem))] p-4">
              <span className="ns-pop flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-good"><IconCheck width={20} height={20} strokeWidth={3} /></span>
              <h3 className="mt-2.5 text-base font-semibold text-ink">{t.celebrateTitle}</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">{t.celebrateBody}</p>
              <ul className="mt-3 space-y-3">{extras.map((s, i) => row(s.id, s.done, i + 1, false, true))}</ul>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {!ob.steps.find((s) => s.id === "mayor")?.done && <button className="btn btn-primary !py-2 text-sm" onClick={onFound}><IconPlus /> {t.foundCity}</button>}
                <button className="btn btn-ghost !py-2 text-sm" onClick={onExplore}>{t.seeBoard}</button>
                <button className="btn btn-ghost !py-2 text-sm" onClick={() => setOnb({ done: true })}>{t.close}</button>
              </div>
            </Card>
          ) : (
            <Card solid className="ns-rise pointer-events-auto w-[min(340px,calc(100vw-1.5rem))] p-4">
              <div className="flex items-center gap-2.5">
                <Ring done={ob.coreDone} total={ob.coreTotal} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink">{t.title}</div>
                  <div className="text-[11px] text-ink-soft">{t.progress(ob.coreDone, ob.coreTotal)}</div>
                </div>
                <button className="rounded-lg p-1.5 text-ink-soft hover:bg-slate-900/5" onClick={() => setOnb({ open: false })} aria-label={t.collapse}><IconChevron width={16} height={16} className="rotate-180" /></button>
              </div>
              <ol className="mt-3.5 space-y-3.5">{core.map((s, i) => row(s.id, s.done, i + 1, s.id === ob.active))}</ol>
              <button className="mt-3.5 text-[11px] font-medium text-ink-soft hover:text-ink" onClick={() => setOnb({ hidden: true })}>{t.hide}</button>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
