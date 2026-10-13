"use client";

import { APP } from "@/lib/copy-app";
import { useLang } from "@/lib/lang";
import { useWallet } from "@/lib/wallet";
import { IconKey } from "../icons";
import { Notice, Spinner } from "../ui";

/** Ditampilkan di dalam sheet saat pengguna belum masuk atau sesinya terkunci. */
export default function NeedAccount() {
  const w = useWallet();
  const [lang] = useLang();
  const t = APP[lang].need;
  const locked = w.status === "locked";
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-ink-soft">
        {locked ? t.locked : t.create}
      </p>
      <button className="btn btn-primary w-full" disabled={w.status === "busy"} onClick={() => (locked ? w.signIn() : w.createAccount())}>
        {w.status === "busy" ? <><Spinner /> {w.busyLabel}</> : <><IconKey /> {locked ? t.unlock : t.createBtn}</>}
      </button>
      {!locked && <button className="w-full text-center text-xs font-medium text-accent" onClick={() => w.signIn()}>{t.have}</button>}
      {w.error && <Notice tone="error">{w.error}</Notice>}
    </div>
  );
}
