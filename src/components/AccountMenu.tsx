"use client";

import { useState } from "react";
import { humanError } from "@/lib/errors";
import { fmtAusd, shortAddr } from "@/lib/format";
import { emitChange, useBalances } from "@/lib/hooks";
import { APP } from "@/lib/copy-app";
import { useLang } from "@/lib/lang";
import { setOnb } from "@/lib/onboarding";
import { requestAusdPatient, requestGas } from "@/lib/relayer";
import { useWallet } from "@/lib/wallet";
import { IconChevron, IconCopy, IconKey, IconLock } from "./icons";
import { Card, Notice, Spinner, cx } from "./ui";

function avatarStyle(addr?: string) {
  const n = addr ? parseInt(addr.slice(2, 8), 16) : 0;
  const h1 = n % 360, h2 = (h1 + 55) % 360;
  return { background: `linear-gradient(135deg, hsl(${h1} 80% 62%), hsl(${h2} 85% 70%))` };
}

const mmss = (s?: number) => (s === undefined ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

/** Tombol akun: masuk dengan passkey, saldo, dan aksi akun. Semua aksi akun ada di sini supaya kota tetap bersih. */
export default function AccountMenu({ onAfterChange }: { onAfterChange?: () => void }) {
  const w = useWallet();
  const [lang] = useLang();
  const t = APP[lang].acct;
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ tone: "info" | "error" | "good"; text: string } | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const { balances, refresh } = useBalances(w.status === "ready" ? w.address : undefined);

  const act = async (label: string, fn: () => Promise<string>) => {
    setWorking(label); setMsg(null);
    try {
      setMsg({ tone: "good", text: await fn() });
      emitChange();
      await refresh();
      onAfterChange?.();
    } catch (e) {
      setMsg({ tone: "error", text: humanError(e) });
    } finally { setWorking(null); }
  };

  // Belum masuk.
  if (w.status === "out" || (w.status === "busy" && !w.address)) {
    return (
      <div className="relative">
        <button className="btn btn-primary" onClick={() => setOpen((o) => !o)} disabled={w.status === "busy"}>
          {w.status === "busy" ? <><Spinner /> {w.busyLabel ?? t.working}</> : <><IconKey /> {t.signIn}</>}
        </button>
        {open && w.status !== "busy" && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <Card solid className="absolute right-0 top-12 z-20 w-[min(320px,calc(100vw-2rem))] p-4">
              <h3 className="text-sm font-semibold text-ink">{t.oneTap}</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                {t.oneTapBody}
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <button className="btn btn-primary" onClick={() => { setOpen(false); w.createAccount(); }}><IconKey /> {t.create}</button>
                <button className="btn btn-ghost" onClick={() => { setOpen(false); w.signIn(); }}>{t.have}</button>
              </div>
              {w.error && <div className="mt-3"><Notice tone="error">{w.error}</Notice></div>}
            </Card>
          </>
        )}
        {!open && w.error && <div className="absolute right-0 top-12 z-20 w-[min(320px,calc(100vw-2rem))]"><Notice tone="error">{w.error}</Notice></div>}
      </div>
    );
  }

  // Terkunci atau sedang bekerja dengan alamat yang sudah dikenal.
  const locked = w.status === "locked";
  return (
    <div className="relative">
      <button
        className="glass flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2.5 text-sm font-medium text-ink"
        onClick={() => (locked ? w.signIn() : setOpen((o) => !o))}
        disabled={w.status === "busy"}
        aria-label={t.aria}
      >
        <span className="h-7 w-7 rounded-lg" style={avatarStyle(w.address)} />
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="font-mono text-xs">{shortAddr(w.address)}</span>
          <span className="text-[11px] font-normal text-ink-soft">
            {w.status === "busy" ? w.busyLabel : locked ? t.locked : balances ? `${fmtAusd(Number(balances.ausd) / 1e6)} AUSD` : "…"}
          </span>
        </span>
        {w.status === "busy" ? <Spinner /> : locked ? <IconLock width={15} height={15} /> : <IconChevron width={15} height={15} />}
      </button>
      {open && !locked && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <Card solid className="absolute right-0 top-12 z-20 w-[min(320px,calc(100vw-2rem))] p-4">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl" style={avatarStyle(w.address)} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-mono text-sm text-ink">
                  {shortAddr(w.address)}
                  <button aria-label={t.copy} className="text-ink-soft hover:text-ink" onClick={() => navigator.clipboard?.writeText(w.address ?? "")}><IconCopy width={14} height={14} /></button>
                </div>
                <div className="text-[11px] text-ink-soft">{t.passkeyAcct}</div>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-slate-900/[0.04] p-2.5"><dt className="text-[11px] text-ink-soft">AUSD</dt><dd className="font-semibold">{balances ? fmtAusd(Number(balances.ausd) / 1e6) : "…"}</dd></div>
              <div className="rounded-xl bg-slate-900/[0.04] p-2.5"><dt className="text-[11px] text-ink-soft">MON (gas)</dt><dd className="font-semibold">{balances ? (Number(balances.mon) / 1e18).toFixed(3) : "…"}</dd></div>
            </dl>
            <div className="mt-3 flex flex-col gap-2">
              <button className="btn btn-ghost" disabled={!!working} onClick={() => act("ausd", async () => { await requestAusdPatient(w.address!); return t.ausdSent; })}>
                {working === "ausd" ? <Spinner /> : null} {t.getAusd}
              </button>
              <button className="btn btn-ghost" disabled={!!working} onClick={() => act("gas", async () => { await requestGas(w.address!); return t.gasSent; })}>
                {working === "gas" ? <Spinner /> : null} {t.getGas}
              </button>
              <button className="btn btn-ghost" onClick={() => { setOnb({ hidden: false, done: false, open: true, started: true }); setOpen(false); }}>{APP[lang].onb.reopen}</button>
            </div>
            {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
            <div className="mt-3 rounded-xl bg-slate-900/[0.04] p-2.5 text-[11px] leading-snug text-ink-soft">
              <div className="mb-1 font-semibold uppercase tracking-wide text-ink">{t.keys}</div>
              <ul className="space-y-0.5">
                <li><b className="text-ink">{t.keyAccount[0]}</b> · {t.keyAccount[1]}</li>
                <li><b className="text-ink">{t.keyDeputy[0]}</b> {w.deputy ? <code>{shortAddr(w.deputy)}</code> : null} · {t.keyDeputy[1]}</li>
                <li><b className="text-ink">{t.keyBook[0]}</b> · {w.bookUnlocked ? t.keyBook[1] : t.keyBook[2]}</li>
              </ul>
              <div className="mt-1.5">{t.keysNote}</div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-900/5 pt-3 text-xs text-ink-soft">
              <span className={cx("inline-flex items-center gap-1")}><IconLock width={13} height={13} /> {t.locksIn} {mmss(w.secondsLeft)}</span>
              <span className="flex gap-3">
                <button className="font-medium hover:text-ink" onClick={() => { w.lock(); setOpen(false); }}>{t.lockNow}</button>
                <button className="font-medium hover:text-ink" onClick={() => { w.signOut(); setOpen(false); }}>{t.signOut}</button>
              </span>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
