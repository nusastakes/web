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

/** Bahasa saat ini di luar komponen React (adegan 3D, pesan galat, langkah transaksi). Dibaca saat teks ditampilkan. */
export const currentLang = (): Lang => (typeof window === "undefined" ? "en" : read());

/** Teks menurut bahasa saat ini, untuk kode di luar React: `tr("Plaza", "Alun-alun")`. */
export const tr = (en: string, id: string): string => (currentLang() === "id" ? id : en);

/**
 * Istilah tetap dua bahasa. Saat toggle EN semua teks berbahasa Inggris, saat ID semua berbahasa Indonesia (arahan user
 * 14 Okt); nama staf AI dan tempat kota tidak dibiarkan dalam bahasa lain.
 */
export const TERMS = {
  en: { guard: "Security Guard", analyst: "Analyst", pr: "Public Relations", aiStaff: "AI staff", plaza: "Plaza", stage: "Stage", counter: "Service counter", townHall: "Town hall", mayor: "Mayor", resident: "Resident", residents: "Residents" },
  id: { guard: "Satpam", analyst: "Analis", pr: "Humas", aiStaff: "Staf AI", plaza: "Alun-alun", stage: "Panggung", counter: "Loket", townHall: "Balai kota", mayor: "Walikota", resident: "Penduduk", residents: "Penduduk" },
} as const satisfies Record<Lang, Record<string, string>>;
export type Term = keyof (typeof TERMS)["en"];
export const term = (k: Term, lang: Lang = currentLang()): string => TERMS[lang][k];

export function useLang(): [Lang, (l: Lang) => void] {
  const lang = useSyncExternalStore(subscribe, read, () => "en" as Lang);
  const set = useCallback((l: Lang) => { try { localStorage.setItem(KEY, l); } catch { /* abaikan */ } listeners.forEach((cb) => cb()); }, []);
  return [lang, set];
}
