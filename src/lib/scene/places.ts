import { hash01, type CityMap } from "./geometry";
import type { RoadGraph } from "./roadgraph";
import { tr } from "../lang";

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

/** Nama fiktif per jenis tempat: [Inggris, Indonesia]. Nama dipilih saat ditampilkan, mengikuti bahasa yang dipakai. */
const FOOD: [string, string][] = [["Bu Sri's Food Stall", "Warung Bu Sri"], ["Pak Darto's Meatball Soup", "Bakso Pak Darto"], ["Cak Ali's Madura Satay", "Sate Madura Cak Ali"], ["Sunset Coffee", "Kopi Senja"], ["Minang Padang Rice", "Nasi Padang Minang"], ["Mas Bejo's Chicken Noodles", "Mie Ayam Mas Bejo"], ["Bang Udin's Betawi Soup", "Soto Betawi Bang Udin"], ["Cahaya Sweet Pancakes", "Martabak Manis Cahaya"], ["Bu Tini's Gudeg", "Gudeg Bu Tini"], ["Mbak Rara's Smashed Chicken", "Ayam Geprek Mbak Rara"], ["Nusantara Sweet Tea", "Es Teh Manis Nusantara"], ["Mas Dodi's Toast", "Roti Bakar Mas Dodi"], ["Lamongan Fried Catfish", "Pecel Lele Lamongan"], ["Teh Rina's Seblak", "Seblak Teh Rina"], ["Lantern Coffee House", "Kedai Kopi Lentera"]];
const SHOP: [string, string][] = [["Maju Jaya Store", "Toko Maju Jaya"], ["Sehat Pharmacy", "Apotek Sehat"], ["Minimarket 24", "Minimarket 24"], ["Berkah Grocery", "Toko Kelontong Berkah"], ["Express Laundry", "Laundry Kilat"], ["Sinar Motorbike Repair", "Bengkel Motor Sinar"], ["Rainbow Bookshop", "Toko Buku Pelangi"], ["Abadi Phone Credit", "Konter Pulsa Abadi"], ["Sentosa Hardware", "Toko Bangunan Sentosa"], ["Ayu Kebaya Boutique", "Butik Kebaya Ayu"], ["Terang Jaya Optician", "Optik Terang Jaya"], ["Harum Bakery", "Toko Roti Harum"]];
const OFFICE: [string, string][] = [["Nusa Tower", "Menara Nusa"], ["Samudra House", "Graha Samudra"], ["Cakrawala Building", "Wisma Cakrawala"], ["Arunika Plaza", "Plaza Arunika"], ["Cendana Tower", "Tower Cendana"], ["Bahari Raya Building", "Gedung Bahari Raya"], ["Lintang Tower", "Menara Lintang"], ["Pertiwi Nusa House", "Graha Pertiwi Nusa"], ["Nusastakes Trade Centre", "Sentral Niaga Nusastakes"], ["Kencana Biru Building", "Wisma Kencana Biru"]];
const CIVIC: [string, string][] = [["State Primary School 03", "SD Negeri 03"], ["Al-Ikhlas Mosque", "Masjid Al-Ikhlas"], ["District Health Centre", "Puskesmas Kecamatan"], ["Village Office", "Kantor Kelurahan"], ["State Junior High School 12", "SMP Negeri 12"], ["City Library", "Perpustakaan Kota"], ["St Joseph's Church", "Gereja Santo Yosef"], ["Primary Clinic", "Klinik Pratama"]];
const HOME: [string, string][] = [["Pak Budi's House", "Rumah Pak Budi"], ["Melati Boarding House", "Kos Melati"], ["Taman Sari Apartments", "Apartemen Taman Sari"], ["Bu Ani's House", "Rumah Bu Ani"], ["Green Rental House", "Kontrakan Hijau"], ["Siregar Family Home", "Rumah Keluarga Siregar"], ["Mawar Women's Boarding House", "Kos Putri Mawar"], ["Pak Made's House", "Rumah Pak Made"], ["Kemang Asri Apartments", "Apartemen Kemang Asri"], ["Oma Lien's House", "Rumah Oma Lien"]];

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
    const [en, id] = names[counters[kind]++ % names.length];
    const suffix = counters[kind] > names.length ? ` ${Math.ceil(counters[kind] / names.length)}` : "";
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
    out.push({ kind, get name() { return tr(en, id) + suffix; }, x, z, veh: v.node, ped: p.node, building: i, door: { x: best.x + ox * 0.6, z: best.z + oz * 0.6 }, out: { x: ox, z: oz } });
  });
  return out;
}
