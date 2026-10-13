"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { readMayorState, type MayorState } from "./actions";
import { loadCities, readAusdBalance, readHeldVaults, readMonBalance, readPosition, type Position } from "./chain";
import type { CityView, Hex } from "./types";

const CHANGED = "nusastakes:changed";

/**
 * Memberi tahu semua pembacaan data bahwa sesuatu baru berubah di chain. RPC publik kadang membalas dengan state
 * beberapa blok di belakang, jadi pembacaan diulang sebentar setelahnya.
 */
export function emitChange() {
  const fire = () => window.dispatchEvent(new Event(CHANGED));
  fire();
  window.setTimeout(fire, 1500);
  window.setTimeout(fire, 4500);
}

/** Memanggil `fn` sekarang lalu tiap `ms`, dan menyediakan `refresh` untuk dipanggil setelah aksi. */
function usePolled<T>(fn: () => Promise<T>, ms: number, enabled = true) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; }, [fn]);

  const refresh = useCallback(async () => {
    try {
      setData(await fnRef.current());
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = window.setInterval(refresh, ms);
    window.addEventListener(CHANGED, refresh);
    return () => { window.clearInterval(id); window.removeEventListener(CHANGED, refresh); };
  }, [enabled, ms, refresh]);

  // Bila dinonaktifkan, data lama tidak ditampilkan (turunan, bukan setState di dalam efek).
  return { data: enabled ? data : undefined, error, loading: enabled ? loading : false, refresh };
}

export function useCities() {
  const r = usePolled<CityView[]>(loadCities, 20_000);
  return { cities: r.data ?? [], loading: r.loading, error: r.error, refresh: r.refresh };
}

export function usePosition(vault?: Hex, owner?: Hex) {
  const fn = useCallback(() => readPosition(vault as Hex, owner as Hex), [vault, owner]);
  const r = usePolled<Position>(fn, 15_000, Boolean(vault && owner));
  return { position: r.data, refresh: r.refresh };
}

export function useBalances(owner?: Hex) {
  const fn = useCallback(async () => {
    const [ausd, mon] = await Promise.all([readAusdBalance(owner as Hex), readMonBalance(owner as Hex)]);
    return { ausd, mon };
  }, [owner]);
  const r = usePolled(fn, 15_000, Boolean(owner));
  return { balances: r.data, refresh: r.refresh };
}

/** Vault (dari daftar `vaults`) tempat `owner` punya share. `held` kosong sampai pembacaan untuk daftar ini selesai. */
export function useHeldVaults(owner?: Hex, vaults: Hex[] = []) {
  const key = vaults.join(",");
  const fn = useCallback(async () => ({ key, held: await readHeldVaults(key ? (key.split(",") as Hex[]) : [], owner as Hex) }), [key, owner]);
  const r = usePolled(fn, 20_000, Boolean(owner));
  return { held: r.data && r.data.key === key ? r.data.held : undefined, refresh: r.refresh };
}

/** Detik Unix saat ini, diperbarui tiap 30 detik. Bernilai 0 di server agar hidrasi tidak berbeda. */
export function useNowSeconds(): number {
  return useSyncExternalStore(
    (cb) => { const id = window.setInterval(cb, 30_000); return () => window.clearInterval(id); },
    () => Math.floor(Date.now() / 30_000) * 30,
    () => 0,
  );
}

/** Keadaan vault untuk panel walikota (alokasi mentah, batas pergeseran, kunci wakil). */
export function useMayorState(vault: Hex | undefined, districts: { id: string; label: string }[]) {
  const labels = new Map(districts.map((d) => [d.id, d.label]));
  const r = usePolled<MayorState>(() => readMayorState(vault as Hex, labels), 12_000, Boolean(vault));
  return { state: r.data, refresh: r.refresh };
}
