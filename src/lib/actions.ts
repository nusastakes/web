import { ADDR, monadTestnet, rpcTransport } from "./config";
import { adapterAbi, erc20Abi, marketplaceAbi, vaultAbi } from "./abis";
import { publicClient } from "./chain";
import { relayDeposit, relayWithdraw, requestGas, splitSignature, type DepositResult, type HireVia, type WithdrawResult } from "./relayer";
import type { Hex } from "./types";
import type { WalletApi } from "./wallet";

/** Langkah yang ditampilkan di kartu aktivitas. */
export type StepState = "todo" | "active" | "done" | "error";
export interface Step { id: string; label: string; state: StepState; detail?: string; hash?: Hex }

const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

const nowSec = () => BigInt(Math.floor(Date.now() / 1000));

let ausdDomain: { name: string; version: string } | undefined;
/** Domain EIP-712 AUSD dibaca dari token (namanya "Agora Dollar", bukan "AUSD"), lalu disimpan. */
async function readAusdDomain() {
  if (ausdDomain) return ausdDomain;
  const d = await publicClient.readContract({ address: ADDR.ausd, abi: erc20Abi, functionName: "eip712Domain" });
  ausdDomain = { name: d[1], version: d[2] };
  return ausdDomain;
}

type Report = (id: string, patch: Partial<Step>) => void;

/** Setor: penduduk hanya menandatangani permit (tanpa prompt di dalam sesi); relayer mengirim dan membayar gas. */
export async function depositFlow(args: { wallet: WalletApi; vault: Hex; owner: Hex; assets: bigint; report: Report }): Promise<DepositResult> {
  const { wallet, vault, owner, assets, report } = args;
  report("sign", { state: "active" });
  const [domain, nonce] = await Promise.all([
    readAusdDomain(),
    publicClient.readContract({ address: ADDR.ausd, abi: erc20Abi, functionName: "nonces", args: [owner] }),
  ]);
  const deadline = nowSec() + 600n;
  const sig = await wallet.signTypedData({
    domain: { name: domain.name, version: domain.version, chainId: monadTestnet.id, verifyingContract: ADDR.ausd },
    types: PERMIT_TYPES,
    primaryType: "Permit",
    message: { owner, spender: vault, value: assets, nonce, deadline },
  });
  report("sign", { state: "done" });
  report("send", { state: "active" });
  const res = await relayDeposit({ vault, owner, assets, deadline, ...splitSignature(sig) });
  report("send", { state: "done", hash: res.hash });
  report("confirm", { state: "done", detail: res.status });
  return res;
}

/** Tarik: uang keluar, jadi selalu ceremony passkey baru. Permit atas share kota; aset hanya dibayar ke pemilik. */
export async function withdrawFlow(args: { wallet: WalletApi; vault: Hex; owner: Hex; shares: bigint; cityName: string; report: Report; selfRedeem?: boolean }): Promise<WithdrawResult> {
  const { wallet, vault, owner, shares, cityName, report } = args;
  if (args.selfRedeem) {
    // Selama karantina kontrak hanya mengizinkan pemegang menarik sendiri dari akunnya (`QuarantineExitsAreSelfOnly`):
    // relayer tidak bisa mengirimkannya, jadi akun membayar gas sendiri. Gas uji diminta dari relayer bila kurang.
    if ((await publicClient.getBalance({ address: owner })) < 30_000_000_000_000_000n) {
      report("sign", { state: "active", detail: "Getting a little test gas" });
      const drip = await requestGas(owner);
      await publicClient.waitForTransactionReceipt({ hash: drip.hash });
    }
    report("send", { label: "Sent to Monad" });
    const { hash } = await contractTx(wallet, { address: vault, abi: vaultAbi, functionName: "redeem", args: [shares, owner, owner] }, { ceremony: true, label: "Confirm the withdrawal with your passkey…", report });
    return { hash, status: "success" };
  }
  report("sign", { state: "active", detail: "Confirm with your passkey" });
  const nonce = await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "nonces", args: [owner] });
  const deadline = nowSec() + 600n;
  const sig = await wallet.withCeremony("Confirm the withdrawal with your passkey…", (account) =>
    account.signTypedData({
      domain: { name: cityName, version: "1", chainId: monadTestnet.id, verifyingContract: vault },
      types: PERMIT_TYPES,
      primaryType: "Permit",
      message: { owner, spender: vault, value: shares, nonce, deadline },
    }),
  );
  report("sign", { state: "done", detail: undefined });
  report("send", { state: "active" });
  const res = await relayWithdraw({ vault, owner, shares, deadline, ...splitSignature(sig) });
  report("send", { state: "done", hash: res.hash });
  report("confirm", { state: "done", detail: res.status });
  return res;
}

