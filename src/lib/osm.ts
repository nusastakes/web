import { RELAYER_URL } from "./config";
import type { CityMap, MapBuilding, MapRoad } from "./scene/geometry";

/**
 * Area kota asli (R24): walikota memilih area di peta (pusat dan ukuran kotak), bangunan dan jalan di dalamnya diambil
 * sekali dari OpenStreetMap (Overpass API) lalu diubah di browser menjadi berkas kota yang sama dengan peta bawaan
 * (`scripts/prep-map.mjs`). `mapURI` kota menjadi `osm:<lat>,<lon>` (kotak 520 m) atau `osm:<lat>,<lon>@<ukuran>`, jadi
 * siapa pun bisa membangun ulang peta yang sama. Hasilnya disimpan di browser; bila semua server Overpass gagal, kota
 * memakai peta bawaan.
 */

const OVERPASS = [
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
/** Ukuran sisi kotak (m). 520 m bawaan; ukuran lain dicatat di `mapURI` setelah tanda `@`. */
export const DEFAULT_SIZE = 520;
export const AREA_SIZES = [
  { id: "small", size: 360 },
  { id: "mid", size: DEFAULT_SIZE },
  { id: "large", size: 800 },
] as const;
/** Batas bangunan per kota supaya ponsel tetap lancar; bangunan terjauh dari pusat dibuang lebih dulu. */
export const MAX_BUILDINGS = 2200;

/** Tempat cepat di Indonesia (titik tengah kawasan yang padat bangunan). */
export const QUICK_PLACES = [
  { name: "Blok M, Jakarta", lat: -6.2441, lon: 106.8000 },
  { name: "Braga, Bandung", lat: -6.9175, lon: 107.6095 },
  { name: "Malioboro, Yogyakarta", lat: -7.7928, lon: 110.3656 },
  { name: "Tunjungan, Surabaya", lat: -7.2611, lon: 112.7392 },
  { name: "Kota Lama, Semarang", lat: -6.9681, lon: 110.4275 },
  { name: "Kuta, Bali", lat: -8.7185, lon: 115.1700 },
];

const ROAD_WIDTH: Record<string, number> = {
  motorway: 12, trunk: 12, primary: 10, secondary: 8, tertiary: 7, residential: 6, unclassified: 6, living_street: 5,
  service: 3.4, pedestrian: 4, footway: 1.6, path: 1.4, cycleway: 1.8, steps: 1.4, track: 2.4,
};
const FOOT = new Set(["footway", "path", "steps", "cycleway", "pedestrian"]);
const CIVIC = /^(school|university|college|hospital|clinic|mosque|church|temple|cathedral|chapel|public|government|civic|train_station|transportation|kindergarten)$/;
const SHOP = /^(commercial|retail|office|hotel|supermarket|kiosk|shop|mall)$/;
const WORK = /^(industrial|warehouse|factory|manufacture)$/;

const r1 = (n: number) => Math.round(n * 10) / 10;
function hash01(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

export const osmUri = (lat: number, lon: number, size = DEFAULT_SIZE) => `osm:${lat.toFixed(5)},${lon.toFixed(5)}${size === DEFAULT_SIZE ? "" : `@${size}`}`;
export function parseOsmUri(id: string): { lat: number; lon: number; size: number } | null {
  const m = /^osm:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:@(\d{3,4}))?$/.exec(id);
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]), size = m[3] ? Number(m[3]) : DEFAULT_SIZE;
  return Math.abs(lat) <= 85 && Math.abs(lon) <= 180 && size >= 300 && size <= 1000 ? { lat, lon, size } : null;
}

export type Density = "sparse" | "medium" | "dense";
/** Kepadatan kasar dari jumlah bangunan per km² (patokan saya, bukan standar): di bawah 150 sepi, di bawah 500 sedang. */
export function densityOf(buildings: number, size: number): Density {
  const perKm2 = buildings / ((size / 1000) ** 2);
  return perKm2 < 150 ? "sparse" : perKm2 < 500 ? "medium" : "dense";
}

