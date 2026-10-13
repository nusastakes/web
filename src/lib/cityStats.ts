"use client";

import { useEffect, useState } from "react";
import { getHistory, getScore, type CityHistory, type CityScore } from "./relayer";
import type { Hex } from "./types";

/**
 * Ukuran dan ekonomi kota dari relayer (vault TC67.8): skor dari layanan kota sendiri (`/score/:city`) dan riwayat
 * kejadian kota (`/history/:city`). Diperbarui tiap 60 detik; bila relayer belum tahu kota itu (404) atau sedang tidak
 * terjangkau, hasilnya null dan tampilan memakai cadangan. Hasil terakhir disimpan per kota supaya membuka ulang
 * Meja Walikota langsung menampilkan angka.
 */

const POLL_MS = 60_000;
const scoreCache = new Map<string, CityScore | null>();
const historyCache = new Map<string, CityHistory | null>();

function usePolledByKey<T>(key: string | null, cache: Map<string, T | null>, load: () => Promise<T>): T | null {
  const [state, setState] = useState<{ key: string | null; value: T | null }>(() => ({ key, value: key ? cache.get(key) ?? null : null }));
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const run = async () => {
      try {
        const v = await load();
        cache.set(key, v);
        if (alive) setState({ key, value: v });
      } catch {
        // Relayer tidak terjangkau atau kota belum diindeks: pertahankan angka terakhir bila ada.
        if (alive) setState((s) => (s.key === key ? s : { key, value: cache.get(key) ?? null }));
      }
    };
    queueMicrotask(() => void run());
    const id = window.setInterval(() => void run(), POLL_MS);
    return () => { alive = false; window.clearInterval(id); };
    // `load` bergantung pada kunci yang sama; cukup bereaksi pada kunci.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!key) return null;
  return state.key === key ? state.value : cache.get(key) ?? null;
}

/** Skor kota (0..100), tahap, variasi jenis layanan, layanan aktif, dan level kekayaan, penghasilan, lalu lintas. */
export function useCityScore(vault?: Hex): CityScore | null {
  const key = vault ? vault.toLowerCase() : null;
  return usePolledByKey(key, scoreCache, () => getScore(vault as Hex));
}

/** Riwayat kota `days` hari terakhir (1..30) dengan totalnya. */
export function useCityHistory(vault?: Hex, days = 7): CityHistory | null {
  const key = vault ? `${vault.toLowerCase()}:${days}` : null;
  return usePolledByKey(key, historyCache, () => getHistory(vault as Hex, days));
}

/** Jumlah AUSD dalam satuan dasar (string, 6 desimal) menjadi angka AUSD. */
export const ausd = (raw?: string | null): number => {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n / 1e6 : 0;
};
