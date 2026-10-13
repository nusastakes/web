"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import brand from "@/lib/brand.json";
import { COPY } from "@/lib/copy";
import { shortAddr } from "@/lib/format";
import { useLang } from "@/lib/lang";
import { useWallet } from "@/lib/wallet";
import { IconCheck, IconChevron, IconKey, IconLock, IconLogo } from "./icons";
import { LangToggle } from "./LangToggle";
import { Notice, Spinner, cx } from "./ui";

/**
 * Halaman masuk: membuat akun atau masuk lagi dengan passkey (Mera). Satu ceremony; tidak ada seed phrase, email, atau
 * kata sandi. Setelah berhasil, pengguna dibawa ke `?next=` (bawaan: kota).
 */

const nextPath = () => {
  if (typeof location === "undefined") return "/city";
  const n = new URLSearchParams(location.search).get("next") ?? "/city";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/city";
};

type Env = "ok" | "insecure" | "nowebauthn" | "inapp";
const IN_APP = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok|Twitter|; wv\)|GSA\//;
/** Pemeriksaan sebelum tombol ditekan: halaman aman, ada WebAuthn, bukan browser di dalam aplikasi lain. */
function readEnv(): Env {
  if (!window.isSecureContext) return "insecure";
  if (typeof window.PublicKeyCredential === "undefined") return "nowebauthn";
  return IN_APP.test(navigator.userAgent) ? "inapp" : "ok";
}
const noopSubscribe = () => () => {};

/** Siluet kota di dasar halaman: beberapa jendela menyala bergantian. Dibuat sekali, tanpa WebGL. */
const SKY = (() => {
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const blocks: { x: number; w: number; h: number; lit: [number, number, number][] }[] = [];
  for (let x = 0; x < 2400;) {
    const w = 34 + Math.floor(rnd() * 46), h = 40 + Math.floor(rnd() * 120);
    const lit: [number, number, number][] = [];
    for (let y = 200 - h + 10; y < 190; y += 16) for (let wx = x + 7; wx < x + w - 8; wx += 13) if (rnd() < 0.18) lit.push([wx, y, Math.floor(rnd() * 4)]);
    blocks.push({ x, w, h, lit });
    x += w + 4 + Math.floor(rnd() * 8);
  }
  return blocks;
})();

function Skyline() {
  return (
    <svg aria-hidden viewBox="0 0 2400 200" preserveAspectRatio="xMidYMax slice" className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-32 w-full sm:h-44">
      <defs>
        <linearGradient id="sky-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f6bff" stopOpacity="0.07" />
          <stop offset="1" stopColor="#3f6bff" stopOpacity="0.17" />
        </linearGradient>
      </defs>
      {SKY.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={200 - b.h} width={b.w} height={b.h} fill="url(#sky-fade)" />
          {b.lit.map(([wx, wy, d], j) => <rect key={j} x={wx} y={wy} width="6" height="8" rx="1" fill="#ffd166" className="ns-twinkle" style={{ animationDelay: `${d * 0.9 + (j % 3) * 0.4}s` }} />)}
        </g>
      ))}
    </svg>
  );
}

