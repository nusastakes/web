"use client";

import { useEffect, useRef } from "react";
import { zeroAddress } from "viem";
import { guardianAbi, vaultAbi } from "./abis";
import { publicClient } from "./chain";
import { ADDR } from "./config";
import { term, tr } from "./lang";
import type { LifeEvent } from "./scene/life";
import type { Hex } from "./types";

const POLL_MS = 2500;
/** RPC publik Monad menolak `getLogs` lebih dari 100 blok (HTTP 413), jadi satu permintaan paling banyak 100 blok. */
const MAX_SPAN = 99n;
const district = (a: string) => (a.toLowerCase() === zeroAddress ? "idle" : a);
const ausd = (raw: bigint) => Number(raw) / 1e6;
/** Nama peran staf AI menurut bahasa toggle, dibaca saat kejadian dibuat. */
const roleName = (role: number): string => (({ 1: term("guard"), 2: term("analyst"), 3: term("pr") }) as Record<number, string>)[role] ?? term("aiStaff");

/**
 * Mengubah kejadian onchain milik satu kota menjadi kejadian visual di kota 3D: setor, tarik, tata ulang, fee,
 * evakuasi Satpam, dan usulan Analis. Hanya kejadian baru sejak halaman dibuka yang ditampilkan.
 */
export function useCityActivity(vault: Hex | undefined, emit: (e: LifeEvent) => void) {
  const emitRef = useRef(emit);
  useEffect(() => { emitRef.current = emit; }, [emit]);

  useEffect(() => {
    if (!vault) return;
    let cancelled = false;
    let cursor: bigint | undefined;

    const tick = async () => {
      try {
        const head = await publicClient.getBlockNumber();
        if (cursor === undefined) { cursor = head; return; }
        if (head <= cursor) return;
        // Tab yang lama di latar: lewati jauh ke belakang, cukup kejadian beberapa menit terakhir.
        if (head - cursor > 1500n) cursor = head - 300n;
        const to = head - cursor > MAX_SPAN ? cursor + MAX_SPAN : head;
        const [v, g] = await Promise.all([
          publicClient.getLogs({ address: vault, events: vaultAbi.filter((x) => x.type === "event"), fromBlock: cursor + 1n, toBlock: to }),
          publicClient.getLogs({ address: ADDR.guardian, events: guardianAbi, fromBlock: cursor + 1n, toBlock: to }),
        ]);
        cursor = to;
        if (cancelled) return;
        const all = [...v, ...g].sort((a, b) => Number(a.blockNumber! - b.blockNumber!) || a.logIndex! - b.logIndex!);
        for (const log of all) {
          const args = log.args as Record<string, unknown>;
          switch (log.eventName) {
            case "Deposit": emitRef.current({ type: "deposit", amount: ausd(args.assets as bigint) }); break;
            case "Withdraw": emitRef.current({ type: "withdraw", amount: ausd(args.assets as bigint) }); break;
            case "Rebalanced": emitRef.current({ type: "transfer", from: district(args.from as string), to: district(args.to as string), amount: ausd(args.amount as bigint) }); break;
            case "FeeAccrued": { const shares = Number(args.mayorShares as bigint) / 1e12; if (shares > 0) emitRef.current({ type: "harvest", amount: shares }); break; }
            case "Evacuated": emitRef.current({ type: "alert", at: args.adapter as string, amount: ausd(args.amount as bigint) }); break;
            case "ProposalCreated":
              if ((args.city as string).toLowerCase() === vault.toLowerCase()) {
                emitRef.current({ type: "propose", id: String(args.id), from: district(args.from as string), to: district(args.to as string), amount: ausd(args.amount as bigint) });
              }
              break;
            case "ProposalApproved":
              if ((args.city as string).toLowerCase() === vault.toLowerCase()) emitRef.current({ type: "approve", id: String(args.id), run: false });
              break;
            case "SessionKeySet":
              emitRef.current({ type: "agenda", kind: "deputy", text: (args.sessionKey as string).toLowerCase() === zeroAddress ? tr("Mayor removes the deputy key", "Walikota menghapus kunci wakil") : tr("Mayor registers a deputy key for day-to-day work", "Walikota mendaftarkan kunci wakil untuk kerja harian") });
              break;
            case "FeeSet":
              emitRef.current({ type: "agenda", kind: "fee", text: tr(`Mayor changes the fee to ${(Number(args.newFeeBps) / 100).toFixed(1)}%`, `Walikota mengubah fee menjadi ${(Number(args.newFeeBps) / 100).toFixed(1)}%`) });
              break;
            case "PlanKeyRevealed":
              emitRef.current({ type: "agenda", kind: "reveal", text: tr("Mayor reveals a sealed plan from the strategy book", "Walikota membuka rencana tersegel dari buku strategi") });
              break;
            case "AgentGranted":
              if ((args.city as string).toLowerCase() === vault.toLowerCase()) emitRef.current({ type: "agenda", kind: "hire", text: tr(`Mayor hires the ${roleName(Number(args.role))}`, `Walikota menyewa ${roleName(Number(args.role))}`) });
              break;
            case "AgentRevoked":
              if ((args.city as string).toLowerCase() === vault.toLowerCase()) emitRef.current({ type: "agenda", kind: "fire", text: tr("Mayor releases an AI staff member", "Walikota melepas seorang staf AI") });
              break;
          }
        }
      } catch { /* RPC sesaat gagal: coba lagi di putaran berikutnya */ }
    };

    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [vault]);
}
