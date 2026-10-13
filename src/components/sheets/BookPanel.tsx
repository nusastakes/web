"use client";

import { useCallback, useState } from "react";
import { readAll, type OpenedEntry } from "@/lib/book";
import { TX_STEPS, contractTx, type Step } from "@/lib/actions";
import { vaultAbi } from "@/lib/abis";
import { txUrl } from "@/lib/config";
import { MAYOR } from "@/lib/copy-mayor";
import { humanError } from "@/lib/errors";
import { emitChange } from "@/lib/hooks";
import { useLang } from "@/lib/lang";
import type { CityView, Hex } from "@/lib/types";
import { useWallet } from "@/lib/wallet";
import { IconExternal, IconLock } from "../icons";
import StepList from "../StepList";
import { Badge, Notice, Spinner } from "../ui";

/**
 * Buku strategi tersegel walikota (B17). Entri ditulis saat menata ulang dana (tab Funds). Di sini walikota membuka bukunya
 * dengan passkey (namespace PRF tersendiri), membaca isinya, dan di akhir musim membuka kunci satu entri secara publik.
 */
export default function BookPanel({ city }: { city: CityView }) {
  const w = useWallet();
  const [lang] = useLang();
  const t = MAYOR[lang].book;
  const [entries, setEntries] = useState<OpenedEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ id: string; steps: Step[]; hash?: Hex } | null>(null);

  const open = useCallback(async () => {
    if (!w.address) return;
    setLoading(true); setError(null);
    try { setEntries(await readAll(w, w.address)); } catch (e) { setError(humanError(e)); } finally { setLoading(false); }
  }, [w]);

  const doReveal = async (e: OpenedEntry) => {
    if (!city.vault || !e.key) return;
    const steps = TX_STEPS("Key published on-chain");
    setReveal({ id: e.id, steps });
    const report = (id: string, patch: Partial<Step>) => setReveal((r) => (r ? { ...r, steps: r.steps.map((x) => (x.id === id ? { ...x, ...patch } : x)) } : r));
    try {
      const { hash } = await contractTx(w, { address: city.vault, abi: vaultAbi, functionName: "revealPlanKey", args: [e.hash, e.key] }, { ceremony: false, label: "Reveal", report });
      setReveal((r) => (r ? { ...r, hash } : r));
      emitChange();
    } catch (err) {
      setError(humanError(err));
      setReveal((r) => (r ? { ...r, steps: r.steps.map((x) => (x.state === "active" ? { ...x, state: "error" } : x)) } : r));
    }
  };

  const mine = entries?.filter((e) => !e.entry || e.entry.city.toLowerCase() === city.vault?.toLowerCase()) ?? [];
  const others = (entries?.length ?? 0) - mine.length;

  return (
    <section className="space-y-3">
      <p className="text-xs leading-relaxed text-ink-soft">
        {t.intro}
      </p>
      {!entries ? (
        <button className="btn btn-primary w-full" onClick={open} disabled={loading || w.status !== "ready"}>
          {loading ? <Spinner /> : <IconLock />} {w.bookUnlocked ? t.read : t.unlock}
        </button>
      ) : mine.length === 0 ? (
        <Notice tone="info">{t.none}</Notice>
      ) : (
        <ul className="space-y-2">
          {mine.map((e) => (
            <li key={e.id} className="rounded-xl border border-slate-900/5 bg-white/70 p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">{new Date(e.createdAt).toLocaleString(MAYOR[lang].locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <Badge tone={e.error ? "warn" : "good"}>{e.error ? t.cannotOpen : t.decrypted}</Badge>
              </div>
              {e.entry ? (
                <>
                  <div className="mt-1 text-ink">{e.entry.from} → {e.entry.to} · {e.entry.amount} AUSD</div>
                  <div className="mt-0.5 whitespace-pre-wrap text-ink-soft">“{e.entry.note}”</div>
                </>
              ) : <div className="mt-1 text-ink-soft">{e.error}</div>}
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <code className="truncate text-[10px] text-ink-soft">{e.hash.slice(0, 18)}…</code>
                {e.key && <button className="btn btn-ghost !px-2 !py-1 text-[11px]" disabled={!!reveal && reveal.id === e.id} onClick={() => doReveal(e)}>{t.reveal}</button>}
              </div>
              {reveal?.id === e.id && (
                <div className="mt-2 space-y-1.5">
                  <StepList steps={reveal.steps} />
                  {reveal.hash && <a className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline" href={txUrl(reveal.hash)} target="_blank" rel="noreferrer">{t.keyPublic} <IconExternal width={11} height={11} /></a>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {entries && others > 0 && <p className="text-[11px] text-ink-soft">{t.others(others)}</p>}
      {error && <Notice tone="error">{error}</Notice>}
      <p className="text-[10.5px] text-ink-soft/80">{t.footer}</p>
    </section>
  );
}
