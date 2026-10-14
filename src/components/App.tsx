"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCityActivity } from "@/lib/activity";
import { useCityStyle } from "@/lib/style";
import { useCityScore } from "@/lib/cityStats";
import { useCities } from "@/lib/hooks";
import { PREVIEW_CITIES } from "@/lib/preview";
import { useWallet } from "@/lib/wallet";
import ActionDock, { type SheetKind } from "./ActionDock";
import CityPanel from "./CityPanel";
import KpiRow from "./KpiRow";
import TopBar from "./TopBar";
import DepositSheet from "./sheets/DepositSheet";
import ExploreSheet from "./sheets/ExploreSheet";
import FoundCitySheet from "./sheets/FoundCitySheet";
import { DEFAULT_STYLE, encodeStyle, growthOf } from "@/lib/scene/themes";
import MayorStrip from "./MayorStrip";
import ManageSheet from "./sheets/ManageSheet";
import PanggungSheet from "./sheets/PanggungSheet";
import RulesSheet from "./sheets/RulesSheet";
import TuningSheet from "./sheets/TuningSheet";
import WithdrawSheet from "./sheets/WithdrawSheet";

import type { CityTick, SceneApi } from "./CityCanvas";
import { BuildingCard, InspectCard, LifeClock } from "./LifeHud";
import DemoDirector from "./DemoDirector";
import IntroTour from "./IntroTour";
import Onboarding from "./Onboarding";
import { Notice } from "./ui";
import { APP } from "@/lib/copy-app";
import { useLang } from "@/lib/lang";
import { setOnb, useOnboarding } from "@/lib/onboarding";
import type { InteriorInfo } from "@/lib/scene/interior";
import type { Inspect } from "@/lib/scene/life";

const CityCanvas = dynamic(() => import("./CityCanvas"), { ssr: false });

