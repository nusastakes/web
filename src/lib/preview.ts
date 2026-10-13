import { staticCatalog, CATEGORY_KIND } from "./catalog";
import type { CityView, District } from "./types";

/**
 * Kota contoh untuk tampilan awal saat belum ada kota di chain. Semua angka di sini adalah data contoh, bukan data
 * onchain, dan UI selalu menandainya sebagai "Preview". Distrik contoh memakai layanan dari katalog (TC67).
 */
const CATALOG = staticCatalog();

function city(id: string, name: string, mapId: string, feeBps: number, sharePrice: number, residents: number, idle: number, svc: [string, number][]): CityView {
  const total = idle + svc.reduce((s, [, a]) => s + a, 0);
  const districts: District[] = [
    { id: "idle", kind: "idle", label: "Plaza", weight: idle / total, assets: idle, apyBps: null, simulated: false },
    ...svc.map(([sid, assets]): District => {
      const s = CATALOG.find((x) => x.id === sid)!;
      return {
        id: `svc-${sid}`, kind: CATEGORY_KIND[s.category], label: s.name, protocol: s.protocol, weight: assets / total, assets,
        apyBps: s.apyBps ?? 168, simulated: true, serviceId: s.id, category: s.category, protocolTvlUsd: s.tvlUsd,
      };
    }),
  ];
  return { id, name, community: "Sample community", mapId, feeBps, totalAssets: total, sharePrice, residents, preview: true, districts };
}

export const PREVIEW_CITIES: CityView[] = [
  city("preview-scbd", "SCBD Preview", "scbd-jakarta", 1000, 1.0042, 37, 2950, [["aave-ausd", 4300], ["euler-ausd", 2600], ["upshift-earnausd", 3800], ["curve-ausd-3pool", 2100], ["shmonad", 2670]]),
  city("preview-malioboro", "Malioboro Preview", "malioboro-jogja", 800, 1.0019, 21, 2026, [["morpho-grove", 3200], ["curvance-ausd", 2300], ["balancer-avusd", 1684]]),
];
