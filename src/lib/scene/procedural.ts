import { DEFAULT_SIZE, parseOsmUri } from "../osm";
import type { CityMap, MapBuilding, MapRoad } from "./geometry";
import { tr } from "../lang";

/**
 * Lahan kosong prosedural (R24): dipakai saat data peta asli sebuah area tidak bisa dimuat (server OpenStreetMap
 * sibuk), supaya kota tetap tampil dan bukan peta tempat lain. Hasilnya deterministik per `id`: jaringan jalan
 * berkotak, beberapa gedung rendah di tiap blok. Peta ini ditandai `fallback`, dan tampilan mencoba memuat peta asli
 * lagi di latar.
 */

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r1 = (n: number) => Math.round(n * 10) / 10;

export function proceduralCity(id: string, name = tr("Open land", "Lahan kosong")): CityMap {
  const at = parseOsmUri(id);
  const size = at?.size ?? DEFAULT_SIZE;
  const half = size / 2;
  const rand = rng(id);
  const step = size / 5;
  const lines: number[] = [];
  for (let v = -half; v <= half + 0.1; v += step) lines.push(r1(v));

  const roads: MapRoad[] = [];
  const lim = half + 40;
  lines.forEach((v, i) => {
    const main = i === Math.floor(lines.length / 2);
    const w = main ? 10 : 6.5;
    roads.push({ w, f: 0, p: [-lim, v, lim, v] });
    roads.push({ w, f: 0, p: [v, -lim, v, lim] });
  });

  const buildings: MapBuilding[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      const x0 = lines[i] + 9, x1 = lines[i + 1] - 9, z0 = lines[j] + 9, z1 = lines[j + 1] - 9;
      const lots = 2 + Math.floor(rand() * 3);
      for (let k = 0; k < lots; k++) {
        const w = 12 + rand() * 18, d = 12 + rand() * 14;
        const cx = x0 + w / 2 + rand() * Math.max(0, x1 - x0 - w), cz = z0 + d / 2 + rand() * Math.max(0, z1 - z0 - d);
        const h = 4 + rand() * 12;
        const c = rand() < 0.2 ? 1 : rand() < 0.06 ? 3 : 0;
        buildings.push({ h: r1(h), k: 0, c, a: Math.round(w * d), p: [r1(cx - w / 2), r1(cz - d / 2), r1(cx + w / 2), r1(cz - d / 2), r1(cx + w / 2), r1(cz + d / 2), r1(cx - w / 2), r1(cz + d / 2)] });
      }
    }
  }
  return {
    id, name, attribution: tr("Procedural placeholder (map data unavailable)", "Peta pengganti prosedural (data peta tidak tersedia)"),
    center: at ? [at.lon, at.lat] : [0, 0],
    bounds: [-half, -half, half, half],
    buildings, roads, fallback: true,
  };
}
