"use client";

import { useCallback, useEffect, useState } from "react";
import { guardianAbi } from "@/lib/abis";
import { TX_STEPS, contractTx, hireFlow, type Step } from "@/lib/actions";
import { publicClient } from "@/lib/chain";
import { ADDR } from "@/lib/config";
import { MAYOR } from "@/lib/copy-mayor";
import { humanError } from "@/lib/errors";
import { fmtAusd } from "@/lib/format";
import { emitChange } from "@/lib/hooks";
import { useLang } from "@/lib/lang";
import { getMarketplace, getProposals, getReport, runAnalyst, type MarketAgent, type ProposalInfo } from "@/lib/relayer";
import type { CityView, Hex } from "@/lib/types";
import { useWallet } from "@/lib/wallet";
import StepList from "../StepList";
import { Badge, Notice, Spinner } from "../ui";

/**
 * Bursa staf AI (R18, R20) dan pekerjaan mereka: Satpam (workflow Chainlink CRE, hanya bisa evakuasi ke kas), Analis
 * (mengusulkan, walikota menyetujui satu ketukan), Humas (laporan mingguan), dan agen komunitas. Di kontrak v3 staf
 * berbayar disewa lewat AgentMarketplace (satu ceremony: permit AUSD lalu `hireWithPermit`); Satpam tetap lewat
 * `grantAgent` ke alamat penanda. Menyewa dan mencabut adalah ubah izin, jadi selalu dengan ceremony passkey baru.
 * Menyetujui usulan memakai sesi (satu ketukan, PRD R19). Teks agen komunitas tidak tepercaya: hanya teks biasa.
 */

const HIRE_DAYS = 7;
const ZERO = "0x0000000000000000000000000000000000000000";

