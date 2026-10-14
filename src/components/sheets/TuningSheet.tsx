"use client";

import { useEffect, useMemo, useState } from "react";
import { vaultAbi } from "@/lib/abis";
import type { Step } from "@/lib/actions";
import { useCatalog } from "@/lib/catalog";
import { publicClient } from "@/lib/chain";
import { TUNING } from "@/lib/copy-tuning";
import { humanError } from "@/lib/errors";
import { fmtBps } from "@/lib/format";
import { emitChange } from "@/lib/hooks";
import { useLang } from "@/lib/lang";
import { getTuning, type Tuning } from "@/lib/relayer";
import { DEFAULT_TUNING, TUNE_STEPS, effectiveApy, readTuning, setTuningFlow } from "@/lib/tuning";
import type { CityView, District, Hex } from "@/lib/types";
import { useWallet } from "@/lib/wallet";
import StepList from "../StepList";
import { Badge, Notice, Sheet, Spinner, cx } from "../ui";

interface Props { city: CityView; district: District; onClose: () => void; onDone?: () => void }

const RANGE_OPTIONS = [500, 1000, 2500, 5000, 0];
const fmtUsd = (n: number) => `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;

/**
 * Setelan satu layanan bersetelan (TC67.10): hadiah token, pinjam lalu taruh ulang bila protokol mengizinkan AUSD
 * sebagai jaminan, dan rentang harga untuk likuiditas terkonsentrasi. Perkiraan hasil dihitung di sini dengan rumus
 * yang sama dengan relayer; relayer menulis angka resminya ke feed setelah setelan tersimpan di adapter.
 */
export default function TuningSheet({ city, district, onClose, onDone }: Props) {
  const [lang] = useLang();
  const t = TUNING[lang];
  const w = useWallet();
  const { services } = useCatalog();
  const svc = services.find((s) => s.id === district.serviceId);
  const knobs = svc?.knobs;
  const isMayor = w.status === "ready" && !!w.address && !!city.mayor && w.address.toLowerCase() === city.mayor.toLowerCase();

  const [onChain, setOnChain] = useState<Tuning | null>(null);
  const [draft, setDraft] = useState<Tuning | null>(null);
  const [deputyOk, setDeputyOk] = useState(false);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  /** APY yang benar-benar tertulis di feed untuk adapter ini (relayer `/tuning/:adapter`). */
  const [onFeed, setOnFeed] = useState<number | null>(null);

  useEffect(() => {
    if (!district.adapter || !district.tunable) return;
    let cancelled = false;
    const read = () => getTuning(district.adapter as Hex).then((r) => { if (!cancelled) setOnFeed(r.onFeed?.apyBps ?? null); }).catch(() => undefined);
    void read();
    const id = window.setInterval(read, 30_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [district.adapter, district.tunable, saved]);

  useEffect(() => {
    if (!district.adapter || !district.tunable) return;
    let cancelled = false;
    readTuning(district.adapter).then(({ tuning }) => { if (!cancelled) { setOnChain(tuning); setDraft(tuning); } }).catch(() => { if (!cancelled) { setOnChain(DEFAULT_TUNING); setDraft(DEFAULT_TUNING); } });
    return () => { cancelled = true; };
  }, [district.adapter, district.tunable, saved]);

  // Kunci wakil hanya dipakai bila memang wakil kota ini yang masih berlaku.
  useEffect(() => {
    if (!city.vault || !w.deputy) return;
    let cancelled = false;
    Promise.all([
      publicClient.readContract({ address: city.vault, abi: vaultAbi, functionName: "sessionKey" }),
      publicClient.readContract({ address: city.vault, abi: vaultAbi, functionName: "sessionKeyExpiry" }),
    ]).then(([key, exp]) => { if (!cancelled) setDeputyOk(key.toLowerCase() === w.deputy!.toLowerCase() && Number(exp) > Date.now() / 1000 + 60); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [city.vault, w.deputy]);

  const price = knobs?.range?.priceUsd ?? 0;
  const est = useMemo(() => (draft ? effectiveApy(knobs, draft, svc?.apyBps ?? district.apyBps, price || undefined) : null), [draft, knobs, svc?.apyBps, district.apyBps, price]);
  const changed = !!draft && !!onChain && JSON.stringify(draft) !== JSON.stringify(onChain);
  const busy = steps?.some((s) => s.state === "active") ?? false;
  const edit = isMayor && !busy;
  const set = (patch: Partial<Tuning>) => setDraft((d) => ({ ...(d ?? DEFAULT_TUNING), ...patch }));
  const centerToday = () => String(Math.round(price * 1e8));

  const save = async () => {
    if (!draft || !district.adapter || !w.address) return;
    setError(null); setSaved(false);
    setSteps(TUNE_STEPS.map((s) => ({ ...s })));
    const report = (id: string, patch: Partial<Step>) => setSteps((s) => (s ?? TUNE_STEPS).map((x) => (x.id === id ? { ...x, ...patch } : x)));
    try {
      await setTuningFlow({ wallet: w, adapter: district.adapter as Hex, owner: w.address, tuning: draft, useDeputy: deputyOk, report });
      setSaved(true);
      emitChange();
      onDone?.();
    } catch (e) {
      setError(humanError(e));
      setSteps((s) => s?.map((x) => (x.state === "active" ? { ...x, state: "error" } : x)) ?? null);
    }
  };

  const chip = (active: boolean, label: string, onClick: () => void, disabled = false) => (
    <button type="button" disabled={disabled} onClick={onClick}
      className={cx("rounded-full px-2.5 py-1 text-[11px] font-semibold transition", active ? "bg-accent text-white" : "bg-slate-900/5 text-ink hover:bg-slate-900/10", disabled && "opacity-50")}>{label}</button>
  );

  return (
    <Sheet title={t.title(svc?.name ?? district.label)} subtitle={t.sub} onClose={onClose}>
      <div className="space-y-3">
        {!district.tunable ? (
          <Notice tone="info">{t.notTunable}</Notice>
        ) : !knobs || (!knobs.rewards && !knobs.loop && !knobs.range) ? (
          <Notice tone="info">{lang === "en" && svc?.knobsNote ? svc.knobsNote : t.noKnobs}</Notice>
        ) : !draft ? (
          <div className="flex items-center gap-2 text-sm text-ink-soft"><Spinner /></div>
        ) : (
          <>
            {!isMayor && <Notice tone="info">{t.readOnly}</Notice>}

            {knobs.rewards && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-ink">{t.rewards}</div>
                <div className="flex flex-wrap gap-1.5">
                  {chip(draft.takeRewards, t.rewardsOn(fmtBps(Math.round(knobs.rewards.rewardApyBps * 0.9))), () => set({ takeRewards: true }), !edit)}
                  {chip(!draft.takeRewards, t.rewardsOff, () => set({ takeRewards: false }), !edit)}
                </div>
                <p className="text-[11px] leading-relaxed text-ink-soft">{t.rewardsHint}</p>
              </div>
            )}

            {knobs.loop && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-ink">{t.loop}</div>
                {knobs.loop.allowed ? (
                  <>
                    <div className="flex items-center gap-3">
                      <input type="range" min={100} max={knobs.loop.maxX100} step={25} value={Math.min(draft.loopX100, knobs.loop.maxX100)} disabled={!edit}
                        onChange={(e) => set({ loopX100: Number(e.target.value) })} className="flex-1 accent-[var(--color-accent,#3f6bff)]" aria-label={t.loop} />
                      <span className="w-12 text-right text-sm font-semibold text-ink">{t.loopX((Math.min(draft.loopX100, knobs.loop.maxX100) / 100).toFixed(2))}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-ink-soft">{t.loopHint(knobs.loop.borrowApyBps === null ? "?" : fmtBps(knobs.loop.borrowApyBps))}</p>
                  </>
                ) : (
                  <p className="text-[11px] leading-relaxed text-ink-soft">{t.loopNo(knobs.loop.reason ? t.reasons[knobs.loop.reason] ?? knobs.loop.reason : "LTV 0")}</p>
                )}
              </div>
            )}

            {knobs.range && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-ink">{t.range}</div>
                <div className="flex flex-wrap gap-1.5">
                  {RANGE_OPTIONS.map((r) => chip(draft.rangeBps === r, r === 0 ? t.full : `±${r / 100}%`, () => set({ rangeBps: r, centerPriceE8: r === 0 ? "0" : centerToday() }), !edit))}
                </div>
                <p className="text-[11px] leading-relaxed text-ink-soft">{t.rangeHint(fmtUsd(price))}</p>
                {est?.inRange === false && (
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="warn">{t.outRange}</Badge>
                    {edit && <button type="button" className="text-[11px] font-semibold text-accent hover:underline" onClick={() => set({ centerPriceE8: centerToday() })}>{t.recenter}</button>}
                  </div>
                )}
                {est?.inRange === true && draft.rangeBps > 0 && <Badge tone="good">{t.inRange}</Badge>}
              </div>
            )}

            {est && (
              <div className="rounded-xl bg-slate-900/[0.04] p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-ink-soft">{t.estimate}</span>
                  <span className="text-xl font-semibold tracking-tight text-ink">{fmtBps(est.apyBps)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-ink-soft">
                  <span>{t.base} {fmtBps(est.parts.base)}</span>
                  {knobs.rewards && <span>{t.rew} {fmtBps(est.parts.reward)}</span>}
                  {knobs.loop?.allowed && <span>{t.loopX(est.parts.loop.toFixed(2))}</span>}
                  {onFeed !== null && <span>{t.now} {fmtBps(onFeed)}</span>}
                </div>
                {est.uncappedBps > 5000 && <p className="mt-1 text-[11px] text-ink-soft">{t.capped} ({fmtBps(est.uncappedBps)})</p>}
                {est.uncappedBps < 0 && <p className="mt-1 text-[11px] font-medium text-bad">{t.negative} ({fmtBps(est.uncappedBps)})</p>}
              </div>
            )}

            {steps && <StepList steps={steps} />}
            {error && <Notice tone="error">{error}</Notice>}
            {saved && <Notice tone="good">{t.saved}</Notice>}
            {isMayor && (
              <button className="btn btn-primary w-full" disabled={!changed || busy} onClick={save}>
                {busy ? <Spinner /> : null} {busy ? t.saving : t.save}
              </button>
            )}
            <p className="text-[10px] leading-snug text-ink-soft">{t.simulated}</p>
          </>
        )}
      </div>
    </Sheet>
  );
}
