"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import brand from "@/lib/brand.json";
import { COPY } from "@/lib/copy";
import { fmtAusd, shortAddr } from "@/lib/format";
import { tr, useLang } from "@/lib/lang";
import { PREVIEW_CITIES } from "@/lib/preview";
import { getLeaderboard, getMetrics, type LeaderRow } from "@/lib/relayer";
import { useWallet } from "@/lib/wallet";
import type { SceneApi } from "./CityCanvas";
import { IconArrowDown, IconChart, IconInfo, IconKey, IconLock, IconLogo, IconSwap, IconUsers } from "./icons";
import { LangToggle } from "./LangToggle";
import { BookVisual, DepositVisual, KeysVisual, LegendVisual, MayorVisual, ProfitVisual, StaffVisual } from "./StoryVisuals";
import { Card, cx } from "./ui";

const CityCanvas = dynamic(() => import("./CityCanvas"), { ssr: false });

const HIDDEN = /\(ignore\)/i;
const INTRO_KEY = "nusastakes.intro.v1";
const markIntroSeen = () => { try { localStorage.setItem(INTRO_KEY, "1"); } catch { /* abaikan */ } };

type BeatKey = "intro" | "deposit" | "mayor" | "profit" | "passkey" | "book" | "staff";
const BEATS: { key: BeatKey; chapter: 1 | 2 | 3; icon: ReactNode }[] = [
  { key: "intro", chapter: 1, icon: <IconInfo /> },
  { key: "deposit", chapter: 2, icon: <IconArrowDown /> },
  { key: "mayor", chapter: 2, icon: <IconSwap /> },
  { key: "profit", chapter: 2, icon: <IconChart /> },
  { key: "passkey", chapter: 3, icon: <IconKey /> },
  { key: "book", chapter: 3, icon: <IconLock /> },
  { key: "staff", chapter: 3, icon: <IconUsers /> },
];
const STACK = ["Monad", "Mera passkeys", "Chainlink CRE", "ERC-4626", "OpenStreetMap", "three.js"];
const FUND_TOTAL = PREVIEW_CITIES[0].totalAssets;
const levelOf = (funds: number) => (funds < 40 ? 0 : funds < 1200 ? 1 : funds < 8000 ? 2 : funds < 30000 ? 3 : 4);

function useLive() {
  const [metrics, setMetrics] = useState<{ cities: number; mayors: number; residents: number; tvl: string } | null>(null);
  const [top, setTop] = useState<LeaderRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    getMetrics().then((m) => !cancelled && setMetrics(m as never)).catch(() => undefined);
    getLeaderboard().then((r) => !cancelled && setTop(r.cities.filter((c) => !HIDDEN.test(c.name)).slice(0, 3))).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  return { metrics, top };
}

