import * as THREE from "three";
import type { DistrictKind } from "../types";
import { box, merge, part, toonRamp } from "./props";

/**
 * Landmark per layanan protokol (TC67): tiap distrik layanan mendapat satu bangunan khas menurut jenisnya (bank,
 * brankas, menara staking, pasar) di tempat kosong dekat pusat distrik. Ukurannya tumbuh bersama dana distrik, jadi
 * layanan yang makin dipakai makin megah. Hanya tampilan; bentuknya prosedural dan tidak meniru logo protokol.
 */

export interface ServiceAnchor { id: string; kind: DistrictKind; color: string; x: number; z: number }
interface Item { obj: THREE.Group; grow: number; anim?: (t: number) => void }

/** Landmark digambar kecil (satuan meter) lalu diperbesar supaya terbaca di antara gedung pencakar langit. */
const LANDMARK_SCALE = 1.9;
const CREAM = 0xf1ece0, STONE = 0xd7d3c8, DARK = 0x6b7597, GOLD = 0xe0b441, STEEL = 0xc9d2e8;

export class ServiceLandmarks {
  private group = new THREE.Group();
  private mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() });
  private items = new Map<string, Item>();
  private t = 0;
  private key = "";

  constructor(private parent: THREE.Object3D) { parent.add(this.group); }

  private mesh(parts: THREE.BufferGeometry[]): THREE.Mesh {
    const m = new THREE.Mesh(merge(parts), this.mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  private clear() {
    for (const it of this.items.values()) {
      this.group.remove(it.obj);
      it.obj.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    }
    this.items.clear();
  }

  /** Dipanggil saat distrik berubah; `free` memeriksa apakah suatu titik kosong (bukan bangunan atau jalan). */
  setAnchors(list: ServiceAnchor[], free: (x: number, z: number, margin: number) => boolean) {
    // Distrik dibangun ulang tiap pembacaan data; landmark hanya disusun ulang bila daftar layanannya berubah.
    const key = list.filter((q) => q.kind !== "idle").map((q) => `${q.id}:${q.kind}`).join("|");
    if (key === this.key && this.items.size > 0) return;
    this.key = key;
    this.clear();
    // Distrik menyebar sampai tepi kota; landmark ditaruh di antara alun-alun dan pusat distrik supaya tetap terlihat.
    const plaza = list.find((q) => q.kind === "idle");
    for (const a of list) {
      if (a.kind === "idle") continue;
      const bx = plaza ? plaza.x + (a.x - plaza.x) * 0.4 : a.x, bz = plaza ? plaza.z + (a.z - plaza.z) * 0.4 : a.z;
      const spot = this.findSpot(bx, bz, free);
      if (!spot) continue;
      const color = new THREE.Color(a.color).getHex();
      const built = a.kind === "lending" ? this.bank(color) : a.kind === "vault" ? this.vault(color) : a.kind === "staking" ? this.tower(color) : a.kind === "market" ? this.market(color) : this.arena(color);
      const g = new THREE.Group();
      g.position.set(spot.x, 0, spot.z);
      g.rotation.y = Math.atan2(-spot.x, -spot.z) * 0.15;
      g.add(built.obj);
      // Sorot cahaya setinggi menara dengan warna layanan, supaya letak tiap layanan terbaca dari jauh.
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 1.4, 34, 12, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      );
      beam.position.y = 17;
      g.add(beam);
      g.scale.setScalar(0.001);
      g.visible = false;
      this.group.add(g);
      this.items.set(a.id, { obj: g, grow: 0, anim: built.anim });
    }
  }

  private findSpot(cx: number, cz: number, free: (x: number, z: number, margin: number) => boolean): { x: number; z: number } | null {
    for (let r = 0; r <= 66; r += 6) {
      const n = r === 0 ? 1 : Math.round(r / 3);
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + r * 0.31;
        const x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
        if (free(x, z, 12)) return { x, z };
      }
    }
    return null;
  }

  /** `dev` dari distrik (0..1): muncul setelah sedikit dana, lalu tumbuh. */
  update(dt: number, devOf: (id: string) => number) {
    this.t += dt;
    for (const [id, it] of this.items) {
      const dev = devOf(id);
      const want = Math.max(0, Math.min(1, (dev - 0.012) / 0.3));
      const target = dev > 0.012 ? 0.6 + 0.4 * want : 0;
      it.grow += (target - it.grow) * Math.min(1, dt * 2.2);
      if (Math.abs(target - it.grow) < 0.003) it.grow = target;
      it.obj.visible = it.grow > 0.02;
      if (!it.obj.visible) continue;
      const s = Math.max(0.001, it.grow * (2 - it.grow)) * LANDMARK_SCALE;
      it.obj.scale.setScalar(s);
      it.anim?.(this.t);
    }
  }

  dispose() { this.clear(); this.parent.remove(this.group); }

  // --- Bank: gedung berpilar dengan koin emas di atap ---------------------------------------------------------
  private bank(color: number) {
    const g = new THREE.Group();
    const parts: THREE.BufferGeometry[] = [
      part(box(10, 0.5, 8), STONE, 0, 0.25, 0),
      part(box(8.6, 4.4, 6.4), CREAM, 0, 2.7, -0.4),
      part(box(10.4, 0.7, 7.6), color, 0, 5.2, 0),
      part(box(7.4, 0.6, 5.6), CREAM, 0, 5.85, 0),
      part(box(8.4, 0.3, 1.6), STONE, 0, 0.65, 4.6),
    ];
    for (let i = 0; i < 5; i++) parts.push(part(new THREE.CylinderGeometry(0.42, 0.46, 4.2, 10), 0xffffff, -3.6 + i * 1.8, 2.7, 3.2));
    g.add(this.mesh(parts));
    const coin = this.mesh([part(new THREE.CylinderGeometry(1.3, 1.3, 0.34, 20).rotateZ(Math.PI / 2), GOLD, 0, 0, 0), part(new THREE.CylinderGeometry(0.85, 0.85, 0.4, 16).rotateZ(Math.PI / 2), 0xf3d46a, 0, 0, 0)]);
    coin.position.set(0, 8.1, 0);
    g.add(coin);
    return { obj: g, anim: (t: number) => { coin.rotation.y = t * 1.4; coin.position.y = 8.1 + Math.sin(t * 2) * 0.18; } };
  }

  // --- Brankas: tabung baja dengan pintu bundar ---------------------------------------------------------------
  private vault(color: number) {
    const g = new THREE.Group();
    g.add(this.mesh([
      part(new THREE.CylinderGeometry(5, 5.3, 0.5, 28), STONE, 0, 0.25, 0),
      part(new THREE.CylinderGeometry(4.2, 4.2, 4.6, 28), STEEL, 0, 2.8, 0),
      part(new THREE.CylinderGeometry(4.5, 4.2, 0.5, 28), color, 0, 5.3, 0),
      part(new THREE.SphereGeometry(3.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), STEEL, 0, 5.5, 0),
    ]));
    const door = this.mesh([
      part(new THREE.CylinderGeometry(2.3, 2.3, 0.5, 24).rotateX(Math.PI / 2), DARK, 0, 0, 0),
      part(new THREE.CylinderGeometry(1.8, 1.8, 0.6, 24).rotateX(Math.PI / 2), color, 0, 0, 0.08),
      part(box(3.4, 0.28, 0.7), GOLD, 0, 0, 0.3),
      part(box(0.28, 3.4, 0.7), GOLD, 0, 0, 0.3),
    ]);
    door.position.set(0, 2.8, 4.25);
    g.add(door);
    return { obj: g, anim: (t: number) => { door.rotation.z = Math.sin(t * 0.6) * 0.35; } };
  }

  // --- Menara staking: menara tinggi dengan cincin bercahaya --------------------------------------------------
  private tower(color: number) {
    const g = new THREE.Group();
    g.add(this.mesh([
      part(new THREE.CylinderGeometry(3.2, 3.6, 1.2, 8), STONE, 0, 0.6, 0),
      part(new THREE.CylinderGeometry(1.7, 2.3, 12, 8), 0xffffff, 0, 7.2, 0),
      part(new THREE.CylinderGeometry(2.4, 1.7, 1.2, 8), color, 0, 13.6, 0),
      part(new THREE.ConeGeometry(1.5, 4.2, 8), color, 0, 16.3, 0),
      part(new THREE.SphereGeometry(0.45, 8, 6), GOLD, 0, 18.7, 0),
    ]));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.2, 8, 36), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 9;
    g.add(ring);
    return { obj: g, anim: (t: number) => { ring.position.y = 6.5 + ((t * 0.5) % 1) * 7; (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 - ((t * 0.5) % 1) * 0.7; } };
  }

  // --- Pasar: paviliun dengan atap belang dan peti ------------------------------------------------------------
  private market(color: number) {
    const g = new THREE.Group();
    const parts: THREE.BufferGeometry[] = [part(box(11, 0.3, 8), STONE, 0, 0.15, 0)];
    for (const [x, z] of [[-4.6, -3], [4.6, -3], [-4.6, 3], [4.6, 3]]) parts.push(part(box(0.5, 4.4, 0.5), 0xb07a4a, x, 2.5, z));
    for (let i = 0; i < 8; i++) parts.push(part(box(11.4 / 8, 0.35, 8.8), i % 2 ? 0xffffff : color, -5.1 + i * (11.4 / 8) + 0.7, 4.9 + 0.04 * (i % 2), 0));
    parts.push(
      part(box(7, 1, 1.6), 0xb07a4a, 0, 0.8, -1.2), part(box(1.1, 1.1, 1.1), 0xe0a85a, -2.4, 1.75, -1.2),
      part(box(1.1, 0.9, 1.1), 0x9ad28a, 0.2, 1.65, -1.2), part(box(1.1, 1.3, 1.1), 0xf29a9a, 2.6, 1.85, -1.2),
      part(box(2.4, 0.9, 1.4), 0xb07a4a, 3, 0.65, 2.1), part(box(2.4, 0.9, 1.4), 0xb07a4a, -3, 0.65, 2.1),
    );
    const body = this.mesh(parts);
    g.add(body);
    const flag = this.mesh([part(box(0.12, 2.2, 0.12), 0xdfe4f5, 0, 1.1, 0), part(box(1.6, 0.9, 0.1), color, 0.85, 1.9, 0)]);
    flag.position.set(5.2, 5.2, -3.6);
    g.add(flag);
    return { obj: g, anim: (t: number) => { flag.rotation.y = Math.sin(t * 2.4) * 0.25; } };
  }

  // --- Arena (belum ada sumber data; bentuk disiapkan) --------------------------------------------------------
  private arena(color: number) {
    const g = new THREE.Group();
    const parts: THREE.BufferGeometry[] = [part(new THREE.CylinderGeometry(5.2, 5.6, 0.5, 24), STONE, 0, 0.25, 0), part(new THREE.CylinderGeometry(3.6, 3.6, 0.2, 24), color, 0, 0.6, 0)];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; parts.push(part(box(0.7, 3.6, 0.7), CREAM, Math.cos(a) * 4.8, 2.3, Math.sin(a) * 4.8)); }
    g.add(this.mesh(parts));
    return { obj: g, anim: undefined as ((t: number) => void) | undefined };
  }
}
