import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";
import type { District } from "../types";
import { DISTRICT_COLORS } from "../palette";
import { assignDistricts, centroid } from "./assign";
import { buildBuildingsGeometry, footprintOf, hash01, styleOf, type CityMap } from "./geometry";
import { BuildingInterior, type AgendaItem, type BuildingKind, type InteriorInfo } from "./interior";
import { Construction, type CraneSite } from "./construction";
import { CityFabric } from "./fabric";
import { CityCivic } from "./civic";
import { CityClock } from "./clock";
import { Landmarks } from "./landmarks";
import { CityLife, type CityStats, type Floater, type Inspect, type LifeEvent } from "./life";
import { toonRamp } from "./props";
import { RoadGraph } from "./roadgraph";
import { Scenery } from "./scenery";
import { DEFAULT_STYLE, THEMES, developmentOf, type CityStyle } from "./themes";

const BG = 0xeef1fb;
/** Jarak kamera dalam kelipatan radius kota; 3,5 membuat seluruh kota terlihat dengan sedikit ruang di tepi. */
const FRAME = 3.5;

/** Selisih urutan tumbuh yang dipakai satu bangunan untuk naik dari tanah ke tinggi penuh. */
const RISE = 0.08;

/** Mendekatkan nilai ke target dengan kecepatan yang melambat di ujung, supaya pertumbuhan terlihat halus. */
function approach(cur: number, target: number, dt: number): number {
  const diff = target - cur;
  if (Math.abs(diff) < 1e-4) return target;
  return cur + Math.sign(diff) * Math.min(Math.abs(diff), dt * (0.05 + Math.abs(diff) * 0.3));
}

export interface LabelPosition {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface SceneCallbacks {
  onHover?: (id: string | null) => void;
  onSelect?: (id: string | null) => void;
  /** Dipanggil tiap frame dengan posisi layar label distrik (untuk overlay HTML). */
  onLabels?: (labels: LabelPosition[]) => void;
  /** Dipanggil tiap frame dengan posisi layar pin kejadian aktif (truk bermuatan, acara, usulan). */
  onFloaters?: (items: Floater[]) => void;
  /** Kendaraan atau orang yang diklik (null bila dilepas); diperbarui beberapa kali per detik. */
  onInspect?: (info: Inspect | null) => void;
  /** Jam kota dan ringkasan kegiatan, dua kali per detik. */
  onTick?: (t: { time: string; phase: string; hour: number; stats: CityStats }) => void;
  /** Gedung yang dibuka (dibelah) dan isinya; null saat ditutup. */
  onBuilding?: (info: InteriorInfo | null) => void;
}

interface DistrictMesh {
  id: string;
  mesh: THREE.Mesh;
  uniforms: Record<string, { value: unknown }>;
  center: THREE.Vector3;
  /** Perkembangan sekarang dan target (0..1) dari dana distrik. */
  dev: number;
  target: number;
  /** Bangunan di distrik ini: urutan tumbuh, posisi, dan tinggi (untuk derek dan pemilihan). */
  bldg: { id: number; order: number; x: number; z: number; h: number }[];
  /** Pemilik tiap vertex geometri. */
  owner: Int32Array;
  depth: THREE.Material;
}

/** Adegan kota 3D: bangunan, jalan, pejalan kaki, kamera orbit, dan pemilihan distrik. Tidak bergantung pada React. */
export class CityScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private timer = new THREE.Timer();
  private viewShift = 0;
  private cityGroup = new THREE.Group();
  private districtMeshes: DistrictMesh[] = [];
  private life: CityLife | null = null;
  private fabric: CityFabric | null = null;
  private construction: Construction | null = null;
  private scenery: Scenery | null = null;
  private civic: CityCivic | null = null;
  private style: CityStyle = { ...DEFAULT_STYLE, works: [...DEFAULT_STYLE.works] };
  private hall: { x: number; z: number; h: number } | null = null;
  private civicKey = "";
  private graph: RoadGraph | null = null;
  private activity = 1;
  /** Perkembangan tiap distrik dan seluruh kota; kota baru dimulai dari 0 lalu tumbuh ke target. */
  private devState = new Map<string, number>();
  private cityDev = 0;
  private cityTarget = 0;
  private craneClock = 0;
  /** Jam kota: siang, malam, dan pola kegiatan harian. */
  readonly clock = new CityClock(6.6);
  private hemi: THREE.HemisphereLight;
  private tickClock = 0;
  private inspectClock = 0;
  private siteKey = "";
  private shopsOpen = 1;
  /** Mode hemat untuk ponsel dan perangkat lemah: bayangan lebih kecil, piksel lebih sedikit, kota sedikit lebih sepi. */
  private lowPower = false;
  /** Hujan 0..1 dan butir hujan (garis jatuh di sekitar pusat pandangan). */
  private rain = 0;
  private rainLines: THREE.LineSegments | null = null;
  private rainPos: Float32Array | null = null;
  private landmarks: Landmarks | null = null;
  /** Gedung yang sedang dibelah dan isinya. */
  private interior: BuildingInterior | null = null;
  private interiorId = -1;
  private buildingClock = 0;
  private hallId = -1;
  /** Kejadian kota terbaru (tindakan walikota, Satpam, Analis, penduduk) yang tampil di dalam gedung. */
  private agenda: AgendaItem[] = [];
  private cityLabel = "Nusastakes city";
  private lastStats: CityStats | null = null;
  /** Pasca-proses (glow lampu malam, vignette, antialias) hanya di layar lebar; ponsel memakai render biasa. */
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  /** Seragam bersama semua bahan bangunan: waktu dan warna langit untuk pantulan kaca. */
  private shared = { uTime: { value: 0 }, uSkyTop: { value: new THREE.Color(0xcfe0ff) }, uSkyBot: { value: new THREE.Color(0xeef1fb) }, uPix: { value: 0.001 }, uCutId: { value: -1 }, uCutC: { value: new THREE.Vector3() }, uCutN: { value: new THREE.Vector3(0, 0, 1) } };
  private focusAnim: { t: number; from: THREE.Vector3; to: THREE.Vector3; fromDist: number; toDist: number; fromDir: THREE.Vector3; toDir: THREE.Vector3 } | null = null;
  private map: CityMap | null = null;
  private districts: District[] = [];
  private hovered: string | null = null;
  private selected: string | null = null;
  private radius = 300;
  private intro = 0;
  private pointerDown: { x: number; y: number } | null = null;
  private rect = { w: 1, h: 1 };
  private raf = 0;
  private resizeObserver: ResizeObserver;
  private disposed = false;
  private dummy = new THREE.Object3D();
  private sun: THREE.DirectionalLight;
  private labelBuf: LabelPosition[] = [];
  private tmp = new THREE.Vector3();

  constructor(private canvas: HTMLCanvasElement, private cb: SceneCallbacks = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.lowPower = window.innerWidth < 820 || (navigator.hardwareConcurrency ?? 8) <= 4;
    if (this.lowPower) this.activity = 0.65;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.lowPower ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(BG, 1);

    this.scene.background = new THREE.Color(BG);
    this.scene.fog = new THREE.Fog(BG, 500, 1800);
    this.scene.add(this.cityGroup);

    this.camera = new THREE.PerspectiveCamera(32, 1, 1, 5000);
    const wide = typeof window !== "undefined" && window.innerWidth >= 820 && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (wide) {
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.15, 0.55, 0.9);
      this.composer.addPass(this.bloom);
      const vig = new ShaderPass(VignetteShader);
      vig.uniforms.offset.value = 1.0;
      vig.uniforms.darkness.value = 0.42;
      this.composer.addPass(vig);
      this.composer.addPass(new OutputPass());
    }
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = 1.32;
    this.controls.minPolarAngle = 0.3;
    this.controls.screenSpacePanning = false;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.35;
    this.controls.addEventListener("start", () => { this.controls.autoRotate = false; this.focusAnim = null; });

