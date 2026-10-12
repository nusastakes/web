"use client";

import { useState } from "react";
import brand from "@/lib/brand.json";
import { fmtAusd } from "@/lib/format";
import type { CityView } from "@/lib/types";
import AccountMenu from "./AccountMenu";
import { IconChevron, IconLogo } from "./icons";
import { Badge, Card } from "./ui";

interface Props {
  cities: CityView[];
  preview: CityView[];
  current?: CityView;
  onPick: (id: string) => void;
  onAfterAccountChange: () => void;
}

export default function TopBar({ cities, preview, current, onPick, onAfterAccountChange }: Props) {
  const [open, setOpen] = useState(false);
  const row = (c: CityView) => (
    <button key={c.id} onClick={() => { onPick(c.id); setOpen(false); }}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-900/5">
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink">{c.name}</span>
        <span className="block truncate text-[11px] text-ink-soft">{c.community || "—"}</span>
      </span>
      <span className="shrink-0 text-right text-xs font-medium text-ink-soft">{fmtAusd(c.totalAssets)} AUSD</span>
    </button>
  );
  return (
    <Card className="pointer-events-auto flex h-14 items-center justify-between gap-3 px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-center gap-2 text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white"><IconLogo width={18} height={18} /></span>
          <span className="hidden text-[15px] font-semibold tracking-tight sm:block">{brand.name}</span>
        </div>
        <div className="relative min-w-0">
          <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-900/10 bg-white/70 px-3 py-1.5 text-sm font-medium text-ink hover:bg-white">
            <span className="truncate">{current?.name ?? "Choose a city"}</span>
            {current?.preview && <Badge tone="warn">Preview</Badge>}
            <IconChevron width={15} height={15} className="shrink-0 text-ink-soft" />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <Card solid className="absolute left-0 top-11 z-20 max-h-[60dvh] w-[min(340px,calc(100vw-2rem))] overflow-y-auto p-2">
                {cities.length > 0 && <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Live on Monad testnet</div>}
                {cities.map(row)}
                {cities.length === 0 && <div className="px-3 py-2 text-xs text-ink-soft">No live cities yet. Found the first one.</div>}
                <div className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Preview · sample data</div>
                {preview.map(row)}
              </Card>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 md:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Monad testnet
        </span>
        <AccountMenu onAfterChange={onAfterAccountChange} />
      </div>
    </Card>
  );
}
