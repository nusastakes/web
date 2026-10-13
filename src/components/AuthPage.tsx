"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import brand from "@/lib/brand.json";
import { COPY } from "@/lib/copy";
import { shortAddr } from "@/lib/format";
import { useLang } from "@/lib/lang";
import { useWallet } from "@/lib/wallet";
import { IconCheck, IconKey, IconLock, IconLogo } from "./icons";
import { LangToggle } from "./Landing";
import { Card, Notice, Spinner } from "./ui";

/**
 * Halaman masuk: membuat akun atau masuk lagi dengan passkey (Mera). Satu ceremony; tidak ada seed phrase, email, atau
 * kata sandi. Setelah berhasil, pengguna dibawa ke `?next=` (bawaan: kota).
 */

const nextPath = () => {
  if (typeof location === "undefined") return "/city";
  const n = new URLSearchParams(location.search).get("next") ?? "/city";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/city";
};

export default function AuthPage() {
  const w = useWallet();
  const [lang] = useLang();
  const a = COPY[lang].auth;
  const router = useRouter();
  const [mode, setMode] = useState<"new" | "back">("new");
  const [went, setWent] = useState(false);
  const ready = w.status === "ready" && !!w.address;
  const busy = w.status === "busy";
  const prfProblem = !!w.error && /PRF|passkey keys/i.test(w.error);

  useEffect(() => {
    if (!ready || went) return;
    const id = window.setTimeout(() => { setWent(true); try { localStorage.setItem("nusastakes.intro.v1", "1"); } catch { /* abaikan */ } router.push(nextPath()); }, 1400);
    return () => window.clearTimeout(id);
  }, [ready, went, router]);

  return (
    <div className="min-h-full bg-bg text-ink">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white"><IconLogo width={19} height={19} /></span>
          <span className="text-base font-semibold tracking-tight">{brand.name}</span>
        </Link>
        <div className="flex items-center gap-3"><LangToggle /><Link href="/city" className="text-sm font-medium text-ink-soft hover:text-ink">{a.lookAround}</Link></div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.1fr_1fr] md:py-16">
        <section className="order-2 md:order-1">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{a.h1}</h1>
          <p className="mt-3 max-w-md leading-relaxed text-ink-soft">{a.lead}</p>
          <ul className="mt-6 space-y-3 text-sm">
            {a.points.map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><IconCheck width={13} height={13} strokeWidth={3} /></span>
                <span><b className="font-semibold">{title}.</b> <span className="text-ink-soft">{body}</span></span>
              </li>
            ))}
          </ul>
          <div className="mt-8 grid gap-3 text-xs sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-900/5 bg-white/70 p-3.5">
              <div className="mb-1.5 font-semibold text-good">{a.works}</div>
              <ul className="space-y-1 text-ink-soft">{a.worksList.map((d) => <li key={d}>{d}</li>)}</ul>
            </div>
            <div className="rounded-2xl border border-slate-900/5 bg-white/70 p-3.5">
              <div className="mb-1.5 font-semibold text-bad">{a.notWorks}</div>
              <ul className="space-y-1 text-ink-soft">{a.notWorksList.map((d) => <li key={d}>{d}</li>)}</ul>
            </div>
          </div>
        </section>

        <section className="order-1 md:order-2">
          <Card solid className="p-6">
            {ready ? (
              <div className="space-y-3 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-good"><IconCheck width={22} height={22} strokeWidth={3} /></span>
                <h2 className="text-xl font-semibold">{a.inTitle}</h2>
                <p className="text-sm text-ink-soft"><span className="font-mono text-ink">{shortAddr(w.address)}</span>. {a.inBody}</p>
                <button className="btn btn-primary w-full" onClick={() => router.push(nextPath())}>{a.enter}</button>
              </div>
            ) : (
              <>
                <div className="flex gap-1 rounded-xl bg-slate-900/5 p-1" role="tablist">
                  {(["new", "back"] as const).map((k) => (
                    <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
                      className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold ${mode === k ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}>
                      {k === "new" ? a.tabNew : a.tabBack}
                    </button>
                  ))}
                </div>
                <div className="mt-5 flex justify-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">{mode === "new" ? <IconKey width={30} height={30} /> : <IconLock width={30} height={30} />}</span>
                </div>
                <h2 className="mt-4 text-center text-xl font-semibold">{w.status === "locked" ? a.unlockTitle : mode === "new" ? a.createTitle : a.backTitle}</h2>
                <p className="mt-1.5 text-center text-sm text-ink-soft">
                  {w.status === "locked" ? a.unlockSub : mode === "new" ? a.createSub : a.backSub}
                </p>
                <button className="btn btn-primary mt-5 w-full !py-3 text-base" disabled={busy}
                  onClick={() => (w.status === "locked" || mode === "back" ? w.signIn() : w.createAccount())}>
                  {busy ? <><Spinner /> {w.busyLabel ?? a.waiting}</> : <><IconKey /> {w.status === "locked" ? a.btnUnlock : mode === "new" ? a.btnCreate : a.btnBack}</>}
                </button>
                {w.error && (
                  <div className="mt-3">
                    <Notice tone="error">
                      {w.error}
                      {prfProblem && <span className="mt-1 block">{a.prf}</span>}
                    </Notice>
                  </div>
                )}
                <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-soft">{a.testnet}</p>
              </>
            )}
          </Card>
        </section>
      </main>
    </div>
  );
}