function Shell() {
  const wallet = useWallet();
  const { cities, refresh, loading: citiesLoading, error: citiesError } = useCities();
  const [lang] = useLang();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [districtId, setDistrictId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [recenter, setRecenter] = useState(0);
  /** Distrik yang setelan layanannya sedang dibuka (TC67.10). */
  const [tuneId, setTuneId] = useState<string | null>(null);

  const all = useMemo(() => [...cities, ...PREVIEW_CITIES], [cities]);
  // Tautan kota `?c=<alamat vault>` membuka kota itu (sekali, setelah daftar kota termuat).
  const [linkDone, setLinkDone] = useState(false);
  if (!linkDone && !citiesLoading) {
    setLinkDone(true);
    const c = new URLSearchParams(location.search).get("c")?.toLowerCase();
    const hit = c ? [...cities, ...PREVIEW_CITIES].find((x) => x.vault?.toLowerCase() === c || x.id.toLowerCase() === c) : undefined;
    if (hit) setPickedId(hit.id);
  }
  // Walikota yang masuk langsung melihat kotanya sendiri (kota terbaru bila punya beberapa), kecuali memilih kota lain.
  const mine = wallet.address ? [...cities].reverse().find((c) => c.mayor?.toLowerCase() === wallet.address!.toLowerCase()) : undefined;
  const current = all.find((c) => c.id === pickedId) ?? mine ?? cities[0] ?? PREVIEW_CITIES[0];

  const ob = useOnboarding({ address: wallet.address, ready: wallet.status === "ready" && !!wallet.address, citiesReady: !citiesLoading, cities, current, mine });
  const isMayor = wallet.status === "ready" && !!current.mayor && current.mayor.toLowerCase() === wallet.address?.toLowerCase();

  // Kota hidup: kejadian onchain menjadi truk, kerumunan, dan pin di kota 3D.
  const sceneApi = useRef<SceneApi | null>(null);
  const [api, setApi] = useState<SceneApi | null>(null);
  const onScene = useCallback((x: SceneApi | null) => { sceneApi.current = x; setApi(x); }, []);
  const [tick, setTick] = useState<CityTick | null>(null);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [speed, setSpeed] = useState(16);
  const [building, setBuilding] = useState<InteriorInfo | null>(null);
  const onBuilding = useCallback((b: InteriorInfo | null) => { setBuilding(b); if (b) setOnb({ looked: true }); }, []);
  // `?demo=1` memulai mode demo langsung (untuk rekaman video).
  const [demo, setDemo] = useState(false);
  const stopDemo = useCallback(() => setDemo(false), []);
  const beforeDemo = useCallback(() => { setSheet(null); setPickedId(PREVIEW_CITIES[0].id); }, []);
  useEffect(() => {
    if (new URLSearchParams(location.search).has("demo")) queueMicrotask(() => setDemo(true));
  }, []);
  useCityActivity(current.vault, useCallback((e) => sceneApi.current?.emit(e), []));
  const tvl = current.totalAssets;
  const score = useCityScore(current.preview ? undefined : current.vault);
  const crowd = score?.crowd ?? null;
  useEffect(() => {
    // Keramaian mengikuti skor kota (TC67.8): lalu lintas pengguna luar yang dibatasi kekayaan kota, supaya kota ramai
    // tetapi miskin tidak terjadi. Sebelum skor ada (atau kota contoh), ikut besar dana kota (skala log) seperti dulu.
    const byFunds = Math.min(1, Math.log10(1 + tvl) / 5.5);
    const level = crowd === null ? byFunds : Math.max(crowd, 0.5 * byFunds);
    sceneApi.current?.setActivity(0.45 + 0.75 * level);
  }, [tvl, crowd, current.mapId]);
  // Tinggi, kepadatan, dan kelengkapan kota mengikuti skor kota (TC67.8: ekonomi dan layanan yang diurus walikota).
  // Kota contoh dan kota tanpa skor tumbuh menurut dananya saja.
  const growth = score ? growthOf(score.score) : null;
  useEffect(() => { api?.setGrowth(growth); }, [api, growth, current.mapId]);
  useEffect(() => {
    // Kota contoh hidup sendiri dengan kejadian contoh, supaya layar pertama tidak kosong.
    if (!current.preview || demo) return;
    const script: Parameters<NonNullable<typeof sceneApi.current>["emit"]>[0][] = [
      { type: "transfer", from: "idle", to: "lend", amount: 1200 },
      { type: "deposit", amount: 500 },
      { type: "festival", at: "vault", label: APP[lang].sampleEvent },
      { type: "transfer", from: "lend", to: "vault", amount: 800 },
      { type: "harvest", amount: 12.4 },
      { type: "withdraw", amount: 300 },
    ];
    let i = 0;
    const first = window.setTimeout(() => sceneApi.current?.emit(script[i++ % script.length]), 3000);
    const id = window.setInterval(() => sceneApi.current?.emit(script[i++ % script.length]), 11000);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, [current.preview, current.id, demo, lang]);

  const { style, code: styleCode, save: saveStyle, sync: styleSync, error: styleError } = useCityStyle(current.vault ?? current.id, current.preview ? undefined : current.vault, wallet);

  const pick = useCallback((id: string) => { setPickedId(id); setDistrictId(null); setTuneId(null); }, []);
  const tuneDistrict = tuneId ? current.districts.find((d) => d.id === tuneId) : undefined;
  const openTune = useCallback((id: string) => { setTuneId(id); setSheet(null); setMobilePanel(false); }, []);
  // Saat setoran pertama selesai dan ucapan selamat muncul, lembar setor ditutup supaya kartunya terlihat.
  const [wasCelebrating, setWasCelebrating] = useState(false);
  if (ob.celebrate !== wasCelebrating) {
    setWasCelebrating(ob.celebrate);
    if (ob.celebrate && sheet === "deposit") setSheet(null);
  }
  const open = (k: Exclude<SheetKind, null>) => { setSheet((s) => (s === k ? null : k)); setMobilePanel(false); setTuneId(null); };
  const show = (k: Exclude<SheetKind, null>) => { setSheet(k); setMobilePanel(false); setTuneId(null); };

  return (
    <main className="fixed inset-0 overflow-hidden">
      <CityCanvas mapId={current.mapId} districts={current.districts} selectedId={districtId} onSelect={setDistrictId} resetSignal={recenter} onScene={onScene} style={style} onTick={setTick} onInspect={setInspect} cityName={current.name} onBuilding={onBuilding} />

      <div className="pointer-events-none absolute inset-x-3 top-3 sm:inset-x-4 sm:top-4">
        <TopBar cities={cities} preview={PREVIEW_CITIES} current={current} onPick={pick} onAfterAccountChange={refresh} onExplore={() => open("explore")} />
      </div>

      {/* Tengah: KPI di kiri, panel kota di kanan. Posisinya tetap; sheet di bawah tidak menekannya. */}
      <div className="pointer-events-none absolute inset-x-3 bottom-24 top-[4.75rem] flex justify-between gap-3 sm:inset-x-4 sm:top-[5.25rem]">
        {/* Di ponsel KPI disembunyikan saat lembar atau panel terbuka, supaya tidak bertumpuk. */}
        <div className={`min-w-0 flex-1 ${sheet || mobilePanel || building ? "max-sm:hidden" : ""}`}><KpiRow city={current} /></div>
        <div className="hidden max-h-full min-h-0 md:block md:max-h-[calc(100%-12.5rem)]"><CityPanel city={current} selectedId={districtId} onSelect={setDistrictId} me={wallet.address} onTune={openTune} /></div>
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col items-center gap-3 sm:inset-x-4 sm:bottom-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:w-auto">
          {mobilePanel && <div className="md:hidden"><CityPanel city={current} selectedId={districtId} onSelect={setDistrictId} me={wallet.address} onTune={openTune} /></div>}
          {!mobilePanel && sheet === "deposit" && <DepositSheet city={current} onClose={() => setSheet(null)} onDone={refresh} />}
          {!mobilePanel && sheet === "withdraw" && <WithdrawSheet city={current} onClose={() => setSheet(null)} onDone={refresh} />}
          {!mobilePanel && sheet === "explore" && <ExploreSheet onClose={() => setSheet(null)} onPick={pick} me={wallet.address} />}
          {!mobilePanel && sheet === "manage" && <ManageSheet city={current} onClose={() => setSheet(null)} onDone={refresh} onDeposit={() => show("deposit")} onFound={() => show("found")} style={style} styleCode={styleCode} onStyle={(s) => void saveStyle(s)} styleSync={styleSync} styleError={styleError} />}
          {!mobilePanel && !sheet && tuneDistrict && <TuningSheet city={current} district={tuneDistrict} onClose={() => setTuneId(null)} onDone={refresh} />}
          {!mobilePanel && sheet === "panggung" && <PanggungSheet city={current} isMayor={isMayor} onClose={() => setSheet(null)} onDone={refresh} />}
          {!mobilePanel && sheet === "rules" && <RulesSheet city={current} onClose={() => setSheet(null)} />}
          {!mobilePanel && sheet === "found" && <FoundCitySheet onClose={() => setSheet(null)} onFounded={async (vault) => { await refresh(); if (vault) { pick(vault); show("manage"); } }} />}
        </div>
        <div><ActionDock mayor={isMayor} services={!current.preview && !!current.vault} highlight={ob.show ? ob.highlight : null} active={sheet} onOpen={open} onRecenter={() => setRecenter((n) => n + 1)} onDetails={() => { setMobilePanel((v) => !v); setSheet(null); }} /></div>
        <div className="pointer-events-none fixed left-3 top-[10.5rem] sm:left-4"><BuildingCard info={building} onClose={() => api?.closeBuilding()} onFloor={(l) => api?.focusFloor(l)} /></div>
        <div className="pointer-events-none fixed bottom-24 left-1/2 -translate-x-1/2"><InspectCard info={inspect} onClose={() => { api?.clearInspect(); setInspect(null); }} /></div>
        <div className="hidden flex-col items-end gap-2 sm:flex">
          <LifeClock tick={tick} api={api} speed={speed} onSpeed={setSpeed} onDemo={() => setDemo(true)} />
        <div className="pointer-events-auto max-w-[260px] text-right text-[10px] leading-snug text-ink-soft/80">
          {APP[lang].attribution}
        </div>
        </div>
      </div>
      <DemoDirector api={api} running={demo} onStop={stopDemo} onBefore={beforeDemo} />
      {citiesError && cities.length === 0 && <div className="pointer-events-none fixed bottom-24 left-1/2 z-30 w-[min(360px,calc(100vw-2rem))] -translate-x-1/2"><Notice tone="warn">{APP[lang].banner.citiesFail}</Notice></div>}
      {!demo && isMayor && wallet.address && !ob.show && !current.preview && !building && !sheet && !mobilePanel && (
        <MayorStrip city={current} owner={wallet.address} styleChanged={styleCode !== "" && styleCode !== encodeStyle(DEFAULT_STYLE)} onOpen={() => show("manage")} />
      )}
      {!demo && <Onboarding ob={ob} city={current} hideClass={building || sheet || mobilePanel ? "hidden" : ""} onDeposit={() => show("deposit")} onExplore={() => show("explore")} onFound={() => show("found")} />}
      {!demo && <IntroTour onDemo={() => setDemo(true)} onExplore={() => open("explore")} />}
    </main>
  );
}

/** Kota. Penyedia akun ada di `app/layout.tsx` supaya sesi passkey bertahan antar halaman. */
export default function App() {
  return <Shell />;
}
