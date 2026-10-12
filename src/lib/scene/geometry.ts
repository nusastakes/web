import * as THREE from "three";

/** Berkas kompak hasil `scripts/prep-map.mjs`. Satuan meter, x ke timur, z ke selatan. */
export interface CityMap {
  id: string;
  name: string;
  attribution: string;
  center: [number, number];
  bounds: [number, number, number, number];
  buildings: MapBuilding[];
  roads: MapRoad[];
}
export interface MapBuilding {
  /** tinggi (m) */ h: number;
  /** 1 bila tinggi berasal dari data peta */ k: number;
  /** kelas bangunan */ c: number;
  /** luas tapak (m²) */ a: number;
  /** [x0, z0, x1, z1, ...] */ p: number[];
}
export interface MapRoad {
  w: number;
  /** 1 bila jalur pejalan kaki */ f: number;
  p: number[];
}

export function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Titik di dalam poligon `p` ([x0, z0, x1, z1, ...])? */
export function pointInPolygon(px: number, pz: number, p: number[]): boolean {
  let inside = false;
  const n = p.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = p[i * 2], zi = p[i * 2 + 1], xj = p[j * 2], zj = p[j * 2 + 1];
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}

/** Jarak dari titik ke tepi poligon terdekat. */
export function distToPolygonEdge(px: number, pz: number, p: number[]): number {
  let best = Infinity;
  const n = p.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ax = p[j * 2], az = p[j * 2 + 1], bx = p[i * 2], bz = p[i * 2 + 1];
    const dx = bx - ax, dz = bz - az;
    const l2 = dx * dx + dz * dz || 1e-9;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
    best = Math.min(best, Math.hypot(px - (ax + dx * t), pz - (az + dz * t)));
  }
  return best;
}

/** Warna genteng atap miring (RGB linear kasar): tanah liat, bata, abu kebiruan, oranye. */
const ROOF_TILES: readonly (readonly number[])[] = [[0.78, 0.36, 0.26], [0.66, 0.3, 0.24], [0.5, 0.58, 0.74], [0.86, 0.52, 0.3], [0.7, 0.42, 0.36]];

/** Menggeser tiap titik tapak ke arah pusatnya sejauh `d` meter (dibatasi 20% jaraknya). */
function shrinkFootprint(p: number[], d: number): number[] {
  const n = p.length / 2;
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += p[i * 2]; cz += p[i * 2 + 1]; }
  cx /= n; cz /= n;
  const out = new Array<number>(p.length);
  for (let i = 0; i < n; i++) {
    const x = p[i * 2], z = p[i * 2 + 1], dist = Math.hypot(cx - x, cz - z) || 1;
    const k = Math.min(d, dist * 0.2) / dist;
    out[i * 2] = x + (cx - x) * k;
    out[i * 2 + 1] = z + (cz - z) * k;
  }
  return out;
}

/** Poligon cembung? Semua belokan searah (selisih satu belokan kecil diabaikan). */
function isConvex(p: number[]): boolean {
  const n = p.length / 2;
  let pos = 0, neg = 0;
  for (let i = 0; i < n; i++) {
    const ax = p[i * 2], az = p[i * 2 + 1], bx = p[((i + 1) % n) * 2], bz = p[((i + 1) % n) * 2 + 1], cx = p[((i + 2) % n) * 2], cz = p[((i + 2) % n) * 2 + 1];
    const cr = (bx - ax) * (cz - bz) - (bz - az) * (cx - bx);
    if (cr > 1e-6) pos++; else if (cr < -1e-6) neg++;
  }
  return pos === 0 || neg === 0;
}

export interface BuildingMeshParts {
  geometry: THREE.BufferGeometry;
  /** Tinggi bangunan terjangkung, untuk menempatkan label. */
  maxHeight: number;
  /** Indeks bangunan pemilik tiap vertex (untuk pemilihan lewat raycast). */
  owner: Int32Array;
}

