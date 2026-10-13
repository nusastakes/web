"use client";

import type { ReactNode } from "react";
import { WalletProvider } from "@/lib/wallet";

/** Penyedia di seluruh situs: sesi passkey hidup di memori dan bertahan saat berpindah halaman. */
export default function Providers({ children }: { children: ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}
