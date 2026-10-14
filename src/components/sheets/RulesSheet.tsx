"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { keccak256, toHex, zeroAddress } from "viem";
import { vaultAbi } from "@/lib/abis";
import { contractTx } from "@/lib/actions";
import { useCatalog } from "@/lib/catalog";
import { RULES_COPY } from "@/lib/copy-rules";
import { txUrl } from "@/lib/config";
import { humanError } from "@/lib/errors";
import { useLang } from "@/lib/lang";
import { FALLBACK_PRESETS, RULES_DOMAIN, getPresets, getRules, localizePreset, putRules, ruleName, type Metric, type Op, type Preset, type Rule, type RulesStatus } from "@/lib/rules";
import type { CityView, Hex } from "@/lib/types";
import { useWallet } from "@/lib/wallet";
import { Badge, Field, Notice, Sheet, Spinner, cx, inputCls } from "../ui";

interface Props { city: CityView; onClose: () => void }

const RULES_TYPES = { CityRules: [{ name: "vault", type: "address" }, { name: "rulesHash", type: "bytes32" }, { name: "nonce", type: "uint256" }] } as const;
/** Satuan isian: persen untuk bunga dan porsi (disimpan sebagai basis poin), AUSD untuk total dana (satuan dasar 6 desimal). */
const toStored = (metric: Metric, v: number) => (metric === "tvl" ? Math.round(v * 1e6) : metric === "outOfRange" ? 0 : Math.round(v * 100));
const fromStored = (metric: Metric, v: number) => (metric === "tvl" ? v / 1e6 : metric === "outOfRange" ? 0 : v / 100);
/** Relayer membuang field asing; `rulesJson` yang ditandatangani harus persis string yang dikirim. */
const clean = (rules: Rule[]) => rules.map(({ id, name, enabled, when, then, cooldownMin }) => ({ id, name, enabled, when, then, cooldownMin }));
const RANGES = [500, 1000, 2500, 5000, 0];

/**
 * Aturan walikota (TC67.10). Walikota menulis aturannya sendiri ("jika ... maka ..."), atau menyalakan aturan siap
 * pakai; relayer menjalankannya lewat autopilot yang hanya boleh memindah dan menyetel dana kota.
 */
