"use client";

import { useEffect, useRef, useState } from "react";
import type { SceneApi } from "./CityCanvas";
import { Card } from "./ui";
import { tr, useLang } from "@/lib/lang";

/**
 * Mode demo terskrip (untuk video dan juri): satu putaran sekitar 80 detik di kota contoh yang mengikuti alur 14 Okt
 * (vault TC67.10, naskah TC42): gedung adalah layanan protokol Monad, setor tanpa gas, setelan layanan, aturan dan
 * autopilot, staf AI di balai kota, evakuasi Satpam, loket untuk pengunjung yang fee-nya mengalir ke vault, dan ukuran
 * kota yang dihitung. Semua kejadian di sini adalah contoh tampilan, bukan transaksi.
 */

interface Beat { at: number; caption: { en: string; id: string }; run: (s: SceneApi) => void }

const BEATS: Beat[] = [
  {
    at: 0,
    caption: {
      en: "A city on Monad. Every building is a service: a position in a Monad protocol that the mayor runs for the residents.",
      id: "Sebuah kota di Monad. Setiap gedung adalah layanan: posisi di protokol Monad yang dijalankan walikota untuk penduduknya.",
    },
    run: (s) => { s.closeBuilding(); s.setWeather("clear"); s.setHour(7.6); s.setClockSpeed(16); s.resetCamera(); s.emit({ type: "deposit", amount: 500 }); },
  },
  {
    at: 7,
    caption: {
      en: "Residents deposit AUSD into the city with a passkey: no seed phrase, no gas. The city grows with its economy.",
      id: "Penduduk menyetor AUSD ke kota dengan passkey: tanpa seed phrase, tanpa gas. Kota tumbuh bersama ekonominya.",
    },
    run: (s) => { s.focusDistrict("idle"); s.emit({ type: "deposit", amount: 1200 }); },
  },
  {
    at: 14,
    caption: {
      en: "The mayor tunes each service with a depositor's own rights there: a loop on Neverland, reward tokens on Aave, a price range on Uniswap.",
      id: "Walikota menyetel tiap layanan sebatas hak penyetor di protokol itu: looping di Neverland, token hadiah di Aave, rentang harga di Uniswap.",
    },
    run: (s) => { s.emit({ type: "transfer", from: "idle", to: "lend", amount: 1200, label: tr("Mayor puts funds to work", "Walikota mengerjakan dana") }); s.focusDistrict("lend"); },
  },
  {
    at: 23,
    caption: {
      en: "The mayor writes rules, or switches on ready-made ones. The autopilot is a limited key: it moves and tunes the city's money, never withdraws it.",
      id: "Walikota menulis aturan sendiri, atau menyalakan aturan siap pakai. Autopilot adalah kunci terbatas: ia memindah dan menyetel dana kota, tidak pernah menariknya.",
    },
    run: (s) => { s.emit({ type: "agenda", kind: "deputy", text: tr("Mayor allows the autopilot for 7 days", "Walikota mengizinkan autopilot selama 7 hari") }); s.focusDistrict("vault"); },
  },
  {
    at: 30,
    caption: {
      en: "A rule fires: the autopilot moves funds to the best rate by itself. Every move is a transaction anyone can check.",
      id: "Sebuah aturan terpicu: autopilot memindah dana ke bunga terbaik dengan sendirinya. Setiap pemindahan adalah transaksi yang bisa dicek siapa pun.",
    },
    run: (s) => { s.emit({ type: "transfer", from: "lend", to: "vault", amount: 800, tone: "violet", label: tr("Autopilot: chase the best rate", "Autopilot: kejar bunga terbaik") }); },
  },
  {
    at: 36,
    caption: {
      en: "Inside the town hall: the mayor at work and the AI staff, each a hired service with ratings on chain.",
      id: "Di dalam balai kota: walikota bekerja bersama staf AI, masing-masing layanan sewaan dengan penilaian di chain.",
    },
    run: (s) => { s.openTownHall(); },
  },
  {
    at: 47,
    caption: {
      en: "The Security Guard, a Chainlink CRE workflow, sees risk and pulls the funds back to the plaza. It can never send them anywhere else.",
      id: "Satpam, workflow Chainlink CRE, melihat risiko dan menarik dana kembali ke alun-alun. Ia tidak pernah bisa mengirimnya ke tempat lain.",
    },
    run: (s) => { s.closeBuilding(); s.emit({ type: "alert", at: "lend", amount: 900, label: tr("Security Guard: evacuating the lending district", "Satpam: mengevakuasi distrik pinjaman") }); s.focusDistrict("lend"); },
  },
  {
    at: 56,
    caption: {
      en: "Cities also sell services to visitors, like a token launchpad. Fees stream into the vault, so residents earn them; the mayor only shares their profit.",
      id: "Kota juga menjual layanan untuk pengunjung, seperti peluncur token. Fee mengalir ke vault sehingga dinikmati penduduk; walikota hanya mendapat bagian dari keuntungan mereka.",
    },
    run: (s) => { s.emit({ type: "festival", at: "vault", label: tr("Stage: a visitor launches a token", "Panggung: pengunjung meluncurkan token") }); s.emit({ type: "harvest", amount: 12.4 }); s.focusDistrict("vault"); },
  },
  {
    at: 64,
    caption: {
      en: "A city's size is computed from what happens in it: kinds of services, how many are used, and its own money.",
      id: "Ukuran kota dihitung dari yang terjadi di dalamnya: jenis layanan, berapa yang dipakai, dan uangnya sendiri.",
    },
    run: (s) => { s.setHour(19.4); s.emit({ type: "fireworks" }); s.resetCamera(); },
  },
  {
    at: 72,
    caption: {
      en: "That is Nusastakes. Sign in with a passkey to deposit, or found your own city.",
      id: "Itulah Nusastakes. Masuk dengan passkey untuk menyetor, atau dirikan kota sendiri.",
    },
    run: () => undefined,
  },
];
const LENGTH = 80;

