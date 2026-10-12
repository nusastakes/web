import * as THREE from "three";
import type { CityMap } from "./geometry";
import { box, merge, part, toonRamp } from "./props";
import type { Theme } from "./themes";

/**
 * Panggung kota: kota berdiri di atas pulau berlapis (alas, tanah, batu) seperti maket di atas meja, dengan langit
 * bergradasi, awan yang melayang pelan di sekelilingnya, dan sekawanan burung yang berputar di atas.
 */
export class Scenery {
  private group = new THREE.Group();
  private mats: Record<"plate" | "soil" | "rock", THREE.MeshToonMaterial>;
  private clouds: THREE.InstancedMesh;
  private cloudState: { a: number; r: number; y: number; sp: number; s: number; ph: number }[] = [];
  private birds: THREE.InstancedMesh;
  private birdState: { a: number; r: number; y: number; sp: number; ph: number; s: number }[] = [];
  private sky: THREE.CanvasTexture | null = null;
  private stars: THREE.Points;
  private theme: Theme;
  private timeKey = "";
  private cloudMat: THREE.MeshToonMaterial;
  /** Warna langit saat ini (untuk pantulan di kaca gedung). */
  readonly skyTop = new THREE.Color(0xcfe0ff);
  readonly skyBottom = new THREE.Color(0xeef1fb);
  private dummy = new THREE.Object3D();
  private cx: number;
  private cz: number;

