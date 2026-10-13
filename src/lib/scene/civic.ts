import * as THREE from "three";
import { hash01, type CityMap } from "./geometry";
import type { LifeEvent } from "./life";
import { box, merge, part, toonRamp } from "./props";
import { THEMES, WORKS, unlockAllWorks, type CityStyle, type Theme, type WorkId } from "./themes";

/**
 * Karya sipil: hal-hal yang dipilih walikota untuk mempercantik kotanya (air mancur, bunga, bendera, pasar, monumen,
 * kembang api, bianglala). Hanya tampilan. Tiap karya terbuka bertahap menurut perkembangan kota dan muncul dengan
 * animasi tumbuh. Tempatnya dipilih dari taman yang ditemukan penata kota, jadi cocok dengan peta apa pun.
 */

export interface CivicSpot { x: number; z: number; r: number; cells: { x: number; z: number }[] }
export interface CivicAnchors {
  plaza: { x: number; z: number };
  /** Atap balai kota, tempat bendera kota berdiri. */
  hall: { x: number; z: number; h: number } | null;
  spots: CivicSpot[];
  /** Apakah titik ini bebas dari bangunan dan jalan (untuk tiang bendera). */
  free: (x: number, z: number, margin: number) => boolean;
}

interface Entry {
  obj: THREE.Object3D;
  /** Pusat animasi tumbuh: karya diskalakan di sekitar titik ini. */
  anim?: (t: number) => void;
  /** Skala sumbu: tumbuh ke atas saja (bunga) atau merata. */
  mode: "uniform" | "up";
  grow: number;
}

const WOOD = 0xb07a4a, STONE = 0xd7d3c8, STONE_DARK = 0xb9b4a8, GOLD = 0xe0b441, WATER = 0x6ec3df;

