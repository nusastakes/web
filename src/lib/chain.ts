import { loadCatalog, serviceBySource, CATEGORY_KIND } from "./catalog";
import { parseOsmUri } from "./osm";
import { createPublicClient } from "viem";
import { adapterAbi, apyFeedAbi, erc20Abi, factoryAbi, tunedAdapterAbi, vaultAbi } from "./abis";
import { ADDR, SOURCE_ID, monadTestnet, rpcTransport } from "./config";
import { ausdToNumber } from "./format";
import type { CityView, District, Hex } from "./types";

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: rpcTransport(),
  batch: { multicall: true },
});

const HIDDEN_CITY = /\(ignore\)/i;
/** `?all=1` menampilkan juga kota uji (untuk debug). Hanya dibaca di klien, setelah mount. */
const showAll = () => typeof location !== "undefined" && new URLSearchParams(location.search).has("all");

/** `preset:<id>` menunjuk peta bawaan; `osm:<lat>,<lon>` atau `osm:<lat>,<lon>@<ukuran>` area asli dari OpenStreetMap (R24); lainnya peta bawaan. */
export function mapIdFromUri(uri: string): string {
  if (uri.startsWith("preset:")) return uri.slice("preset:".length);
  if (parseOsmUri(uri)) return uri;
  return "scbd-jakarta";
}

interface ApyInfo { apyBps: number; observedAt: number; label: string }

async function readApy(sourceIds: Hex[]): Promise<Map<Hex, ApyInfo>> {
  const out = new Map<Hex, ApyInfo>();
  if (sourceIds.length === 0) return out;
  const res = await publicClient.multicall({
    allowFailure: true,
    contracts: sourceIds.flatMap((id) => [
      { address: ADDR.apyFeed, abi: apyFeedAbi, functionName: "latest", args: [id] } as const,
      { address: ADDR.apyFeed, abi: apyFeedAbi, functionName: "sourceLabel", args: [id] } as const,
    ]),
  });
  sourceIds.forEach((id, i) => {
    const latest = res[i * 2];
    const label = res[i * 2 + 1];
    if (latest.status === "success") {
      const [apyBps, observedAt] = latest.result as readonly [number, bigint, bigint];
      out.set(id, { apyBps, observedAt: Number(observedAt), label: label.status === "success" ? (label.result as string) : "" });
    }
  });
  return out;
}

