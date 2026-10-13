"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import type { Step } from "@/lib/actions";
import { PANGGUNG } from "@/lib/copy-panggung";
import { humanError } from "@/lib/errors";
import { fmtAusd, parseAusd } from "@/lib/format";
import { emitChange } from "@/lib/hooks";
import { useLang } from "@/lib/lang";
import { MAX_FEE_BPS, PANGGUNG_STEPS, buyToken, fmtPrice, fmtTokens, launchToken, quote, sellToken, setLaunchpad, usePanggung } from "@/lib/panggung";
import type { CityView, Hex } from "@/lib/types";
import { useWallet } from "@/lib/wallet";
import StepList from "../StepList";
import { Badge, Field, Notice, Sheet, Spinner, cx, inputCls } from "../ui";
import NeedAccount from "./NeedAccount";

/**
 * Panggung: peluncur token di Loket kota (CityServices, jenis 1). Walikota menyalakan layanan dan memilih fee; pengunjung
 * meluncurkan token dan jual-beli di kurva harga. Fee dialirkan ke dana kota (penduduk), tidak pernah langsung ke
 * walikota. Nama dan simbol token ditulis pengunjung, jadi hanya ditampilkan sebagai teks biasa.
 */

interface Props { city: CityView; isMayor: boolean; onClose: () => void; onDone?: () => void }

const ausdNum = (raw: bigint) => Number(raw) / 1e6;

