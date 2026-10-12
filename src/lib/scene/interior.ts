import * as THREE from "three";
import { distToPolygonEdge, pointInPolygon } from "./geometry";
import type { Floater, Tone } from "./life";
import { Layered, box, merge, part, toonRamp, type Model } from "./props";

/**
 * Isi gedung saat gedung diklik: gedung "dibelah" (setengah yang menghadap kamera disembunyikan di shader) dan
 * lantai-lantainya terlihat seperti rumah boneka. Tiap lantai punya fungsi (kantor, rapat, apartemen, warung, kelas,
 * ruang walikota, staf AI, layanan warga) dan orang yang berkegiatan sesuai jam.
 *
 * Balai kota dan kantor di distrik terhubung ke kejadian kota (`AgendaItem`): rapat membahas tata ulang terakhir,
 * Analis mempresentasikan usulannya ke walikota, ruang Satpam berkedip merah saat evakuasi, antrean layanan warga
 * memanjang saat ada setoran atau penarikan.
 */

export type BuildingKind = "office" | "home" | "food" | "shop" | "civic" | "hall";
export type Program =
  | "lobby" | "office" | "meeting" | "pantry" | "trading" | "gym" | "vault"
  | "apartment" | "shop" | "warung" | "storage"
  | "classroom" | "prayer" | "clinic"
  | "mayor" | "council" | "aiStaff" | "service";

export interface AgendaItem {
  kind: "transfer" | "propose" | "approve" | "alert" | "harvest" | "festival" | "deposit" | "withdraw";
  text: string;
  /** Waktu kejadian (detik, jam dinding adegan). */
  at: number;
  /** Distrik yang terkena (untuk kantor di distrik itu). */
  district?: string;
}

export interface BuildingBrief {
  id: number;
  name: string;
  kind: BuildingKind;
  style: number;
  h: number;
  polygon: number[];
  district: { id: string; label: string; color: string; kind: string };
}

export interface InteriorInfo {
  title: string;
  subtitle: string;
  floors: { level: number; label: string; doing: string }[];
  occupants: number;
  agenda: string[];
}

interface Floor { level: number; y: number; program: Program; label: string; doing: () => string; cx: number; cz: number }
interface Actor {
  slot: number;
  floor: Floor;
  x: number; z: number; y: number;
  yaw: number;
  mode: "walk" | "sit" | "stand" | "sleep" | "type" | "present" | "run";
  tx?: number; tz?: number;
  speed: number;
  wait: number;
  ph: number;
  /** Hanya tampil bila fungsi ini bernilai true (mis. saat rapat berlangsung). */
  when?: () => boolean;
  role?: string;
}

const LABELS: Record<Program, string> = {
  lobby: "Lobby", office: "Open office", meeting: "Meeting room", pantry: "Pantry", trading: "Fund desk", gym: "Gym", vault: "Vault room",
  apartment: "Apartments", shop: "Shop", warung: "Warung", storage: "Storage",
  classroom: "Classroom", prayer: "Prayer hall", clinic: "Clinic",
  mayor: "Mayor's office", council: "City council room", aiStaff: "AI staff room", service: "Citizen services",
};

const SHIRTS = ["#3f6bff", "#7a5cff", "#10b3a3", "#f59e0b", "#ec4899", "#ffffff", "#94a3d8", "#e8553d"].map((c) => new THREE.Color(c));
const SKINS = ["#f1c9a5", "#d9a37a", "#b97a56", "#8d5a3b", "#f6d6bd"].map((c) => new THREE.Color(c));

function personModel(): Model {
  return {
    tint: merge([
      part(box(0.32, 0.72, 0.56), 0xffffff, 0, 1.06, 0, [0, 0]),
      part(box(0.24, 0.7, 0.24), 0xffffff, 0, 1.07, 0.4, [-1, 1.4]),
      part(box(0.24, 0.7, 0.24), 0xffffff, 0, 1.07, -0.4, [1, 1.4]),
    ]),
    accent: merge([part(box(0.5, 0.5, 0.5), 0xffffff, 0, 1.67, 0, [0, 0])]),
    fixed: merge([
      part(box(0.54, 0.16, 0.54), 0x3b2a22, -0.01, 1.9, 0, [0, 0]),
      part(box(0.04, 0.09, 0.1), 0x252a45, 0.26, 1.7, 0.12, [0, 0]),
      part(box(0.04, 0.09, 0.1), 0x252a45, 0.26, 1.7, -0.12, [0, 0]),
      part(box(0.26, 0.7, 0.26), 0x3a4a8a, 0, 0.35, 0.15, [1, 0.7]),
      part(box(0.26, 0.7, 0.26), 0x3a4a8a, 0, 0.35, -0.15, [-1, 0.7]),
    ]),
  };
}