export default function DemoDirector({ api, running, onStop, onBefore }: { api: SceneApi | null; running: boolean; onStop: () => void; onBefore: () => void }) {
  const [t, setT] = useState(0);
  const [lang] = useLang();
  const done = useRef(new Set<number>());
  const start = useRef(0);

  useEffect(() => {
    if (!running || !api) return;
    onBefore();
    done.current.clear();
    start.current = performance.now();
    const id = window.setInterval(() => {
      const sec = (performance.now() - start.current) / 1000;
      setT(sec);
      BEATS.forEach((b, i) => { if (sec >= b.at && !done.current.has(i)) { done.current.add(i); b.run(api); } });
      if (sec >= LENGTH) { window.clearInterval(id); onStop(); }
    }, 250);
    return () => window.clearInterval(id);
  }, [running, api, onStop, onBefore]);

  if (!running) return null;
  const beat = [...BEATS].reverse().find((b) => t >= b.at) ?? BEATS[0];
  const idx = BEATS.indexOf(beat);
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-24 z-30 flex justify-center sm:bottom-28">
      <Card solid className="pointer-events-auto w-full max-w-[640px] px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">{idx + 1}/{BEATS.length}</span>
          <p className="min-w-0 flex-1 text-sm leading-snug text-ink">{beat.caption[lang]}</p>
          <button onClick={onStop} className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-ink-soft hover:bg-slate-900/5">{lang === "id" ? "Berhenti" : "Stop"}</button>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-900/5"><div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${Math.min(100, (t / LENGTH) * 100)}%` }} /></div>
        <p className="mt-1 text-[10px] text-ink-soft">{lang === "id" ? "Demo dengan kejadian contoh, bukan transaksi." : "Demo with sample events, not transactions."}</p>
      </Card>
    </div>
  );
}