export const DEPOSIT_STEPS: Step[] = [
  { id: "sign", label: "Sign the deposit", state: "todo" },
  { id: "send", label: "Relayer sends it (gas paid for you)", state: "todo" },
  { id: "confirm", label: "Confirmed on Monad", state: "todo" },
];
export const WITHDRAW_STEPS: Step[] = [
  { id: "sign", label: "Confirm with your passkey", state: "todo" },
  { id: "send", label: "Relayer sends it (gas paid for you)", state: "todo" },
  { id: "confirm", label: "Confirmed on Monad", state: "todo" },
];

// ---------------------------------------------------------------------------------------------------------------
// Aksi walikota: dibayar akun walikota sendiri (butuh MON). Aturan biaya Monad: saldo harus >= gas limit x maxFeePerGas,
// jadi pakai 1,5 x base fee + tip, bukan 2x bawaan viem (lihat TC54).
// ---------------------------------------------------------------------------------------------------------------

import { encodeFunctionData, keccak256, parseEventLogs, toHex, zeroAddress, type LocalAccount } from "viem";
import { factoryAbi } from "./abis";

async function feeCaps() {
  const block = await publicClient.getBlock();
  if (block.baseFeePerGas == null) return {};
  const tip = await publicClient.estimateMaxPriorityFeePerGas().catch(() => 0n);
  return { maxFeePerGas: (block.baseFeePerGas * 3n) / 2n + tip, maxPriorityFeePerGas: tip };
}

export interface FoundCityInput { name: string; community: string; feeBps: number; mapId: string; /** Implementasi adapter (layanan protokol) yang dipilih walikota; bawaan: satu adapter cermin. */ adapterImpls?: Hex[] }

/** Mendirikan kota. Pengirim menjadi walikota. Mengembalikan hash dan alamat vault. */
export async function foundCityFlow(args: { wallet: WalletApi; owner: Hex; input: FoundCityInput; report: Report }): Promise<{ hash: Hex; vault?: Hex }> {
  // Factory yang dideploy ulang punya adapter sendiri; alamat lama membuat pembuatan kota gagal dengan galat yang tidak jelas.
  const { wallet, owner, input, report } = args;
  const impls = input.adapterImpls?.length ? input.adapterImpls : [ADDR.mirrorAdapterImpl];
  const allowedList = await Promise.all(impls.map((impl) => publicClient.readContract({ address: ADDR.factory, abi: factoryAbi, functionName: "allowedAdapterImpl", args: [impl] }).catch(() => true)));
  if (allowedList.some((ok) => !ok)) throw new Error("The city factory was updated and this page still has an old service address. Reload the page; if it keeps happening, tell the team.");
  report("sign", { state: "active" });
  const mapURI = input.mapId.startsWith("osm:") ? input.mapId : `preset:${input.mapId}`;
  const callArgs = [input.name.trim(), input.community.trim(), input.feeBps, impls, mapURI] as const;
  const [estimate, fees] = await Promise.all([
    publicClient.estimateContractGas({ address: ADDR.factory, abi: factoryAbi, functionName: "createCity", args: callArgs, account: owner }),
    feeCaps(),
  ]);
  // Monad menagih gas limit, bukan yang terpakai: pakai estimasi + 10%, bukan angka bulat.
  const gas = (estimate * 110n) / 100n;
  const hash = await wallet.sendTransaction({
    to: ADDR.factory,
    data: encodeFunctionData({ abi: factoryAbi, functionName: "createCity", args: callArgs }),
    gas,
    ...fees,
  });
  report("sign", { state: "done" });
  report("send", { state: "done", hash });
  report("confirm", { state: "active" });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The transaction was reverted.");
  const [created] = parseEventLogs({ abi: factoryAbi, eventName: "CityCreated", logs: receipt.logs });
  report("confirm", { state: "done" });
  return { hash, vault: created?.args.vault as Hex | undefined };
}

export const FOUND_STEPS: Step[] = [
  { id: "sign", label: "Sign and send from your account", state: "todo" },
  { id: "send", label: "Sent to Monad", state: "todo" },
  { id: "confirm", label: "City founded", state: "todo" },
];

