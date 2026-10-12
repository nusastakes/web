import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Alat bersama untuk membuat model low-poly dan menampilkannya berinstans. Satuan meter, depan = +X, atas = +Y. */

const PROP_WHITE = new THREE.Color(1, 1, 1);

/** Tiga pita cahaya datar (gaya kartun): bayangan, tengah, terang. Satu tekstur dipakai semua bahan toon. */
let ramp: THREE.DataTexture | null = null;
export function toonRamp(): THREE.DataTexture {
  if (!ramp) {
    ramp = new THREE.DataTexture(new Uint8Array([176, 222, 255]), 3, 1, THREE.RedFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
  }
  return ramp;
}

/** Memberi warna vertex (dan atribut anggota badan bila `limb` diisi) lalu menggeser geometri. */
export function part(g: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, limb?: [number, number]): THREE.BufferGeometry {
  g.translate(x, y, z);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute("uv");
  if (limb) {
    g.setAttribute("aLimb", new THREE.BufferAttribute(new Float32Array(n).fill(limb[0]), 1));
    g.setAttribute("aPivot", new THREE.BufferAttribute(new Float32Array(n).fill(limb[1]), 1));
  }
  return g;
}
export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const wheel = (r: number, w: number) => new THREE.CylinderGeometry(r, r, w, 10).rotateX(Math.PI / 2);
export const merge = (parts: THREE.BufferGeometry[]) => mergeGeometries(parts, false) as THREE.BufferGeometry;

/** `accent` adalah lapisan ketiga dengan warna per instance sendiri (misalnya kulit orang). */
export interface Model { tint: THREE.BufferGeometry; fixed: THREE.BufferGeometry; accent?: THREE.BufferGeometry }

/**
 * Satu jenis benda berinstans: lapisan berwarna (dengan `instanceColor`) dan lapisan tetap.
 * Mode `walker` menambahkan ayunan tangan dan kaki di shader (gaya balok seperti Minecraft).
 */
export class Layered {
  readonly tint: THREE.InstancedMesh;
  readonly fixed: THREE.InstancedMesh;
  readonly accent: THREE.InstancedMesh | null = null;
  private free: number[];
  private dirty = false;
  private phase: Float32Array[] = [];
  private amp: Float32Array[] = [];
  private static readonly HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(private parent: THREE.Object3D, model: Model, readonly cap: number, shadow = true, walker = false) {
    const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() });
    if (walker) {
      mat.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nattribute float aLimb;\nattribute float aPivot;\nattribute float aPhase;\nattribute float aAmp;")
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
float sw = sin(aPhase) * 0.8 * aAmp * aLimb;
float cs = cos(sw);
float sn = sin(sw);
float dy = transformed.y - aPivot;
float nxx = transformed.x * cs - dy * sn;
float nyy = aPivot + transformed.x * sn + dy * cs;
transformed.x = nxx;
transformed.y = nyy;`,
          );
      };
    }
    this.tint = new THREE.InstancedMesh(model.tint, mat, cap);
    this.fixed = new THREE.InstancedMesh(model.fixed, mat, cap);
    if (model.accent) this.accent = new THREE.InstancedMesh(model.accent, mat, cap);
    for (const m of this.meshes()) {
      m.frustumCulled = false;
      m.castShadow = shadow;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < cap; i++) m.setMatrixAt(i, Layered.HIDDEN);
      if (walker) {
        const ph = new Float32Array(cap), am = new Float32Array(cap);
        m.geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(ph, 1).setUsage(THREE.DynamicDrawUsage));
        m.geometry.setAttribute("aAmp", new THREE.InstancedBufferAttribute(am, 1).setUsage(THREE.DynamicDrawUsage));
        this.phase.push(ph); this.amp.push(am);
      }
      parent.add(m);
    }
    this.tint.setColorAt(0, PROP_WHITE);
    this.accent?.setColorAt(0, PROP_WHITE);
    this.free = Array.from({ length: cap }, (_, i) => cap - 1 - i);
  }
  private meshes(): THREE.InstancedMesh[] { return this.accent ? [this.tint, this.fixed, this.accent] : [this.tint, this.fixed]; }
  acquire(): number { return this.free.pop() ?? -1; }
  release(i: number) {
    for (const m of this.meshes()) m.setMatrixAt(i, Layered.HIDDEN);
    this.dirty = true;
    this.free.push(i);
  }
  get available() { return this.free.length; }
  set(i: number, m: THREE.Matrix4) {
    for (const k of this.meshes()) k.setMatrixAt(i, m);
    this.dirty = true;
  }
  hide(i: number) { this.set(i, Layered.HIDDEN); }
  color(i: number, c: THREE.Color) {
    this.tint.setColorAt(i, c);
    if (this.tint.instanceColor) this.tint.instanceColor.needsUpdate = true;
  }
  /** Warna lapisan ketiga (kulit). */
  accentColor(i: number, c: THREE.Color) {
    if (!this.accent) return;
    this.accent.setColorAt(i, c);
    if (this.accent.instanceColor) this.accent.instanceColor.needsUpdate = true;
  }
  /** Fase dan amplitudo ayunan anggota badan (hanya mode walker). */
  walk(i: number, phase: number, amp: number) {
    for (let k = 0; k < this.phase.length; k++) { this.phase[k][i] = phase; this.amp[k][i] = amp; }
  }
  flush() {
    if (this.phase.length) {
      for (const m of this.meshes()) {
        (m.geometry.attributes.aPhase as THREE.BufferAttribute).needsUpdate = true;
        (m.geometry.attributes.aAmp as THREE.BufferAttribute).needsUpdate = true;
      }
    }
    if (!this.dirty) return;
    for (const m of this.meshes()) m.instanceMatrix.needsUpdate = true;
    this.dirty = false;
  }
  dispose() {
    for (const m of this.meshes()) { this.parent.remove(m); m.geometry.dispose(); m.dispose(); }
    (this.tint.material as THREE.Material).dispose();
  }
}
