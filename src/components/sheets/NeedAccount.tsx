"use client";

import { useWallet } from "@/lib/wallet";
import { IconKey } from "../icons";
import { Notice, Spinner } from "../ui";

/** Ditampilkan di dalam sheet saat pengguna belum masuk atau sesinya terkunci. */
export default function NeedAccount() {
  const w = useWallet();
  const locked = w.status === "locked";
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-ink-soft">
        {locked ? "Your session locked itself after 10 idle minutes. Unlock it with your passkey." : "Create your account with a fingerprint, face or device PIN. No seed phrase, no wallet app, and no gas token."}
      </p>
      <button className="btn btn-primary w-full" disabled={w.status === "busy"} onClick={() => (locked ? w.signIn() : w.createAccount())}>
        {w.status === "busy" ? <><Spinner /> {w.busyLabel}</> : <><IconKey /> {locked ? "Unlock with passkey" : "Create account"}</>}
      </button>
      {!locked && <button className="w-full text-center text-xs font-medium text-accent" onClick={() => w.signIn()}>I already have an account</button>}
      {w.error && <Notice tone="error">{w.error}</Notice>}
    </div>
  );
}
