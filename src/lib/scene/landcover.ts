import * as THREE from "three";
import type { CityMap } from "./geometry";
import type { Theme } from "./themes";

/**
 * Tutupan lahan dari data peta (B2.20, sumbu "lokasi peta" di TC67): air dan taman, hutan, rumput yang benar-benar ada di
 * area yang dipilih walikota. Dua mesh datar (air dan hijau) tepat di atas tanah dan di bawah jalan, taman prosedural,
 * dan bangunan, jadi hanya dua draw call dan tanpa tekstur. Ada sejak kota masih kosong (alam tidak ikut tumbuh).
 */

const WATER = 0xa9d8f0;
const GREEN = 0xc8ebd2;
const Y = 0.02;

export class LandCover {
  readonly group = new THREE.Group();
  private mats: THREE.MeshBasicMaterial[] = [];
  private green: THREE.MeshBasicMaterial | null = null;
  private base = new Map<THREE.MeshBasicMaterial, THREE.Color>();
  private night = -1;
  private wet = 0;
  /** Banyaknya area yang digambar, untuk laporan dan uji. */
  readonly stats = { water: 0, green: 0 };

  constructor(parent: THREE.Object3D, map: CityMap) {
    parent.add(this.group);
    const areas = map.areas ?? [];
    for (const t of [0, 1] as const) {
      const pos: number[] = [], idx: number[] = [];
      for (const a of areas) {
        if (a.t !== t || a.p.length < 6) continue;
        const contour: THREE.Vector2[] = [];
        for (let i = 0; i < a.p.length; i += 2) contour.push(new THREE.Vector2(a.p[i], a.p[i + 1]));
        let faces: number[][];
        try { faces = THREE.ShapeUtils.triangulateShape(contour, []); } catch { continue; }
        if (!faces.length) continue;
        const base = pos.length / 3;
        for (const c of contour) pos.push(c.x, Y, c.y);
        // Dua sisi digambar (`DoubleSide`), jadi arah belitan segitiga tidak penting.
        for (const f of faces) idx.push(base + f[0], base + f[2], base + f[1]);
        if (t === 0) this.stats.water++; else this.stats.green++;
      }
      if (!idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      // Di bawah jalan dan taman prosedural: didorong menjauh dari kamera supaya tidak berebut kedalaman.
      const mat = new THREE.MeshBasicMaterial({ color: t === 0 ? WATER : GREEN, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
      this.mats.push(mat);
      if (t === 1) this.green = mat;
      const mesh = new THREE.Mesh(g, mat);
      mesh.renderOrder = -2;
      mesh.userData.landcover = t === 0 ? "water" : "green";
      this.group.add(mesh);
    }
  }

  /** Warna hijau mengikuti tema kota; air tetap biru lembut. */
  setTheme(theme: Theme) {
    if (!this.green) return;
    this.green.color.set(theme.park);
    this.base.delete(this.green);
    this.night = -1;
  }

  /** 0 siang, 1 malam; hujan sedikit menggelapkan, seperti jalan. */
  setNight(n: number, wet = 0) {
    if (Math.abs(n - this.night) <= 0.01 && Math.abs(wet - this.wet) <= 0.01) return;
    this.night = n;
    this.wet = wet;
    const k = (1 - 0.62 * n) * (1 - 0.18 * wet);
    const tint = new THREE.Color(0.78, 0.82, 1.0);
    for (const m of this.mats) {
      let b = this.base.get(m);
      if (!b) { b = m.color.clone(); this.base.set(m, b); }
      m.color.copy(b).multiplyScalar(k).lerp(b.clone().multiply(tint).multiplyScalar(k), n);
    }
  }
}
