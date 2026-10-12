import * as THREE from "three";
import type { CityMap } from "./geometry";
import type { CityClock } from "./clock";
import { findPlaces, type Place } from "./places";
import { RoadGraph, type Edge, type Profile } from "./roadgraph";
import { Layered, box, merge, part, toonRamp, wheel, type Model } from "./props";

/**
 * Kehidupan kota: kendaraan, pejalan kaki, truk logistik, kerumunan acara, pin, dan partikel.
 *
 * Semua gerak mengikuti graf jalan dari peta. Aktivitas didorong oleh `emit(event)`: setiap kejadian di kota
 * (setor, tarik, tata ulang, acara walikota, peringatan Satpam, usulan Analis) menjadi sesuatu yang terlihat.
 * Skala kendaraan dan orang dibesarkan agar terbaca dari jarak jauh (gaya mainan, bukan skala sebenarnya).
 */

export type Tone = "blue" | "green" | "amber" | "red" | "violet" | "gold";

export type LifeEvent =
  /** Dana berpindah antar distrik (tata ulang): konvoi truk bermuatan peti biru. */
  | { type: "transfer"; from: string; to: string; amount: number; tone?: Tone; label?: string }
  /** Penduduk menyetor: truk dan warga masuk dari tepi kota menuju alun-alun. */
  | { type: "deposit"; amount: number }
  /** Penduduk menarik: truk dan warga keluar dari alun-alun ke tepi kota. */
  | { type: "withdraw"; amount: number }
  /** Acara walikota di sebuah distrik: warga berkumpul, konfeti, cincin cahaya. */
  | { type: "festival"; at: string; label?: string; size?: number; seconds?: number }
  /** Fee walikota dicairkan: koin muncul di alun-alun. */
  | { type: "harvest"; amount: number }
  /** Satpam mengevakuasi sebuah distrik: mobil Satpam, sirene, warga bubar, truk membawa dana ke alun-alun. */
  | { type: "alert"; at: string; amount?: number; label?: string }
  /** Analis mengusulkan tata ulang: pin ungu menunggu persetujuan walikota. */
  | { type: "propose"; id: string; from: string; to: string; amount: number }
  /** `run: false` hanya menurunkan pin usulan (dipakai bila konvoinya datang dari kejadian `Rebalanced` yang menyusul). */
  | { type: "approve"; id: string; run?: boolean }
  /** Kembang api di atas alun-alun (karya sipil pilihan walikota). */
  | { type: "fireworks" };

export interface Floater {
  id: string;
  x: number;
  y: number;
  visible: boolean;
  text: string;
  tone: Tone;
}

/** Isi panel info saat sebuah kendaraan atau orang diklik. */
export interface Inspect {
  title: string;
  detail: string;
  tone: Tone;
}

/** Ringkasan kegiatan kota untuk panel ekonomi (hasil simulasi, bukan data onchain). */
export interface CityStats {
  vehicles: number;
  people: number;
  buses: number;
  riders: number;
  vendors: number;
  stallsOpen: number;
  tripsToday: number;
  deliveriesToday: number;
  busRidersToday: number;
  salesToday: number;
}

export interface LifeDistrict {
  id: string;
  kind: string;
  /** Warna aksen, "#rrggbb". */
  color: string;
  weight: number;
  /** Titik pusat distrik di peta. */
  x: number;
  z: number;
  /** Contoh atap bangunan di distrik ini (untuk percikan hasil), maksimal sekitar 40. */
  roofs: { x: number; z: number; h: number }[];
}

const S_VEH = 2.2;
const S_PED = 2.1;
const TONE_HEX: Record<Tone, number> = { blue: 0x3f6bff, green: 0x10b981, amber: 0xf59e0b, red: 0xef4444, violet: 0x7a5cff, gold: 0xf5b301 };
const PED_TINTS = ["#3f6bff", "#7a5cff", "#10b3a3", "#f59e0b", "#ec4899", "#ffffff", "#94a3d8", "#2f55e8"].map((c) => new THREE.Color(c));
const CAR_TINTS = ["#ffffff", "#dfe5fa", "#3f6bff", "#7a5cff", "#f4f6ff", "#10b3a3", "#f59e0b", "#9aa6cf", "#ff7a59"].map((c) => new THREE.Color(c));
const SKIN_TINTS = ["#f1c9a5", "#d9a37a", "#b97a56", "#8d5a3b", "#f6d6bd"].map((c) => new THREE.Color(c));
const CRATE_TINTS = ["#3f6bff", "#2f55e8", "#5b86ff"].map((c) => new THREE.Color(c));
const WHITE = new THREE.Color(1, 1, 1);

// ---------------------------------------------------------------------------------------------------------------
// Model low-poly. Orang bergaya balok seperti Minecraft; tangan dan kaki diayun di shader (lihat props.ts).
// ---------------------------------------------------------------------------------------------------------------

const WHITEC = 0xffffff, GLASS = 0x9db4e6;
const wheels = (xs: number[], zs: number[], r: number, w: number) => xs.flatMap((x) => zs.map((z) => part(wheel(r, w), 0x252a45, x, r, z)));

function buildModels() {
  const cab = () => part(box(1.9, 2.0, 2.3), WHITEC, 3.0, 1.6, 0);
  const car: Model = {
    tint: merge([part(box(4.2, 0.8, 1.8), WHITEC, 0, 0.75, 0), part(box(2.3, 0.16, 1.66), WHITEC, -0.3, 1.72, 0)]),
    fixed: merge([
      part(box(2.3, 0.7, 1.64), GLASS, -0.3, 1.35, 0),
      ...wheels([-1.35, 1.35], [-0.9, 0.9], 0.42, 0.34),
      part(box(0.1, 0.25, 0.5), 0xfff1b5, 2.12, 0.85, 0.55),
      part(box(0.1, 0.25, 0.5), 0xfff1b5, 2.12, 0.85, -0.55),
    ]),
  };
  const bike: Model = {
    tint: merge([part(box(1.5, 0.4, 0.34), WHITEC, 0, 0.8, 0), part(box(0.8, 0.3, 0.4), WHITEC, -0.2, 1.05, 0)]),
    fixed: merge([
      ...[-0.7, 0.7].map((x) => part(box(0.7, 0.7, 0.16), 0x252a45, x, 0.38, 0)),
      part(box(0.4, 0.75, 0.5), 0x39456f, -0.15, 1.45, 0),
      part(box(0.46, 0.46, 0.46), 0xf1f4ff, -0.1, 2.0, 0),
      part(box(0.1, 0.1, 0.7), 0x252a45, 0.55, 1.25, 0),
    ]),
  };
  const truckWheels = wheels([3.0, -0.2, -2.4], [-1.15, 1.15], 0.55, 0.45);
  const boxTruck: Model = {
    tint: merge([cab()]),
    fixed: merge([
      part(box(6, 2.6, 2.4), 0xf6f8ff, -0.9, 1.9, 0),
      part(box(6.02, 0.4, 2.42), 0x3f6bff, -0.9, 1.15, 0),
      part(box(0.08, 0.8, 1.9), GLASS, 3.96, 2.0, 0),
      ...truckWheels,
    ]),
  };
  const flatTruck: Model = {
    tint: merge([cab()]),
    fixed: merge([
      part(box(6, 0.4, 2.4), 0xdfe4f5, -0.9, 1.1, 0),
      part(box(1.5, 1.3, 1.3), 0x2f55e8, -2.6, 1.95, -0.7),
      part(box(1.5, 1.3, 1.3), 0x3f6bff, -2.6, 1.95, 0.7),
      part(box(1.5, 1.3, 1.3), 0x3f6bff, -0.8, 1.95, -0.7),
      part(box(1.5, 1.3, 1.3), 0x2f55e8, -0.8, 1.95, 0.7),
      part(box(1.5, 1.3, 1.3), 0x5b86ff, -1.7, 3.25, 0),
      part(box(0.08, 0.8, 1.9), GLASS, 3.96, 2.0, 0),
      ...truckWheels,
    ]),
  };
  // Orang balok: kepala 0.5, badan 0.72, kaki dan tangan 0.7. Pasangan [arah ayun, tinggi sendi] untuk shader.
  const ped: Model = {
    tint: merge([
      part(box(0.32, 0.72, 0.56), WHITEC, 0, 1.06, 0, [0, 0]),
      part(box(0.24, 0.7, 0.24), WHITEC, 0, 1.07, 0.4, [-1, 1.4]),
      part(box(0.24, 0.7, 0.24), WHITEC, 0, 1.07, -0.4, [1, 1.4]),
    ]),
    accent: merge([part(box(0.5, 0.5, 0.5), WHITEC, 0, 1.67, 0, [0, 0])]),
    fixed: merge([
      part(box(0.54, 0.16, 0.54), 0x3b2a22, -0.01, 1.9, 0, [0, 0]),
      part(box(0.04, 0.09, 0.1), 0x252a45, 0.26, 1.7, 0.12, [0, 0]),
      part(box(0.04, 0.09, 0.1), 0x252a45, 0.26, 1.7, -0.12, [0, 0]),
      part(box(0.26, 0.7, 0.26), 0x3a4a8a, 0, 0.35, 0.15, [1, 0.7]),
      part(box(0.26, 0.7, 0.26), 0x3a4a8a, 0, 0.35, -0.15, [-1, 0.7]),
    ]),
  };
  const pile: Model = {
    tint: merge([
      ...[[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]].map(([x, z]) => part(box(1, 0.9, 1), WHITEC, x, 0.63, z)),
      part(box(1, 0.9, 1), WHITEC, 0, 1.53, 0),
    ]),
    fixed: merge([part(box(2.4, 0.18, 2.4), 0xcf9c5d, 0, 0.09, 0)]),
  };
  // Bus kota: badan panjang berwarna, pita jendela gelap, garis putih, papan trayek.
  const bus: Model = {
    tint: merge([part(box(11, 2.3, 2.5), WHITEC, 0, 1.55, 0)]),
    fixed: merge([
      part(box(10.3, 0.95, 2.52), 0x2a3a5a, -0.2, 2.05, 0),
      part(box(11.02, 0.22, 2.52), 0xffffff, 0, 1.15, 0),
      part(box(10.6, 0.22, 2.3), 0xdfe4f5, 0, 2.82, 0),
      part(box(0.08, 1.3, 2.2), GLASS, 5.52, 2.0, 0),
      part(box(0.1, 0.32, 1.3), 0xffc845, 5.55, 2.75, 0),
      ...wheels([-3.6, 3.6], [-1.15, 1.15], 0.55, 0.42),
    ]),
  };
  // Angkot: mobil mini bergaris dengan kaca keliling.
  const angkot: Model = {
    tint: merge([part(box(4.6, 1.65, 1.9), WHITEC, 0, 1.15, 0)]),
    fixed: merge([
      part(box(3.7, 0.6, 1.92), GLASS, -0.3, 1.55, 0),
      part(box(4.62, 0.16, 1.92), 0xffffff, 0, 0.95, 0),
      part(box(4.4, 0.12, 1.7), 0x39456f, 0, 2.02, 0),
      ...wheels([-1.5, 1.5], [-0.9, 0.9], 0.4, 0.3),
    ]),
  };
  // Ojek: motor dengan pengendara berjaket (warna jaket per instance) dan kotak makanan atau penumpang.
  const rider = (x: number) => [part(box(0.42, 0.75, 0.52), WHITEC, x, 1.45, 0), part(box(0.48, 0.48, 0.48), WHITEC, x + 0.05, 2.02, 0)];
  const bikeBody = [
    ...[-0.7, 0.7].map((x) => part(box(0.7, 0.7, 0.16), 0x252a45, x, 0.38, 0)),
    part(box(1.5, 0.4, 0.34), 0x39456f, 0, 0.8, 0),
    part(box(0.1, 0.1, 0.7), 0x252a45, 0.55, 1.25, 0),
  ];
  const ojek: Model = {
    tint: merge(rider(-0.05)),
    fixed: merge([...bikeBody, part(box(0.62, 0.6, 0.6), 0xe2483b, -0.75, 1.35, 0)]),
  };
  const ojekP: Model = {
    tint: merge(rider(0.05)),
    fixed: merge([...bikeBody, part(box(0.4, 0.72, 0.5), 0x7a8bb8, -0.55, 1.43, 0), part(box(0.46, 0.46, 0.46), 0xf1f4ff, -0.52, 1.98, 0)]),
  };
  // Gerobak kaki lima: kotak kaca di atas roda, payung warna-warni, dan penjualnya.
  const cart: Model = {
    tint: merge([part(box(1.9, 0.12, 1.5), WHITEC, 0.25, 2.55, 0), part(box(1.7, 0.22, 1.1), WHITEC, 0.25, 1.05, 0)]),
    fixed: merge([
      part(box(1.6, 0.75, 0.95), 0xf6efe0, 0.25, 1.45, 0),
      part(box(1.5, 0.5, 0.85), 0xbfe3ff, 0.25, 1.5, 0),
      part(box(0.08, 1.1, 0.08), 0x6b7597, 0.25, 2.0, 0),
      part(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 10).rotateX(Math.PI / 2), 0x252a45, 0.6, 0.35, 0.5),
      part(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 10).rotateX(Math.PI / 2), 0x252a45, 0.6, 0.35, -0.5),
      part(box(0.08, 0.6, 0.08), 0x6b7597, -0.3, 0.3, 0),
      part(box(0.3, 0.7, 0.45), 0x3a4a8a, -1.05, 0.35, 0),
      part(box(0.32, 0.72, 0.52), 0xf2f2f2, -1.05, 1.06, 0),
      part(box(0.46, 0.46, 0.46), 0xe3b48c, -1.05, 1.67, 0),
      part(box(0.5, 0.14, 0.5), 0x3b2a22, -1.05, 1.9, 0),
    ]),
  };
  // Truk molen untuk proyek konstruksi.
  const mixer: Model = {
    tint: merge([part(box(1.9, 2.0, 2.3), WHITEC, 3.0, 1.6, 0)]),
    fixed: merge([
      part(box(6, 0.45, 2.2), 0x6b7597, -0.9, 1.0, 0),
      part(new THREE.CylinderGeometry(1.25, 0.8, 4.4, 14).rotateZ(Math.PI / 2 - 0.22), 0xe9ecf5, -1.1, 2.45, 0),
      part(new THREE.CylinderGeometry(1.27, 1.27, 0.3, 14).rotateZ(Math.PI / 2 - 0.22), 0xf59e0b, -0.4, 2.6, 0),
      part(box(0.08, 0.8, 1.9), GLASS, 3.96, 2.0, 0),
      ...truckWheels,
    ]),
  };
  return { car, bike, boxTruck, flatTruck, ped, pile, bus, angkot, ojek, ojekP, cart, mixer };
}

