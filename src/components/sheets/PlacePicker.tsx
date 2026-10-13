"use client";

import { useEffect, useRef, useState } from "react";
import { MAYOR } from "@/lib/copy-mayor";
import { useLang } from "@/lib/lang";
import { DEFAULT_SIZE, QUICK_PLACES, buildOsmCity, densityOf, osmUri, rememberOsmCity, type BuildStage } from "@/lib/osm";
import type { CityMap } from "@/lib/scene/geometry";
import { Badge, Notice, Spinner, cx } from "../ui";
import AreaPickerModal, { type PickedArea } from "./AreaPickerModal";

/**
 * Memilih area kota asli dari OpenStreetMap: tempat cepat, atau pemilih di peta (kotak dengan tiga ukuran, ide alat kotak
 * Arnis), lalu pratinjau tapak bangunan dan jalan dengan penilaian kepadatan data.
 */
export default function PlacePicker({ onReady, disabled }: { onReady: (mapId: string | null, label?: string) => void; disabled?: boolean }) {
  const [lang] = useLang();
  const t = MAYOR[lang].place;
  const locale = MAYOR[lang].locale;
  const [picked, setPicked] = useState<PickedArea | null>(null);
  const [map, setMap] = useState<CityMap | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<{ s: BuildStage; n?: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  const choose = async (a: PickedArea) => {
    setOpen(false); setPicked(a); setMap(null); setError(null); setBusy(true);
    onReadyRef.current(null);
    try {
      const m = await buildOsmCity(a.lat, a.lon, a.name, a.size, (s, n) => setStage({ s, n }));
      rememberOsmCity(m);
      setMap(m);
      onReadyRef.current(osmUri(a.lat, a.lon, a.size), a.name);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  // Pratinjau 2D: tapak bangunan (gelap untuk yang tinggi) dan jalan.
  const size = picked?.size ?? DEFAULT_SIZE;
  useEffect(() => {
    const c = canvas.current;
    if (!c || !map) return;
    const g = c.getContext("2d")!;
    const W = c.width, H = c.height;
    g.fillStyle = "#eef1fb"; g.fillRect(0, 0, W, H);
    const s = Math.min(W, H) / (size + 20);
    const tx = (x: number) => W / 2 + x * s, tz = (z: number) => H / 2 + z * s;
    g.lineCap = "round";
    for (const ar of map.areas ?? []) {
      g.fillStyle = ar.t === 0 ? "#bfe0f3" : "#d6efdc";
      g.beginPath();
      for (let i = 0; i < ar.p.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, tx(ar.p[i]), tz(ar.p[i + 1]));
      g.closePath(); g.fill();
    }
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
  }, [map, size]);

  const start = picked ?? { ...QUICK_PLACES[0], size: DEFAULT_SIZE };
  const density = map ? densityOf(map.buildings.length, size) : null;
  const km2 = ((size / 1000) ** 2).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {QUICK_PLACES.map((p) => (
          <button key={p.name} type="button" disabled={disabled || busy} onClick={() => choose({ ...p, size: DEFAULT_SIZE })}
            className={cx("rounded-full px-2.5 py-1 text-[11px] font-semibold", picked?.name === p.name ? "bg-accent text-white" : "bg-slate-900/5 text-ink")}>{p.name}</button>
        ))}
      </div>
      <button type="button" className="btn btn-ghost w-full" disabled={disabled || busy} onClick={() => setOpen(true)}>{map ? t.changeMap : t.openMap}</button>
      {busy && (
        <ol className="space-y-1 text-xs text-ink-soft">
          {(["fetch", "shape"] as const).map((k, i) => {
            const at = stage ? ["fetch", "shape", "ready"].indexOf(stage.s) : 0;
            const done = at > i;
            return (
              <li key={k} className={cx("flex items-center gap-2", at < i && "opacity-40")}>
                {done ? <span className="w-4 text-center text-good">✓</span> : at === i ? <Spinner /> : <span className="w-4 text-center">·</span>}
                {k === "fetch" ? t.stages.fetch : t.stages.shape(stage?.n ?? 0)}
              </li>
            );
          })}
        </ol>
      )}
      {!busy && map && stage?.s === "ready" && <p className="text-[11px] font-medium text-good">✓ {t.stages.ready}</p>}
      {map && density && (
        <div className="space-y-1">
          <canvas ref={canvas} width={360} height={220} className="w-full rounded-xl border border-slate-900/10" aria-label={t.previewAria} />
          <p className="text-[11px] text-ink-soft">{t.info(picked?.name ?? "", map.buildings.length, map.roads.length, size, km2)} {map.attribution}.</p>
          <div className="flex items-center gap-2 text-[11px] text-ink-soft">
            <Badge tone={density === "sparse" ? "warn" : density === "dense" ? "good" : "accent"}>{t.density[density]}</Badge>
            <span>{t.densityNote}</span>
          </div>
          <button type="button" className="text-[11px] font-semibold text-accent hover:underline" onClick={() => { setPicked(null); setMap(null); onReadyRef.current(null); }}>{t.another}</button>
        </div>
      )}
      {error && <Notice tone="warn">{error}</Notice>}
      {open && <AreaPickerModal start={start} onPick={(a) => void choose(a)} onClose={() => setOpen(false)} />}
    </div>
  );
}
