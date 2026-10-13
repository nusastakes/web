"use client";

import { useCallback, useEffect, useState } from "react";
import { guardianAbi } from "@/lib/abis";
import { TX_STEPS, contractTx, type Step } from "@/lib/actions";
import { publicClient } from "@/lib/chain";
import { ADDR } from "@/lib/config";
import { humanError } from "@/lib/errors";
import { fmtAusd } from "@/lib/format";
import { emitChange } from "@/lib/hooks";
import { getAgents, getProposals, getReport, runAnalyst, type AgentInfo, type ProposalInfo } from "@/lib/relayer";
import type { CityView, Hex } from "@/lib/types";
import { useWallet } from "@/lib/wallet";
import StepList from "../StepList";
import { Badge, Notice, Spinner } from "../ui";

/**
 * Bursa staf AI (R18, R20) dan pekerjaan mereka: Satpam (workflow Chainlink CRE, hanya bisa evakuasi ke kas), Analis
 * (mengusulkan, walikota menyetujui satu ketukan), Humas (laporan mingguan). Menyewa dan mencabut adalah ubah izin, jadi
 * selalu dengan ceremony passkey baru. Menyetujui usulan memakai sesi (satu ketukan, PRD R19).
 */

const HIRE_DAYS = 7;
const ZERO = "0x0000000000000000000000000000000000000000";
const roleOf: Record<AgentInfo["id"], string> = { satpam: "Guards the city: pulls money back to the plaza when a protocol looks risky.", analis: "Watches yields and proposes moves; nothing moves until you approve.", humas: "Writes the weekly report for your residents, in Indonesian." };

