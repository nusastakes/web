"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useBalances, useHeldVaults } from "./hooks";
import type { CityView, Hex } from "./types";

/**
 * Panduan mulai untuk akun baru. Langkah inti ditentukan dari keadaan chain (saldo AUSD, kepemilikan share di kota mana
 * pun), jadi tetap benar di perangkat lain; yang disimpan di browser hanya preferensi tampilan (sapaan sudah dilihat,
 * panduan disembunyikan atau dilipat) dan apakah pengguna pernah melihat isi gedung.
 */

const KEY = "nusastakes.onb.v1";

export interface OnbState {
  /** Sapaan setelah masuk sudah ditutup. */
  welcomed: boolean;
  /** Pengguna menyembunyikan panduan. */
  hidden: boolean;
  /** Kartu panduan terbuka (bukan pil kecil). */
  open: boolean;
  /** Panduan pernah tampil dengan langkah inti belum selesai; hanya yang begini yang diberi ucapan selamat. */
  started: boolean;
  /** Langkah inti selesai dan ucapan selamat sudah ditutup. */
  done: boolean;
  /** Pernah membuka isi gedung. */
  looked: boolean;
}
const EMPTY: OnbState = { welcomed: false, hidden: false, open: true, started: false, done: false, looked: false };

// Penyimpanan kecil di luar React. Tetap bekerja di memori bila localStorage diblokir.
const listeners = new Set<() => void>();
let store: OnbState | null = null;
const load = (): OnbState => {
  if (store) return store;
  let loaded: OnbState;
  try { loaded = { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { loaded = { ...EMPTY }; }
  store = loaded;
  return loaded;
};
export function setOnb(patch: Partial<OnbState>) {
  store = { ...load(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* diblokir: tetap di memori */ }
  listeners.forEach((cb) => cb());
}
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { store = null; cb(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
};
export const useOnbState = (): OnbState => useSyncExternalStore(subscribe, load, () => EMPTY);

export type StepId = "account" | "money" | "deposit" | "look" | "mayor";
export interface OnbStep { id: StepId; done: boolean; optional: boolean }

export interface Onb {
  state: OnbState;
  /** Tampilkan panduan (kartu atau pil). */
  show: boolean;
  /** Tampilkan sapaan sekali setelah masuk. */
  welcome: boolean;
  /** Langkah inti selesai dalam sesi ini: tampilkan ucapan selamat. */
  celebrate: boolean;
  steps: OnbStep[];
  coreDone: number;
  coreTotal: number;
  /** Langkah inti pertama yang belum selesai. */
  active: StepId | null;
  /** Tombol dock yang perlu disorot. */
  highlight: "deposit" | "found" | null;
}

interface Input {
  address?: Hex;
  ready: boolean;
  citiesReady: boolean;
  cities: CityView[];
  current: CityView;
  mine?: CityView;
}

export function useOnboarding({ address, ready, citiesReady, cities, current, mine }: Input): Onb {
  const state = useOnbState();
  const owner = ready ? address : undefined;
  const live = useMemo(() => cities.filter((c) => c.vault).map((c) => c.vault as Hex).slice(0, 40), [cities]);
  const { balances } = useBalances(owner);
  const { held } = useHeldVaults(owner, live);

  const loaded = ready && citiesReady && balances !== undefined && held !== undefined;
  const deposited = (held?.length ?? 0) > 0;
  const money = deposited || (balances?.ausd ?? 0n) > 0n;

  const steps: OnbStep[] = [
    { id: "account", done: ready, optional: false },
    { id: "money", done: money, optional: false },
    { id: "deposit", done: deposited, optional: false },
    { id: "look", done: state.looked, optional: true },
    { id: "mayor", done: !!mine, optional: true },
  ];
  const core = steps.filter((s) => !s.optional);
  const coreDone = core.filter((s) => s.done).length;
  const complete = coreDone === core.length;

  useEffect(() => {
    if (!loaded) return;
    // Yang sudah lengkap sejak pertama dilihat (mis. membuka akunnya di perangkat lain) tidak perlu panduan.
    if (!complete && !state.started) setOnb({ started: true });
    else if (complete && !state.started && !state.done) setOnb({ done: true });
  }, [loaded, complete, state.started, state.done]);

  const active = core.find((s) => !s.done)?.id ?? null;
  const highlight = active === "deposit" && !current.preview && current.vault ? "deposit" : null;
  return {
    state,
    show: loaded && !state.done && !state.hidden,
    welcome: loaded && !state.welcomed && !state.done && !deposited,
    celebrate: loaded && complete && state.started && !state.done,
    steps, coreDone, coreTotal: core.length, active, highlight,
  };
}
