"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getCityStyle, postCityStyle } from "./relayer";
import { decodeStyle, encodeStyle, type CityStyle } from "./scene/themes";
import type { Hex } from "./types";
import type { WalletApi } from "./wallet";

/**
 * Gaya kota (tema dan karya sipil pilihan walikota). Hanya tampilan, tidak memengaruhi dana.
 *
 * Kota di chain: gaya dibaca dari relayer (`GET /style/:vault`), jadi semua penduduk melihat pilihan walikota. Walikota
 * menyimpannya dengan tanda tangan EIP-712 `CityStyle(vault, code, nonce)`; relayer memeriksa bahwa penanda tangan adalah
 * `vault.mayor()`. Kota contoh dan saat relayer tidak terjangkau: disimpan di browser. Tautan `?style=<kode>` hanya
 * untuk melihat.
 */

const STYLE_DOMAIN = { name: "Nusastakes", version: "1", chainId: 10143 } as const;
const STYLE_TYPES = { CityStyle: [{ name: "vault", type: "address" }, { name: "code", type: "string" }, { name: "nonce", type: "uint256" }] } as const;

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
function writeRaw(id: string, code: string) {
  try { localStorage.setItem(key(id), code); } catch { /* penyimpanan diblokir: abaikan */ }
  notify();
}

export type StyleSync = "local" | "loading" | "shared" | "saving" | "error";

export function useCityStyle(id: string | undefined, vault?: Hex, wallet?: WalletApi) {
  const stored = useSyncExternalStore(subscribe, () => (id ? readRaw(id) : ""), () => "");
  const fromUrl = useSyncExternalStore(noSubscribe, () => new URLSearchParams(location.search).get("style") ?? "", () => "");
  const [remote, setRemote] = useState<{ vault: string; code: string; nonce: bigint } | null>(null);
  const [sync, setSync] = useState<StyleSync>("local");
  const [error, setError] = useState<string>();

  // Baca gaya bersama dari relayer untuk kota di chain.
  useEffect(() => {
    if (!vault) return;
    let cancelled = false;
    getCityStyle(vault)
      .then((r) => { if (!cancelled) { setRemote({ vault, code: r.code, nonce: BigInt(r.nonce || "0") }); setSync("shared"); } })
      .catch(() => { if (!cancelled) { setRemote(null); setSync("local"); } });
    return () => { cancelled = true; };
  }, [vault]);

  const live = remote && remote.vault === vault ? remote : null;
  const code = fromUrl || (live && live.code ? live.code : stored);
  const style = useMemo(() => decodeStyle(code), [code]);

  const save = useCallback(async (next: CityStyle) => {
    if (!id) return;
    const nextCode = encodeStyle(next);
    writeRaw(id, nextCode);
    if (!vault || !wallet || wallet.status !== "ready" || !live) return;
    // Tampil langsung, lalu disimpan bersama; bila gagal tetap tersimpan di browser ini.
    const nonce = live.nonce + 1n;
    setRemote({ vault, code: nextCode, nonce });
    setSync("saving");
    setError(undefined);
    try {
      const signature = await wallet.signTypedData({ domain: STYLE_DOMAIN, types: STYLE_TYPES, primaryType: "CityStyle", message: { vault, code: nextCode, nonce } });
      const res = await postCityStyle({ vault, code: nextCode, nonce: nonce.toString(), signature });
      setRemote({ vault, code: res.code, nonce: BigInt(res.nonce) });
      setSync("shared");
    } catch (e) {
      setSync("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id, vault, wallet, live]);

  return { style, code: encodeStyle(style), save, fromLink: Boolean(fromUrl), sync: vault ? sync : ("local" as StyleSync), error };
}
