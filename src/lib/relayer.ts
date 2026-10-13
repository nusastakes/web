import { RELAYER_URL } from "./config";
import type { Hex } from "./types";

export class RelayerError extends Error {
  constructor(message: string, public status: number, public retryAfterSeconds?: number) {
    super(message);
    this.name = "RelayerError";
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${RELAYER_URL}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new RelayerError("The relayer is not reachable. Deposits and withdrawals need it to pay gas.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new RelayerError((data as { error?: string }).error || `Relayer error (${res.status})`, res.status, (data as { retryAfterSeconds?: number }).retryAfterSeconds);
  }
  return data as T;
}

export interface Health { ok: boolean; relayer: string; balanceWei: string; block: string; factory: string; faucetEnabled?: boolean; gasDripEnabled?: boolean }
export interface TxResult { hash: Hex; status: string; gasUsed?: string }
export interface DepositResult extends TxResult { shares?: string; sharesOwner?: string }
export interface WithdrawResult extends TxResult { assets?: string; receiver?: string }

export const relayerHealth = () => call<Health>("/health");
export const requestAusd = (address: Hex) => call<TxResult>("/faucet", { address });
/**
 * Faucet AUSD yang sabar: kontrak faucet membatasi frekuensi permintaan untuk semua orang, jadi saat sedang penuh
 * relayer membalas 429 dengan `retryAfterSeconds` pendek. Kita menunggu lalu mencoba lagi (maksimal `maxAttempts`).
 */
export async function requestAusdPatient(address: Hex, onWait?: (secondsLeft: number, attempt: number) => void, maxAttempts = 6): Promise<TxResult> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await requestAusd(address);
    } catch (e) {
      const transient = e instanceof RelayerError && e.status === 429 && e.retryAfterSeconds !== undefined && e.retryAfterSeconds <= 60;
      if (!transient || attempt >= maxAttempts) throw e;
      const wait = Math.max(5, Math.ceil((e as RelayerError).retryAfterSeconds ?? 20));
      for (let s = wait; s > 0; s--) { onWait?.(s, attempt); await new Promise((r) => setTimeout(r, 1000)); }
    }
  }
}
export const requestGas = (address: Hex) => call<{ hash: Hex; amountWei: string }>("/gas-drip", { address });

/** Gaya kota yang disimpan relayer (hanya tampilan). */
export const getCityStyle = (vault: Hex) => call<{ code: string; nonce: string; onchain?: string | null }>(`/style/${vault}`);
export const postCityStyle = (p: { vault: Hex; code: string; nonce: string; signature: Hex }) => call<{ vault: Hex; code: string; nonce: string }>("/style", p);

// --- Buku strategi (ciphertext saja; relayer tidak bisa membacanya) ----------------------------------------------
export interface BookMeta { id: string; hash: Hex; bytes: number; createdAt: number }
export const getBook = (owner: Hex) => call<{ owner: Hex; nonce: string; entries: BookMeta[] }>(`/book/${owner}`);
export const getBookEntry = (owner: Hex, id: string) => call<BookMeta & { ciphertext: Hex }>(`/book/${owner}/${encodeURIComponent(id)}`);
export const putBook = (p: { owner: Hex; id: string; ciphertext: Hex; nonce: string; signature: Hex }) => call<BookMeta & { owner: Hex; nonce: string }>("/book", p);

// --- Staf AI, Analis, laporan, papan peringkat ------------------------------------------------------------------
export interface AgentInfo { id: "satpam" | "analis" | "humas"; name: string; role: number; roleName: string; address: Hex | null; kind: string; status: string; description: string }
export const getAgents = () => call<{ guardian: Hex; agents: AgentInfo[] }>("/agents");
/**
 * Bursa staf (kontrak v3): tiga staf tim dan agen komunitas. Teks agen komunitas (nama, deskripsi) tidak tepercaya:
 * hanya ditampilkan sebagai teks biasa.
 */
export interface HireVia {
  via: "marketplace"; contract: Hex; listingId: string; periods: number; expectedTerms: Hex; hook: Hex; data: Hex; asset: Hex; price: string; period: number;
}
export interface MarketAgent {
  source: "team" | "community" | string; id: string; name: string; description: string; roleId: number; role: string; wallet: Hex | null;
  status: string; hireable: boolean; hiredInCity: boolean;
  pricing: { model: string; asset?: Hex; price?: string; period?: number; listingId?: string };
  /** Hanya Satpam: izin langsung lewat `grantAgent` ke alamat penanda. */
  hire?: { contract: Hex; function: string; agent: Hex; role: number };
  hireVia?: HireVia;
  /** Identitas di ERC-8004 Identity Registry (testnet). `registry` berbentuk `eip155:<chain>:<alamat>`. */
  erc8004?: { agentId: string; agentURI?: string; owner?: Hex; registry?: string };
  /** Penilaian di Reputation Registry; `average` null bila belum ada. Respons tidak menandai penilaian `demo-seed` secara eksplisit. */
  reputation?: { count: number; average: number | null; clients: number };
}
export const getMarketplace = (city?: Hex) => call<{ marketplace: Hex; guardian: Hex; city?: Hex; count: number; agents: MarketAgent[] }>(`/marketplace${city ? `?city=${city}` : ""}`);
export interface ProposalInfo {
  proposalId: string; planHash: Hex; txHash?: Hex; status: "pending" | "approved" | "expired" | string;
  plan?: { from?: string; to?: string; amount?: string; reason?: string; [k: string]: unknown };
  [k: string]: unknown;
}
export const getProposals = (city: Hex) => call<{ city: Hex; analyst: Hex; proposals: ProposalInfo[] }>(`/proposals/${city}`);
export const runAnalyst = (city: Hex) => call<{ status: string; [k: string]: unknown }>("/analyst/run", { city });
export const getReport = (city: Hex, days = 7) => call<{ text?: string; title?: string; [k: string]: unknown }>(`/report/${city}?days=${days}`);
export interface LeaderRow { rank: number | null; ranked: boolean; vault: Hex; name: string; community: string; mayor: Hex; tvl: string; returnBps: number; pricePerShare: string; residents: number; createdAt: number }
export const getLeaderboard = () => call<{ asOf: number; minRankedTvl: string; cities: LeaderRow[] }>("/leaderboard");
export const getEconomy = () => call<Record<string, unknown>>("/economy");
export const getMetrics = () => call<Record<string, unknown>>("/metrics");

