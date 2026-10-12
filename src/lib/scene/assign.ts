import type { District } from "../types";
import type { MapBuilding } from "./geometry";

/**
 * Membagi bangunan ke distrik menurut bobot dana. Bangunan diurutkan menurut sudut dari pusat kota, lalu dipotong
 * berurutan, jadi tiap distrik berbentuk irisan yang utuh dan hasilnya sama setiap kali (tanpa acak).
 */
export function assignDistricts(buildings: MapBuilding[], districts: District[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  const live = districts.filter((d) => d.weight > 0);
  if (buildings.length === 0 || live.length === 0) return out;

  const order = buildings
    .map((b, i) => {
      let sx = 0, sz = 0;
      const n = b.p.length / 2;
      for (let k = 0; k < n; k++) { sx += b.p[k * 2]; sz += b.p[k * 2 + 1]; }
      return { i, ang: Math.atan2(sz / n, sx / n) };
    })
    .sort((a, b) => a.ang - b.ang);

  const total = live.reduce((s, d) => s + d.weight, 0);
  const n = order.length;
  let cursor = 0;
  let acc = 0;
  live.forEach((d, di) => {
    acc += d.weight / total;
    const end = di === live.length - 1 ? n : Math.max(cursor + 1, Math.round(acc * n));
    out.set(d.id, order.slice(cursor, Math.min(end, n)).map((o) => o.i));
    cursor = Math.min(end, n);
  });
  return out;
}

/** Pusat sebuah himpunan bangunan (rata-rata titik tengah). */
export function centroid(buildings: MapBuilding[], indices: number[]): [number, number] {
  let sx = 0, sz = 0, c = 0;
  for (const i of indices) {
    const b = buildings[i];
    const n = b.p.length / 2;
    for (let k = 0; k < n; k++) { sx += b.p[k * 2]; sz += b.p[k * 2 + 1]; c++; }
  }
  return c ? [sx / c, sz / c] : [0, 0];
}