export default function Landing() {
  const w = useWallet();
  const [lang] = useLang();
  const c = COPY[lang];
  const { metrics, top } = useLive();
  const api = useRef<SceneApi | null>(null);
  const city = PREVIEW_CITIES[0];
  const stage = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string>("hero");
  const [fund, setFund] = useState(1);
  const [scrolled, setScrolled] = useState(false);
  const [nearEnd, setNearEnd] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef("hero");
  const timers = useRef<number[]>([]);

  // Dana kota di adegan; nama distrik mengikuti bahasa supaya sama dengan legenda.
  const districts = useMemo(() => city.districts.map((d) => ({ ...d, assets: d.assets * fund, label: c.districts[d.id as "idle" | "lend" | "vault"] ?? d.label })), [city.districts, fund, c.districts]);

  /** Aksi di kota 3D untuk tiap langkah kisah. */
  const runBeat = useCallback((key: string) => {
    const s = api.current;
    if (!s) return;
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };
    s.setWeather("clear");
    if (key !== "book" && key !== "staff") s.closeBuilding();
    switch (key) {
      case "hero": setFund(1); s.setHour(7.4); s.resetCamera(); break;
      case "intro": setFund(1); s.setHour(10); s.resetCamera(); s.emit({ type: "transfer", from: "idle", to: "lend", amount: 600 }); break;
      case "deposit":
        s.setHour(9); setFund(0.2); s.focusDistrict("idle");
        later(1500, () => { setFund(1); s.emit({ type: "deposit", amount: 500 }); });
        later(5200, () => s.emit({ type: "deposit", amount: 1200 }));
        break;
      case "mayor":
        setFund(1); s.setHour(11);
        s.emit({ type: "transfer", from: "idle", to: "lend", amount: 1200 }); s.focusDistrict("lend");
        later(7000, () => { s.emit({ type: "transfer", from: "lend", to: "vault", amount: 800 }); s.focusDistrict("vault"); });
        break;
      case "profit":
        setFund(1); s.setHour(16.5); s.focusDistrict("idle");
        s.emit({ type: "harvest", amount: 12.4 });
        later(6000, () => s.emit({ type: "harvest", amount: 9.8 }));
        break;
      case "passkey": setFund(1); s.setHour(19.6); s.focusDistrict("idle"); s.emit({ type: "fireworks" }); break;
      case "book":
        setFund(1); s.setHour(11.5); s.openTownHall();
        s.emit({ type: "agenda", kind: "seal", text: tr("Mayor writes a sealed plan in the strategy book", "Walikota menulis rencana tersegel di buku strategi") });
        break;
      case "staff":
        setFund(1); s.setHour(12.5); s.openTownHall(); s.focusFloor(2);
        later(2500, () => s.emit({ type: "propose", id: "story", from: "lend", to: "vault", amount: 800 }));
        later(8000, () => s.emit({ type: "alert", at: "lend", amount: 900, label: tr("Security Guard: evacuating the lending district", "Satpam: mengevakuasi distrik pinjaman") }));
        break;
    }
  }, []);

  const onScene = useCallback((s: SceneApi | null) => {
    api.current = s;
    // Peta dimuat sesaat setelah adegan dibuat; jalankan langkah yang sedang aktif setelahnya.
    if (s) window.setTimeout(() => runBeat(activeRef.current), 2200);
  }, [runBeat]);

  // Langkah aktif mengikuti garis tengah layar.
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>("[data-beat]")];
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const key = (e.target as HTMLElement).dataset.beat!;
        if (key === activeRef.current) continue;
        activeRef.current = key;
        setActive(key);
        runBeat(key);
      }
    }, { rootMargin: "-42% 0px -42% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [runBeat]);

  // Kembali ke hero saat di-scroll ke atas.
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      if (window.scrollY < 120 && activeRef.current !== "hero") { activeRef.current = "hero"; setActive("hero"); runBeat("hero"); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [runBeat]);

  // Kota dijeda saat bagian bawah halaman (yang menutupi adegan) sedang dilihat.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => api.current?.setPaused(!e.isIntersecting), { rootMargin: "100px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Legenda tetap disembunyikan saat peralihan ke bagian bawah halaman sudah terlihat.
  useEffect(() => {
    const el = endRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNearEnd(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Hero: kota hidup sendiri dengan kejadian contoh.
  useEffect(() => {
    const script = [
      () => api.current?.emit({ type: "deposit", amount: 500 }),
      () => api.current?.emit({ type: "transfer", from: "idle", to: "lend", amount: 1200 }),
      () => api.current?.emit({ type: "festival", at: "vault", label: tr("Mayor's event", "Acara walikota") }),
      () => api.current?.emit({ type: "harvest", amount: 12.4 }),
    ];
    let i = 0;
    const id = window.setInterval(() => { if (activeRef.current === "hero") script[i++ % script.length](); }, 9000);
    const first = window.setTimeout(() => { if (activeRef.current === "hero") script[i++ % script.length](); }, 3500);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, []);

  const signedIn = w.status === "ready" || w.status === "locked";
  const hero = active === "hero";
  const showMini = !hero && active !== "intro" && !nearEnd;

  return (
    <div className="min-h-full bg-bg text-ink">
      <div ref={stage} className="relative">
        {/* Kota 3D menetap di latar sepanjang hero dan kisah; bagian di bawahnya menutupinya. */}
        <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
          <CityCanvas mapId={city.mapId} districts={districts} selectedId={null} onSelect={() => undefined} onScene={onScene} shift={-260} quiet={hero} />
          <div className={cx("absolute inset-0 transition-opacity duration-700 bg-[linear-gradient(90deg,rgba(238,241,251,0.96)_0%,rgba(238,241,251,0.85)_32%,rgba(238,241,251,0.15)_58%,rgba(238,241,251,0)_75%)] max-md:bg-[linear-gradient(180deg,rgba(238,241,251,0.6)_0%,rgba(238,241,251,0.92)_45%,rgba(238,241,251,0.95)_100%)]", hero ? "opacity-100" : "opacity-0")} />
        </div>

        {/* Bilah atas tetap: transparan di puncak, kapsul kaca setelah di-scroll */}
        <header className="fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-4">
          <div className={cx("mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-3 py-2 transition-all duration-300 sm:px-4", scrolled ? "glass" : "border border-transparent")}>
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white"><IconLogo width={19} height={19} /></span>
              <span className="text-base font-semibold tracking-tight">{brand.name}</span>
            </Link>
            <nav className="flex items-center gap-2">
              <LangToggle />
              <Link href="/city?demo=1" onClick={markIntroSeen} className="hidden rounded-xl px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink md:block">{c.nav.demo}</Link>
              {signedIn ? <Link href="/city" onClick={markIntroSeen} className="btn btn-primary">{c.nav.openCity}</Link> : <Link href="/signin" className="btn btn-primary"><IconKey /> {c.nav.signIn}</Link>}
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-center px-4 pb-10 pt-24 sm:px-6">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-accent shadow-sm backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {c.hero.badge}
          </span>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            {c.hero.h1[0]}<br /><span className="text-accent">{c.hero.h1[1]}</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">{c.hero.sub}</p>
          <p className="mt-2 text-sm font-semibold text-ink">{c.hero.plain}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={signedIn ? "/city" : "/signin?next=/city"} onClick={markIntroSeen} className="btn btn-primary !px-5 !py-3 text-base"><IconKey /> {signedIn ? c.hero.ctaEnter : c.hero.ctaStart}</Link>
            <Link href="/city?demo=1" onClick={markIntroSeen} className="btn btn-ghost !px-5 !py-3 text-base">▶ {c.hero.ctaDemo}</Link>
          </div>
          <div className="mt-8 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
            {[metrics?.cities, metrics?.mayors, metrics?.residents, metrics ? fmtAusd(Number(metrics.tvl) / 1e6) : undefined].map((v, i) => (
              <div key={i} className="glass rounded-2xl px-3 py-2.5">
                <div className="text-lg font-semibold">{v ?? "…"}</div>
                <div className="text-[11px] leading-tight text-ink-soft">{c.hero.stats[i]}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 hidden items-center gap-2 text-xs font-medium text-ink-soft md:flex"><IconArrowDown width={14} height={14} /> {lang === "id" ? "Scroll untuk melihat caranya" : "Scroll to see how it works"}</div>
        </section>

        {/* Kisah: tiap langkah menggerakkan kota di latar */}
        {BEATS.map((b, i) => {
          const copy = c.beats[b.key];
          const on = active === b.key;
          const first = BEATS[i - 1]?.chapter !== b.chapter;
          const list = BEATS.filter((x) => x.chapter === b.chapter);
          const last = i === BEATS.length - 1;
          return (
            <div key={b.key} className="relative z-10">
              {first && (
                <div className="mx-auto max-w-6xl px-4 pb-4 pt-20 sm:px-6">
                  <div className="inline-block max-w-xl rounded-3xl bg-white/85 px-5 py-4 shadow-sm backdrop-blur-md">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-accent">{c.chapters[b.chapter].tag}</div>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-4xl">{c.chapters[b.chapter].title}</h2>
                    <p className="mt-2 text-sm text-ink-soft sm:text-base">{c.chapters[b.chapter].lead}</p>
                  </div>
                </div>
              )}
              <section data-beat={b.key} className="mx-auto flex min-h-[92svh] max-w-6xl items-end px-4 pb-12 sm:items-center sm:px-6 sm:pb-0">
                <Card solid className={cx("w-full max-w-[440px] p-5 transition-all duration-500 sm:p-6", on ? "translate-y-0 opacity-100 shadow-xl" : "translate-y-3 opacity-75")}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-accent">{b.icon}<span className="text-xs font-semibold uppercase tracking-wide">{copy.label}</span></span>
                    {list.length > 1 && <span className="flex gap-1">{list.map((x) => <span key={x.key} className={cx("h-1.5 rounded-full transition-all duration-500", x.key === b.key ? "w-6 bg-accent" : "w-1.5 bg-slate-900/15")} />)}</span>}
                  </div>
                  <h3 className="mt-3 text-xl font-semibold leading-snug">{copy.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{copy.body}</p>
                  <div className="mt-3 rounded-xl border-l-4 border-accent bg-accent-soft/60 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-accent">{c.lookLabel}</div>
                    <div className="mt-0.5 text-[13px] leading-snug text-ink">{copy.look}</div>
                  </div>
                  {b.key === "intro" && (
                    <>
                      <div className="hidden md:block"><LegendVisual legend={c.legend} /></div>
                      <details className="mt-3 md:hidden"><summary className="cursor-pointer rounded-xl bg-slate-900/[0.04] px-3 py-2 text-xs font-semibold text-accent">{c.legend.title}</summary><LegendVisual legend={c.legend} /></details>
                    </>
                  )}
                  {b.key === "deposit" && <DepositVisual v={c.visuals} funds={on ? FUND_TOTAL * fund : 0} level={levelOf(on ? FUND_TOTAL * fund : 0)} />}
                  {b.key === "mayor" && <MayorVisual v={c.visuals} />}
                  {b.key === "profit" && <ProfitVisual v={c.visuals} />}
                  {b.key === "passkey" && <KeysVisual v={c.visuals} />}
                  {b.key === "book" && <BookVisual v={c.visuals} active={on} />}
                  {b.key === "staff" && <StaffVisual v={c.visuals} />}
                  {last && <Link href={signedIn ? "/city" : "/signin?next=/city"} onClick={markIntroSeen} className="btn btn-primary mt-4 w-full">{signedIn ? c.tryItIn : c.tryIt}</Link>}
                </Card>
              </section>
            </div>
          );
        })}

        {/* Legenda kecil yang tetap terlihat di layar lebar selama kisah */}
        <aside className={cx("pointer-events-none fixed bottom-5 right-5 z-20 hidden w-[230px] rounded-2xl glass p-3 transition-all duration-500 lg:block", showMini ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")} aria-hidden={!showMini}>
          <div className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">{c.legend.title}</div>
          <ul className="mt-1.5 space-y-1">
            {c.legend.items.map(([color, name]) => (
              <li key={name} className="flex items-center gap-2 text-[11px] text-ink"><span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white" style={{ background: color }} />{name}</li>
            ))}
          </ul>
        </aside>

        {/* Peralihan halus dari kota ke bagian bawah halaman, tanpa garis pembatas */}
        <div ref={endRef} className="pointer-events-none relative z-10 h-48 bg-gradient-to-b from-transparent to-bg" />
      </div>

      {/* Kota teratas */}
      <section className="relative z-10 bg-bg">
        <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{c.cities.title}</h2>
              <p className="mt-2 text-ink-soft">{c.cities.lead}</p>
            </div>
            <Link href="/city" onClick={markIntroSeen} className="btn btn-ghost">{c.cities.all}</Link>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {top.length === 0 && <p className="text-sm text-ink-soft">{c.cities.loading}</p>}
            {top.map((x, i) => (
              <Link key={x.vault} href="/city" onClick={markIntroSeen} className="rounded-2xl border border-slate-900/5 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-sm font-bold text-accent">{i + 1}</span>
                  <span className={x.returnBps > 0 ? "text-sm font-semibold text-good" : "text-sm font-semibold text-ink-soft"}>{(x.returnBps / 100).toFixed(2)}%</span>
                </div>
                <div className="mt-3 truncate text-base font-semibold">{x.name}</div>
                <div className="truncate text-xs text-ink-soft">{x.community || c.cities.none} · {c.cities.mayor} {shortAddr(x.mayor)}</div>
                <div className="mt-2 text-sm font-medium">{fmtAusd(Number(x.tvl) / 1e6)} AUSD · {x.residents} {x.residents === 1 ? c.cities.resident : c.cities.residents}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Ajakan */}
      <section className="relative z-10 bg-bg">
        <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="rounded-3xl bg-accent px-6 py-10 text-white sm:px-10">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{c.cta.title}</h2>
            <p className="mt-2 max-w-xl text-white/85">{c.cta.body}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={signedIn ? "/city" : "/signin?next=/city"} onClick={markIntroSeen} className="btn bg-white !px-5 !py-3 text-accent">{signedIn ? c.cta.found : c.cta.create}</Link>
              <Link href="/city?demo=1" onClick={markIntroSeen} className="btn !px-5 !py-3 text-white ring-1 ring-white/50 hover:bg-white/10">{c.cta.demo}</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-slate-900/5 bg-[#f6f8fe]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-ink-soft sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="max-w-md space-y-2">
            <div className="flex items-center gap-2 font-semibold text-ink"><IconLogo width={16} height={16} /> {brand.name}</div>
            <p className="text-xs leading-relaxed">{c.footer.note}</p>
            <div className="flex flex-wrap gap-1.5">{STACK.map((s) => <span key={s} className="rounded-full bg-slate-900/5 px-2 py-0.5 text-[11px]">{s}</span>)}</div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
            <a className="hover:text-ink" href="https://github.com/nusastakes/web" target="_blank" rel="noreferrer">{c.footer.web}</a>
            <a className="hover:text-ink" href="https://github.com/nusastakes/contracts" target="_blank" rel="noreferrer">{c.footer.contracts}</a>
            <a className="hover:text-ink" href="https://github.com/nusastakes/relayer" target="_blank" rel="noreferrer">{c.footer.relayer}</a>
            <a className="hover:text-ink" href="https://github.com/nusastakes/cre-guardian" target="_blank" rel="noreferrer">{c.footer.cre}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