// ---------------------------------------------------------------------------------------------------------------
// Agen
// ---------------------------------------------------------------------------------------------------------------

type Kind = "car" | "bike" | "box" | "flat" | "satpam" | "ped" | "bus" | "angkot" | "ojek" | "ojekP" | "cart" | "mixer";
const PROFILE: Record<Kind, Profile> = { car: "veh", bike: "bike", box: "veh", flat: "veh", satpam: "veh", ped: "ped", bus: "veh", angkot: "veh", ojek: "bike", ojekP: "bike", cart: "ped", mixer: "veh" };
/** Panjang model (satuan model) untuk jarak antre dan letak lampu kendaraan. */
const KIND_LEN: Record<Kind, number> = { car: 4.2, bike: 1.8, box: 8, flat: 8, satpam: 4.2, ped: 0.6, bus: 11, angkot: 4.6, ojek: 1.8, ojekP: 1.8, cart: 2.6, mixer: 8 };
const KIND_SCALE: Record<Kind, number> = { car: 2.2, bike: 2.2, box: 2.2, flat: 2.2, satpam: 2.2, ped: 2.1, bus: 1.6, angkot: 2.0, ojek: 2.2, ojekP: 2.2, cart: 2.1, mixer: 2.2 };
const isVehicle = (k: Kind) => k !== "ped" && k !== "cart";
const VENDOR_ITEMS = ["Bakso", "Siomay", "Es cendol", "Sate ayam", "Martabak", "Kopi keliling", "Roti bakar", "Cilok", "Es dawet", "Nasi goreng"];

interface Agent {
  kind: Kind;
  slot: number;
  path: number[];
  seg: number;
  s: number;
  speed: number;
  side: 1 | -1;
  yaw: number;
  x: number;
  z: number;
  ph: number;
  ambient: boolean;
  parked?: boolean;
  kill: boolean;
  wait: number;
  phase: string;
  onEnd?: (a: Agent) => void;
  /** Dipakai kerumunan: id acara tempat agen ini berkumpul. */
  group?: string;
  /** Label melayang di atas agen ini. */
  tag?: { text: string; tone: Tone };
  pin?: THREE.Object3D;
  /** Nomor unik, peran, dan keterangan untuk panel info. */
  id: number;
  role: string;
  info?: () => string;
  /** Dipanggil saat agen tiba di sebuah simpul di tengah rute (halte, titik berhenti). */
  onNode?: (a: Agent, node: number) => void;
  /** Gerak bebas lurus ke satu titik (taman, kerumunan diam), bukan lewat graf jalan. */
  free?: { tx: number; tz: number };
  riders?: number;
  /** Waktu simulasi saat agen ini dihapus paling lambat (perjalanan yang terlalu lama). */
  ttl?: number;
}

interface Depot {
  id: string;
  node: number;
  x: number;
  z: number;
  ux: number;
  uz: number;
  color: string;
  kind: string;
  pile: number;
  shown: number;
  slots: number[];
  pad: THREE.Mesh;
  roofs: LifeDistrict["roofs"];
  weight: number;
}

interface ActiveEvent {
  id: string;
  type: "festival" | "alert" | "propose" | "note";
  start: number;
  x: number;
  z: number;
  color: number;
  until: number;
  nextPulse: number;
  nextSpark: number;
  beam: THREE.Mesh;
  pin: THREE.Object3D;
  text: string;
  tone: Tone;
  depot: string;
  proposal?: { from: string; to: string; amount: number };
}

const COUNT = { car: 90, bike: 60, box: 14, flat: 24, satpam: 6, ped: 520, pile: 96, bus: 6, angkot: 14, ojek: 30, ojekP: 24, cart: 14, mixer: 6 };

export class CityLife {
  floaters: Floater[] = [];

  private g: RoadGraph;
  private dev = 1;
  private group = new THREE.Group();
  private models = buildModels();
  private pools: Record<Kind, Layered>;
  private piles: Layered;
  private beacons: THREE.InstancedMesh;
  private agents: Agent[] = [];
  private depots = new Map<string, Depot>();
  private events = new Map<string, ActiveEvent>();
  private timers: { at: number; fn: () => void }[] = [];
  private t = 0;
  private activity = 1;
  private rnd: () => number;
  private seed = 1;
  private dummy = new THREE.Object3D();
  private off = new THREE.Matrix4();
  private tmpM = new THREE.Matrix4();
  private tmpV = new THREE.Vector3();
  private pinPool: { mesh: THREE.Group; used: boolean }[] = [];
  private rings: { mesh: THREE.Mesh; age: number; life: number; r0: number; r1: number; live: boolean }[] = [];
  private particles: { mesh: THREE.Points; pos: Float32Array; col: Float32Array; vel: Float32Array; life: Float32Array; max: Float32Array; next: number };
  private ambientTarget = { car: 0, bike: 0, box: 0, ped: 0, parked: 0 };
  private spawnCool = 0;
  private edgeNodes: number[] = [];
  private center: [number, number];
  private idCounter = 0;
  private ok: boolean;
  private beaconColor = new THREE.Color();
  private nextId = 1;
  private clock: CityClock | null = null;
  private places: Place[] = [];
  private byKind: Record<"home" | "office" | "food" | "shop" | "civic", Place[]> = { home: [], office: [], food: [], shop: [], civic: [] };
  private parks: { x: number; z: number; r: number; cells: { x: number; z: number }[] }[] = [];
  private sites: { x: number; z: number; node: number }[] = [];
  private signals = new Map<number, { axis: number; off: number; stop: number; lights: { x: number; z: number; group: number }[] }>();
  private sigLights: THREE.InstancedMesh | null = null;
  private sigCool = 0;
  private bus: { path: number[]; stops: Map<number, number>; shelters: { x: number; z: number; waiting: Agent[]; name: string }[] } | null = null;
  private market: { group: THREE.Group; spots: { x: number; z: number }[]; lights: THREE.Points; open: number } | null = null;
  private heads: THREE.InstancedMesh;
  private tails: THREE.InstancedMesh;
  private night = 0;
  private selected: Agent | null = null;
  private routineCool = 0;
  private today = { trips: 0, deliveries: 0, busRiders: 0, sales: 0 };
  private lastHour = 0;
  private leaders = new Map<number, Agent[]>();
  private motorRows = false;