export default function AuthPage() {
  const w = useWallet();
  const [lang] = useLang();
  const a = COPY[lang].auth;
  const router = useRouter();
  const env = useSyncExternalStore(noopSubscribe, readEnv, () => "ok" as Env);
  const [mode, setMode] = useState<"new" | "back">("new");
  const [went, setWent] = useState(false);
  const ready = w.status === "ready" && !!w.address;
  const busy = w.status === "busy";
  const locked = w.status === "locked";
  const blocked = env === "insecure" || env === "nowebauthn";
  const err = w.error;
  const prfProblem = !!err && /PRF|passkey keys/i.test(err);
  const cancelled = !!err && /dismissed or failed|cancelled/i.test(err);
  const httpsProblem = !!err && /secure page|HTTPS/i.test(err);

  useEffect(() => {
    if (!ready || went) return;
    const id = window.setTimeout(() => { setWent(true); try { localStorage.setItem("nusastakes.intro.v1", "1"); } catch { /* abaikan */ } router.push(nextPath()); }, 1400);
    return () => window.clearTimeout(id);
  }, [ready, went, router]);

  const pickMode = (k: "new" | "back") => { setMode(k); w.clearError(); };
  const go = () => (locked || mode === "back" ? w.signIn() : w.createAccount());
  const seeDevices = () => {
    const el = document.getElementById("devices");
    if (el instanceof HTMLDetailsElement) el.open = true;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const devices = (
    <div className="grid gap-3 text-xs sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-900/5 bg-white/75 p-3.5">
        <div className="mb-1.5 font-semibold text-good">{a.works}</div>
        <ul className="space-y-1 text-ink-soft">{a.worksList.map((d) => <li key={d}>{d}</li>)}</ul>
      </div>
      <div className="rounded-2xl border border-slate-900/5 bg-white/75 p-3.5">
        <div className="mb-1.5 font-semibold text-bad">{a.notWorks}</div>
        <ul className="space-y-1 text-ink-soft">{a.notWorksList.map((d) => <li key={d}>{d}</li>)}</ul>
      </div>
    </div>
  );

  const envMsg = env === "insecure" ? a.needHttps : env === "nowebauthn" ? a.noPasskeys : env === "inapp" ? a.inApp : null;

  return (
    <div className="relative min-h-full overflow-x-clip bg-bg text-ink" style={{ backgroundImage: "radial-gradient(60% 45% at 78% 12%, rgba(63,107,255,0.16), transparent 70%), radial-gradient(45% 35% at 10% 90%, rgba(255,209,102,0.16), transparent 70%)" }}>
      <Skyline />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 pt-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white"><IconLogo width={19} height={19} /></span>
          <span className="text-base font-semibold tracking-tight">{brand.name}</span>
        </Link>
        <div className="flex items-center gap-3"><LangToggle /><Link href="/city" className="whitespace-nowrap text-sm font-medium text-ink-soft hover:text-ink">{a.lookAround}</Link></div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-6xl flex-col justify-center gap-8 px-4 pb-40 pt-6 sm:px-6 md:pb-44">
        <div className="mx-auto grid w-full max-w-xl items-center gap-x-16 gap-y-7 lg:max-w-none lg:grid-cols-[1.05fr_0.95fr]">
          <section className="ns-rise lg:col-start-1 lg:row-start-1">
            <h1 className="text-[28px] font-semibold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">{a.h1}</h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-soft sm:text-base lg:text-lg lg:leading-relaxed">{a.lead}</p>
          </section>

          <section className="ns-rise w-full lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-w-[480px] lg:justify-self-end" style={{ animationDelay: "0.08s" }}>
            <div className="glass-solid rounded-3xl p-5 sm:p-7 md:p-8">
              {ready ? (
                <div className="space-y-4 py-2 text-center" role="status">
                  <span className="ns-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-good"><IconCheck width={30} height={30} strokeWidth={3} /></span>
                  <h2 className="text-2xl font-semibold">{a.inTitle}</h2>
                  <p className="text-sm text-ink-soft"><span className="font-mono text-ink">{shortAddr(w.address)}</span>. {a.inBody}</p>
                  <div className="h-1 overflow-hidden rounded-full bg-slate-900/5"><div className="ns-fill h-full rounded-full bg-accent" /></div>
                  <button className="btn btn-primary w-full !py-3 text-base" onClick={() => { if (!went) { setWent(true); router.push(nextPath()); } }}>{a.enter}</button>
                </div>
              ) : (
                <>
                  {!locked && (
                    <div className="flex gap-1 rounded-xl bg-slate-900/5 p-1" role="tablist">
                      {(["new", "back"] as const).map((k) => (
                        <button key={k} role="tab" aria-selected={mode === k} onClick={() => pickMode(k)} disabled={busy}
                          className={cx("flex-1 rounded-lg px-2 py-2.5 text-sm font-semibold transition-colors", mode === k ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink")}>
                          {k === "new" ? a.tabNew : a.tabBack}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className={cx("flex justify-center", locked ? "mt-1" : "mt-6")}>
                    <span className={cx("flex h-[72px] w-[72px] items-center justify-center rounded-3xl bg-accent-soft text-accent", busy && "animate-pulse")}>{!locked && mode === "new" ? <IconKey width={34} height={34} /> : <IconLock width={34} height={34} />}</span>
                  </div>
                  <h2 className="mt-5 text-center text-2xl font-semibold tracking-tight">{locked ? a.unlockTitle : mode === "new" ? a.createTitle : a.backTitle}</h2>
                  {locked && w.address && <p className="mt-1 text-center text-xs text-ink-soft">{a.account} <span className="font-mono text-ink">{shortAddr(w.address)}</span></p>}
                  <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-relaxed text-ink-soft">{locked ? a.unlockSub : mode === "new" ? a.createSub : a.backSub}</p>

                  {!locked && mode === "new" && (
                    <ol className="mt-5 grid grid-cols-3 gap-3 text-center text-xs leading-snug text-ink-soft">
                      {a.steps.map((s, i) => (
                        <li key={s} className="flex flex-col items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent">{i + 1}</span>{s}
                        </li>
                      ))}
                    </ol>
                  )}

                  {envMsg && <div className="mt-5"><Notice tone="warn">{envMsg}</Notice></div>}
                  <button className="btn btn-primary mt-6 w-full !py-3.5 text-base" disabled={busy || blocked} aria-busy={busy} onClick={go}>
                    {busy ? <><Spinner /> {mode === "new" && !locked ? a.busyCreate : a.waiting}</> : <><IconKey /> {err ? a.tryAgain : locked ? a.btnUnlock : mode === "new" ? a.btnCreate : a.btnBack}</>}
                  </button>
                  {busy && <p className="mt-3 text-center text-xs leading-relaxed text-ink-soft" role="status">{a.busyHint}</p>}
                  {err && !busy && (
                    <div className="mt-3" role="alert">
                      <Notice tone={cancelled ? "warn" : "error"}>
                        {cancelled ? a.cancelled : prfProblem ? a.prf : httpsProblem ? a.needHttps : err}
                        {prfProblem && <button className="mt-1.5 block font-semibold underline underline-offset-2" onClick={seeDevices}>{a.seeDevices}</button>}
                      </Notice>
                    </div>
                  )}
                  <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-soft">{a.testnet}</p>
                </>
              )}
            </div>
          </section>

          <ul className="ns-rise space-y-4 text-sm leading-relaxed lg:col-start-1 lg:row-start-2 lg:text-[15px]" style={{ animationDelay: "0.16s" }}>
            {a.points.map(([title, body]) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><IconCheck width={13} height={13} strokeWidth={3} /></span>
                <span><b className="font-semibold">{title}.</b> <span className="text-ink-soft">{body}</span></span>
              </li>
            ))}
          </ul>
        </div>

        <details id="devices" className="group mx-auto w-full max-w-3xl rounded-2xl border border-slate-900/5 bg-white/65 backdrop-blur" open={prfProblem}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
            {a.devicesTitle}<IconChevron className="shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-3 pb-3">{devices}</div>
        </details>
      </main>
    </div>
  );
}
