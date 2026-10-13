import { defineChain, fallback, http } from "viem";
import deployment from "./deployment.json";
import type { Hex } from "./types";

const env = (v: string | undefined, fallback: string) => (v && v.trim() ? v.trim() : fallback);

export const RPC_URL = env(process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC, "https://testnet-rpc.monad.xyz");
/** RPC cadangan: RPC publik testnet menolak permintaan saat ramai, jadi baca dan kirim pindah ke endpoint lain. */
export const RPC_FALLBACKS = env(process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC_FALLBACKS, "https://rpc.ankr.com/monad_testnet,https://monad-testnet.drpc.org")
  .split(",").map((u) => u.trim()).filter((u) => /^https:\/\//.test(u) && u !== RPC_URL);
export const rpcTransport = () => (RPC_FALLBACKS.length ? fallback([http(RPC_URL), ...RPC_FALLBACKS.map((u) => http(u))], { rank: false, retryCount: 2 }) : http(RPC_URL));
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
  marketplace: deployment.contracts.AgentMarketplace as Hex,
  /** Loket kota untuk pengguna luar (Panggung; prediksi dikunci di kontrak). */
  cityServices: deployment.contracts.CityServices as Hex,
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