/** Perabot sederhana bergaya balok, satu geometri berwarna per jenis. */
const FURNITURE: Record<string, () => THREE.BufferGeometry> = {
  desk: () => merge([part(box(1.6, 0.08, 0.8), 0xe9e4da, 0, 0.75, 0), part(box(0.08, 0.72, 0.7), 0x6b7597, -0.72, 0.36, 0), part(box(0.08, 0.72, 0.7), 0x6b7597, 0.72, 0.36, 0), part(box(0.5, 0.36, 0.05), 0x252a45, 0, 1.02, -0.25), part(box(0.46, 0.3, 0.02), 0x7fb0ff, 0, 1.03, -0.22)]),
  chair: () => merge([part(box(0.5, 0.08, 0.5), 0x39456f, 0, 0.46, 0), part(box(0.5, 0.5, 0.08), 0x39456f, 0, 0.75, 0.24), part(box(0.08, 0.44, 0.08), 0x252a45, 0, 0.22, 0)]),
  table: () => merge([part(box(4.2, 0.1, 1.5), 0xb07a4a, 0, 0.75, 0), part(box(0.1, 0.7, 1.3), 0x6b7597, -1.9, 0.36, 0), part(box(0.1, 0.7, 1.3), 0x6b7597, 1.9, 0.36, 0)]),
  sofa: () => merge([part(box(2.0, 0.42, 0.85), 0x5b86ff, 0, 0.3, 0), part(box(2.0, 0.55, 0.2), 0x4a72e0, 0, 0.7, 0.33), part(box(0.2, 0.45, 0.85), 0x4a72e0, -0.95, 0.5, 0), part(box(0.2, 0.45, 0.85), 0x4a72e0, 0.95, 0.5, 0)]),
  tv: () => merge([part(box(1.4, 0.8, 0.08), 0x1b2035, 0, 1.25, 0), part(box(1.2, 0.45, 0.4), 0x8d6a4a, 0, 0.23, 0)]),
  bed: () => merge([part(box(2.0, 0.45, 1.5), 0xf2f2f2, 0, 0.25, 0), part(box(0.35, 0.2, 1.3), 0xd8e4ff, -0.75, 0.55, 0), part(box(0.1, 0.9, 1.5), 0x8d6a4a, -1.0, 0.45, 0)]),
  kitchen: () => merge([part(box(2.4, 0.9, 0.6), 0xf6efe0, 0, 0.45, 0), part(box(2.4, 0.06, 0.62), 0x6b7597, 0, 0.92, 0), part(box(0.5, 0.06, 0.4), 0x252a45, 0.6, 0.96, 0)]),
  shelf: () => merge([part(box(1.8, 2.0, 0.45), 0xb07a4a, 0, 1.0, 0), part(box(1.6, 0.3, 0.4), 0xe8553d, 0, 0.5, 0.02), part(box(1.6, 0.3, 0.4), 0xf6c445, 0, 1.0, 0.02), part(box(1.6, 0.3, 0.4), 0x52c79b, 0, 1.5, 0.02)]),
  counter: () => merge([part(box(2.6, 1.0, 0.7), 0xf6efe0, 0, 0.5, 0), part(box(2.7, 0.08, 0.8), 0xb07a4a, 0, 1.02, 0), part(box(0.4, 0.3, 0.3), 0x252a45, 0.8, 1.2, 0)]),
  stall: () => merge([part(box(1.2, 0.08, 1.2), 0xb07a4a, 0, 0.72, 0), part(box(0.08, 0.7, 0.08), 0x6b7597, 0, 0.36, 0), part(box(0.4, 0.14, 0.4), 0xf6c445, 0.2, 0.83, 0), part(box(0.3, 0.12, 0.3), 0xe8553d, -0.25, 0.82, 0.2)]),
  mat: () => merge([part(box(0.8, 0.04, 1.3), 0x2f8a4f, 0, 0.02, 0), part(box(0.7, 0.045, 0.15), 0xf6c445, 0, 0.03, 0.5)]),
  clinicBed: () => merge([part(box(2.0, 0.55, 0.9), 0xffffff, 0, 0.5, 0), part(box(0.08, 1.6, 0.08), 0x9aa6cf, 1.05, 0.8, 0.35), part(box(0.4, 0.3, 0.05), 0x7af0c3, 1.05, 1.5, 0.35)]),
  crate: () => merge([part(box(1.1, 1.0, 1.1), 0x3f6bff, 0, 0.5, 0), part(box(1.12, 0.12, 1.12), 0x2f55e8, 0, 0.75, 0)]),
  treadmill: () => merge([part(box(1.8, 0.2, 0.8), 0x252a45, 0, 0.12, 0), part(box(0.1, 1.2, 0.8), 0x6b7597, 0.85, 0.7, 0)]),
  plant: () => merge([part(box(0.5, 0.5, 0.5), 0xd7d3c8, 0, 0.25, 0), part(box(0.8, 0.8, 0.8), 0x52c79b, 0, 0.95, 0)]),
  board: () => merge([part(box(3.2, 1.8, 0.08), 0x1b2035, 0, 1.6, 0)]),
};

export class BuildingInterior {
  readonly group = new THREE.Group();
  readonly plane = new THREE.Plane();
  private mat: THREE.MeshToonMaterial;
  private people: Layered;
  private actors: Actor[] = [];
  private floors: Floor[] = [];
  private cx: number;
  private cz: number;
  private screens: { tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D; kind: "mayor" | "meeting" | "fund"; floor: Floor }[] = [];
  private screenTick = 0;
  private alarm: THREE.Mesh | null = null;
  private lights: THREE.InstancedMesh | null = null;
  private lx = 0;
  private lz = 0;
  private fmat: THREE.MeshToonMaterial | null = null;
  /** Titik paling ramai untuk disorot kamera: ruang walikota, rapat, meja dana, warung, atau unit hunian teratas. */
  hotspot(): { x: number; y: number; z: number } {
    const order: Program[] = ["mayor", "council", "meeting", "trading", "warung", "shop", "classroom", "prayer", "service", "apartment", "office", "lobby"];
    for (const pr of order) {
      const fl = [...this.floors].reverse().find((f) => f.program === pr && this.actors.some((a) => a.floor === f));
      if (!fl) continue;
      const a = this.actors.find((q) => q.floor === fl)!;
      return { x: a.x, y: fl.y + 1.4, z: a.z };
    }
    return { x: this.cx, y: (this.floors[0]?.y ?? 0) + 1.4, z: this.cz };
  }
  /** Ketinggian tiap lantai (untuk kamera yang menyorot satu lantai). */
  floorY(level: number): number { return this.floors[Math.max(0, Math.min(this.floors.length - 1, level - 1))]?.y ?? 0; }
  floorSpot(level: number): { x: number; y: number; z: number } {
    const fl = this.floors[Math.max(0, Math.min(this.floors.length - 1, level - 1))];
    const a = this.actors.find((q) => q.floor === fl);
    return { x: a?.x ?? this.cx, y: (fl?.y ?? 0) + 1.4, z: a?.z ?? this.cz };
  }
  private dummy = new THREE.Object3D();
  private rnd: () => number;
  private seed: number;
  private t = 0;
  private hour = 12;

