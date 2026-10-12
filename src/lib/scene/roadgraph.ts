import type { CityMap } from "./geometry";

/**
 * Graf jalan dari peta. Dipakai kendaraan dan pejalan kaki (life.ts) dan penata kota (fabric.ts).
 *
 * Tingkat jalan (tier) menentukan urutan tumbuhnya jaringan jalan saat kota berkembang: jalan besar lebih dulu,
 * gang dan jalur pejalan kaki belakangan. Hanya ruas dengan tier <= `tierMax` yang boleh dilalui.
 */

export type Profile = "veh" | "bike" | "ped";
export interface Edge { to: number; len: number; w: number; foot: boolean; tier: number }

export const tierOf = (w: number, foot: boolean) => (foot ? 3 : w >= 8 ? 0 : w >= 5 ? 1 : 2);

export class MinHeap {
  private a: [number, number][] = [];
  get size() { return this.a.length; }
  push(d: number, n: number) {
    const a = this.a;
    a.push([d, n]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export class RoadGraph {
  x: number[] = [];
  z: number[] = [];
  adj: Edge[][] = [];
  /** Simpul di komponen terhubung terbesar tiap profil (dengan semua tier aktif). */
  main: Record<Profile, number[]> = { veh: [], bike: [], ped: [] };
  private mainSet: Record<Profile, Set<number>> = { veh: new Set(), bike: new Set(), ped: new Set() };
  streetLength = 0;
  /** Tier tertinggi yang sudah dibangun; diatur oleh perkembangan kota. */
  tierMax = 3;

  constructor(roads: CityMap["roads"]) {
    const key = new Map<string, number>();
    const node = (px: number, pz: number) => {
      const k = `${Math.round(px / 2.5)},${Math.round(pz / 2.5)}`;
      let i = key.get(k);
      if (i === undefined) { i = this.x.length; key.set(k, i); this.x.push(px); this.z.push(pz); this.adj.push([]); }
      return i;
    };
    for (const r of roads) {
      const n = r.p.length / 2;
      const foot = !!r.f;
      const tier = tierOf(r.w, foot);
      for (let i = 1; i < n; i++) {
        const a = node(r.p[i * 2 - 2], r.p[i * 2 - 1]);
        const b = node(r.p[i * 2], r.p[i * 2 + 1]);
        if (a === b) continue;
        const len = Math.hypot(this.x[b] - this.x[a], this.z[b] - this.z[a]);
        this.adj[a].push({ to: b, len, w: r.w, foot, tier });
        this.adj[b].push({ to: a, len, w: r.w, foot, tier });
        if (!foot) this.streetLength += len;
      }
    }
    const all = this.tierMax;
    for (const p of ["veh", "bike", "ped"] as Profile[]) this.findMain(p, all);
  }

  /** Ruas ini boleh dilalui profil `p` pada tahap pembangunan sekarang? */
  ok(e: Edge, p: Profile, ignoreTier = false): boolean {
    if (!ignoreTier && e.tier > this.tierMax) return false;
    return p === "veh" ? !e.foot && e.w >= 5 : p === "bike" ? !e.foot : true;
  }

  private findMain(p: Profile, _tiers: number) {
    void _tiers;
    const n = this.x.length;
    const seen = new Uint8Array(n);
    let best: number[] = [];
    for (let s = 0; s < n; s++) {
      if (seen[s]) continue;
      const comp: number[] = [];
      const stack = [s];
      seen[s] = 1;
      while (stack.length) {
        const u = stack.pop()!;
        comp.push(u);
        for (const e of this.adj[u]) if (this.ok(e, p, true) && !seen[e.to]) { seen[e.to] = 1; stack.push(e.to); }
      }
      if (comp.length > best.length) best = comp;
    }
    // Simpul tanpa ruas yang diizinkan membentuk komponen berukuran 1; abaikan.
    this.main[p] = best.length > 1 ? best : [];
    this.mainSet[p] = new Set(this.main[p]);
  }

  inMain(n: number, p: Profile) { return this.mainSet[p].has(n); }

  nearest(px: number, pz: number, p: Profile, avoid: number[] = [], minGap = 0): number {
    let best = -1, bd = Infinity;
    for (const n of this.main[p]) {
      const d = Math.hypot(this.x[n] - px, this.z[n] - pz);
      if (d >= bd) continue;
      if (minGap > 0 && avoid.some((o) => Math.hypot(this.x[n] - this.x[o], this.z[n] - this.z[o]) < minGap)) continue;
      bd = d; best = n;
    }
    return best >= 0 ? best : this.main[p][0] ?? 0;
  }

  edge(a: number, b: number): Edge | undefined {
    for (const e of this.adj[a]) if (e.to === b) return e;
    return undefined;
  }

  /** Rute terpendek. Bila jalan yang sudah dibangun tidak cukup, dicoba lagi dengan semua tier (jarang terjadi). */
  route(a: number, b: number, p: Profile): number[] | null {
    return this.search(a, b, p, false) ?? this.search(a, b, p, true);
  }

  private search(a: number, b: number, p: Profile, ignoreTier: boolean): number[] | null {
    if (a === b) return [a];
    const n = this.x.length;
    const dist = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const heap = new MinHeap();
    dist[a] = 0;
    heap.push(0, a);
    while (heap.size) {
      const [d, u] = heap.pop();
      if (d > dist[u]) continue;
      if (u === b) break;
      for (const e of this.adj[u]) {
        if (!this.ok(e, p, ignoreTier)) continue;
        const nd = d + e.len;
        if (nd < dist[e.to]) { dist[e.to] = nd; prev[e.to] = u; heap.push(nd, e.to); }
      }
    }
    if (!Number.isFinite(dist[b])) return null;
    const out: number[] = [];
    for (let v = b; v !== -1; v = prev[v]) out.push(v);
    return out.reverse();
  }

  randomMain(p: Profile, rnd: () => number): number {
    const m = this.main[p];
    return m.length ? m[Math.floor(rnd() * m.length)] : 0;
  }
}