export default function RulesSheet({ city, onClose }: Props) {
  const [lang] = useLang();
  const t = RULES_COPY[lang];
  const w = useWallet();
  const { services } = useCatalog();
  const isMayor = w.status === "ready" && !!w.address && !!city.mayor && w.address.toLowerCase() === city.mayor.toLowerCase();

  const [status, setStatus] = useState<RulesStatus | null>(null);
  const [presets, setPresets] = useState<Preset[]>(FALLBACK_PRESETS);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const cityServices = useMemo(() => city.districts.filter((d) => d.serviceId).map((d) => ({ id: d.serviceId!, name: services.find((s) => s.id === d.serviceId)?.name ?? d.label, tunable: !!d.tunable })), [city.districts, services]);
  const nameOf = useCallback((id?: string) => {
    if (!id || id === "any") return t.any;
    if (id === "cash") return t.cash;
    if (id === "best") return t.best;
    if (id === "worst") return t.worst;
    if (id === "largest") return t.largest;
    if (id === "match" || id === "trigger") return t.trigger;
    return cityServices.find((s) => s.id === id)?.name ?? services.find((s) => s.id === id)?.name ?? id;
  }, [cityServices, services, t]);

  const load = useCallback(async () => {
    if (!city.vault) return;
    try {
      const [st, pr] = await Promise.all([getRules(city.vault), getPresets().catch(() => null)]);
      setStatus(st); setRules(st.rules ?? []); setLoadError(null);
      if (pr?.presets?.length) setPresets(pr.presets);
    } catch (e) { setLoadError(humanError(e)); }
  }, [city.vault]);
  // Status autopilot dan log tindakannya berubah tanpa aksi di layar ini (izin baru terbaca relayer, autopilot berjalan):
  // perbarui tiap 15 detik selama lembar terbuka.
  useEffect(() => {
    queueMicrotask(() => void load());
    const id = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  // --- Rangkai aturan baru ------------------------------------------------------------------------------------
  const [metric, setMetric] = useState<Metric>("apy");
  const [wService, setWService] = useState<string>("any");
  const [op, setOp] = useState<Op>("<");
  const [value, setValue] = useState("4");
  const [action, setAction] = useState<"move" | "tune">("move");
  const [from, setFrom] = useState("match");
  const [to, setTo] = useState("cash");
  const [pct, setPct] = useState("50");
  const [tService, setTService] = useState<string>("");
  const [tKind, setTKind] = useState<"loop" | "rewards" | "range" | "recenter">("rewards");
  const [tValue, setTValue] = useState("1");
  const [tRange, setTRange] = useState(1000);
  const [cooldown, setCooldown] = useState("60");
  const [rname, setRname] = useState("");

  const describe = (r: Rule) => {
    const u = t.unit[r.when.metric];
    const val = r.when.metric === "outOfRange" ? "" : ` ${r.when.op} ${fromStored(r.when.metric, r.when.value).toLocaleString(lang === "id" ? "id-ID" : "en-US")}${u === "%" ? "%" : ` ${u}`}`;
    const subject = ["cashPct", "tvl"].includes(r.when.metric) ? "" : ` ${nameOf(r.when.service)}`;
    const cond = `${t.when} ${t.metric[r.when.metric]}${subject}${val}`;
    const act = r.then.action === "move"
      ? `${t.move} ${r.then.pct}% ${t.from} ${nameOf(r.then.from)} ${t.to} ${nameOf(r.then.to)}`
      : `${t.tune} ${nameOf(r.then.service)}: ${r.then.set.recenter ? t.recenter : r.then.set.loopX100 !== undefined ? `${t.setLoop} ${(r.then.set.loopX100 / 100).toFixed(2)}×` : r.then.set.takeRewards !== undefined ? `${t.setRewards} ${r.then.set.takeRewards ? t.on : t.off}` : `${t.setRange} ${r.then.set.rangeBps ? `±${(r.then.set.rangeBps ?? 0) / 100}%` : t.full}`}`;
    return `${cond}, ${t.then.toLowerCase()} ${act.charAt(0).toLowerCase()}${act.slice(1)}`;
  };

  const addRule = () => {
    const needsService = !["cashPct", "tvl"].includes(metric);
    const rule: Rule = {
      id: `r-${Date.now().toString(36)}`,
      name: rname.trim().slice(0, 60) || `${t.add} ${rules.filter((r) => !r.preset).length + 1}`,
      enabled: true,
      when: { metric, ...(needsService ? { service: wService || "any" } : {}), op: metric === "outOfRange" ? ">" : op, value: toStored(metric, Number(value) || 0) },
      then: action === "move"
        ? { action: "move", from, to, pct: Math.max(1, Math.min(100, Math.round(Number(pct) || 0))) }
        : { action: "tune", service: tService || cityServices.find((s) => s.tunable)?.id || "", set: tKind === "recenter" ? { recenter: true } : tKind === "loop" ? { loopX100: Math.max(100, Math.min(300, Math.round((Number(tValue) || 1) * 4) * 25)) } : tKind === "rewards" ? { takeRewards: tValue !== "0" } : { rangeBps: tRange } },
      cooldownMin: Math.max(1, Math.min(1440, Math.round(Number(cooldown) || 60))),
    };
    setRules((rs) => [...rs, rule]);
    setRname("");
  };

  const presetIds = useMemo(() => new Set(presets.flatMap((p) => p.rules.map((r) => r.id))), [presets]);
  const presetOn = (p: Preset) => p.rules.every((pr) => rules.some((r) => r.id === pr.id && r.enabled));
  const togglePreset = (p: Preset) => setRules((rs) => {
    const ids = new Set(p.rules.map((r) => r.id));
    if (presetOn(p)) return rs.filter((r) => !ids.has(r.id));
    return [...rs.filter((r) => !ids.has(r.id)), ...p.rules.map((r) => ({ ...r, enabled: true }))];
  });

  const save = async () => {
    if (!city.vault || !isMayor) return;
    setBusy("save"); setError(null); setNotice(null);
    try {
      const nonce = BigInt(status?.nonce ?? "0") + 1n;
      const rulesJson = JSON.stringify(clean(rules));
      const signature = await w.signTypedData({ domain: RULES_DOMAIN, types: RULES_TYPES, primaryType: "CityRules", message: { vault: city.vault, rulesHash: keccak256(toHex(rulesJson)), nonce } });
      await putRules(city.vault, { vault: city.vault, rulesJson, nonce: nonce.toString(), signature });
      setNotice(t.saved);
      await load();
    } catch (e) { setError(humanError(e)); } finally { setBusy(null); }
  };

  const setAutopilot = async (on: boolean) => {
    if (!city.vault || !status?.status.autopilot) return;
    setBusy("ap"); setError(null);
    try {
      const expiry = on ? BigInt(Math.floor(Date.now() / 1000) + 7 * 86_400) : 0n;
      const key = on ? (status.status.autopilot as Hex) : zeroAddress;
      await contractTx(w, { address: city.vault, abi: vaultAbi, functionName: "setSessionKey", args: [key, expiry, on ? 2500 : 0] }, { ceremony: true, label: on ? t.apAllow : t.apRevoke });
      await load();
    } catch (e) { setError(humanError(e)); } finally { setBusy(null); }
  };

  const ap = status?.status;
  const until = ap?.sessionKeyExpiry ? new Date(ap.sessionKeyExpiry * 1000).toLocaleString(lang === "id" ? "id-ID" : "en-US", { dateStyle: "medium", timeStyle: "short" }) : "";
  const custom = rules.filter((r) => !presetIds.has(r.id));

  return (
    <Sheet title={t.title} subtitle={t.sub} onClose={onClose}>
      {city.preview || !city.vault ? <Notice tone="warn">{t.preview}</Notice> : (
        <div className="space-y-3">
          {!isMayor && <Notice tone="info">{t.notMayor}</Notice>}
          {loadError && <Notice tone="warn">{loadError}</Notice>}

          <div className="rounded-xl bg-slate-900/[0.04] p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">{t.autopilot}</span>
              {ap?.autopilotIsSessionKey ? <Badge tone="good">{lang === "id" ? "AKTIF" : "ON"}</Badge> : <Badge>{lang === "id" ? "MATI" : "OFF"}</Badge>}
            </div>
            <p className="text-[11px] leading-relaxed text-ink-soft">{!ap?.autopilot ? t.apMissing : ap.autopilotIsSessionKey ? t.apOn(until) : t.apOff}</p>
            {isMayor && ap?.autopilot && (
              <button className="btn btn-ghost mt-2 w-full !py-1.5 text-xs" disabled={busy !== null} onClick={() => void setAutopilot(!ap.autopilotIsSessionKey)}>
                {busy === "ap" ? <Spinner /> : null} {ap.autopilotIsSessionKey ? t.apRevoke : t.apAllow}
              </button>
            )}
            {isMayor && <p className="mt-1 text-[10px] leading-snug text-ink-soft">{t.apNote}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-ink">{t.presets}</div>
            {presets.map((p) => (
              <label key={p.id} className="flex items-start gap-2 rounded-lg px-1 py-1 text-[11px] leading-snug text-ink">
                <input type="checkbox" className="mt-0.5" checked={presetOn(p)} disabled={!isMayor || busy !== null} onChange={() => togglePreset(p)} />
                <span><b>{localizePreset(p, lang).name}.</b> <span className="text-ink-soft">{p.rules.map(describe).join(" · ")}</span></span>
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-ink">{t.mine}</div>
            {custom.length === 0 && <p className="text-[11px] text-ink-soft">{t.none}</p>}
            {custom.map((r) => (
              <div key={r.id} className="flex items-start gap-2 text-[11px] leading-snug">
                <input type="checkbox" className="mt-0.5" checked={r.enabled} disabled={!isMayor} onChange={() => setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)))} />
                <span className="flex-1"><b>{ruleName(r.name, lang)}.</b> <span className="text-ink-soft">{describe(r)}</span></span>
                {isMayor && <button className="text-[11px] font-semibold text-bad hover:underline" onClick={() => setRules((rs) => rs.filter((x) => x.id !== r.id))}>{t.remove}</button>}
              </div>
            ))}
          </div>

          {isMayor && (
            <details className="rounded-xl border border-slate-900/10 p-2.5">
              <summary className="cursor-pointer text-xs font-semibold text-accent">{t.add}</summary>
              <div className="mt-2 space-y-2">
                <Field label={t.when}>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select className={inputCls} value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
                      {(Object.keys(t.metric) as Metric[]).map((m) => <option key={m} value={m}>{t.metric[m]}</option>)}
                    </select>
                    {!["cashPct", "tvl"].includes(metric) ? (
                      <select className={inputCls} value={wService} onChange={(e) => setWService(e.target.value)}>
                        <option value="any">{t.any}</option>
                        {cityServices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    ) : <span />}
                    {metric !== "outOfRange" && (
                      <>
                        <select className={inputCls} value={op} onChange={(e) => setOp(e.target.value as Op)}><option value="<">&lt;</option><option value=">">&gt;</option></select>
                        <div className="flex items-center gap-1"><input className={inputCls} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /><span className="text-xs text-ink-soft">{t.unit[metric]}</span></div>
                      </>
                    )}
                  </div>
                </Field>
                <Field label={t.then}>
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5">
                      {(["move", "tune"] as const).map((a) => <button key={a} type="button" className={cx("btn flex-1 !py-1 text-xs", action === a ? "btn-primary" : "btn-ghost")} onClick={() => setAction(a)}>{a === "move" ? t.move : t.tune}</button>)}
                    </div>
                    {action === "move" ? (
                      <div className="grid grid-cols-3 gap-1.5">
                        <input className={inputCls} inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value)} aria-label="%" />
                        <select className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)}>
                          {["match", "largest", "worst", "cash", ...cityServices.map((s) => s.id)].map((x) => <option key={x} value={x}>{t.from} {nameOf(x)}</option>)}
                        </select>
                        <select className={inputCls} value={to} onChange={(e) => setTo(e.target.value)}>
                          {["cash", "best", ...cityServices.map((s) => s.id)].map((x) => <option key={x} value={x}>{t.to} {nameOf(x)}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        <select className={inputCls} value={tService} onChange={(e) => setTService(e.target.value)}>
                          {cityServices.filter((s) => s.tunable).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select className={inputCls} value={tKind} onChange={(e) => setTKind(e.target.value as typeof tKind)}>
                          <option value="rewards">{t.setRewards}</option><option value="loop">{t.setLoop}</option><option value="range">{t.setRange}</option><option value="recenter">{t.recenter}</option>
                        </select>
                        {tKind === "range" ? (
                          <select className={inputCls} value={tRange} onChange={(e) => setTRange(Number(e.target.value))}>
                            {RANGES.map((r) => <option key={r} value={r}>{r === 0 ? t.full : `±${r / 100}%`}</option>)}
                          </select>
                        ) : tKind === "rewards" ? (
                          <select className={inputCls} value={tValue === "0" ? "0" : "1"} onChange={(e) => setTValue(e.target.value)}><option value="1">{t.on}</option><option value="0">{t.off}</option></select>
                        ) : tKind === "loop" ? <input className={inputCls} inputMode="decimal" value={tValue} onChange={(e) => setTValue(e.target.value)} aria-label="×" placeholder="1.5" /> : null}
                      </div>
                    )}
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-1.5">
                  <Field label={t.name}><input className={inputCls} value={rname} onChange={(e) => setRname(e.target.value)} maxLength={60} /></Field>
                  <Field label={t.wait}><input className={inputCls} inputMode="numeric" value={cooldown} onChange={(e) => setCooldown(e.target.value)} /></Field>
                </div>
                <button type="button" className="btn btn-ghost w-full !py-1.5 text-xs" onClick={addRule}>{t.add}</button>
              </div>
            </details>
          )}

          {error && <Notice tone="error">{error}</Notice>}
          {notice && <Notice tone="good">{notice}</Notice>}
          {isMayor && <button className="btn btn-primary w-full" disabled={busy !== null} onClick={() => void save()}>{busy === "save" ? <Spinner /> : null} {busy === "save" ? t.saving : t.save}</button>}

          <div className="space-y-1">
            <div className="text-xs font-semibold text-ink">{t.log}</div>
            {!ap?.recent?.length ? <p className="text-[11px] text-ink-soft">{t.noLog}</p> : ap.recent.slice(0, 8).map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-[11px] text-ink-soft">
                <span className="truncate">
                  {new Date(a.at * 1000).toLocaleTimeString(lang === "id" ? "id-ID" : "en-US", { hour: "2-digit", minute: "2-digit" })} · {ruleName(rules.find((r) => r.id === a.ruleId)?.name ?? a.ruleId, lang)}: {a.kind === "move" ? `${t.move} ${a.amount ? (Number(a.amount) / 1e6).toFixed(2) : "?"} AUSD ${t.from} ${nameOf(a.fromService ?? a.from)} ${t.to} ${nameOf(a.toService ?? a.to)}` : `${t.tune} ${nameOf(a.service)}`}
                </span>
                {a.hash && <a className="shrink-0 text-accent hover:underline" href={txUrl(a.hash)} target="_blank" rel="noreferrer">tx</a>}
              </div>
            ))}
            {ap?.errors?.slice(0, 2).map((e, i) => <p key={`e${i}`} className="text-[11px] text-bad">{e.error}</p>)}
          </div>
          <p className="text-[10px] leading-snug text-ink-soft">{t.tested}</p>
        </div>
      )}
    </Sheet>
  );
}