/**
 * Menggabungkan bangunan terpilih menjadi satu BufferGeometry.
 * Atribut: position, normal, color (variasi nada), wuv (u = meter sepanjang dinding, v = meter dari tanah; v = -1 untuk
 * atap), seed (acak per bangunan untuk jendela), bord (urutan bangunan tumbuh, 0..1; lihat shader di CityScene).
 * Atap diberi perlengkapan (unit AC, tangki air, antena menara) supaya kota terlihat dihuni.
 */
export function buildBuildingsGeometry(buildings: MapBuilding[], indices: number[], heightScale = 1, orderOf?: (bi: number) => number): BuildingMeshParts {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const wuv: number[] = [];
  const seed: number[] = [];
  const bord: number[] = [];
  const owner: number[] = [];
  const bh: number[] = [];
  const bsty: number[] = [];
  const wsg: number[] = [];
  let curStyle = 0;
  let segStart = 0;
  let segLen = 0;
  let maxHeight = 0;
  let bo = 0;
  let cur = 0;
  let curH = 0;

  const pushVertex = (x: number, y: number, z: number, nx: number, ny: number, nz: number, shade: number, u: number, v: number, sd: number, rgb?: readonly number[]) => {
    pos.push(x, y, z);
    nor.push(nx, ny, nz);
    if (rgb) col.push(rgb[0], rgb[1], rgb[2]); else col.push(shade, shade, shade);
    bh.push(curH);
    bsty.push(curStyle);
    wsg.push(segLen > 0 ? u - segStart : 0, segLen);
    wuv.push(u, v);
    seed.push(sd);
    bord.push(bo);
    owner.push(cur);
  };

  /** Satu sisi persegi dengan lilitan yang menghadap `normal`; dipakai untuk kotak di atap. */
  const pushQuad = (pts: number[][], nx: number, ny: number, nz: number, shade: number, sd: number) => {
    const e1 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]];
    const e2 = [pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
    const flip = cx * nx + cy * ny + cz * nz < 0;
    const tris = flip ? [[0, 2, 1], [0, 3, 2]] : [[0, 1, 2], [0, 2, 3]];
    for (const tri of tris) for (const k of tri) pushVertex(pts[k][0], pts[k][1], pts[k][2], nx, ny, nz, shade, 0, -1, sd);
  };
  /** Tabung bersegi delapan (toren air) dengan warna sendiri. */
  const pushCyl = (cx: number, cz: number, y0: number, r: number, hh: number, rgb: readonly number[], sd: number) => {
    const seg = 8;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
      const x0 = cx + Math.cos(a0) * r, z0 = cz + Math.sin(a0) * r, x1 = cx + Math.cos(a1) * r, z1 = cz + Math.sin(a1) * r;
      const nx = Math.cos(am), nz = Math.sin(am);
      const pts = [[x0, y0, z0], [x1, y0, z1], [x1, y0 + hh, z1], [x0, y0 + hh, z0]];
      const e1 = [pts[1][0] - pts[0][0], 0, pts[1][2] - pts[0][2]], e2 = [0, hh, 0];
      const cxp = e1[1] * e2[2] - e1[2] * e2[1], czp = e1[0] * e2[1] - e1[1] * e2[0];
      const order = cxp * nx + czp * nz >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      for (const k of order) pushVertex(pts[k][0], pts[k][1], pts[k][2], nx, 0, nz, 1, 0, -2, sd, rgb);
      const top = [[cx, y0 + hh, cz], [x0, y0 + hh, z0], [x1, y0 + hh, z1]];
      const tcr = (top[1][0] - top[0][0]) * (top[2][2] - top[0][2]) - (top[1][2] - top[0][2]) * (top[2][0] - top[0][0]);
      const tord = tcr <= 0 ? [0, 1, 2] : [0, 2, 1];
      for (const k of tord) pushVertex(top[k][0], top[k][1], top[k][2], 0, 1, 0, 1, 0, -2, sd, [rgb[0] * 1.05, rgb[1] * 1.05, rgb[2] * 1.05]);
    }
  };
  const pushBox = (cx: number, cz: number, y0: number, w: number, hh: number, d: number, shade: number, sd: number) => {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + hh;
    pushQuad([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], 0, 1, 0, shade, sd);
    pushQuad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], 1, 0, 0, shade * 0.92, sd);
    pushQuad([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], -1, 0, 0, shade * 0.92, sd);
    pushQuad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], 0, 0, 1, shade * 0.86, sd);
    pushQuad([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], 0, 0, -1, shade * 0.86, sd);
  };

  for (const bi of indices) {
    // Dinding gedung yang berimpit (bagian gedung dari Overture) digeser sedikit ke dalam dengan jarak berbeda per gedung,
    // supaya tidak berebut kedalaman dan berkedip-kedip (z-fighting). Gedung yang lebih tinggi bergeser lebih jauh.
    const raw = buildings[bi];
    const b = { ...raw, p: shrinkFootprint(raw.p, 0.08 + Math.min(0.6, raw.h / 380) + 0.08 * hash01(bi * 1.31)) };
    const n = b.p.length / 2;
    if (n < 3) continue;
    const h = b.h * heightScale;
    curH = h;
    maxHeight = Math.max(maxHeight, h);
    const sd = hash01(bi + 1);
    bo = orderOf ? orderOf(bi) : 0;
    cur = bi;
    const tone = 0.94 + hash01(bi * 3.7 + 5) * 0.06;
    // Gaya fasad: 0 menara kaca, 1 kantor beton, 2 hunian berwarna, 3 ruko. Bangunan kecil cembung beratap miring.
    const pitched = h <= 18 && b.a <= 700 && n <= 14 && hash01(bi * 9.1 + 2) < 0.78 && isConvex(b.p);
    const sr = hash01(bi * 5.3 + 7);
    curStyle = h >= 45 ? (sr < 0.72 ? 0 : 1) : h >= 20 ? (sr < 0.45 ? 1 : 2) : pitched ? 2 : sr < 0.6 ? 3 : 2;

    // Arah lilitan (x-z): luas bertanda positif berarti berlawanan arah jarum jam.
    let area2 = 0;
    for (let i = 0; i < n; i++) {
      const x1 = b.p[i * 2], z1 = b.p[i * 2 + 1];
      const x2 = b.p[((i + 1) % n) * 2], z2 = b.p[((i + 1) % n) * 2 + 1];
      area2 += x1 * z2 - x2 * z1;
    }
    const ccw = area2 > 0;

    // Dinding.
    let run = 0;
    for (let i = 0; i < n; i++) {
      const ax = b.p[i * 2], az = b.p[i * 2 + 1];
      const bx = b.p[((i + 1) % n) * 2], bz = b.p[((i + 1) % n) * 2 + 1];
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      const nx = (ccw ? dz : -dz) / len;
      const nz = (ccw ? -dx : dx) / len;
      const u0 = run, u1 = run + len;
      run += len;
      segStart = u0;
      segLen = len;
      // a_bawah, b_bawah, b_atas, a_atas
      const v = [
        [ax, 0, az, u0, 0, 0.9],
        [bx, 0, bz, u1, 0, 0.9],
        [bx, h, bz, u1, h, tone],
        [ax, h, az, u0, h, tone],
      ] as const;
      // Dua segitiga; tentukan lilitan agar sisi depan menghadap keluar.
      const tri = (i0: number, i1: number, i2: number) => {
        const p0 = v[i0], p1 = v[i1], p2 = v[i2];
        const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
        const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
        const cx = e1[1] * e2[2] - e1[2] * e2[1];
        const cz = e1[0] * e2[1] - e1[1] * e2[0];
        const facing = cx * nx + cz * nz;
        const order = facing >= 0 ? [p0, p1, p2] : [p0, p2, p1];
        for (const q of order) pushVertex(q[0], q[1], q[2], nx, 0, nz, q[5], q[3], q[4], sd);
      };
      tri(0, 1, 2);
      tri(0, 2, 3);
    }
    segLen = 0;

    // Bangunan kecil dan cembung diberi atap miring bergenteng; yang lain beratap datar.
    let pitchedDone = false;
    if (pitched) {
      let mx = 0, mz = 0;
      for (let i = 0; i < n; i++) { mx += b.p[i * 2]; mz += b.p[i * 2 + 1]; }
      mx /= n; mz /= n;
      const rh = Math.max(1.8, Math.min(5, Math.sqrt(b.a) * 0.2));
      const rgb = ROOF_TILES[Math.floor(hash01(bi * 4.3 + 1) * ROOF_TILES.length)];
      for (let i = 0; i < n; i++) {
        let ax = b.p[i * 2], az = b.p[i * 2 + 1], bx = b.p[((i + 1) % n) * 2], bz = b.p[((i + 1) % n) * 2 + 1];
        const e1 = [bx - ax, 0, bz - az], e2 = [mx - ax, rh, mz - az];
        let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
        if (ny < 0) { [ax, bx] = [bx, ax]; [az, bz] = [bz, az]; nx = -nx; ny = -ny; nz = -nz; }
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l; ny /= l; nz /= l;
        const lit = 0.92 + 0.08 * hash01(bi + i);
        pushVertex(ax, h, az, nx, ny, nz, lit, 0, -2, sd, [rgb[0] * lit, rgb[1] * lit, rgb[2] * lit]);
        pushVertex(bx, h, bz, nx, ny, nz, lit, 0, -2, sd, [rgb[0] * lit, rgb[1] * lit, rgb[2] * lit]);
        pushVertex(mx, h + rh, mz, nx, ny, nz, lit, 0, -2, sd, [rgb[0] * lit, rgb[1] * lit, rgb[2] * lit]);
      }
      pitchedDone = true;
    }

    // Atap.
    const contour: THREE.Vector2[] = [];
    for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(b.p[i * 2], b.p[i * 2 + 1]));
    const faces = pitchedDone ? [] : THREE.ShapeUtils.triangulateShape(contour, []);
    for (const f of faces) {
      const pts = [contour[f[0]], contour[f[1]], contour[f[2]]];
      const cr = (pts[1].x - pts[0].x) * (pts[2].y - pts[0].y) - (pts[1].y - pts[0].y) * (pts[2].x - pts[0].x);
      // Di bidang x-z dengan y ke atas, segitiga menghadap ke atas bila lilitannya searah jarum jam pada (x, z).
      const order = cr <= 0 ? pts : [pts[0], pts[2], pts[1]];
      for (const q of order) pushVertex(q.x, h, q.y, 0, 1, 0, 1, 0, -1, sd);
    }

    // Perlengkapan atap: kotak AC, tangki, rumah tangga; menara tinggi dapat antena. Hanya di dalam tapak.
    if (!pitchedDone && h >= 8 && b.a >= 90) {
      let mx = 0, mz = 0;
      for (let i = 0; i < n; i++) { mx += b.p[i * 2]; mz += b.p[i * 2 + 1]; }
      mx /= n; mz /= n;
      const span = Math.sqrt(b.a);
      const fits = (x: number, z: number, hw: number) =>
        pointInPolygon(x - hw, z - hw, b.p) && pointInPolygon(x + hw, z - hw, b.p) && pointInPolygon(x - hw, z + hw, b.p) && pointInPolygon(x + hw, z + hw, b.p);
      const count = h > 45 ? 3 : h > 20 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const r = hash01(bi * 7.7 + k * 3.1);
        const ox = (hash01(bi * 2.3 + k) - 0.5) * span * 0.45, oz = (hash01(bi * 5.9 + k * 1.7) - 0.5) * span * 0.45;
        const kind = r < 0.5 ? 0 : r < 0.8 ? 1 : 2;
        const w = kind === 0 ? 2.4 : kind === 1 ? 2.6 : 3.4;
        const hh = kind === 0 ? 1.2 : kind === 1 ? 2.8 : 2.4;
        if (fits(mx + ox, mz + oz, w * 0.6)) pushBox(mx + ox, mz + oz, h, w, hh, kind === 0 ? 1.7 : w, kind === 1 ? 0.78 : 0.86, sd);
      }
      if (h > 110 && fits(mx, mz, 0.6)) pushBox(mx, mz, h, 0.5, Math.min(26, h * 0.1), 0.5, 0.62, sd);
      // Toren air oranye atau biru di atap hunian dan ruko.
      if (h < 30 && (curStyle === 2 || curStyle === 3)) {
        const tx = mx + (hash01(bi * 3.3) - 0.5) * span * 0.3, tz = mz + (hash01(bi * 6.1) - 0.5) * span * 0.3;
        if (fits(tx, tz, 1.2)) {
          pushBox(tx, tz, h, 2.0, 1.0, 2.0, 0.7, sd);
          pushCyl(tx, tz, h + 1.0, 0.85, 1.7, hash01(bi * 2.2) < 0.6 ? [0.95, 0.55, 0.18] : [0.25, 0.5, 0.9], sd);
        }
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("wuv", new THREE.Float32BufferAttribute(wuv, 2));
  g.setAttribute("seed", new THREE.Float32BufferAttribute(seed, 1));
  g.setAttribute("bord", new THREE.Float32BufferAttribute(bord, 1));
  g.setAttribute("bh", new THREE.Float32BufferAttribute(bh, 1));
  g.setAttribute("bstyle", new THREE.Float32BufferAttribute(bsty, 1));
  g.setAttribute("wseg", new THREE.Float32BufferAttribute(wsg, 2));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return { geometry: g, maxHeight, owner: Int32Array.from(owner) };
}