/** Saldo MON minimum untuk mendirikan kota: gas limit (estimasi + 10%) x maxFeePerGas. Monad menolak bila saldo kurang. */
export async function estimateFoundCost(owner: Hex, adapterImpls?: Hex[]): Promise<bigint> {
  const args = ["Cost probe", "", 0, adapterImpls?.length ? adapterImpls : [ADDR.mirrorAdapterImpl], "preset:scbd-jakarta"] as const;
  const [estimate, fees] = await Promise.all([
    publicClient.estimateContractGas({ address: ADDR.factory, abi: factoryAbi, functionName: "createCity", args, account: owner }),
    feeCaps(),
  ]);
  return ((estimate * 110n) / 100n) * (fees.maxFeePerGas ?? 0n);
}

// ---------------------------------------------------------------------------------------------------------------
// Tata ulang alokasi (R6) dan kunci wakil (R9, B16). Walikota hanya memindahkan dana antara alun-alun (idle) dan adapter
// yang sudah terdaftar di kotanya; kontrak membatasi tiap aksi sebagai persen dari total aset.
// ---------------------------------------------------------------------------------------------------------------

export interface Slot { id: string; address: Hex | typeof zeroAddress; label: string; assets: bigint }
export interface MayorState {
  slots: Slot[];
  total: bigint;
  maxShiftBps: number;
  /** `budgetLeft` dan `budgetTotal`: batas pergeseran kunci wakil per jam (kontrak v3), dalam unit mentah AUSD. */
  deputy: { address: Hex; expiry: number; maxShiftBps: number; budgetLeft: bigint; budgetTotal: bigint } | null;
}

/** Keadaan vault yang dibutuhkan walikota, dibaca langsung dari chain (angka mentah, bukan hasil bulat). */
export async function readMayorState(vault: Hex, labels: Map<string, string>): Promise<MayorState> {
  const [adapters, maxShiftBps, key, expiry, keyShift, idle, budgetBps, windowStart, windowShifted, totalAssets] = await publicClient.multicall({
    allowFailure: false,
    contracts: [
      { address: vault, abi: vaultAbi, functionName: "adapters" },
      { address: vault, abi: vaultAbi, functionName: "maxShiftBps" },
      { address: vault, abi: vaultAbi, functionName: "sessionKey" },
      { address: vault, abi: vaultAbi, functionName: "sessionKeyExpiry" },
      { address: vault, abi: vaultAbi, functionName: "sessionKeyMaxShiftBps" },
      { address: ADDR.ausd, abi: erc20Abi, functionName: "balanceOf", args: [vault] },
      { address: vault, abi: vaultAbi, functionName: "sessionBudgetBps" },
      { address: vault, abi: vaultAbi, functionName: "sessionWindowStart" },
      { address: vault, abi: vaultAbi, functionName: "sessionWindowShifted" },
      { address: vault, abi: vaultAbi, functionName: "totalAssets" },
    ],
  });
  const held = await publicClient.multicall({
    allowFailure: false,
    contracts: adapters.map((a) => ({ address: a, abi: adapterAbi, functionName: "totalAssets" }) as const),
  });
  const slots: Slot[] = [
    { id: "idle", address: zeroAddress, label: "Plaza", assets: idle },
    ...adapters.map((a, i) => ({ id: a, address: a as Hex, label: labels.get(a) ?? `District ${i + 1}`, assets: held[i] })),
  ];
  const total = slots.reduce((s, x) => s + x.assets, 0n);
  const active = key !== zeroAddress && Number(expiry) > nowSec();
  // Anggaran kunci wakil: sebagian dari total aset per jam; jendela yang sudah lewat satu jam dihitung kosong.
  const budgetTotal = (totalAssets * BigInt(budgetBps)) / 10_000n;
  const windowOpen = nowSec() < BigInt(windowStart) + 3600n;
  const used = windowOpen ? windowShifted : 0n;
  return {
    slots, total, maxShiftBps,
    deputy: active ? { address: key as Hex, expiry: Number(expiry), maxShiftBps: keyShift, budgetTotal, budgetLeft: used >= budgetTotal ? 0n : budgetTotal - used } : null,
  };
}

/** Hash catatan rencana yang ikut tercatat di event `Rebalanced`. Catatan kosong memberi hash nol. */
export const planHashOf = (note: string): Hex => (note.trim() ? keccak256(toHex(note.trim())) : (`0x${"0".repeat(64)}` as Hex));

export interface RebalanceInput { vault: Hex; from: Hex | typeof zeroAddress; to: Hex | typeof zeroAddress; amount: bigint; planHash: Hex; owner: Hex }