  constructor(private parent: THREE.Object3D, private map: CityMap, graph: RoadGraph) {
    this.g = graph;
    this.ok = this.g.main.veh.length > 1 && this.g.main.ped.length > 1;
    this.rnd = () => { this.seed = (this.seed * 16807) % 2147483647; return (this.seed - 1) / 2147483646; };
    this.center = [(map.bounds[0] + map.bounds[2]) / 2, (map.bounds[1] + map.bounds[3]) / 2];
    parent.add(this.group);

    const m = this.models;
    this.pools = {
      car: new Layered(this.group, m.car, COUNT.car),
      bike: new Layered(this.group, m.bike, COUNT.bike),
      box: new Layered(this.group, m.boxTruck, COUNT.box),
      flat: new Layered(this.group, m.flatTruck, COUNT.flat),
      satpam: new Layered(this.group, m.car, COUNT.satpam),
      ped: new Layered(this.group, m.ped, COUNT.ped, true, true),
      bus: new Layered(this.group, m.bus, COUNT.bus),
      angkot: new Layered(this.group, m.angkot, COUNT.angkot),
      ojek: new Layered(this.group, m.ojek, COUNT.ojek),
      ojekP: new Layered(this.group, m.ojekP, COUNT.ojekP),
      cart: new Layered(this.group, m.cart, COUNT.cart),
      mixer: new Layered(this.group, m.mixer, COUNT.mixer),
    };
    this.piles = new Layered(this.group, m.pile, COUNT.pile);
    this.beacons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), COUNT.satpam);
    this.beacons.frustumCulled = false;
    this.beacons.setColorAt(0, WHITE);
    for (let i = 0; i < COUNT.satpam; i++) this.beacons.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
    this.group.add(this.beacons);

    // Rintisan partikel: konfeti, koin, percikan hasil.
    const cap = 900;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(cap * 3).fill(-9999);
    const col = new Float32Array(cap * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 3.4, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true }));
    pts.frustumCulled = false;
    this.group.add(pts);
    this.particles = { mesh: pts, pos, col, vel: new Float32Array(cap * 3), life: new Float32Array(cap), max: new Float32Array(cap).fill(1), next: 0 };

    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 56), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({ mesh, age: 0, life: 1, r0: 4, r1: 30, live: false });
    }
    for (let i = 0; i < 16; i++) this.pinPool.push({ mesh: this.makePin(), used: false });

    // Titik tepi kota: tempat warga dan truk masuk atau keluar.
    const [cx, cz] = this.center;
    this.edgeNodes = [...this.g.main.veh]
      .sort((a, b) => Math.hypot(this.g.x[b] - cx, this.g.z[b] - cz) - Math.hypot(this.g.x[a] - cx, this.g.z[a] - cz))
      .slice(0, Math.max(6, Math.round(this.g.main.veh.length * 0.08)));

    // Tempat (rumah, kantor, warung, toko, fasilitas), lampu lalu lintas, jalur bus, dan lampu kendaraan malam.
    if (this.ok) {
      this.places = findPlaces(map, this.g);
      for (const pl of this.places) this.byKind[pl.kind].push(pl);
      this.buildSignals();
      this.buildBusLine();
    }
    const lightGeo = new THREE.BoxGeometry(0.5, 0.35, 1.5);
    this.heads = new THREE.InstancedMesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xfff1c4 }), 400);
    this.tails = new THREE.InstancedMesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xff3b3b }), 400);
    for (const m of [this.heads, this.tails]) { m.count = 0; m.frustumCulled = false; this.group.add(m); }

    this.setActivity(1);
  }

  // -------------------------------------------------------------------------------------------------------------
  // Distrik dan aktivitas
  // -------------------------------------------------------------------------------------------------------------

  setDistricts(list: LifeDistrict[]) {
    if (!this.ok) return;
    const ids = new Set(list.map((d) => d.id));
    for (const [id, dep] of this.depots) if (!ids.has(id)) { this.removeDepot(dep); this.depots.delete(id); }
    const nodes = [...this.depots.values()].map((d) => d.node);
    for (const d of list) {
      let dep = this.depots.get(d.id);
      if (!dep) {
        const node = this.g.nearest(d.x, d.z, "veh", nodes, 80);
        nodes.push(node);
        dep = this.makeDepot(d, node);
        this.depots.set(d.id, dep);
      }
      dep.roofs = d.roofs;
      dep.weight = d.weight;
      dep.color = d.color;
      dep.kind = d.kind;
      (dep.pad.material as THREE.MeshBasicMaterial).color.set(d.color);
      dep.pile = Math.max(0, Math.min(12, Math.round(d.weight * 12)));
    }
  }

  private makeDepot(d: LifeDistrict, node: number): Depot {
    const x = this.g.x[node], z = this.g.z[node];
    let ux = 1, uz = 0;
    const e = this.g.adj[node].find((q) => this.g.ok(q, "veh"));
    if (e) { ux = (this.g.x[e.to] - x) / e.len; uz = (this.g.z[e.to] - z) / e.len; }
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(36, 15), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.28, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 }));
    pad.rotation.x = -Math.PI / 2;
    pad.rotation.z = Math.atan2(uz, ux);
    pad.position.set(x, 0.12, z);
    pad.renderOrder = 1;
    // Garis tepi kuning seperti petak parkir.
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(36, 15)),
      new THREE.LineBasicMaterial({ color: 0xf5b301 }),
    );
    edge.position.z = 0.02;
    pad.add(edge);
    this.group.add(pad);
    return { id: d.id, node, x, z, ux, uz, color: d.color, kind: d.kind, pile: 0, shown: 0, slots: [], pad, roofs: d.roofs, weight: d.weight };
  }

  private removeDepot(dep: Depot) {
    this.group.remove(dep.pad);
    dep.pad.geometry.dispose();
    (dep.pad.material as THREE.Material).dispose();
    for (const s of dep.slots) this.piles.release(s);
  }

  setActivity(v: number) {
    this.activity = Math.max(0, Math.min(1.6, v));
    this.retarget();
  }

  /** Perkembangan kota 0..1: kota kosong sepi, kota yang tumbuh makin ramai. */
  setDevelopment(d: number) {
    this.dev = Math.max(0, Math.min(1, d));
    this.retarget();
  }

  private retarget() {
    const len = this.g.streetLength;
    const cars = Math.max(10, Math.min(56, Math.round(len / 450)));
    const grow = Math.min(1, this.dev * 1.4);
    const k = this.activity * grow;
    this.ambientTarget = {
      car: Math.round(cars * k),
      bike: Math.round(cars * 0.8 * k),
      box: Math.round(Math.max(3, cars * 0.12) * k),
      ped: Math.round(Math.max(60, Math.min(200, this.map.buildings.length * 0.25)) * k),
      parked: Math.round(cars * 0.55 * grow),
    };
  }

  /** Posisi pusat sebuah distrik, untuk kamera yang mengikuti kejadian. */
  focusPoint(id: string): { x: number; z: number } | null {
    const d = this.depots.get(id);
    return d ? { x: d.x, z: d.z } : null;
  }

  private depotOf(id: string): Depot | undefined {
    return this.depots.get(id) ?? this.depots.get("idle") ?? [...this.depots.values()][0];
  }

  private uid(prefix: string) { return `${prefix}${++this.idCounter}`; }

  emit(ev: LifeEvent) {
    if (!this.ok) return;
    switch (ev.type) {
      case "transfer": this.transfer(ev.from, ev.to, ev.amount, ev.tone ?? "blue", ev.label); break;
      case "deposit": this.flow(true, ev.amount); break;
      case "withdraw": this.flow(false, ev.amount); break;
      case "festival": this.festival(ev.at, ev.label ?? "Mayor's event", ev.size ?? 46, ev.seconds ?? 36); break;
      case "harvest": this.harvest(ev.amount); break;
      case "alert": this.alert(ev.at, ev.amount ?? 800, ev.label); break;
      case "propose": this.propose(ev.id, ev.from, ev.to, ev.amount); break;
      case "approve": this.approve(ev.id, ev.run !== false); break;
      case "fireworks": this.fireworks(); break;
    }
  }

  private after(sec: number, fn: () => void) { this.timers.push({ at: this.t + sec, fn }); }

  private fmt(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${Math.round(n)}`; }

  // --- Logistik -------------------------------------------------------------------------------------------------

  private convoySize(amount: number) { return Math.max(1, Math.min(6, 1 + Math.floor(Math.log10(Math.max(1, amount))))); }

  private transfer(from: string, to: string, amount: number, tone: Tone, label?: string) {
    const a = this.depotOf(from), b = this.depotOf(to);
    if (!a || !b) return;
    const route = a.node === b.node ? [a.node] : this.g.route(a.node, b.node, "veh");
    if (!route) return;
    const n = this.convoySize(amount);
    const text = label ?? `${this.fmt(amount)} AUSD`;
    for (let k = 0; k < n; k++) {
      this.after(k * 1.2, () => {
        a.pile = Math.max(0, a.pile - 1);
        const t = this.spawn("flat", route, { speed: 12 + this.rnd() * 3, tag: k === 0 ? { text, tone } : undefined });
        if (!t) return;
        t.phase = "go";
        t.onEnd = (ag) => {
          if (ag.phase === "go") {
            ag.phase = "unload";
            ag.wait = 1.8;
            b.pile = Math.min(12, b.pile + 1);
            this.burst(b.x, 3, b.z, 10, [TONE_HEX[tone], 0xffffff], 1.4, 12);
            this.ring(b.x, b.z, TONE_HEX[tone], 3, 22, 1.8);
          } else if (ag.phase === "unload") {
            ag.phase = "exit";
            const out = this.g.route(b.node, this.pickEdge(), "veh");
            if (out && out.length > 1) { ag.path = out; ag.seg = 0; ag.s = 0; ag.tag = undefined; } else ag.kill = true;
          } else ag.kill = true;
        };
      });
    }
  }

  private pickEdge(): number { return this.edgeNodes[Math.floor(this.rnd() * this.edgeNodes.length)] ?? this.g.randomMain("veh", this.rnd); }

  /** Setor atau tarik: truk dan warga bergerak antara tepi kota dan alun-alun. */
  private flow(inbound: boolean, amount: number) {
    const plaza = this.depotOf("idle");
    if (!plaza) return;
    const edge = this.pickEdge();
    const route = inbound ? this.g.route(edge, plaza.node, "veh") : this.g.route(plaza.node, edge, "veh");
    if (!route) return;
    const tone: Tone = inbound ? "green" : "amber";
    const text = `${inbound ? "+" : "−"}${this.fmt(amount)} AUSD`;
    const n = Math.max(1, Math.min(3, Math.round(this.convoySize(amount) / 2)));
    for (let k = 0; k < n; k++) {
      this.after(k * 1.4, () => {
        if (!inbound) plaza.pile = Math.max(0, plaza.pile - 1);
        const t = this.spawn("flat", route, { speed: 13 + this.rnd() * 3, tag: k === 0 ? { text, tone } : undefined });
        if (!t) return;
        t.phase = "go";
        t.onEnd = (ag) => {
          if (ag.phase === "go" && inbound) {
            ag.phase = "unload"; ag.wait = 1.6; plaza.pile = Math.min(12, plaza.pile + 1);
            this.burst(plaza.x, 3, plaza.z, 10, [TONE_HEX.green, 0xffffff], 1.4, 12);
            this.ring(plaza.x, plaza.z, TONE_HEX.green, 3, 22, 1.8);
          } else if (ag.phase === "unload") {
            ag.phase = "exit";
            const out = this.g.route(plaza.node, this.pickEdge(), "veh");
            if (out && out.length > 1) { ag.path = out; ag.seg = 0; ag.s = 0; ag.tag = undefined; } else ag.kill = true;
          } else ag.kill = true;
        };
      });
    }
    // Warga ikut datang atau pergi.
    const walkers = Math.min(10, 3 + Math.round(Math.log10(Math.max(1, amount)) * 2));
    const eNode = this.nearestPed(this.g.x[edge], this.g.z[edge]);
    const pNode = this.nearestPed(plaza.x, plaza.z);
    for (let k = 0; k < walkers; k++) {
      this.after(0.3 + k * 0.7, () => {
        const r = inbound ? this.g.route(eNode, pNode, "ped") : this.g.route(pNode, eNode, "ped");
        if (!r || r.length < 2) return;
        const w = this.spawn("ped", r, { speed: 2.4 + this.rnd() * 1.4 });
        if (w) w.onEnd = (ag) => { ag.kill = true; };
      });
    }
  }

  private nearestPed(x: number, z: number): number {
    let best = this.g.main.ped[0] ?? 0, bd = Infinity;
    for (const n of this.g.main.ped) { const d = Math.hypot(this.g.x[n] - x, this.g.z[n] - z); if (d < bd) { bd = d; best = n; } }
    return best;
  }

  // --- Acara, peringatan, usulan -----------------------------------------------------------------------------

  private makeEvent(type: ActiveEvent["type"], dep: Depot, color: number, seconds: number, text: string, tone: Tone): ActiveEvent {
    const id = this.uid("e");
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 11, 110, 20, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.position.set(dep.x, 55, dep.z);
    this.group.add(beam);
    const pin = this.takePin(color);
    const ev: ActiveEvent = { id, type, start: this.t, x: dep.x, z: dep.z, color, until: this.t + seconds, nextPulse: this.t, nextSpark: this.t, beam, pin, text, tone, depot: dep.id };
    this.events.set(id, ev);
    return ev;
  }

  private festival(at: string, label: string, size: number, seconds: number) {
    const dep = this.depotOf(at);
    if (!dep) return;
    const col = new THREE.Color(dep.color).getHex();
    const ev = this.makeEvent("festival", dep, col, seconds, label, "violet");
    const n = Math.round(size * Math.max(0.5, this.activity));
    for (let k = 0; k < n; k++) {
      this.after(k * (seconds * 0.22) / n, () => {
        if (!this.events.has(ev.id)) return;
        const from = this.randomNear(dep, 150, 20);
        const to = this.randomNear(dep, 26, 0);
        const r = this.g.route(from, to, "ped");
        if (!r || r.length < 2) return;
        const w = this.spawn("ped", r, { speed: 2.2 + this.rnd() * 1.6 });
        if (!w) return;
        w.group = ev.id;
        w.phase = "go";
        w.onEnd = (ag) => this.crowdStep(ag, dep, ev.id);
      });
    }
    return ev;
  }

  private randomNear(dep: Depot, maxD: number, minD: number): number {
    const c: number[] = [];
    for (const n of this.g.main.ped) {
      const d = Math.hypot(this.g.x[n] - dep.x, this.g.z[n] - dep.z);
      if (d <= maxD && d >= minD) c.push(n);
    }
    if (!c.length) return dep.node;
    return c[Math.floor(this.rnd() * c.length)];
  }

  private crowdStep(ag: Agent, dep: Depot, evId: string) {
    const alive = this.events.get(evId);
    if (ag.phase === "leave" || !alive) { ag.kill = true; return; }
    // Berkeliling di sekitar titik acara.
    ag.phase = "mill";
    ag.wait = 1 + this.rnd() * 3.5;
    const last = ag.path[ag.path.length - 1];
    const to = this.randomNear(dep, 24, 0);
    const r = to === last ? [last] : this.g.route(last, to, "ped");
    ag.onEnd = (a2) => this.crowdStep(a2, dep, evId);
    if (r && r.length > 1) { ag.path = r; ag.seg = 0; ag.s = 0; }
  }

  private disperse(evId: string, toward?: Depot) {
    for (const ag of this.agents) {
      if (ag.group !== evId || ag.kill) continue;
      const last = ag.path[Math.min(ag.path.length - 1, ag.seg + 1)] ?? ag.path[ag.path.length - 1];
      const dest = toward ? this.randomNear(toward, 60, 0) : this.pickEdge();
      const r = this.g.route(last, this.g.inMain(dest, "ped") ? dest : this.nearestPed(this.g.x[dest], this.g.z[dest]), "ped");
      ag.phase = "leave";
      ag.wait = 0;
      ag.speed = 3.6 + this.rnd();
      if (r && r.length > 1) { ag.path = r; ag.seg = 0; ag.s = 0; ag.onEnd = (a2) => { a2.kill = true; }; } else ag.kill = true;
    }
  }

  private alert(at: string, amount: number, label?: string) {
    const dep = this.depotOf(at), plaza = this.depotOf("idle");
    if (!dep || !plaza) return;
    const ev = this.makeEvent("alert", dep, TONE_HEX.red, 22, label ?? "Satpam: evacuating", "red");
    // Warga yang sedang berkumpul di distrik ini bubar.
    for (const other of this.events.values()) if (other.type === "festival" && other.depot === dep.id) this.disperse(other.id, plaza);
    // Dua mobil Satpam dari alun-alun.
    const r = dep.node === plaza.node ? [dep.node] : this.g.route(plaza.node, dep.node, "veh");
    if (r) {
      for (let k = 0; k < 2; k++) {
        this.after(k * 1.3, () => {
          const c = this.spawn("satpam", r, { speed: 19 });
          if (!c) return;
          c.phase = "go";
          c.onEnd = (ag) => {
            if (ag.phase === "go") { ag.phase = "hold"; ag.wait = 9; return; }
            if (ag.phase === "hold") {
              ag.phase = "back";
              const back = this.g.route(dep.node, plaza.node, "veh");
              if (back && back.length > 1) { ag.path = back; ag.seg = 0; ag.s = 0; } else ag.kill = true;
              return;
            }
            ag.kill = true;
          };
        });
      }
    }
    // Truk membawa dana ke alun-alun.
    this.after(2.5, () => this.transfer(at, "idle", amount, "red", `${this.fmt(amount)} AUSD to safety`));
    return ev;
  }

  private propose(id: string, from: string, to: string, amount: number) {
    const dep = this.depotOf(to);
    if (!dep) return;
    const ev = this.makeEvent("propose", dep, TONE_HEX.violet, 600, `Analyst proposes: ${this.depotOf(from)?.kind ?? from} → ${dep.kind} · ${this.fmt(amount)}`, "violet");
    ev.proposal = { from, to, amount };
    this.events.delete(ev.id);
    this.events.set(`proposal:${id}`, ev);
  }

  private approve(id: string, run: boolean) {
    const ev = this.events.get(`proposal:${id}`);
    if (!ev || !ev.proposal) return;
    ev.until = this.t;
    const p = ev.proposal;
    if (run) this.after(0.4, () => this.transfer(p.from, p.to, p.amount, "violet", `${this.fmt(p.amount)} AUSD · approved`));
  }

  private fireworks() {
    const dep = this.depotOf("idle");
    if (!dep) return;
    const palette = [0xffd45e, 0xff6b9a, 0x7aa2ff, 0xffffff, 0x7af0c3];
    for (let k = 0; k < 5; k++) {
      this.after(k * 0.55, () => {
        const x = dep.x + (this.rnd() - 0.5) * 80, z = dep.z + (this.rnd() - 0.5) * 80, y = 60 + this.rnd() * 40;
        const c = palette[Math.floor(this.rnd() * palette.length)];
        const p = this.particles;
        const cap = p.life.length;
        const col = new THREE.Color(c);
        for (let i = 0; i < 70; i++) {
          const j = p.next++ % cap;
          const u = this.rnd() * 2 - 1, a = this.rnd() * 6.283, s = Math.sqrt(1 - u * u), sp = 12 + this.rnd() * 10;
          p.pos[j * 3] = x; p.pos[j * 3 + 1] = y; p.pos[j * 3 + 2] = z;
          p.vel[j * 3] = Math.cos(a) * s * sp; p.vel[j * 3 + 1] = u * sp; p.vel[j * 3 + 2] = Math.sin(a) * s * sp;
          p.col[j * 3] = col.r; p.col[j * 3 + 1] = col.g; p.col[j * 3 + 2] = col.b;
          p.life[j] = p.max[j] = 1.8 + this.rnd() * 1.2;
        }
      });
    }
  }

  private harvest(amount: number) {
    const dep = this.depotOf("idle");
    if (!dep) return;
    this.burst(dep.x, 6, dep.z, 70, [0xf5b301, 0xffd45e, 0xffffff], 3.2, 26);
    this.ring(dep.x, dep.z, 0xf5b301, 4, 36, 2.2);
    this.makeEvent("note", dep, 0xf5b301, 5.5, `Fee collected · +${amount.toFixed(1)} AUSD`, "gold");
  }


  // =============================================================================================================
  // Masyarakat: jam, tempat, lampu lalu lintas, bus dan angkot, ojek, pedagang, pasar malam, taman, proyek
  // =============================================================================================================

  setClock(c: CityClock) { this.clock = c; }
  setParks(spots: { x: number; z: number; r: number; cells: { x: number; z: number }[] }[]) { this.parks = spots.filter((s) => s.cells.length >= 4); }
  setConstructionSites(list: { x: number; z: number }[]) {
    if (!this.ok) return;
    this.sites = list.slice(0, 4).map((s) => ({ ...s, node: this.g.nearest(s.x, s.z, "veh") }));
  }
  /** 0 siang, 1 malam: menyalakan lampu kendaraan dan lampu pasar malam. */
  setNight(n: number) { this.night = n; }

  private hour() { return this.clock?.hour ?? 12; }
  /** Tempat sejenis dalam jarak `maxD` dari (x, z); bila tidak ada, sembarang tempat sejenis. */
  private pickNear(kind: keyof CityLife["byKind"], x: number, z: number, maxD: number): Place | undefined {
    const list = this.byKind[kind].filter((q) => Math.hypot(q.x - x, q.z - z) < maxD);
    return list.length ? list[Math.floor(this.rnd() * list.length)] : this.pickPlace(kind);
  }
  private pickPlace(kind: keyof CityLife["byKind"]): Place | undefined {
    const list = this.byKind[kind];
    return list.length ? list[Math.floor(this.rnd() * list.length)] : this.places[Math.floor(this.rnd() * this.places.length)];
  }

  // --- Lampu lalu lintas ---------------------------------------------------------------------------------------

  private buildSignals() {
    const g = this.g;
    const parts: THREE.BufferGeometry[] = [];
    const lights: { x: number; z: number }[] = [];
    for (const n of g.main.veh) {
      const legs = g.adj[n].filter((e) => !e.foot && e.w >= 5);
      if (legs.length < 3 || !legs.some((e) => e.w >= 7)) continue;
      const axis = Math.atan2(g.z[legs[0].to] - g.z[n], g.x[legs[0].to] - g.x[n]);
      const stop = Math.max(...legs.map((e) => e.w)) / 2 + 5.5;
      const sig = { axis, off: (n * 7.31) % 18, stop, lights: [] as { x: number; z: number; group: number }[] };
      for (const e of legs) {
        if (e.len < stop + 4) continue;
        const ux = (g.x[e.to] - g.x[n]) / e.len, uz = (g.z[e.to] - g.z[n]) / e.len;
        const lx = -uz, lz = ux;
        const px = g.x[n] + ux * (stop - 1) + lx * (e.w / 2 + 1.3), pz = g.z[n] + uz * (stop - 1) + lz * (e.w / 2 + 1.3);
        const hx = px - lx * 2.1, hz = pz - lz * 2.1;
        parts.push(
          part(box(0.28, 5.6, 0.28), 0x39456f, px, 2.8, pz),
          part(box(2.3, 0.16, 0.16).rotateY(Math.atan2(lz, -lx)), 0x39456f, px - lx * 1.1, 5.45, pz - lz * 1.1),
          part(box(0.6, 1.5, 0.6), 0x252a45, hx, 4.8, hz),
        );
        const group = Math.abs(Math.sin(Math.atan2(uz, ux) - axis)) < 0.707 ? 0 : 1;
        sig.lights.push({ x: hx + ux * 0.34, z: hz + uz * 0.34, group });
        lights.push({ x: hx + ux * 0.34, z: hz + uz * 0.34 });
      }
      if (sig.lights.length >= 2) this.signals.set(n, sig);
    }
    if (!parts.length) return;
    const poles = new THREE.Mesh(merge(parts), new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }));
    poles.castShadow = true;
    this.group.add(poles);
    const total = [...this.signals.values()].reduce((s, q) => s + q.lights.length, 0);
    this.sigLights = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, total));
    this.sigLights.frustumCulled = false;
    let i = 0;
    for (const sig of this.signals.values()) for (const l of sig.lights) {
      this.dummy.position.set(l.x, 4.8, l.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.sigLights.setMatrixAt(i++, this.dummy.matrix);
    }
    this.sigLights.setColorAt(0, WHITE);
    this.group.add(this.sigLights);
  }

  private signalState(sig: { axis: number; off: number }, from: number, to: number): "g" | "a" | "r" {
    const ang = Math.atan2(this.g.z[to] - this.g.z[from], this.g.x[to] - this.g.x[from]);
    return this.phaseOf(sig, Math.abs(Math.sin(ang - sig.axis)) < 0.707 ? 0 : 1);
  }

  private phaseOf(sig: { off: number }, group: number): "g" | "a" | "r" {
    const C = 18, half = C / 2;
    const p = (((this.t + sig.off) % C) + C) % C;
    const local = group === 0 ? p : (p + half) % C;
    return local < half - 2.5 ? "g" : local < half ? "a" : "r";
  }

  private paintSignals() {
    if (!this.sigLights) return;
    const c = new THREE.Color();
    let i = 0;
    for (const sig of this.signals.values()) for (const l of sig.lights) {
      const st = this.phaseOf(sig, l.group);
      c.setHex(st === "g" ? 0x2ee86b : st === "a" ? 0xffc233 : 0xff3b3b);
      this.sigLights.setColorAt(i++, c);
    }
    if (this.sigLights.instanceColor) this.sigLights.instanceColor.needsUpdate = true;
  }

  // --- Bus kota dan halte -------------------------------------------------------------------------------------

  private buildBusLine() {
    const g = this.g;
    const [x0, z0, x1, z1] = this.map.bounds;
    const [cx, cz] = this.center;
    const R = Math.min(x1 - x0, z1 - z0) * 0.24;
    const way: number[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      const n = g.nearest(cx + Math.cos(a) * R, cz + Math.sin(a) * R, "veh", way, 110);
      if (!way.includes(n)) way.push(n);
    }
    if (way.length < 3) return;
    const path: number[] = [];
    for (let i = 0; i < way.length; i++) {
      const r = g.route(way[i], way[(i + 1) % way.length], "veh");
      if (!r || r.length < 2) return;
      if (path.length) r.shift();
      path.push(...r);
    }
    if (path.length < 8) return;
    const NAMES = ["Taman Kota", "Pasar Baru", "Balai Kota", "Menara", "Kampus", "Stasiun", "Masjid Raya", "Plaza", "Pecinan", "Kali Bersih", "Rumah Sakit", "Terminal"];
    const stops = new Map<number, number>();
    const shelters: { x: number; z: number; waiting: Agent[]; name: string }[] = [];
    const parts: THREE.BufferGeometry[] = [];
    let acc = 0, next = 110;
    for (let i = 1; i < path.length - 1; i++) {
      const e = g.edge(path[i - 1], path[i]);
      acc += e?.len ?? 0;
      if (acc < next || this.signals.has(path[i]) || !e) continue;
      const e2 = g.edge(path[i], path[i + 1]);
      if (!e2) continue;
      const dx = (g.x[path[i + 1]] - g.x[path[i]]) / e2.len, dz = (g.z[path[i + 1]] - g.z[path[i]]) / e2.len;
      const lx = dz, lz = -dx;
      const off = e2.w / 2 + 2.8;
      const x = g.x[path[i]] + lx * off, z = g.z[path[i]] + lz * off;
      const yaw = Math.atan2(-dz, dx);
      const rot = (geo: THREE.BufferGeometry) => geo.rotateY(yaw);
      parts.push(
        part(rot(box(5.2, 0.22, 2.4).translate(0, 2.7, 0)), 0x2f6fe0, x, 0, z),
        part(rot(box(5.0, 1.7, 0.1).translate(0, 1.55, 1.05)), 0xbfd6ff, x, 0, z),
        part(rot(box(0.18, 2.7, 0.18).translate(-2.4, 1.35, 1.0)), 0xdfe4f5, x, 0, z),
        part(rot(box(0.18, 2.7, 0.18).translate(2.4, 1.35, 1.0)), 0xdfe4f5, x, 0, z),
        part(rot(box(3.8, 0.25, 0.6).translate(0, 0.55, 0.6)), 0xb07a4a, x, 0, z),
        part(rot(box(0.14, 3.2, 0.14).translate(2.9, 1.6, -0.7)), 0x6b7597, x, 0, z),
        part(rot(box(0.12, 0.9, 0.9).translate(2.9, 3.3, -0.7)), 0x2f6fe0, x, 0, z),
      );
      stops.set(i, shelters.length);
      shelters.push({ x: x - lx * 1.0, z: z - lz * 1.0, waiting: [], name: `Halte ${NAMES[shelters.length % NAMES.length]}` });
      next = acc + 230;
    }
    if (!shelters.length) return;
    const mesh = new THREE.Mesh(merge(parts), new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }));
    mesh.castShadow = true;
    this.group.add(mesh);
    this.bus = { path, stops, shelters };
  }

  private spawnBus() {
    const line = this.bus;
    if (!line) return;
    const starts = [...line.stops.keys()];
    const at = starts[Math.floor(this.rnd() * starts.length)] ?? 0;
    const a = this.spawn("bus", line.path, { speed: 9 + this.rnd() * 2 });
    if (!a) return;
    a.seg = at;
    a.riders = Math.floor(this.rnd() * 12);
    a.role = "City bus · line N1";
    a.onEnd = (ag) => { ag.path = line.path; ag.seg = 0; ag.s = 0; };
    a.onNode = (ag) => {
      const si = line.stops.get(ag.seg);
      if (si === undefined) return;
      // Di luar jam operasi bus pulang ke pool setelah halte berikutnya.
      if (this.clock && !this.clock.busService(this.hour())) { ag.kill = true; return; }
      const sh = line.shelters[si];
      const off = Math.min(ag.riders ?? 0, Math.floor(this.rnd() * 5));
      ag.riders = (ag.riders ?? 0) - off;
      for (let k = 0; k < off; k++) this.after(0.3 + k * 0.4, () => this.walkFrom(sh.x, sh.z, "Bus passenger"));
      const board = Math.min(sh.waiting.length, 40 - (ag.riders ?? 0));
      for (let k = 0; k < board; k++) { const w = sh.waiting.pop(); if (w) w.kill = true; }
      ag.riders = (ag.riders ?? 0) + board;
      this.today.busRiders += board;
      ag.wait = 2.2 + board * 0.25;
    };
    a.info = () => {
      let name = "";
      for (let i = a.seg + 1; i < line.path.length && !name; i++) { const si = line.stops.get(i); if (si !== undefined) name = line.shelters[si].name; }
      return `${a.riders ?? 0} passengers on board · next stop ${name || line.shelters[0].name}`;
    };
  }

  // --- Orang dan perjalanan ----------------------------------------------------------------------------------

  private pedTrip(from: number, to: number, role: string, detail: string, onArrive?: () => void): Agent | null {
    const r = this.g.route(from, to, "ped");
    if (!r || r.length < 2) return null;
    const a = this.spawn("ped", r, { speed: 1.25 + this.rnd() * 0.7 });
    if (!a) return null;
    a.role = role;
    a.info = () => detail;
    a.ttl = this.t + 150;
    a.onEnd = (ag) => { ag.kill = true; this.today.trips++; onArrive?.(); };
    return a;
  }

  /** Perjalanan dari pintu gedung ke pintu gedung: keluar pintu, menyusuri trotoar, lalu masuk pintu tujuan. */
  private journey(from: Place, to: Place, role: string, detail: string): Agent | null {
    const r = this.g.route(from.ped, to.ped, "ped");
    if (!r || r.length < 2) return null;
    const a = this.spawn("ped", [from.ped], { speed: 1.25 + this.rnd() * 0.7 });
    if (!a) return null;
    a.role = role;
    a.info = () => detail;
    a.ttl = this.t + 170;
    a.x = from.door.x; a.z = from.door.z;
    a.free = { tx: this.g.x[from.ped], tz: this.g.z[from.ped] };
    a.onEnd = (ag) => {
      ag.free = undefined;
      ag.path = r; ag.seg = 0; ag.s = 0;
      ag.onEnd = (q) => {
        q.free = { tx: to.door.x, tz: to.door.z };
        q.x = this.g.x[to.ped]; q.z = this.g.z[to.ped];
        q.onEnd = (z) => { z.kill = true; this.today.trips++; };
      };
    };
    return a;
  }

  /** Deretan motor parkir di depan warung, toko, dan kantor (khas kota Indonesia). */
  private buildMotorRows() {
    this.motorRows = true;
    const spots = [...this.byKind.food, ...this.byKind.shop, ...this.byKind.office.slice(0, 6)];
    let total = 0;
    for (const pl of spots) {
      if (total >= 60) break;
      if (Math.hypot(pl.door.x - this.g.x[pl.ped], pl.door.z - this.g.z[pl.ped]) < 3.2) continue;
      const count = 3 + Math.floor(this.rnd() * 4);
      const yaw = Math.atan2(pl.out.z, -pl.out.x);
      const tx = -pl.out.z, tz = pl.out.x;
      for (let k = 0; k < count; k++) {
        const along = (k - (count - 1) / 2) * 1.25;
        const x = pl.door.x + pl.out.x * 2.6 + tx * along, z = pl.door.z + pl.out.z * 2.6 + tz * along;
        const a = this.spawn("bike", [pl.ped], { speed: 0 });
        if (!a) return;
        a.parked = true;
        a.free = { tx: x, tz: z };
        a.x = x; a.z = z; a.yaw = yaw;
        a.wait = 1e9;
        a.role = "Parked motorbike";
        a.info = () => `Parked in front of ${pl.name}`;
        total++;
      }
    }
  }

  /** Penumpang turun dari bus dan berjalan ke tempat tujuan terdekat. */
  private walkFrom(x: number, z: number, role: string) {
    if (this.pools.ped.available < 120) return;
    const from = this.nearestPed(x, z);
    const dest = this.pickNear(this.hour() < 12 ? "office" : "home", x, z, 220);
    if (dest) this.pedTrip(from, dest.ped, role, `Walking from the bus stop to ${dest.name}`);
  }

  private standAt(x: number, z: number, yaw: number, role: string, detail: string, seconds: number): Agent | null {
    const n = this.nearestPed(x, z);
    const a = this.spawn("ped", [n], { speed: 0 });
    if (!a) return null;
    a.free = { tx: x, tz: z };
    a.x = x; a.z = z; a.yaw = yaw;
    a.wait = seconds;
    a.role = role;
    a.info = () => detail;
    a.onEnd = (ag) => { ag.kill = true; };
    return a;
  }

  private parkWalker(kind: "jogger" | "stroller") {
    const park = this.parks[Math.floor(this.rnd() * this.parks.length)];
    if (!park) return;
    const cell = () => park.cells[Math.floor(this.rnd() * park.cells.length)];
    const c0 = cell();
    const a = this.spawn("ped", [this.nearestPed(c0.x, c0.z)], { speed: kind === "jogger" ? 3.1 + this.rnd() : 1.0 + this.rnd() * 0.4 });
    if (!a) return;
    a.x = c0.x; a.z = c0.z;
    let legs = kind === "jogger" ? 8 : 4;
    const go = () => { const c = cell(); a.free = { tx: c.x + (this.rnd() - 0.5) * 5, tz: c.z + (this.rnd() - 0.5) * 5 }; };
    go();
    a.ttl = this.t + 140;
    a.role = kind === "jogger" ? "Jogger" : "Park visitor";
    a.info = () => (kind === "jogger" ? "Morning or evening run in the park" : "Taking a walk in the park");
    a.onEnd = (ag) => { if (--legs <= 0) { ag.kill = true; return; } if (kind === "stroller" && this.rnd() < 0.4) ag.wait = 3 + this.rnd() * 6; go(); };
  }

  // --- Kendaraan berperan ------------------------------------------------------------------------------------

  private vehTrip(kind: Kind, from: number, to: number, speed: number, role: string, detail: () => string, onArrive?: (a: Agent) => void): Agent | null {
    const r = this.g.route(from, to, PROFILE[kind]);
    if (!r || r.length < 2) return null;
    const a = this.spawn(kind, r, { speed });
    if (!a) return null;
    a.role = role;
    a.info = detail;
    a.ttl = this.t + 240;
    a.onEnd = (ag) => { if (onArrive) onArrive(ag); else { ag.wait = 0.8; ag.onEnd = (q) => { q.kill = true; }; this.today.trips++; } };
    return a;
  }

  private spawnCommuter(kind: "car" | "bike" | "ojekP") {
    const h = this.hour();
    const home = this.pickPlace("home"), work = this.pickPlace(this.rnd() < 0.85 ? "office" : "civic");
    if (!home || !work) return;
    const toWork = h < 13;
    const [from, to] = toWork ? [home, work] : [work, home];
    const role = kind === "ojekP" ? "Ojek online · passenger ride" : "Commuter";
    this.vehTrip(kind, from.veh, to.veh, kind === "car" ? 9 + this.rnd() * 4 : 10 + this.rnd() * 4, role,
      () => `${toWork ? "Heading to work" : "Going home"}: ${from.name} → ${to.name}`);
  }

  private spawnFoodDelivery() {
    const food = this.pickPlace("food"), home = this.pickPlace(this.rnd() < 0.7 ? "home" : "office");
    if (!food || !home) return;
    let orders = 1 + Math.floor(this.rnd() * 2);
    let cur = { food, home };
    const a = this.vehTrip("ojek", food.veh, home.veh, 10 + this.rnd() * 4, "Ojek online · food delivery", () => `Delivering an order from ${cur.food.name} to ${cur.home.name}`, (ag) => {
      ag.wait = 2.2;
      this.today.deliveries++;
      this.today.sales++;
      this.burst(ag.x, 3, ag.z, 6, [0x1fa34a, 0xffffff], 0.6, 8);
      if (--orders <= 0) { ag.onEnd = (q) => { q.kill = true; }; return; }
      const f2 = this.pickPlace("food"), h2 = this.pickPlace("home");
      const r1 = f2 && this.g.route(ag.path[ag.path.length - 1], f2.veh, "bike");
      const r2 = f2 && h2 && this.g.route(f2.veh, h2.veh, "bike");
      if (!f2 || !h2 || !r1 || !r2) { ag.onEnd = (q) => { q.kill = true; }; return; }
      cur = { food: f2, home: h2 };
      ag.path = [...r1, ...r2.slice(1)]; ag.seg = 0; ag.s = 0;
    });
    void a;
  }

  private spawnRestock() {
    const shop = this.pickPlace(this.rnd() < 0.5 ? "shop" : "food");
    if (!shop) return;
    const edge = this.pickEdge();
    this.vehTrip("box", edge, shop.veh, 8 + this.rnd() * 2, "Delivery van · restocking", () => `Bringing stock to ${shop.name}`, (ag) => {
      ag.wait = 4;
      this.burst(ag.x, 2.5, ag.z, 5, [0xc99a5b, 0xffffff], 0.5, 6);
      const back = this.g.route(shop.veh, this.pickEdge(), "veh");
      ag.info = () => `Restocked ${shop.name}, heading back to the warehouse`;
      if (back && back.length > 1) { ag.path = back; ag.seg = 0; ag.s = 0; ag.onEnd = (q) => { q.kill = true; this.today.trips++; }; } else ag.onEnd = (q) => { q.kill = true; };
    });
  }

  private spawnGarbage() {
    let stops = 6;
    const next = (ag: Agent) => {
      const home = this.pickPlace("home");
      const r = home && this.g.route(ag.path[ag.path.length - 1], home.veh, "veh");
      if (!r || r.length < 2 || --stops <= 0) { ag.kill = true; return; }
      ag.path = r; ag.seg = 0; ag.s = 0;
    };
    const home = this.pickPlace("home");
    if (!home) return;
    const a = this.vehTrip("box", this.pickEdge(), home.veh, 6.5, "Garbage truck · dawn round", () => `Collecting rubbish, ${stops} stops left`, (ag) => { ag.wait = 2.5; ag.onEnd = (q) => next(q); });
    if (a) this.pools.box.color(a.slot, new THREE.Color("#2f8a4f"));
  }

  private spawnMixer() {
    const site = this.sites[Math.floor(this.rnd() * this.sites.length)];
    if (!site) return;
    this.vehTrip("mixer", this.pickEdge(), site.node, 7.5, "Concrete mixer", () => "Bringing concrete to the construction site", (ag) => {
      ag.wait = 7;
      ag.info = () => "Pouring concrete at the site";
      const back = this.g.route(site.node, this.pickEdge(), "veh");
      if (back && back.length > 1) { ag.path = back; ag.seg = 0; ag.s = 0; ag.onEnd = (q) => { q.kill = true; }; } else ag.onEnd = (q) => { q.kill = true; };
    });
  }

  private spawnAngkot() {
    const start = this.g.randomMain("veh", this.rnd);
    const e = this.g.adj[start].filter((q) => this.g.ok(q, "veh") && this.g.inMain(q.to, "veh"));
    if (!e.length) return;
    const a = this.spawn("angkot", [start, e[Math.floor(this.rnd() * e.length)].to], { speed: 8 + this.rnd() * 3 });
    if (!a) return;
    a.ambient = true;
    a.riders = Math.floor(this.rnd() * 8);
    const code = `M${String(1 + Math.floor(this.rnd() * 40)).padStart(2, "0")}`;
    a.role = `Angkot ${code}`;
    a.info = () => `Shared minibus · ${a.riders ?? 0} passengers · stops anywhere a passenger waves`;
    a.onNode = (ag, node) => {
      if (this.signals.has(node) || this.rnd() > 0.22) return;
      ag.wait = 1.6;
      const off = Math.min(ag.riders ?? 0, Math.floor(this.rnd() * 3));
      const on = Math.floor(this.rnd() * 3);
      ag.riders = Math.min(12, (ag.riders ?? 0) - off + on);
      this.today.busRiders += on;
      for (let k = 0; k < off; k++) this.after(0.3 + k * 0.5, () => this.walkFrom(ag.x, ag.z, "Angkot passenger"));
    };
  }

  private spawnVendor() {
    const start = this.g.randomMain("ped", this.rnd);
    const e = this.g.adj[start].filter((q) => this.g.ok(q, "ped") && this.g.inMain(q.to, "ped"));
    if (!e.length) return;
    const a = this.spawn("cart", [start, e[Math.floor(this.rnd() * e.length)].to], { speed: 0.8 + this.rnd() * 0.3 });
    if (!a) return;
    a.ambient = true;
    const item = VENDOR_ITEMS[Math.floor(this.rnd() * VENDOR_ITEMS.length)];
    let sold = 0;
    a.role = `Street vendor · ${item}`;
    a.info = () => `Pushing a ${item.toLowerCase()} cart through the neighbourhood · ${sold} sold today`;
    a.onNode = (ag) => {
      if (this.clock && !this.clock.vendors(this.hour())) { ag.kill = true; return; }
      if (this.rnd() > 0.2) return;
      const secs = 4 + this.rnd() * 5;
      ag.wait = secs;
      const n = 1 + Math.floor(this.rnd() * 2);
      for (let k = 0; k < n; k++) {
        const ang = ag.yaw + (k ? 0.9 : -0.9);
        this.standAt(ag.x + Math.cos(ang) * 3.2, ag.z - Math.sin(ang) * 3.2, ag.yaw + Math.PI, "Customer", `Buying ${item.toLowerCase()}`, secs);
      }
      sold += n;
      this.today.sales += n;
    };
  }

  // --- Pasar malam --------------------------------------------------------------------------------------------

  private buildMarket() {
    const plaza = this.depotOf("idle");
    if (!plaza || !this.parks.length) return;
    const near = [...this.parks].sort((p, q) => Math.hypot(p.x - plaza.x, p.z - plaza.z) - Math.hypot(q.x - plaza.x, q.z - plaza.z));
    const park = near[1] ?? near[0];
    const cells = [...park.cells].sort((p, q) => Math.hypot(p.x - park.x, p.z - park.z) - Math.hypot(q.x - park.x, q.z - park.z)).slice(0, 10);
    const roofs = [0xe8553d, 0xf6c445, 0x2f9fd8, 0x52c79b, 0xec4899, 0x7a5cff];
    const parts: THREE.BufferGeometry[] = [];
    const bulbs: number[] = [], bulbCol: number[] = [];
    const c = new THREE.Color();
    cells.forEach((cl, i) => {
      const x = cl.x, z = cl.z, roof = roofs[i % roofs.length];
      parts.push(
        part(box(3.6, 0.9, 1.4), 0xb07a4a, x, 0.45, z - 0.6),
        part(box(3.4, 0.25, 1.2), 0xf6efe0, x, 0.95, z - 0.6),
        part(box(0.7, 0.45, 0.7), roofs[(i + 2) % roofs.length], x - 0.9, 1.3, z - 0.6),
        part(box(0.6, 0.35, 0.6), 0xffd166, x + 0.8, 1.25, z - 0.6),
        ...[[-1.8, -1.4], [1.8, -1.4], [-1.8, 1.0], [1.8, 1.0]].map(([dx, dz]) => part(box(0.14, 3.0, 0.14), 0xdfe4f5, x + dx, 1.5, z + dz)),
        part(box(4.2, 0.2, 1.6).rotateX(0.35), roof, x, 3.25, z - 0.75),
        part(box(4.2, 0.2, 1.6).rotateX(-0.35), roof, x, 3.25, z + 0.55),
        part(box(3.0, 0.35, 0.7), 0x8d6a4a, x, 0.35, z + 1.6),
      );
      for (let k = 0; k < 7; k++) {
        bulbs.push(x - 2.1 + k * 0.7, 3.0 + Math.sin(k) * 0.12, z + 1.25);
        c.setHex([0xffd45e, 0xff8fab, 0x7af0c3, 0xffffff][k % 4]);
        bulbCol.push(c.r, c.g, c.b);
      }
    });
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(merge(parts), new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }));
    mesh.castShadow = true;
    group.add(mesh);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(bulbs, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(bulbCol, 3));
    const lights = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, opacity: 0, depthWrite: false }));
    group.add(lights);
    group.visible = false;
    this.group.add(group);
    this.market = { group, spots: cells.map((q) => ({ x: q.x, z: q.z + 2.6 })), lights, open: 0 };
  }

  private marketVisitor() {
    const m = this.market;
    if (!m) return;
    const spot = () => m.spots[Math.floor(this.rnd() * m.spots.length)];
    const s0 = spot();
    const a = this.spawn("ped", [this.nearestPed(s0.x, s0.z)], { speed: 1.0 + this.rnd() * 0.4 });
    if (!a) return;
    a.x = s0.x + (this.rnd() - 0.5) * 10; a.z = s0.z + (this.rnd() - 0.5) * 8;
    let stops = 2 + Math.floor(this.rnd() * 4);
    const go = () => { const s = spot(); a.free = { tx: s.x + (this.rnd() - 0.5) * 2.5, tz: s.z + this.rnd() * 1.5 }; };
    go();
    a.ttl = this.t + 110;
    a.role = "Night market visitor";
    a.info = () => `Browsing the night market stalls · ${stops} more to visit`;
    a.onEnd = (ag) => { if (--stops <= 0 || m.open < 0.3) { ag.kill = true; return; } ag.wait = 2 + this.rnd() * 4; this.today.sales++; go(); };
  }

  // --- Penentu jumlah per peran -------------------------------------------------------------------------------

  private routines() {
    const ck = this.clock;
    const h = this.hour();
    if (h < this.lastHour - 12) this.today = { trips: 0, deliveries: 0, busRiders: 0, sales: 0 };
    this.lastHour = h;
    const grow = Math.min(1, this.dev * 1.4);
    const k = this.activity * grow;
    if (k <= 0.01) return;
    const count = new Map<string, number>();
    for (const a of this.agents) if (!a.kill) count.set(a.role, (count.get(a.role) ?? 0) + 1);
    const n = (prefix: string) => { let s = 0; for (const [r, c] of count) if (r.startsWith(prefix)) s += c; return s; };
    const cars = Math.max(10, Math.min(56, Math.round(this.g.streetLength / 450)));
    const want = (live: number, target: number, spawn: () => void) => { if (live < Math.round(target)) spawn(); };
    const C = ck ?? null;
    const traffic = C ? C.traffic(h) : 0.6, commute = C ? C.commute(h) : 0.4, delivery = C ? C.delivery(h) : 0.4;
    want(n("Commuter"), cars * 0.55 * commute * k, () => this.spawnCommuter(this.rnd() < 0.6 ? "car" : "bike"));
    want(n("Ojek online · passenger"), (3 + 7 * commute) * k, () => this.spawnCommuter("ojekP"));
    want(n("Ojek online · food"), 12 * delivery * k, () => this.spawnFoodDelivery());
    if (!C || C.busService(h)) {
      want(n("City bus"), this.bus ? Math.max(2, Math.round(this.bus.path.length / 18)) * (grow > 0.12 ? 1 : 0) : 0, () => this.spawnBus());
      want(n("Angkot"), Math.min(10, this.g.streetLength / 1600) * k, () => this.spawnAngkot());
    }
    if (!C || C.restock(h)) want(n("Delivery van"), 4 * k, () => this.spawnRestock());
    if (C && C.garbage(h)) want(n("Garbage truck"), grow > 0.2 ? 1 : 0, () => this.spawnGarbage());
    if ((!C || C.construction(h)) && this.sites.length) want(n("Concrete mixer"), Math.min(3, this.sites.length), () => this.spawnMixer());
    if (!C || C.vendors(h)) want(n("Street vendor"), 9 * k, () => this.spawnVendor());
    // Pejalan kaki dengan tujuan sesuai jam: kantor pagi, makan siang, belanja sore, pulang malam.
    const walkers = C ? C.walkers(h) : 0.6;
    if (n("Pedestrian") < Math.round(70 * walkers * k)) {
      const r = this.rnd();
      const [fromK, toK, label] = h < 10 ? (r < 0.75 ? ["home", "office", "Office worker"] : ["home", "civic", "Student"])
        : h < 14 ? (r < 0.7 ? ["office", "food", "Lunch break"] : ["home", "shop", "Shopper"])
        : h < 17.5 ? (r < 0.6 ? ["home", "shop", "Shopper"] : ["home", "food", "Snack run"])
        : h < 22 ? (r < 0.6 ? ["office", "home", "Going home"] : ["home", "food", "Dinner out"]) : ["food", "home", "Going home"];
      const from = this.pickPlace(fromK as keyof CityLife["byKind"]);
      const to = from && this.pickNear(toK as keyof CityLife["byKind"], from.x, from.z, 260);
      if (from && to && from !== to) this.journey(from, to, `Pedestrian · ${label}`, `${label}: ${from.name} → ${to.name}`);
    }
    if (this.parks.length) {
      const park = C ? C.parkLife(h) : 0.3;
      want(n("Jogger"), 10 * park * k, () => this.parkWalker("jogger"));
      want(n("Park visitor"), (4 + 8 * park) * k, () => this.parkWalker("stroller"));
    }
    // Orang menunggu di halte.
    if (this.bus && (!C || C.busService(h))) {
      for (const sh of this.bus.shelters) {
        sh.waiting = sh.waiting.filter((q) => !q.kill);
        if (sh.waiting.length < 4 && this.rnd() < 0.06 + 0.3 * commute) {
          const w = this.standAt(sh.x + (this.rnd() - 0.5) * 4, sh.z + (this.rnd() - 0.5) * 1.2, this.rnd() * 6.28, "Waiting for the bus", `Waiting at ${sh.name}`, 9999);
          if (w) sh.waiting.push(w);
        }
      }
    } else if (this.bus) for (const sh of this.bus.shelters) { for (const w of sh.waiting) w.kill = true; sh.waiting = []; }
    if (!this.motorRows && this.dev > 0.35) this.buildMotorRows();
    // Pasar malam.
    if (!this.market && grow > 0.15) this.buildMarket();
    if (this.market && this.market.open > 0.5) want(n("Night market"), 26 * k * this.market.open, () => this.marketVisitor());
    void traffic;
  }

  private updateMarket(dt: number) {
    const m = this.market;
    if (!m) return;
    const target = (this.clock ? this.clock.nightMarket(this.hour()) : 0) * (this.dev > 0.15 ? 1 : 0);
    m.open += (target - m.open) * Math.min(1, dt * 1.5);
    m.group.visible = m.open > 0.01;
    m.group.scale.set(1, Math.max(0.001, m.open), 1);
    (m.lights.material as THREE.PointsMaterial).opacity = Math.min(1, this.night * 1.4) * m.open;
  }

  /** Lampu depan dan belakang kendaraan saat malam. */
  private updateVehicleLights() {
    if (this.night < 0.08) { this.heads.count = 0; this.tails.count = 0; return; }
    let i = 0;
    const s = 0.4 + this.night * 0.6;
    for (const a of this.agents) {
      if (!isVehicle(a.kind) || a.parked || a.kill || i >= 400) continue;
      const sc = KIND_SCALE[a.kind], half = (KIND_LEN[a.kind] / 2) * sc;
      const cs = Math.cos(a.yaw), sn = Math.sin(a.yaw);
      this.dummy.rotation.set(0, a.yaw, 0);
      this.dummy.scale.set(s, s, s * (a.kind === "bike" || a.kind.startsWith("ojek") ? 0.4 : 1));
      this.dummy.position.set(a.x + cs * half, 0.85 * sc, a.z - sn * half);
      this.dummy.updateMatrix();
      this.heads.setMatrixAt(i, this.dummy.matrix);
      this.dummy.position.set(a.x - cs * half, 0.9 * sc, a.z + sn * half);
      this.dummy.updateMatrix();
      this.tails.setMatrixAt(i, this.dummy.matrix);
      i++;
    }
    this.heads.count = this.tails.count = i;
    this.heads.instanceMatrix.needsUpdate = true;
    this.tails.instanceMatrix.needsUpdate = true;
  }

  // --- Info saat diklik dan ringkasan -------------------------------------------------------------------------

  /** Mencari kendaraan atau orang di bawah sinar klik. Mengembalikan isinya untuk panel info, dan menandainya. */
  pickAgent(ray: THREE.Raycaster): Inspect | null {
    let best: { a: Agent; d: number } | null = null;
    for (const kind of Object.keys(this.pools) as Kind[]) {
      const pool = this.pools[kind];
      for (const mesh of [pool.tint, pool.fixed]) {
        for (const hit of ray.intersectObject(mesh, false)) {
          if (hit.instanceId === undefined) continue;
          const a = this.agents.find((q) => q.kind === kind && q.slot === hit.instanceId && !q.kill);
          if (a && (!best || hit.distance < best.d)) best = { a, d: hit.distance };
          break;
        }
      }
    }
    this.selected = best?.a ?? null;
    return best ? this.describe(best.a) : null;
  }

  inspect(): Inspect | null { return this.selected && !this.selected.kill ? this.describe(this.selected) : null; }
  clearSelection() { this.selected = null; }

  private describe(a: Agent): Inspect {
    const detail = a.info?.() ?? (a.parked ? "Parked by the kerb" : a.kind === "ped" ? "Out for a walk" : a.kind === "flat" ? "Carrying city funds between districts" : "Driving around town");
    const tone: Tone = a.kind === "flat" ? "blue" : a.kind === "satpam" ? "red" : a.role.startsWith("Ojek") ? "green" : a.kind === "bus" || a.kind === "angkot" ? "violet" : a.kind === "cart" ? "amber" : "blue";
    return { title: a.parked ? (a.kind === "bike" ? "Parked motorbike" : "Parked car") : a.role, detail, tone };
  }

  stats(): CityStats {
    let vehicles = 0, people = 0, buses = 0, riders = 0, vendors = 0;
    for (const a of this.agents) {
      if (a.kill) continue;
      if (isVehicle(a.kind) && !a.parked) vehicles++;
      if (a.kind === "ped") people++;
      if (a.kind === "bus") buses++;
      if (a.kind === "cart") vendors++;
      riders += a.riders ?? 0;
    }
    return {
      vehicles, people, buses, riders, vendors,
      stallsOpen: this.market && this.market.open > 0.5 ? this.market.spots.length : 0,
      tripsToday: this.today.trips, deliveriesToday: this.today.deliveries, busRidersToday: this.today.busRiders, salesToday: this.today.sales,
    };
  }

  // -------------------------------------------------------------------------------------------------------------
  // Agen: spawn, gerak, tampil
  // -------------------------------------------------------------------------------------------------------------

  private spawn(kind: Kind, path: number[], o: { speed: number; tag?: Agent["tag"]; ambient?: boolean }): Agent | null {
    const pool = this.pools[kind];
    const slot = pool.acquire();
    if (slot < 0) return null;
    const a: Agent = {
      kind, slot, path, seg: 0, s: 0, speed: o.speed, side: kind === "ped" && this.rnd() < 0.5 ? -1 : 1, yaw: 0,
      x: this.g.x[path[0]], z: this.g.z[path[0]], ph: this.rnd() * 6.28, ambient: !!o.ambient, kill: false, wait: 0, phase: "", tag: o.tag,
      id: this.nextId++, role: kind === "ped" ? "Resident" : kind === "satpam" ? "Satpam guard" : kind === "flat" ? "Fund convoy" : "Driver",
    };
    const pick = (list: string[]) => new THREE.Color(list[Math.floor(this.rnd() * list.length)]);
    const c = kind === "ped" ? PED_TINTS[Math.floor(this.rnd() * PED_TINTS.length)]
      : kind === "flat" ? new THREE.Color("#3f6bff")
      : kind === "box" ? pick(["#3f6bff", "#f59e0b", "#10b3a3"])
      : kind === "bus" ? pick(["#2f6fe0", "#2f6fe0", "#e8553d"])
      : kind === "angkot" ? pick(["#19b0a0", "#e2483b", "#2e78d6", "#f59e0b", "#7a5cff"])
      : kind === "ojek" || kind === "ojekP" ? pick(["#1fa34a", "#1fa34a", "#00a6a6", "#2e78d6"])
      : kind === "cart" ? pick(["#e8553d", "#f6c445", "#2f9fd8", "#52c79b", "#ec4899"])
      : kind === "mixer" ? new THREE.Color("#f59e0b")
      : kind === "satpam" ? new THREE.Color("#ffffff") : CAR_TINTS[Math.floor(this.rnd() * CAR_TINTS.length)];
    pool.color(slot, c);
    if (kind === "ped") pool.accentColor(slot, SKIN_TINTS[Math.floor(this.rnd() * SKIN_TINTS.length)]);
    if (path.length > 1) a.yaw = Math.atan2(-(this.g.z[path[1]] - this.g.z[path[0]]), this.g.x[path[1]] - this.g.x[path[0]]);
    if (o.tag) a.pin = this.takePin(TONE_HEX[o.tag.tone]);
    this.agents.push(a);
    return a;
  }

  private lane(a: Agent, e: Edge): number {
    if (a.parked) return a.side * Math.max(0.5, e.w / 2 - 1.4);
    if (a.kind === "ped" || a.kind === "cart") return a.side * (e.foot ? 0.7 : e.w * 0.5 + 0.9);
    if (a.kind === "bike" || a.kind === "ojek" || a.kind === "ojekP") return Math.min(1.6, e.w * 0.22);
    return Math.min(2.4, e.w * 0.25);
  }

  /** Bila jalur habis: agen ambien memilih ruas berikutnya; agen terjadwal memanggil `onEnd`. */
  private arrived(a: Agent) {
    if (a.onEnd) { a.onEnd(a); return; }
    if (a.kill) return;
    const last = a.path[a.path.length - 1];
    const prev = a.path.length > 1 ? a.path[a.path.length - 2] : -1;
    const prof = PROFILE[a.kind];
    const opts = this.g.adj[last].filter((e) => this.g.ok(e, prof) && this.g.inMain(e.to, prof));
    const fwd = opts.filter((e) => e.to !== prev);
    const pick = (fwd.length ? fwd : opts)[Math.floor(this.rnd() * (fwd.length ? fwd.length : opts.length))];
    if (!pick) { a.kill = true; return; }
    a.path = [last, pick.to];
    a.seg = 0;
    a.s = 0;
  }

  private step(a: Agent, dt: number) {
    if (a.wait > 0) { a.wait -= dt; if (a.wait > 0) return; }
    if (a.free) {
      const dx = a.free.tx - a.x, dz = a.free.tz - a.z, d = Math.hypot(dx, dz), mv = a.speed * dt;
      if (d <= mv || a.speed === 0) { a.x = a.free.tx; a.z = a.free.tz; if (a.speed > 0 || a.wait <= 0) this.arrived(a); }
      else { a.x += (dx / d) * mv; a.z += (dz / d) * mv; }
      return;
    }
    let move = a.speed * dt;
    let guard = 0;
    const veh = isVehicle(a.kind) && !a.parked;
    while (move > 0 && guard++ < 6) {
      const from = a.path[a.seg], to = a.path[a.seg + 1];
      if (to === undefined) { this.arrived(a); if (a.wait > 0 || a.kill || a.path[a.seg + 1] === undefined) break; continue; }
      const e = this.g.edge(from, to);
      if (!e) { a.kill = true; break; }
      let limit = e.len;
      if (veh) {
        // Lampu merah: berhenti di garis henti sebelum persimpangan.
        const sig = this.signals.get(to);
        if (sig && e.len - a.s > sig.stop - 0.5 && this.signalState(sig, from, to) !== "g") limit = Math.max(a.s, e.len - sig.stop);
        // Antre di belakang kendaraan di depan pada ruas yang sama.
        const lead = this.leaderOf(a, from, to);
        if (lead) limit = Math.min(limit, Math.max(a.s, lead.s - (KIND_LEN[lead.kind] * KIND_SCALE[lead.kind] + KIND_LEN[a.kind] * KIND_SCALE[a.kind]) / 2 - 2.2));
      }
      const remain = limit - a.s;
      if (limit < e.len) { a.s += Math.min(move, Math.max(0, remain)); break; }
      if (move < remain) { a.s += move; move = 0; }
      else {
        move -= remain; a.s = 0; a.seg++;
        if (a.onNode && a.path[a.seg + 1] !== undefined) { a.onNode(a, a.path[a.seg]); if (a.wait > 0 || a.kill) break; }
      }
    }
  }

  private leaderOf(a: Agent, from: number, to: number): Agent | undefined {
    const list = this.leaders.get(from * 100000 + to);
    if (!list) return undefined;
    let best: Agent | undefined;
    for (const q of list) if (q !== a && q.s > a.s && (!best || q.s < best.s)) best = q;
    return best;
  }

  private place(a: Agent, dt: number) {
    if (a.free) { this.placeAt(a, dt, a.free.tx - a.x, a.free.tz - a.z); return; }
    const idx = Math.min(a.seg, a.path.length - 2);
    const from = a.path[Math.max(0, idx)], to = a.path[Math.max(0, idx) + 1];
    let dx = 1, dz = 0, ox = 0, oz = 0;
    let px = this.g.x[from], pz = this.g.z[from];
    if (to !== undefined) {
      const e = this.g.edge(from, to);
      if (e) {
        dx = (this.g.x[to] - px) / e.len; dz = (this.g.z[to] - pz) / e.len;
        const f = a.seg > idx ? e.len : a.s;
        px += dx * f; pz += dz * f;
        const lane = this.lane(a, e);
        ox = dz * lane; oz = -dx * lane;
      }
    }
    a.x = px + ox; a.z = pz + oz;
    this.placeAt(a, dt, dx, dz);
  }

  /** Menulis matriks agen dari posisi `a.x, a.z` dan arah `(dx, dz)`. */
  private placeAt(a: Agent, dt: number, dx: number, dz: number) {
    const target = Math.abs(dx) + Math.abs(dz) > 1e-6 ? Math.atan2(-dz, dx) : a.yaw;
    let diff = target - a.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    a.yaw += diff * Math.min(1, dt * (a.kind === "ped" ? 9 : 6));
    const moving = a.wait <= 0 && a.speed > 0;
    const bob = a.kind === "ped" && moving ? Math.abs(Math.sin((a.ph += dt * a.speed * 3.2))) * 0.18 : a.kind === "cart" && moving ? Math.abs(Math.sin((a.ph += dt * 4))) * 0.08 : 0;
    const scale = KIND_SCALE[a.kind] ?? (a.kind === "ped" ? S_PED : S_VEH);
    this.dummy.position.set(a.x, bob, a.z);
    this.dummy.rotation.set(0, a.yaw, 0);
    this.dummy.scale.setScalar(scale);
    this.dummy.updateMatrix();
    this.pools[a.kind].set(a.slot, this.dummy.matrix);
    if (a.kind === "ped") this.pools.ped.walk(a.slot, a.ph, moving ? 1 : 0);
    if (a.kind === "satpam") {
      this.off.makeTranslation(0.2, 1.95, 0);
      this.tmpM.multiplyMatrices(this.dummy.matrix, this.off);
      this.beacons.setMatrixAt(a.slot, this.tmpM);
      this.beaconColor.setHex(Math.floor(this.t * 4) % 2 ? 0xff2d2d : 0x2d6bff);
      this.beacons.setColorAt(a.slot, this.beaconColor);
    }
    if (a.pin) { a.pin.position.set(a.x, 13 + Math.sin(this.t * 2.4 + a.ph) * 1.1, a.z); a.pin.visible = true; }
  }

  private release(a: Agent) {
    this.pools[a.kind].release(a.slot);
    if (a.kind === "ped") this.pools.ped.walk(a.slot, 0, 0);
    if (a.kind === "satpam") this.beacons.setMatrixAt(a.slot, new THREE.Matrix4().makeScale(0, 0, 0));
    if (a.pin) this.freePin(a.pin);
    if (this.selected === a) this.selected = null;
  }

  // --- Pin, cincin, partikel -------------------------------------------------------------------------------------

  private makePin(): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      merge([new THREE.ConeGeometry(1.5, 4.2, 14).rotateX(Math.PI).translate(0, 2.1, 0), new THREE.SphereGeometry(1.9, 16, 12).translate(0, 5.4, 0)].map((q) => { q.deleteAttribute("uv"); return q; })),
      new THREE.MeshStandardMaterial({ color: 0x3f6bff, roughness: 0.4, emissive: 0x3f6bff, emissiveIntensity: 0.35 }),
    );
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dot.position.set(0, 5.4, 0);
    g.add(body, dot);
    g.scale.setScalar(2.2);
    g.visible = false;
    this.group.add(g);
    return g;
  }

  private takePin(color: number): THREE.Object3D {
    const slot = this.pinPool.find((p) => !p.used) ?? this.pinPool[0];
    slot.used = true;
    const body = slot.mesh.children[0] as THREE.Mesh;
    (body.material as THREE.MeshStandardMaterial).color.setHex(color);
    (body.material as THREE.MeshStandardMaterial).emissive.setHex(color);
    slot.mesh.visible = true;
    return slot.mesh;
  }

  private freePin(p: THREE.Object3D) {
    const s = this.pinPool.find((q) => q.mesh === p);
    if (s) s.used = false;
    p.visible = false;
  }

  private ring(x: number, z: number, color: number, r0: number, r1: number, life: number) {
    const r = this.rings.find((q) => !q.live) ?? this.rings[0];
    r.live = true; r.age = 0; r.life = life; r.r0 = r0; r.r1 = r1;
    r.mesh.position.set(x, 0.3, z);
    (r.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    r.mesh.visible = true;
  }

  private burst(x: number, y: number, z: number, count: number, colors: number[], speed: number, up: number) {
    const p = this.particles;
    const cap = p.life.length;
    const c = new THREE.Color();
    for (let k = 0; k < count; k++) {
      const i = p.next++ % cap;
      const ang = this.rnd() * 6.283, sp = (0.4 + this.rnd()) * speed * 4;
      p.pos[i * 3] = x + (this.rnd() - 0.5) * 6; p.pos[i * 3 + 1] = y + this.rnd() * 3; p.pos[i * 3 + 2] = z + (this.rnd() - 0.5) * 6;
      p.vel[i * 3] = Math.cos(ang) * sp; p.vel[i * 3 + 1] = up * (0.5 + this.rnd() * 0.8); p.vel[i * 3 + 2] = Math.sin(ang) * sp;
      c.setHex(colors[Math.floor(this.rnd() * colors.length)]);
      p.col[i * 3] = c.r; p.col[i * 3 + 1] = c.g; p.col[i * 3 + 2] = c.b;
      p.life[i] = p.max[i] = 1.6 + this.rnd() * 1.4;
    }
  }

  private updateParticles(dt: number) {
    const p = this.particles;
    for (let i = 0; i < p.life.length; i++) {
      if (p.life[i] <= 0) { p.pos[i * 3 + 1] = -9999; continue; }
      p.life[i] -= dt;
      p.vel[i * 3 + 1] -= 24 * dt;
      p.pos[i * 3] += p.vel[i * 3] * dt; p.pos[i * 3 + 1] += p.vel[i * 3 + 1] * dt; p.pos[i * 3 + 2] += p.vel[i * 3 + 2] * dt;
      if (p.pos[i * 3 + 1] < 0.3) { p.pos[i * 3 + 1] = 0.3; p.vel[i * 3 + 1] *= -0.25; p.vel[i * 3] *= 0.7; p.vel[i * 3 + 2] *= 0.7; }
    }
    (p.mesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (p.mesh.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  // -------------------------------------------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------------------------------------------

  update(dt: number, camera: THREE.Camera, rect: { w: number; h: number }) {
    if (!this.ok) return;
    this.t += dt;

    // Jadwal tunda.
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.timers[i].at <= this.t) { const fn = this.timers[i].fn; this.timers.splice(i, 1); fn(); }
    }

    // Menjaga jumlah lalu lintas ambien dan mobil parkir.
    this.spawnCool -= dt;
    if (this.spawnCool <= 0) {
      this.spawnCool = 0.12;
      const parked = this.agents.filter((q) => q.parked && q.kind === "car" && !q.kill).length;
      if (parked < this.ambientTarget.parked) this.spawnParked();
      else if (parked > this.ambientTarget.parked) { const q = this.agents.find((x) => x.parked && x.kind === "car" && !x.kill); if (q) q.kill = true; }
      // Lalu lintas tanpa tujuan khusus (urusan kecil) mengikuti pola jam; sisanya diatur per peran di `routines`.
      const traffic = this.clock ? this.clock.traffic(this.hour()) : 1;
      for (const kind of ["car", "bike", "box", "ped"] as const) {
        const live = this.agents.filter((q) => q.ambient && !q.parked && q.kind === kind && !q.kill).length;
        const target = Math.round(this.ambientTarget[kind] * (kind === "ped" ? 0.45 : kind === "box" ? 0.4 : 0.55) * traffic);
        if (live < target) this.spawnAmbient(kind);
        else if (live > target) { const q = this.agents.find((x) => x.ambient && !x.parked && x.kind === kind && !x.kill); if (q) q.kill = true; }
      }
    }
    this.routineCool -= dt;
    if (this.routineCool <= 0) { this.routineCool = 0.25; this.routines(); }
    this.sigCool -= dt;
    if (this.sigCool <= 0) { this.sigCool = 0.2; this.paintSignals(); }
    this.updateMarket(dt);

    // Acara: cincin, percikan, sinar, kedaluwarsa.
    for (const [key, ev] of this.events) {
      const left = ev.until - this.t;
      const k = Math.max(0, Math.min(1, this.t - ev.start, left / 1.2));
      (ev.beam.material as THREE.MeshBasicMaterial).opacity = (ev.type === "alert" || ev.type === "festival" ? 0.2 : 0.1) * k;
      if (ev.type !== "note" && left > 0 && this.t >= ev.nextPulse) {
        ev.nextPulse = this.t + (ev.type === "alert" ? 0.9 : 1.7);
        this.ring(ev.x, ev.z, ev.color, 4, ev.type === "alert" ? 40 : 34, ev.type === "alert" ? 1.1 : 2.2);
      }
      if (ev.type === "festival" && left > 0 && this.t >= ev.nextSpark) {
        ev.nextSpark = this.t + 0.16;
        this.burst(ev.x + (this.rnd() - 0.5) * 30, 16, ev.z + (this.rnd() - 0.5) * 30, 4, [ev.color, 0xffffff, 0xf5b301, 0xec4899], 0.8, 14);
      }
      if (left <= 0) {
        ev.beam.parent?.remove(ev.beam);
        ev.beam.geometry.dispose();
        (ev.beam.material as THREE.Material).dispose();
        this.freePin(ev.pin);
        this.events.delete(key);
        if (ev.type === "festival") this.disperse(ev.id);
      } else {
        ev.pin.position.set(ev.x, 22 + Math.sin(this.t * 2.2) * 1.4, ev.z);
      }
    }
    for (const r of this.rings) {
      if (!r.live) continue;
      r.age += dt;
      const k = r.age / r.life;
      if (k >= 1) { r.live = false; r.mesh.visible = false; continue; }
      const rad = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - k, 2));
      r.mesh.scale.set(rad, rad, rad);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.65 * (1 - k);
    }

    // Percikan hasil di atap distrik pemberi hasil.
    for (const dep of this.depots.values()) {
      if (dep.kind === "idle" || !dep.roofs.length || this.rnd() > dt * 2.2 * Math.min(1, dep.weight * 2.5)) continue;
      const r = dep.roofs[Math.floor(this.rnd() * dep.roofs.length)];
      this.burst(r.x, r.h, r.z, 3, [0xf5b301, 0xffd45e], 0.2, 12);
    }

    // Tumpukan peti di depot menyesuaikan alokasi.
    for (const dep of this.depots.values()) this.updatePiles(dep, dt);

    // Agen. Daftar kendaraan per ruas dipakai untuk antre di belakang kendaraan lain.
    this.leaders.clear();
    for (const a of this.agents) {
      if (a.kill || a.parked || a.free || !isVehicle(a.kind)) continue;
      const to = a.path[a.seg + 1];
      if (to === undefined) continue;
      const key = a.path[a.seg] * 100000 + to;
      const list = this.leaders.get(key);
      if (list) list.push(a); else this.leaders.set(key, [a]);
    }
    for (let i = this.agents.length - 1; i >= 0; i--) {
      const a = this.agents[i];
      if (a.ttl !== undefined && this.t > a.ttl && !a.tag) a.kill = true;
      if (a.kill) { this.release(a); this.agents[i] = this.agents[this.agents.length - 1]; this.agents.pop(); continue; }
      this.step(a, dt);
      if (a.kill) continue;
      this.place(a, dt);
    }
    this.updateVehicleLights();
    for (const k of Object.keys(this.pools) as Kind[]) this.pools[k].flush();
    this.piles.flush();
    this.beacons.instanceMatrix.needsUpdate = true;
    if (this.beacons.instanceColor) this.beacons.instanceColor.needsUpdate = true;
    this.updateParticles(dt);
    this.project(camera, rect);
  }

  private spawnAmbient(kind: "car" | "bike" | "box" | "ped") {
    const prof = PROFILE[kind];
    const start = this.g.randomMain(prof, this.rnd);
    const e = this.g.adj[start].filter((q) => this.g.ok(q, prof) && this.g.inMain(q.to, prof));
    if (!e.length) return;
    const next = e[Math.floor(this.rnd() * e.length)].to;
    const speed = kind === "car" ? 8 + this.rnd() * 5 : kind === "bike" ? 9 + this.rnd() * 5 : kind === "box" ? 7 + this.rnd() * 3 : 1.2 + this.rnd() * 1.1;
    const a = this.spawn(kind, [start, next], { speed, ambient: true });
    if (!a) return;
    a.role = kind === "car" ? "Car" : kind === "bike" ? "Motorbike" : kind === "box" ? "Box truck" : "Resident";
    a.info = () => (kind === "ped" ? "Strolling around the neighbourhood" : kind === "box" ? "Making deliveries across town" : "Running errands around town");
  }

  /** Mobil yang diparkir di tepi jalan lebar, diam di tempat. */
  private spawnParked() {
    const start = this.g.randomMain("veh", this.rnd);
    const opts = this.g.adj[start].filter((q) => this.g.ok(q, "veh") && q.w >= 6 && q.len >= 14 && this.g.inMain(q.to, "veh"));
    if (!opts.length) return;
    const e = opts[Math.floor(this.rnd() * opts.length)];
    const a = this.spawn("car", [start, e.to], { speed: 0 });
    if (!a) return;
    a.parked = true;
    a.ambient = false;
    a.side = this.rnd() < 0.5 ? -1 : 1;
    a.s = 4 + this.rnd() * (e.len - 8);
    a.yaw = Math.atan2(-(this.g.z[e.to] - this.g.z[start]), this.g.x[e.to] - this.g.x[start]);
  }

  private updatePiles(dep: Depot, dt: number) {
    const target = dep.pile;
    if (dep.shown < target) dep.shown = Math.min(target, dep.shown + dt * 3);
    else if (dep.shown > target) dep.shown = Math.max(target, dep.shown - dt * 3);
    const need = Math.ceil(dep.shown - 1e-3);
    while (dep.slots.length < need) {
      const s = this.piles.acquire();
      if (s < 0) break;
      this.piles.color(s, CRATE_TINTS[dep.slots.length % CRATE_TINTS.length]);
      dep.slots.push(s);
    }
    while (dep.slots.length > need) this.piles.release(dep.slots.pop()!);
    dep.slots.forEach((slot, i) => {
      const row = i % 2, col = Math.floor(i / 2);
      const along = (col - 2.5) * 6.2, lateral = (row ? 1 : -1) * 6.2;
      const x = dep.x + dep.ux * along + dep.uz * lateral;
      const z = dep.z + dep.uz * along - dep.ux * lateral;
      const sc = Math.min(1, dep.shown - i) * 1.9;
      this.dummy.position.set(x, 0.1, z);
      this.dummy.rotation.set(0, Math.atan2(-dep.uz, dep.ux), 0);
      this.dummy.scale.setScalar(Math.max(0.001, sc));
      this.dummy.updateMatrix();
      this.piles.set(slot, this.dummy.matrix);
    });
  }

  /** Label layar untuk pin yang aktif (agen berlabel dan acara). */
  private project(camera: THREE.Camera, rect: { w: number; h: number }) {
    const out: Floater[] = [];
    const add = (id: string, p: THREE.Vector3, text: string, tone: Tone) => {
      this.tmpV.copy(p).project(camera);
      out.push({ id, x: (this.tmpV.x * 0.5 + 0.5) * rect.w, y: (-this.tmpV.y * 0.5 + 0.5) * rect.h, visible: this.tmpV.z > -1 && this.tmpV.z < 1, text, tone });
    };
    for (const ev of this.events.values()) add(ev.id, this.tmpV.set(ev.x, 36, ev.z), ev.text, ev.tone);
    for (const a of this.agents) if (a.tag && a.pin) add(`a${a.slot}${a.kind}`, this.tmpV.set(a.x, 28, a.z), a.tag.text, a.tag.tone);
    if (this.selected && !this.selected.kill) {
      const s = this.selected;
      add(`sel${s.id}`, this.tmpV.set(s.x, KIND_SCALE[s.kind] * (s.kind === "ped" ? 2.4 : s.kind === "bus" ? 3.4 : 2.6) + 2, s.z), this.describe(s).title, this.describe(s).tone);
    }
    this.floaters = out;
  }

  dispose() {
    for (const k of Object.keys(this.pools) as Kind[]) this.pools[k].dispose();
    this.piles.dispose();
    for (const dep of this.depots.values()) this.removeDepot(dep);
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
    });
    this.parent.remove(this.group);
  }
}
