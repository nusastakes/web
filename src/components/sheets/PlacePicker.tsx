"use client";

import { useEffect, useRef, useState } from "react";
import { QUICK_PLACES, buildOsmCity, osmUri, rememberOsmCity, searchPlaces, type PlaceHit } from "@/lib/osm";
import type { CityMap } from "@/lib/scene/geometry";
import { Notice, Spinner, cx, inputCls } from "../ui";

/** Memilih area kota asli dari OpenStreetMap: tempat cepat atau pencarian, lalu pratinjau tapak bangunan dan jalan. */
export default function PlacePicker({ onReady, disabled }: { onReady: (mapId: string | null, label?: string) => void; disabled?: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [picked, setPicked] = useState<PlaceHit | null>(null);
  const [map, setMap] = useState<CityMap | null>(null);
  const [busy, setBusy] = useState<"search" | "build" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  const search = async () => {
    if (q.trim().length < 3) return;
    setBusy("search"); setError(null);
    try { setHits(await searchPlaces(q.trim())); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };

  const choose = async (p: PlaceHit) => {
    setPicked(p); setMap(null); setError(null); setBusy("build");
    onReadyRef.current(null);
    try {
      const m = await buildOsmCity(p.lat, p.lon, p.name);
      rememberOsmCity(m);
      setMap(m);
      onReadyRef.current(osmUri(p.lat, p.lon), p.name);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };

  // Pratinjau 2D: tapak bangunan (gelap untuk yang tinggi) dan jalan.
  useEffect(() => {
    const c = canvas.current;
    if (!c || !map) return;
    const g = c.getContext("2d")!;
    const W = c.width, H = c.height;
    g.fillStyle = "#eef1fb"; g.fillRect(0, 0, W, H);
    const s = Math.min(W, H) / 540;
    const tx = (x: number) => W / 2 + x * s, tz = (z: number) => H / 2 + z * s;
    g.lineCap = "round";
    for (const r of map.roads) {
      g.strokeStyle = r.f ? "#ffffff" : "#c9d1ec"; g.lineWidth = Math.max(1, r.w * s);
      g.beginPath();
      for (let i = 0; i < r.p.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, tx(r.p[i]), tz(r.p[i + 1]));
      g.stroke();
    }
    for (const b of map.buildings) {
      const k = Math.min(1, b.h / 60);
      g.fillStyle = `rgb(${Math.round(150 - 80 * k)}, ${Math.round(165 - 80 * k)}, ${Math.round(220 - 60 * k)})`;
      g.beginPath();
      for (let i = 0; i < b.p.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, tx(b.p[i]), tz(b.p[i + 1]));
      g.closePath(); g.fill();
    }
  }, [map]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {QUICK_PLACES.map((p) => (
          <button key={p.name} type="button" disabled={disabled || busy === "build"} onClick={() => choose(p)}
            className={cx("rounded-full px-2.5 py-1 text-[11px] font-semibold", picked?.name === p.name ? "bg-accent text-white" : "bg-slate-900/5 text-ink")}>{p.name}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }}
          placeholder="Search a neighbourhood, e.g. Blok M Jakarta" disabled={disabled} aria-label="Search a place" />
        <button type="button" className="btn btn-ghost !px-3" onClick={search} disabled={disabled || busy !== null || q.trim().length < 3}>{busy === "search" ? <Spinner /> : "Search"}</button>
      </div>
      {hits && hits.length > 0 && !picked && (
        <ul className="max-h-36 space-y-1 overflow-y-auto">
          {hits.map((h) => (
            <li key={`${h.lat},${h.lon}`}><button type="button" onClick={() => choose(h)} className="w-full truncate rounded-lg px-2 py-1.5 text-left text-xs text-ink hover:bg-slate-900/5">{h.name}</button></li>
          ))}
        </ul>
      )}
      {hits && hits.length === 0 && <p className="text-[11px] text-ink-soft">No places found.</p>}
      {busy === "build" && <div className="flex items-center gap-2 text-xs text-ink-soft"><Spinner /> Fetching buildings and streets from OpenStreetMap…</div>}
      {map && (
        <div className="space-y-1">
          <canvas ref={canvas} width={360} height={220} className="w-full rounded-xl border border-slate-900/10" aria-label="Map preview" />
          <p className="text-[11px] text-ink-soft">{picked?.name} · {map.buildings.length} buildings, {map.roads.length} streets in about 500 × 500 m. {map.attribution}.</p>
          <button type="button" className="text-[11px] font-semibold text-accent hover:underline" onClick={() => { setPicked(null); setMap(null); onReadyRef.current(null); }}>Choose another place</button>
        </div>
      )}
      {error && <Notice tone="warn">{error}</Notice>}
    </div>
  );
}
