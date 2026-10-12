import type { CityView } from "./types";

/**
 * Kota contoh untuk tampilan awal saat belum ada kota di chain. Semua angka di sini adalah data contoh, bukan data
 * onchain, dan UI selalu menandainya sebagai "Preview".
 */
export const PREVIEW_CITIES: CityView[] = [
  {
    id: "preview-scbd",
    name: "SCBD Preview",
    community: "Sample community",
    mapId: "scbd-jakarta",
    feeBps: 1000,
    totalAssets: 18420,
    sharePrice: 1.0042,
    residents: 37,
    preview: true,
    districts: [
      { id: "idle", kind: "idle", label: "Plaza", weight: 0.16, assets: 2950, apyBps: null, simulated: false },
      { id: "lend", kind: "lending", label: "Lending district", protocol: "Morpho Grove x Steakhouse AUSD", weight: 0.58, assets: 10684, apyBps: 168, simulated: true },
      { id: "vault", kind: "vault", label: "Vault district", protocol: "Aave V3 AUSD", weight: 0.26, assets: 4786, apyBps: 310, simulated: true },
    ],
  },
  {
    id: "preview-malioboro",
    name: "Malioboro Preview",
    community: "Sample community",
    mapId: "malioboro-jogja",
    feeBps: 800,
    totalAssets: 9210,
    sharePrice: 1.0019,
    residents: 21,
    preview: true,
    districts: [
      { id: "idle", kind: "idle", label: "Plaza", weight: 0.22, assets: 2026, apyBps: null, simulated: false },
      { id: "lend", kind: "lending", label: "Lending district", protocol: "Morpho Grove x Steakhouse AUSD", weight: 0.78, assets: 7184, apyBps: 168, simulated: true },
    ],
  },
];