// --- Ukuran kota, riwayat kota, setelan layanan (TC67.8, TC67.10) --------------------------------------------------
/** Skor kota dari layanannya sendiri: variasi jenis, jumlah layanan aktif, dan ekonomi kota (relayer `score.mjs`). */
export interface CityScore {
  city: Hex; name: string; score: number; stage: "empty" | "village" | "town" | "city" | "metropolis"; crowd: number;
  variety: { kinds: string[]; of: number }; activeServices: number; economy: number;
  levels: { wealth: number; income: number; traffic: number };
  inputs: { tvl: string; income7d: string; yield7d: string; serviceFees7d: string; outsideTraffic7d: string; uniqueUsers7d: number; hires30d: number };
  formula: string;
}
export const getScore = (city: Hex) => call<CityScore>(`/score/${city}`);

/** Total riwayat kota (jumlah AUSD dalam satuan dasar, string). `outsideTraffic` dan `uniqueUsers` tanpa alamat walikota. */
export interface HistoryTotals {
  traffic: string; trafficCount: number; outsideTraffic: string; deposits: string; depositCount: number; withdrawals: string; withdrawalCount: number;
  netFlow: string; serviceVolume: string; serviceFees: string; serviceUses: number; feesReleased: string; rebalanceVolume: string; rebalanceCount: number;
  hires: number; hirePayments: string; feeMints: number; uniqueUsers: number;
}
export interface HistoryEvent { type: string; tx: Hex; block: string; ts: number; user?: Hex; amount?: string; [k: string]: unknown }
export interface CityHistory {
  city: Hex; name: string; mayor: Hex; days: number; from: number; to: number; truncated: boolean; totals: HistoryTotals;
  services: Record<string, { on: boolean; feeBps: number }>; tokens: { token: Hex; name?: string; symbol?: string; creator?: Hex; [k: string]: unknown }[];
  events: HistoryEvent[];
}
export const getHistory = (city: Hex, days = 7) => call<CityHistory>(`/history/${city}?days=${days}`);

/** Setelan satu layanan bersetelan: `abi.encode(uint8 version, uint16 loopX100, bool takeRewards, uint16 rangeBps, uint256 centerPriceE8)`. */
export interface Tuning { loopX100: number; takeRewards: boolean; rangeBps: number; centerPriceE8: string }
export interface TuningResult {
  effectiveApyBps: number; uncappedApyBps: number; inRange?: boolean | null;
  breakdown?: Record<string, unknown>;
  tuning?: Tuning; serviceId?: string; adapter?: Hex; vault?: Hex; onFeed?: { apyBps: number; updatedAt: number } | null;
}
export const getTuning = (adapter: Hex) => call<TuningResult>(`/tuning/${adapter}`);
export const previewTuning = (service: string, t: Tuning) =>
  call<TuningResult>(`/tuning/preview?service=${encodeURIComponent(service)}&loopX100=${t.loopX100}&takeRewards=${t.takeRewards}&rangeBps=${t.rangeBps}&centerPriceE8=${t.centerPriceE8}`);

export interface PermitSig { v: number; r: Hex; s: Hex }

export const relayDeposit = (p: { vault: Hex; owner: Hex; assets: bigint; deadline: bigint } & PermitSig) =>
  call<DepositResult>("/deposit", { ...p, assets: p.assets.toString(), deadline: p.deadline.toString() });

export const relayWithdraw = (p: { vault: Hex; owner: Hex; shares: bigint; deadline: bigint } & PermitSig) =>
  call<WithdrawResult>("/withdraw", { ...p, shares: p.shares.toString(), deadline: p.deadline.toString() });

/** Memecah tanda tangan 65 byte menjadi v, r, s untuk permit. */
export function splitSignature(sig: Hex): PermitSig {
  return {
    r: `0x${sig.slice(2, 66)}`,
    s: `0x${sig.slice(66, 130)}`,
    v: parseInt(sig.slice(130, 132), 16),
  };
}