/** Semua kota di factory, dengan distrik yang diturunkan dari adapter dan saldo idle. Satu putaran multicall. */
export async function loadCities(): Promise<CityView[]> {
  const count = await publicClient.readContract({ address: ADDR.factory, abi: factoryAbi, functionName: "cityCount" });
  if (count === 0n) return [];
  const infos = await publicClient.readContract({
    address: ADDR.factory,
    abi: factoryAbi,
    functionName: "cityInfos",
    args: [0n, count > 60n ? 60n : count],
  });

  const reads = infos.flatMap((c) => [
    { address: ADDR.ausd, abi: erc20Abi, functionName: "balanceOf", args: [c.vault] } as const,
    ...c.adapters.flatMap((a) => [
      { address: a, abi: adapterAbi, functionName: "totalAssets" } as const,
      { address: a, abi: adapterAbi, functionName: "isSimulated" } as const,
      { address: a, abi: adapterAbi, functionName: "sourceId" } as const,
      // Hanya adapter bersetelan yang punya `baseSourceId`; adapter lain gagal di sini, dan itu wajar.
      { address: a, abi: tunedAdapterAbi, functionName: "baseSourceId" } as const,
      // Adapter yang dikarantina vault (nilainya tidak terbaca) tidak dihitung di total aset sampai dipulihkan.
      { address: c.vault, abi: vaultAbi, functionName: "quarantined", args: [a] } as const,
    ]),
  ]);
  const res = await publicClient.multicall({ allowFailure: true, contracts: reads });

  let cursor = 0;
  const parsed = infos.map((c) => {
    const idle = res[cursor++];
    const adapters = c.adapters.map((a) => {
      const total = res[cursor++];
      const sim = res[cursor++];
      const src = res[cursor++];
      const base = res[cursor++];
      const q = res[cursor++];
      return {
        address: a as Hex,
        assets: total.status === "success" ? (total.result as bigint) : 0n,
        simulated: sim.status === "success" ? Boolean(sim.result) : false,
        sourceId: (src.status === "success" ? src.result : null) as Hex | null,
        baseSourceId: (base.status === "success" ? base.result : null) as Hex | null,
        quarantined: q.status === "success" ? Boolean(q.result) : false,
      };
    });
    return { c, idle: idle.status === "success" ? (idle.result as bigint) : 0n, adapters };
  });

  const sourceIds = [...new Set(parsed.flatMap((p) => p.adapters.map((a) => a.sourceId).filter(Boolean) as Hex[]))];
  const [apys, catalog] = await Promise.all([readApy(sourceIds.length ? sourceIds : [SOURCE_ID]), loadCatalog()]);

  return parsed
    .filter(({ c }) => showAll() || !HIDDEN_CITY.test(c.name))
    .map(({ c, idle, adapters }) => {
      const sum = idle + adapters.reduce((s, a) => s + a.assets, 0n);
      const w = (v: bigint) => (sum === 0n ? 0 : Number(v) / Number(sum));
      const districts: District[] = [
        { id: "idle", kind: "idle", label: "Plaza", weight: sum === 0n ? 1 : w(idle), assets: ausdToNumber(idle), apyBps: null, simulated: false },
        ...adapters.map((a, i): District => {
          // Adapter bersetelan memakai kunci feed miliknya sendiri (APY efektif dari setelan kota); layanannya dikenali
          // lewat `baseSourceId`. Sebelum keeper menulis kunci itu, APY dasar katalog yang ditampilkan.
          const apy = a.sourceId ? apys.get(a.sourceId) : undefined;
          const svc = serviceBySource(catalog, a.baseSourceId ?? a.sourceId);
          const tuned = Boolean(a.baseSourceId);
          const apyBps = tuned && !apy?.observedAt ? svc?.apyBps ?? null : apy?.apyBps ?? svc?.apyBps ?? null;
          // Adapter cermin yang dikenal katalog menjadi layanan protokol (Bank, Brankas, Menara Staking, Pasar); lainnya seperti dulu.
          if (svc && a.simulated) {
            return {
              id: a.address, kind: CATEGORY_KIND[svc.category], label: svc.name, protocol: svc.protocol,
              weight: w(a.assets), assets: ausdToNumber(a.assets), apyBps, simulated: true, adapter: a.address,
              serviceId: svc.id, category: svc.category, protocolTvlUsd: svc.tvlUsd, tunable: tuned, quarantined: a.quarantined,
            };
          }
          return {
            id: a.address,
            kind: a.simulated ? "lending" : "vault",
            label: a.simulated ? (adapters.filter((x) => x.simulated).length > 1 ? `Lending district ${i + 1}` : "Lending district") : "Vault district",
            protocol: a.simulated ? apy?.label || "Mirrored mainnet APY" : "ERC-4626 vault",
            weight: w(a.assets),
            assets: ausdToNumber(a.assets),
            apyBps: apy?.apyBps ?? null,
            simulated: a.simulated,
            adapter: a.address,
            quarantined: a.quarantined,
          };
        }),
      ];
      return {
        id: c.vault,
        vault: c.vault as Hex,
        name: c.name,
        community: c.community,
        mapId: mapIdFromUri(c.mapURI),
        mayor: c.mayor as Hex,
        feeBps: c.feeBps,
        totalAssets: ausdToNumber(c.totalAssets),
        sharePrice: Number(c.pricePerShare) / 1e18,
        createdAt: Number(c.createdAt),
        districts,
        preview: false,
      } satisfies CityView;
    });
}

export interface Position {
  shares: bigint;
  assets: bigint;
  ausd: bigint;
  maxDeposit: bigint;
  /** Jumlah distrik dalam mode hanya-tarik (karantina). */
  quarantined: number;
}

export async function readPosition(vault: Hex, owner: Hex): Promise<Position> {
  const [shares, ausd, maxDeposit, quarantined] = await publicClient.multicall({
    allowFailure: false,
    contracts: [
      { address: vault, abi: vaultAbi, functionName: "balanceOf", args: [owner] },
      { address: ADDR.ausd, abi: erc20Abi, functionName: "balanceOf", args: [owner] },
      { address: vault, abi: vaultAbi, functionName: "maxDeposit", args: [owner] },
      { address: vault, abi: vaultAbi, functionName: "quarantinedCount" },
    ],
  });
  const assets = shares > 0n ? await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "convertToAssets", args: [shares] }) : 0n;
  return { shares, assets, ausd, maxDeposit, quarantined: Number(quarantined) };
}

/** Vault yang dipegang `owner` (saldo share > 0); dipakai untuk tahu apakah ia sudah pernah menyetor ke kota mana pun. */
export async function readHeldVaults(vaults: Hex[], owner: Hex): Promise<Hex[]> {
  if (vaults.length === 0) return [];
  const res = await publicClient.multicall({
    allowFailure: true,
    contracts: vaults.map((v) => ({ address: v, abi: vaultAbi, functionName: "balanceOf" as const, args: [owner] as const })),
  });
  return vaults.filter((_, i) => res[i].status === "success" && (res[i].result as bigint) > 0n);
}

export async function readAusdBalance(owner: Hex): Promise<bigint> {
  return publicClient.readContract({ address: ADDR.ausd, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
}

export async function readMonBalance(owner: Hex): Promise<bigint> {
  return publicClient.getBalance({ address: owner });
}

export async function readLatestBlock(): Promise<bigint> {
  return publicClient.getBlockNumber();
}
