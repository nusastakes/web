"use client";

import { useMemo, useState } from "react";
import { DEPOSIT_STEPS, depositFlow, type Step } from "@/lib/actions";
import { APP } from "@/lib/copy-app";
import { fmtAusd, parseAusd } from "@/lib/format";
import { useLang } from "@/lib/lang";
import { humanError } from "@/lib/errors";
import { markFirstTx } from "@/lib/metrics";
import { emitChange, usePosition } from "@/lib/hooks";
import { requestAusdPatient } from "@/lib/relayer";
import type { CityView } from "@/lib/types";
import { useWallet } from "@/lib/wallet";
import { IconArrowDown } from "../icons";
import StepList from "../StepList";
import { Field, Notice, Sheet, Spinner, inputCls } from "../ui";
import NeedAccount from "./NeedAccount";

interface Props { city: CityView; onClose: () => void; onDone: () => void }

export default function DepositSheet({ city, onClose, onDone }: Props) {
  const w = useWallet();
  const [lang] = useLang();
  const t = APP[lang].dep;
  const ready = w.status === "ready" && !!w.address;
  const { position, refresh } = usePosition(ready ? city.vault : undefined, ready ? w.address : undefined);
  const [amount, setAmount] = useState("10");
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [faucetBusy, setFaucetBusy] = useState(false);
  const [first, setFirst] = useState<{ seconds: number; ceremonies: number } | null>(null);
  const [done, setDone] = useState(false);

  const parsed = useMemo(() => parseAusd(amount), [amount]);
  const balance = position?.ausd ?? 0n;
  const problem =
    parsed === null || parsed <= 0n ? t.pErrEnter :
    parsed < 10_000n ? t.pErrMin :
    position && parsed > balance ? t.pErrBal :
    position && parsed > position.maxDeposit ? t.pErrCap : null;

  const report = (id: string, patch: Partial<Step>) => setSteps((s) => (s ?? DEPOSIT_STEPS).map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const needFaucet = ready && position && balance < (parsed ?? 0n);

  const getAusd = async () => {
    if (!w.address) return;
    setFaucetBusy(true); setError(null);
    try { await requestAusdPatient(w.address); await refresh(); } catch (e) { setError(humanError(e)); } finally { setFaucetBusy(false); }
  };

  const submit = async () => {
    if (!w.address || !city.vault || parsed === null) return;
    setError(null); setDone(false);
    setSteps(DEPOSIT_STEPS.map((s) => ({ ...s })));
    try {
      const res = await depositFlow({ wallet: w, vault: city.vault, owner: w.address, assets: parsed, report });
      setFirst(markFirstTx(res.hash));
      setDone(true);
      emitChange();
      await refresh();
      onDone();
    } catch (e) {
      setError(humanError(e));
      setSteps((s) => s?.map((x) => (x.state === "active" ? { ...x, state: "error" } : x)) ?? null);
    }
  };

  const busy = steps?.some((s) => s.state === "active") ?? false;
  const preview = city.preview || !city.vault;

  return (
    <Sheet title={t.title(city.name)} subtitle={t.sub} onClose={onClose}>
      {preview ? (
        <Notice tone="warn">{t.previewNote}</Notice>
      ) : !ready ? (
        <NeedAccount />
      ) : (
        <div className="space-y-3">
          <Field label={t.amount} hint={position ? <button className="font-medium text-accent" onClick={() => setAmount(String(Number(balance) / 1e6))}>{t.max(fmtAusd(Number(balance) / 1e6))}</button> : null}>
            <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} aria-label={t.amountAria} />
          </Field>
          <div className="flex gap-2">
            {["10", "50", "100"].map((v) => <button key={v} className="btn btn-ghost flex-1 !py-1.5" disabled={busy} onClick={() => setAmount(v)}>{v}</button>)}
          </div>

          {needFaucet && (
            <Notice tone="info">
              <div className="flex items-center justify-between gap-3">
                <span>{t.haveBal(fmtAusd(Number(balance) / 1e6))}</span>
                <button className="btn btn-primary !px-3 !py-1.5 text-xs" onClick={getAusd} disabled={faucetBusy}>{faucetBusy ? <Spinner /> : null} {t.getBtn}</button>
              </div>
            </Notice>
          )}

          <div className="rounded-xl bg-slate-900/[0.04] px-3 py-2 text-xs leading-relaxed text-ink-soft">
            {t.receive(city.sharePrice.toFixed(6))}
            {city.districts.some((d) => d.simulated) && t.simYield}
          </div>

          {steps && <StepList steps={steps} />}
          {error && <Notice tone="error">{error}</Notice>}
          {done && (
            <Notice tone="good">
              {t.deposited}{first && t.firstTx(first.seconds.toFixed(1), first.ceremonies)}
            </Notice>
          )}

          <button className="btn btn-primary w-full" disabled={busy || !!problem || !position} onClick={submit}>
            {busy ? <Spinner /> : <IconArrowDown />} {busy ? t.working : problem ?? (done ? t.again(amount) : t.btn(amount))}
          </button>
        </div>
      )}
    </Sheet>
  );
}
