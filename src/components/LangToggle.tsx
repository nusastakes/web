"use client";

import { useLang } from "@/lib/lang";
import { cx } from "./ui";

/** Tombol bahasa ID/EN; dipakai di halaman depan dan halaman masuk. */
export function LangToggle() {
  const [lang, setLang] = useLang();
  return (
    <div className="flex overflow-hidden rounded-xl border border-slate-900/10 bg-white/80 text-xs font-semibold" role="group" aria-label={lang === "id" ? "Bahasa" : "Language"}>
      {(["id", "en"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={cx("px-2.5 py-1.5 uppercase", lang === l ? "bg-accent text-white" : "text-ink-soft hover:text-ink")}>{l}</button>
      ))}
    </div>
  );
}
