import * as THREE from "three";
import { buildRoadsGeometry, distToPolygonEdge, hash01, pointInPolygon, type CityMap, type MapRoad } from "./geometry";
import { tierOf, type RoadGraph } from "./roadgraph";
import { Layered, box, merge, part, toonRamp, type Model } from "./props";
import { asphaltTex, grassTex, tileTex } from "./textures";
import { THEMES, type Theme } from "./themes";

/**
 * Penata kota: dari peta (bangunan dan jalan) membentuk jaringan jalan bertingkat, trotoar, marka, zebra cross,
 * lampu jalan, pohon bergaya balok, dan taman dari ruang kosong di antara bangunan. Semuanya generik, tidak khusus satu peta.
 *
 * Kota tumbuh: `setDevelopment(d)` (0..1) memunculkan jalan besar dahulu, lalu jalan kecil, lampu, pohon, dan taman.
 */

/** Perkembangan kota saat tiap tingkat jalan (0 = arteri, 1 = jalan, 2 = gang, 3 = jalur pejalan) muncul. */
export const TIER_AT = [0, 0.1, 0.28, 0.45];
const TIER_FADE = 0.06;
const REVEAL = 0.05;

const TREE_TINTS = ["#6fcf97", "#5bc08a", "#7fd6a0", "#4fb57f", "#8fdc9f"].map((c) => new THREE.Color(c));
const ROAD_COLORS = [0xd3daf1, 0xd3daf1, 0xdde3f6, 0xf3f5ff];
const SIDEWALK = 0xeef1ff;
const PARK = 0xc8ebd2;
const CELL = 8;

interface Item { x: number; z: number; rot: number; scale: number; order: number }
interface Seg { ax: number; az: number; bx: number; bz: number; half: number; road: number }

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function treeModel(): Model {
  return {
    tint: merge([part(box(3, 2, 3), 0xffffff, 0, 3.4, 0), part(box(2, 1.4, 2), 0xffffff, 0, 5.1, 0)]),
    fixed: merge([part(box(0.6, 2.4, 0.6), 0x9a7656, 0, 1.2, 0)]),
  };
}

/** Pohon kelapa: batang beruas yang sedikit miring, pelepah daun menjuntai, dan buah kelapa. */
function palmModel(): Model {
  const trunk: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) trunk.push(part(box(0.62 - k * 0.05, 1.62, 0.62 - k * 0.05), k % 2 ? 0x8a6748 : 0x9a7656, k * k * 0.04, 0.8 + k * 1.55, 0));
  const topX = 0.64, topY = 7.9;
  const fronds: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 7; k++) {
    fronds.push(part(new THREE.BoxGeometry(3.6, 0.12, 0.8).translate(1.8, 0, 0).rotateZ(-0.42 - (k % 2) * 0.12).rotateY((k / 7) * Math.PI * 2), 0xffffff, topX, topY, 0));
  }
  trunk.push(part(box(0.45, 0.45, 0.45), 0x5a4030, topX + 0.35, topY - 0.35, 0.2), part(box(0.45, 0.45, 0.45), 0x5a4030, topX - 0.25, topY - 0.4, -0.3));
  return { tint: merge(fronds), fixed: merge(trunk) };
}

/** Perabot trotoar: bangku kayu, tempat sampah hijau, dan pot tanaman. */
function benchModel(): Model {
  return { tint: merge([part(box(2.2, 0.16, 0.7), 0xffffff, 0, 0.55, 0), part(box(2.2, 0.5, 0.12), 0xffffff, 0, 0.9, -0.32)]), fixed: merge([part(box(0.14, 0.5, 0.6), 0x6b7597, -0.9, 0.25, 0), part(box(0.14, 0.5, 0.6), 0x6b7597, 0.9, 0.25, 0)]) };
}
function binModel(): Model {
  return { tint: merge([part(box(0.75, 1.0, 0.75), 0xffffff, 0, 0.5, 0)]), fixed: merge([part(box(0.82, 0.1, 0.82), 0x39456f, 0, 1.05, 0)]) };
}
function planterModel(): Model {
  return { tint: merge([part(new THREE.IcosahedronGeometry(0.9, 0).scale(1, 0.8, 1), 0xffffff, 0, 1.35, 0)]), fixed: merge([part(box(1.4, 0.75, 1.4), 0xd7d3c8, 0, 0.38, 0)]) };
}

