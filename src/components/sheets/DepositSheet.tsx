"use client";

import { useMemo, useState } from "react";
import { DEPOSIT_STEPS, depositFlow, type Step } from "@/lib/actions";
import { fmtAusd, parseAusd } from "@/lib/format";
import { humanError } from "@/lib/errors";
import { markFirstTx } from "@/lib/metrics";
import { emitChange, usePosition } from "@/lib/hooks";
import { requestAusd } from "@/lib/relayer";
import type { CityView } from "@/lib/types";
import { useWallet } from "@/lib/wallet";
import { IconArrowDown } from "../icons";
import StepList from "../StepList";
import { Field, Notice, Sheet, Spinner, inputCls } from "../ui";
import NeedAccount from "./NeedAccount";

interface Props { city: CityView; onClose: () => void; onDone: () => void }

export default function DepositSheet({ city, onClose, onDone }: Props) {
  const w = useWallet();
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
    parsed === null || parsed <= 0n ? "Enter an amount, for example 10." :
    parsed < 10_000n ? "The minimum is 0.01 AUSD." :
    position && parsed > balance ? "You do not have that much AUSD." :
    position && parsed > position.maxDeposit ? "This city cannot take that much more." : null;

  const report = (id: string, patch: Partial<Step>) => setSteps((s) => (s ?? DEPOSIT_STEPS).map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const needFaucet = ready && position && balance < (parsed ?? 0n);

  const getAusd = async () => {
    if (!w.address) return;
    setFaucetBusy(true); setError(null);
    try { await requestAusd(w.address); await refresh(); } catch (e) { setError(humanError(e)); } finally { setFaucetBusy(false); }
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
    <Sheet title={`Deposit into ${city.name}`} subtitle="Move your funds into the city. You can withdraw at any time." onClose={onClose}>
      {preview ? (
        <Notice tone="warn">This is a preview city with sample data. Pick a live city from the list at the top, or found your own.</Notice>
      ) : !ready ? (
        <NeedAccount />
      ) : (
        <div className="space-y-3">
          <Field label="Amount (AUSD)" hint={position ? <button className="font-medium text-accent" onClick={() => setAmount(String(Number(balance) / 1e6))}>Max {fmtAusd(Number(balance) / 1e6)}</button> : null}>
            <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} aria-label="Amount in AUSD" />
          </Field>
          <div className="flex gap-2">
            {["10", "50", "100"].map((v) => <button key={v} className="btn btn-ghost flex-1 !py-1.5" disabled={busy} onClick={() => setAmount(v)}>{v}</button>)}
          </div>

          {needFaucet && (
            <Notice tone="info">
              <div className="flex items-center justify-between gap-3">
                <span>You have {fmtAusd(Number(balance) / 1e6)} AUSD. Test money is free on this network.</span>
                <button className="btn btn-primary !px-3 !py-1.5 text-xs" onClick={getAusd} disabled={faucetBusy}>{faucetBusy ? <Spinner /> : null} Get 10,000 AUSD</button>
              </div>
            </Notice>
          )}

          <div className="rounded-xl bg-slate-900/[0.04] px-3 py-2 text-xs leading-relaxed text-ink-soft">
            You receive city shares worth the same amount at today&apos;s price ({city.sharePrice.toFixed(6)} AUSD each).
            You pay no gas: you only sign, and a relayer sends the transaction.
            {city.districts.some((d) => d.simulated) && " Yield here is simulated on testnet."}
          </div>

          {steps && <StepList steps={steps} />}
          {error && <Notice tone="error">{error}</Notice>}
          {done && (
            <Notice tone="good">
              Deposited.{first && <> Account to first transaction: <strong>{first.seconds.toFixed(1)} s</strong> with <strong>{first.ceremonies}</strong> passkey prompt{first.ceremonies === 1 ? "" : "s"}.</>}
            </Notice>
          )}

          <button className="btn btn-primary w-full" disabled={busy || !!problem || !position} onClick={submit}>
            {busy ? <Spinner /> : <IconArrowDown />} {busy ? "Working…" : problem ?? (done ? `Deposit ${amount} AUSD again` : `Deposit ${amount} AUSD`)}
          </button>
        </div>
      )}
    </Sheet>
  );
}
