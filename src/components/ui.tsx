"use client";

import type { ReactNode } from "react";
import { IconClose } from "./icons";
import { useLang } from "@/lib/lang";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ className, children, solid }: { className?: string; children: ReactNode; solid?: boolean }) {
  return <div className={cx(solid ? "glass-solid" : "glass", "rounded-2xl", className)}>{children}</div>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "warn" | "good"; children: ReactNode }) {
  const tones = {
    neutral: "bg-slate-900/5 text-slate-600",
    accent: "bg-accent-soft text-accent",
    warn: "bg-amber-100 text-amber-700",
    good: "bg-emerald-100 text-emerald-700",
  } as const;
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", tones[tone])}>{children}</span>;
}

export function Stat({ icon, label, value, unit, sub, tone }: { icon: ReactNode; label: string; value: string; unit?: string; sub?: ReactNode; tone?: "good" | "bad" }) {
  return (
    <Card className="flex min-w-[148px] items-center gap-3 px-3.5 py-3 sm:min-w-[170px]">
      <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent sm:flex">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-ink-soft">{label}</div>
        <div className="flex items-baseline gap-1">
          <span className="truncate text-xl font-semibold leading-tight tracking-tight text-ink">{value}</span>
          {unit && <span className="text-xs font-medium text-ink-soft">{unit}</span>}
        </div>
        {sub && <div className={cx("text-[11px] font-medium", tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-ink-soft")}>{sub}</div>}
      </div>
    </Card>
  );
}

export function Sheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  const [lang] = useLang();
  return (
    <Card className="pointer-events-auto flex max-h-[calc(100dvh-13rem)] w-full flex-col overflow-hidden max-sm:max-h-[calc(100dvh-10.5rem)] max-sm:bg-white/97! sm:w-[400px]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-900/5 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>}
        </div>
        <button onClick={onClose} aria-label={lang === "id" ? "Tutup" : "Close"} className="rounded-lg p-1 text-ink-soft hover:bg-slate-900/5"><IconClose width={16} height={16} /></button>
      </div>
      <div className="overflow-y-auto px-4 py-3">{children}</div>
    </Card>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-medium text-ink-soft"><span>{label}</span>{hint && <span>{hint}</span>}</span>
      {children}
    </label>
  );
}

export const inputCls = "w-full rounded-xl border border-slate-900/10 bg-white/80 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "good"; children: ReactNode }) {
  const tones = {
    info: "bg-accent-soft/70 text-slate-700",
    warn: "bg-amber-50 text-amber-800",
    error: "bg-red-50 text-red-700",
    good: "bg-emerald-50 text-emerald-800",
  } as const;
  return <div className={cx("rounded-xl px-3 py-2 text-xs leading-relaxed", tones[tone])}>{children}</div>;
}
