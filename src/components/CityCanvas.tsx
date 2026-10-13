"use client";

import { useEffect, useRef, useState } from "react";
import { CityScene, type LabelPosition } from "@/lib/scene/CityScene";
import type { CityMap } from "@/lib/scene/geometry";
import type { CityStats, Floater, Inspect, LifeEvent, Tone } from "@/lib/scene/life";
import type { CityStyle } from "@/lib/scene/themes";
import type { InteriorInfo } from "@/lib/scene/interior";
import type { District } from "@/lib/types";
import { DISTRICT_COLORS } from "@/lib/palette";
import { APP } from "@/lib/copy-app";
import { useLang } from "@/lib/lang";
import CityMap2D from "./CityMap2D";

/** Pintu masuk ke adegan untuk komponen lain: menjalankan kejadian dan menggerakkan kamera. */
export interface SceneApi {
  emit: (e: LifeEvent) => void;
  setActivity: (v: number) => void;
  focusDistrict: (id: string) => void;
  setClockSpeed: (secondsPerHour: number) => void;
  setHour: (h: number) => void;
  setClockPaused: (p: boolean) => void;
  clearInspect: () => void;
  closeBuilding: () => void;
  focusFloor: (level: number) => void;
  setWeather: (mode: "auto" | "clear" | "rain") => void;
  openTownHall: () => void;
  resetCamera: () => void;
  setPaused: (p: boolean) => void;
}

export interface CityTick { time: string; phase: string; hour: number; stats: CityStats }

const TONE_CSS: Record<Tone, string> = { blue: "#3f6bff", green: "#10b981", amber: "#f59e0b", red: "#ef4444", violet: "#7a5cff", gold: "#f5b301" };

interface Props {
  mapId: string;
  districts: District[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMapLoaded?: (map: CityMap) => void;
  /** Naikkan angka ini untuk mengembalikan kamera ke posisi awal. */
  resetSignal?: number;
  onScene?: (api: SceneApi | null) => void;
  /** Gaya kota pilihan walikota (tema dan karya sipil). */
  style?: CityStyle;
  onTick?: (t: CityTick) => void;
  onInspect?: (info: Inspect | null) => void;
  /** Nama kota untuk layar LED di menara. */
  cityName?: string;
  /** Gedung yang dibelah dan isinya (null saat ditutup). */
  onBuilding?: (info: InteriorInfo | null) => void;
  /** Geser gambar ke kiri (positif) atau kanan (negatif) di layar lebar; bawaan memberi ruang untuk panel kanan. */
  shift?: number;
  /** Tanpa label distrik dan pin kejadian (untuk latar halaman depan). */
  quiet?: boolean;
}

const mapCache = new Map<string, CityMap>();

async function loadMap(id: string): Promise<CityMap> {
  const hit = mapCache.get(id);
  if (hit) return hit;
  if (id.startsWith("osm:")) {
    // Area asli dari OpenStreetMap; bila semua server sibuk, lahan kosong prosedural (bukan peta tempat lain) supaya
    // kota tetap tampil. Lahan itu tidak disimpan di cache, jadi percobaan berikutnya memuat peta asli lagi.
    const { loadOsmCity } = await import("@/lib/osm");
    const real = await loadOsmCity(id);
    if (real) { mapCache.set(id, real); return real; }
    const { proceduralCity } = await import("@/lib/scene/procedural");
    return proceduralCity(id);
  }
  const res = await fetch(`/maps/${id}.city.json`);
  if (!res.ok) throw new Error(`peta ${id} tidak bisa dimuat (${res.status})`);
  const map = (await res.json()) as CityMap;
  mapCache.set(id, map);
  return map;
}

/** Kota 3D. Adegan three.js hidup di dalam komponen ini; React hanya mengirim peta, distrik, dan pilihan. */
export default function CityCanvas({ mapId, districts, selectedId, onSelect, onMapLoaded, resetSignal = 0, onScene, style, onTick, onInspect, cityName, onBuilding, shift: shiftPx = 170, quiet = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CityScene | null>(null);
  const labelRefs = useRef(new Map<string, HTMLDivElement>());
  const floatersRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef(new Map<string, HTMLDivElement>());
  const onSceneRef = useRef(onScene);
  const shiftRef = useRef(shiftPx);
  const quietRef = useRef(quiet);
  useEffect(() => { quietRef.current = quiet; }, [quiet]);
  const onTickRef = useRef(onTick);
  const onInspectRef = useRef(onInspect);
  const onBuildingRef = useRef(onBuilding);
  const [lang] = useLang();
  const [error, setError] = useState<string | null>(null);
  const [flat, setFlat] = useState<CityMap | null>(null);
  const [loadedMap, setLoadedMap] = useState<string | null>(null);
  const [placeholder, setPlaceholder] = useState(false);
  const ready = loadedMap === mapId;
  const [hovered, setHovered] = useState<string | null>(null);
  const onSelectRef = useRef(onSelect);
  const districtsRef = useRef(districts);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onSceneRef.current = onScene; }, [onScene]);
  useEffect(() => { onTickRef.current = onTick; }, [onTick]);
  useEffect(() => { onInspectRef.current = onInspect; }, [onInspect]);
  useEffect(() => { onBuildingRef.current = onBuilding; }, [onBuilding]);
  useEffect(() => { districtsRef.current = districts; }, [districts]);

