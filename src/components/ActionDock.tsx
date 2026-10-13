"use client";

import { IconArrowDown, IconArrowUp, IconInfo, IconPlus, IconRecenter, IconSwap } from "./icons";
import { Card, cx } from "./ui";

export type SheetKind = "deposit" | "withdraw" | "found" | "manage" | "explore" | null;

interface Props {
  active: SheetKind;
  onOpen: (k: Exclude<SheetKind, null>) => void;
  onRecenter: () => void;
  onDetails: () => void;
  /** True bila akun yang masuk adalah walikota kota ini. */
  mayor?: boolean;
}

export default function ActionDock({ active, onOpen, onRecenter, onDetails, mayor }: Props) {
  /** `compact`: di layar sempit hanya ikon, kecuali saat aktif. */
  const item = (k: Exclude<SheetKind, null>, icon: React.ReactNode, label: string, compact = false) => (
    <button key={k} onClick={() => onOpen(k)} aria-pressed={active === k}
      className={cx("flex items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-2.5 text-[13px] font-semibold transition sm:gap-2 sm:px-4 sm:text-sm", active === k ? "bg-accent text-white shadow-[0_8px_20px_-8px_rgba(63,107,255,0.7)]" : "text-ink hover:bg-white")}>
      {icon}<span className={compact && active !== k ? "hidden sm:inline" : undefined}>{label}</span>
    </button>
  );
  return (
    <Card className="pointer-events-auto flex max-w-full items-center gap-0.5 p-1.5 sm:gap-1">
      {item("deposit", <IconArrowDown />, "Deposit")}
      {item("withdraw", <IconArrowUp />, "Withdraw")}
      {item("found", <IconPlus />, "Found city", !!mayor)}
      {mayor && item("manage", <IconSwap />, "Manage")}
      <span className="mx-1 hidden h-6 w-px bg-slate-900/10 sm:block" />
      <button onClick={onRecenter} aria-label="Reset view" className="hidden rounded-xl p-2.5 sm:block text-ink-soft hover:bg-white hover:text-ink"><IconRecenter /></button>
      <button onClick={onDetails} aria-label="City details" className="rounded-xl p-2.5 text-ink-soft hover:bg-white hover:text-ink md:hidden"><IconInfo /></button>
    </Card>
  );
}
