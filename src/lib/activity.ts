"use client";

import { useEffect, useRef } from "react";
import { zeroAddress } from "viem";
import { guardianAbi, vaultAbi } from "./abis";
import { publicClient } from "./chain";
import { ADDR } from "./config";
import type { LifeEvent } from "./scene/life";
import type { Hex } from "./types";

const POLL_MS = 2500;
/** Satu permintaan log tidak pernah lebih lebar dari ini, supaya RPC publik tidak menolak setelah tab lama di latar. */
const MAX_SPAN = 400n;
const district = (a: string) => (a.toLowerCase() === zeroAddress ? "idle" : a);
const ausd = (raw: bigint) => Number(raw) / 1e6;

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
          }
        }
      } catch { /* RPC sesaat gagal: coba lagi di putaran berikutnya */ }
    };

    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [vault]);
}
