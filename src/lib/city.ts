import type { CityView } from "./types";

/** APY gabungan kota (rata-rata berbobot dana), dalam basis poin. Dana yang menganggur dihitung 0. */
export function cityApyBps(city: CityView): number | null {
  let sum = 0, any = false;
  for (const d of city.districts) {
    if (d.apyBps !== null && d.weight > 0) { sum += d.apyBps * d.weight; any = true; }
  }
  return any ? Math.round(sum) : null;
}

/** Imbal hasil sejak berdiri, dalam persen. */
export const sinceFoundingPct = (city: CityView) => (city.sharePrice - 1) * 100;

export const hasSimulated = (city: CityView) => city.districts.some((d) => d.simulated && d.weight > 0);