  // Buat adegan sekali.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scene: CityScene;
    try {
      scene = new CityScene(canvas, {
        onHover: setHovered,
        onSelect: (id) => onSelectRef.current(id),
        onTick: (t) => onTickRef.current?.(t),
        onInspect: (info) => onInspectRef.current?.(info),
        onBuilding: (info) => onBuildingRef.current?.(info),
        onLabels: (labels: LabelPosition[]) => {
          for (const l of labels) {
            const el = labelRefs.current.get(l.id);
            if (!el) continue;
            el.style.transform = `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px) translate(-50%, -100%)`;
            el.style.opacity = l.visible ? "1" : "0";
          }
        },
        onFloaters: (items: Floater[]) => {
          const host = floatersRef.current;
          if (quietRef.current) { for (const el of chipsRef.current.values()) el.remove(); chipsRef.current.clear(); return; }
          if (!host) return;
          const chips = chipsRef.current;
          const seen = new Set<string>();
          for (const f of items) {
            seen.add(f.id);
            let el = chips.get(f.id);
            if (!el) {
              el = document.createElement("div");
              el.className = "absolute left-0 top-0 whitespace-nowrap rounded-full border-2 bg-white px-2.5 py-1 text-[11px] font-bold text-ink shadow-[0_8px_22px_-8px_rgba(15,22,51,0.35)]";
              el.style.borderColor = TONE_CSS[f.tone];
              el.textContent = f.text;
              host.appendChild(el);
              chips.set(f.id, el);
            }
            el.style.transform = `translate(${f.x.toFixed(1)}px, ${(f.y - 8).toFixed(1)}px) translate(-50%, -100%)`;
            el.style.opacity = f.visible ? "1" : "0";
          }
          for (const [id, el] of chips) if (!seen.has(id)) { el.remove(); chips.delete(id); }
        },
      });
    } catch (e) {
      // Tidak ada WebGL: tampilkan pesan, jangan merusak seluruh halaman.
      const message = e instanceof Error ? e.message : "WebGL tidak tersedia";
      queueMicrotask(() => setError(message));
      return;
    }
    sceneRef.current = scene;
    const chips = chipsRef.current;
    onSceneRef.current?.({
      emit: (e) => scene.emit(e), setActivity: (v) => scene.setActivity(v), focusDistrict: (id) => scene.focusDistrict(id),
      setClockSpeed: (s) => scene.setClockSpeed(s), setHour: (h) => scene.setHour(h), setClockPaused: (p) => scene.setClockPaused(p), clearInspect: () => scene.clearInspect(), closeBuilding: () => scene.closeBuilding(), focusFloor: (l) => scene.focusFloor(l), setWeather: (m) => scene.setWeather(m), openTownHall: () => scene.openTownHall(), resetCamera: () => scene.resetCamera(true), setPaused: (p) => scene.setPaused(p),
    });
    const shift = () => scene.setViewShift(window.innerWidth >= 768 ? shiftRef.current : 0);
    shift();
    window.addEventListener("resize", shift);
    return () => {
      window.removeEventListener("resize", shift);
      onSceneRef.current?.(null);
      for (const el of chips.values()) el.remove();
      chips.clear();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Tanpa WebGL: tetap muat peta dan gambar versi 2D-nya.
  useEffect(() => {
    if (!error) return;
    let cancelled = false;
    loadMap(mapId).then((m) => { if (!cancelled) setFlat(m); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [error, mapId]);

  // Muat peta saat berganti kota.
  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    const scene = sceneRef.current;
    if (!scene) return;
    loadMap(mapId)
      .then((map) => {
        if (cancelled) return;
        scene.setMap(map);
        scene.setDistricts(districtsRef.current);
        onMapLoaded?.(map);
        setLoadedMap(mapId);
        setPlaceholder(!!map.fallback);
        // Data peta asli belum bisa dimuat: tetap tampil lahan kosong dan coba lagi di latar (maksimal 5 kali).
        if (map.fallback) {
          let tries = 0;
          const retry = () => {
            if (cancelled || tries++ >= 5) return;
            retryTimer = window.setTimeout(() => {
              loadMap(mapId).then((m) => {
                if (cancelled) return;
                if (!m.fallback) { scene.setMap(m); scene.setDistricts(districtsRef.current); onMapLoaded?.(m); setPlaceholder(false); } else retry();
              }).catch(retry);
            }, 40_000);
          };
          retry();
        }
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => { cancelled = true; window.clearTimeout(retryTimer); };
  }, [mapId, onMapLoaded]);

  // Alokasi berubah: bangun ulang distrik.
  useEffect(() => { if (ready) sceneRef.current?.setDistricts(districts); }, [districts, ready]);
  useEffect(() => { sceneRef.current?.setSelected(selectedId); }, [selectedId, ready]);
  useEffect(() => { if (resetSignal > 0) sceneRef.current?.resetCamera(true); }, [resetSignal]);
  useEffect(() => { if (style) sceneRef.current?.setStyle(style); }, [style, ready]);
  useEffect(() => { if (cityName) sceneRef.current?.setCityLabel(cityName); }, [cityName, ready]);

  return (
    <div className="absolute inset-0">
      <canvas ref={canvasRef} className="block h-full w-full touch-none cursor-grab active:cursor-grabbing" aria-label="3D city" />
      {/* Label distrik: posisinya ditulis langsung ke DOM tiap frame, tanpa render ulang React. */}
      {/* Pin kejadian (truk bermuatan, acara, usulan): dibuat langsung di DOM, posisinya ditulis tiap frame. */}
      <div ref={floatersRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {!quiet && districts.filter((d) => d.weight > 0).map((d) => (
          <div
            key={d.id}
            ref={(el) => { if (el) labelRefs.current.set(d.id, el); else labelRefs.current.delete(d.id); }}
            className="absolute left-0 top-0 transition-opacity duration-200"
            style={{ opacity: 0 }}
          >
            <div
              className="flex items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-[0_4px_16px_-6px_rgba(40,60,140,0.35)] backdrop-blur-md"
              style={{ outline: hovered === d.id || selectedId === d.id ? `2px solid ${DISTRICT_COLORS[d.kind]}` : "none" }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: DISTRICT_COLORS[d.kind] }} />
              {d.label}
            </div>
          </div>
        ))}
      </div>
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">Building the city…</div>
      )}
      {ready && placeholder && !error && !quiet && (
        <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center px-6">
          <span className="rounded-full bg-white/85 px-3 py-1 text-[11px] text-slate-600 backdrop-blur">{APP[lang].mapFallback}</span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0">
          {flat && <CityMap2D map={flat} districts={districts} />}
          <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center px-6">
            <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] text-slate-600 backdrop-blur">{APP[lang].no3d}</span>
          </div>
        </div>
      )}
    </div>
  );
}
