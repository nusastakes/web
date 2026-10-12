// Menyalin alamat kontrak dari catatan deploy ke src/lib/deployment.json, supaya repo `web` mandiri setelah
// dipublikasikan sendiri (folder contracts/ tidak ikut). Jalankan lagi setiap kali kontrak di-deploy ulang:
//
//   npm run sync:deployment
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "..", "contracts", "deployments", "monad-testnet.json");
if (!existsSync(src)) {
  console.error(`Tidak ada ${src}. Jalankan dari monorepo, atau pertahankan src/lib/deployment.json yang sudah ada.`);
  process.exit(1);
}
const d = JSON.parse(readFileSync(src, "utf8"));
const out = {
  network: d.network,
  chainId: d.chainId,
  deployedAt: d.deployedAt,
  version: d.version ?? 1,
  asset: d.asset,
  sourceId: d.sourceId,
  sourceLabel: d.sourceLabel,
  contracts: Object.fromEntries(Object.entries(d.contracts).map(([k, v]) => [k, v.address])),
};
writeFileSync(join(root, "src", "lib", "deployment.json"), JSON.stringify(out, null, 2) + "\n");

// Nama produk hanya ditulis di brand.json (root monorepo); salin ke sini supaya repo `web` mandiri.
const brandSrc = join(root, "..", "brand.json");
if (existsSync(brandSrc)) writeFileSync(join(root, "src", "lib", "brand.json"), readFileSync(brandSrc, "utf8"));
console.log("deployment.json diperbarui:", JSON.stringify(out.contracts));
