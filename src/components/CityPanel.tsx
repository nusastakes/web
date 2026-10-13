"use client";

import { useState } from "react";
import { getReport } from "@/lib/relayer";
import { useNowSeconds } from "@/lib/hooks";
import { addressUrl } from "@/lib/config";
import { fmtAusd, fmtBps, shortAddr, timeAgo } from "@/lib/format";
import { DISTRICT_COLORS } from "@/lib/palette";
import type { CityView, District, Hex } from "@/lib/types";
import { IconCopy, IconExternal, IconInfo } from "./icons";
import { Badge, Card, cx } from "./ui";

interface Props {
  city: CityView;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  me?: Hex;
}

function Row({ d, active, onClick }: { d: District; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cx("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition", active ? "bg-accent-soft" : "hover:bg-slate-900/5")}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DISTRICT_COLORS[d.kind] }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{d.label}</span>
        <span className="block truncate text-[11px] text-ink-soft">{d.protocol ?? (d.kind === "idle" ? "Not placed anywhere" : "")}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-semibold text-ink">{d.weight > 0 ? `${(d.weight * 100).toFixed(d.weight < 0.1 ? 1 : 0)}%` : "empty"}</span>
        <span className="block text-[11px] text-ink-soft">{fmtAusd(d.assets)}</span>
      </span>
    </button>
  );
}

export default function CityPanel({ city, selectedId, onSelect, me }: Props) {
  const [copied, setCopied] = useState(false);
  const selected = city.districts.find((d) => d.id === selectedId) ?? null;
  const isMayor = me && city.mayor && me.toLowerCase() === city.mayor.toLowerCase();
  const nowSec = useNowSeconds();
  const [report, setReport] = useState<{ city: string; text: string } | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const readReport = async () => {
    if (!city.vault) return;
    if (report?.city === city.vault) { setReport(null); return; }
    setLoadingReport(true);
    try {
      const r = await getReport(city.vault, 7);
      const text = typeof r.text === "string" ? r.text.replace(/\*\*/g, "")
        : r.status === "not-hired" ? "This city has no Humas yet. The mayor can hire one in the city hall." : "No report yet.";
      setReport({ city: city.vault, text });
    } catch {
      // Laporan ditulis ulang oleh LLM di relayer; permintaan pertama bisa lama dan terputus di proxy.
      setReport({ city: city.vault, text: "The weekly report is still being written. Try again in a minute." });
    }
    finally { setLoadingReport(false); }
  };

  return (
    <Card className="pointer-events-auto flex max-h-full w-full flex-col overflow-hidden max-sm:bg-white/97! sm:w-[340px]">
      <div className="space-y-2 border-b border-slate-900/5 px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-ink">{city.name}</h1>
            <p className="truncate text-xs text-ink-soft">{city.community || "No community"}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {city.preview ? <Badge tone="warn">Preview · sample data</Badge> : <Badge tone="good">Live</Badge>}
            {isMayor && <Badge tone="accent">You are the mayor</Badge>}
          </div>
        </div>
        {city.mayor && (
          <div className="flex items-center gap-2 text-xs text-ink-soft">
            Mayor
            <span className="font-mono text-ink">{shortAddr(city.mayor)}</span>
            <button aria-label="Copy mayor address" className="hover:text-ink" onClick={() => { navigator.clipboard?.writeText(city.mayor!); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>
              <IconCopy width={13} height={13} />
            </button>
            {copied && <span className="text-good">Copied</span>}
            {city.vault && <a className="ml-auto inline-flex items-center gap-1 hover:text-ink" href={addressUrl(city.vault)} target="_blank" rel="noreferrer">Vault <IconExternal width={12} height={12} /></a>}
          </div>
        )}
      </div>

      <div className="overflow-y-auto px-3 py-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Where the money is</h2>
          {selected && <button className="text-xs font-medium text-accent" onClick={() => onSelect(null)}>Show all</button>}
        </div>
        <div className="mx-1 mb-2 flex h-2.5 overflow-hidden rounded-full bg-slate-900/5">
          {city.districts.filter((d) => d.weight > 0).map((d) => (
            <button key={d.id} aria-label={d.label} onClick={() => onSelect(d.id)} className="h-full transition-opacity hover:opacity-80"
              style={{ width: `${d.weight * 100}%`, background: DISTRICT_COLORS[d.kind], opacity: selected && selected.id !== d.id ? 0.35 : 1 }} />
          ))}
        </div>
        <div className="space-y-0.5">
          {city.districts.map((d) => <Row key={d.id} d={d} active={d.id === selectedId} onClick={() => onSelect(d.id === selectedId ? null : d.id)} />)}
        </div>

        {selected && (
          <div className="mt-3 space-y-2 rounded-xl bg-slate-900/[0.04] p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">{selected.label}</span>
              {selected.simulated ? <Badge tone="warn">Simulated</Badge> : selected.kind === "idle" ? <Badge>Idle</Badge> : <Badge tone="good">Live protocol</Badge>}
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div><dt className="text-[11px] text-ink-soft">Funds</dt><dd className="text-sm font-semibold">{fmtAusd(selected.assets)}</dd></div>
              <div><dt className="text-[11px] text-ink-soft">Share</dt><dd className="text-sm font-semibold">{(selected.weight * 100).toFixed(1)}%</dd></div>
              <div><dt className="text-[11px] text-ink-soft">APY</dt><dd className="text-sm font-semibold">{selected.apyBps === null ? "—" : fmtBps(selected.apyBps)}</dd></div>
            </dl>
            {selected.simulated && (
              <p className="flex gap-2 text-[11px] leading-relaxed text-ink-soft">
                <IconInfo width={14} height={14} className="mt-0.5 shrink-0" />
                <span>Testnet has no lending protocol that accepts AUSD, so nothing is lent here. This district earns the live APY of <strong>{selected.protocol}</strong>, paid from a testnet reserve. The real protocol is used on mainnet.</span>
              </p>
            )}
            {selected.kind === "idle" && <p className="text-[11px] leading-relaxed text-ink-soft">The plaza holds funds that the mayor has not placed anywhere. They earn nothing and can be withdrawn at any time.</p>}
          </div>
        )}
      </div>

      {!city.preview && city.vault && (
        <div className="border-t border-slate-900/5 px-4 py-2">
          <button onClick={readReport} className="text-xs font-semibold text-accent hover:underline" disabled={loadingReport}>
            {loadingReport ? "Loading the weekly report…" : report?.city === city.vault ? "Hide the weekly report" : "Read the weekly report (Humas)"}
          </button>
          {report?.city === city.vault && <div className="mt-1.5 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-900/[0.04] p-2 text-[11px] leading-relaxed text-ink">{report.text}</div>}
        </div>
      )}

      <div className="border-t border-slate-900/5 px-4 py-2.5 text-[11px] leading-relaxed text-ink-soft">
        The mayor keeps <strong className="text-ink">{fmtBps(city.feeBps)}</strong> of profit only, and can never move funds to their own wallet.
        {city.createdAt && nowSec > 0 && <span> Founded {timeAgo(nowSec - city.createdAt)}.</span>}
      </div>
    </Card>
  );
}