/**
 * Menata ulang dengan kunci wakil (tanpa prompt) bila ada, atau kunci utama lewat ceremony baru bila belum ada wakil.
 * Gas dibayar si pengirim, jadi kunci wakil juga perlu sedikit MON.
 */
export async function rebalanceFlow(args: { wallet: WalletApi; input: RebalanceInput; useDeputy: boolean; report: Report }): Promise<{ hash: Hex }> {
  const { wallet, input, useDeputy, report } = args;
  const signer = useDeputy ? (wallet.deputy as Hex) : input.owner;
  const callArgs = [input.from, input.to, input.amount, input.planHash] as const;
  report("sign", { state: "active", detail: useDeputy ? undefined : "Confirm with your passkey" });
  const [estimate, fees] = await Promise.all([
    publicClient.estimateContractGas({ address: input.vault, abi: vaultAbi, functionName: "rebalance", args: callArgs, account: signer }),
    feeCaps(),
  ]);
  const tx = {
    to: input.vault,
    data: encodeFunctionData({ abi: vaultAbi, functionName: "rebalance", args: callArgs }),
    gas: (estimate * 120n) / 100n,
    ...fees,
  };
  const hash = useDeputy
    ? await wallet.sendAsDeputy(tx)
    : await wallet.withCeremony("Confirm the change with your passkey…", async (account) => {
        const { createWalletClient } = await import("viem");
        return createWalletClient({ account, chain: monadTestnet, transport: rpcTransport() }).sendTransaction(tx as never);
      });
  report("sign", { state: "done", detail: undefined });
  report("send", { state: "done", hash });
  report("confirm", { state: "active" });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The transaction was reverted.");
  report("confirm", { state: "done" });
  return { hash };
}

export const REBALANCE_STEPS: Step[] = [
  { id: "sign", label: "Sign the change", state: "todo" },
  { id: "send", label: "Sent to Monad", state: "todo" },
  { id: "confirm", label: "Allocation updated", state: "todo" },
];

/** Mendaftarkan atau mencabut kunci wakil. Ini ubah izin, jadi selalu ceremony baru dengan kunci utama. */
export async function setDeputyFlow(args: { wallet: WalletApi; vault: Hex; deputy: Hex | null; ttlSeconds: number; shiftBps: number; report: Report }): Promise<{ hash: Hex }> {
  const { wallet, vault, deputy, ttlSeconds, shiftBps, report } = args;
  const callArgs = deputy
    ? ([deputy, BigInt(Math.floor(Date.now() / 1000) + ttlSeconds), shiftBps] as const)
    : ([zeroAddress, 0n, 0] as const);
  report("sign", { state: "active", detail: "Confirm with your passkey" });
  const hash = await wallet.withCeremony(deputy ? "Confirm the new deputy key…" : "Confirm removing the deputy key…", async (account) => {
    const [estimate, fees] = await Promise.all([
      publicClient.estimateContractGas({ address: vault, abi: vaultAbi, functionName: "setSessionKey", args: callArgs, account: account.address }),
      feeCaps(),
    ]);
    const { createWalletClient } = await import("viem");
    return createWalletClient({ account, chain: monadTestnet, transport: rpcTransport() }).sendTransaction({
      to: vault,
      data: encodeFunctionData({ abi: vaultAbi, functionName: "setSessionKey", args: callArgs }),
      gas: (estimate * 120n) / 100n,
      ...fees,
    } as never);
  });
  report("sign", { state: "done", detail: undefined });
  report("send", { state: "done", hash });
  report("confirm", { state: "active" });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The transaction was reverted.");
  report("confirm", { state: "done" });
  return { hash };
}

export const DEPUTY_STEPS: Step[] = [
  { id: "sign", label: "Confirm with your passkey", state: "todo" },
  { id: "send", label: "Sent to Monad", state: "todo" },
  { id: "confirm", label: "Deputy key updated", state: "todo" },
];

// ---------------------------------------------------------------------------------------------------------------
// Transaksi walikota umum: dengan sesi (tanpa prompt) atau dengan ceremony baru (ubah izin dan pengaturan, PRD B16).
// ---------------------------------------------------------------------------------------------------------------

export interface ContractCall { address: Hex; abi: readonly unknown[]; functionName: string; args: readonly unknown[] }

