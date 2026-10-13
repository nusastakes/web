import { RELAYER_URL } from "./config";
import type { CityMap, MapBuilding, MapRoad } from "./scene/geometry";

/**
 * Area kota asli (R24): walikota memilih tempat, bangunan dan jalan sekitar 500 x 500 m diambil sekali dari
 * OpenStreetMap (Overpass API) lalu diubah di browser menjadi berkas kota yang sama dengan peta bawaan
 * (`scripts/prep-map.mjs`). `mapURI` kota menjadi `osm:<lat>,<lon>`, jadi siapa pun bisa membangun ulang peta yang sama.
 * Hasilnya disimpan di browser; bila semua server Overpass gagal, kota memakai peta bawaan.
 */

const OVERPASS = [
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
const HALF = 260;

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

export const osmUri = (lat: number, lon: number) => `osm:${lat.toFixed(5)},${lon.toFixed(5)}`;
export function parseOsmUri(id: string): { lat: number; lon: number } | null {
  const m = /^osm:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(id);
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]);
  return Math.abs(lat) <= 85 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

interface OverpassWay { type: "way"; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }

async function overpass(query: string): Promise<OverpassWay[]> {
  let last: unknown;
  for (const url of OVERPASS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const res = await fetch(url, { method: "POST", body: new URLSearchParams({ data: query }), signal: ctrl.signal });
      if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
      const json = (await res.json()) as { elements?: OverpassWay[] };
      return (json.elements ?? []).filter((e) => e.type === "way");
    } catch (e) {
      last = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`OpenStreetMap servers are busy (${last instanceof Error ? last.message : String(last)}). Try again in a minute.`);
}

/** Mengambil dan menyusun peta kota sekitar (lat, lon). */
export async function buildOsmCity(lat: number, lon: number, name = "OpenStreetMap area"): Promise<CityMap> {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180), kz = 110574;
  const dLat = HALF / kz, dLon = HALF / kx;
  const bbox = `${(lat - dLat).toFixed(6)},${(lon - dLon).toFixed(6)},${(lat + dLat).toFixed(6)},${(lon + dLon).toFixed(6)}`;
  const ways = await overpass(`[out:json][timeout:25];(way["building"](${bbox});way["highway"](${bbox}););out geom tags;`);
  const proj = (p: { lat: number; lon: number }): [number, number] => [r1((p.lon - lon) * kx), r1(-(p.lat - lat) * kz)];

  const buildings: MapBuilding[] = [];
  const roads: MapRoad[] = [];
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
    }
  }
  if (buildings.length < 5) throw new Error("There are almost no buildings mapped here. Try a busier place.");
  const xs = buildings.flatMap((b) => b.p.filter((_, i) => i % 2 === 0));
  const zs = buildings.flatMap((b) => b.p.filter((_, i) => i % 2 === 1));
  return {
    id: osmUri(lat, lon), name, attribution: OSM_ATTRIBUTION,
    center: [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5],
    bounds: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)],
    buildings, roads,
  };
}

const cacheKey = (id: string) => `nusastakes.map.v1.${id}`;

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
    const map = await buildOsmCity(at.lat, at.lon);
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
