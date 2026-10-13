"use client";

import { useSyncExternalStore } from "react";
import { ADDR, RELAYER_URL } from "./config";
import type { Hex } from "./types";

/**
 * Alamat kontrak hidup. Kontrak v3 dideploy ulang beberapa kali dalam sehari, jadi halaman membaca alamat terbaru dari
 * `GET /config` relayer (satu sumber untuk relayer, workflow CRE, dan web). `deployment.json` tetap sebagai cadangan
 * bila relayer tidak terjangkau. Pembacaan chain menunggu sampai sinkronisasi ini selesai (`useAddressesReady`).
 */

const isAddr = (v: unknown): v is Hex => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);

let state: "pending" | "live" | "static" = "pending";
const listeners = new Set<() => void>();
const settle = (s: "live" | "static") => { state = s; listeners.forEach((l) => l()); };

export async function syncAddresses(timeoutMs = 3000): Promise<void> {
  if (state !== "pending") return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${RELAYER_URL}/config`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`config ${res.status}`);
    const c = (await res.json()) as Record<string, unknown>;
    if (c.chainId !== 10143 || !isAddr(c.factory) || !isAddr(c.guardian) || !isAddr(c.feed) || !isAddr(c.reserve) || !isAddr(c.marketplace)) {
      throw new Error("unexpected /config");
    }
    // NEXT_PUBLIC_FACTORY, bila diisi, menang (uji lokal terhadap factory lain).
    if (!process.env.NEXT_PUBLIC_FACTORY?.trim()) ADDR.factory = c.factory;
    ADDR.guardian = c.guardian;
    ADDR.apyFeed = c.feed;
    ADDR.reserve = c.reserve;
    ADDR.marketplace = c.marketplace;
    // Alamat implementasi adapter belum ada di /config; dipakai bila relayer mengirimnya.
    const adapter = c.mirrorAdapterImpl ?? c.mirrorAdapter;
    if (isAddr(adapter)) ADDR.mirrorAdapterImpl = adapter;
    settle("live");
  } catch {
    settle("static");
  } finally {
    clearTimeout(timer);
  }
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
/** False sampai alamat dari relayer terbaca (atau cadangan dipakai); pembacaan chain menunggu ini. */
export const useAddressesReady = () => useSyncExternalStore(subscribe, () => state !== "pending", () => false);

if (typeof window !== "undefined") void syncAddresses();
