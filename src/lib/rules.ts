"use client";

import { RELAYER_URL } from "./config";
import type { Hex } from "./types";

/**
 * Aturan walikota (vault TC67.10): "jika kondisi, maka aksi", ditulis walikota sendiri; toggle bawaan hanyalah aturan
 * siap pakai. Relayer menyimpan aturan dengan tanda tangan walikota dan menjalankannya lewat autopilot, yaitu kunci
 * wakil kota (session key) yang dibatasi kontrak: hanya memindah dana antar layanan dan menyetel layanan, tidak bisa
 * menarik dana, dengan batas per pindah dan per jam.
 */

export type Metric = "apy" | "apyGap" | "cashPct" | "borrowApy" | "loopSpread" | "outOfRange" | "tvl";
export type Op = "<" | ">";
/** Id layanan katalog, atau pemilih: "any", "worst", "largest" (kondisi); "cash", "worst", "largest", "match" (asal); "cash", "best" (tujuan). */
export type Place = string;

export interface RuleWhen { metric: Metric; service?: string; other?: string; op: Op; value: number }
export type RuleThen =
  | { action: "move"; from: Place; to: Place; pct: number }
  | { action: "tune"; service: string; set: { loopX100?: number; takeRewards?: boolean; rangeBps?: number; recenter?: boolean } };
export interface Rule { id: string; name: string; enabled: boolean; when: RuleWhen; then: RuleThen; cooldownMin: number; preset?: string }

/** Satu tindakan autopilot (relayer `serializeAction`), dengan `hash` transaksi dan `planHash` alasannya. */
export interface RuleAction {
  at: number; ruleId: string; kind: "move" | "tune" | string; hash?: Hex; planHash?: Hex;
  from?: string; to?: string; fromService?: string | null; toService?: string | null; amount?: string; service?: string;
}
export interface RulesStatus {
  vault: Hex; rules: Rule[]; rulesJson: string; nonce: string; updatedAt: number | null;
  status: {
    autopilot: Hex | null; enabled: boolean; autopilotIsSessionKey: boolean; sessionKey: Hex | null; sessionKeyExpiry: number | null;
    lastRun: number | null; recent: RuleAction[]; errors: { at: number; rule?: string; error: string }[];
  };
}
export interface Preset { id: string; name: string; description: string; rules: Rule[] }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RELAYER_URL}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Relayer error (${res.status})`);
  return data as T;
}

export const getRules = (city: Hex) => req<RulesStatus>(`/rules/${city}`);
export const getPresets = () => req<{ presets: Preset[] }>(`/rules/presets`);
/** `rulesJson` harus persis string yang di-hash untuk tanda tangan (`rulesHash = keccak256(utf8(rulesJson))`). */
export const putRules = (city: Hex, body: { vault: Hex; rulesJson: string; nonce: string; signature: Hex }) =>
  req<{ vault: Hex; rules: Rule[]; nonce: string; rulesHash: Hex }>(`/rules/${city}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** Aturan bawaan bila relayer tidak terjangkau; isinya sama dengan relayer `autopilot.mjs` PRESETS. */
export const FALLBACK_PRESETS: Preset[] = [
  { id: "chase-apy", name: "Chase the best rate", description: "When the worst funded service earns more than 1 point less than the best one, move a quarter of it to the best.", rules: [{ id: "chase-apy", name: "Chase the best rate", enabled: true, when: { metric: "apyGap", service: "worst", op: ">", value: 100 }, then: { action: "move", from: "worst", to: "best", pct: 25 }, cooldownMin: 60 }] },
  { id: "keep-cash-20", name: "Keep about 20% cash", description: "Below 15% cash, bring 10% of the largest service back to cash; above 30% cash, put 10% of the cash to work in the best service.", rules: [
    { id: "cash-low", name: "Refill cash", enabled: true, when: { metric: "cashPct", op: "<", value: 1500 }, then: { action: "move", from: "largest", to: "cash", pct: 10 }, cooldownMin: 30 },
    { id: "cash-high", name: "Put idle cash to work", enabled: true, when: { metric: "cashPct", op: ">", value: 3000 }, then: { action: "move", from: "cash", to: "best", pct: 10 }, cooldownMin: 30 },
  ] },
  { id: "brake", name: "Brake when a rate collapses", description: "When a funded service earns less than 3% a year, bring half of it back to cash.", rules: [{ id: "brake", name: "Brake", enabled: true, when: { metric: "apy", service: "any", op: "<", value: 300 }, then: { action: "move", from: "match", to: "cash", pct: 50 }, cooldownMin: 120 }] },
  { id: "recenter", name: "Re-centre the Uniswap range", description: "When the MON price leaves the Uniswap position's range, re-centre the range on the current price.", rules: [{ id: "recenter", name: "Re-centre", enabled: true, when: { metric: "outOfRange", service: "uniswap-wmon-usdc", op: ">", value: 0 }, then: { action: "tune", service: "uniswap-wmon-usdc", set: { recenter: true } }, cooldownMin: 30 }] },
  { id: "unwind-loop", name: "Unwind a losing loop", description: "When borrowing on Neverland costs more than the deposit earns, take the loop back to 1x.", rules: [{ id: "unwind-loop", name: "Unwind loop", enabled: true, when: { metric: "loopSpread", service: "neverland-ausd", op: "<", value: 0 }, then: { action: "tune", service: "neverland-ausd", set: { loopX100: 100 } }, cooldownMin: 60 }] },
];

export const RULES_DOMAIN = { name: "Nusastakes", version: "1", chainId: 10143 } as const;
