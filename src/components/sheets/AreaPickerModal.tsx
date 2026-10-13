"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Map as LeafletMap } from "leaflet";
import { MAYOR } from "@/lib/copy-mayor";
import { useLang } from "@/lib/lang";
import { AREA_SIZES, QUICK_PLACES, searchPlaces, type PlaceHit } from "@/lib/osm";
import { IconClose } from "../icons";
import { Notice, Spinner, cx, inputCls } from "../ui";

/**
 * Pemilih area di peta (ide alat kotak Arnis, TC08.10): peta OpenStreetMap yang bisa digeser dan di-zoom, dengan kotak
 * tetap di tengah layar sebagai area kota. Ukuran kotak dipilih dari tiga tingkat. Kotak digambar sebagai lapisan DOM
 * yang ukurannya mengikuti zoom (meter per piksel di garis lintang pusat), jadi sama di mouse dan layar sentuh.
 */

export interface PickedArea { lat: number; lon: number; size: number; name: string }
interface Start { lat: number; lon: number; size: number; name?: string }

const MIN_ZOOM = 14, MAX_ZOOM = 19, START_ZOOM = 16;
const metersPerPixel = (lat: number, zoom: number) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
const distanceM = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const kx = 111320 * Math.cos((a.lat * Math.PI) / 180), kz = 110574;
  return Math.hypot((a.lon - b.lon) * kx, (a.lat - b.lat) * kz);
};

export default function AreaPickerModal({ start, onPick, onClose }: { start: Start; onPick: (a: PickedArea) => void; onClose: () => void }) {
  const [lang] = useLang();
  const t = MAYOR[lang].place;
  const locale = MAYOR[lang].locale;
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [size, setSize] = useState(start.size);
  const [view, setView] = useState({ lat: start.lat, lon: start.lon, zoom: START_ZOOM });
  const [named, setNamed] = useState<{ name: string; lat: number; lon: number } | null>(start.name ? { name: start.name, lat: start.lat, lon: start.lon } : null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => { queueMicrotask(() => setMounted(true)); }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    let map: LeafletMap | undefined;
    void import("leaflet").then((L) => {
      if (cancelled || !host.current) return;
      map = L.map(host.current, { center: [start.lat, start.lon], zoom: START_ZOOM, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, zoomControl: false });
      let loaded = 0;
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
      tiles.on("tileload", () => { loaded++; setTilesFailed(false); });
      tiles.on("tileerror", () => { if (loaded === 0) setTilesFailed(true); });
      L.control.zoom({ position: "bottomright" }).addTo(map);
      const sync = () => { const c = map!.getCenter(); setView({ lat: c.lat, lon: c.lng, zoom: map!.getZoom() }); };
      map.on("move zoom", sync);
      // Ketuk satu titik: geser peta ke sana supaya titik itu jadi pusat kotak.
      map.on("click", (e) => map!.panTo(e.latlng));
      mapRef.current = map;
      sync();
      setMapReady(true);
    });
    return () => { cancelled = true; mapRef.current = null; map?.remove(); };
  }, [mounted, start.lat, start.lon]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const goTo = (p: { name: string; lat: number; lon: number }) => {
    setNamed(p); setHits(null); setQ("");
    mapRef.current?.setView([p.lat, p.lon], START_ZOOM);
  };
  const search = async () => {
    if (q.trim().length < 3) return;
    setSearching(true); setError(null);
    try { setHits(await searchPlaces(q.trim())); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setSearching(false); }
  };

  const framePx = size / metersPerPixel(view.lat, view.zoom);
  const km2 = ((size / 1000) ** 2).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const name = named && distanceM(named, view) < 1500 ? named.name : t.areaDefault;

  const modal = (
    <div className="fixed inset-0 z-[90] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label={t.mapTitle}>
      <div className="space-y-2 border-b border-slate-900/10 bg-white px-3 pb-2 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.mapTitle}</h2>
            <p className="text-xs text-ink-soft">{t.mapHint}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t.cancel} className="rounded-lg p-1.5 text-ink-soft hover:bg-slate-900/5"><IconClose width={18} height={18} /></button>
        </div>
        <div className="relative flex gap-2">
          <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }}
            placeholder={t.search} aria-label={t.searchAria} />
          <button type="button" className="btn btn-ghost !px-3" onClick={search} disabled={searching || q.trim().length < 3}>{searching ? <Spinner /> : t.searchBtn}</button>
          {hits && (
            <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-900/10 bg-white p-1 shadow-lg">
              {hits.length === 0 && <li className="px-2 py-1.5 text-xs text-ink-soft">{t.none}</li>}
              {hits.map((h) => (
                <li key={`${h.lat},${h.lon}`}><button type="button" onClick={() => goTo(h)} className="w-full truncate rounded-lg px-2 py-1.5 text-left text-xs text-ink hover:bg-slate-900/5">{h.name}</button></li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {QUICK_PLACES.map((p) => (
            <button key={p.name} type="button" onClick={() => goTo(p)} className="shrink-0 rounded-full bg-slate-900/5 px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-slate-900/10">{p.name}</button>
          ))}
        </div>
        {error && <Notice tone="warn">{error}</Notice>}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#e9edf7]">
        <div ref={host} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 z-[700] flex items-center justify-center" aria-hidden>
          <div className="rounded-sm border-2 border-accent" style={{ width: framePx, height: framePx, boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.38)" }} />
        </div>
        {tilesFailed && (
          <div className="absolute inset-x-3 top-3 z-[800]"><Notice tone="warn">{t.tilesFail}</Notice></div>
        )}
        {!mapReady ? <div className="absolute inset-0 z-[600] flex items-center justify-center text-ink-soft"><Spinner /></div> : null}
      </div>

      <div className="space-y-2 border-t border-slate-900/10 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
        <div className="flex gap-1.5" role="radiogroup" aria-label={t.sizeLabel}>
          {AREA_SIZES.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={size === s.size} onClick={() => setSize(s.size)}
              className={cx("flex-1 rounded-xl px-2 py-1.5 text-center text-xs font-semibold", size === s.size ? "bg-accent text-white" : "bg-slate-900/5 text-ink")}>
              <div>{t.sizes[s.id]}</div>
              <div className={cx("text-[10px] font-medium", size === s.size ? "text-white/80" : "text-ink-soft")}>{s.size} m</div>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-ink-soft">
          <span className="min-w-0 truncate"><span className="font-semibold text-ink">{name}</span> · {t.areaInfo(km2, size)}</span>
          <span className="shrink-0 font-mono text-[11px]">{view.lat.toFixed(4)}, {view.lon.toFixed(4)}</span>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t.cancel}</button>
          <button type="button" className="btn btn-primary flex-1" onClick={() => onPick({ lat: Math.round(view.lat * 1e5) / 1e5, lon: Math.round(view.lon * 1e5) / 1e5, size, name })}>{t.useArea}</button>
        </div>
      </div>
    </div>
  );

  // Sheet memakai efek kaca (backdrop-filter) yang membuat posisi fixed relatif terhadap sheet: pindahkan ke body.
  return mounted ? createPortal(modal, document.body) : null;
}
