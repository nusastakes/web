"use client";

import { txUrl } from "@/lib/config";
import type { Step } from "@/lib/actions";
import { shortAddr } from "@/lib/format";
import { useLang } from "@/lib/lang";
import { loc } from "@/lib/l10n";
import { IconCheck, IconExternal } from "./icons";
import { Spinner, cx } from "./ui";

/** Daftar langkah sebuah aksi: tanda tangan, relayer mengirim, terkonfirmasi. */
export default function StepList({ steps }: { steps: Step[] }) {
  const [lang] = useLang();
  return (
    <ol className="space-y-2">
      {steps.map((s) => (
        <li key={s.id} className="flex items-start gap-2.5">
          <span className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white",
            s.state === "done" ? "bg-good" : s.state === "active" ? "bg-accent" : s.state === "error" ? "bg-bad" : "bg-slate-300")}>
            {s.state === "done" ? <IconCheck width={12} height={12} strokeWidth={3} /> : s.state === "active" ? <Spinner className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-white" />}
          </span>
          <div className="min-w-0 text-sm">
            <div className={cx(s.state === "todo" ? "text-ink-soft" : "font-medium text-ink")}>{loc(s.label, lang)}</div>
            {s.detail && <div className={cx("text-xs", s.state === "error" ? "text-bad" : "text-ink-soft")}>{loc(s.detail, lang)}</div>}
            {s.hash && (
              <a href={txUrl(s.hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[11px] text-accent hover:underline">
                {shortAddr(s.hash)} <IconExternal width={11} height={11} />
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