export default function StaffPanel({ city, onDone }: { city: CityView; onDone: () => void }) {
  const w = useWallet();
  const [lang] = useLang();
  const t = MAYOR[lang].staff;
  const vault = city.vault as Hex;
  const [agents, setAgents] = useState<MarketAgent[] | null>(null);
  const [hired, setHired] = useState<Record<string, number>>({});
  const [proposals, setProposals] = useState<ProposalInfo[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ key: string; steps: Step[] } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = (await getMarketplace(vault)).agents;
      setAgents(list);
      const now = Math.floor(Date.now() / 1000);
      const res = await publicClient.multicall({
        allowFailure: true,
        contracts: list.map((a) => ({ address: ADDR.guardian, abi: guardianAbi, functionName: "agents", args: [vault, (a.wallet ?? ZERO) as Hex] }) as const),
      });
      const map: Record<string, number> = {};
      list.forEach((a, i) => {
        const r = res[i];
        if (r.status === "success") { const [role, expiry] = r.result as readonly [number, bigint]; if (role === a.roleId && Number(expiry) > now) map[a.id] = Number(expiry); }
      });
      setHired(map);
      setProposals((await getProposals(vault).catch(() => ({ proposals: [] as ProposalInfo[] }))).proposals);
    } catch (e) { setError(humanError(e)); }
  }, [vault]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; };
  }, [load]);

  const run = async (key: string, label: string, fn: (report: (id: string, p: Partial<Step>) => void) => Promise<unknown>) => {
    setError(null); setNote(null);
    setBusy({ key, steps: TX_STEPS(label) });
    const report = (id: string, patch: Partial<Step>) => setBusy((b) => (b ? { ...b, steps: b.steps.map((x) => (x.id === id ? { ...x, ...patch } : x)) } : b));
    try { await fn(report); emitChange(); await load(); onDone(); setBusy(null); }
    catch (e) { setError(humanError(e)); setBusy((b) => (b ? { ...b, steps: b.steps.map((x) => (x.state === "active" ? { ...x, state: "error" } : x)) } : b)); }
  };

  const hire = (a: MarketAgent) => run(a.id, `${a.name} hired`, (report) => {
    if (a.hireVia) {
      if (!w.address) throw new Error("Sign in first.");
      return hireFlow({ wallet: w, owner: w.address, offer: a.hireVia, name: a.name, report });
    }
    return contractTx(w, {
      address: ADDR.guardian, abi: guardianAbi, functionName: "grantAgent", args: [vault, a.wallet, a.roleId, BigInt(Math.floor(Date.now() / 1000) + HIRE_DAYS * 86400)],
    }, { ceremony: true, label: `Confirm hiring ${a.name}…`, report });
  });
  const fire = (a: MarketAgent) => run(a.id, `${a.name} released`, (report) => contractTx(w, {
    address: ADDR.guardian, abi: guardianAbi, functionName: "revokeAgent", args: [vault, a.wallet],
  }, { ceremony: true, label: `Confirm releasing ${a.name}…`, report }));
  const approve = (p: ProposalInfo) => run(`p${p.proposalId}`, "Proposal carried out", (report) => contractTx(w, {
    address: ADDR.guardian, abi: guardianAbi, functionName: "approve", args: [vault, BigInt(p.proposalId)],
  }, { ceremony: false, label: "Approve", report }));
  const ask = async () => {
    setError(null); setNote(t.asking);
    try {
      let r = await runAnalyst(vault);
      // Tepat setelah menyewa, RPC relayer kadang masih membaca keadaan lama: coba lagi sebentar.
      for (let k = 0; k < 3 && r.status === "not-granted" && hired.analis; k++) {
        await new Promise((res) => setTimeout(res, 3000));
        r = await runAnalyst(vault);
      }
      setNote(t.msgs[r.status] ?? `${t.analyst}: ${r.status}`);
      await load();
    } catch (e) { setNote(null); setError(humanError(e)); }
  };
  const readReport = async () => {
    setReport("…");
    try { const r = await getReport(vault, 7); setReport(typeof r.text === "string" ? r.text.replace(/\*\*/g, "") : String(r.status ?? t.noReport)); }
    catch { setReport(t.writing); }
  };

  if (!agents) return <div className="flex items-center gap-2 text-sm text-ink-soft"><Spinner /> {t.loading}</div>;
  const pending = proposals.filter((p) => p.status === "pending");

  return (
    <section className="space-y-3">
      <p className="text-xs leading-relaxed text-ink-soft">{t.intro(HIRE_DAYS)}</p>
      <ul className="space-y-2">
        {agents.map((a) => {
          const on = !!hired[a.id];
          const team = a.source === "team";
          const canHire = !!a.wallet && a.hireable && !!(a.hireVia || a.hire);
          const price = a.hireVia ? Number(a.hireVia.price) / 1e6 : 0;
          return (
            <li key={a.id} className="rounded-xl border border-slate-900/5 bg-white/70 p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">{a.name}</span>
                <span className="flex gap-1">
                  {a.id === "satpam" && <Badge tone="neutral">Chainlink CRE</Badge>}
                  {!team && <Badge tone="accent">{t.community}</Badge>}
                  <Badge tone={on ? "good" : "neutral"}>{on ? t.hiredUntil(new Date(hired[a.id] * 1000).toLocaleDateString(MAYOR[lang].locale, { day: "numeric", month: "short" })) : t.available}</Badge>
                </span>
              </div>
              <div className="mt-0.5 text-ink-soft">{team ? (t.roles[a.id] ?? a.description) : a.description.slice(0, 200)}</div>
              {a.erc8004 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {/* Tautan ke berkas registrasi hanya untuk staf tim (https); teks agen komunitas tidak dipercaya, jadi hanya teks. */}
                  {team && a.erc8004.agentURI?.startsWith("https://")
                    ? <a href={a.erc8004.agentURI} target="_blank" rel="noreferrer noopener" title={t.ercTitle(a.erc8004.registry ?? "")}><Badge tone="accent">{t.erc(String(a.erc8004.agentId))}</Badge></a>
                    : <span title={t.ercTitle(a.erc8004.registry ?? "")}><Badge tone="accent">{t.erc(String(a.erc8004.agentId))}</Badge></span>}
                  <Badge tone={a.reputation && a.reputation.count > 0 ? (team && a.reputation.clients <= 1 ? "warn" : "good") : "neutral"}>
                    {!a.reputation || a.reputation.count === 0 || a.reputation.average === null ? t.noRating
                      : team && a.reputation.clients <= 1 ? t.ratingSeed(Math.round(a.reputation.average), a.reputation.count)
                      : t.rating(Math.round(a.reputation.average), a.reputation.count)}
                  </Badge>
                </div>
              )}
              {a.hireVia && <div className="mt-0.5 font-medium text-ink">{price > 0 ? t.perWeek(fmtAusd(price)) : t.free}</div>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {on
                  ? <button className="btn btn-ghost !px-2 !py-1 text-[11px]" disabled={!!busy} onClick={() => fire(a)}>{t.release}</button>
                  : canHire
                    ? <button className="btn btn-primary !px-2.5 !py-1 text-[11px]" disabled={!!busy} onClick={() => hire(a)}>{t.hire}</button>
                    : <span className="text-[11px] text-ink-soft">{t.na}</span>}
                {a.id === "analis" && on && <button className="btn btn-ghost !px-2 !py-1 text-[11px]" disabled={!!busy} onClick={ask}>{t.ask}</button>}
                {a.id === "humas" && on && <button className="btn btn-ghost !px-2 !py-1 text-[11px]" onClick={readReport}>{t.readReport}</button>}
              </div>
              {busy?.key === a.id && <div className="mt-2"><StepList steps={busy.steps} /></div>}
              {a.id === "humas" && report && <div className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-900/[0.04] p-2 text-[11px] text-ink">{report}</div>}
            </li>
          );
        })}
      </ul>
      {note && <Notice tone="info">{note}</Notice>}
      {proposals.length > 0 && (
        <div className="space-y-2 border-t border-slate-900/5 pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.proposals(pending.length)}</h3>
          {proposals.slice(0, 5).map((p) => (
            <div key={p.planHash} className="rounded-xl border border-slate-900/5 bg-white/70 p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">{p.plan?.action === "deploy" ? t.deploy : p.plan?.action === "withdraw" ? t.withdraw : t.move} · {p.plan?.amount ? fmtAusd(Number(p.plan.amount) / 1e6) : "?"} AUSD</span>
                <Badge tone={p.status === "pending" ? "accent" : p.status === "approved" ? "good" : "neutral"}>{t.status[p.status] ?? p.status}</Badge>
              </div>
              {typeof p.plan?.reason === "string" && <div className="mt-0.5 text-ink-soft">“{p.plan.reason}”</div>}
              {p.status === "pending" && <button className="btn btn-primary mt-2 !px-2.5 !py-1 text-[11px]" disabled={!!busy} onClick={() => approve(p)}>{t.approve}</button>}
              {busy?.key === `p${p.proposalId}` && <div className="mt-2"><StepList steps={busy.steps} /></div>}
            </div>
          ))}
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
