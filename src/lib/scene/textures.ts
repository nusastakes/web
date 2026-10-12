import * as THREE from "three";

/**
 * Tekstur kecil buatan prosedur (tanpa DOM): aspal berbintik, ubin trotoar, rumput. Warnanya mendekati putih supaya
 * warna bahan tetap memimpin; teksturnya hanya memberi permukaan yang tidak polos. Dibuat sekali lalu dipakai bersama.
 */

const cache = new Map<string, THREE.DataTexture>();
const rand = (s: number) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function make(key: string, size: number, fn: (x: number, y: number) => [number, number, number]): THREE.DataTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [r, g, b] = fn(x, y);
    const i = (y * size + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

/** Aspal: butiran halus dan sedikit tambalan. */
export const asphaltTex = () => make("asphalt", 128, (x, y) => {
  const n = rand(x * 13.1 + y * 7.7) * 0.07 + rand(Math.floor(x / 9) * 3.3 + Math.floor(y / 9) * 5.1) * 0.05;
  const v = Math.round(255 * (0.9 + n));
  return [Math.min(255, v), Math.min(255, v), Math.min(255, v + 2)];
});

/** Ubin trotoar 4 x 4 per tekstur, dengan nat lebih gelap dan sedikit beda warna per ubin. */
export const tileTex = () => make("tile", 128, (x, y) => {
  const tx = Math.floor(x / 32), ty = Math.floor(y / 32);
  const grout = x % 32 < 2 || y % 32 < 2;
  const t = 0.95 + rand(tx * 7 + ty * 13) * 0.05;
  const v = Math.round(255 * (grout ? 0.84 : t));
  return [v, v, Math.min(255, v + 3)];
});

/** Rumput: belang hijau lembut dan bercak. */
export const grassTex = () => make("grass", 128, (x, y) => {
  const n = rand(x * 3.7 + y * 11.3) * 0.08 + rand(Math.floor(x / 6) * 1.7 + Math.floor(y / 6) * 9.2) * 0.07;
  const v = 0.86 + n;
  return [Math.round(255 * v * 0.97), Math.round(255 * Math.min(1, v + 0.03)), Math.round(255 * v * 0.95)];
});
