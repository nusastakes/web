"use client";

import { APP } from "@/lib/copy-app";
import { useLang } from "@/lib/lang";
import { cityApyBps, hasSimulated, sinceFoundingPct } from "@/lib/city";
import { fmtAusd, fmtBps, fmtPct } from "@/lib/format";
import type { CityView } from "@/lib/types";
import { IconBuilding, IconChart, IconCoins, IconUsers } from "./icons";
import { Stat } from "./ui";

export default function KpiRow({ city }: { city: CityView }) {
  const [lang] = useLang();
  const t = APP[lang].kpi;
  const apy = cityApyBps(city);
  const since = sinceFoundingPct(city);
  return (
    <div className="pointer-events-auto flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
      <Stat icon={<IconCoins />} label={t.assets} value={fmtAusd(city.totalAssets)} unit="AUSD"
        sub={t.districts(city.districts.filter((d) => d.weight > 0).length)} />
      <Stat icon={<IconChart />} label={t.yield} value={apy === null ? "—" : fmtBps(apy)} unit="APY"
        sub={hasSimulated(city) ? t.simulated : apy === null ? t.none : t.protocol} />
      <Stat icon={<IconBuilding />} label={t.price} value={city.sharePrice.toFixed(6)} unit="AUSD"
        sub={`${since >= 0 ? "+" : ""}${fmtPct(since, 4)} ${t.since}`} tone={since > 0 ? "good" : since < 0 ? "bad" : undefined} />
      {city.residents !== undefined
        ? <Stat icon={<IconUsers />} label={t.residents} value={String(city.residents)} sub={t.sample} />
        : <Stat icon={<IconUsers />} label={t.fee} value={fmtBps(city.feeBps)} sub={t.onlyProfit} />}
    </div>
  );
}