    this.hemi = new THREE.HemisphereLight(0xe4ecff, 0xb9aed6, 1.45);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d8, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.lowPower ? 1024 : 2048, this.lowPower ? 1024 : 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 1.3;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun, this.sun.target);

    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerLeave);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  // -------------------------------------------------------------------------------------------------------------
  // Data
  // -------------------------------------------------------------------------------------------------------------

  setMap(map: CityMap) {
    this.map = map;
    const [x0, z0, x1, z1] = map.bounds;
    this.radius = Math.max(x1 - x0, z1 - z0) / 2 + 20;
    this.controls.target.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    this.controls.minDistance = 28;
    this.controls.maxDistance = this.radius * 10;
    this.scene.fog = new THREE.Fog(BG, this.radius * 6, this.radius * 14);
    this.camera.far = this.radius * 24;
    this.camera.updateProjectionMatrix();

    const s = this.radius * 1.4;
    this.sun.position.set(this.controls.target.x - s * 0.8, s * 1.6, this.controls.target.z + s * 0.9);
    this.sun.target.position.copy(this.controls.target);
    const cam = this.sun.shadow.camera;
    cam.left = -s; cam.right = s; cam.top = s; cam.bottom = -s; cam.near = 1; cam.far = s * 5;
    cam.updateProjectionMatrix();

    this.rebuildStatic();
    this.rebuildDistricts();
    this.resetCamera(true);
  }

  setDistricts(districts: District[]) {
    this.districts = districts;
    this.rebuildDistricts();
  }

  setSelected(id: string | null) {
    this.selected = id;
    this.applyHighlight();
  }

  /** Jarak kamera yang memuat seluruh kota; di layar potret yang sempit kamera mundur lebih jauh. */
  private frameDistance() {
    const aspect = this.rect.w / this.rect.h;
    return this.radius * Math.max(FRAME, 2.6 / aspect);
  }

  resetCamera(animate = false) {
    this.focusAnim = null;
    const t = this.controls.target;
    const d = this.frameDistance();
    const az = -0.62;
    const pol = 0.93;
    this.camera.position.set(t.x + d * Math.sin(pol) * Math.sin(az), d * Math.cos(pol), t.z + d * Math.sin(pol) * Math.cos(az));
    this.camera.lookAt(t);
    if (animate) this.intro = 1;
    this.controls.update();
  }

  // -------------------------------------------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------------------------------------------

  private clearGroup() {
    for (const child of [...this.cityGroup.children]) {
      this.cityGroup.remove(child);
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
    }
    this.districtMeshes = [];
    this.life = null;
    this.fabric = null;
    this.construction = null;
    this.scenery?.dispose();
    this.scenery = null;
    this.civic = null;
    this.landmarks = null;
    this.interior?.dispose();
    this.interior = null;
    this.interiorId = -1;
    this.shared.uCutId.value = -1;
    this.civicKey = "";
    this.graph = null;
  }

  /** Tanah, jalan, dan pejalan kaki: tidak bergantung pada alokasi dana. */
  private rebuildStatic() {
    this.clearGroup();
    if (!this.map) return;
    const map = this.map;

    // Panggung: pulau berlapis seperti maket, langit bergradasi, awan, dan burung.
    this.scenery = new Scenery(this.cityGroup, this.scene, map, this.radius, THEMES[this.style.theme] ?? THEMES.classic);

    // Penata kota: jalan bertingkat, trotoar, marka, zebra, lampu, pohon, taman. Semuanya tumbuh bersama perkembangan kota.
    this.graph = new RoadGraph(map.roads);
    this.fabric = new CityFabric(this.cityGroup, map, this.graph);
    this.construction = new Construction(this.cityGroup);
    // Kehidupan kota (kendaraan, pejalan kaki, logistik, acara) memakai graf jalan yang sama.
    this.life = new CityLife(this.cityGroup, map, this.graph);
    this.life.setActivity(this.activity);
    this.life.setClock(this.clock);
    this.life.setParks(this.fabric.parkSpots);
    this.civic = new CityCivic(this.cityGroup, map, (ev) => this.life?.emit(ev));
    this.landmarks = new Landmarks(this.cityGroup, map);
    this.applyStyle();
    this.devState.clear();
    this.cityDev = 0;
    this.cityTarget = 0;
    this.fabric.setDevelopment(0);
    this.life.setDevelopment(0);
  }

  /** Bangunan per distrik: satu mesh gabungan per distrik. */
  private rebuildDistricts() {
    if (!this.map) return;
    for (const dm of this.districtMeshes) {
      this.cityGroup.remove(dm.mesh);
      dm.mesh.geometry.dispose();
      (dm.mesh.material as THREE.Material).dispose();
      dm.depth.dispose();
    }
    this.districtMeshes = [];
    const districts = this.districts.length
      ? this.districts
      : ([{ id: "all", kind: "idle", label: "City", weight: 1, assets: 0, apyBps: null, simulated: false }] as District[]);
    const groups = assignDistricts(this.map.buildings, districts);

    for (const d of districts) {
      const idx = groups.get(d.id);
      if (!idx || idx.length === 0) continue;
      // Urutan tumbuh: dari pusat kota ke luar (dengan sedikit acak), menara tinggi belakangan. Tiga bangunan pertama
      // di alun-alun sudah ada sejak awal sebagai balai kota.
      const [mx0, mz0, mx1, mz1] = this.map.bounds;
      const keyed = idx.map((bi) => {
        const [bx, bz] = centroid(this.map!.buildings, [bi]);
        return { bi, bx, bz, key: Math.hypot(bx - (mx0 + mx1) / 2, bz - (mz0 + mz1) / 2) * (0.85 + 0.3 * hash01(bi * 1.7)) };
      }).sort((a, b) => a.key - b.key);
      const order = new Map<number, number>();
      // Balai kota: tiga bangunan rendah terdekat dari pusat (bukan menara) berdiri sejak kota kosong.
      const starterList = d.kind === "idle" ? keyed.filter((k) => this.map!.buildings[k.bi].h <= 40).slice(0, 3) : [];
      // Balai kota: gedung menengah (14 sampai 32 m) terdekat dari pusat, supaya punya beberapa lantai untuk diisi.
      const hallPick = d.kind === "idle" ? keyed.find((k) => this.map!.buildings[k.bi].h >= 14 && this.map!.buildings[k.bi].h <= 32) ?? starterList[0] : undefined;
      if (hallPick) { this.hall = { x: hallPick.bx, z: hallPick.bz, h: this.map.buildings[hallPick.bi].h }; this.hallId = hallPick.bi; starterList.push(hallPick); }
      const starters = new Set(starterList.map((k) => k.bi));
      keyed.forEach((k, r) => {
        let o = (r / keyed.length) * 0.92 + 0.04 * hash01(k.bi * 2.9);
        if (this.map!.buildings[k.bi].h > 120) o += 0.08;
        order.set(k.bi, starters.has(k.bi) ? -0.3 : Math.min(1, o));
      });
      const { geometry, maxHeight, owner } = buildBuildingsGeometry(this.map.buildings, idx, 1, (bi) => order.get(bi) ?? 0);
      const accent = new THREE.Color(DISTRICT_COLORS[d.kind]);
      const body = new THREE.Color(0xffffff).lerp(accent, d.kind === "idle" ? 0.04 : 0.1);
      const lit = d.kind === "idle" ? 0.06 : 0.22 + 0.7 * Math.min(1, (d.apyBps ?? 600) / 1800);
      const { material, uniforms, depth } = this.makeMaterial(body, accent, lit, d.kind === "idle" ? 0.06 : 0.34);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.customDepthMaterial = depth;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.districtId = d.id;
      this.cityGroup.add(mesh);
      const [cx, cz] = centroid(this.map.buildings, idx);
      const dev = this.devState.get(d.id) ?? 0;
      uniforms.uBuild.value = dev * (1 + RISE);
      this.districtMeshes.push({
        id: d.id, mesh, uniforms, depth, owner,
        center: new THREE.Vector3(cx, Math.min(maxHeight, 60) * 0.55, cz),
        dev, target: developmentOf(d.assets),
        bldg: keyed.map((k) => ({ id: k.bi, order: order.get(k.bi) ?? 0, x: k.bx, z: k.bz, h: this.map!.buildings[k.bi].h })),
      });
    }
    this.cityTarget = developmentOf(districts.reduce((s, d) => s + Math.max(0, d.assets), 0));
    this.applyHighlight();
    this.syncLife(districts, groups);
  }

  /** Memberi tahu lapisan kehidupan di mana tiap distrik berada dan seberapa besar. */
  private syncLife(districts: District[], groups: Map<string, number[]>) {
    if (!this.life || !this.map) return;
    const all = this.map.buildings.map((_, i) => i);
    const list = districts.map((d) => {
      const idx = groups.get(d.id) ?? [];
      const [x, z] = centroid(this.map!.buildings, idx.length ? idx : all);
      const step = Math.max(1, Math.floor(idx.length / 40));
      const roofs = idx.filter((_, i) => i % step === 0).map((bi) => {
        const b = this.map!.buildings[bi];
        const [bx, bz] = centroid(this.map!.buildings, [bi]);
        return { x: bx, z: bz, h: b.h };
      });
      return { id: d.id, kind: d.kind, color: DISTRICT_COLORS[d.kind], weight: d.weight, x, z, roofs };
    });
    this.life.setDistricts(list);
    // Karya sipil dipasang di sekitar alun-alun, di taman yang ditemukan penata kota.
    const plaza = this.life.focusPoint("idle") ?? this.life.focusPoint(districts[0]?.id ?? "");
    if (plaza && this.civic && this.fabric) {
      const key = `${Math.round(plaza.x)},${Math.round(plaza.z)},${Math.round(this.hall?.x ?? 0)},${this.fabric.parkSpots.length}`;
      if (key !== this.civicKey) {
        this.civicKey = key;
        const fabric = this.fabric;
        this.civic.setAnchors({ plaza, hall: this.hall, spots: fabric.parkSpots, free: (x, z, m) => fabric.placeable(x, z, m) });
      }
      // Layar LED, papan iklan, dan gondola: menghadap arah kamera awal.
      const cands = this.districtMeshes.flatMap((dm) => dm.bldg.map((b) => ({ id: b.id, x: b.x, z: b.z, h: b.h })));
      this.landmarks?.setup(cands, plaza, [Math.sin(-0.62), Math.cos(-0.62)]);
    }
  }

  /** Gaya kota pilihan walikota: tema warna dan karya sipil. Hanya tampilan. */
  setStyle(style: CityStyle) {
    this.style = style;
    this.applyStyle();
  }

  private applyStyle() {
    const theme = THEMES[this.style.theme] ?? THEMES.classic;
    this.scenery?.setTheme(theme);
    this.fabric?.setTheme(theme);
    this.civic?.setStyle(this.style);
  }

  /** Menjalankan sebuah kejadian di kota: truk, kerumunan, konfeti, pin. */
  emit(ev: LifeEvent) { this.remember(ev); this.life?.emit(ev); }
  setActivity(v: number) { this.activity = v * (this.lowPower ? 0.65 : 1); this.life?.setActivity(this.activity); }

  /** Terbang kamera ke sebuah distrik. */
  focusDistrict(id: string, distanceFactor = 1.15) {
    const p = this.life?.focusPoint(id);
    if (p) this.focusOn(p.x, p.z, this.radius * distanceFactor);
  }

  /** Kamera mendekat ke (x, z) dengan sudut lebih menghadap ke bawah supaya jalan terlihat di antara bangunan tinggi. */
  focusOn(x: number, z: number, dist: number, polar = 0.62, y = 0) {
    const from = this.controls.target.clone();
    const fromDir = this.camera.position.clone().sub(from);
    const fromDist = fromDir.length();
    fromDir.normalize();
    const az = Math.atan2(fromDir.x, fromDir.z);
    const toDir = new THREE.Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az));
    this.focusAnim = { t: 0, from, to: new THREE.Vector3(x, y, z), fromDist, toDist: Math.max(this.controls.minDistance, dist), fromDir, toDir };
    this.controls.autoRotate = false;
  }

  /** Derek di bangunan tinggi yang sedang naik; maksimal sepuluh, saling berjauhan. */
  private updateCranes() {
    if (!this.construction) return;
    const sites: (CraneSite & { score: number })[] = [];
    for (const dm of this.districtMeshes) {
      for (const b of dm.bldg) {
        const g = (dm.dev * (1 + RISE) - b.order) / RISE;
        if (g > 0.03 && g < 0.97 && b.h >= 14) sites.push({ x: b.x, z: b.z, h: b.h * g, score: b.h });
      }
    }
    sites.sort((a, b) => b.score - a.score);
    const chosen: CraneSite[] = [];
    for (const s of sites) {
      if (chosen.length >= 10) break;
      if (chosen.every((q) => Math.hypot(q.x - s.x, q.z - s.z) > 45)) chosen.push(s);
    }
    this.construction.set(chosen);
    const key = chosen.map((q) => `${Math.round(q.x)},${Math.round(q.z)}`).join("|");
    if (key !== this.siteKey) { this.siteKey = key; this.life?.setConstructionSites(chosen); }
  }

  // --- Jam kota ---------------------------------------------------------------------------------------------

  /** Cuaca: "auto" (hujan sore sesekali), "clear", atau "rain". */
  setWeather(mode: "auto" | "clear" | "rain") { this.clock.weather = mode; }

  private updateRain(dt: number) {
    if (this.rain < 0.02) { if (this.rainLines) this.rainLines.visible = false; return; }
    if (!this.rainLines) {
      const N = this.lowPower ? 1200 : 2600;
      this.rainPos = new Float32Array(N * 6);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage));
      this.rainLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xeef3ff, transparent: true, opacity: 0.75, depthWrite: false }));
      this.rainLines.frustumCulled = false;
      this.scene.add(this.rainLines);
      for (let i = 0; i < N; i++) this.seedDrop(i, true);
    }
    const p = this.rainPos!;
    const N = p.length / 6;
    const active = Math.floor(N * Math.min(1, this.rain));
    const fall = 90 * dt;
    const t = this.controls.target;
    const span = this.rainSpan();
    for (let i = 0; i < N; i++) {
      if (i >= active) { p[i * 6 + 1] = p[i * 6 + 4] = -999; continue; }
      // Hujan mengikuti pandangan: butir yang tertinggal jauh dari pusat pandangan dipindah ke dekatnya.
      if (Math.abs(p[i * 6] - t.x) > span || Math.abs(p[i * 6 + 2] - t.z) > span || p[i * 6 + 1] < -900) { this.seedDrop(i, true); continue; }
      p[i * 6 + 1] -= fall; p[i * 6 + 4] -= fall;
      p[i * 6] += fall * 0.08; p[i * 6 + 3] += fall * 0.08;
      if (p[i * 6 + 4] < 0) this.seedDrop(i, false);
    }
    this.rainLines.visible = true;
    (this.rainLines.material as THREE.LineBasicMaterial).opacity = 0.35 + 0.45 * this.rain;
    this.rainLines.geometry.attributes.position.needsUpdate = true;
  }

  private rainSpan() { return Math.min(this.radius * 1.6, this.camera.position.distanceTo(this.controls.target) * 0.9); }

  private seedDrop(i: number, anywhere: boolean) {
    const p = this.rainPos!;
    const t = this.controls.target;
    const span = this.rainSpan();
    const x = t.x + (Math.random() - 0.5) * span * 2, z = t.z + (Math.random() - 0.5) * span * 2;
    const y = anywhere ? Math.random() * 160 : 140 + Math.random() * 40;
    p[i * 6] = x; p[i * 6 + 1] = y; p[i * 6 + 2] = z;
    p[i * 6 + 3] = x + 0.5; p[i * 6 + 4] = y - 4.5; p[i * 6 + 5] = z;
  }

  /** Detik nyata per jam kota (default 16: satu hari sekitar 6,5 menit). */
  setClockSpeed(secondsPerHour: number) { this.clock.secondsPerHour = Math.max(0.5, secondsPerHour); }
  setHour(h: number) { this.clock.hour = ((h % 24) + 24) % 24; }
  setClockPaused(p: boolean) { this.clock.paused = p; }
  /** Nama kota untuk layar LED. */
  setCityLabel(name: string) { this.cityLabel = name; }

  /** Melepas kendaraan atau orang yang sedang dilihat. */
  clearInspect() { this.life?.clearSelection(); }

  /** Matahari, langit, lampu jendela, lampu jalan, dan lampu kendaraan mengikuti jam. */
  private applyTime(dt: number) {
    const ck = this.clock;
    const day = ck.daylight, dusk = ck.dusk, night = 1 - day;
    const t = this.controls.target;
    const s = this.radius * 1.4;
    const ang = ((ck.hour - 6) / 12) * Math.PI;
    const elev = Math.max(0.28, Math.sin(Math.min(Math.PI, Math.max(0, ang))));
    if (day > 0.02) this.sun.position.set(t.x + Math.cos(ang) * s * 1.1, elev * s * 1.6, t.z + s * 0.7);
    else this.sun.position.set(t.x - s * 0.5, s * 1.5, t.z + s * 0.9);
    this.sun.target.position.copy(t);
    this.sun.color.setRGB(1, 0.95, 0.86).lerp(new THREE.Color(0xffa36b), dusk * 0.7).lerp(new THREE.Color(0x8fa6ff), night * 0.85);
    this.sun.intensity = (0.45 + 1.95 * day + 0.3 * dusk) * (1 - 0.55 * this.rain);
    this.hemi.intensity = 0.6 + 0.85 * day;
    this.hemi.color.setRGB(0.89, 0.93, 1).lerp(new THREE.Color(0x4a5aa8), night * 0.8);
    this.hemi.groundColor.setRGB(0.73, 0.68, 0.84).lerp(new THREE.Color(0x2a2f55), night * 0.8);
    // Hujan mendekati targetnya pelan-pelan (sekitar 6 detik).
    this.rain += (ck.rainTarget() - this.rain) * Math.min(1, dt / 6);
    this.updateRain(dt);
    this.scenery?.setTime(day, dusk, this.rain);
    this.shared.uTime.value = this.timer.getElapsed();
    if (this.scenery) { this.shared.uSkyTop.value.copy(this.scenery.skyTop); this.shared.uSkyBot.value.copy(this.scenery.skyBottom); }
    this.fabric?.setNight(night, this.rain);
    this.life?.setNight(Math.max(night, this.rain * 0.6));
    this.life?.setRain(this.rain);
    // Glow hanya malam, dan hanya untuk cahaya yang lebih terang dari putih (jendela, lampu, layar).
    if (this.bloom) { this.bloom.enabled = night > 0.2; this.bloom.strength = 0.5 * night; this.bloom.threshold = 1.0; this.bloom.radius = 0.35; }
    if (this.landmarks) {
      const ds = this.districtMeshes;
      const tvl = this.districts.reduce((sum, d) => sum + Math.max(0, d.assets), 0);
      const apy = this.districts.reduce((m, d) => (d.apyBps !== null && d.apyBps > (m ?? -1) ? d.apyBps : m), null as number | null);
      this.landmarks.update(this.timer.getElapsed(), (id) => {
        for (const dm of ds) { const b = dm.bldg.find((q) => q.id === id); if (b) return Math.max(0, Math.min(1, (dm.dev * (1 + RISE) - b.order) / RISE)); }
        return 0;
      }, { name: this.cityLabel, tvl, apy, time: ck.label, phase: ck.phase, people: this.lastStats?.people ?? 0, trips: this.lastStats?.tripsToday ?? 0 }, night);
    }
    const open = ck.shopsOpen() ? 1 : 0;
    this.shopsOpen += (open - this.shopsOpen) * Math.min(1, dt * 2);
    for (const dm of this.districtMeshes) {
      (dm.uniforms.uNight as { value: number }).value = night;
      (dm.uniforms.uShops as { value: number }).value = this.shopsOpen;
    }
  }

  private makeMaterial(body: THREE.Color, glow: THREE.Color, lit: number, roof: number) {
    const uniforms = {
      uGlow: { value: glow.clone() },
      uGlass: { value: new THREE.Color(0xc9d3f0) },
      uLit: { value: lit },
      uHover: { value: 0 },
      uSel: { value: 0 },
      uGlowStrength: { value: 1.35 },
      uRoof: { value: roof },
      uBuild: { value: 0 },
      uNight: { value: 0 },
      uShops: { value: 1 },
    };
    const material = new THREE.MeshToonMaterial({ color: body, vertexColors: true, gradientMap: toonRamp() });
    Object.assign(uniforms, this.shared);
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec2 wuv;\nattribute float seed;\nattribute float bord;\nattribute float bh;\nattribute float bstyle;\nattribute vec2 wseg;\nattribute float bid;\nuniform float uBuild;\nvarying float vBid;\nvarying vec3 vWPos;\nvarying vec2 vWuv;\nvarying float vSeed;\nvarying float vLot;\nvarying float vBh;\nvarying float vStyle;\nvarying vec2 vWseg;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>
vWuv = wuv;
vSeed = seed;
vBh = bh;
vStyle = bstyle;
vWseg = wseg;
float bg = clamp((uBuild - bord) / ${RISE.toFixed(3)}, 0.0, 1.0);
bg = bg * bg * (3.0 - 2.0 * bg);
vLot = bg < 0.004 ? 1.0 : 0.0;
if (bg < 0.004) { transformed.y = 0.14; } else { transformed.y *= bg; }
vBid = bid;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>
uniform float uCutId;
uniform vec3 uCutC;
uniform vec3 uCutN;
varying float vBid;
varying vec3 vWPos;
uniform vec3 uGlow;
uniform vec3 uGlass;
uniform float uLit;
uniform float uHover;
uniform float uSel;
uniform float uGlowStrength;
uniform float uRoof;
uniform float uNight;
uniform float uShops;
uniform float uTime;
uniform vec3 uSkyTop;
uniform vec3 uSkyBot;
uniform float uPix;
varying vec2 vWuv;
varying float vSeed;
varying float vLot;
varying float vBh;
varying float vStyle;
varying vec2 vWseg;
float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 pick4(float r, vec3 a, vec3 b, vec3 c, vec3 d) { return r < 0.25 ? a : r < 0.5 ? b : r < 0.75 ? c : d; }
// Ruang di balik kaca: sinar pandang menembus jendela ke kotak ruangan (lebar sz.x, tinggi sz.y).
vec3 roomAt(vec2 f, vec2 sz, vec3 r, float rs, float lit, float night, float lod) {
  float dep = sz.x * 0.9;
  vec3 p = vec3(f * sz, 0.0);
  vec3 d = vec3(r.xy, max(r.z, 0.05));
  float dxs = abs(d.x) < 1e-4 ? 1e-4 : d.x;
  float dys = abs(d.y) < 1e-4 ? 1e-4 : d.y;
  float tx = max((dxs > 0.0 ? sz.x - p.x : -p.x) / dxs, 0.0);
  float ty = max((dys > 0.0 ? sz.y - p.y : -p.y) / dys, 0.0);
  float tz = dep / d.z;
  float t = min(min(tx, ty), tz);
  vec3 h = p + d * t;
  vec3 wall = pick4(rs, vec3(0.86, 0.82, 0.74), vec3(0.78, 0.84, 0.9), vec3(0.88, 0.8, 0.78), vec3(0.8, 0.86, 0.8));
  vec3 col = wall * 0.86;
  if (t == tz) {
    col = wall;
    float cab = step(abs(h.x - sz.x * (0.2 + 0.6 * fract(rs * 7.3))), sz.x * 0.16) * step(h.y, sz.y * 0.38);
    col = mix(col, vec3(0.42, 0.33, 0.27), cab * lod);
    float art = step(abs(h.x - sz.x * fract(rs * 3.1 + 0.5)), sz.x * 0.1) * step(abs(h.y - sz.y * 0.62), sz.y * 0.09);
    col = mix(col, pick4(fract(rs * 5.7), vec3(0.9, 0.5, 0.4), vec3(0.4, 0.6, 0.9), vec3(0.95, 0.8, 0.3), vec3(0.4, 0.75, 0.55)), art * lod);
  } else if (t == ty) {
    col = mix(wall * 0.9, d.y < 0.0 ? vec3(0.62, 0.5, 0.4) : vec3(0.96, 0.95, 0.92), lod);
  }
  // Penghuni yang berjalan melintas di dalam ruangan.
  float tp = dep * 0.5 / d.z;
  if (tp < t) {
    vec3 hp = p + d * tp;
    float px = sz.x * fract(uTime * (0.015 + 0.04 * rs) + rs * 13.1);
    float body = step(abs(hp.x - px), sz.x * 0.06) * step(hp.y, sz.y * 0.48) * step(0.02, hp.y);
    float head = step(length(vec2(hp.x - px, hp.y - sz.y * 0.56)), sz.x * 0.05);
    col = mix(col, vec3(0.18, 0.2, 0.28), max(body, head) * step(0.45, rs) * 0.9 * lod);
  }
  float depthFade = mix(1.0, mix(0.85, 0.6, lod), clamp(h.z / dep, 0.0, 1.0));
  col *= mix(0.4 + 0.22 * (1.0 - night), 1.12, lit) * depthFade;
  col *= mix(vec3(1.0), vec3(1.0, 0.86, 0.62), lit * night);
  float tv = step(0.82, fract(rs * 11.7)) * night * (0.6 + 0.4 * sin(uTime * 7.0 + rs * 40.0));
  col += vec3(0.15, 0.25, 0.55) * tv * (1.0 - lit);
  return col;
}`)
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
// Gedung yang dibuka: setengah yang menghadap kamera disembunyikan supaya isinya terlihat.
if (abs(vBid - uCutId) < 0.5 && (dot(vWPos - uCutC, uCutN) > 4.0 || vWuv.y < 0.0)) discard;
// Gedung lain yang menghalangi pandangan ke gedung yang dibuka disembunyikan (jalur pandang bersih).
if (uCutId > -0.5 && abs(vBid - uCutId) > 0.5) {
  vec3 seg = uCutC - cameraPosition;
  float sl = dot(seg, seg);
  float tt = clamp(dot(vWPos - cameraPosition, seg) / max(sl, 1e-3), 0.0, 1.0);
  if (tt < 0.9 && length(vWPos - (cameraPosition + seg * tt)) < 5.0 + 9.0 * tt) discard;
}
float isWall = step(0.0, vWuv.y);
float flatRoof = step(-1.5, vWuv.y) * (1.0 - isWall);
float uu = vWuv.x, vv = vWuv.y;
float st = floor(vStyle + 0.5);
// Benih per gedung dibulatkan: nilai yang diinterpolasi punya galat kecil yang membuat hash berbintik per piksel.
float sdQ = floor(vSeed * 4096.0 + 0.5) / 4096.0;
float eDist = vWseg.y > 0.0 ? min(vWseg.x, vWseg.y - vWseg.x) : 99.0;
float corner = isWall * step(eDist, 0.55);
// Arah pandang dalam bidang dinding: untuk ruang di balik kaca dan pantulan langit.
vec3 Nv = normalize(vNormal);
vec3 Vv = normalize(vViewPosition);
vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
// Dinding selalu tegak: sumbu atas = atas dunia, sumbu samping = tegak lurus normal (stabil, tanpa turunan layar).
vec3 Bv = upV;
vec3 Tv = normalize(cross(Bv, Nv) + vec3(1e-6));
vec3 rd = -Vv;
vec3 rTS = vec3(dot(rd, Tv), dot(rd, Bv), -dot(rd, Nv));
vec3 sky = mix(uSkyBot, uSkyTop, clamp(dot(reflect(rd, Nv), upV) * 0.8 + 0.35, 0.0, 1.0));
float fres = 0.15 + 0.85 * pow(1.0 - clamp(dot(Nv, Vv), 0.0, 1.0), 3.0);
float litF = clamp(uLit * (1.0 - uNight * 0.35) + uNight * 0.32, 0.0, 1.0);
// Cat fasad per gaya: kaca kebiruan, beton, cat hunian pastel, ruko krem.
float pr = fract(sdQ * 17.3);
vec3 paint = st < 0.5 ? vec3(0.62, 0.72, 0.86)
  : st < 1.5 ? pick4(pr, vec3(0.86, 0.85, 0.82), vec3(0.8, 0.81, 0.84), vec3(0.88, 0.84, 0.78), vec3(0.76, 0.79, 0.82))
  : st < 2.5 ? pick4(pr, vec3(0.74, 0.9, 0.84), vec3(0.98, 0.84, 0.74), vec3(0.98, 0.93, 0.72), vec3(0.8, 0.86, 0.98))
  : pick4(pr, vec3(0.97, 0.95, 0.9), vec3(0.95, 0.9, 0.82), vec3(0.9, 0.93, 0.97), vec3(0.98, 0.9, 0.86));
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * mix(paint, uGlow, 0.12) * 1.08, isWall);
// Dari jauh, pola jendela yang lebih kecil dari beberapa piksel diganti warna rata-ratanya (tanpa bintik).
// Meter per piksel dari jarak pandang (halus, tanpa turunan layar yang berbintik).
float mpp = length(vViewPosition) * uPix / max(0.35, abs(dot(Nv, Vv)));
float detail = 1.0 - smoothstep(0.32, 0.85, mpp);
// Isi ruangan (lemari, lukisan, penghuni) hanya digambar bila jendela cukup besar di layar.
float lod = 1.0 - smoothstep(0.04, 0.12, mpp);
float cov = st < 0.5 ? 0.78 : st < 1.5 ? 0.45 : st < 2.5 ? 0.28 : 0.32;
vec3 farGlass = st < 0.5 ? mix(vec3(0.36, 0.5, 0.72), sky, 0.22) : vec3(0.5, 0.56, 0.66);
farGlass = mix(farGlass, vec3(0.16, 0.19, 0.3), uNight * 0.7);
// Dari jauh: lantai-lantai digabung jadi petak 12 m x 2 lantai, sebagian menyala.
float band = h21(vec2(floor((vv - 4.2) / 7.4), floor(uu / 8.0) + sdQ * 7.0));
float bandLit = step(band, litF * 0.8);
vec3 farCol = mix(diffuseColor.rgb, farGlass, cov) * (0.93 + 0.1 * band);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.86, corner);
// Grid jendela per gaya.
float floorH = st < 0.5 ? 3.8 : st < 2.5 ? 3.4 : 3.6;
float cellW = st < 0.5 ? 1.8 : st < 1.5 ? 1.6 : st < 2.5 ? 3.2 : 4.0;
float groundTop = st > 2.5 ? 4.0 : 4.2;
vec2 wcell = vec2(uu / cellW, (vv - groundTop) / floorH);
vec2 wid = floor(wcell);
vec2 wf = fract(wcell);
float win = st < 0.5 ? step(0.06, wf.x) * step(wf.x, 0.94) * step(0.18, wf.y) * step(wf.y, 0.96)
  : st < 1.5 ? step(0.04, wf.x) * step(wf.x, 0.96) * step(0.42, wf.y) * step(wf.y, 0.86)
  : st < 2.5 ? step(0.22, wf.x) * step(wf.x, 0.78) * step(0.3, wf.y) * step(wf.y, 0.82)
  : step(0.15, wf.x) * step(wf.x, 0.85) * step(0.28, wf.y) * step(wf.y, 0.8);
float upper = isWall * step(groundTop, vv) * step(vv, vBh - 1.2) * (1.0 - corner);
win *= upper;
float rs = h21(wid + sdQ * 91.7);
float roomLit = step(h21(wid * 1.3 + floor(uTime / 30.0 + rs * 7.0) + sdQ * 5.1), litF);
vec2 wx = st < 0.5 ? vec2(0.06, 0.88) : st < 1.5 ? vec2(0.04, 0.92) : st < 2.5 ? vec2(0.22, 0.56) : vec2(0.15, 0.7);
vec2 wy = st < 0.5 ? vec2(0.18, 0.78) : st < 1.5 ? vec2(0.42, 0.44) : st < 2.5 ? vec2(0.3, 0.52) : vec2(0.28, 0.52);
vec2 fw = clamp(vec2((wf.x - wx.x) / wx.y, (wf.y - wy.x) / wy.y), 0.0, 1.0);
vec3 room = roomAt(fw, vec2(cellW * wx.y, floorH * wy.y), rTS, rs, roomLit, uNight, lod);
float reflK = st < 0.5 ? mix(0.8, 0.25, uNight) : mix(0.35, 0.1, uNight);
vec3 glass = mix(room, sky, clamp(fres * reflK + (st < 0.5 ? 0.22 * (1.0 - uNight) : 0.0), 0.0, 0.95));
diffuseColor.rgb = mix(diffuseColor.rgb, glass, win);
// Menara: panel spandrel di antara jendela. Hunian: ambang jendela putih, pagar balkon, jemuran, AC.
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.4, 0.48, 0.6), upper * step(st, 0.5) * (1.0 - win) * 0.75);
float isHome = step(1.5, st) * step(st, 2.5);
float sill = upper * isHome * (1.0 - win) * step(abs(wf.y - 0.27), 0.03) * step(0.18, wf.x) * step(wf.x, 0.82);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97), sill);
float rail = upper * isHome * step(groundTop + floorH, vv) * step(0.1, wf.y) * step(wf.y, 0.26);
diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.5, 0.53, 0.62), vec3(0.86, 0.88, 0.93), step(0.5, fract(uu * 3.0))), rail * 0.85);
float laundry = rail * step(0.7, h21(wid * 2.7 + sdQ)) * step(0.3, fract(uu * 1.7 + rs)) * step(fract(uu * 1.7 + rs), 0.7);
diffuseColor.rgb = mix(diffuseColor.rgb, pick4(fract(rs * 9.1 + floor(uu * 1.7) * 0.37), vec3(0.95, 0.4, 0.4), vec3(0.98, 0.85, 0.3), vec3(0.35, 0.6, 0.95), vec3(0.98)), laundry);
float ac = upper * isHome * step(abs(wf.x - 0.9), 0.07) * step(abs(wf.y - 0.45), 0.09) * step(0.45, rs);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.91, 0.94) * (0.85 + 0.15 * step(0.5, fract(vv * 12.0))), ac);
// Lantai dasar: lobi kaca (kantor), etalase dan rolling door (ruko), pintu (hunian).
float ground = isWall * step(vv, groundTop) * (1.0 - corner);
float sx = fract(uu / 4.0);
float gRs = h21(vec2(floor(uu / 4.0), sdQ * 13.0));
float front = ground * step(0.08, sx) * step(sx, 0.92) * step(0.3, vv) * step(vv, groundTop - 0.95);
vec3 shopIn = roomAt(vec2((sx - 0.08) / 0.84, clamp((vv - 0.3) / (groundTop - 1.25), 0.0, 1.0)), vec2(3.4, groundTop - 1.25), rTS, gRs, max(uShops, 0.25), uNight, lod);
vec3 shopGlass = mix(shopIn, sky, fres * 0.3 * (1.0 - uNight));
float isRuko = step(2.5, st);
float isTall = step(st, 1.5);
float shutter = (1.0 - uShops) * isRuko;
vec3 shutterCol = vec3(0.68, 0.7, 0.75) * (0.82 + 0.18 * step(0.5, fract(vv * 5.0)));
diffuseColor.rgb = mix(diffuseColor.rgb, mix(shopGlass, shutterCol, shutter), front * max(isRuko, isTall));
float door = ground * isHome * step(abs(fract(uu / 9.0) - 0.5), 0.07) * step(vv, 2.3);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.45, 0.32, 0.24), door);
// Papan nama ruko dengan huruf piksel.
float signB = ground * isRuko * step(groundTop - 0.9, vv) * step(vv, groundTop - 0.1) * step(0.06, sx) * step(sx, 0.94);
vec3 signCol = pick4(gRs, vec3(0.9, 0.25, 0.25), vec3(0.2, 0.45, 0.85), vec3(0.95, 0.7, 0.15), vec3(0.15, 0.6, 0.4));
float glyph = signB * step(0.45, h21(floor(vec2(uu * 3.2, vv * 6.0)) + gRs * 9.0)) * step(0.2, sx) * step(sx, 0.8) * step(abs(vv - (groundTop - 0.5)), 0.22);
diffuseColor.rgb = mix(diffuseColor.rgb, signCol, signB);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), glyph);
// Ganti ke warna rata-rata saat terlalu jauh.
float upperAll = isWall * step(groundTop, vv) * step(vv, vBh - 1.2);
diffuseColor.rgb = mix(diffuseColor.rgb, farCol, upperAll * (1.0 - detail));
// Mahkota menara dan tepi atap.
float cornice = isWall * step(vBh - vv, 0.9) * step(6.0, vBh);
diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb * 0.8 + vec3(0.09), uGlow * 0.8 + 0.15, isTall * 0.6), cornice);
// Bayangan halus di kaki bangunan dan sedikit lebih terang ke atas.
diffuseColor.rgb *= mix(1.0, mix(0.8, 1.0, smoothstep(0.0, 2.5, vv)), isWall);
diffuseColor.rgb *= mix(1.0, mix(0.95, 1.04, clamp(vv / max(vBh, 1.0), 0.0, 1.0)), isWall);
diffuseColor.rgb = mix(diffuseColor.rgb, uGlow, flatRoof * (uRoof + 0.22 * uSel + 0.12 * uHover));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.86, 0.98), vLot * 0.92);`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
float alive = 1.0 - vLot;
totalEmissiveRadiance += room * win * roomLit * (0.12 + uNight * 0.7) * alive * detail;
totalEmissiveRadiance += vec3(1.0, 0.8, 0.5) * upperAll * (1.0 - detail) * cov * (0.12 + bandLit * 0.55) * uNight * alive;
totalEmissiveRadiance += shopIn * front * max(isRuko, isTall) * (1.0 - shutter) * (0.08 + uNight * 0.75) * alive;
totalEmissiveRadiance += signCol * signB * uNight * 0.55 * alive + vec3(glyph) * uNight * 0.6 * alive;
totalEmissiveRadiance += (uGlow * 0.7 + 0.3) * cornice * isTall * uNight * 0.85 * alive;
totalEmissiveRadiance += uGlow * (uHover * 0.05 + uSel * 0.09) * (0.4 + 0.6 * isWall) * alive;`,
        );
    };
    // Bayangan mengikuti bangunan yang sudah naik; kavling kosong tidak punya bayangan.
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depth.onBeforeCompile = (shader) => {
      shader.uniforms.uBuild = uniforms.uBuild;
      shader.uniforms.uCutId = this.shared.uCutId;
      shader.uniforms.uCutC = this.shared.uCutC;
      shader.uniforms.uCutN = this.shared.uCutN;
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uCutId;\nuniform vec3 uCutC;\nuniform vec3 uCutN;\nvarying float vBid;\nvarying vec3 vWPos;")
        .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (abs(vBid - uCutId) < 0.5 && dot(vWPos - uCutC, uCutN) > 4.0) discard;");
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float bord;\nattribute float bid;\nuniform float uBuild;\nvarying float vBid;\nvarying vec3 vWPos;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
float bg = clamp((uBuild - bord) / ${RISE.toFixed(3)}, 0.0, 1.0);
bg = bg * bg * (3.0 - 2.0 * bg);
if (bg < 0.004) { transformed.y = -500.0; } else { transformed.y *= bg; }
vBid = bid;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
        );
    };
    return { material, uniforms, depth };
  }

  private applyHighlight() {
    for (const dm of this.districtMeshes) {
      (dm.uniforms.uHover as { value: number }).value = dm.id === this.hovered ? 1 : 0;
      (dm.uniforms.uSel as { value: number }).value = dm.id === this.selected ? 1 : 0;
    }
  }

  // -------------------------------------------------------------------------------------------------------------
  // Interaksi
  // -------------------------------------------------------------------------------------------------------------

  private pick(ev: PointerEvent): string | null {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    // Hanya bangunan yang sudah berdiri yang bisa dipilih; kavling kosong dan bangunan yang baru mulai naik dilewati.
    for (const hit of this.raycaster.intersectObjects(this.districtMeshes.map((d) => d.mesh), false)) {
      const dm = this.districtMeshes.find((d) => d.mesh === hit.object);
      if (!dm || !hit.face) continue;
      const bi = dm.owner[hit.face.a];
      const b = dm.bldg.find((q) => q.id === bi);
      if (b && (dm.dev * (1 + RISE) - b.order) / RISE > 0.5) { this.pickedBuilding = bi; return dm.id; }
    }
    this.pickedBuilding = -1;
    return null;
  }
  private pickedBuilding = -1;
  private buildingDist = 50;

  // --- Gedung yang dibelah --------------------------------------------------------------------------------------

  /** Membuka gedung: bagian depan disembunyikan, lantai dan kegiatannya tampak. */
  openBuilding(bi: number) {
    if (!this.map || bi < 0 || bi === this.interiorId) return;
    this.closeBuilding();
    const raw = this.map.buildings[bi];
    const dm = this.districtMeshes.find((q) => q.bldg.some((b) => b.id === bi));
    const d = this.districts.find((q) => q.id === dm?.id);
    const place = this.life?.placeOf(bi);
    const kind: BuildingKind = bi === this.hallId ? "hall" : (place?.kind ?? "home");
    this.interior = new BuildingInterior(this.cityGroup, {
      id: bi, name: bi === this.hallId ? this.cityLabel : place?.name ?? "Building", kind, style: styleOf(raw, bi), h: raw.h, polygon: footprintOf(raw, bi),
      district: { id: d?.id ?? "", label: d?.label ?? "", color: d ? DISTRICT_COLORS[d.kind] : "#9aa6cf", kind: d?.kind ?? "idle" },
    }, () => this.agenda, () => this.districts.map((q) => ({ label: q.label, share: q.weight, color: DISTRICT_COLORS[q.kind] })));
    this.interiorId = bi;
    this.shared.uCutId.value = bi;
    const b = dm?.bldg.find((q) => q.id === bi);
    if (b) {
      this.shared.uCutC.value.set(b.x, 0, b.z);
      // Kamera menyorot titik paling ramai di dalam, hampir mendatar untuk gedung tinggi (seperti rumah boneka).
      const hs = this.interior.hotspot();
      // Bidang potong lewat 4 m di depan titik yang disorot, supaya kegiatannya tidak ikut terpotong.
      this.shared.uCutC.value.set(hs.x, hs.y, hs.z);
      // Kamera berdiri di luar gedung: lebih jauh dari titik terjauh tapak.
      const fp = footprintOf(raw, bi);
      let ext = 0;
      for (let k = 0; k < fp.length; k += 2) ext = Math.max(ext, Math.hypot(fp[k] - hs.x, fp[k + 1] - hs.z));
      this.buildingDist = Math.max(raw.h > 22 ? 50 : 42, ext + 22);
      this.focusOn(hs.x, hs.z, this.buildingDist, raw.h > 22 ? 1.3 : 0.95, hs.y);
    }
    this.cb.onBuilding?.(this.interior.info());
  }

  /** Kamera menyorot satu lantai gedung yang sedang dibuka. */
  focusFloor(level: number) {
    if (!this.interior || !this.map) return;
    const s = this.interior.floorSpot(level);
    this.shared.uCutC.value.set(s.x, s.y, s.z);
    this.focusOn(s.x, s.z, this.buildingDist, 1.3, s.y);
  }

  closeBuilding() {
    if (!this.interior) return;
    this.interior.dispose();
    this.interior = null;
    this.interiorId = -1;
    this.shared.uCutId.value = -1;
    this.cb.onBuilding?.(null);
  }

  /** Mencatat kejadian sebagai agenda kota (tampil di layar balai kota, ruang rapat, dan panel gedung). */
  private remember(ev: LifeEvent) {
    const label = (id: string) => this.districts.find((d) => d.id === id)?.label ?? id;
    const amt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);
    let item: AgendaItem | null = null;
    const at = this.timer.getElapsed();
    switch (ev.type) {
      case "transfer": item = { kind: "transfer", text: `Rebalance ${label(ev.from)} → ${label(ev.to)} · ${amt(ev.amount)} AUSD`, at, district: ev.to }; break;
      case "propose": item = { kind: "propose", text: `Analyst proposes ${label(ev.from)} → ${label(ev.to)} · ${amt(ev.amount)} AUSD`, at, district: ev.to }; break;
      case "approve": item = { kind: "approve", text: "Mayor approves the Analyst's proposal", at }; break;
      case "alert": item = { kind: "alert", text: `Satpam evacuates ${label(ev.at)}`, at, district: ev.at }; break;
      case "harvest": item = { kind: "harvest", text: `Mayor collects ${ev.amount.toFixed(1)} AUSD in fees`, at }; break;
      case "festival": item = { kind: "festival", text: ev.label ?? `Mayor hosts an event at ${label(ev.at)}`, at, district: ev.at }; break;
      case "deposit": item = { kind: "deposit", text: `A resident deposits ${amt(ev.amount)} AUSD`, at }; break;
      case "withdraw": item = { kind: "withdraw", text: `A resident withdraws ${amt(ev.amount)} AUSD`, at }; break;
      case "agenda": item = { kind: ev.kind, text: ev.text, at }; break;
    }
    if (item) { this.agenda.push(item); if (this.agenda.length > 20) this.agenda.shift(); }
  }

  private onPointerMove = (ev: PointerEvent) => {
    if (ev.buttons) return;
    const id = this.pick(ev);
    if (id !== this.hovered) {
      this.hovered = id;
      this.canvas.style.cursor = id ? "pointer" : "grab";
      this.applyHighlight();
      this.cb.onHover?.(id);
    }
  };
  private onPointerDown = (ev: PointerEvent) => { this.pointerDown = { x: ev.clientX, y: ev.clientY }; };
  private onPointerUp = (ev: PointerEvent) => {
    const d = this.pointerDown;
    this.pointerDown = null;
    if (!d || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 5) return;
    // Kendaraan dan orang lebih dulu; bila tidak kena, pilih distrik.
    if (this.life) {
      const r = this.canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      const info = this.life.pickAgent(this.raycaster);
      this.cb.onInspect?.(info);
      if (info) return;
    }
    const district = this.pick(ev);
    this.cb.onSelect?.(district);
    if (this.pickedBuilding >= 0) this.openBuilding(this.pickedBuilding); else this.closeBuilding();
  };
  private onPointerLeave = () => {
    if (this.hovered !== null) { this.hovered = null; this.applyHighlight(); this.cb.onHover?.(null); }
  };

  // -------------------------------------------------------------------------------------------------------------
  // Loop
  // -------------------------------------------------------------------------------------------------------------

  private resize() {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
    this.rect = { w, h };
    this.renderer.setSize(w, h, false);
    if (this.composer) { this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); this.composer.setSize(w, h); }
    this.camera.aspect = w / h;
    this.shared.uPix.value = (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) / h;
    this.applyViewShift();
  }

  /** Menggeser pusat gambar ke kiri sebesar `px` supaya kota tidak tertutup panel di kanan. */
  setViewShift(px: number) {
    this.viewShift = px;
    this.applyViewShift();
  }

  private applyViewShift() {
    const { w, h } = this.rect;
    if (this.viewShift > 0 && w > 600) this.camera.setViewOffset(w, h, this.viewShift, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  private frame = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());

    if (this.intro > 0) {
      this.intro = Math.max(0, this.intro - dt / 1.6);
      const e = 1 - Math.pow(this.intro, 3);
      const t = this.controls.target;
      const d = this.frameDistance() + this.radius * (1 - e) * 1.1;
      const az = -0.62 - (1 - e) * 0.7;
      const pol = 0.93 + (1 - e) * 0.2;
      this.camera.position.set(t.x + d * Math.sin(pol) * Math.sin(az), d * Math.cos(pol), t.z + d * Math.sin(pol) * Math.cos(az));
      this.camera.lookAt(t);
    }
    if (this.focusAnim) {
      const f = this.focusAnim;
      f.t = Math.min(1, f.t + dt / 1.4);
      const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - Math.pow(-2 * f.t + 2, 3) / 2;
      this.controls.target.lerpVectors(f.from, f.to, e);
      const dir = f.fromDir.clone().lerp(f.toDir, e).normalize();
      this.camera.position.copy(this.controls.target).addScaledVector(dir, f.fromDist + (f.toDist - f.fromDist) * e);
      if (f.t >= 1) this.focusAnim = null;
    }
    // Pertumbuhan: tiap distrik naik ke targetnya; kota keseluruhan menggerakkan jalan, pohon, dan keramaian.
    for (const dm of this.districtMeshes) {
      dm.dev = approach(dm.dev, dm.target, dt);
      this.devState.set(dm.id, dm.dev);
      dm.uniforms.uBuild.value = dm.dev * (1 + RISE);
    }
    this.cityDev = approach(this.cityDev, this.cityTarget, dt);
    this.fabric?.setDevelopment(this.cityDev);
    this.life?.setDevelopment(this.cityDev);
    this.craneClock -= dt;
    if (this.craneClock <= 0) { this.craneClock = 0.3; this.updateCranes(); }
    this.construction?.update(this.timer.getElapsed());
    this.scenery?.update(this.timer.getElapsed(), this.camera);
    this.civic?.setDevelopment(this.cityDev);
    this.civic?.update(dt);
    this.clock.update(dt);
    this.applyTime(dt);
    this.controls.update();
    this.life?.update(dt, this.camera, this.rect);
    if (this.interior) {
      const cp = this.camera.position;
      const n = this.shared.uCutN.value.set(cp.x - this.shared.uCutC.value.x, 0, cp.z - this.shared.uCutC.value.z);
      if (n.lengthSq() > 1e-6) n.normalize();
      this.interior.update(dt, this.timer.getElapsed(), this.clock.hour, cp, 1 - this.clock.daylight, this.shared.uCutC.value);
      this.buildingClock -= dt;
      if (this.buildingClock <= 0) { this.buildingClock = 0.5; this.cb.onBuilding?.(this.interior.info()); }
    }
    this.tickClock -= dt;
    if (this.tickClock <= 0 && this.life) {
      this.tickClock = 0.5;
      this.lastStats = this.life.stats();
      this.cb.onTick?.({ time: this.clock.label, phase: this.rain > 0.5 ? `${this.clock.phase} · rain` : this.clock.phase, hour: this.clock.hour, stats: this.lastStats });
    }
    this.inspectClock -= dt;
    if (this.inspectClock <= 0 && this.life && this.cb.onInspect) {
      this.inspectClock = 0.3;
      const info = this.life.inspect();
      if (info) this.cb.onInspect(info);
    }
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    if (this.life) this.cb.onFloaters?.(this.interior ? [...this.life.floaters, ...this.interior.labels(this.camera, this.rect)] : this.life.floaters);

    if (this.cb.onLabels) {
      this.labelBuf.length = 0;
      for (const dm of this.districtMeshes) {
        this.tmp.copy(dm.center).project(this.camera);
        this.labelBuf.push({
          id: dm.id,
          x: (this.tmp.x * 0.5 + 0.5) * this.rect.w,
          y: (-this.tmp.y * 0.5 + 0.5) * this.rect.h,
          visible: this.tmp.z > -1 && this.tmp.z < 1,
        });
      }
      this.cb.onLabels(this.labelBuf);
    }
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.controls.dispose();
    this.clearGroup();
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