  constructor(
    private parent: THREE.Object3D,
    private brief: BuildingBrief,
    private agenda: () => AgendaItem[],
    private alloc: () => { label: string; share: number; color: string }[],
  ) {
    this.seed = brief.id * 9301 + 49297;
    this.rnd = () => { this.seed = (this.seed * 16807) % 2147483647; return (this.seed - 1) / 2147483646; };
    const p = brief.polygon;
    const n = p.length / 2;
    let sx = 0, sz = 0;
    for (let i = 0; i < n; i++) { sx += p[i * 2]; sz += p[i * 2 + 1]; }
    this.cx = sx / n; this.cz = sz / n;
    this.mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp(), clippingPlanes: [this.plane], side: THREE.DoubleSide });
    parent.add(this.group);
    this.people = new Layered(this.group, personModel(), 320, false, true);
    for (const m of [this.people.tint, this.people.fixed, this.people.accent!]) (m.material as THREE.Material).clippingPlanes = [this.plane];
    this.build();
  }

  // -------------------------------------------------------------------------------------------------------------
  // Susunan lantai
  // -------------------------------------------------------------------------------------------------------------

  private programs(F: number): Program[] {
    const b = this.brief;
    const name = b.name.toLowerCase();
    const out: Program[] = [];
    for (let k = 0; k < F; k++) {
      let pr: Program;
      if (b.kind === "hall") {
        pr = k === 0 ? "service" : k === F - 1 ? "mayor" : k === F - 2 && F >= 3 ? "council" : k === 1 ? "aiStaff" : "office";
        if (F === 1) pr = "mayor";
        if (F === 2) pr = k === 0 ? "service" : "mayor";
      } else if (b.kind === "office") {
        pr = k === 0 ? "lobby" : k === F - 1 && F > 8 ? "gym" : k % 6 === 3 ? "meeting" : k === 2 ? "pantry" : (b.district.kind === "lending" || b.district.kind === "vault") && k % 5 === 1 ? (b.district.kind === "vault" && k === 1 ? "vault" : "trading") : "office";
      } else if (b.kind === "home") {
        pr = k === 0 && F > 3 ? "lobby" : "apartment";
      } else if (b.kind === "food") {
        pr = k === 0 ? "warung" : k === 1 ? "storage" : "apartment";
      } else if (b.kind === "shop") {
        pr = k === 0 ? "shop" : k === 1 ? "storage" : "apartment";
      } else {
        pr = /masjid|gereja/.test(name) ? (k === 0 ? "prayer" : "office") : /sd |smp|kampus|perpus/.test(name) ? (k === 0 ? "lobby" : "classroom") : /puskesmas|klinik/.test(name) ? (k === 0 ? "clinic" : "office") : k === 0 ? "lobby" : "office";
      }
      out.push(pr);
    }
    return out;
  }

  private area(): number {
    const p = this.brief.polygon;
    let a = 0;
    for (let i = 0, n = p.length / 2; i < n; i++) a += p[i * 2] * p[((i + 1) % n) * 2 + 1] - p[((i + 1) % n) * 2] * p[i * 2 + 1];
    return Math.abs(a) / 2;
  }

  /** Titik acak di dalam lantai (cukup jauh dari dinding). */
  private inside(margin = 1.2): [number, number] | null {
    const p = this.brief.polygon;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); z0 = Math.min(z0, p[i + 1]); z1 = Math.max(z1, p[i + 1]); }
    for (let k = 0; k < 30; k++) {
      const x = x0 + this.rnd() * (x1 - x0), z = z0 + this.rnd() * (z1 - z0);
      if (pointInPolygon(x, z, p) && distToPolygonEdge(x, z, p) > margin) return [x, z];
    }
    return null;
  }

  /** Titik-titik grid di dalam lantai, untuk meja dan perabot berderet. */
  private grid(sx: number, sz: number, margin: number, cap: number): [number, number][] {
    const p = this.brief.polygon;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); z0 = Math.min(z0, p[i + 1]); z1 = Math.max(z1, p[i + 1]); }
    const out: [number, number][] = [];
    for (let x = x0 + margin; x <= x1 - margin && out.length < cap; x += sx)
      for (let z = z0 + margin; z <= z1 - margin && out.length < cap; z += sz)
        if (pointInPolygon(x, z, p) && distToPolygonEdge(x, z, p) > margin) out.push([x, z]);
    return out;
  }

  private build() {
    const b = this.brief;
    const F = Math.max(1, Math.min(70, Math.floor(b.h / 3.6)));
    const fh = b.h / F;
    const progs = this.programs(F);
    const p = b.polygon;
    const n = p.length / 2;

    // Pelat lantai dan dinding dalam.
    const contour: THREE.Vector2[] = [];
    for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(p[i * 2], p[i * 2 + 1]));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const slabs: THREE.BufferGeometry[] = [];
    const FLOOR_COL: Partial<Record<Program, number>> = { apartment: 0xc99a6b, warung: 0xd9c7a8, mayor: 0x8d6a4a, council: 0x9aa6cf, gym: 0x39456f, prayer: 0x2f8a4f, classroom: 0xd9c7a8, service: 0xd7d3c8, aiStaff: 0x5b6aa8 };
    const WALL_COL: Partial<Record<Program, number>> = { mayor: 0xf3e3c3, council: 0xdfe6fb, aiStaff: 0xcfd6f5, apartment: 0xf6e7d4, warung: 0xf7e2c6, classroom: 0xe7f2e0, prayer: 0xf3f0e6, gym: 0xd9e2f2 };
    const flat = (y: number, up: boolean, color: number) => {
      const pos: number[] = [];
      for (const t of tris) {
        const a = contour[t[0]], c1 = contour[t[1]], c2 = contour[t[2]];
        const cr = (c1.x - a.x) * (c2.y - a.y) - (c1.y - a.y) * (c2.x - a.x);
        const o = (cr <= 0) === up ? [a, c1, c2] : [a, c2, c1];
        for (const q of o) pos.push(q.x, y, q.y);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      return part(g, color);
    };
    for (let k = 0; k < F; k++) {
      const y = k * fh;
      slabs.push(flat(y + 0.03, true, FLOOR_COL[progs[k]] ?? 0xe9e6e0));
      if (k > 0) slabs.push(flat(y - 0.32, false, 0xf7f7f4));
    }
    // Dinding dalam per lantai (menghadap ke dalam), warnanya mengikuti fungsi lantai; pita gelap di setiap pelat.
    let area2 = 0;
    for (let i = 0; i < n; i++) area2 += p[i * 2] * p[((i + 1) % n) * 2 + 1] - p[((i + 1) % n) * 2] * p[i * 2 + 1];
    const ccw = area2 > 0;
    const wallParts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < F; k++) {
      const y0 = k * fh, y1 = (k + 1) * fh;
      const walls: number[] = [];
      const band: number[] = [];
      for (let i = 0; i < n; i++) {
        const ax = p[i * 2], az = p[i * 2 + 1], bx = p[((i + 1) % n) * 2], bz = p[((i + 1) % n) * 2 + 1];
        const q = (lo: number, hi: number) => (ccw ? [[bx, lo, bz], [ax, lo, az], [ax, hi, az], [bx, hi, bz]] : [[ax, lo, az], [bx, lo, bz], [bx, hi, bz], [ax, hi, az]]);
        for (const kk of [0, 1, 2, 0, 2, 3]) walls.push(...q(y0, y1 - 0.35)[kk]);
        for (const kk of [0, 1, 2, 0, 2, 3]) band.push(...q(y1 - 0.35, y1)[kk]);
      }
      const wg = new THREE.BufferGeometry();
      wg.setAttribute("position", new THREE.Float32BufferAttribute(walls, 3));
      wg.computeVertexNormals();
      const bg = new THREE.BufferGeometry();
      bg.setAttribute("position", new THREE.Float32BufferAttribute(band, 3));
      bg.computeVertexNormals();
      wallParts.push(part(wg, WALL_COL[progs[k]] ?? (k % 2 ? 0xf1ede6 : 0xeae6df)), part(bg, 0x8b93ad));
    }
    const inner = new THREE.Mesh(merge([...slabs, ...wallParts]), this.mat);
    inner.receiveShadow = true;
    this.group.add(inner);

    // Perabot per lantai, dikumpulkan per jenis lalu digambar berinstans.
    const items: Record<string, { x: number; y: number; z: number; r: number }[]> = {};
    const put = (kind: string, x: number, y: number, z: number, r = 0) => (items[kind] ??= []).push({ x, y, z, r });
    let budget = 1800;
    for (let k = 0; k < F; k++) {
      const y = k * fh + 0.02;
      const pr = progs[k];
      const floor: Floor = { level: k, y, program: pr, label: LABELS[pr], doing: () => this.doingOf(pr, k), cx: this.cx, cz: this.cz };
      this.floors.push(floor);
      if (budget <= 0) continue;
      const rot = this.rnd() < 0.5 ? 0 : Math.PI / 2;
      switch (pr) {
        case "office": case "trading": case "aiStaff": {
          const pts = this.grid(3.0, 2.6, 1.6, pr === "aiStaff" ? 3 : 24);
          pts.forEach(([x, z], i) => {
            put("desk", x, y, z, rot); put("chair", x + Math.sin(rot) * 0.0, y, z + (rot ? 0 : 0.75), rot);
            budget -= 2;
            if (pr === "aiStaff") this.addActor(floor, x, z + 0.75, rot + Math.PI, "type", ["Satpam (AI guard)", "Analyst (AI)", "Humas (AI)"][i] ?? "AI staff", [0xef4444, 0x7a5cff, 0x10b981][i]);
            else if (this.rnd() < 0.7) this.addActor(floor, x, z + 0.75, rot + Math.PI, "type", pr === "trading" ? "Fund analyst" : "Office worker", undefined, () => this.hour >= 8 && this.hour < 18.5);
          });
          if (pr === "trading") { const c = this.inside(2.5); if (c) { put("board", c[0], y, c[1], rot); this.screen(floor, c[0], y, c[1], rot, "fund"); } }
          for (let w = 0; w < 2; w++) this.addWalker(floor, "Colleague", () => this.hour >= 8 && this.hour < 19);
          break;
        }
        case "meeting": case "council": {
          const c = this.inside(3.0) ?? [this.cx, this.cz];
          put("table", c[0], y, c[1], rot);
          put("board", c[0] + Math.cos(rot) * 3.2, y, c[1] - Math.sin(rot) * 3.2, rot + Math.PI / 2);
          this.screen(floor, c[0] + Math.cos(rot) * 3.1, y, c[1] - Math.sin(rot) * 3.1, rot + Math.PI / 2, "meeting");
          const active = () => this.meetingActive(pr);
          for (let s = 0; s < 6; s++) {
            const along = (s % 3 - 1) * 1.3, side = s < 3 ? 1 : -1;
            const x = c[0] + Math.cos(rot) * along + Math.sin(rot) * side * 1.05, z = c[1] - Math.sin(rot) * along + Math.cos(rot) * side * 1.05;
            put("chair", x, y, z, rot + (side > 0 ? Math.PI : 0));
            this.addActor(floor, x, z, rot + (side > 0 ? Math.PI : 0) + Math.PI / 2, "sit", pr === "council" ? "Council member" : "Attendee", undefined, active);
          }
          this.addActor(floor, c[0] + Math.cos(rot) * 2.6, c[1] - Math.sin(rot) * 2.6, rot + Math.PI, "present", pr === "council" ? "Presenter" : "Speaker", 0x2f6fe0, active);
          budget -= 9;
          break;
        }
        case "mayor": {
          const c = this.inside(2.5) ?? [this.cx, this.cz];
          put("desk", c[0], y, c[1], rot); put("chair", c[0], y, c[1] + 0.75, rot);
          put("board", c[0], y, c[1] - 2.6, rot);
          this.screen(floor, c[0], y, c[1] - 2.55, rot, "mayor");
          put("plant", c[0] + 2.2, y, c[1] + 1.5); put("sofa", c[0] - 2.4, y, c[1] + 2.2, Math.PI / 2);
          this.addActor(floor, c[0], c[1] + 0.75, rot + Math.PI, "type", "Mayor", 0xf5b301, () => this.hour >= 7.5 && this.hour < 21);
          // Analis datang mempresentasikan usulan; Satpam melapor saat evakuasi.
          this.addActor(floor, c[0] + 1.2, c[1] + 1.6, rot + Math.PI * 0.8, "present", "Analyst (AI) presenting a proposal", 0x7a5cff, () => this.recent("propose", 150));
          this.addActor(floor, c[0] - 1.2, c[1] + 1.6, rot + Math.PI * 1.2, "stand", "Satpam (AI) reporting", 0xef4444, () => this.recent("alert", 90));
          budget -= 8;
          break;
        }
        case "service": {
          const pts = this.grid(4.0, 6.0, 2.0, 4);
          pts.forEach(([x, z]) => {
            put("counter", x, y, z, rot);
            this.addActor(floor, x, z - 0.7, rot, "type", "Service officer", 0x2f6fe0, () => this.hour >= 8 && this.hour < 16);
            for (let q = 0; q < 4; q++) this.addActor(floor, x, z + 1.3 + q * 0.9, rot + Math.PI, "stand", "Resident in the queue", undefined, () => this.hour >= 8 && this.hour < 16 && (q < 1 || this.recent("deposit", 120) || this.recent("withdraw", 120) || q < 2));
          });
          budget -= 20;
          break;
        }
        case "lobby": {
          const c = this.inside(2.0) ?? [this.cx, this.cz];
          put("counter", c[0], y, c[1], rot); put("plant", c[0] + 2.5, y, c[1]); put("sofa", c[0] - 2.5, y, c[1] + 2, rot);
          this.addActor(floor, c[0], c[1] - 0.7, rot, "stand", "Receptionist", 0x10b3a3);
          for (let w = 0; w < 3; w++) this.addWalker(floor, "Visitor", () => this.hour >= 7 && this.hour < 21);
          budget -= 6;
          break;
        }
        case "pantry": case "warung": {
          const c = this.inside(2.0) ?? [this.cx, this.cz];
          put(pr === "warung" ? "kitchen" : "counter", c[0], y, c[1], rot);
          this.addActor(floor, c[0], c[1] - 0.8, rot, "type", pr === "warung" ? "Cook" : "Barista", 0xf6efe0, () => (pr === "warung" ? this.hour >= 7 && this.hour < 23 : this.hour >= 8 && this.hour < 18));
          this.grid(2.4, 2.4, 1.8, 8).slice(1).forEach(([x, z]) => {
            put("stall", x, y, z);
            if (this.rnd() < 0.7) this.addActor(floor, x + 0.7, z, -Math.PI / 2, "sit", pr === "warung" ? "Customer eating" : "Coffee break", undefined, () => (pr === "warung" ? this.hour >= 11 && this.hour < 14 || this.hour >= 18 && this.hour < 22 : this.hour >= 9.5 && this.hour < 16));
          });
          budget -= 12;
          break;
        }
        case "shop": {
          this.grid(2.6, 2.2, 1.4, 6).forEach(([x, z], i) => { put(i === 0 ? "counter" : "shelf", x, y, z, rot); });
          const c = this.inside(1.6);
          if (c) this.addActor(floor, c[0], c[1], rot, "stand", "Shopkeeper", 0xe8553d, () => this.hour >= 8 && this.hour < 21.5);
          for (let w = 0; w < 3; w++) this.addWalker(floor, "Shopper", () => this.hour >= 9 && this.hour < 21);
          budget -= 8;
          break;
        }
        case "storage": case "vault": {
          this.grid(1.6, 1.6, 1.2, pr === "vault" ? Math.round(6 + 24 * (this.alloc().find((a) => a.label === b.district.label)?.share ?? 0.3)) : 10).forEach(([x, z]) => put(pr === "vault" ? "crate" : "shelf", x, y, z, rot));
          if (pr === "vault") this.addActor(floor, this.cx, this.cz, 0, "stand", "Vault keeper", 0x39456f);
          budget -= 12;
          break;
        }
        case "apartment": {
          const units = this.grid(7.0, 6.0, 2.2, Math.max(4, Math.min(16, Math.round(this.area() / 60))));
          units.forEach(([x, z]) => {
            put("sofa", x, y, z, rot); put("tv", x + Math.cos(rot) * 0 + Math.sin(rot) * 2.2, y, z + Math.cos(rot) * 2.2, rot);
            put("bed", x + Math.cos(rot) * 2.6, y, z - Math.sin(rot) * 2.6, rot);
            put("kitchen", x - Math.cos(rot) * 2.4, y, z + Math.sin(rot) * 2.4, rot + Math.PI / 2);
            const tvTime = () => this.hour >= 18 && this.hour < 22.5;
            const sleep = () => this.hour >= 22.5 || this.hour < 5.5;
            this.addActor(floor, x, z, rot + Math.PI, "sit", "Family watching TV", undefined, tvTime);
            if (this.rnd() < 0.6) this.addActor(floor, x + 0.6, z, rot + Math.PI, "sit", "Family watching TV", undefined, tvTime);
            this.addActor(floor, x + Math.cos(rot) * 2.6, z - Math.sin(rot) * 2.6, rot, "sleep", "Sleeping", undefined, sleep);
            this.addActor(floor, x - Math.cos(rot) * 2.4, z + Math.sin(rot) * 2.4 + 0.6, rot, "stand", "Cooking", undefined, () => this.hour >= 6 && this.hour < 8 || this.hour >= 17 && this.hour < 19.5);
            budget -= 8;
          });
          break;
        }
        case "classroom": {
          const pts = this.grid(1.8, 1.8, 2.0, 18);
          pts.forEach(([x, z]) => { put("chair", x, y, z, 0); this.addActor(floor, x, z, Math.PI, "sit", "Student", undefined, () => this.hour >= 7 && this.hour < 13.5); });
          const c = this.inside(1.5);
          if (c) { put("board", c[0], y, c[1], 0); this.addActor(floor, c[0], c[1] + 1.2, 0, "present", "Teacher", 0xf6c445, () => this.hour >= 7 && this.hour < 13.5); }
          budget -= pts.length + 2;
          break;
        }
        case "prayer": {
          const pts = this.grid(1.0, 1.5, 1.6, 30);
          const prayerTime = () => [4.7, 12.1, 15.3, 18.0, 19.3].some((h) => this.hour >= h && this.hour < h + 0.45);
          pts.forEach(([x, z]) => { put("mat", x, y, z, 0); if (this.rnd() < 0.7) this.addActor(floor, x, z, Math.PI, "sit", "Praying", 0xffffff, prayerTime); });
          budget -= pts.length;
          break;
        }
        case "clinic": {
          this.grid(2.6, 2.4, 1.6, 6).forEach(([x, z], i) => { put("clinicBed", x, y, z, rot); if (i % 2 === 0) this.addActor(floor, x, z, rot, "sleep", "Patient resting"); });
          this.addWalker(floor, "Nurse", undefined, 0x7af0c3);
          budget -= 10;
          break;
        }
        case "gym": {
          this.grid(2.4, 1.6, 1.6, 6).forEach(([x, z]) => { put("treadmill", x, y, z, 0); this.addActor(floor, x, z, 0, "run", "Running on a treadmill", 0x10b3a3, () => this.hour >= 6 && this.hour < 9 || this.hour >= 17 && this.hour < 21); });
          budget -= 8;
          break;
        }
      }
    }
    // Panel lampu di langit-langit, terang saat malam.
    const lightPos: [number, number, number][] = [];
    for (let k = 0; k < F; k++) for (const [x, z] of this.grid(4.5, 4.5, 1.8, 6)) lightPos.push([x, (k + 1) * fh - 0.36, z]);
    if (lightPos.length) {
      this.lights = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.05, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff1c8, clippingPlanes: [this.plane] }), lightPos.length);
      lightPos.forEach(([x, y, z], i) => { this.dummy.position.set(x, y, z); this.dummy.rotation.set(0, 0, 0); this.dummy.scale.setScalar(1); this.dummy.updateMatrix(); this.lights!.setMatrixAt(i, this.dummy.matrix); });
      this.group.add(this.lights);
    }
    const fmat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp(), clippingPlanes: [this.plane] });
    this.fmat = fmat;
    for (const [kind, list] of Object.entries(items)) {
      const geo = FURNITURE[kind]?.();
      if (!geo) continue;
      const im = new THREE.InstancedMesh(geo, fmat, list.length);
      list.forEach((it, i) => {
        this.dummy.position.set(it.x, it.y, it.z);
        this.dummy.rotation.set(0, it.r, 0);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        im.setMatrixAt(i, this.dummy.matrix);
      });
      im.frustumCulled = false;
      this.group.add(im);
    }
    // Lampu peringatan merah di ruang staf AI (menyala saat evakuasi Satpam).
    const ai = this.floors.find((f) => f.program === "aiStaff");
    if (ai) {
      this.alarm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), new THREE.MeshBasicMaterial({ color: 0xff2d2d, clippingPlanes: [this.plane] }));
      this.alarm.position.set(this.cx, ai.y + fh - 0.5, this.cz);
      this.group.add(this.alarm);
    }
  }

  private addActor(floor: Floor, x: number, z: number, yaw: number, mode: Actor["mode"], role: string, shirt?: number, when?: () => boolean) {
    const slot = this.people.acquire();
    if (slot < 0) return;
    this.people.color(slot, shirt !== undefined ? new THREE.Color(shirt) : SHIRTS[Math.floor(this.rnd() * SHIRTS.length)]);
    this.people.accentColor(slot, SKINS[Math.floor(this.rnd() * SKINS.length)]);
    this.actors.push({ slot, floor, x, z, y: floor.y, yaw, mode, speed: 0, wait: 0, ph: this.rnd() * 6, when, role });
  }

  private addWalker(floor: Floor, role: string, when?: () => boolean, shirt?: number) {
    const c = this.inside(1.4);
    if (!c) return;
    this.addActor(floor, c[0], c[1], 0, "walk", role, shirt, when);
    const a = this.actors[this.actors.length - 1];
    if (a) a.speed = 0.9 + this.rnd() * 0.5;
  }

  private screen(floor: Floor, x: number, y: number, z: number, yaw: number, kind: "mayor" | "meeting" | "fund") {
    if (typeof document === "undefined") return;
    const cvs = document.createElement("canvas");
    cvs.width = 256;
    cvs.height = 144;
    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.68), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, clippingPlanes: [this.plane], side: THREE.DoubleSide }));
    mesh.position.set(x, y + 1.6, z);
    mesh.rotation.y = yaw;
    this.group.add(mesh);
    this.screens.push({ tex, ctx: cvs.getContext("2d")!, kind, floor });
  }

  // -------------------------------------------------------------------------------------------------------------
  // Kegiatan yang terhubung ke walikota
  // -------------------------------------------------------------------------------------------------------------

  private recent(kind: AgendaItem["kind"], seconds: number): boolean {
    return this.agenda().some((a) => a.kind === kind && this.t - a.at < seconds);
  }

  private latest(kinds: AgendaItem["kind"][], seconds: number): AgendaItem | undefined {
    return this.agenda().filter((a) => kinds.includes(a.kind) && this.t - a.at < seconds).sort((p, q) => q.at - p.at)[0];
  }

  private meetingActive(pr: Program): boolean {
    if (pr === "council") return !!this.latest(["transfer", "propose", "approve", "alert"], 160) || (this.hour >= 9 && this.hour < 11);
    const mine = this.agenda().some((a) => a.kind === "transfer" && a.district === this.brief.district.id && this.t - a.at < 160);
    return mine || (this.hour >= 10 && this.hour < 11.5) || (this.hour >= 14 && this.hour < 15);
  }

  private doingOf(pr: Program, level: number): string {
    const h = this.hour;
    const a = this.latest(["transfer", "propose", "approve", "alert", "harvest"], 160);
    switch (pr) {
      case "mayor":
        if (h < 7.5 || h >= 21) return "The mayor has gone home";
        if (this.recent("propose", 150)) return "The AI Analyst presents a proposal to the mayor";
        if (this.recent("alert", 90)) return "Satpam reports an evacuation to the mayor";
        return a ? `Mayor follows up: ${a.text}` : "Mayor reviews the city's allocation";
      case "council": return this.meetingActive("council") ? `Council meeting: ${a ? a.text : "weekly city budget review"}` : "Empty, next meeting later";
      case "meeting": {
        // Hanya ruang rapat terbawah yang membahas dana baru; yang lain rapat tim biasa.
        const first = this.floors.find((f) => f.program === "meeting")?.level === level;
        const mine = this.agenda().filter((q) => q.kind === "transfer" && q.district === this.brief.district.id && this.t - q.at < 160).sort((p, q) => q.at - p.at)[0];
        return mine && first ? `Briefing on new funds: ${mine.text}` : this.meetingActive("meeting") ? (level % 2 ? "Team meeting" : "Client call") : "Empty";
      }
      case "aiStaff": return this.recent("alert", 90) ? "Alarm: Satpam is evacuating a district" : this.recent("propose", 150) ? "Analyst drafted a proposal for the mayor" : "Satpam watches the protocols, Analyst models yields, Humas writes the weekly report";
      case "service": return h >= 8 && h < 16 ? (this.recent("deposit", 120) || this.recent("withdraw", 120) ? "Busy: residents depositing and withdrawing" : "Residents asking about their savings") : "Closed";
      case "trading": return this.recent("transfer", 160) ? "Fund desk rebalancing the district" : `Watching ${this.brief.district.label} yields`;
      case "vault": return "Crates of AUSD held by this district";
      case "office": return h >= 8 && h < 18.5 ? "People at work" : "Lights off, office empty";
      case "lobby": return h >= 7 && h < 21 ? "Visitors coming and going" : "Quiet lobby";
      case "pantry": return h >= 9.5 && h < 16 ? "Coffee break" : "Closed";
      case "warung": return (h >= 11 && h < 14) || (h >= 18 && h < 22) ? "Busy mealtime" : "Cook preparing food";
      case "shop": return h >= 8 && h < 21.5 ? "Open, shoppers browsing" : "Closed, shutter down";
      case "apartment": return h >= 22.5 || h < 5.5 ? "Residents sleeping" : h >= 18 ? "Families watching TV" : h < 8 ? "Breakfast and getting ready" : "Most residents are out";
      case "classroom": return h >= 7 && h < 13.5 ? "Class in session" : "Classroom empty";
      case "prayer": return [4.7, 12.1, 15.3, 18.0, 19.3].some((x) => h >= x && h < x + 0.45) ? "Congregational prayer" : "Quiet";
      case "clinic": return "Nurse checking on patients";
      case "gym": return (h >= 6 && h < 9) || (h >= 17 && h < 21) ? "Workout hour" : "Almost empty";
      default: return `Floor ${level + 1}`;
    }
  }

  // -------------------------------------------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------------------------------------------

  update(dt: number, t: number, hour: number, camPos: THREE.Vector3, night = 0, cut?: THREE.Vector3) {
    this.t = t;
    this.hour = hour;
    // Ruangan diterangi lampu sendiri saat malam (bahan sedikit memancar).
    const glow = new THREE.Color(0.32, 0.27, 0.2).multiplyScalar(night);
    this.mat.emissive.copy(glow);
    this.fmat?.emissive.copy(glow);
    (this.people.tint.material as THREE.MeshToonMaterial).emissive.copy(glow);
    if (this.lights) (this.lights.material as THREE.MeshBasicMaterial).color.setRGB(0.85 + 0.15 * night, 0.82 + 0.13 * night, 0.7 + 0.08 * night);
    // Bidang potong menghadap kamera: setengah yang dekat kamera disembunyikan.
    const ccx = cut?.x ?? this.cx, ccz = cut?.z ?? this.cz;
    this.lx = ccx; this.lz = ccz;
    let nx = camPos.x - ccx, nz = camPos.z - ccz;
    const l = Math.hypot(nx, nz) || 1;
    nx /= l; nz /= l;
    this.plane.set(new THREE.Vector3(-nx, 0, -nz), nx * ccx + nz * ccz + 4);
    for (const a of this.actors) {
      const on = a.when ? a.when() : true;
      if (!on) { this.people.hide(a.slot); continue; }
      let amp = 0;
      if (a.mode === "walk") {
        if (a.wait > 0) a.wait -= dt;
        else {
          if (a.tx === undefined || Math.hypot(a.tx - a.x, (a.tz ?? 0) - a.z) < 0.2) {
            const c = this.inside(1.2);
            if (c) { a.tx = c[0]; a.tz = c[1]; }
            a.wait = 1 + this.rnd() * 3;
          } else {
            const dx = a.tx - a.x, dz = (a.tz ?? a.z) - a.z, d = Math.hypot(dx, dz);
            const mv = Math.min(d, a.speed * dt);
            a.x += (dx / d) * mv; a.z += (dz / d) * mv;
            a.yaw = Math.atan2(-dz, dx);
            amp = 1;
            a.ph += dt * a.speed * 3.2;
          }
        }
      } else if (a.mode === "run") { amp = 1; a.ph += dt * 9; }
      else if (a.mode === "type") { amp = 0.18; a.ph += dt * 14; }
      else if (a.mode === "present") { amp = 0.45; a.ph += dt * 2.2; }
      const y = a.floor.y + (a.mode === "sit" || a.mode === "type" ? -0.38 : a.mode === "sleep" ? 0.55 : 0);
      this.dummy.position.set(a.x, y, a.z);
      this.dummy.rotation.set(a.mode === "sleep" ? -Math.PI / 2 : 0, a.yaw, 0, "YXZ");
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.people.set(a.slot, this.dummy.matrix);
      this.people.walk(a.slot, a.ph, amp);
    }
    this.people.flush();
    if (this.alarm) {
      const on = this.recent("alert", 90);
      this.alarm.visible = on && Math.floor(t * 3) % 2 === 0;
    }
    if (t >= this.screenTick) { this.screenTick = t + 1.5; this.drawScreens(); }
  }

  private drawScreens() {
    const alloc = this.alloc();
    const a = this.latest(["transfer", "propose", "approve", "alert", "harvest", "festival"], 400);
    for (const s of this.screens) {
      const c = s.ctx;
      c.fillStyle = "#121a3a";
      c.fillRect(0, 0, 256, 144);
      c.fillStyle = "#ffffff";
      c.font = "bold 16px system-ui, sans-serif";
      c.textAlign = "left";
      if (s.kind === "mayor" || s.kind === "fund") {
        c.fillText(s.kind === "mayor" ? "CITY ALLOCATION" : `${this.brief.district.label.toUpperCase()}`, 10, 22);
        alloc.slice(0, 4).forEach((d, i) => {
          c.fillStyle = "#2a3366";
          c.fillRect(10, 34 + i * 22, 236, 14);
          c.fillStyle = d.color;
          c.fillRect(10, 34 + i * 22, 236 * Math.max(0.02, d.share), 14);
          c.fillStyle = "#ffffff";
          c.font = "11px system-ui, sans-serif";
          c.fillText(`${d.label} ${Math.round(d.share * 100)}%`, 14, 45 + i * 22);
        });
        if (a) { c.fillStyle = "#d8f59a"; c.font = "12px system-ui, sans-serif"; c.fillText(a.text.slice(0, 38), 10, 136); }
      } else {
        c.fillText(a ? "AGENDA" : "MEETING", 10, 24);
        c.fillStyle = "#d8f59a";
        c.font = "bold 14px system-ui, sans-serif";
        const text = a ? a.text : "Weekly city budget review";
        const words = text.split(" ");
        let line = "", y = 52;
        for (const w of words) {
          if ((line + w).length > 26) { c.fillText(line, 10, y); line = ""; y += 20; }
          line += `${w} `;
        }
        c.fillText(line, 10, y);
      }
      s.tex.needsUpdate = true;
    }
  }

  /** Label lantai yang sedang ramai (paling banyak empat), menempel di bidang potong. */
  labels(camera: THREE.Camera, rect: { w: number; h: number }): Floater[] {
    const featured = this.floors.filter((f) => ["mayor", "council", "meeting", "aiStaff", "service", "trading", "warung", "shop", "classroom", "prayer", "gym", "vault"].includes(f.program));
    const pick = (featured.length ? featured : this.floors.filter((_, i) => i % Math.max(1, Math.floor(this.floors.length / 4)) === 0)).slice(-4);
    const v = new THREE.Vector3();
    return pick.map((f) => {
      v.set(this.lx || this.cx, f.y + 2.2, this.lz || this.cz).project(camera);
      const tone: Tone = f.program === "mayor" ? "gold" : f.program === "aiStaff" && this.recent("alert", 90) ? "red" : f.program === "council" || f.program === "meeting" ? "violet" : "blue";
      return { id: `floor${f.level}`, x: (v.x * 0.5 + 0.5) * rect.w, y: (-v.y * 0.5 + 0.5) * rect.h, visible: v.z > -1 && v.z < 1, text: `Fl ${f.level + 1} · ${f.label}`, tone };
    });
  }

  info(): InteriorInfo {
    const b = this.brief;
    const kindName = b.kind === "hall" ? "Town hall" : b.kind === "office" ? "Office tower" : b.kind === "home" ? "Housing" : b.kind === "food" ? "Food stall building" : b.kind === "shop" ? "Shophouse" : "Public building";
    const occupants = this.actors.filter((a) => (a.when ? a.when() : true)).length;
    const featured = this.floors.filter((f) => f.program !== "office" && f.program !== "apartment" || f.level === 1).slice(-6).reverse();
    const agenda = (b.kind === "hall" ? this.agenda() : this.agenda().filter((a) => a.district === b.district.id)).slice(-4).reverse().map((a) => a.text);
    return {
      title: b.kind === "hall" ? `Balai Kota · ${b.name}` : b.name,
      subtitle: `${kindName} · ${this.floors.length} floors · ${b.district.label}`,
      floors: featured.map((f) => ({ level: f.level + 1, label: f.label, doing: f.doing() })),
      occupants,
      agenda,
    };
  }

  dispose() {
    this.people.dispose();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.MeshBasicMaterial | undefined;
      if (mat) { mat.map?.dispose(); mat.dispose(); }
    });
    this.parent.remove(this.group);
  }
}
