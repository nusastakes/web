import * as THREE from "three";
import { box, merge, part } from "./props";

/** Derek konstruksi di atas bangunan yang sedang naik. Tiang menyesuaikan tinggi bangunan, lengan berputar pelan. */

export interface CraneSite { x: number; z: number; /** tinggi bangunan saat ini (m) */ h: number }

const MAX_CRANES = 10;

export class Construction {
  private mast: THREE.InstancedMesh;
  private jib: THREE.InstancedMesh;
  private sites: CraneSite[] = [];
  private dummy = new THREE.Object3D();

  constructor(private parent: THREE.Object3D) {
    const mastGeo = merge([part(box(1, 1, 1).translate(0, 0.5, 0), 0xf5b301)]);
    const jibGeo = merge([
      part(box(18, 0.9, 0.9), 0xf5b301, 5, 0.5, 0),
      part(box(4, 2.2, 2.2), 0x6b7597, -7.5, 0.1, 0),
      part(box(2.4, 2.2, 2.2), 0xffffff, 0.5, -1.6, 0),
      part(box(0.25, 5.5, 0.25), 0x252a45, 12, -2.5, 0),
    ]);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 });
    this.mast = new THREE.InstancedMesh(mastGeo, mat, MAX_CRANES);
    this.jib = new THREE.InstancedMesh(jibGeo, mat, MAX_CRANES);
    for (const m of [this.mast, this.jib]) {
      m.frustumCulled = false;
      m.castShadow = true;
      m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      parent.add(m);
    }
  }

  set(sites: CraneSite[]) { this.sites = sites.slice(0, MAX_CRANES); }

  update(t: number) {
    const n = this.sites.length;
    this.mast.count = this.jib.count = n;
    for (let i = 0; i < n; i++) {
      const s = this.sites[i];
      const top = s.h + 12;
      this.dummy.position.set(s.x, 0, s.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1.8, top, 1.8);
      this.dummy.updateMatrix();
      this.mast.setMatrixAt(i, this.dummy.matrix);
      this.dummy.position.set(s.x, top, s.z);
      this.dummy.rotation.set(0, t * 0.25 + i * 1.7, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.jib.setMatrixAt(i, this.dummy.matrix);
    }
    this.mast.instanceMatrix.needsUpdate = true;
    this.jib.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const m of [this.mast, this.jib]) { this.parent.remove(m); m.geometry.dispose(); m.dispose(); }
    (this.mast.material as THREE.Material).dispose();
  }
}
