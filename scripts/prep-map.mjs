// Mengubah GeoJSON mentah Overture (public/maps/<id>.geojson dan <id>-roads.geojson) menjadi satu berkas kompak
// public/maps/<id>.city.json dalam meter lokal, siap diekstrusi oleh three.js. Dijalankan sekali saat data peta berubah:
//
//   node scripts/prep-map.mjs            (semua kota di daftar CITIES)
//   node scripts/prep-map.mjs scbd-jakarta
//
// Aturan: 1 satuan = 1 meter, x ke timur, z ke selatan (utara ada di layar bagian atas), pusat peta = (0, 0).
// Tinggi bangunan: `height` bila ada, lalu `num_floors * 3.4`, lalu tinggi bawaan yang deterministik per ID bangunan.

import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mapsDir = join(root, "public", "maps");

const CITIES = [
  { id: "scbd-jakarta", name: "SCBD, Jakarta" },
  { id: "malioboro-jogja", name: "Malioboro, Yogyakarta" },
];

const ATTRIBUTION = "© OpenStreetMap contributors · Overture Maps Foundation";

const ROAD_WIDTH = {
  motorway: 12, trunk: 12, primary: 10, secondary: 8, tertiary: 7, residential: 6, unclassified: 6, living_street: 5,
  service: 3.4, pedestrian: 4, footway: 1.6, path: 1.4, cycleway: 1.8, steps: 1.4, track: 2.4,
};
const BUILDING_CLASS = { residential: 0, commercial: 1, retail: 1, office: 1, industrial: 2, civic: 3, religious: 3, education: 3, medical: 3 };

function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

const r1 = (n) => Math.round(n * 10) / 10;

function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

function buildCity({ id, name }) {
  const bFile = join(mapsDir, `${id}.geojson`);
  const rFile = join(mapsDir, `${id}-roads.geojson`);
  if (!existsSync(bFile)) throw new Error(`tidak ada ${bFile}`);
  const bFc = JSON.parse(readFileSync(bFile, "utf8"));
  const rFc = existsSync(rFile) ? JSON.parse(readFileSync(rFile, "utf8")) : { features: [] };

  // Pusat dan proyeksi equirectangular dari kotak pembatas bangunan.
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  const polys = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);
  for (const f of bFc.features) for (const poly of polys(f.geometry)) for (const [lon, lat] of poly[0]) {
    minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon); minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  }
  const lon0 = (minLon + maxLon) / 2, lat0 = (minLat + maxLat) / 2;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), kz = 110574;
  const proj = ([lon, lat]) => [r1((lon - lon0) * kx), r1(-(lat - lat0) * kz)];

  const buildings = [];
  let skipped = { underground: 0, tiny: 0, degenerate: 0 };
  for (const f of bFc.features) {
    const p = f.properties || {};
    if (p.is_underground) { skipped.underground++; continue; }
    const key = String(p.id || buildings.length);
    for (const poly of polys(f.geometry)) {
      let ring = poly[0].map(proj);
      if (ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]) ring.pop();
      ring = ring.filter((pt, i) => i === 0 || pt[0] !== ring[i - 1][0] || pt[1] !== ring[i - 1][1]);
      if (ring.length < 3) { skipped.degenerate++; continue; }
      const area = Math.abs(signedArea(ring));
      if (area < 8) { skipped.tiny++; continue; }
      let h = typeof p.height === "number" ? p.height : typeof p.num_floors === "number" ? p.num_floors * 3.4 : null;
      const known = h !== null;
      if (h === null) h = 6 + hash01(key) * 12; // 6 sampai 18 m
      h = Math.max(3, Math.min(h, 260));
      const cls = BUILDING_CLASS[p.class] ?? BUILDING_CLASS[p.subtype] ?? 0;
      buildings.push({ h: r1(h), k: known ? 1 : 0, c: cls, a: Math.round(area), p: ring.flat() });
    }
  }

  const roads = [];
  for (const f of rFc.features) {
    const p = f.properties || {};
    const cls = p.class;
    if (p.subtype === "rail" || cls === "subway" || !(cls in ROAD_WIDTH)) continue;
    const lines = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.type === "MultiLineString" ? f.geometry.coordinates : [];
    for (const line of lines) {
      const pts = line.map(proj);
      if (pts.length >= 2) roads.push({ w: ROAD_WIDTH[cls], f: ["footway", "path", "steps", "cycleway", "pedestrian"].includes(cls) ? 1 : 0, p: pts.flat() });
    }
  }

  const xs = buildings.flatMap((b) => b.p.filter((_, i) => i % 2 === 0));
  const zs = buildings.flatMap((b) => b.p.filter((_, i) => i % 2 === 1));
  const out = {
    id, name, attribution: ATTRIBUTION,
    center: [r1(lon0 * 1e5) / 1e5, r1(lat0 * 1e5) / 1e5],
    bounds: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)],
    buildings, roads,
  };
  const path = join(mapsDir, `${id}.city.json`);
  writeFileSync(path, JSON.stringify(out));
  console.log(`${id}: ${buildings.length} bangunan (tinggi dari data: ${buildings.filter((b) => b.k).length}), ${roads.length} jalan, dilewati ${JSON.stringify(skipped)}, ${Math.round(statSync(path).size / 1024)} KB`);
}

const only = process.argv[2];
for (const c of CITIES.filter((c) => !only || c.id === only)) buildCity(c);
