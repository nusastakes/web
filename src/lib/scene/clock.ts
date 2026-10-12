/**
 * Jam kota dan pola kegiatan harian. Satu hari kota berlangsung beberapa menit; pola diambil dari kebiasaan kota
 * Indonesia: jam sibuk pagi sekitar 07.00–09.30 dan sore 17.00–19.30, makan siang, pasar pagi, pedagang kaki lima
 * siang, warung tenda dan pasar malam selepas magrib, dan kota yang sepi lewat tengah malam.
 */

export type Phase = "Night" | "Dawn" | "Morning rush" | "Morning" | "Lunch" | "Afternoon" | "Evening rush" | "Evening" | "Late night";

const bump = (h: number, at: number, width: number) => Math.exp(-((h - at) ** 2) / (2 * width * width));
/** Jarak melingkar antarjam (24 jam). */
const wrap = (h: number) => ((h % 24) + 24) % 24;
const inRange = (h: number, from: number, to: number) => (from <= to ? h >= from && h < to : h >= from || h < to);

export class CityClock {
  /** Jam kota 0..24. */
  hour: number;
  /** Detik nyata per satu jam kota. */
  secondsPerHour = 16;
  paused = false;
  /** Hari ke berapa sejak halaman dibuka. */
  day = 0;
  /** Cuaca: otomatis (hujan sore sesekali, seperti musim hujan di Indonesia), selalu cerah, atau hujan. */
  weather: "auto" | "clear" | "rain" = "auto";

  constructor(startHour = 6.6) { this.hour = startHour; }

  update(dt: number) {
    if (this.paused) return;
    const next = this.hour + dt / this.secondsPerHour;
    if (next >= 24) this.day++;
    this.hour = wrap(next);
  }

  get label(): string {
    const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  get phase(): Phase {
    const h = this.hour;
    if (h < 4.5) return "Late night";
    if (h < 6) return "Dawn";
    if (h < 9.5) return "Morning rush";
    if (h < 11.3) return "Morning";
    if (h < 13.5) return "Lunch";
    if (h < 16.8) return "Afternoon";
    if (h < 19.5) return "Evening rush";
    if (h < 22.5) return "Evening";
    return "Night";
  }

  /** 0 malam, 1 siang penuh; peralihan halus saat fajar (05.00–06.30) dan senja (17.30–19.00). */
  get daylight(): number {
    const h = this.hour;
    if (h >= 6.5 && h <= 17.5) return 1;
    if (h > 5 && h < 6.5) return (h - 5) / 1.5;
    if (h > 17.5 && h < 19) return 1 - (h - 17.5) / 1.5;
    return 0;
  }

  /** Seberapa jingga cahaya (fajar dan senja). */
  get dusk(): number {
    const h = this.hour;
    return Math.max(bump(h, 6, 0.6), bump(h, 18.1, 0.7));
  }

  /** Permintaan perjalanan kerja (0..1). */
  commute(h = this.hour) { return Math.min(1, 0.08 + bump(h, 7.9, 0.9) + bump(h, 18.2, 1.0)); }
  /** Lalu lintas umum. */
  traffic(h = this.hour) { return inRange(h, 0.5, 5) ? 0.12 : Math.min(1, 0.35 + 0.65 * this.commute(h)); }
  /** Pesanan makanan dan ojek: puncak makan siang dan makan malam. */
  delivery(h = this.hour) { return inRange(h, 1, 6) ? 0.05 : Math.min(1, 0.2 + bump(h, 12.2, 0.9) + 0.9 * bump(h, 19.2, 1.2)); }
  /** Pejalan kaki di trotoar. */
  walkers(h = this.hour) { return inRange(h, 0.5, 5) ? 0.08 : Math.min(1, 0.35 + 0.45 * bump(h, 12.3, 1.3) + 0.4 * bump(h, 19.5, 1.6) + 0.3 * bump(h, 8, 1)); }
  /** Pedagang kaki lima dengan gerobak. */
  vendors(h = this.hour) { return inRange(h, 8.5, 22) ? 1 : 0; }
  /** Warung tenda dan pasar malam. */
  nightMarket(h = this.hour) { return inRange(h, 17.3, 24) || h < 0.8 ? 1 : 0; }
  /** Pelari pagi dan sore, keluarga di taman. */
  parkLife(h = this.hour) { return Math.min(1, 0.9 * bump(h, 6.2, 0.8) + bump(h, 16.8, 1.2)); }
  /** Bus beroperasi 05.00–23.00. */
  busService(h = this.hour) { return inRange(h, 5, 23); }
  /** Truk pengisian toko (pagi) dan truk sampah (subuh). */
  restock(h = this.hour) { return inRange(h, 5, 10.5); }
  garbage(h = this.hour) { return inRange(h, 3.8, 6.2); }
  /** Proyek konstruksi bekerja siang hari. */
  construction(h = this.hour) { return inRange(h, 7.5, 17.5); }
  /** Target hujan 0..1. Hari hujan (sekitar 4 dari 10) turun sore 14.30 sampai 17.30, kadang berlanjut gerimis malam. */
  rainTarget(h = this.hour): number {
    if (this.weather === "clear") return 0;
    if (this.weather === "rain") return 1;
    const r = Math.sin((this.day + 1) * 12.9898) * 43758.5453;
    const wet = r - Math.floor(r) < 0.42;
    if (!wet) return 0;
    if (h >= 14.5 && h < 17.5) return 1;
    if (h >= 17.5 && h < 20) return 0.35;
    return 0;
  }
  /** Toko buka. */
  shopsOpen(h = this.hour) { return inRange(h, 8, 21.5); }
}
