import * as THREE from "three";
import type { CityMap } from "./geometry";
import { box, merge, part, toonRamp } from "./props";

/**
 * Penanda kota yang membuat gedung terasa dipakai: layar LED (videotron) di menara dekat alun-alun yang menayangkan
 * angka kota secara langsung, papan iklan di atap gedung menengah, dan gondola pembersih kaca di menara kaca.
 * Semua muncul hanya setelah gedungnya selesai dibangun.
 */

export interface Candidate { id: number; x: number; z: number; h: number }
export interface ScreenInfo { name: string; tvl: number; apy: number | null; time: string; phase: string; people: number; trips: number }

interface Face { cx: number; cz: number; nx: number; nz: number; len: number }

const ADS: { bg: string; fg: string; title: string; line: string }[] = [
  { bg: "#3f6bff", fg: "#ffffff", title: "NABUNG DI KOTAMU", line: "Panen hasil bareng tetangga" },
  { bg: "#f6c445", fg: "#2a2f55", title: "KOPI SENJA", line: "Ngopi dulu biar waras" },
  { bg: "#e8553d", fg: "#ffffff", title: "PASAR MALAM", line: "Tiap malam mulai 18.00" },
  { bg: "#10b3a3", fg: "#ffffff", title: "MARTABAK CAHAYA", line: "Manis, tebal, 24 jam" },
  { bg: "#7a5cff", fg: "#ffffff", title: "BUS KOTA N1", line: "Keliling kota tiap 4 menit" },
];

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export class Landmarks {
  private group = new THREE.Group();
  private screen: { mesh: THREE.Mesh; tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D; id: number; tick: number } | null = null;
  private boards: { obj: THREE.Object3D; id: number }[] = [];
  private gondolas: { obj: THREE.Group; cables: THREE.Mesh; id: number; h: number; ph: number }[] = [];
  private mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() });
  private key = "";

  constructor(private parent: THREE.Object3D, private map: CityMap) {
    parent.add(this.group);
  }

  /** Sisi gedung terpanjang yang menghadap arah kamera awal (supaya layar dan iklan terlihat). */
  private face(id: number, view: [number, number], minLen: number): Face | null {
    const p = this.map.buildings[id]?.p;
    if (!p) return null;
    const n = p.length / 2;
    let area2 = 0;
    for (let i = 0; i < n; i++) area2 += p[i * 2] * p[((i + 1) % n) * 2 + 1] - p[((i + 1) % n) * 2] * p[i * 2 + 1];
    const ccw = area2 > 0;
    let best: Face | null = null, score = 0;
    for (let i = 0; i < n; i++) {
      const ax = p[i * 2], az = p[i * 2 + 1], bx = p[((i + 1) % n) * 2], bz = p[((i + 1) % n) * 2 + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < minLen) continue;
      const nx = (ccw ? bz - az : az - bz) / len, nz = (ccw ? ax - bx : bx - ax) / len;
      const s = len * Math.max(0, nx * view[0] + nz * view[1]);
      if (s > score) { score = s; best = { cx: (ax + bx) / 2, cz: (az + bz) / 2, nx, nz, len }; }
    }
    return best;
  }

  setup(cands: Candidate[], plaza: { x: number; z: number }, view: [number, number]) {
    const key = `${cands.length}:${Math.round(plaza.x)}:${Math.round(plaza.z)}`;
    if (key === this.key || typeof document === "undefined") return;
    this.key = key;
    this.clear();
    const used = new Set<number>();

    // Layar LED di menara tertinggi dekat alun-alun.
    const near = cands.filter((c) => c.h >= 45 && Math.hypot(c.x - plaza.x, c.z - plaza.z) < 320).sort((a, b) => b.h - a.h);
    const tower = near[0] ?? [...cands].filter((c) => c.h >= 30).sort((a, b) => b.h - a.h)[0];
    if (tower) {
      const f = this.face(tower.id, view, 14);
      if (f) {
        const w = Math.min(f.len * 0.72, 34), hgt = w * 0.5;
        const cvs = makeCanvas(512, 256);
        const tex = new THREE.CanvasTexture(cvs);
        tex.colorSpace = THREE.SRGBColorSpace;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
        mesh.position.set(f.cx + f.nx * 0.7, Math.min(tower.h * 0.62, tower.h - hgt / 2 - 4), f.cz + f.nz * 0.7);
        mesh.rotation.y = Math.atan2(f.nx, f.nz);
        const frame = new THREE.Mesh(merge([part(box(w + 1.2, hgt + 1.2, 0.5), 0x252a45)]), this.mat);
        frame.position.copy(mesh.position).addScaledVector(new THREE.Vector3(f.nx, 0, f.nz), -0.3);
        frame.rotation.y = mesh.rotation.y;
        const g = new THREE.Group();
        g.add(frame, mesh);
        g.visible = false;
        this.group.add(g);
        this.screen = { mesh, tex, ctx: cvs.getContext("2d")!, id: tower.id, tick: 0 };
        used.add(tower.id);
      }
    }

    // Papan iklan di atap gedung menengah yang menghadap kamera.
    const mids = cands.filter((c) => c.h >= 14 && c.h <= 45 && !used.has(c.id)).sort((a, b) => Math.hypot(a.x - plaza.x, a.z - plaza.z) - Math.hypot(b.x - plaza.x, b.z - plaza.z));
    for (const c of mids) {
      if (this.boards.length >= 5) break;
      if (this.boards.some((b) => Math.hypot(b.obj.position.x - c.x, b.obj.position.z - c.z) < 90)) continue;
      const f = this.face(c.id, view, 10);
      if (!f) continue;
      const ad = ADS[this.boards.length % ADS.length];
      const cvs = makeCanvas(256, 128);
      const ctx = cvs.getContext("2d")!;
      ctx.fillStyle = ad.bg;
      ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = ad.fg;
      ctx.font = "bold 30px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ad.title, 128, 58);
      ctx.font = "18px system-ui, sans-serif";
      ctx.fillText(ad.line, 128, 92);
      const tex = new THREE.CanvasTexture(cvs);
      tex.colorSpace = THREE.SRGBColorSpace;
      const g = new THREE.Group();
      g.position.set(c.x + f.nx * 2, c.h, c.z + f.nz * 2);
      g.rotation.y = Math.atan2(f.nx, f.nz);
      g.add(new THREE.Mesh(merge([part(box(0.3, 4.2, 0.3), 0x39456f, -3.2, 2.1, 0), part(box(0.3, 4.2, 0.3), 0x39456f, 3.2, 2.1, 0), part(box(9.2, 4.8, 0.3), 0x252a45, 0, 5.6, -0.2)]), this.mat));
      const board = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 4.4), new THREE.MeshBasicMaterial({ map: tex }));
      board.position.set(0, 5.6, 0);
      g.add(board);
      g.visible = false;
      this.group.add(g);
      this.boards.push({ obj: g, id: c.id });
      used.add(c.id);
    }

    // Gondola pembersih kaca di menara kaca yang tinggi.
    const tall = cands.filter((c) => c.h >= 70 && !used.has(c.id)).sort((a, b) => b.h - a.h).slice(0, 2);
    tall.forEach((c, i) => {
      const f = this.face(c.id, view, 12);
      if (!f) return;
      const g = new THREE.Group();
      const yaw = Math.atan2(f.nx, f.nz);
      g.rotation.y = yaw;
      g.position.set(f.cx + f.nx * 1.1, 0, f.cz + f.nz * 1.1);
      const plat = new THREE.Mesh(merge([
        part(box(6, 0.4, 1.2), 0xdfe4f5, 0, 0, 0),
        part(box(6, 0.9, 0.08), 0xf59e0b, 0, 0.6, 0.6),
        part(box(0.42, 0.72, 0.5), 0x2f6fe0, -1.5, 0.6, 0),
        part(box(0.4, 0.4, 0.4), 0xffd166, -1.5, 1.2, 0),
        part(box(0.42, 0.72, 0.5), 0x2f6fe0, 1.5, 0.6, 0),
        part(box(0.4, 0.4, 0.4), 0xffd166, 1.5, 1.2, 0),
      ]), this.mat);
      const cables = new THREE.Mesh(merge([part(box(0.06, 1, 0.06), 0x252a45, -2.8, 0.5, 0), part(box(0.06, 1, 0.06), 0x252a45, 2.8, 0.5, 0)]), this.mat);
      g.add(plat, cables);
      g.visible = false;
      this.group.add(g);
      this.gondolas.push({ obj: g, cables, id: c.id, h: c.h, ph: i * 2.1 });
    });
  }

  /** `built(id)` 0..1: seberapa jauh gedung sudah berdiri. */
  update(t: number, built: (id: number) => number, info: ScreenInfo | null, night: number) {
    if (this.screen) {
      const s = this.screen;
      const on = built(s.id) > 0.98;
      s.mesh.parent!.visible = on;
      if (on && info && t >= s.tick) { s.tick = t + 1.2; this.draw(s.ctx, info, t, night); s.tex.needsUpdate = true; }
    }
    for (const b of this.boards) b.obj.visible = built(b.id) > 0.98;
    for (const g of this.gondolas) {
      const on = built(g.id) > 0.98;
      g.obj.visible = on;
      if (!on) continue;
      const top = g.h - 2;
      const y = 6 + (top - 10) * (0.5 + 0.5 * Math.sin(t * 0.025 + g.ph));
      g.obj.children[0].position.y = y;
      g.cables.position.y = y;
      g.cables.scale.y = Math.max(0.1, top - y);
    }
  }

  private draw(ctx: CanvasRenderingContext2D, info: ScreenInfo, t: number, night: number) {
    const W = 512, H = 256;
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#101a3d");
    grad.addColorStop(1, "#28307a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#3f6bff";
    ctx.fillRect(0, 0, W, 6);
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.fillText(info.name.slice(0, 24), 22, 50);
    ctx.fillStyle = "#ff5b5b";
    ctx.beginPath();
    ctx.arc(W - 70, 40, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.fillText("LIVE", W - 58, 47);
    ctx.font = "bold 58px system-ui, sans-serif";
    ctx.fillStyle = "#d8f59a";
    ctx.fillText(`${Math.round(info.tvl).toLocaleString("en-US")} AUSD`, 22, 126);
    ctx.font = "22px system-ui, sans-serif";
    ctx.fillStyle = "#cfd8ff";
    ctx.fillText(`Yield ${info.apy === null ? "—" : (info.apy / 100).toFixed(2) + "% APY"}  ·  ${info.people} people out  ·  ${info.trips} trips today`, 22, 170);
    // Teks berjalan.
    const msgs = ["Bus N1 every few minutes", "Night market opens 18:00", "Your city, your savings", "Simulated yield on testnet", `${info.phase} · ${info.time}`];
    const msg = msgs[Math.floor(t / 4) % msgs.length];
    ctx.fillStyle = night > 0.5 ? "#f6c445" : "#ffffff";
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.fillText(msg, 22, 226);
  }

  private clear() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.MeshBasicMaterial | undefined;
      if (mat && mat !== (this.mat as unknown)) { mat.map?.dispose(); mat.dispose(); }
    });
    this.group.clear();
    this.screen = null;
    this.boards = [];
    this.gondolas = [];
  }

  dispose() {
    this.clear();
    this.mat.dispose();
    this.parent.remove(this.group);
  }
}
