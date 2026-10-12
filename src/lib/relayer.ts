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
export const requestGas = (address: Hex) => call<{ hash: Hex; amountWei: string }>("/gas-drip", { address });

/** Gaya kota yang disimpan relayer (hanya tampilan). */
export const getCityStyle = (vault: Hex) => call<{ code: string; nonce: string }>(`/style/${vault}`);
export const postCityStyle = (p: { vault: Hex; code: string; nonce: string; signature: Hex }) => call<{ vault: Hex; code: string; nonce: string }>("/style", p);

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
