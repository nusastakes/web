"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { decodeStyle, encodeStyle, type CityStyle } from "./scene/themes";

/**
 * Gaya kota (tema dan karya sipil pilihan walikota). Tahap ini disimpan di browser walikota dan bisa dibagikan lewat
 * tautan `?style=<kode>`. Supaya semua penduduk melihat gaya yang sama, penyimpanan bersama (tanda tangan walikota ke
 * relayer) masih harus ditambahkan: lihat TC55. Gaya hanya tampilan, tidak memengaruhi dana.
 */

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
};
const noSubscribe = () => () => undefined;
const key = (id: string) => `nusastakes.style.v1.${id.toLowerCase()}`;

function readRaw(id: string): string {
  try { return localStorage.getItem(key(id)) ?? ""; } catch { return ""; }
}

export function useCityStyle(id: string | undefined) {
  const stored = useSyncExternalStore(subscribe, () => (id ? readRaw(id) : ""), () => "");
  // Kode di tautan hanya untuk melihat; tidak disimpan.
  const fromUrl = useSyncExternalStore(noSubscribe, () => new URLSearchParams(location.search).get("style") ?? "", () => "");
  const code = fromUrl || stored;
  const style = useMemo(() => decodeStyle(code), [code]);
  const save = useCallback((next: CityStyle) => {
    if (!id) return;
    try { localStorage.setItem(key(id), encodeStyle(next)); } catch { /* penyimpanan diblokir: abaikan */ }
    notify();
  }, [id]);
  return { style, code: encodeStyle(style), save, fromLink: Boolean(fromUrl) };
}
