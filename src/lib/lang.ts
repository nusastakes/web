"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Lang = "en" | "id";
const KEY = "nusastakes.lang.v1";

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; };

/** Bahasa pilihan; bila belum memilih, ikut bahasa browser (Indonesia atau Inggris). */
function read(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "en" || v === "id") return v;
  } catch { /* abaikan */ }
  return typeof navigator !== "undefined" && /^id\b/i.test(navigator.language) ? "id" : "en";
}

export function useLang(): [Lang, (l: Lang) => void] {
  const lang = useSyncExternalStore(subscribe, read, () => "en" as Lang);
  const set = useCallback((l: Lang) => { try { localStorage.setItem(KEY, l); } catch { /* abaikan */ } listeners.forEach((cb) => cb()); }, []);
  return [lang, set];
}