  constructor(private parent: THREE.Object3D, private scene: THREE.Scene, map: CityMap, private radius: number, theme: Theme) {
    const [x0, z0, x1, z1] = map.bounds;
    this.cx = (x0 + x1) / 2;
    this.cz = (z0 + z1) / 2;
    parent.add(this.group);
    const toon = () => new THREE.MeshToonMaterial({ gradientMap: toonRamp() });
    this.mats = { plate: toon(), soil: toon(), rock: toon() };

    // Pulau berlapis: tiap lapis sedikit lebih kecil dari yang di atasnya.
    const margin = 30;
    const w = x1 - x0 + margin * 2, d = z1 - z0 + margin * 2;
    const corner = Math.min(w, d) * 0.08;
    const layer = (inset: number, top: number, thick: number, mat: THREE.Material) => {
      const iw = w - inset * 2, id = d - inset * 2, r = Math.max(6, corner - inset * 0.6);
      const shape = new THREE.Shape();
      shape.moveTo(-iw / 2 + r, -id / 2);
      shape.lineTo(iw / 2 - r, -id / 2);
      shape.quadraticCurveTo(iw / 2, -id / 2, iw / 2, -id / 2 + r);
      shape.lineTo(iw / 2, id / 2 - r);
      shape.quadraticCurveTo(iw / 2, id / 2, iw / 2 - r, id / 2);
      shape.lineTo(-iw / 2 + r, id / 2);
      shape.quadraticCurveTo(-iw / 2, id / 2, -iw / 2, id / 2 - r);
      shape.lineTo(-iw / 2, -id / 2 + r);
      shape.quadraticCurveTo(-iw / 2, -id / 2, -iw / 2 + r, -id / 2);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 10 });
      geo.rotateX(-Math.PI / 2).translate(this.cx, top - thick, this.cz);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    };
    layer(0, -0.06, 7, this.mats.plate);
    layer(12, -7, 18, this.mats.soil);
    layer(40, -25, 44, this.mats.rock);

    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.ShadowMaterial({ opacity: 0.16 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.set(this.cx, -0.03, this.cz);
    catcher.receiveShadow = true;
    this.group.add(catcher);

    // Awan: tiga gumpalan bulat, tersebar di cincin di luar pulau.
    const puff = merge([
      new THREE.IcosahedronGeometry(1, 1).scale(1.3, 0.8, 1).translate(0, 0, 0),
      new THREE.IcosahedronGeometry(1, 1).scale(1, 0.75, 0.9).translate(1.5, -0.1, 0.2),
      new THREE.IcosahedronGeometry(1, 1).scale(0.95, 0.7, 0.85).translate(-1.4, -0.15, -0.1),
      new THREE.IcosahedronGeometry(1, 1).scale(0.8, 0.6, 0.7).translate(0.3, 0.45, 0.1),
    ].map((g) => { g.deleteAttribute("uv"); return g; }));
    const cloudMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonRamp() });
    this.cloudMat = cloudMat;
    const nClouds = 12;
    this.clouds = new THREE.InstancedMesh(puff, cloudMat, nClouds);
    this.clouds.frustumCulled = false;
    for (let i = 0; i < nClouds; i++) {
      this.cloudState.push({ a: (i / nClouds) * Math.PI * 2 + (i % 3) * 0.2, r: radius * (1.35 + ((i * 37) % 10) / 10 * 0.9), y: 150 + ((i * 53) % 10) * 16, sp: 0.004 + ((i * 17) % 5) * 0.0012, s: 18 + ((i * 29) % 7) * 4, ph: i });
    }
    this.group.add(this.clouds);

    // Burung: tubuh dan dua sayap berbentuk V.
    const wing = (side: number) => part(new THREE.BoxGeometry(1.2, 0.12, 4.6).translate(0, 0, side * 2.3).rotateX(-side * 0.3), 0x39456f);
    const birdGeo = merge([part(box(2.2, 0.5, 0.7), 0x39456f), wing(1), wing(-1)]);
    const nBirds = 10;
    this.birds = new THREE.InstancedMesh(birdGeo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }), nBirds);
    this.birds.frustumCulled = false;
    for (let i = 0; i < nBirds; i++) {
      this.birdState.push({ a: i * 0.7, r: radius * (0.3 + ((i * 41) % 10) / 10 * 0.6), y: 80 + ((i * 23) % 10) * 7, sp: 0.1 + ((i * 13) % 5) * 0.025, ph: i * 1.3, s: 2.6 + (i % 3) * 0.5 });
    }
    this.group.add(this.birds);

    // Bintang di kubah langit, terlihat saat malam.
    const starPos: number[] = [];
    for (let i = 0; i < 420; i++) {
      const a = ((i * 137.5) % 360) * (Math.PI / 180), e = 0.15 + ((i * 53) % 100) / 100 * 1.2, r = radius * 7;
      starPos.push(this.cx + Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, this.cz + Math.sin(a) * Math.cos(e) * r);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.frustumCulled = false;
    this.group.add(this.stars);

    this.theme = theme;
    this.setTheme(theme);
  }

  /** Langit mengikuti jam: siang memakai warna tema, senja jingga, malam biru tua berbintang. */
  setTime(daylight: number, dusk: number) {
    const key = `${daylight.toFixed(2)}:${dusk.toFixed(2)}`;
    if (key === this.timeKey) return;
    this.timeKey = key;
    const mix = (a: string, b: string, k: number) => new THREE.Color(a).lerp(new THREE.Color(b), k);
    const night = 1 - daylight;
    let top = mix(this.theme.sky[0], "#0d1838", night);
    let bottom = mix(this.theme.sky[1], "#283068", night);
    top = top.lerp(new THREE.Color("#f39a7a"), dusk * 0.55);
    bottom = bottom.lerp(new THREE.Color("#ffc9a3"), dusk * 0.7);
    this.paintSky(`#${top.getHexString()}`, `#${bottom.getHexString()}`);
    (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, night - 0.35) * 1.4;
    this.cloudMat.color.setRGB(1 - night * 0.6, 1 - night * 0.58, 1 - night * 0.45).lerp(new THREE.Color("#ffd2b8"), dusk * 0.5);
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    this.mats.plate.color.set(theme.plate);
    this.mats.soil.color.set(theme.soil);
    this.mats.rock.color.set(theme.rock);
    this.timeKey = "";
    this.paintSky(theme.sky[0], theme.sky[1]);
  }

  private paintSky(top: string, bottom: string) {
    this.skyTop.set(top);
    this.skyBottom.set(bottom);
    const cvs = document.createElement("canvas");
    cvs.width = 4;
    cvs.height = 256;
    const g = cvs.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, top);
    grad.addColorStop(0.55, bottom);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    this.sky?.dispose();
    this.sky = new THREE.CanvasTexture(cvs);
    this.sky.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.sky;
    if (this.scene.fog) (this.scene.fog as THREE.Fog).color.set(bottom);
  }

  /** `camera`: awan yang terlalu dekat dengan kamera mengecil supaya tidak menutupi kota. */
  update(t: number, camera?: THREE.Camera) {
    const d = this.dummy;
    this.cloudState.forEach((c, i) => {
      const a = c.a + t * c.sp;
      d.position.set(this.cx + Math.cos(a) * c.r, c.y + Math.sin(t * 0.2 + c.ph) * 4, this.cz + Math.sin(a) * c.r);
      d.rotation.set(0, -a, 0);
      const near = camera ? Math.min(1, Math.max(0, (d.position.distanceTo(camera.position) - this.radius * 0.5) / (this.radius * 0.9))) : 1;
      d.scale.setScalar(Math.max(0.001, c.s * near));
      d.updateMatrix();
      this.clouds.setMatrixAt(i, d.matrix);
    });
    this.clouds.instanceMatrix.needsUpdate = true;
    this.birdState.forEach((b, i) => {
      const a = b.a + t * b.sp;
      d.position.set(this.cx + Math.cos(a) * b.r, b.y + Math.sin(t * 1.3 + b.ph) * 3, this.cz + Math.sin(a) * b.r);
      d.rotation.set(Math.sin(t * 5 + b.ph) * 0.45, -a - Math.PI / 2, 0);
      d.scale.setScalar(b.s);
      d.updateMatrix();
      this.birds.setMatrixAt(i, d.matrix);
    });
    this.birds.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.sky?.dispose();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
    });
    this.parent.remove(this.group);
  }
}
