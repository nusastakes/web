"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtAusd, shortAddr } from "@/lib/format";
import { getEconomy, getLeaderboard, getMetrics, type LeaderRow } from "@/lib/relayer";
import type { Hex } from "@/lib/types";
import { Badge, Notice, Sheet, Spinner, cx } from "../ui";

/**
 * Papan peringkat kota (R12), laporan ekonomi Monad (R13), dan filter komunitas (R14). Angka kota dari pencatat event
 * onchain di relayer; angka ekonomi dari DefiLlama dengan sumber dan tanggal.
 */

interface Economy {
  source: string; sourceUrl: string; fetchedAt: number; note: string; stale?: boolean;
  totals: { fees24h: number; fees7d: number; fees30d: number };
  sectors: { sector: string; fees24h: number; fees7d: number; fees30d: number; protocols: number; top: { name: string; fees24h: number; fees30d: number }[] }[];
}
interface Metrics { cities: number; mayors: number; residents: number; tvl: string; deposits: number; withdrawals: number }

const usd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : `$${Math.round(n)}`);
const HIDDEN = /\(ignore\)/i;

export default function ExploreSheet({ onClose, onPick, me }: { onClose: () => void; onPick: (vault: string) => void; me?: Hex }) {
  const [tab, setTab] = useState<"rank" | "economy">("rank");
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [minTvl, setMinTvl] = useState<string>("0");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [eco, setEco] = useState<Economy | null>(null);
  const [community, setCommunity] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const showAll = typeof location !== "undefined" && new URLSearchParams(location.search).has("all");

  useEffect(() => {
    let cancelled = false;
    getLeaderboard().then((r) => { if (!cancelled) { setRows(r.cities); setMinTvl(r.minRankedTvl); } }).catch((e) => !cancelled && setError(String(e?.message ?? e)));
    getMetrics().then((m) => !cancelled && setMetrics(m as unknown as Metrics)).catch(() => undefined);
    getEconomy().then((e) => !cancelled && setEco(e as unknown as Economy)).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => (rows ?? []).filter((r) => showAll || !HIDDEN.test(r.name)), [rows, showAll]);
  const communities = useMemo(() => [...new Set(visible.map((r) => r.community).filter(Boolean))].sort(), [visible]);
  const list = community ? visible.filter((r) => r.community === community) : visible;

  return (
    <Sheet title="Explore cities" subtitle="Ranked by residents' return since founding, from on-chain events." onClose={onClose}>
      <div className="space-y-3">
        <div className="flex gap-1 rounded-xl bg-slate-900/5 p-1" role="tablist">
          {(["rank", "economy"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cx("flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold", tab === k ? "bg-white text-ink shadow-sm" : "text-ink-soft")}>
              {k === "rank" ? "Leaderboard" : "Monad economy"}
            </button>
          ))}
        </div>

        {tab === "rank" && (
          <>
            {metrics && (
              <div className="grid grid-cols-4 gap-1.5 text-center text-[10.5px] text-ink-soft">
                <div className="rounded-lg bg-slate-900/[0.04] p-1.5"><b className="block text-sm text-ink">{metrics.cities}</b>cities</div>
                <div className="rounded-lg bg-slate-900/[0.04] p-1.5"><b className="block text-sm text-ink">{metrics.mayors}</b>mayors</div>
                <div className="rounded-lg bg-slate-900/[0.04] p-1.5"><b className="block text-sm text-ink">{metrics.residents}</b>residents</div>
                <div className="rounded-lg bg-slate-900/[0.04] p-1.5"><b className="block text-sm text-ink">{fmtAusd(Number(metrics.tvl) / 1e6)}</b>AUSD</div>
              </div>
            )}
            {communities.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setCommunity("")} className={cx("rounded-full px-2.5 py-1 text-[11px] font-semibold", !community ? "bg-accent text-white" : "bg-slate-900/5 text-ink")}>All communities</button>
                {communities.map((c) => (
                  <button key={c} onClick={() => setCommunity(c)} className={cx("rounded-full px-2.5 py-1 text-[11px] font-semibold", community === c ? "bg-accent text-white" : "bg-slate-900/5 text-ink")}>{c}</button>
                ))}
              </div>
            )}
            {!rows && !error && <div className="flex items-center gap-2 text-sm text-ink-soft"><Spinner /> Reading the city index…</div>}
            <ol className="space-y-1.5">
              {list.map((r) => (
                <li key={r.vault}>
                  <button onClick={() => { onPick(r.vault); onClose(); }} className="flex w-full items-center gap-2.5 rounded-xl border border-slate-900/5 bg-white/70 px-2.5 py-2 text-left hover:bg-white">
                    <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold", r.ranked ? "bg-accent-soft text-accent" : "bg-slate-900/5 text-ink-soft")}>{r.ranked ? r.rank : "–"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{r.name}{me && r.mayor.toLowerCase() === me.toLowerCase() ? " · yours" : ""}</span>
                      <span className="block truncate text-[11px] text-ink-soft">{r.community || "No community"} · mayor {shortAddr(r.mayor)} · {r.residents} resident{r.residents === 1 ? "" : "s"}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={cx("block text-xs font-semibold", r.returnBps > 0 ? "text-good" : r.returnBps < 0 ? "text-bad" : "text-ink")}>{(r.returnBps / 100).toFixed(2)}%</span>
                      <span className="block text-[11px] text-ink-soft">{fmtAusd(Number(r.tvl) / 1e6)} AUSD</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {rows && list.length === 0 && <Notice tone="info">No cities in this community yet.</Notice>}
            <p className="text-[10.5px] text-ink-soft/80">Cities with less than {fmtAusd(Number(minTvl) / 1e6)} AUSD are listed but not ranked. Return is the change in share price since founding; yield on testnet is simulated.</p>
          </>
        )}

        {tab === "economy" && (
          !eco ? <div className="flex items-center gap-2 text-sm text-ink-soft"><Spinner /> Reading DefiLlama…</div> : (
            <>
              <div className="grid grid-cols-3 gap-1.5 text-center text-[10.5px] text-ink-soft">
                <div className="rounded-lg bg-slate-900/[0.04] p-1.5"><b className="block text-sm text-ink">{usd(eco.totals.fees24h)}</b>fees 24h</div>
                <div className="rounded-lg bg-slate-900/[0.04] p-1.5"><b className="block text-sm text-ink">{usd(eco.totals.fees7d)}</b>fees 7d</div>
                <div className="rounded-lg bg-slate-900/[0.04] p-1.5"><b className="block text-sm text-ink">{usd(eco.totals.fees30d)}</b>fees 30d</div>
              </div>
              <ul className="space-y-1.5">
                {eco.sectors.slice(0, 8).map((s) => (
                  <li key={s.sector} className="rounded-xl border border-slate-900/5 bg-white/70 px-2.5 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{s.sector}</span>
                      <span className="text-ink-soft">{usd(s.fees24h)} / 24h · {usd(s.fees30d)} / 30d</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-900/5">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (s.fees30d / Math.max(1, eco.sectors[0].fees30d)) * 100)}%` }} />
                    </div>
                    <div className="mt-1 truncate text-[11px] text-ink-soft">{s.protocols} protocols · top: {s.top.slice(0, 3).map((t) => t.name).join(", ")}</div>
                  </li>
                ))}
              </ul>
              <p className="text-[10.5px] leading-snug text-ink-soft/80">
                {eco.note} Source: <a className="text-accent hover:underline" href={eco.sourceUrl} target="_blank" rel="noreferrer">{eco.source}</a>, fetched {new Date(eco.fetchedAt * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.{eco.stale ? " The figures are stale." : ""}
              </p>
              <Badge tone="neutral">Mainnet data, for the mayor&apos;s decisions</Badge>
            </>
          )
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Sheet>
  );
}