interface OverpassWay { type: "way"; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }

/**
 * Server Overpass publik sering sibuk atau menolak (504, 429): semua dicoba bersamaan dan jawaban pertama yang berhasil
 * dipakai, sisanya dibatalkan; bila semua gagal, satu putaran ulang setelah jeda singkat.
 */
async function overpass(query: string): Promise<OverpassWay[]> {
  let last: unknown;
  for (let round = 0; round < 2; round++) {
    if (round > 0) await new Promise((r) => setTimeout(r, 3000));
    const ctrls = OVERPASS.map(() => new AbortController());
    const timers = ctrls.map((c) => setTimeout(() => c.abort(), 40_000));
    try {
      const json = await Promise.any(OVERPASS.map(async (url, i) => {
        const res = await fetch(url, { method: "POST", body: new URLSearchParams({ data: query }), signal: ctrls[i].signal });
        if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
        return (await res.json()) as { elements?: OverpassWay[] };
      }));
      return (json.elements ?? []).filter((e) => e.type === "way");
    } catch (e) {
      last = e instanceof AggregateError ? e.errors.at(-1) : e;
    } finally {
      ctrls.forEach((c) => c.abort());
      timers.forEach(clearTimeout);
    }
  }
  throw new Error(`OpenStreetMap servers are busy (${last instanceof Error ? last.message : String(last)}). Try again in a minute.`);
}

/** Batas jumlah area tutupan lahan per kota (yang terluas didahulukan) dan titik per area, supaya muatan dan geometri kecil. */
const MAX_AREAS = 120;
const MAX_AREA_POINTS = 48;
const MIN_AREA_M2 = 40;

/** Air (0) atau hijau (1) dari tag OpenStreetMap; null bila bukan tutupan lahan yang dipakai. */
function landClass(t: Record<string, string>): 0 | 1 | null {
  if (t.natural === "water" || t.waterway === "riverbank") return 0;
  if (/^(park|garden|playground|pitch)$/.test(t.leisure ?? "") || /^(grass|forest|recreation_ground|meadow)$/.test(t.landuse ?? "") || /^(wood|grassland)$/.test(t.natural ?? "")) return 1;
  return null;
}

/** Menyederhanakan cincin (Douglas-Peucker) sampai paling banyak `max` titik; toleransi naik bertahap. */
function simplifyRing(ring: [number, number][], max: number): [number, number][] {
  let pts = ring;
  for (let tol = 0.8; pts.length > max && tol < 40; tol *= 1.6) {
    const keep = new Uint8Array(pts.length);
    keep[0] = 1; keep[pts.length - 1] = 1;
    const stack: [number, number][] = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop()!;
      let far = -1, fd = tol;
      const [ax, az] = pts[a], [bx, bz] = pts[b];
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9;
      for (let i = a + 1; i < b; i++) {
        const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - az) * dz) / l2));
        const d = Math.hypot(pts[i][0] - (ax + dx * t), pts[i][1] - (az + dz * t));
        if (d > fd) { fd = d; far = i; }
      }
      if (far >= 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
    }
    pts = pts.filter((_, i) => keep[i]);
  }
  return pts;
}

/** Tahap membangun peta kota (B2.21), untuk penanda kemajuan di pemilih area. */
export type BuildStage = "fetch" | "shape" | "ready";

