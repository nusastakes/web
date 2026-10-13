"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CATEGORY_KIND, useCatalog, type Service, type ServiceCategory } from "@/lib/catalog";
import { CATALOG_COPY, serviceCopy } from "@/lib/copy-catalog";
import { useLang } from "@/lib/lang";
import { DISTRICT_COLORS } from "@/lib/palette";
import { Badge, cx } from "../ui";

/**
 * Memilih layanan protokol Monad untuk kota (TC67): tiap layanan menjadi satu distrik yang menaruh dana ke cermin protokol
 * itu. APY dan TVL adalah data mainnet langsung; dana kota di testnet tetap AUSD faucet.
 */

/** Batas kontrak per kota (`CityVault.MAX_ADAPTERS`); aplikasi membuka slot bertahap lewat `max` (lib/tier.ts). */
export const MAX_SERVICES = 8;
/** Penyaring jenis dan pencarian baru muncul bila katalog lebih panjang dari ini. */
const FILTER_FROM = 8;
const CATEGORIES: ServiceCategory[] = ["bank", "vault", "staking", "market"];
const usd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`);
const strings = {
  en: { title: "Your city's services", hint: (max: number) => `Each service becomes a district. Pick 1 to ${max}. More variety spreads risk; each service earns the live rate of its protocol.`, apy: "a year", tvl: "on mainnet", flow: "How it earns", risk: "Risk", max: (n: number) => `Up to ${n} services.`, loading: "Loading services…", all: "All", search: "Search protocol or asset", none: "No service matches.", count: (n: number, total: number) => `${n} of ${total} services`, tunable: "Tunable" },
  id: { title: "Layanan kota Anda", hint: (max: number) => `Setiap layanan menjadi satu distrik. Pilih 1 sampai ${max}. Makin beragam makin tersebar risikonya; tiap layanan mendapat imbal hasil langsung dari protokolnya.`, apy: "per tahun", tvl: "di mainnet", flow: "Cara menghasilkan", risk: "Risiko", max: (n: number) => `Maksimal ${n} layanan.`, loading: "Memuat layanan…", all: "Semua", search: "Cari protokol atau aset", none: "Tidak ada layanan yang cocok.", count: (n: number, total: number) => `${n} dari ${total} layanan`, tunable: "Bisa disetel" },
};

export default function ServicePicker({ selected, onChange, disabled, max = MAX_SERVICES, note }: { selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean; max?: number; note?: ReactNode }) {
  const [lang] = useLang();
  const t = strings[lang];
  const c = CATALOG_COPY[lang];
  const { services, ready } = useCatalog();
  const [cat, setCat] = useState<ServiceCategory | "all">("all");
  const [query, setQuery] = useState("");
  const filterable = services.length > FILTER_FROM;
  // Yang sudah dipilih tetap tampil, lalu yang bisa dipilih, lalu yang "Segera hadir".
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = services.filter((s) => selected.includes(s.id) || ((cat === "all" || s.category === cat) && (!q || `${s.name} ${s.protocol}`.toLowerCase().includes(q))));
    const rank = (s: Service) => (selected.includes(s.id) ? 0 : s.impl ? 1 : 2);
    return rows.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map((x) => x.s);
  }, [services, selected, cat, query]);
  const toggle = (s: Service) => {
    if (!s.impl || disabled) return;
    if (selected.includes(s.id)) onChange(selected.filter((x) => x !== s.id));
    else if (selected.length < max) onChange([...selected, s.id]);
  };
  return (
    <div className="space-y-2">
      <div>
        <span className="block text-xs font-medium text-ink-soft">{t.title} · {selected.length}/{max}</span>
        <p className="text-[11px] leading-relaxed text-ink-soft">{t.hint(max)}</p>
        {note && <div className="mt-1 text-[11px] leading-relaxed text-ink-soft">{note}</div>}
      </div>
      {!ready && <p className="text-[11px] text-ink-soft">{t.loading}</p>}
      {filterable && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.title}>
            {(["all", ...CATEGORIES] as const).map((k) => (
              <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)}
                className={cx("rounded-full px-2.5 py-1 text-[11px] font-semibold", cat === k ? "bg-accent text-white" : "bg-slate-900/5 text-ink")}>{k === "all" ? t.all : c.category[k].name}</button>
            ))}
          </div>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} aria-label={t.search} maxLength={40}
            className="w-full rounded-xl border border-slate-900/10 bg-white/80 px-3 py-1.5 text-xs text-ink" />
          <p className="text-[11px] text-ink-soft">{t.count(shown.length, services.length)}</p>
        </div>
      )}
      {filterable && shown.length === 0 && <p className="text-[11px] text-ink-soft">{t.none}</p>}
      <ul className={cx("space-y-1.5", filterable && "max-h-[26rem] overflow-y-auto pr-1")}>
        {shown.map((s) => {
          const on = selected.includes(s.id);
          const color = DISTRICT_COLORS[CATEGORY_KIND[s.category]];
          const copy = serviceCopy(lang, s.id, s.category, s);
          const locked = !s.impl;
          const full = !on && selected.length >= max;
          const tunable = !!(s.knobs && (s.knobs.rewards || s.knobs.range || s.knobs.loop?.allowed));
          return (
            <li key={s.id}>
              <div className={cx("rounded-xl border p-2.5 text-xs transition", on ? "border-accent bg-accent-soft/50" : "border-slate-900/10 bg-white/70", locked || full ? "opacity-60" : "")}>
                <button type="button" onClick={() => toggle(s)} disabled={disabled || locked || full} aria-pressed={on} className="flex w-full items-start gap-2 text-left disabled:cursor-not-allowed">
                  <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-sm border-2" style={{ borderColor: color, background: on ? color : "transparent" }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-ink">{s.name}</span>
                      <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: color }}>{c.category[s.category].name}</span>
                      {locked && <Badge tone="neutral">{c.soon}</Badge>}
                      {!locked && tunable && <Badge tone="accent">{t.tunable}</Badge>}
                    </span>
                    <span className="mt-0.5 block text-ink-soft">{copy.blurb}</span>
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                      <span className="font-semibold text-ink">{s.apyBps === null ? "—" : `${(s.apyBps / 100).toFixed(2)}%`} <span className="font-normal text-ink-soft">{t.apy}</span></span>
                      {s.tvlUsd !== null && <span className="text-ink-soft">{usd(s.tvlUsd)} {t.tvl}</span>}
                      <span className="text-ink-soft">{s.live ? c.live : c.snapshot}</span>
                    </span>
                  </span>
                </button>
                <details className="ml-5 mt-1 text-[11px] leading-relaxed text-ink-soft">
                  <summary className="cursor-pointer font-medium text-accent">{t.flow}</summary>
                  <p className="mt-1">{copy.flow}</p>
                  <p className="mt-1"><b className="text-ink">{t.risk}:</b> {copy.risk}</p>
                </details>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-ink-soft">{c.mirror}. {t.max(max)}</p>
    </div>
  );
}
