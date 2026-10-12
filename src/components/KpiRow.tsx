"use client";

import { cityApyBps, hasSimulated, sinceFoundingPct } from "@/lib/city";
import { fmtAusd, fmtBps, fmtPct } from "@/lib/format";
import type { CityView } from "@/lib/types";
import { IconBuilding, IconChart, IconCoins, IconUsers } from "./icons";
import { Stat } from "./ui";

export default function KpiRow({ city }: { city: CityView }) {
  const apy = cityApyBps(city);
  const since = sinceFoundingPct(city);
  return (
    <div className="pointer-events-auto flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
      <Stat icon={<IconCoins />} label="Total assets" value={fmtAusd(city.totalAssets)} unit="AUSD"
        sub={`${city.districts.filter((d) => d.weight > 0).length} district${city.districts.filter((d) => d.weight > 0).length === 1 ? "" : "s"}`} />
      <Stat icon={<IconChart />} label="Yield" value={apy === null ? "—" : fmtBps(apy)} unit="APY"
        sub={hasSimulated(city) ? "Simulated · mirrors mainnet" : apy === null ? "No funds placed yet" : "From the protocol"} />
      <Stat icon={<IconBuilding />} label="Share price" value={city.sharePrice.toFixed(6)} unit="AUSD"
        sub={`${since >= 0 ? "+" : ""}${fmtPct(since, 4)} since founding`} tone={since > 0 ? "good" : since < 0 ? "bad" : undefined} />
      {city.residents !== undefined
        ? <Stat icon={<IconUsers />} label="Residents" value={String(city.residents)} sub="Sample data" />
        : <Stat icon={<IconUsers />} label="Mayor fee" value={fmtBps(city.feeBps)} sub="Only on profit" />}
    </div>
  );
}
