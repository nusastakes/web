export type Hex = `0x${string}`;

/** Jenis distrik di kota. Tiap adapter di vault menjadi satu distrik; dana yang belum dialokasikan menjadi alun-alun. */
export type DistrictKind = "idle" | "lending" | "vault" | "staking" | "arena" | "market";

export interface District {
  id: string;
  kind: DistrictKind;
  label: string;
  /** Nama protokol atau sumber di balik distrik. */
  protocol?: string;
  /** Bagian dari total aset kota, 0..1. */
  weight: number;
  /** Aset di distrik ini, dalam AUSD. */
  assets: number;
  /** APY dalam basis poin, bila diketahui. */
  apyBps: number | null;
  /** True bila yield-nya disimulasikan (mengikuti APY mainnet), bukan dari protokol sungguhan. */
  simulated: boolean;
  adapter?: Hex;
  /** Layanan protokol dari katalog (TC67) bila adapter ini cermin dari satu protokol Monad. */
  serviceId?: string;
  category?: "bank" | "vault" | "staking" | "market";
  /** TVL protokol aslinya di mainnet (dolar), dari katalog. */
  protocolTvlUsd?: number | null;
  /** True bila adapter bersetelan (TunedMirrorAdapter): walikota bisa menyetel layanan ini sebatas hak penyetor di protokolnya. */
  tunable?: boolean;
  /** True bila vault mengkarantina adapter ini (nilainya gagal dibaca); siapa pun bisa memulihkannya begitu terbaca lagi. */
  quarantined?: boolean;
}

export interface CityView {
  id: string;
  name: string;
  community: string;
  /** Id berkas peta di /maps/<mapId>.city.json. */
  mapId: string;
  mayor?: Hex;
  vault?: Hex;
  feeBps: number;
  totalAssets: number;
  /** Harga satu share dalam AUSD (mulai 1). */
  sharePrice: number;
  /** Jumlah penduduk; undefined bila belum diindeks. */
  residents?: number;
  createdAt?: number;
  districts: District[];
  /** True untuk kota contoh yang bukan dari chain. */
  preview: boolean;
}