function lampModel(): Model {
  return {
    tint: merge([part(box(0.9, 0.25, 0.5), 0xffe9a8, 1.5, 5.15, 0)]),
    fixed: merge([part(box(0.4, 0.3, 0.4), 0xb9c1dc, 0, 0.15, 0), part(box(0.22, 5.2, 0.22), 0xd9deef, 0, 2.7, 0), part(box(1.6, 0.14, 0.14), 0xd9deef, 0.75, 5.3, 0)]),
  };
}

/** Kumpulan benda yang muncul satu per satu saat perkembangan melewati `order` masing-masing. */
class RevealSet {
  private slots: number[] = [];
  private dummy = new THREE.Object3D();
  constructor(private layered: Layered, private items: Item[], tints?: THREE.Color[]) {
    items.forEach((_, i) => {
      const s = layered.acquire();
      this.slots.push(s);
      if (tints) layered.color(s, tints[i % tints.length]);
    });
  }
  recolor(tints: THREE.Color[]) {
    this.slots.forEach((s, i) => this.layered.color(s, tints[i % tints.length]));
  }
  apply(dev: number) {
    this.items.forEach((it, i) => {
      const k = clamp01((dev - it.order) / REVEAL);
      const s = k * (2 - k);
      if (s <= 0.001) { this.layered.hide(this.slots[i]); return; }
      this.dummy.position.set(it.x, 0, it.z);
      this.dummy.rotation.set(0, it.rot, 0);
      this.dummy.scale.setScalar(it.scale * s);
      this.dummy.updateMatrix();
      this.layered.set(this.slots[i], this.dummy.matrix);
    });
    this.layered.flush();
  }
}

export class CityFabric {
  private group = new THREE.Group();
  private tierGroups: THREE.Group[] = [new THREE.Group(), new THREE.Group(), new THREE.Group(), new THREE.Group()];
  private tierMats: THREE.MeshBasicMaterial[][] = [[], [], [], []];
  private sets: RevealSet[] = [];
  private layers: Layered[] = [];
  private parks: { mesh: THREE.Group; order: number }[] = [];
  private parkMats: THREE.MeshBasicMaterial[] = [];
  /** Warna dasar bahan tanpa cahaya (jalan, trotoar, taman), untuk diredupkan saat malam. */
  private baseColors = new Map<THREE.MeshBasicMaterial, THREE.Color>();
  private night = 0;
  private treeSet: RevealSet | null = null;
  private lampReveal: RevealSet | null = null;
  private palmSet: RevealSet | null = null;
  private lampItems: Item[] = [];
  private bulbs: THREE.InstancedMesh | null = null;
  private pools: THREE.InstancedMesh | null = null;
  private poolMat: THREE.MeshBasicMaterial | null = null;
  private bulbMat: THREE.MeshBasicMaterial | null = null;
  /** Posisi semua pohon (untuk uji tata letak). */
  treeItems: { x: number; z: number }[] = [];
  private blockedFn: ((x: number, z: number, m: number) => boolean) | null = null;
  private onRoadFn: ((x: number, z: number, m: number, ignore: number) => boolean) | null = null;
  /** Taman yang ditemukan, dari yang terbesar: pusat, radius, dan titik tengah tiap petaknya (untuk karya sipil). */
  parkSpots: { x: number; z: number; r: number; cells: { x: number; z: number }[] }[] = [];
  private dev = -1;

  /** Banyaknya hal yang dibangun, untuk laporan dan uji. */
  readonly stats = { lamps: 0, trees: 0, parks: 0, zebras: 0 };

  constructor(private parent: THREE.Object3D, private map: CityMap, private graph: RoadGraph) {
    parent.add(this.group);
    for (const g of this.tierGroups) this.group.add(g);
    this.buildRoads();
    this.buildFurniture();
  }

