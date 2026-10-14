"use client";

import { useEffect, useRef } from "react";
import { assignDistricts } from "@/lib/scene/assign";
import type { CityMap } from "@/lib/scene/geometry";
import { DISTRICT_COLORS } from "@/lib/palette";
import { useLang } from "@/lib/lang";
import type { District } from "@/lib/types";

/** Peta 2D kota untuk perangkat tanpa WebGL: tapak bangunan berwarna per distrik dan jalan. */
export default function CityMap2D({ map, districts }: { map: CityMap; districts: District[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [lang] = useLang();
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const W = (c.width = c.clientWidth * devicePixelRatio), H = (c.height = c.clientHeight * devicePixelRatio);
      const g = c.getContext("2d")!;
      g.fillStyle = "#eef1fb"; g.fillRect(0, 0, W, H);
      const [x0, z0, x1, z1] = map.bounds;
      const s = Math.min(W / (x1 - x0 + 60), H / (z1 - z0 + 60)) * 0.9;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const tx = (x: number) => W / 2 + (x - cx) * s, tz = (z: number) => H / 2 + (z - cz) * s;
      g.lineCap = "round"; g.lineJoin = "round";
      // Tutupan lahan (air dan hijau) di bawah jalan dan bangunan.
      for (const ar of map.areas ?? []) {
        g.fillStyle = ar.t === 0 ? "#bfe0f3" : "#d6efdc";
        g.beginPath();
        for (let i = 0; i < ar.p.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, tx(ar.p[i]), tz(ar.p[i + 1]));
        g.closePath(); g.fill();
      }
      for (const r of map.roads) {
        g.strokeStyle = r.f ? "#ffffff" : "#cfd6ee"; g.lineWidth = Math.max(1, r.w * s);
        g.beginPath();
        for (let i = 0; i < r.p.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, tx(r.p[i]), tz(r.p[i + 1]));
        g.stroke();
      }
      const groups = assignDistricts(map.buildings, districts.length ? districts : [{ id: "all", kind: "idle", label: "City", weight: 1, assets: 0, apyBps: null, simulated: false }]);
      for (const d of districts.length ? districts : []) {
        const color = DISTRICT_COLORS[d.kind];
        for (const bi of groups.get(d.id) ?? []) {
          const b = map.buildings[bi];
          g.fillStyle = color; g.globalAlpha = 0.35 + 0.5 * Math.min(1, b.h / 80);
          g.beginPath();
          for (let i = 0; i < b.p.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, tx(b.p[i]), tz(b.p[i + 1]));
          g.closePath(); g.fill();
        }
      }
      g.globalAlpha = 1;
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [map, districts]);
  return <canvas ref={ref} className="block h-full w-full" aria-label={lang === "id" ? "Peta kota" : "City map"} />;
}
