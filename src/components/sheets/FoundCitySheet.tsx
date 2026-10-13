"use client";

import { useEffect, useMemo, useState } from "react";
import { FOUND_STEPS, estimateFoundCost, foundCityFlow, type Step } from "@/lib/actions";
import { useCatalog } from "@/lib/catalog";
import { MAP_PRESETS } from "@/lib/config";
import { MAYOR } from "@/lib/copy-mayor";
import { humanError } from "@/lib/errors";
import { fmtBps } from "@/lib/format";
import { emitChange, useBalances, useCities } from "@/lib/hooks";
import { useLang } from "@/lib/lang";
import { requestGas } from "@/lib/relayer";
import { useMayorTier } from "@/lib/tier";
import type { Hex } from "@/lib/types";
import { useWallet } from "@/lib/wallet";
import { IconPlus } from "../icons";
import StepList from "../StepList";
import { Field, Notice, Sheet, Spinner, inputCls } from "../ui";
import NeedAccount from "./NeedAccount";
import PlacePicker from "./PlacePicker";
import ServicePicker from "./ServicePicker";

interface Props { onClose: () => void; onFounded: (vault?: Hex) => void }

const FAUCET = "https://faucet.monad.xyz";

export default function FoundCitySheet({ onClose, onFounded }: Props) {
  const w = useWallet();
  const [lang] = useLang();
  const t = MAYOR[lang].found;
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
  const { services, ready: catalogReady } = useCatalog();
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [picked, setPicked] = useState(false);
  // Slot layanan dibuka bertahap: tahap kota terbaik walikota atau dana miliknya sendiri di kotanya (lib/tier.ts).
  const { cities } = useCities();
  const tier = useMayorTier(ready ? w.address : undefined, cities);
  const tierNote = (
    <span>
      {t.tierNow(tier.slots)}{" "}
      {tier.next ? t.tierNext(tier.next.slots, tier.next.stage === "town" ? t.stageTown : t.stageCity, tier.next.ownFunds) : t.tierMax}
    </span>
  );
  // Pilihan awal: dua layanan pertama yang bisa dipilih; walikota bebas mengubahnya.
  useEffect(() => {
    if (picked || !catalogReady) return;
    const first = services.filter((s) => s.impl).slice(0, 2).map((s) => s.id);
    queueMicrotask(() => setServiceIds((cur) => (cur.length ? cur : first)));
  }, [catalogReady, services, picked]);
  const impls = useMemo(() => serviceIds.slice(0, tier.slots).map((id) => services.find((s) => s.id === id)?.impl).filter((x): x is Hex => !!x), [serviceIds, services, tier.slots]);
  const implsKey = impls.join(",");

  const report = (id: string, patch: Partial<Step>) => setSteps((s) => (s ?? FOUND_STEPS).map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const [need, setNeed] = useState<bigint | null>(null);
  useEffect(() => {
    if (!ready || !w.address) return;
    let cancelled = false;
    estimateFoundCost(w.address, implsKey ? (implsKey.split(",") as Hex[]) : undefined).then((v) => { if (!cancelled) setNeed(v); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [ready, w.address, implsKey]);
  const lowGas = ready && balances !== undefined && need !== null && balances.mon < need;
  const mon = (v: bigint) => (Number(v) / 1e18).toFixed(2);
  const chosenMap = source === "real" ? realMap : mapId;
  const problem = name.trim().length < 3 ? t.pName : !chosenMap ? t.pPlace : impls.length === 0 ? t.pService : lowGas ? t.pGas : null;

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
      const res = await foundCityFlow({ wallet: w, owner: w.address, input: { name, community, feeBps, mapId: chosenMap ?? MAP_PRESETS[0].id, adapterImpls: impls }, report });
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
    <Sheet title={t.title} subtitle={t.sub} onClose={onClose}>
      {!ready ? <NeedAccount /> : (
        <div className="space-y-3">
          <Field label={t.name}><input className={inputCls} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} disabled={busy} /></Field>
          <Field label={t.community}><input className={inputCls} value={community} maxLength={40} onChange={(e) => setCommunity(e.target.value)} placeholder={t.communityPh} disabled={busy} /></Field>
          {/* Bukan <Field>: isinya berisi tombol dan kanvas, dan <label> akan meneruskan klik ke tombol pertama. */}
          <div>
            <span className="mb-1 block text-xs font-medium text-ink-soft">{t.where}</span>
            <div className="mb-1.5 flex gap-1 rounded-xl bg-slate-900/5 p-1">
              {(["preset", "real"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setSource(k)} disabled={busy}
                  className={`flex-1 rounded-lg px-2 py-1 text-xs font-semibold ${source === k ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}>{k === "preset" ? t.preset : t.real}</button>
              ))}
            </div>
            {source === "real" ? <PlacePicker disabled={busy} onReady={(id) => setRealMap(id)} /> : (
            <select className={inputCls} value={mapId} onChange={(e) => setMapId(e.target.value)} disabled={busy}>
              {MAP_PRESETS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            )}
          </div>
          <ServicePicker selected={serviceIds.slice(0, tier.slots)} onChange={(ids) => { setPicked(true); setServiceIds(ids); }} disabled={busy} max={tier.slots} note={tierNote} />
          <Field label={t.fee} hint={<span className="font-semibold text-ink">{fmtBps(feeBps)}</span>}>
            <input type="range" min={0} max={2000} step={50} value={feeBps} onChange={(e) => setFeeBps(Number(e.target.value))} disabled={busy} className="w-full accent-[var(--accent)]" />
          </Field>
          <p className="text-[11px] leading-relaxed text-ink-soft">{t.feeNote}</p>

          {lowGas && (
            <Notice tone="info">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span>{t.gas(mon(need!), mon(balances!.mon))[0]}<strong>{t.gas(mon(need!), mon(balances!.mon))[1]}</strong>{t.gas(mon(need!), mon(balances!.mon))[2]}</span>
                  <button className="btn btn-primary !px-3 !py-1.5 text-xs" onClick={getGas} disabled={gasBusy}>{gasBusy ? <Spinner /> : null} {t.getGas}</button>
                </div>
                <a className="font-medium text-accent hover:underline" href={FAUCET} target="_blank" rel="noreferrer">{t.faucetMore}</a>
              </div>
            </Notice>
          )}
          {steps && <StepList steps={steps} />}
          {error && <Notice tone="error">{error}</Notice>}
          {founded && <Notice tone="good">{t.live}</Notice>}
          <button className="btn btn-primary w-full" disabled={busy || !!problem || founded} onClick={submit}>
            {busy ? <Spinner /> : <IconPlus />} {busy ? t.working : problem ?? t.btn}
          </button>
        </div>
      )}
    </Sheet>
  );
}
