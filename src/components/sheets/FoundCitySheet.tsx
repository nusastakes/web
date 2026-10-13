"use client";

import { useEffect, useState } from "react";
import { FOUND_STEPS, estimateFoundCost, foundCityFlow, type Step } from "@/lib/actions";
import { MAP_PRESETS } from "@/lib/config";
import { humanError } from "@/lib/errors";
import { fmtBps } from "@/lib/format";
import { emitChange, useBalances } from "@/lib/hooks";
import { requestGas } from "@/lib/relayer";
import type { Hex } from "@/lib/types";
import { useWallet } from "@/lib/wallet";
import { IconPlus } from "../icons";
import StepList from "../StepList";
import { Field, Notice, Sheet, Spinner, inputCls } from "../ui";
import NeedAccount from "./NeedAccount";
import PlacePicker from "./PlacePicker";

interface Props { onClose: () => void; onFounded: (vault?: Hex) => void }

const FAUCET = "https://faucet.monad.xyz";

export default function FoundCitySheet({ onClose, onFounded }: Props) {
  const w = useWallet();
  const ready = w.status === "ready" && !!w.address;
  const { balances, refresh } = useBalances(ready ? w.address : undefined);
  const [name, setName] = useState("");
  const [community, setCommunity] = useState("");
  const [mapId, setMapId] = useState<string>(MAP_PRESETS[0].id);
  const [source, setSource] = useState<"preset" | "real">("preset");
  const [realMap, setRealMap] = useState<string | null>(null);
  const [feeBps, setFeeBps] = useState(1000);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gasBusy, setGasBusy] = useState(false);
  const [founded, setFounded] = useState(false);

  const report = (id: string, patch: Partial<Step>) => setSteps((s) => (s ?? FOUND_STEPS).map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const [need, setNeed] = useState<bigint | null>(null);
  useEffect(() => {
    if (!ready || !w.address) return;
    let cancelled = false;
    estimateFoundCost(w.address).then((v) => { if (!cancelled) setNeed(v); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [ready, w.address]);
  const lowGas = ready && balances !== undefined && need !== null && balances.mon < need;
  const mon = (v: bigint) => (Number(v) / 1e18).toFixed(2);
  const chosenMap = source === "real" ? realMap : mapId;
  const problem = name.trim().length < 3 ? "Give the city a name (3+ letters)." : !chosenMap ? "Pick a real place first." : lowGas ? "You need more testnet MON first." : null;

  const getGas = async () => {
    if (!w.address) return;
    setGasBusy(true); setError(null);
    try { await requestGas(w.address); await refresh(); } catch (e) { setError(humanError(e)); } finally { setGasBusy(false); }
  };

  const submit = async () => {
    if (!w.address) return;
    setError(null); setFounded(false);
    setSteps(FOUND_STEPS.map((s) => ({ ...s })));
    try {
      const res = await foundCityFlow({ wallet: w, owner: w.address, input: { name, community, feeBps, mapId: chosenMap ?? MAP_PRESETS[0].id }, report });
      setFounded(true);
      emitChange();
      onFounded(res.vault);
    } catch (e) {
      setError(humanError(e));
      setSteps((s) => s?.map((x) => (x.state === "active" ? { ...x, state: "error" } : x)) ?? null);
    }
  };
  const busy = steps?.some((s) => s.state === "active") ?? false;

  return (
    <Sheet title="Found a city" subtitle="You become the mayor. You choose the fee; the contract keeps your hands off the funds." onClose={onClose}>
      {!ready ? <NeedAccount /> : (
        <div className="space-y-3">
          <Field label="City name"><input className={inputCls} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kota Jogja" disabled={busy} /></Field>
          <Field label="Community (optional)"><input className={inputCls} value={community} maxLength={40} onChange={(e) => setCommunity(e.target.value)} placeholder="e.g. Web3 Jogja" disabled={busy} /></Field>
          {/* Bukan <Field>: isinya berisi tombol dan kanvas, dan <label> akan meneruskan klik ke tombol pertama. */}
          <div>
            <span className="mb-1 block text-xs font-medium text-ink-soft">Where is your city?</span>
            <div className="mb-1.5 flex gap-1 rounded-xl bg-slate-900/5 p-1">
              {(["preset", "real"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setSource(k)} disabled={busy}
                  className={`flex-1 rounded-lg px-2 py-1 text-xs font-semibold ${source === k ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}>{k === "preset" ? "Ready-made map" : "A real place (OpenStreetMap)"}</button>
              ))}
            </div>
            {source === "real" ? <PlacePicker disabled={busy} onReady={(id) => setRealMap(id)} /> : (
            <select className={inputCls} value={mapId} onChange={(e) => setMapId(e.target.value)} disabled={busy}>
              {MAP_PRESETS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            )}
          </div>
          <Field label="Your fee on profit" hint={<span className="font-semibold text-ink">{fmtBps(feeBps)}</span>}>
            <input type="range" min={0} max={2000} step={50} value={feeBps} onChange={(e) => setFeeBps(Number(e.target.value))} disabled={busy} className="w-full accent-[var(--accent)]" />
          </Field>
          <p className="text-[11px] leading-relaxed text-ink-soft">You earn this share of the residents&apos; profit, only when they profit. 10% of your fee goes to the platform.</p>

          {lowGas && (
            <Notice tone="info">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span>Founding a city needs about <strong>{mon(need!)} MON</strong> for gas. You have {mon(balances!.mon)}.</span>
                  <button className="btn btn-primary !px-3 !py-1.5 text-xs" onClick={getGas} disabled={gasBusy}>{gasBusy ? <Spinner /> : null} Get gas</button>
                </div>
                <a className="font-medium text-accent hover:underline" href={FAUCET} target="_blank" rel="noreferrer">Need more? Open the Monad faucet</a>
              </div>
            </Notice>
          )}
          {steps && <StepList steps={steps} />}
          {error && <Notice tone="error">{error}</Notice>}
          {founded && <Notice tone="good">Your city is live. You can see it in the city list.</Notice>}
          <button className="btn btn-primary w-full" disabled={busy || !!problem || founded} onClick={submit}>
            {busy ? <Spinner /> : <IconPlus />} {busy ? "Working…" : problem ?? "Found city"}
          </button>
        </div>
      )}
    </Sheet>
  );
}