export class CityCivic {
  private group = new THREE.Group();
  private mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() });
  private entries = new Map<WorkId, Entry>();
  private style: CityStyle = { theme: "classic", works: [] };
  private dev = 0;
  private t = 0;
  private fireworksAt = Infinity;
  private anchors: CivicAnchors | null = null;

  constructor(private parent: THREE.Object3D, private map: CityMap, private emit: (e: LifeEvent) => void) {
    parent.add(this.group);
  }

  setAnchors(a: CivicAnchors) {
    this.anchors = a;
    this.rebuild();
  }

  setStyle(style: CityStyle) {
    this.style = style;
    this.rebuild();
  }

  setDevelopment(d: number) { this.dev = d; }

  private theme(): Theme { return THEMES[this.style.theme] ?? THEMES.classic; }

  private clear() {
    for (const e of this.entries.values()) {
      this.group.remove(e.obj);
      e.obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | undefined;
        if (mat && mat !== this.mat) mat.dispose();
      });
    }
    this.entries.clear();
  }

  private rebuild() {
    this.clear();
    const a = this.anchors;
    if (!a) return;
    const th = this.theme();
    const used = new Map<CivicSpot, number>();
    const byPlaza = [...a.spots].filter((s) => s.r >= 4).sort((p, q) => Math.hypot(p.x - a.plaza.x, p.z - a.plaza.z) - Math.hypot(q.x - a.plaza.x, q.z - a.plaza.z));
    const biggest = [...a.spots].sort((p, q) => q.r - p.r)[0];
    /** Tempat dalam daftar, dengan geseran bila taman yang sama dipakai dua karya. */
    const spotAt = (i: number, list = byPlaza): { x: number; z: number; r: number } | null => {
      const s = list[Math.min(i, list.length - 1)];
      if (!s) return null;
      const n = used.get(s) ?? 0;
      used.set(s, n + 1);
      const ang = n * 2.1 + 0.6;
      return { x: s.x + Math.cos(ang) * n * 12, z: s.z + Math.sin(ang) * n * 12, r: s.r };
    };

    for (const id of this.style.works) {
      let e: Entry | null = null;
      switch (id) {
        case "banner": if (a.hall) e = this.banner(a.hall, th); break;
        case "fountain": { const s = spotAt(0); e = s ? this.fountain(s, th) : this.fountain({ x: a.plaza.x + 14, z: a.plaza.z + 14, r: 6 }, th); break; }
        case "flowers": e = this.flowers(a.spots, th); break;
        case "bunting": e = this.bunting(a, th); break;
        case "market": { const s = spotAt(1); if (s) e = this.market(s, th); break; }
        case "statue": { const s = spotAt(2); if (s) e = this.statue(s); break; }
        case "ferris": { const s = biggest ? spotAt(0, [biggest]) : null; if (s) e = this.ferris(s, th); break; }
        case "fireworks": break;
      }
      if (e) { e.obj.visible = false; this.group.add(e.obj); this.entries.set(id, e); }
    }
  }

  // -------------------------------------------------------------------------------------------------------------
  // Karya
  // -------------------------------------------------------------------------------------------------------------

  private mesh(parts: THREE.BufferGeometry[], cast = true): THREE.Mesh {
    const m = new THREE.Mesh(merge(parts), this.mat);
    m.castShadow = cast;
    return m;
  }

  private anchored(x: number, z: number, y = 0): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    return g;
  }

  private banner(hall: { x: number; z: number; h: number }, th: Theme): Entry {
    const g = this.anchored(hall.x, hall.z, hall.h);
    g.add(this.mesh([
      part(box(0.28, 10, 0.28), 0xdfe4f5, 0, 5, 0),
      part(new THREE.SphereGeometry(0.4, 8, 6), GOLD, 0, 10.2, 0),
    ]));
    const flag = this.mesh([
      part(box(5.2, 1.5, 0.12), new THREE.Color(th.flag[0]).getHex(), 2.7, 8.5, 0),
      part(box(5.2, 1.0, 0.12), new THREE.Color(th.flag[1] ?? "#ffffff").getHex(), 2.7, 7.25, 0),
      part(box(5.2, 0.8, 0.12), new THREE.Color(th.flag[2] ?? th.flag[0]).getHex(), 2.7, 6.35, 0),
    ]);
    g.add(flag);
    return { obj: g, mode: "uniform", grow: 0, anim: (t) => { flag.rotation.y = Math.sin(t * 2.2) * 0.18; } };
  }

  private fountain(s: { x: number; z: number; r: number }, th: Theme): Entry {
    const g = this.anchored(s.x, s.z);
    const rim = Math.min(4.4, Math.max(2.6, s.r * 0.5));
    const parts: THREE.BufferGeometry[] = [
      part(new THREE.CylinderGeometry(rim * 2.1, rim * 2.2, 0.16, 36), 0xece9e0, 0, 0.12, 0),
      part(new THREE.CylinderGeometry(rim, rim * 1.06, 0.95, 28), STONE, 0, 0.55, 0),
      part(new THREE.CylinderGeometry(rim * 0.88, rim * 0.88, 0.1, 28), WATER, 0, 1.0, 0),
      part(new THREE.CylinderGeometry(0.55, 0.8, 2.6, 12), STONE_DARK, 0, 1.9, 0),
      part(new THREE.CylinderGeometry(1.7, 1.0, 0.45, 18), STONE, 0, 3.3, 0),
    ];
    // Empat bangku mengelilingi air mancur.
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4, rr = rim * 1.75;
      parts.push(
        part(box(2.4, 0.32, 0.8).rotateY(-ang + Math.PI / 2), WOOD, Math.cos(ang) * rr, 0.55, Math.sin(ang) * rr),
        part(box(0.3, 0.45, 0.7).rotateY(-ang + Math.PI / 2), 0x6b7597, Math.cos(ang) * rr, 0.25, Math.sin(ang) * rr),
      );
    }
    g.add(this.mesh(parts));
    // Pancuran: titik air dalam lintasan parabola, dan riak di permukaan.
    const N = 56;
    const pos = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const spray = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xdff6ff, size: 2.3, transparent: true, opacity: 0.95, depthWrite: false }));
    spray.frustumCulled = false;
    g.add(spray);
    const ripple = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.y = 1.08;
    g.add(ripple);
    void th;
    const anim = (t: number) => {
      for (let i = 0; i < N; i++) {
        const ph = (t * 0.8 + i / N) % 1;
        const ang = (i * 2.399) % (Math.PI * 2);
        const rad = 3.6 * ph * (0.6 + 0.4 * ((i * 7) % 5) / 5);
        pos[i * 3] = Math.cos(ang) * rad;
        pos[i * 3 + 1] = 3.6 + 7.2 * ph - 9.6 * ph * ph;
        pos[i * 3 + 2] = Math.sin(ang) * rad;
      }
      geo.attributes.position.needsUpdate = true;
      const k = (t * 0.7) % 1;
      ripple.scale.setScalar(rim * (0.3 + 0.55 * k));
      (ripple.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - k);
    };
    return { obj: g, mode: "uniform", grow: 0, anim };
  }

  private flowers(spots: CivicSpot[], th: Theme): Entry | null {
    const blooms: { x: number; z: number; s: number; c: THREE.Color }[] = [];
    let n = 0;
    for (const sp of spots) {
      for (const c of sp.cells) {
        n++;
        if (hash01(c.x * 1.3 + c.z * 0.7) > 0.55) continue;
        const colorA = new THREE.Color(th.flowers[Math.floor(hash01(n * 3.1) * th.flowers.length)]);
        for (let k = 0; k < 7; k++) {
          blooms.push({ x: c.x + (hash01(n * 5 + k) - 0.5) * 6.4, z: c.z + (hash01(n * 9 + k * 2) - 0.5) * 6.4, s: 0.2 + hash01(n + k * 4) * 0.14, c: k % 3 === 0 ? new THREE.Color(th.flowers[(n + k) % th.flowers.length]) : colorA });
        }
        if (blooms.length > 1400) break;
      }
      if (blooms.length > 1400) break;
    }
    if (!blooms.length) return null;
    const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshToonMaterial({ gradientMap: toonRamp() }), blooms.length);
    const d = new THREE.Object3D();
    blooms.forEach((b, i) => {
      d.position.set(b.x, 0.3 + b.s, b.z);
      d.scale.setScalar(b.s);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, b.c);
    });
    mesh.frustumCulled = false;
    const g = new THREE.Group();
    g.add(mesh);
    return { obj: g, mode: "up", grow: 0 };
  }

  private bunting(a: CivicAnchors, th: Theme): Entry | null {
    // Jalan terdekat dari alun-alun yang cukup lebar; tiang berjajar di kedua sisinya.
    let best: { p: number[]; w: number; d: number } | null = null;
    for (const r of this.map.roads) {
      if (r.f || r.w < 7) continue;
      for (let i = 0; i < r.p.length; i += 2) {
        const d = Math.hypot(r.p[i] - a.plaza.x, r.p[i + 1] - a.plaza.z);
        if (!best || d < best.d) best = { p: r.p, w: r.w, d };
      }
    }
    if (!best) return null;
    const flags = th.flag.map((c) => new THREE.Color(c).getHex());
    const parts: THREE.BufferGeometry[] = [];
    let count = 0, acc = 0, next = 6;
    const { p, w } = best;
    for (let i = 1; i < p.length / 2 && count < 14; i++) {
      const ax = p[i * 2 - 2], az = p[i * 2 - 1], len = Math.hypot(p[i * 2] - ax, p[i * 2 + 1] - az);
      if (len < 0.1) continue;
      const dx = (p[i * 2] - ax) / len, dz = (p[i * 2 + 1] - az) / len;
      while (next <= acc + len && count < 14) {
        const tt = next - acc, cx = ax + dx * tt, cz = az + dz * tt;
        const side = count % 2 === 0 ? 1 : -1;
        const px = cx + dz * (w / 2 + 2.6) * side, pz = cz - dx * (w / 2 + 2.6) * side;
        if (Math.hypot(px - a.plaza.x, pz - a.plaza.z) < 150 && a.free(px, pz, 1.2)) {
          const ang = Math.atan2(-dz, dx);
          parts.push(part(box(0.24, 8, 0.24), 0xdfe4f5, px, 4, pz));
          for (let k = 0; k < 3; k++) parts.push(part(box(0.1, 1.3, 1.5).rotateY(ang), flags[(count + k) % flags.length], px - dz * side * 0.9 * 0 + dx * 0.0, 7.3 - k * 1.5, pz));
          count++;
        }
        next += 15;
      }
      acc += len;
    }
    if (!parts.length) return null;
    const g = new THREE.Group();
    g.add(this.mesh(parts, false));
    return { obj: g, mode: "uniform", grow: 0 };
  }

  private market(s: { x: number; z: number; r: number }, th: Theme): Entry {
    const g = this.anchored(s.x, s.z);
    g.rotation.y = hash01(s.x * 0.3 + s.z) * Math.PI;
    const parts: THREE.BufferGeometry[] = [];
    const stalls = 5;
    for (let i = 0; i < stalls; i++) {
      const x = (i - (stalls - 1) / 2) * 4.4;
      const awn = new THREE.Color(th.awning[i % th.awning.length]).getHex();
      parts.push(
        part(box(3.4, 1.15, 1.9), WOOD, x, 0.58, 0),
        part(box(0.18, 3.3, 0.18), 0xdfe4f5, x - 1.6, 1.65, -0.85), part(box(0.18, 3.3, 0.18), 0xdfe4f5, x + 1.6, 1.65, -0.85),
        part(box(3.8, 0.22, 2.6).rotateX(0.18), awn, x, 3.3, 0.15),
        part(box(0.9, 0.7, 0.9), 0xc99a5b, x - 0.9, 1.5, 0.1), part(box(0.8, 0.5, 0.8), new THREE.Color(th.flowers[i % th.flowers.length]).getHex(), x + 0.6, 1.4, 0.2),
      );
    }
    g.add(this.mesh(parts));
    return { obj: g, mode: "uniform", grow: 0 };
  }

  private statue(s: { x: number; z: number; r: number }): Entry {
    const g = this.anchored(s.x, s.z);
    g.add(this.mesh([
      part(box(8, 0.4, 8), 0xece9e0, 0, 0.2, 0),
      part(box(6, 0.5, 6), STONE, 0, 0.65, 0),
      part(box(3.6, 2.4, 3.6), STONE_DARK, 0, 2.1, 0),
      part(box(1.3, 4.6, 1.3), GOLD, 0, 5.6, 0),
      part(box(2.0, 2.0, 2.0).rotateY(Math.PI / 4).rotateZ(Math.PI / 4), GOLD, 0, 9.4, 0),
    ]));
    const gem = g.children[0];
    return { obj: g, mode: "uniform", grow: 0, anim: (t) => { gem.rotation.y = Math.sin(t * 0.6) * 0.08; } };
  }

  private ferris(s: { x: number; z: number; r: number }, th: Theme): Entry {
    const R = 21, hubY = 26;
    const g = this.anchored(s.x, s.z);
    g.rotation.y = 0.55;
    // Kaki penyangga berbentuk A.
    const legs: THREE.BufferGeometry[] = [part(box(7, 0.6, 7), 0xdfe4f5, 0, 0.3, 0)];
    for (const side of [-1, 1]) {
      for (const lean of [-1, 1]) {
        legs.push(part(box(0.9, hubY * 1.02, 0.9).rotateX(lean * 0.2), 0xf6f8ff, 0, hubY / 2, side * 3 + lean * 2.4));
      }
    }
    g.add(this.mesh(legs));
    // Roda: pelek, jari-jari, dan gondola yang selalu tegak.
    const wheel = new THREE.Group();
    wheel.position.set(0, hubY, 0);
    const rim: THREE.BufferGeometry[] = [part(box(1.6, 1.6, 8), 0xffffff, 0, 0, 0)];
    const seg = 20;
    for (const z of [-3, 3]) {
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
        const mx = ((Math.cos(a0) + Math.cos(a1)) / 2) * R, my = ((Math.sin(a0) + Math.sin(a1)) / 2) * R;
        rim.push(part(box(Math.hypot(R * (Math.cos(a1) - Math.cos(a0)), R * (Math.sin(a1) - Math.sin(a0))) + 0.3, 0.5, 0.5).rotateZ((a0 + a1) / 2 + Math.PI / 2), 0xf6c445, mx, my, z));
      }
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        rim.push(part(box(R, 0.28, 0.28).translate(R / 2, 0, 0).rotateZ(a), 0xf8f9ff, 0, 0, z));
      }
    }
    wheel.add(this.mesh(rim));
    const cars: THREE.Mesh[] = [];
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const car = this.mesh([part(box(3, 2.2, 2.6), new THREE.Color(th.awning[i % th.awning.length]).getHex(), 0, -1.5, 0), part(box(3.2, 0.3, 2.8), 0xffffff, 0, -0.2, 0)]);
      car.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      wheel.add(car);
      cars.push(car);
    }
    g.add(wheel);
    return {
      obj: g, mode: "uniform", grow: 0,
      anim: (t) => {
        wheel.rotation.z = t * 0.07;
        for (const c of cars) c.rotation.z = -wheel.rotation.z;
      },
    };
  }

  // -------------------------------------------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------------------------------------------

  update(dt: number) {
    this.t += dt;
    for (const [id, e] of this.entries) {
      const info = WORKS.find((w) => w.id === id);
      const on = !!info && (this.dev >= info.unlockAt || unlockAllWorks());
      e.grow += ((on ? 1 : 0) - e.grow) * Math.min(1, dt * 2.5);
      if (Math.abs((on ? 1 : 0) - e.grow) < 0.004) e.grow = on ? 1 : 0;
      e.obj.visible = e.grow > 0.01;
      if (!e.obj.visible) continue;
      const s = Math.max(0.001, e.grow * (2 - e.grow));
      if (e.mode === "up") e.obj.scale.set(1, s, 1); else e.obj.scale.setScalar(s);
      e.anim?.(this.t);
    }
    // Kembang api: bila dipilih dan sudah terbuka, tiap sekitar setengah menit.
    const fw = WORKS.find((w) => w.id === "fireworks");
    if (this.style.works.includes("fireworks") && fw && (this.dev >= fw.unlockAt || unlockAllWorks())) {
      if (this.fireworksAt === Infinity) this.fireworksAt = this.t + 4;
      if (this.t >= this.fireworksAt) { this.fireworksAt = this.t + 26 + hash01(this.t) * 8; this.emit({ type: "fireworks" }); }
    } else this.fireworksAt = Infinity;
  }

  dispose() {
    this.clear();
    this.mat.dispose();
    this.parent.remove(this.group);
  }
}
