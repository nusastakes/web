"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCityActivity } from "@/lib/activity";
import { useCityStyle } from "@/lib/style";
import { useCities } from "@/lib/hooks";
import { PREVIEW_CITIES } from "@/lib/preview";
import { WalletProvider, useWallet } from "@/lib/wallet";
import ActionDock, { type SheetKind } from "./ActionDock";
import CityPanel from "./CityPanel";
import KpiRow from "./KpiRow";
import TopBar from "./TopBar";
import DepositSheet from "./sheets/DepositSheet";
import FoundCitySheet from "./sheets/FoundCitySheet";
import ManageSheet from "./sheets/ManageSheet";
import WithdrawSheet from "./sheets/WithdrawSheet";

import type { CityTick, SceneApi } from "./CityCanvas";
import { InspectCard, LifeClock } from "./LifeHud";
import type { Inspect } from "@/lib/scene/life";

const CityCanvas = dynamic(() => import("./CityCanvas"), { ssr: false });

function Shell() {
  const wallet = useWallet();
  const { cities, refresh } = useCities();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [districtId, setDistrictId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [recenter, setRecenter] = useState(0);

  const all = useMemo(() => [...cities, ...PREVIEW_CITIES], [cities]);
  const current = all.find((c) => c.id === pickedId) ?? cities[0] ?? PREVIEW_CITIES[0];

  const isMayor = wallet.status === "ready" && !!current.mayor && current.mayor.toLowerCase() === wallet.address?.toLowerCase();

  // Kota hidup: kejadian onchain menjadi truk, kerumunan, dan pin di kota 3D.
  const sceneApi = useRef<SceneApi | null>(null);
  const [api, setApi] = useState<SceneApi | null>(null);
  const onScene = useCallback((x: SceneApi | null) => { sceneApi.current = x; setApi(x); }, []);
  const [tick, setTick] = useState<CityTick | null>(null);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [speed, setSpeed] = useState(16);
  useCityActivity(current.vault, useCallback((e) => sceneApi.current?.emit(e), []));
  const tvl = current.totalAssets;
  useEffect(() => {
    // Makin besar dana kota, makin ramai jalannya (skala log).
    sceneApi.current?.setActivity(0.45 + 0.75 * Math.min(1, Math.log10(1 + tvl) / 5.5));
  }, [tvl, current.mapId]);
  useEffect(() => {
    // Kota contoh hidup sendiri dengan kejadian contoh, supaya layar pertama tidak kosong.
    if (!current.preview) return;
    const script: Parameters<NonNullable<typeof sceneApi.current>["emit"]>[0][] = [
      { type: "transfer", from: "idle", to: "lend", amount: 1200 },
      { type: "deposit", amount: 500 },
      { type: "festival", at: "vault", label: "Sample event" },
      { type: "transfer", from: "lend", to: "vault", amount: 800 },
      { type: "harvest", amount: 12.4 },
      { type: "withdraw", amount: 300 },
    ];
    let i = 0;
    const first = window.setTimeout(() => sceneApi.current?.emit(script[i++ % script.length]), 3000);
    const id = window.setInterval(() => sceneApi.current?.emit(script[i++ % script.length]), 11000);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, [current.preview, current.id]);

  const { style, code: styleCode, save: saveStyle } = useCityStyle(current.vault ?? current.id);

  const pick = useCallback((id: string) => { setPickedId(id); setDistrictId(null); }, []);
  const open = (k: Exclude<SheetKind, null>) => { setSheet((s) => (s === k ? null : k)); setMobilePanel(false); };

  return (
    <main className="fixed inset-0 overflow-hidden">
      <CityCanvas mapId={current.mapId} districts={current.districts} selectedId={districtId} onSelect={setDistrictId} resetSignal={recenter} onScene={onScene} style={style} onTick={setTick} onInspect={setInspect} cityName={current.name} />

      <div className="pointer-events-none absolute inset-x-3 top-3 sm:inset-x-4 sm:top-4">
        <TopBar cities={cities} preview={PREVIEW_CITIES} current={current} onPick={pick} onAfterAccountChange={refresh} />
      </div>

      {/* Tengah: KPI di kiri, panel kota di kanan. Posisinya tetap; sheet di bawah tidak menekannya. */}
      <div className="pointer-events-none absolute inset-x-3 bottom-24 top-[4.75rem] flex justify-between gap-3 sm:inset-x-4 sm:top-[5.25rem]">
        <div className="min-w-0 flex-1"><KpiRow city={current} /></div>
        <div className="hidden max-h-full min-h-0 md:block"><CityPanel city={current} selectedId={districtId} onSelect={setDistrictId} me={wallet.address} /></div>
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col items-center gap-3 sm:inset-x-4 sm:bottom-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:w-auto">
          {mobilePanel && <div className="md:hidden"><CityPanel city={current} selectedId={districtId} onSelect={setDistrictId} me={wallet.address} /></div>}
          {!mobilePanel && sheet === "deposit" && <DepositSheet city={current} onClose={() => setSheet(null)} onDone={refresh} />}
          {!mobilePanel && sheet === "withdraw" && <WithdrawSheet city={current} onClose={() => setSheet(null)} onDone={refresh} />}
          {!mobilePanel && sheet === "manage" && <ManageSheet city={current} onClose={() => setSheet(null)} onDone={refresh} style={style} styleCode={styleCode} onStyle={saveStyle} />}
          {!mobilePanel && sheet === "found" && <FoundCitySheet onClose={() => setSheet(null)} onFounded={async (vault) => { await refresh(); if (vault) pick(vault); }} />}
        </div>
        <div><ActionDock mayor={isMayor} active={sheet} onOpen={open} onRecenter={() => setRecenter((n) => n + 1)} onDetails={() => { setMobilePanel((v) => !v); setSheet(null); }} /></div>
        <div className="pointer-events-none fixed bottom-24 left-1/2 -translate-x-1/2"><InspectCard info={inspect} onClose={() => { api?.clearInspect(); setInspect(null); }} /></div>
        <div className="hidden flex-col items-end gap-2 sm:flex">
          <LifeClock tick={tick} api={api} speed={speed} onSpeed={setSpeed} />
        <div className="pointer-events-auto max-w-[260px] text-right text-[10px] leading-snug text-ink-soft/80">
          Map data © OpenStreetMap contributors · Overture Maps Foundation. Testnet only; no real money.
        </div>
        </div>
      </div>
    </main>
  );
}

export default function App() {
  return <WalletProvider><Shell /></WalletProvider>;
}
