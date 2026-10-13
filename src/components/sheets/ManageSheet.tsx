"use client";

import { useState } from "react";
import { stringToHex } from "viem";
import { writeEntry } from "@/lib/book";
import BookPanel from "./BookPanel";
import StaffPanel from "./StaffPanel";
import { DEFAULT_STYLE, THEMES, THEME_IDS, WORKS, developmentOf, encodeStyle, fundsForDevelopment, unlockAllWorks, type CityStyle, type WorkId } from "@/lib/scene/themes";
import { REBALANCE_STEPS, DEPUTY_STEPS, TX_STEPS, contractTx, planHashOf, rebalanceFlow, setDeputyFlow, type Slot, type Step } from "@/lib/actions";
import { planPreset, type PlanSlot, type PresetId } from "@/lib/coach";
import { vaultAbi } from "@/lib/abis";
import { DESK } from "@/lib/copy-desk";
import { MAYOR } from "@/lib/copy-mayor";
import { humanError } from "@/lib/errors";
import { fmtAusd, fmtBps } from "@/lib/format";
import { emitChange, useBalances, useMayorState } from "@/lib/hooks";
import { useLang } from "@/lib/lang";
import { requestGas } from "@/lib/relayer";
import type { CityView, Hex } from "@/lib/types";
import { useWallet } from "@/lib/wallet";
import { IconKey, IconSwap } from "../icons";
import StepList from "../StepList";
import { Badge, Field, Notice, Sheet, Spinner, inputCls } from "../ui";
import MayorDesk from "./MayorDesk";
import NeedAccount from "./NeedAccount";

interface Props {
  city: CityView;
  onClose: () => void;
  onDone: () => void;
  /** Gaya kota yang sedang berlaku dan cara menyimpannya (tampilan saja). */
  style?: CityStyle;
  styleCode?: string;
  onStyle?: (s: CityStyle) => void;
  styleSync?: "local" | "loading" | "shared" | "saving" | "error";
  styleError?: string;
  /** Tab yang dibuka lebih dulu (bawaan: Ringkasan / Meja Walikota). */
  initialTab?: Tab;
  /** Membuka lembar setor (dari langkah "Setor modal pertama"). */
  onDeposit?: () => void;
  /** Membuka lembar dirikan kota (saran "dirikan kota baru dengan beberapa layanan"). */
  onFound?: () => void;
}

type Tab = "desk" | "funds" | "book" | "staff" | "design";

const DEPUTY_TTL = 24 * 3600;
const DEPUTY_SHIFT_BPS = 2500;
/** Di bawah ini kunci perlu isi ulang gas; relayer hanya mengisi bila saldo di bawah 0,25 MON. */
const LOW_GAS = 200_000_000_000_000_000n;
const ausd = (raw: bigint) => fmtAusd(Number(raw) / 1e6);

