/**
 * Gaya kota yang dipilih walikota. Hanya tampilan: tidak mengubah dana, hasil, atau biaya apa pun.
 * Karya sipil (`works`) terbuka bertahap menurut perkembangan kota, jadi kota yang makin besar punya lebih banyak
 * yang bisa dipilih walikota untuk dipercantik.
 */

export type ThemeId = "classic" | "sakura" | "sunset" | "ocean" | "forest";
export type WorkId = "banner" | "fountain" | "flowers" | "bunting" | "market" | "statue" | "fireworks" | "ferris";

export interface Theme {
  id: ThemeId;
  label: string;
  /** Langit atas dan kaki langit. */
  sky: [string, string];
  /** Alas pulau, tanah, dan batu di bawahnya. */
  plate: string;
  soil: string;
  rock: string;
  trees: string[];
  flowers: string[];
  /** Taman dan atap tenda pasar. */
  park: string;
  awning: string[];
  flag: string[];
  /** Cahaya lampu jalan. */
  lamp: string;
  /** Warna dasar contoh untuk pilihan di UI. */
  swatch: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  classic: {
    id: "classic", label: "Classic", sky: ["#cfe0ff", "#eef1fb"], plate: "#e3e8fa", soil: "#cdb9a0", rock: "#8e98bb",
    trees: ["#6fcf97", "#5bc08a", "#7fd6a0", "#4fb57f", "#8fdc9f"], flowers: ["#ff8fab", "#ffd166", "#ffffff", "#b48cff"],
    park: "#c8ebd2", awning: ["#f26b57", "#4a8cf5", "#f8c746", "#52c79b"], flag: ["#3f6bff", "#ffffff", "#7a5cff"], lamp: "#ffe9a8", swatch: "#6fcf97",
  },
  sakura: {
    id: "sakura", label: "Sakura", sky: ["#ffd9e8", "#fff1f6"], plate: "#f6e4ee", soil: "#d4b7a8", rock: "#a590ad",
    trees: ["#f5b3cb", "#f08fb2", "#f9c9da", "#ee9ec0", "#ffd3e2"], flowers: ["#ff7aa8", "#ffffff", "#ffc2d6", "#ffb0c8"],
    park: "#e5f0d6", awning: ["#ee6f9b", "#ffffff", "#f7a6c1", "#c9a2e8"], flag: ["#ee6f9b", "#ffffff", "#f7a6c1"], lamp: "#ffd9bf", swatch: "#f08fb2",
  },
  sunset: {
    id: "sunset", label: "Sunset", sky: ["#ffc796", "#fff0dc"], plate: "#f3e5d2", soil: "#c9a27c", rock: "#9a7f86",
    trees: ["#f0a04b", "#e37f3a", "#f6c25c", "#d9692f", "#f2b66a"], flowers: ["#ff6b4a", "#ffd23f", "#ffffff", "#ff9e5e"],
    park: "#e8e6c3", awning: ["#e8553d", "#f6a63d", "#ffd166", "#8a4fff"], flag: ["#e8553d", "#ffd166", "#ffffff"], lamp: "#ffcf8a", swatch: "#f0a04b",
  },
  ocean: {
    id: "ocean", label: "Ocean", sky: ["#bfe8f6", "#eaf8fc"], plate: "#dcecf6", soil: "#b9c9c4", rock: "#6f93ad",
    trees: ["#4fc3b0", "#3aa99a", "#6fd3c0", "#2f9d8f", "#8ae0cf"], flowers: ["#4da3ff", "#ffffff", "#9be7ff", "#ffd166"],
    park: "#cdeee4", awning: ["#2f9fd8", "#ffffff", "#f6c445", "#35c3a5"], flag: ["#2f9fd8", "#ffffff", "#35c3a5"], lamp: "#d6f3ff", swatch: "#4fc3b0",
  },
  forest: {
    id: "forest", label: "Forest", sky: ["#cde9d3", "#f0f8ec"], plate: "#e0ead8", soil: "#bba88a", rock: "#7d8c78",
    trees: ["#3f9e5d", "#2f8a4f", "#58b36d", "#277a45", "#6cc47f"], flowers: ["#ffd23f", "#ff7a59", "#ffffff", "#c58bff"],
    park: "#bfe3c4", awning: ["#3f9e5d", "#f6c445", "#e8553d", "#ffffff"], flag: ["#2f8a4f", "#ffd166", "#ffffff"], lamp: "#fff0b8", swatch: "#3f9e5d",
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export interface WorkInfo {
  id: WorkId;
  label: string;
  blurb: string;
  /** Perkembangan kota (0..1) yang dibutuhkan untuk membukanya; lihat `developmentOf`. */
  unlockAt: number;
}

/** Karya sipil yang bisa dipilih walikota, berurutan dari yang paling awal terbuka. */
export const WORKS: WorkInfo[] = [
  { id: "banner", label: "City flag", blurb: "A flag on the town hall in the city's colours.", unlockAt: 0.04 },
  { id: "fountain", label: "Plaza fountain", blurb: "A stone fountain with a plume and benches in the nearest park.", unlockAt: 0.06 },
  { id: "flowers", label: "Flower beds", blurb: "Flowers in every park, in the theme's colours.", unlockAt: 0.12 },
  { id: "bunting", label: "Festival flags", blurb: "Flag poles along the avenue by the plaza.", unlockAt: 0.2 },
  { id: "market", label: "Weekend market", blurb: "A row of striped stalls with crates.", unlockAt: 0.25 },
  { id: "statue", label: "City monument", blurb: "A monument on a stepped plinth.", unlockAt: 0.35 },
  { id: "fireworks", label: "Fireworks", blurb: "Fireworks over the plaza every half minute.", unlockAt: 0.45 },
  { id: "ferris", label: "Ferris wheel", blurb: "A slowly turning landmark in the largest park.", unlockAt: 0.55 },
];

export interface CityStyle {
  theme: ThemeId;
  works: WorkId[];
}

export const DEFAULT_STYLE: CityStyle = { theme: "classic", works: ["banner", "fountain", "flowers"] };

/** `?unlock=1` di alamat halaman: semua karya sipil terbuka (hanya tampilan, untuk memeriksa tanpa menunggu dana kota tumbuh). */
export const unlockAllWorks = () => typeof location !== "undefined" && new URLSearchParams(location.search).has("unlock");

/** Dana (AUSD) kira-kira yang dibutuhkan untuk mencapai perkembangan `d`: kebalikan dari `developmentOf`. */
export const fundsForDevelopment = (d: number) => Math.round(40 * (Math.exp(d * Math.log(1 + 60000 / 40)) - 1));

/** Kode pendek yang bisa disimpan dan dibagikan: tema dan topeng bit karya, mis. "classic.0b00000111". */
export function encodeStyle(s: CityStyle): string {
  const mask = WORKS.reduce((m, w, i) => (s.works.includes(w.id) ? m | (1 << i) : m), 0);
  return `${s.theme}.${mask.toString(36)}`;
}

export function decodeStyle(code: string | null | undefined): CityStyle {
  if (!code) return { ...DEFAULT_STYLE, works: [...DEFAULT_STYLE.works] };
  const [theme, maskRaw] = code.split(".");
  const mask = parseInt(maskRaw ?? "", 36);
  if (!(theme in THEMES) || !Number.isFinite(mask)) return { ...DEFAULT_STYLE, works: [...DEFAULT_STYLE.works] };
  return { theme: theme as ThemeId, works: WORKS.filter((_, i) => mask & (1 << i)).map((w) => w.id) };
}

/**
 * Perkembangan 0..1 dari jumlah dana (AUSD): kota kosong di 0, setengah jadi di sekitar 1.000, nyaris penuh di 50.000.
 * Skala logaritmik supaya setoran pertama yang kecil pun sudah terlihat.
 */
export function developmentOf(assets: number): number {
  return Math.max(0, Math.min(1, Math.log(1 + Math.max(0, assets) / 40) / Math.log(1 + 60000 / 40)));
}
