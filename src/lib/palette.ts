import type { DistrictKind } from "./types";

/** Warna aksen per jenis distrik. Dipakai di adegan 3D dan di UI supaya keduanya senada. */
export const DISTRICT_COLORS: Record<DistrictKind, string> = {
  idle: "#9aa6cf",
  lending: "#3f6bff",
  vault: "#7a5cff",
  staking: "#10b3a3",
  arena: "#f59e0b",
  market: "#ec4899",
};

export const DISTRICT_NAMES: Record<DistrictKind, string> = {
  idle: "Plaza",
  lending: "Lending district",
  vault: "Vault district",
  staking: "Staking tower",
  arena: "Arena",
  market: "Market",
};