export default function ManageSheet({ city, onClose, onDone, style = DEFAULT_STYLE, styleCode = "", onStyle, styleSync = "local", styleError, initialTab = "desk", onDeposit, onFound }: Props) {
  const w = useWallet();
  const [lang] = useLang();
  const t = MAYOR[lang].manage;
  const d = DESK[lang];
  // Nama distrik bawaan ikut bahasa; yang tersimpan di buku strategi tetap label aslinya.
  const slotName = (label: string) => (lang === "id" ? ({ Plaza: "Alun-alun", "Lending district": "Distrik pinjaman", "Vault district": "Distrik brankas" } as Record<string, string>)[label] ?? label : label);
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
  const [styleChain, setStyleChain] = useState<"idle" | "busy" | "done">("idle");
  const [gasBusy, setGasBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [seal, setSeal] = useState(true);
  const [feeDraft, setFeeDraft] = useState<number | null>(null);
  const [shiftDraft, setShiftDraft] = useState<number | null>(null);
  const [ruleSteps, setRuleSteps] = useState<Step[] | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [presetBusy, setPresetBusy] = useState(false);
  const [presetSteps, setPresetSteps] = useState<Step[] | null>(null);
  const [presetNote, setPresetNote] = useState<{ tone: "good" | "info"; text: string } | null>(null);

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
  const problem = !from || !to ? t.pNowhere : from.assets === 0n ? t.pNothing : amount <= 0n ? t.pAmount : null;

  const reportR = (id: string, patch: Partial<Step>) => setSteps((s) => (s ?? REBALANCE_STEPS).map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const reportD = (id: string, patch: Partial<Step>) => setDeputySteps((s) => (s ?? DEPUTY_STEPS).map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const failActive = (set: typeof setSteps) => set((s) => s?.map((x) => (x.state === "active" ? { ...x, state: "error" } : x)) ?? null);

  const move = async () => {
    if (!w.address || !city.vault || !from || !to) return;
    setError(null); setDone(null);
    const sealing = seal && note.trim().length > 0;
    const base = REBALANCE_STEPS.map((s) => ({ ...s }));
    setSteps(sealing ? [{ id: "seal", label: "Seal your reasoning in the strategy book", state: "todo" }, ...base] : base);
    try {
      // Buku strategi tersegel: alasan dienkripsi di perangkat, hanya hash ciphertext yang ikut ke rantai.
      let planHash = planHashOf(note);
      if (sealing) {
        reportR("seal", { state: "active", detail: w.bookUnlocked ? undefined : "Unlock the book with your passkey" });
        const sealed = await writeEntry(w, w.address, {
          v: 1, city: city.vault, cityName: city.name, from: from.label, to: to.label, amount: ausd(amount), note: note.trim(),
        });
        planHash = sealed.planHash;
        reportR("seal", { state: "done", detail: `Sealed · ${planHash.slice(0, 10)}…` });
      }
      await rebalanceFlow({
        wallet: w, useDeputy: deputyActive, report: reportR,
        input: { vault: city.vault, owner: w.address, from: from.address, to: to.address, amount, planHash },
      });
      setDone(t.moved(ausd(amount), slotName(from.label), slotName(to.label)));
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

  /**
   * Strategi cepat (Meja Walikota): menggeser dana antara Alun-alun dan distrik supaya porsi yang bekerja mendekati `pct`.
   * Satu perubahan dibatasi aturan kota (`limitBps`); bila belum sampai, walikota mengetuk lagi.
   */
  const applyPreset = async (preset: PresetId, pct: number) => {
    if (!w.address || !city.vault || !state) return;
    setError(null); setPresetNote(null);
    const cat = new Map(city.districts.map((x) => [x.id, x.category]));
    const planSlots: PlanSlot[] = state.slots.map((x) => ({ id: x.id, address: x.address, assets: x.assets, idle: x.id === "idle", category: cat.get(x.id) }));
    const moves = planPreset(planSlots, pct, preset, limitBps);
    if (moves.length === 0) { setPresetNote({ tone: "info", text: t.pAmount }); return; }
    setPresetBusy(true);
    setPresetSteps(REBALANCE_STEPS.map((x) => ({ ...x })));
    const report = (id: string, patch: Partial<Step>) => setPresetSteps((p) => (p ?? REBALANCE_STEPS).map((x) => (x.id === id ? { ...x, ...patch } : x)));
    let done = 0; let moved = 0n;
    try {
      for (const m of moves) {
        setPresetSteps(REBALANCE_STEPS.map((x) => ({ ...x })));
        await rebalanceFlow({ wallet: w, useDeputy: deputyActive, report, input: { vault: city.vault, owner: w.address, from: m.from.address as Hex, to: m.to.address as Hex, amount: m.amount, planHash: planHashOf("") } });
        done++; moved += m.amount;
      }
      setPresetNote({ tone: "good", text: d.presetDone(done, ausd(moved)) });
    } catch (e) {
      setError(humanError(e));
      setPresetSteps((p) => p?.map((x) => (x.state === "active" ? { ...x, state: "error" } : x)) ?? null);
      if (done > 0) setPresetNote({ tone: "info", text: `${d.presetDone(done, ausd(moved))} ${d.presetPartial(moves.length - done)}` });
    } finally {
      emitChange();
      await Promise.all([refresh(), refreshBalances()]).catch(() => undefined);
      onDone();
      setPresetBusy(false);
    }
  };

  /** Ubah aturan kota (fee, batas pergeseran): ceremony passkey baru dengan kunci utama (PRD B16). */
  const saveRule = async (kind: "fee" | "shift") => {
    if (!city.vault) return;
    const value = kind === "fee" ? feeDraft : shiftDraft;
    if (value === null) return;
    setError(null);
    setRuleSteps(TX_STEPS(kind === "fee" ? "Fee updated" : "Limit updated"));
    const report = (id: string, patch: Partial<Step>) => setRuleSteps((s) => s?.map((x) => (x.id === id ? { ...x, ...patch } : x)) ?? null);
    try {
      await contractTx(w, { address: city.vault, abi: vaultAbi, functionName: kind === "fee" ? "setFee" : "setMaxShift", args: [value] }, { ceremony: true, label: kind === "fee" ? "Confirm the new fee…" : "Confirm the new limit…", report });
      emitChange();
      await refresh();
      onDone();
      if (kind === "fee") setFeeDraft(null); else setShiftDraft(null);
    } catch (e) { setError(humanError(e)); setRuleSteps((s) => s?.map((x) => (x.state === "active" ? { ...x, state: "error" } : x)) ?? null); }
  };

  const getGas = async () => {
    if (!signer) return;
    setGasBusy(true); setError(null);
    try { await requestGas(signer); await refreshBalances(); } catch (e) { setError(humanError(e)); } finally { setGasBusy(false); }
  };

  const busy = (steps?.some((s) => s.state === "active") ?? false) || (deputySteps?.some((s) => s.state === "active") ?? false);
  const expiry = state?.deputy ? new Date(state.deputy.expiry * 1000).toLocaleString(MAYOR[lang].locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <Sheet title={t.title(city.name)} subtitle={t.sub} onClose={onClose}>
      {city.preview || !city.vault ? <Notice tone="warn">{t.preview}</Notice>
        : !ready ? <NeedAccount />
        : !isMayor ? <Notice tone="info">{t.notMayor}</Notice>
        : !state ? <div className="flex items-center gap-2 text-sm text-ink-soft"><Spinner /> {t.reading}</div>
        : (
          <div className="space-y-4">
            <div className="flex gap-1 rounded-xl bg-slate-900/5 p-1" role="tablist">
              {(["desk", "funds", "book", "staff", "design"] as const).map((k) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={`flex-1 rounded-lg px-1.5 py-1.5 text-[11px] font-semibold sm:text-xs ${tab === k ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}>
                  {k === "desk" ? d.tab : t.tabs[k]}
                </button>
              ))}
            </div>
            {tab === "desk" && lowGas && (
              <Notice tone="info">
                <div className="flex items-center justify-between gap-3">
                  <span>{t.lowGas(deputyActive, (Number(balances!.mon) / 1e18).toFixed(2))}</span>
                  <button className="btn btn-primary !px-3 !py-1.5 text-xs" onClick={getGas} disabled={gasBusy}>{gasBusy ? <Spinner /> : null} {t.getGas}</button>
                </div>
              </Notice>
            )}
            {tab === "desk" && (
              <MayorDesk city={city} state={state} owner={w.address!} styleChanged={encodeStyle(style) !== encodeStyle(DEFAULT_STYLE)} go={setTab}
                openDeposit={() => onDeposit?.()} openFound={() => onFound?.()} applyPreset={(preset, pct) => void applyPreset(preset, pct)} presetBusy={presetBusy || lowGas} presetSteps={presetSteps} presetNote={presetNote} limitBps={limitBps} />
            )}
            {tab === "book" && <BookPanel city={city} />}
            {tab === "staff" && <StaffPanel city={city} onDone={onDone} />}
            {tab === "funds" && <>
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.moveFunds}</h3>
                <Badge tone={deputyActive ? "good" : "neutral"}>{deputyActive ? t.badgeDeputy : t.badgePasskey}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label={t.from}>
                  <select className={inputCls} value={from?.id ?? ""} onChange={(e) => setFromId(e.target.value)} disabled={busy}>
                    {slots.map((s) => <option key={s.id} value={s.id}>{slotName(s.label)} · {ausd(s.assets)}</option>)}
                  </select>
                </Field>
                <Field label={t.to}>
                  <select className={inputCls} value={to?.id ?? ""} onChange={(e) => setToId(e.target.value)} disabled={busy}>
                    {slots.filter((s) => s.id !== from?.id).map((s) => <option key={s.id} value={s.id}>{slotName(s.label)} · {ausd(s.assets)}</option>)}
                  </select>
                </Field>
              </div>
              <Field label={t.amount} hint={<span className="font-semibold text-ink">{ausd(amount)} AUSD</span>}>
                <input type="range" min={0} max={1000} step={10} value={permille} onChange={(e) => setPermille(Number(e.target.value))} disabled={busy || cap === 0n} className="w-full accent-[var(--accent)]" aria-label={t.amountAria} />
              </Field>
              <p className="text-[11px] leading-relaxed text-ink-soft">{t.limit(fmtBps(limitBps), ausd(cap))}</p>
              <Field label={t.reason}>
                <textarea className={`${inputCls} min-h-[60px] resize-none`} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder={t.reasonPh} disabled={busy} />
              </Field>
              <label className="flex items-start gap-2 text-[11px] leading-snug text-ink-soft">
                <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={seal} onChange={(e) => setSeal(e.target.checked)} disabled={busy} />
                <span><b className="text-ink">{t.sealIt[0]}</b>{t.sealIt[1]}</span>
              </label>
              {lowGas && (
                <Notice tone="info">
                  <div className="flex items-center justify-between gap-3">
                    <span>{t.lowGas(deputyActive, (Number(balances!.mon) / 1e18).toFixed(2))}</span>
                    <button className="btn btn-primary !px-3 !py-1.5 text-xs" onClick={getGas} disabled={gasBusy}>{gasBusy ? <Spinner /> : null} {t.getGas}</button>
                  </div>
                </Notice>
              )}
              {steps && <StepList steps={steps} />}
              {done && <Notice tone="good">{done}</Notice>}
              <button className="btn btn-primary w-full" disabled={busy || !!problem || lowGas} onClick={move}>
                {busy ? <Spinner /> : <IconSwap />} {busy ? t.working : problem ?? t.moveFunds}
              </button>
            </section>

            <section className="space-y-2 border-t border-slate-900/5 pt-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft"><IconKey width={14} height={14} /> {t.deputyHdr}</h3>
              {state.deputy ? (
                <p className="text-xs leading-relaxed text-ink-soft">
                  {t.deputyActive(expiry, fmtBps(state.deputy.maxShiftBps))}
                  {!deputyActive && t.deputyOther}
                  {state.deputy.budgetTotal > 0n && <> {t.deputyBudget(fmtAusd(Number(state.deputy.budgetLeft) / 1e6), fmtAusd(Number(state.deputy.budgetTotal) / 1e6))}</>}
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-ink-soft">{t.deputyNone(fmtBps(DEPUTY_SHIFT_BPS))}</p>
              )}
              {deputySteps && <StepList steps={deputySteps} />}
              <div className="flex gap-2">
                <button className="btn btn-ghost flex-1" disabled={busy} onClick={() => setDeputy(true)}>{state.deputy ? t.renew : t.register}</button>
                {state.deputy && <button className="btn btn-ghost" disabled={busy} onClick={() => setDeputy(false)}>{t.remove}</button>}
              </div>
            </section>
            <section className="space-y-2 border-t border-slate-900/5 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.rules}</h3>
              <Field label={t.fee} hint={<span className="font-semibold text-ink">{fmtBps(feeDraft ?? city.feeBps)}</span>}>
                <input type="range" min={0} max={2000} step={50} value={feeDraft ?? city.feeBps} onChange={(e) => setFeeDraft(Number(e.target.value))} disabled={busy} className="w-full accent-[var(--accent)]" aria-label={t.feeAria} />
              </Field>
              <Field label={t.maxMove} hint={<span className="font-semibold text-ink">{fmtBps(shiftDraft ?? state.maxShiftBps)}</span>}>
                <input type="range" min={500} max={10000} step={500} value={shiftDraft ?? state.maxShiftBps} onChange={(e) => setShiftDraft(Number(e.target.value))} disabled={busy} className="w-full accent-[var(--accent)]" aria-label={t.maxMoveAria} />
              </Field>
              <p className="text-[11px] leading-relaxed text-ink-soft">{t.rulesNote}</p>
              {ruleSteps && <StepList steps={ruleSteps} />}
              <div className="flex gap-2">
                <button className="btn btn-ghost flex-1" disabled={busy || feeDraft === null || feeDraft === city.feeBps} onClick={() => saveRule("fee")}>{t.saveFee}</button>
                <button className="btn btn-ghost flex-1" disabled={busy || shiftDraft === null || shiftDraft === state.maxShiftBps} onClick={() => saveRule("shift")}>{t.saveLimit}</button>
              </div>
            </section>
            </>}
            {tab === "design" && <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.design}</h3>
              <p className="text-xs leading-relaxed text-ink-soft">{t.designNote}</p>
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
                  const open = developmentOf(city.totalAssets) >= w.unlockAt || unlockAllWorks();
                  const on = style.works.includes(w.id as WorkId);
                  return (
                    <li key={w.id}>
                      <label className={`flex items-start gap-2 text-xs ${open ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                        <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={on} disabled={!open}
                          onChange={(e) => onStyle?.({ ...style, works: e.target.checked ? [...style.works, w.id] : style.works.filter((x) => x !== w.id) })} />
                        <span><b className="font-semibold text-ink">{w.label}</b><br /><span className="text-ink-soft">{open ? w.blurb : t.unlocksAt(fundsForDevelopment(w.unlockAt).toLocaleString("en-US"))}</span></span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] text-ink-soft">
                {styleSync === "shared" ? t.styleShared : styleSync === "saving" ? t.styleSaving : styleSync === "error" ? t.styleErr(styleError ?? t.relayerError) : t.styleLocal}
                {styleCode && <>{t.previewLink}<code className="rounded bg-slate-900/5 px-1">?style={styleCode}</code></>}
              </p>
              {/* B2.26: gaya kota juga bisa dicatat di kontrak (`setStyle(bytes32)`), selain di relayer. */}
              {city.vault && styleCode && (
                <div className="space-y-1 rounded-xl bg-slate-900/[0.04] p-2.5">
                  <p className="text-[11px] leading-relaxed text-ink-soft">{new TextEncoder().encode(styleCode).length > 32 ? t.styleChainLong : t.styleChainNote}</p>
                  <button className="btn btn-ghost w-full !py-1.5 text-xs" disabled={styleChain === "busy" || new TextEncoder().encode(styleCode).length > 32}
                    onClick={async () => {
                      setStyleChain("busy"); setError(null);
                      try {
                        await contractTx(w, { address: city.vault!, abi: vaultAbi, functionName: "setStyle", args: [stringToHex(styleCode, { size: 32 })] }, { ceremony: true, label: t.styleChain });
                        setStyleChain("done");
                      } catch (e) { setError(humanError(e)); setStyleChain("idle"); }
                    }}>
                    {styleChain === "busy" ? <Spinner /> : null} {styleChain === "done" ? t.styleChainDone : t.styleChain}
                  </button>
                </div>
              )}
            </section>}
            {error && <Notice tone="error">{error}</Notice>}
          </div>
        )}
    </Sheet>
  );
}