export async function contractTx(wallet: WalletApi, call: ContractCall | ((account: LocalAccount) => Promise<ContractCall>), opts: { ceremony: boolean; label: string; report?: Report }): Promise<{ hash: Hex }> {
  const { report } = opts;
  report?.("sign", { state: "active", detail: opts.ceremony ? "Confirm with your passkey" : undefined });
  // `call` boleh berupa fungsi yang dijalankan di dalam ceremony, mis. bila transaksi memuat tanda tangan permit.
  const build = async (from: Hex, c: ContractCall) => {
    const data = (encodeFunctionData as (p: { abi: readonly unknown[]; functionName: string; args: readonly unknown[] }) => Hex)({ abi: c.abi, functionName: c.functionName, args: c.args });
    const [estimate, fees] = await Promise.all([
      publicClient.estimateGas({ account: from, to: c.address, data }),
      feeCaps(),
    ]);
    return { to: c.address, data, gas: (estimate * 125n) / 100n, ...fees };
  };
  let hash: Hex;
  if (opts.ceremony) {
    hash = await wallet.withCeremony(opts.label, async (account) => {
      const c = typeof call === "function" ? await call(account) : call;
      const { createWalletClient } = await import("viem");
      return createWalletClient({ account, chain: monadTestnet, transport: rpcTransport() }).sendTransaction((await build(account.address, c)) as never);
    });
  } else {
    if (typeof call === "function") throw new Error("This action needs a fresh passkey confirmation.");
    if (!wallet.address) throw new Error("Sign in first.");
    hash = await wallet.sendTransaction(await build(wallet.address, call));
  }
  report?.("sign", { state: "done", detail: undefined });
  report?.("send", { state: "done", hash });
  report?.("confirm", { state: "active" });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The transaction was reverted.");
  report?.("confirm", { state: "done" });
  return { hash };
}

/**
 * Menyewa staf lewat AgentMarketplace (kontrak v3 revisi 3): satu ceremony menandatangani permit AUSD sebesar harga
 * lalu mengirim `hireWithPermit`; harga langsung ke dompet agen. `expectedTerms` adalah sidik jari syarat yang tampil
 * di layar (harga, periode, kapabilitas, token, penjual, dompet); syarat dibaca ulang dari kontrak tepat sebelum
 * mengirim, dan kontrak menolak (`TermsChanged`) bila penjual mengubahnya. Listing gratis memakai `hire` tanpa permit.
 */
export async function hireFlow(args: { wallet: WalletApi; owner: Hex; offer: HireVia; name: string; report?: Report }): Promise<{ hash: Hex }> {
  const { wallet, owner, offer, name, report } = args;
  const price = BigInt(offer.price);
  if (price > 0n) {
    const balance = await publicClient.readContract({ address: offer.asset, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
    if (balance < price) throw new Error(`You need ${(Number(price) / 1e6).toFixed(2)} AUSD to hire ${name}, and you have ${(Number(balance) / 1e6).toFixed(2)}. Get test AUSD from the Deposit screen first.`);
  }
  const common = [BigInt(offer.listingId), BigInt(offer.periods), offer.expectedTerms, offer.hook, offer.data] as const;
  return contractTx(wallet, async (account) => {
    const live = await publicClient.readContract({ address: ADDR.marketplace, abi: marketplaceAbi, functionName: "termsHash", args: [BigInt(offer.listingId)] });
    if (live.toLowerCase() !== offer.expectedTerms.toLowerCase()) throw new Error("TermsChanged: the listing changed after you opened this screen.");
    if (price === 0n) return { address: ADDR.marketplace, abi: marketplaceAbi, functionName: "hire", args: common };
    const [domain, nonce] = await Promise.all([
      readAusdDomain(),
      publicClient.readContract({ address: offer.asset, abi: erc20Abi, functionName: "nonces", args: [owner] }),
    ]);
    const deadline = nowSec() + 600n;
    const sig = await account.signTypedData({
      domain: { name: domain.name, version: domain.version, chainId: monadTestnet.id, verifyingContract: offer.asset },
      types: PERMIT_TYPES,
      primaryType: "Permit",
      message: { owner, spender: ADDR.marketplace, value: price, nonce, deadline },
    });
    const { v, r, s } = splitSignature(sig);
    return { address: ADDR.marketplace, abi: marketplaceAbi, functionName: "hireWithPermit", args: [...common, deadline, v, r, s] };
  }, { ceremony: true, label: `Confirm hiring ${name} with your passkey…`, report });
}

export const TX_STEPS = (label: string): Step[] => [
  { id: "sign", label: "Sign", state: "todo" },
  { id: "send", label: "Sent to Monad", state: "todo" },
  { id: "confirm", label, state: "todo" },
];