/** Mengambil dan menyusun peta kota sekitar (lat, lon), kotak `size` meter. `onStage` melaporkan tahapnya. */
export async function buildOsmCity(lat: number, lon: number, name = "OpenStreetMap area", size = DEFAULT_SIZE, onStage?: (stage: BuildStage, ways?: number) => void): Promise<CityMap> {
  onStage?.("fetch");
  const HALF = size / 2;
  const kx = 111320 * Math.cos((lat * Math.PI) / 180), kz = 110574;
  const dLat = HALF / kz, dLon = HALF / kx;
  const bbox = `${(lat - dLat).toFixed(6)},${(lon - dLon).toFixed(6)},${(lat + dLat).toFixed(6)},${(lon + dLon).toFixed(6)}`;
  const ways = await overpass(`[out:json][timeout:25];(way["building"](${bbox});way["highway"](${bbox});way["natural"~"^(water|wood|grassland)$"](${bbox});way["waterway"="riverbank"](${bbox});way["leisure"~"^(park|garden|playground|pitch)$"](${bbox});way["landuse"~"^(grass|forest|recreation_ground|meadow)$"](${bbox}););out geom tags;`);
  onStage?.("shape", ways.length);
  // Beri peramban satu bingkai untuk menampilkan tahap ini sebelum pengolahan geometri yang sinkron.
  await new Promise((r) => setTimeout(r, 30));
  const proj = (p: { lat: number; lon: number }): [number, number] => [r1((p.lon - lon) * kx), r1(-(p.lat - lat) * kz)];

  const buildings: MapBuilding[] = [];
  const roads: MapRoad[] = [];
  const areas: { t: 0 | 1; a: number; p: number[] }[] = [];
  for (const w of ways) {
    const tags = w.tags ?? {};
    const geom = w.geometry ?? [];
    if (tags.building && tags.building !== "no" && geom.length >= 4) {
      let ring = geom.map(proj);
      if (ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1]) ring = ring.slice(0, -1);
      ring = ring.filter((pt, i) => i === 0 || pt[0] !== ring[i - 1][0] || pt[1] !== ring[i - 1][1]);
      if (ring.length < 3) continue;
      let a2 = 0, cx = 0, cz = 0;
      for (let i = 0; i < ring.length; i++) {
        const [x1, z1] = ring[i], [x2, z2] = ring[(i + 1) % ring.length];
        a2 += x1 * z2 - x2 * z1;
        cx += x1; cz += z1;
      }
      cx /= ring.length; cz /= ring.length;
      const area = Math.abs(a2) / 2;
      if (area < 8 || Math.abs(cx) > HALF || Math.abs(cz) > HALF) continue;
      const hTag = parseFloat(tags.height ?? "");
      const levels = parseFloat(tags["building:levels"] ?? "");
      let h = Number.isFinite(hTag) ? hTag : Number.isFinite(levels) ? levels * 3.4 + 1 : null;
      const known = h !== null;
      if (h === null) h = 6 + hash01(String(w.id)) * 12;
      h = Math.max(3, Math.min(h, 260));
      const kind = tags.building === "yes" ? tags.amenity ?? tags.shop ?? "" : tags.building;
      const c = CIVIC.test(kind) || tags.amenity === "place_of_worship" ? 3 : SHOP.test(kind) || tags.shop ? 1 : WORK.test(kind) ? 2 : 0;
      buildings.push({ h: r1(h), k: known ? 1 : 0, c, a: Math.round(area), p: ring.flat() });
    } else if (tags.highway) {
      const base = tags.highway.replace(/_link$/, "");
      const width = ROAD_WIDTH[base];
      if (!width || tags.tunnel === "yes" || tags.area === "yes") continue;
      // Potong ke kotak sedikit lebih besar dari area: jalan panjang tidak membentang ke luar kota.
      let cur: number[] = [];
      const lim = HALF + 40;
      for (const pt of geom.map(proj)) {
        if (Math.abs(pt[0]) <= lim && Math.abs(pt[1]) <= lim) cur.push(pt[0], pt[1]);
        else { if (cur.length >= 4) roads.push({ w: width, f: FOOT.has(base) ? 1 : 0, p: cur }); cur = []; }
      }
      if (cur.length >= 4) roads.push({ w: width, f: FOOT.has(base) ? 1 : 0, p: cur });
    } else {
      // Tutupan lahan (air dan hijau): hanya way tertutup; relasi besar (danau multipoligon) belum dipakai.
      const t = landClass(tags);
      if (t === null || geom.length < 4) continue;
      let ring = geom.map(proj);
      if (ring[0][0] !== ring.at(-1)![0] || ring[0][1] !== ring.at(-1)![1]) continue;
      ring = ring.slice(0, -1).filter((pt, i, arr) => i === 0 || pt[0] !== arr[i - 1][0] || pt[1] !== arr[i - 1][1]);
      if (ring.length < 3) continue;
      // Luas dihitung pada bentuk asli; titik di luar kotak dijepit supaya area besar tidak melewati tepi kota.
      let a2 = 0;
      for (let i = 0; i < ring.length; i++) { const [x1, z1] = ring[i], [x2, z2] = ring[(i + 1) % ring.length]; a2 += x1 * z2 - x2 * z1; }
      const area = Math.abs(a2) / 2;
      if (area < MIN_AREA_M2 || ring.every(([x, z]) => Math.abs(x) > HALF + 40 || Math.abs(z) > HALF + 40)) continue;
      const lim = HALF + 40;
      const clamped = simplifyRing(ring, MAX_AREA_POINTS).map(([x, z]): [number, number] => [Math.max(-lim, Math.min(lim, x)), Math.max(-lim, Math.min(lim, z))]);
      if (clamped.length >= 3) areas.push({ t, a: area, p: clamped.flat() });
    }
  }
  areas.sort((a, b) => b.a - a.a);
  areas.length = Math.min(areas.length, MAX_AREAS);
  if (buildings.length < 5) throw new Error("There are almost no buildings mapped here. Try a busier place.");
  if (buildings.length > MAX_BUILDINGS) {
    buildings.sort((a, b) => Math.hypot(a.p[0], a.p[1]) - Math.hypot(b.p[0], b.p[1]));
    buildings.length = MAX_BUILDINGS;
  }
  const xs = buildings.flatMap((b) => b.p.filter((_, i) => i % 2 === 0));
  const zs = buildings.flatMap((b) => b.p.filter((_, i) => i % 2 === 1));
  onStage?.("ready");
  return {
    id: osmUri(lat, lon, size), name, attribution: OSM_ATTRIBUTION,
    center: [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5],
    bounds: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)],
    buildings, roads, areas: areas.map(({ t, p }) => ({ t, p })),
  };
}

