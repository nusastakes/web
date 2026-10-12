import { hash01, type CityMap } from "./geometry";
import type { RoadGraph } from "./roadgraph";

/**
 * Tempat di kota: rumah, kantor, toko dan warung, serta fasilitas umum, ditebak dari tinggi, kelas, dan letak bangunan
 * di peta. Tiap tempat punya simpul jalan (untuk kendaraan) dan simpul trotoar (untuk orang), serta nama fiktif
 * (sengaja bukan nama usaha sungguhan).
 */

export type PlaceKind = "home" | "office" | "food" | "shop" | "civic";
export interface Place {
  kind: PlaceKind;
  name: string;
  x: number;
  z: number;
  /** Simpul kendaraan dan simpul pejalan terdekat. */
  veh: number;
  ped: number;
  building: number;
  /** Titik pintu di dinding gedung yang paling dekat dengan trotoar. */
  door: { x: number; z: number };
  /** Arah keluar dari pintu (satuan). */
  out: { x: number; z: number };
}

const FOOD = ["Warung Bu Sri", "Bakso Pak Darto", "Sate Madura Cak Ali", "Kopi Senja", "Nasi Padang Minang", "Mie Ayam Mas Bejo", "Soto Betawi Bang Udin", "Martabak Manis Cahaya", "Gudeg Bu Tini", "Ayam Geprek Mbak Rara", "Es Teh Manis Nusantara", "Roti Bakar Mas Dodi", "Pecel Lele Lamongan", "Seblak Teh Rina", "Kedai Kopi Lentera"];
const SHOP = ["Toko Maju Jaya", "Apotek Sehat", "Minimarket 24", "Toko Kelontong Berkah", "Laundry Kilat", "Bengkel Motor Sinar", "Toko Buku Pelangi", "Konter Pulsa Abadi", "Toko Bangunan Sentosa", "Butik Kebaya Ayu", "Optik Terang Jaya", "Toko Roti Harum"];
const OFFICE = ["Menara Nusa", "Graha Samudra", "Wisma Cakrawala", "Plaza Arunika", "Tower Cendana", "Gedung Bahari Raya", "Menara Lintang", "Graha Pertiwi Nusa", "Sentral Niaga Nusastakes", "Wisma Kencana Biru"];
const CIVIC = ["SD Negeri 03", "Masjid Al-Ikhlas", "Puskesmas Kecamatan", "Kantor Kelurahan", "SMP Negeri 12", "Perpustakaan Kota", "Gereja Santo Yosef", "Klinik Pratama"];
const HOME = ["Rumah Pak Budi", "Kos Melati", "Apartemen Taman Sari", "Rumah Bu Ani", "Kontrakan Hijau", "Rumah Keluarga Siregar", "Kos Putri Mawar", "Rumah Pak Made", "Apartemen Kemang Asri", "Rumah Oma Lien"];

export function findPlaces(map: CityMap, g: RoadGraph): Place[] {
  const out: Place[] = [];
  const counters: Record<PlaceKind, number> = { home: 0, office: 0, food: 0, shop: 0, civic: 0 };
  const near = (x: number, z: number, list: number[]) => {
    let best = list[0] ?? 0, bd = Infinity;
    for (const n of list) { const d = Math.hypot(g.x[n] - x, g.z[n] - z); if (d < bd) { bd = d; best = n; } }
    return { node: best, d: bd };
  };
  map.buildings.forEach((b, i) => {
    let sx = 0, sz = 0;
    const n = b.p.length / 2;
    for (let k = 0; k < n; k++) { sx += b.p[k * 2]; sz += b.p[k * 2 + 1]; }
    const x = sx / n, z = sz / n;
    const v = near(x, z, g.main.veh);
    const p = near(x, z, g.main.ped);
    const r = hash01(i * 3.7 + 11);
    let kind: PlaceKind;
    if (b.c === 3) kind = "civic";
    else if (b.h >= 40 || (b.c === 1 && b.h >= 20)) kind = "office";
    else if ((b.c === 1 || p.d < 30) && r < 0.32) kind = r < 0.17 ? "food" : "shop";
    else kind = "home";
    const names = kind === "food" ? FOOD : kind === "shop" ? SHOP : kind === "office" ? OFFICE : kind === "civic" ? CIVIC : HOME;
    const name = names[counters[kind]++ % names.length] + (counters[kind] > names.length ? ` ${Math.ceil(counters[kind] / names.length)}` : "");
    // Pintu: titik terdekat di dinding ke simpul trotoar, sedikit di luar dinding.
    const px = g.x[p.node] ?? x, pz = g.z[p.node] ?? z;
    let best = { x, z, d: Infinity };
    for (let k = 0; k < n; k++) {
      const ax = b.p[k * 2], az = b.p[k * 2 + 1], bx = b.p[((k + 1) % n) * 2], bz = b.p[((k + 1) % n) * 2 + 1];
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9;
      const tt = Math.max(0.1, Math.min(0.9, ((px - ax) * dx + (pz - az) * dz) / l2));
      const qx = ax + dx * tt, qz = az + dz * tt, d = Math.hypot(px - qx, pz - qz);
      if (d < best.d) best = { x: qx, z: qz, d };
    }
    const ol = Math.hypot(px - best.x, pz - best.z) || 1;
    const ox = (px - best.x) / ol, oz = (pz - best.z) / ol;
    out.push({ kind, name, x, z, veh: v.node, ped: p.node, building: i, door: { x: best.x + ox * 0.6, z: best.z + oz * 0.6 }, out: { x: ox, z: oz } });
  });
  return out;
}