  private mat(tier: number, color: number, offset: number, map?: THREE.Texture): THREE.MeshBasicMaterial {
    const m = new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset });
    this.tierMats[tier].push(m);
    return m;
  }

  // -------------------------------------------------------------------------------------------------------------
  // Jalan, trotoar, marka, zebra
  // -------------------------------------------------------------------------------------------------------------

  private buildRoads() {
    const byTier: MapRoad[][] = [[], [], [], []];
    for (const r of this.map.roads) byTier[tierOf(r.w, !!r.f)].push(r);

    byTier.forEach((roads, t) => {
      if (!roads.length) return;
      const g = this.tierGroups[t];
      if (t <= 1) {
        const walk = new THREE.Mesh(buildRoadsGeometry(roads.map((r) => ({ ...r, w: r.w + 3.4 })), 0.025, 4.8), this.mat(t, SIDEWALK, -1, tileTex()));
        walk.renderOrder = -1;
        g.add(walk);
      }
      const road = new THREE.Mesh(buildRoadsGeometry(roads, t === 3 ? 0.07 : 0.04, t === 3 ? 3.6 : 6), this.mat(t, ROAD_COLORS[t], t === 3 ? -4 : -2, t === 3 ? tileTex() : asphaltTex()));
      road.renderOrder = -1;
      g.add(road);
    });

    // Marka putus-putus di tengah jalan lebar.
    for (const t of [0, 1]) {
      const pos: number[] = [], idx: number[] = [];
      let base = 0;
      for (const r of byTier[t]) {
        if (r.w < 7) continue;
        walk(r.p, 8.2, 1, (x, z, dx, dz) => {
          const px = -dz * 0.2, pz = dx * 0.2, x1 = x + dx * 3.2, z1 = z + dz * 3.2;
          pos.push(x - px, 0.1, z - pz, x + px, 0.1, z + pz, x1 - px, 0.1, z1 - pz, x1 + px, 0.1, z1 + pz);
          idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
          base += 4;
        });
      }
      if (pos.length) this.tierGroups[t].add(this.flatMesh(pos, idx, this.mat(t, 0xffffff, -6)));
    }

    // Zebra cross di tiap kaki persimpangan.
    for (const t of [0, 1]) {
      const pos: number[] = [], idx: number[] = [];
      let base = 0;
      const g = this.graph;
      for (let n = 0; n < g.x.length; n++) {
        const legs = g.adj[n].filter((e) => !e.foot && e.w >= 5);
        if (legs.length < 3) continue;
        for (const e of legs) {
          if (e.tier !== t || e.len < 18) continue;
          const dx = (g.x[e.to] - g.x[n]) / e.len, dz = (g.z[e.to] - g.z[n]) / e.len;
          const q = e.w / 2 + 2.4;
          const bars = Math.floor((e.w * 0.9) / 1.2);
          for (let k = 0; k < bars; k++) {
            const lat = (k - (bars - 1) / 2) * 1.2;
            const cx = g.x[n] + dx * q + dz * lat, cz = g.z[n] + dz * q - dx * lat;
            const hx = dx * 1.3, hz = dz * 1.3, wx = dz * 0.3, wz = -dx * 0.3;
            pos.push(cx - hx - wx, 0.1, cz - hz - wz, cx - hx + wx, 0.1, cz - hz + wz, cx + hx - wx, 0.1, cz + hz - wz, cx + hx + wx, 0.1, cz + hz + wz);
            idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
            base += 4;
          }
          this.stats.zebras++;
        }
      }
      if (pos.length) this.tierGroups[t].add(this.flatMesh(pos, idx, this.mat(t, 0xffffff, -6)));
    }
  }

  private flatMesh(pos: number[], idx: number[], mat: THREE.Material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = 0;
    return m;
  }

  // -------------------------------------------------------------------------------------------------------------
  // Lampu, pohon, taman
  // -------------------------------------------------------------------------------------------------------------

  private buildFurniture() {
    const map = this.map;
    const [bx0, bz0, bx1, bz1] = map.bounds;

    // Indeks bangunan (sel 48 m) dan ruas jalan (sel 24 m) untuk uji tabrakan.
    const bGrid = new Map<string, number[]>();
    const bBox = map.buildings.map((b) => {
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (let i = 0; i < b.p.length; i += 2) { x0 = Math.min(x0, b.p[i]); x1 = Math.max(x1, b.p[i]); z0 = Math.min(z0, b.p[i + 1]); z1 = Math.max(z1, b.p[i + 1]); }
      return [x0, z0, x1, z1] as const;
    });
    const bc = 48;
    bBox.forEach((bb, i) => {
      for (let gx = Math.floor((bb[0] - 6) / bc); gx <= Math.floor((bb[2] + 6) / bc); gx++)
        for (let gz = Math.floor((bb[1] - 6) / bc); gz <= Math.floor((bb[3] + 6) / bc); gz++) {
          const k = `${gx},${gz}`;
          (bGrid.get(k) ?? bGrid.set(k, []).get(k)!).push(i);
        }
    });
    const blocked = (px: number, pz: number, margin: number) => {
      for (const bi of bGrid.get(`${Math.floor(px / bc)},${Math.floor(pz / bc)}`) ?? []) {
        const bb = bBox[bi];
        if (px < bb[0] - margin || px > bb[2] + margin || pz < bb[1] - margin || pz > bb[3] + margin) continue;
        const p = map.buildings[bi].p;
        if (pointInPolygon(px, pz, p) || distToPolygonEdge(px, pz, p) < margin) return true;
      }
      return false;
    };

    const sGrid = new Map<string, Seg[]>();
    const rc = 24, pad = 14;
    map.roads.forEach((r, ri) => {
      for (let i = 1; i < r.p.length / 2; i++) {
        const s: Seg = { ax: r.p[i * 2 - 2], az: r.p[i * 2 - 1], bx: r.p[i * 2], bz: r.p[i * 2 + 1], half: r.w / 2 + (r.f ? 0 : 1.7), road: ri };
        for (let gx = Math.floor((Math.min(s.ax, s.bx) - pad) / rc); gx <= Math.floor((Math.max(s.ax, s.bx) + pad) / rc); gx++)
          for (let gz = Math.floor((Math.min(s.az, s.bz) - pad) / rc); gz <= Math.floor((Math.max(s.az, s.bz) + pad) / rc); gz++) {
            const k = `${gx},${gz}`;
            (sGrid.get(k) ?? sGrid.set(k, []).get(k)!).push(s);
          }
      }
    });
    /** Titik menyentuh badan jalan mana pun (selain jalan `ignore`) dengan jarak aman `margin`? */
    const onRoad = (px: number, pz: number, margin: number, ignore: number) => {
      for (const s of sGrid.get(`${Math.floor(px / rc)},${Math.floor(pz / rc)}`) ?? []) {
        if (s.road === ignore) continue;
        const dx = s.bx - s.ax, dz = s.bz - s.az;
        const l2 = dx * dx + dz * dz || 1e-9;
        const t = clamp01(((px - s.ax) * dx + (pz - s.az) * dz) / l2);
        if (Math.hypot(px - (s.ax + dx * t), pz - (s.az + dz * t)) < s.half + margin) return true;
      }
      return false;
    };

    this.blockedFn = blocked;
    this.onRoadFn = onRoad;

    // Persimpangan: lampu dan pohon dijauhkan dari sana supaya penyeberangan bebas.
    const jGrid = new Map<string, boolean>();
    const g = this.graph;
    for (let n = 0; n < g.x.length; n++) {
      if (g.adj[n].filter((e) => !e.foot && e.w >= 5).length < 3) continue;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) jGrid.set(`${Math.floor(g.x[n] / 12) + dx},${Math.floor(g.z[n] / 12) + dz}`, true);
    }
    const nearJunction = (px: number, pz: number) => jGrid.has(`${Math.floor(px / 12)},${Math.floor(pz / 12)}`);

    const lamps: Item[] = [], trees: Item[] = [], palms: Item[] = [], benches: Item[] = [], bins: Item[] = [], planters: Item[] = [];
    const taken = new Set<string>();
    map.roads.forEach((r, ri) => {
      if (r.f) return;
      const tier = tierOf(r.w, false);
      if (tier > 1 || r.w < 7) return;
      const base = TIER_AT[tier];
      // Pohon bergantian di dua sisi, lampu di sisi yang lain agar tidak berimpit.
      walk(r.p, 15, 4 + hash01(ri * 3.3) * 5, (x, z, dx, dz, k) => {
        if (trees.length >= 900) return;
        const side = k % 2 === 0 ? 1 : -1;
        const off = r.w / 2 + 2.9;
        const px = x + dz * off * side, pz = z - dx * off * side;
        const key = `${Math.round(px / 6)},${Math.round(pz / 6)}`;
        if (taken.has(key) || nearJunction(px, pz) || blocked(px, pz, 2.2) || onRoad(px, pz, 0.8, ri)) return;
        taken.add(key);
        const it = { x: px, z: pz, rot: hash01(px * 0.7 + pz) * 6.28, scale: 0.7 + hash01(px * 0.31 + pz) * 0.35, order: base + 0.05 + hash01(px + pz * 1.3) * 0.32 };
        // Jalan besar dihiasi pohon kelapa, jalan lain pohon peneduh.
        if (r.w >= 8 && hash01(ri * 1.9 + k) < 0.7) palms.push({ ...it, scale: 0.9 + hash01(px + pz) * 0.3 }); else trees.push(it);
      });
      walk(r.p, 30, 11 + hash01(ri * 1.7) * 6, (x, z, dx, dz, k) => {
        if (lamps.length >= 520) return;
        const side = k % 2 === 0 ? -1 : 1;
        const off = r.w / 2 + 1.1;
        const px = x + dz * off * side, pz = z - dx * off * side;
        if (nearJunction(px, pz) || blocked(px, pz, 1.2) || onRoad(px, pz, 0.4, ri)) return;
        // Lengan lampu menghadap ke tengah jalan.
        lamps.push({ x: px, z: pz, rot: Math.atan2(-dx * side, -dz * side), scale: 1, order: base + 0.04 + hash01(px * 1.1 + pz) * 0.22 });
      });
    });

    // Perabot trotoar: bangku, tempat sampah, pot tanaman.
    map.roads.forEach((r, ri) => {
      if (r.f || r.w < 7 || tierOf(r.w, false) > 1) return;
      const base = TIER_AT[tierOf(r.w, false)];
      walk(r.p, 38, 19 + hash01(ri * 2.7) * 9, (x, z, dx, dz, k) => {
        if (benches.length + bins.length + planters.length >= 700) return;
        const side = k % 2 === 0 ? 1 : -1;
        const off = r.w / 2 + 2.2;
        const px = x + dz * off * side, pz = z - dx * off * side;
        if (nearJunction(px, pz) || blocked(px, pz, 1.4) || onRoad(px, pz, 0.3, ri)) return;
        const it = { x: px, z: pz, rot: Math.atan2(-dz, dx) + (side > 0 ? Math.PI : 0), scale: 1, order: base + 0.08 + hash01(px * 1.7 + pz) * 0.3 };
        const pick = hash01(px * 0.37 + pz * 0.11);
        (pick < 0.4 ? benches : pick < 0.7 ? bins : planters).push(it);
      });
    });

    // Taman: ruang kosong yang cukup luas di dalam kawasan terbangun, jauh dari jalan dan bangunan.
    const W = Math.ceil((bx1 - bx0) / CELL), H = Math.ceil((bz1 - bz0) / CELL);
    const near = new Uint8Array(W * H);
    for (const bb of bBox) {
      for (let gx = Math.max(0, Math.floor((bb[0] - 45 - bx0) / CELL)); gx <= Math.min(W - 1, Math.floor((bb[2] + 45 - bx0) / CELL)); gx++)
        for (let gz = Math.max(0, Math.floor((bb[1] - 45 - bz0) / CELL)); gz <= Math.min(H - 1, Math.floor((bb[3] + 45 - bz0) / CELL)); gz++) near[gz * W + gx] = 1;
    }
    const free = new Uint8Array(W * H);
    for (let gz = 0; gz < H; gz++) for (let gx = 0; gx < W; gx++) {
      if (!near[gz * W + gx]) continue;
      const cx = bx0 + (gx + 0.5) * CELL, cz = bz0 + (gz + 0.5) * CELL;
      if (!blocked(cx, cz, 3.2) && !onRoad(cx, cz, 4.2, -1)) free[gz * W + gx] = 1;
    }
    const seen = new Uint8Array(W * H);
    const parkTrees: Item[] = [];
    let parkNo = 0;
    for (let s = 0; s < W * H; s++) {
      if (!free[s] || seen[s]) continue;
      const cells: number[] = [];
      const stack = [s];
      seen[s] = 1;
      while (stack.length) {
        const u = stack.pop()!;
        cells.push(u);
        const ux = u % W, uz = Math.floor(u / W);
        for (const [nx, nz] of [[ux + 1, uz], [ux - 1, uz], [ux, uz + 1], [ux, uz - 1]]) {
          if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
          const v = nz * W + nx;
          if (free[v] && !seen[v]) { seen[v] = 1; stack.push(v); }
        }
      }
      if (cells.length < 6 || cells.length > 420) continue;
      // Taman muncul setelah kota cukup besar; yang dekat pusat lebih dulu.
      const mx = cells.reduce((a, c) => a + (c % W), 0) / cells.length, mz = cells.reduce((a, c) => a + Math.floor(c / W), 0) / cells.length;
      const distC = Math.hypot(bx0 + mx * CELL - (bx0 + bx1) / 2, bz0 + mz * CELL - (bz0 + bz1) / 2) / (Math.max(bx1 - bx0, bz1 - bz0) / 2);
      const order = 0.3 + Math.min(0.5, distC * 0.4) + hash01(parkNo++ * 4.1) * 0.12;
      const pos: number[] = [], idx: number[] = [];
      let base = 0;
      for (const c of cells) {
        const x0 = bx0 + (c % W) * CELL, z0 = bz0 + Math.floor(c / W) * CELL, x1 = x0 + CELL + 0.02, z1 = z0 + CELL + 0.02;
        pos.push(x0, 0.05, z0, x1, 0.05, z0, x0, 0.05, z1, x1, 0.05, z1);
        idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
        base += 4;
        if (hash01(c * 1.9 + parkNo) < 0.34) {
          parkTrees.push({ x: x0 + 0.3 + hash01(c * 3.7) * (CELL - 1.5), z: z0 + 0.3 + hash01(c * 5.3) * (CELL - 1.5), rot: hash01(c) * 6.28, scale: 0.75 + hash01(c * 2.1) * 0.4, order: order + 0.04 + hash01(c * 7.1) * 0.08 });
        }
      }
      const parkMat = new THREE.MeshBasicMaterial({ color: PARK, map: grassTex(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      this.parkMats.push(parkMat);
      const grp = new THREE.Group();
      const parkMesh = this.flatMesh(pos, idx, parkMat);
      const ppos = parkMesh.geometry.attributes.position;
      const puv = new Float32Array(ppos.count * 2);
      for (let q = 0; q < ppos.count; q++) { puv[q * 2] = ppos.getX(q) / 7; puv[q * 2 + 1] = ppos.getZ(q) / 7; }
      parkMesh.geometry.setAttribute("uv", new THREE.BufferAttribute(puv, 2));
      grp.add(parkMesh);
      // Pagar tanaman di tepi taman (dengan celah sebagai pintu masuk) dan beberapa bangku.
      const inPark = new Set(cells);
      const trims: THREE.BufferGeometry[] = [];
      for (const c of cells) {
        const cxw = bx0 + (c % W) * CELL, czw = bz0 + Math.floor(c / W) * CELL;
        const sides = [[1, 0, c + 1, c % W + 1 < W], [-1, 0, c - 1, c % W > 0], [0, 1, c + W, true], [0, -1, c - W, true]] as const;
        for (const [sx, sz, nb, valid] of sides) {
          if (valid && inPark.has(nb)) continue;
          if (hash01(c * 2.3 + sx * 5 + sz * 11) < 0.22) continue;
          const along = sx === 0 ? CELL - 1 : 0.55, depth = sz === 0 ? CELL - 1 : 0.55;
          trims.push(part(box(sx === 0 ? along : 0.55, 0.95, sz === 0 ? depth : 0.55), 0x4aa371, cxw + CELL / 2 + sx * (CELL / 2 - 0.4), 0.48, czw + CELL / 2 + sz * (CELL / 2 - 0.4)));
        }
        if (hash01(c * 4.9 + parkNo) < 0.05) {
          const bxw = cxw + CELL / 2, bzw = czw + CELL / 2;
          trims.push(part(box(2.3, 0.3, 0.8), 0xb07a4a, bxw, 0.55, bzw), part(box(2.3, 0.6, 0.14), 0xb07a4a, bxw, 0.95, bzw - 0.4), part(box(0.2, 0.5, 0.7), 0x6b7597, bxw - 1, 0.25, bzw), part(box(0.2, 0.5, 0.7), 0x6b7597, bxw + 1, 0.25, bzw));
        }
      }
      if (trims.length) {
        const trimMesh = new THREE.Mesh(merge(trims), new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }));
        trimMesh.castShadow = true;
        grp.add(trimMesh);
      }
      grp.visible = false;
      this.group.add(grp);
      this.parks.push({ mesh: grp, order });
      this.parkSpots.push({
        x: bx0 + (mx + 0.5) * CELL, z: bz0 + (mz + 0.5) * CELL, r: Math.sqrt((cells.length * CELL * CELL) / Math.PI),
        cells: cells.map((c) => ({ x: bx0 + ((c % W) + 0.5) * CELL, z: bz0 + (Math.floor(c / W) + 0.5) * CELL })),
      });
    }
    this.stats.parks = this.parks.length;
    this.parkSpots.sort((a, b) => b.r - a.r);

    const allTrees = [...trees, ...parkTrees];
    this.treeItems = allTrees;
    this.stats.trees = allTrees.length;
    this.stats.lamps = lamps.length;
    if (allTrees.length) {
      const layer = new Layered(this.group, treeModel(), allTrees.length, true);
      this.layers.push(layer);
      this.treeSet = new RevealSet(layer, allTrees, TREE_TINTS);
      this.sets.push(this.treeSet);
    }
    const addSet = (items: Item[], model: Model, tints: THREE.Color[] | undefined, shadow: boolean) => {
      if (!items.length) return null;
      const layer = new Layered(this.group, model, items.length, shadow);
      this.layers.push(layer);
      const set = new RevealSet(layer, items, tints);
      this.sets.push(set);
      return set;
    };
    this.palmSet = addSet(palms, palmModel(), ["#4fb57f", "#3f9e5d", "#5bc08a"].map((q) => new THREE.Color(q)), true);
    addSet(benches, benchModel(), [new THREE.Color("#b07a4a")], false);
    addSet(bins, binModel(), [new THREE.Color("#2f8a4f"), new THREE.Color("#2f6fe0")], false);
    addSet(planters, planterModel(), [new THREE.Color("#5bc08a"), new THREE.Color("#7fd6a0")], true);
    this.stats.trees += palms.length;
    if (lamps.length) {
      const layer = new Layered(this.group, lampModel(), lamps.length, false);
      this.layers.push(layer);
      const set = new RevealSet(layer, lamps);
      this.sets.push(set);
      this.lampReveal = set;
      // Bola lampu (tidak terpengaruh cahaya) dan genangan cahaya hangat di jalan, menyala saat malam.
      this.lampItems = lamps;
      this.bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff3c8 });
      this.bulbs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 0.3, 0.55), this.bulbMat, lamps.length);
      const cvs = document.createElement("canvas");
      cvs.width = cvs.height = 64;
      const g2 = cvs.getContext("2d")!;
      const grad = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,220,150,1)");
      grad.addColorStop(0.5, "rgba(255,200,120,0.45)");
      grad.addColorStop(1, "rgba(255,190,110,0)");
      g2.fillStyle = grad;
      g2.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(cvs);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.poolMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -10 });
      this.pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(13, 13).rotateX(-Math.PI / 2), this.poolMat, lamps.length);
      for (const m of [this.bulbs, this.pools]) { m.frustumCulled = false; this.group.add(m); }
      this.pools.renderOrder = 2;
    }
  }

  // -------------------------------------------------------------------------------------------------------------
  // Tema dan perkembangan
  // -------------------------------------------------------------------------------------------------------------

  /** Titik bebas dari bangunan dan jalan dengan jarak aman `margin` (untuk memasang tiang bendera dan sejenisnya). */
  placeable(x: number, z: number, margin: number): boolean {
    return !(this.blockedFn?.(x, z, margin) ?? false) && !(this.onRoadFn?.(x, z, margin * 0.5, -1) ?? false);
  }

  /** 0 siang, 1 malam: lampu jalan menyala dan menerangi jalan. */
  setNight(n: number) {
    if (Math.abs(n - this.night) > 0.01) {
      this.night = n;
      const k = 1 - 0.62 * n;
      const tint = new THREE.Color(0.78, 0.82, 1.0);
      const all = [...this.tierMats.flat(), ...this.parkMats];
      for (const m of all) {
        let base = this.baseColors.get(m);
        if (!base) { base = m.color.clone(); this.baseColors.set(m, base); }
        m.color.copy(base).multiplyScalar(k).lerp(base.clone().multiply(tint).multiplyScalar(k), n);
      }
    }
    if (this.poolMat) this.poolMat.opacity = Math.max(0, Math.min(1, (n - 0.1) * 1.2)) * 0.42;
    if (this.bulbMat) this.bulbMat.color.setRGB(0.78 + 0.22 * n, 0.76 + 0.2 * n, 0.66 + 0.1 * n);
  }

  /** Mengganti warna pohon, taman, dan cahaya lampu sesuai tema pilihan walikota. */
  setTheme(theme: Theme = THEMES.classic) {
    this.treeSet?.recolor(theme.trees.map((c) => new THREE.Color(c)));
    this.palmSet?.recolor(theme.trees.slice(0, 3).map((c) => new THREE.Color(c).lerp(new THREE.Color("#3f9e5d"), 0.35)));
    for (const m of this.parkMats) { m.color.set(theme.park); this.baseColors.delete(m); }
    this.night = -1;
    this.lampReveal?.recolor([new THREE.Color(theme.lamp)]);
  }

  setDevelopment(d: number) {
    const v = clamp01(d);
    if (Math.abs(v - this.dev) < 0.0008) return;
    this.dev = v;
    let tierMax = 0;
    for (let t = 0; t < 4; t++) {
      const op = t === 0 ? 1 : clamp01((v - TIER_AT[t]) / TIER_FADE);
      this.tierGroups[t].visible = op > 0.01;
      for (const m of this.tierMats[t]) m.opacity = op;
      if (v >= TIER_AT[t]) tierMax = t;
    }
    this.graph.tierMax = tierMax;
    for (const s of this.sets) s.apply(v);
    for (const p of this.parks) p.mesh.visible = v > p.order;
    if (this.bulbs && this.pools) {
      const d = new THREE.Object3D();
      this.lampItems.forEach((it, i) => {
        const k = clamp01((v - it.order) / REVEAL);
        const c = Math.cos(it.rot), sn = Math.sin(it.rot);
        d.rotation.set(0, it.rot, 0);
        d.scale.setScalar(Math.max(0.001, k));
        d.position.set(it.x + c * 1.5, 5.12 * k, it.z - sn * 1.5);
        d.updateMatrix();
        this.bulbs!.setMatrixAt(i, d.matrix);
        d.position.set(it.x + c * 3.2, 0.13, it.z - sn * 3.2);
        d.updateMatrix();
        this.pools!.setMatrixAt(i, d.matrix);
      });
      this.bulbs.instanceMatrix.needsUpdate = true;
      this.pools.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    for (const l of this.layers) l.dispose();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
    });
    this.parent.remove(this.group);
  }
}

/** Menelusuri polilinya dan memanggil `cb` tiap `spacing` meter, mulai dari `first`. */
function walk(p: number[], spacing: number, first: number, cb: (x: number, z: number, dx: number, dz: number, k: number) => void) {
  let next = first, acc = 0, k = 0;
  const n = p.length / 2;
  for (let i = 1; i < n; i++) {
    const ax = p[i * 2 - 2], az = p[i * 2 - 1];
    const len = Math.hypot(p[i * 2] - ax, p[i * 2 + 1] - az);
    if (len < 0.01) continue;
    const dx = (p[i * 2] - ax) / len, dz = (p[i * 2 + 1] - az) / len;
    while (next <= acc + len) {
      const t = next - acc;
      cb(ax + dx * t, az + dz * t, dx, dz, k++);
      next += spacing;
    }
    acc += len;
  }
}
