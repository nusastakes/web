"use client";

import { useEffect, useState } from "react";
import { WITHDRAW_STEPS, withdrawFlow, type Step } from "@/lib/actions";
import { publicClient } from "@/lib/chain";
import { vaultAbi } from "@/lib/abis";
import { humanError } from "@/lib/errors";
import { fmtAusd } from "@/lib/format";
import { emitChange, usePosition } from "@/lib/hooks";
import type { CityView } from "@/lib/types";
import { useWallet } from "@/lib/wallet";
import { IconArrowUp } from "../icons";
import StepList from "../StepList";
import { Notice, Sheet, Spinner, cx } from "../ui";
import NeedAccount from "./NeedAccount";

interface Props { city: CityView; onClose: () => void; onDone: () => void }

export default function WithdrawSheet({ city, onClose, onDone }: Props) {
  const w = useWallet();
  const ready = w.status === "ready" && !!w.address;
  const { position, refresh } = usePosition(ready ? city.vault : undefined, ready ? w.address : undefined);
  const [pct, setPct] = useState(100);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [payoutFor, setPayoutFor] = useState<{ shares: bigint; value: bigint } | null>(null);

  const shares = position ? (position.shares * BigInt(pct)) / 100n : 0n;

  // Jumlah yang akan diterima, dibaca dari kontrak (sudah bersih dari fee walikota yang tertunda).
  useEffect(() => {
    if (!city.vault || shares === 0n) return;
    let cancelled = false;
    publicClient.readContract({ address: city.vault, abi: vaultAbi, functionName: "previewRedeem", args: [shares] })
      .then((value) => { if (!cancelled) setPayoutFor({ shares, value }); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [city.vault, shares]);
  const payout = payoutFor && payoutFor.shares === shares ? payoutFor.value : null;

  const report = (id: string, patch: Partial<Step>) => setSteps((s) => (s ?? WITHDRAW_STEPS).map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const submit = async () => {
    if (!w.address || !city.vault || shares === 0n) return;
    setError(null); setDone(false);
    setSteps(WITHDRAW_STEPS.map((s) => ({ ...s })));
    try {
      await withdrawFlow({ wallet: w, vault: city.vault, owner: w.address, shares, cityName: city.name, report });
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
    <Sheet title={`Withdraw from ${city.name}`} subtitle="Your funds come back to your account. Money leaving always asks for your passkey." onClose={onClose}>
      {preview ? (
        <Notice tone="warn">This is a preview city with sample data, so there is nothing to withdraw.</Notice>
      ) : !ready ? (
        <NeedAccount />
      ) : done || steps ? (
        <div className="space-y-3">
          {steps && <StepList steps={steps} />}
          {error && <Notice tone="error">{error}</Notice>}
          {done && <Notice tone="good">Withdrawn. The funds are back in your account.</Notice>}
          {!busy && <button className="btn btn-ghost w-full" onClick={() => { setSteps(null); setDone(false); setError(null); }}>{done ? "Done" : "Try again"}</button>}
        </div>
      ) : !position ? (
        <div className="flex items-center gap-2 text-sm text-ink-soft"><Spinner /> Reading your position…</div>
      ) : position.shares === 0n ? (
        <Notice tone="info">You have no funds in this city yet. Deposit first.</Notice>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-900/[0.04] p-3">
            <div className="text-[11px] text-ink-soft">Your funds in this city</div>
            <div className="text-2xl font-semibold tracking-tight text-ink">{fmtAusd(Number(position.assets) / 1e6)} <span className="text-sm font-medium text-ink-soft">AUSD</span></div>
          </div>
          <div className="flex gap-2">
            {[25, 50, 100].map((p) => (
              <button key={p} className={cx("btn flex-1 !py-1.5", pct === p ? "btn-primary" : "btn-ghost")} disabled={busy} onClick={() => setPct(p)}>{p === 100 ? "All" : `${p}%`}</button>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">You receive</span>
            <span className="font-semibold text-ink">{payout === null ? "…" : `${fmtAusd(Number(payout) / 1e6)} AUSD`}</span>
          </div>
          <button className="btn btn-primary w-full" disabled={busy || shares === 0n} onClick={submit}>
            {busy ? <Spinner /> : <IconArrowUp />} {busy ? "Working…" : `Withdraw ${pct === 100 ? "everything" : `${pct}%`}`}
          </button>
        </div>
      )}
    </Sheet>
  );
}