const cacheKey = (id: string) => `nusastakes.map.v2.${id}`;

/** Peta OSM dengan cache browser; bila gagal mengembalikan null supaya pemanggil memakai peta bawaan. */
export async function loadOsmCity(id: string): Promise<CityMap | null> {
  try {
    const hit = localStorage.getItem(cacheKey(id));
    if (hit) return JSON.parse(hit) as CityMap;
  } catch { /* cache tidak tersedia */ }
  const at = parseOsmUri(id);
  if (!at) return null;
  // Relayer menyimpan peta yang sudah jadi (bila tersedia), jadi penonton tidak menunggu Overpass.
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    const res = await fetch(`${RELAYER_URL}/map/${encodeURIComponent(id)}`, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
    if (res.ok) {
      const map = (await res.json()) as CityMap;
      if (Array.isArray(map.buildings) && map.buildings.length) { rememberOsmCity({ ...map, id }); return { ...map, id }; }
    }
  } catch { /* relayer belum punya /map: ambil sendiri dari OpenStreetMap */ }
  try {
    const map = await buildOsmCity(at.lat, at.lon, undefined, at.size);
    rememberOsmCity(map);
    return map;
  } catch {
    return null;
  }
}

export function rememberOsmCity(map: CityMap) {
  try { localStorage.setItem(cacheKey(map.id), JSON.stringify(map)); } catch { /* penuh atau diblokir: abaikan */ }
}

export interface PlaceHit { name: string; lat: number; lon: number }
/** Pencarian tempat lewat Nominatim (OpenStreetMap), dipanggil hanya saat walikota menekan Cari. */
export async function searchPlaces(q: string): Promise<PlaceHit[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Place search failed (${res.status}).`);
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return rows.map((r) => ({ name: r.display_name.split(",").slice(0, 3).join(","), lat: Number(r.lat), lon: Number(r.lon) }));
}
