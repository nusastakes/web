import { defineChain } from "viem";
import deployment from "./deployment.json";
import type { Hex } from "./types";

const env = (v: string | undefined, fallback: string) => (v && v.trim() ? v.trim() : fallback);

export const RPC_URL = env(process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC, "https://testnet-rpc.monad.xyz");
export const EXPLORER = "https://testnet.monadvision.com";
export const RELAYER_URL = env(process.env.NEXT_PUBLIC_RELAYER_URL, "http://localhost:8787");

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "MonadVision", url: EXPLORER } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
  testnet: true,
});

export const ADDR = {
  ausd: deployment.asset.address as Hex,
  factory: env(process.env.NEXT_PUBLIC_FACTORY, deployment.contracts.CityFactory) as Hex,
  guardian: deployment.contracts.CityGuardian as Hex,
  apyFeed: deployment.contracts.ApyFeed as Hex,
  reserve: deployment.contracts.YieldReserve as Hex,
  mirrorAdapterImpl: deployment.contracts.MirrorYieldAdapter as Hex,
};

export const AUSD_DECIMALS = deployment.asset.decimals;
export const SOURCE_ID = deployment.sourceId as Hex;
export const SOURCE_LABEL = deployment.sourceLabel;

export const addressUrl = (a: string) => `${EXPLORER}/address/${a}`;
export const txUrl = (h: string) => `${EXPLORER}/tx/${h}`;

/** Peta bawaan yang bisa dipilih saat mendirikan kota. Disimpan di vault sebagai `preset:<id>`. */
export const MAP_PRESETS = [
  { id: "scbd-jakarta", name: "SCBD, Jakarta" },
  { id: "malioboro-jogja", name: "Malioboro, Yogyakarta" },
] as const;