export default function StaffPanel({ city, onDone }: { city: CityView; onDone: () => void }) {
  const w = useWallet();
  const vault = city.vault as Hex;
  const [agents, setAgents] = useState<AgentInfo[] | null>(null);
  const [hired, setHired] = useState<Record<string, number>>({});
  const [proposals, setProposals] = useState<ProposalInfo[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ key: string; steps: Step[] } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = (await getAgents()).agents;
      setAgents(list);
      const now = Math.floor(Date.now() / 1000);
      const res = await publicClient.multicall({
        allowFailure: true,
        contracts: list.map((a) => ({ address: ADDR.guardian, abi: guardianAbi, functionName: "agents", args: [vault, (a.address ?? ZERO) as Hex] }) as const),
      });
      const map: Record<string, number> = {};
      list.forEach((a, i) => {
        const r = res[i];
        if (r.status === "success") { const [role, expiry] = r.result as readonly [number, bigint]; if (role === a.role && Number(expiry) > now) map[a.id] = Number(expiry); }
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

  const hire = (a: AgentInfo) => run(a.id, `${a.name} hired`, (report) => contractTx(w, {
    address: ADDR.guardian, abi: guardianAbi, functionName: "grantAgent", args: [vault, a.address, a.role, BigInt(Math.floor(Date.now() / 1000) + HIRE_DAYS * 86400)],
  }, { ceremony: true, label: `Confirm hiring ${a.name}…`, report }));
  const fire = (a: AgentInfo) => run(a.id, `${a.name} released`, (report) => contractTx(w, {
    address: ADDR.guardian, abi: guardianAbi, functionName: "revokeAgent", args: [vault, a.address],
  }, { ceremony: true, label: `Confirm releasing ${a.name}…`, report }));
  const approve = (p: ProposalInfo) => run(`p${p.proposalId}`, "Proposal carried out", (report) => contractTx(w, {
    address: ADDR.guardian, abi: guardianAbi, functionName: "approve", args: [vault, BigInt(p.proposalId)],
  }, { ceremony: false, label: "Approve", report }));
  const ask = async () => {
    setError(null); setNote("Asking the Analyst…");
    try {
      let r = await runAnalyst(vault);
      // Tepat setelah menyewa, RPC relayer kadang masih membaca keadaan lama: coba lagi sebentar.
      for (let k = 0; k < 3 && r.status === "not-granted" && hired.analis; k++) {
        await new Promise((res) => setTimeout(res, 3000));
        r = await runAnalyst(vault);
      }
      const msg: Record<string, string> = { proposed: "The Analyst sent a proposal. Approve it below.", "nothing-to-do": "The Analyst sees nothing worth moving right now.", "not-granted": "Hire the Analyst first.", pending: "A proposal is already waiting for you.", cooldown: "The Analyst looked at this city a moment ago. Try again in a few minutes." };
      setNote(msg[r.status] ?? `Analyst: ${r.status}`);
      await load();
    } catch (e) { setNote(null); setError(humanError(e)); }
  };
  const readReport = async () => {
    setReport("…");
    try { const r = await getReport(vault, 7); setReport(typeof r.text === "string" ? r.text.replace(/\*\*/g, "") : String(r.status ?? "No report yet.")); }
    catch { setReport("The weekly report is still being written. Try again in a minute."); }
  };

  if (!agents) return <div className="flex items-center gap-2 text-sm text-ink-soft"><Spinner /> Loading the AI staff market…</div>;
  const pending = proposals.filter((p) => p.status === "pending");

  return (
    <section className="space-y-3">
      <p className="text-xs leading-relaxed text-ink-soft">Hire AI staff for your city. Each one can only do what the contract allows its role; none can move money to a wallet. Hiring lasts {HIRE_DAYS} days.</p>
      <ul className="space-y-2">
        {agents.map((a) => {
          const on = !!hired[a.id];
          return (
            <li key={a.id} className="rounded-xl border border-slate-900/5 bg-white/70 p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">{a.name}</span>
                <span className="flex gap-1">
                  {a.id === "satpam" && <Badge tone="neutral">Chainlink CRE</Badge>}
                  <Badge tone={on ? "good" : "neutral"}>{on ? `Hired until ${new Date(hired[a.id] * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Available"}</Badge>
                </span>
              </div>
              <div className="mt-0.5 text-ink-soft">{roleOf[a.id] ?? a.description}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {a.address ? (on
                  ? <button className="btn btn-ghost !px-2 !py-1 text-[11px]" disabled={!!busy} onClick={() => fire(a)}>Release</button>
                  : <button className="btn btn-primary !px-2.5 !py-1 text-[11px]" disabled={!!busy} onClick={() => hire(a)}>Hire</button>)
                  : <span className="text-[11px] text-ink-soft">Not available on this relayer.</span>}
                {a.id === "analis" && on && <button className="btn btn-ghost !px-2 !py-1 text-[11px]" disabled={!!busy} onClick={ask}>Ask for a proposal now</button>}
                {a.id === "humas" && on && <button className="btn btn-ghost !px-2 !py-1 text-[11px]" onClick={readReport}>Read this week&apos;s report</button>}
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
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Analyst proposals {pending.length ? `· ${pending.length} waiting` : ""}</h3>
          {proposals.slice(0, 5).map((p) => (
            <div key={p.planHash} className="rounded-xl border border-slate-900/5 bg-white/70 p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">{p.plan?.action === "deploy" ? "Plaza → yield district" : p.plan?.action === "withdraw" ? "Yield district → Plaza" : "Move funds"} · {p.plan?.amount ? fmtAusd(Number(p.plan.amount) / 1e6) : "?"} AUSD</span>
                <Badge tone={p.status === "pending" ? "accent" : p.status === "approved" ? "good" : "neutral"}>{p.status}</Badge>
              </div>
              {typeof p.plan?.reason === "string" && <div className="mt-0.5 text-ink-soft">“{p.plan.reason}”</div>}
              {p.status === "pending" && <button className="btn btn-primary mt-2 !px-2.5 !py-1 text-[11px]" disabled={!!busy} onClick={() => approve(p)}>Approve (one tap)</button>}
              {busy?.key === `p${p.proposalId}` && <div className="mt-2"><StepList steps={busy.steps} /></div>}
            </div>
          ))}
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