export default function PanggungSheet({ city, isMayor, onClose, onDone }: Props) {
  const w = useWallet();
  const [lang] = useLang();
  const t = PANGGUNG[lang];
  const ready = w.status === "ready" && !!w.address;
  const vault = city.preview ? undefined : city.vault;
  const { state, error: readError, refresh } = usePanggung(vault, ready ? w.address : undefined);

  const [steps, setSteps] = useState<Step[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [feeInput, setFeeInput] = useState<string | null>(null);
  const [sel, setSel] = useState<{ token: Hex; side: "buy" | "sell" } | null>(null);
  const [amount, setAmount] = useState("");
  const [q, setQ] = useState<{ key: string; out: bigint; fee: bigint } | null>(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [firstBuy, setFirstBuy] = useState("");

  const busy = steps?.some((s) => s.state === "active") ?? false;
  const report = (id: string, patch: Partial<Step>) => setSteps((s) => (s ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const explain = (e: unknown) => {
    const m = e instanceof Error ? e.message : String(e);
    if (m.startsWith("NotEnoughAusd:")) { const [, need, have] = m.split(":"); return t.err.notEnough(need, have); }
    if (m === "BadName" || /BadName/.test(m)) return t.err.badName;
    if (m === "ZeroAmount" || /ZeroAmount/.test(m)) return t.err.zero;
    if (/FeeTooHigh/.test(m)) return t.err.fee;
    return humanError(e);
  };

  const run = async (withApprove: boolean, fn: () => Promise<unknown>, doneMsg: string) => {
    setError(null); setOkMsg(null);
    setSteps(PANGGUNG_STEPS(t.steps, withApprove));
    try {
      await fn();
      setOkMsg(doneMsg);
      emitChange();
      await refresh();
      onDone?.();
    } catch (e) {
      setError(explain(e));
      setSteps((s) => s?.map((x) => (x.state === "active" ? { ...x, state: "error" } : x)) ?? null);
    }
  };

  // Kutipan beli atau jual, ditunda sebentar saat mengetik.
  const parsed = sel ? (sel.side === "buy" ? parseAusd(amount) : (() => { try { return amount.trim() ? parseUnits(amount.trim(), 18) : null; } catch { return null; } })()) : null;
  const quoteKey = sel && parsed ? `${sel.token}:${sel.side}:${parsed}` : "";
  useEffect(() => {
    if (!sel || !parsed || parsed <= 0n) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      quote(sel.token, sel.side, parsed).then((r) => { if (!cancelled) setQ({ key: `${sel.token}:${sel.side}:${parsed}`, ...r }); }).catch(() => undefined);
    }, 350);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [sel, parsed]);
  const shownQuote = q && q.key === quoteKey ? q : null;

  const feeBps = state?.feeBps ?? 0;
  const feeText = feeInput ?? (feeBps / 100).toString();
  const feeParsed = Math.round(Number(feeText.replace(",", ".")) * 100);
  const feeValid = Number.isFinite(feeParsed) && feeParsed >= 0 && feeParsed <= MAX_FEE_BPS;

  const saveService = (on: boolean) => {
    if (!w.address || !vault) return;
    const bps = feeValid ? feeParsed : feeBps;
    void run(false, () => setLaunchpad({ wallet: w, owner: w.address!, city: vault, on, feeBps: bps, label: t.ceremony.settings, report }), t.done.settings);
  };

  const trade = () => {
    if (!w.address || !sel || !parsed) return;
    const row = state?.tokens.find((x) => x.address === sel.token);
    if (sel.side === "buy") {
      void run(true, () => buyToken({ wallet: w, owner: w.address!, token: sel.token, amount: parsed, labels: { approve: t.ceremony.approveAusd(fmtAusd(ausdNum(parsed))), send: t.ceremony.buy }, report }), t.done.buy);
    } else {
      void run(true, () => sellToken({ wallet: w, owner: w.address!, token: sel.token, tokensIn: parsed, labels: { approve: t.ceremony.approveToken(row?.symbol ?? "token"), send: t.ceremony.sell }, report }), t.done.sell);
    }
  };

  const firstBuyRaw = firstBuy.trim() ? parseAusd(firstBuy) : 0n;
  const launchTotal = state && firstBuyRaw !== null ? state.launchFee + firstBuyRaw : null;
  const launch = () => {
    if (!w.address || !vault || !state || firstBuyRaw === null || launchTotal === null) return;
    void run(true, () => launchToken({
      wallet: w, owner: w.address!, city: vault, name, symbol, firstBuy: firstBuyRaw, launchFee: state.launchFee,
      labels: { approve: t.ceremony.approveAusd(fmtAusd(ausdNum(launchTotal))), send: t.ceremony.launch }, report,
    }), t.done.launch);
  };

  const reset = () => { setSteps(null); setError(null); setOkMsg(null); setSel(null); setAmount(""); setName(""); setSymbol(""); setFirstBuy(""); };

  return (
    <Sheet title={t.title(city.name)} subtitle={t.sub} onClose={onClose}>
      {city.preview || !vault ? (
        <Notice tone="warn">{t.previewNote}</Notice>
      ) : !state ? (
        readError ? <Notice tone="error">{humanError(readError)}</Notice> : <div className="flex items-center gap-2 text-sm text-ink-soft"><Spinner /> {t.reading}</div>
      ) : steps ? (
        <div className="space-y-3">
          <StepList steps={steps} />
          {error && <Notice tone="error">{error}</Notice>}
          {okMsg && <Notice tone="good">{okMsg}</Notice>}
          {!busy && <button className="btn btn-ghost w-full" onClick={reset}>{okMsg ? t.again : t.retry}</button>}
        </div>
      ) : (
        <div className="space-y-4">
          <Notice tone="info">{t.testnet}</Notice>
          <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-ink-soft">
            {t.how.map((l) => <li key={l}>{l}</li>)}
          </ol>

          {isMayor && (
            <section className="space-y-2 rounded-2xl bg-accent-soft/70 p-3" aria-label={t.mayorHdr}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-ink">{t.mayorHdr}</div>
                  <p className="text-[11px] leading-snug text-ink-soft">{t.mayorIntro}</p>
                </div>
                <Badge tone={state.on ? "good" : "neutral"}>{state.on ? t.on : t.off}</Badge>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label={t.feeLbl} hint={t.feeHint}>
                    <input className={inputCls} inputMode="decimal" value={feeText} onChange={(e) => setFeeInput(e.target.value)} aria-invalid={!feeValid} />
                  </Field>
                </div>
                <span className="pb-2.5 text-sm text-ink-soft">%</span>
              </div>
              {!feeValid && <p className="text-[11px] text-red-700">{t.err.fee}</p>}
              <div className="flex gap-2">
                <button className="btn btn-primary flex-1 !py-1.5 text-xs" disabled={busy || !ready || (!state.on && !feeValid)} onClick={() => saveService(!state.on)}>{state.on ? t.turnOff : t.turnOn}</button>
                {state.on && <button className="btn btn-ghost flex-1 !py-1.5 text-xs" disabled={busy || !ready || !feeValid || feeParsed === feeBps} onClick={() => saveService(true)}>{t.save}</button>}
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div><dt className="text-[10px] text-ink-soft">{t.statsVolume}</dt><dd className="text-xs font-semibold text-ink">{fmtAusd(ausdNum(state.stats.volume))}</dd></div>
                <div><dt className="text-[10px] text-ink-soft">{t.statsFees}</dt><dd className="text-xs font-semibold text-ink">{fmtAusd(ausdNum(state.stats.fees))}</dd></div>
                <div><dt className="text-[10px] text-ink-soft">{t.statsUses}</dt><dd className="text-xs font-semibold text-ink">{state.stats.uses}</dd></div>
              </dl>
              <p className="text-[11px] leading-snug text-ink-soft">{t.streamLbl(fmtAusd(ausdNum(state.stream.due)), fmtAusd(ausdNum(state.stream.pending)))}</p>
              <p className="text-[10px] leading-snug text-ink-soft/80">{t.feeNote}</p>
              {!ready && <p className="text-[11px] text-ink-soft">{t.needAccount}</p>}
            </section>
          )}

          {!state.on ? (
            <Notice tone="warn">{t.offNote} {isMayor ? t.offMayor : ""}</Notice>
          ) : (
            <>
              <section className="space-y-2" aria-label={t.tokensHdr}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.tokensHdr}</h3>
                {state.tokens.length === 0 ? <p className="text-xs text-ink-soft">{t.noTokens}</p> : (
                  <ul className="space-y-1.5">
                    {state.tokens.map((tk) => {
                      const open = sel?.token === tk.address;
                      return (
                        <li key={tk.address} className="rounded-xl border border-slate-900/5 bg-white/70 p-2.5 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-ink">{tk.name} <span className="font-medium text-ink-soft">{tk.symbol}</span></div>
                              <div className="text-ink-soft">{t.priceLbl} {fmtPrice(tk.priceAusd)} AUSD{ready && tk.held > 0n ? ` · ${t.youHold(fmtTokens(tk.held))}` : ""}</div>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button className={cx("btn !px-2 !py-1 text-[11px]", open && sel?.side === "buy" ? "btn-primary" : "btn-ghost")} disabled={!ready} onClick={() => { setSel(open && sel?.side === "buy" ? null : { token: tk.address, side: "buy" }); setAmount(""); }}>{t.buy}</button>
                              <button className={cx("btn !px-2 !py-1 text-[11px]", open && sel?.side === "sell" ? "btn-primary" : "btn-ghost")} disabled={!ready || tk.held === 0n} onClick={() => { setSel(open && sel?.side === "sell" ? null : { token: tk.address, side: "sell" }); setAmount(""); }}>{t.sell}</button>
                            </div>
                          </div>
                          {open && sel && (
                            <div className="mt-2 space-y-1.5 border-t border-slate-900/5 pt-2">
                              <div className="flex gap-1.5">
                                <input className={inputCls} inputMode="decimal" placeholder={sel.side === "buy" ? t.amountAusd : t.amountTokens} value={amount} onChange={(e) => setAmount(e.target.value)} />
                                {sel.side === "sell" && <button className="btn btn-ghost !px-2 text-[11px]" onClick={() => setAmount(formatUnits(tk.held, 18))}>{t.max}</button>}
                              </div>
                              <p className="text-[11px] text-ink-soft">
                                {!parsed || parsed <= 0n ? (sel.side === "buy" && state.ausdBalance !== null ? t.balance(fmtAusd(ausdNum(state.ausdBalance))) : "")
                                  : shownQuote ? `${t.youGet(sel.side === "buy" ? `${fmtTokens(shownQuote.out)} ${tk.symbol}` : `${fmtAusd(ausdNum(shownQuote.out))} AUSD`)} · ${t.cityFee(fmtAusd(ausdNum(shownQuote.fee)))}` : t.quoting}
                              </p>
                              <button className="btn btn-primary w-full !py-1.5 text-xs" disabled={busy || !parsed || parsed <= 0n} onClick={trade}>{sel.side === "buy" ? t.buy : t.sell}</button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="space-y-2 border-t border-slate-900/5 pt-3" aria-label={t.launchHdr}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.launchHdr}</h3>
                <p className="text-[11px] leading-relaxed text-ink-soft">{t.launchIntro(fmtAusd(ausdNum(state.launchFee)))}</p>
                {!ready ? <NeedAccount /> : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2"><Field label={t.nameLbl}><input className={inputCls} maxLength={32} value={name} onChange={(e) => setName(e.target.value)} /></Field></div>
                      <Field label={t.symbolLbl}><input className={inputCls} maxLength={8} value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} /></Field>
                    </div>
                    <Field label={t.firstBuyLbl} hint={t.firstBuyHint}><input className={inputCls} inputMode="decimal" placeholder="0" value={firstBuy} onChange={(e) => setFirstBuy(e.target.value)} /></Field>
                    {state.ausdBalance !== null && <p className="text-[11px] text-ink-soft">{t.balance(fmtAusd(ausdNum(state.ausdBalance)))}</p>}
                    <button className="btn btn-primary w-full" disabled={busy || !name.trim() || !symbol.trim() || firstBuyRaw === null || launchTotal === null} onClick={launch}>
                      {busy ? <Spinner /> : null} {launchTotal === null ? t.err.zero : t.launchBtn(fmtAusd(ausdNum(launchTotal)))}
                    </button>
                  </>
                )}
              </section>
            </>
          )}
          <p className="text-[10px] text-ink-soft/80">{t.prediction}</p>
        </div>
      )}
    </Sheet>
  );
}