/** Pita jalan datar dengan lebar tetap, sambungan dirata-ratakan (miter dibatasi). */
export function buildRoadsGeometry(roads: MapRoad[], y: number, uvScale = 4): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let base = 0;
  for (const r of roads) {
    const n = r.p.length / 2;
    if (n < 2) continue;
    const half = r.w / 2;
    for (let i = 0; i < n; i++) {
      const x = r.p[i * 2], z = r.p[i * 2 + 1];
      const px = i > 0 ? r.p[(i - 1) * 2] : x, pz = i > 0 ? r.p[(i - 1) * 2 + 1] : z;
      const nx = i < n - 1 ? r.p[(i + 1) * 2] : x, nz = i < n - 1 ? r.p[(i + 1) * 2 + 1] : z;
      let d1x = x - px, d1z = z - pz, d2x = nx - x, d2z = nz - z;
      const l1 = Math.hypot(d1x, d1z) || 1, l2 = Math.hypot(d2x, d2z) || 1;
      d1x /= l1; d1z /= l1; d2x /= l2; d2z /= l2;
      if (i === 0) { d1x = d2x; d1z = d2z; }
      if (i === n - 1) { d2x = d1x; d2z = d1z; }
      // Normal rata-rata kedua segmen; panjang offset dibatasi supaya sudut tajam tidak meruncing.
      let mx = -(d1z + d2z), mz = d1x + d2x;
      const ml = Math.hypot(mx, mz) || 1;
      mx /= ml; mz /= ml;
      const cosHalf = Math.max(0.5, mx * -d1z + mz * d1x);
      const off = half / cosHalf;
      pos.push(x + mx * off, y, z + mz * off, x - mx * off, y, z - mz * off);
      uv.push((x + mx * off) / uvScale, (z + mz * off) / uvScale, (x - mx * off) / uvScale, (z - mz * off) / uvScale);
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    base += n * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
