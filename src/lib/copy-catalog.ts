import type { ServiceCategory } from "./catalog";
import type { Lang } from "./lang";

/** Teks katalog layanan protokol (nama jenis, penjelasan, alur ekonomi, risiko) dalam dua bahasa. Nama protokol tidak diterjemahkan. */

export interface ServiceCopy { blurb: string; flow: string; risk: string }
interface CatalogCopy {
  category: Record<ServiceCategory, { name: string; short: string }>;
  services: Record<string, ServiceCopy>;
  /** Teks umum per jenis untuk id layanan yang belum punya teks sendiri (mis. layanan baru dari relayer). */
  fallback: Record<ServiceCategory, ServiceCopy>;
  live: string; snapshot: string; soon: string; mirror: string;
}

const EN: CatalogCopy = {
  category: {
    bank: { name: "Bank", short: "Lending" },
    vault: { name: "Vault", short: "Yield vault" },
    staking: { name: "Staking tower", short: "Staking" },
    market: { name: "Market", short: "Liquidity" },
  },
  services: {
    "morpho-grove": { blurb: "Deposit into the Grove x Steakhouse high-yield AUSD vault on Morpho.", flow: "The vault lends your AUSD to Morpho markets; borrowers pay interest and the vault passes it on.", risk: "Smart-contract risk and the quality of the markets the vault lends to." },
    "aave-ausd": { blurb: "Lend AUSD in Aave v3's money market on Monad.", flow: "Borrowers pay interest; lenders (your city) earn it, minus Aave's cut.", risk: "Smart-contract risk, and the rate moves with borrower demand." },
    "euler-ausd": { blurb: "Lend AUSD in an Euler v2 vault (eAUSD).", flow: "Borrowers pay interest through the vault; depositors earn it.", risk: "Each Euler vault has its own risk settings; the rate moves with borrower demand." },
    "curvance-ausd": { blurb: "Lend AUSD in a Curvance market.", flow: "Borrowers pay interest on loans backed by other assets; lenders earn it.", risk: "Smart-contract risk and the quality of the collateral behind the loans." },
    "upshift-earnausd": { blurb: "Hold earnAUSD, Upshift's yield token that spreads AUSD across strategies.", flow: "Upshift allocates AUSD to lending and liquidity strategies and pays the net yield to holders.", risk: "Strategy and curator risk on top of the underlying protocols." },
    "curve-ausd-3pool": { blurb: "Provide liquidity to the AUSD/USDC/USDT0 stable pool on Curve.", flow: "Traders pay swap fees to liquidity providers.", risk: "A stablecoin in the pool could lose its peg; price risk between the stablecoins." },
    "balancer-avusd": { blurb: "Provide liquidity to the AVUSD/AUSD pool on Balancer v3.", flow: "Traders pay swap fees, sometimes plus incentives, to liquidity providers.", risk: "AVUSD could lose its peg; smart-contract risk." },
    shmonad: { blurb: "Stake MON through ShMonad and earn staking rewards.", flow: "Validators earn block rewards and fees; stakers share them. Here the district mirrors that yield.", risk: "Validator and slashing risk, and the price of MON." },
    "accountable-ausd": { blurb: "Lend AUSD on Accountable, a lending protocol on Monad.", flow: "Borrowers pay interest; lenders earn it, minus the protocol's cut.", risk: "Smart-contract risk and borrower quality; the rate moves with demand." },
    "neverland-ausd": { blurb: "Lend AUSD on Neverland, a smaller lending market on Monad.", flow: "Borrowers pay interest; lenders earn it.", risk: "Small market: thin liquidity can make withdrawals slow, and the rate swings widely." },
    "morpho-hyperusdc": { blurb: "Deposit into the HyperUSDC vault on Morpho.", flow: "The vault lends to Morpho markets; borrowers pay interest and the vault passes it on.", risk: "Smart-contract risk and the quality of the markets the vault lends to." },
    "yuzu-syzusd": { blurb: "Hold syzUSD, Yuzu Money's yield-bearing stablecoin.", flow: "Yuzu invests the pooled stablecoins in yield strategies and pays the net yield to holders.", risk: "Strategy risk and the stablecoin could lose its peg." },
    "beefy-usdc": { blurb: "Deposit USDC into a Beefy auto-compounding vault.", flow: "Beefy harvests rewards and re-invests them for you, so the yield compounds.", risk: "Smart-contract risk on Beefy and the protocol underneath." },
    "infinifi-siusd": { blurb: "Hold siUSD, infiniFi's yield-bearing stablecoin savings token.", flow: "infiniFi puts deposits to work in yield strategies and shares the net yield with holders.", risk: "Strategy risk, and the token could lose its peg." },
    "pendle-ausd-fixed": { blurb: "Buy a Pendle principal token for AUSD to lock a fixed rate until maturity.", flow: "Pendle splits yield from principal; the principal token is bought at a discount and pays out in full at maturity.", risk: "Smart-contract risk, and selling before maturity can cost you." },
    "mento-ausd-usdm": { blurb: "Provide liquidity to the AUSD/USDm pool on Mento.", flow: "Traders pay swap fees to liquidity providers.", risk: "Either stablecoin could lose its peg, and a thin pool can move the price." },
    "uniswap-wmon-usdc": { blurb: "Provide liquidity to the WMON/USDC pool on Uniswap v3.", flow: "Traders pay swap fees to liquidity providers. The rate is high because the pair is volatile.", risk: "High risk: when the MON price moves you can end up with less value than holding (impermanent loss), and the rate swings widely." },
    "kintsu-smon": { blurb: "Stake MON through Kintsu and hold sMON.", flow: "Validators earn block rewards and fees; stakers share them. Here the district mirrors that yield.", risk: "Validator and slashing risk, and the price of MON." },
  },
  fallback: {
    bank: { blurb: "Lend in this protocol's money market and earn its live rate.", flow: "Borrowers pay interest; lenders (your city) earn it, minus the protocol's cut.", risk: "Smart-contract risk, and the rate moves with borrower demand." },
    vault: { blurb: "Deposit into this protocol's yield vault and earn its live rate.", flow: "The vault places funds in yield strategies and pays the net yield to depositors.", risk: "Strategy and curator risk on top of the underlying protocols." },
    staking: { blurb: "Stake MON through this protocol and earn staking rewards.", flow: "Validators earn block rewards and fees; stakers share them.", risk: "Validator and slashing risk, and the price of MON." },
    market: { blurb: "Provide liquidity to this protocol's pool and earn swap fees.", flow: "Traders pay swap fees to liquidity providers.", risk: "Price risk between the pooled assets, and smart-contract risk." },
  },
  live: "Live mainnet data", snapshot: "Recent mainnet snapshot", soon: "Coming soon", mirror: "Live mainnet yield, simulated funds",
};

const ID: CatalogCopy = {
  category: {
    bank: { name: "Bank", short: "Pinjaman" },
    vault: { name: "Brankas", short: "Brankas imbal hasil" },
    staking: { name: "Menara Staking", short: "Staking" },
    market: { name: "Pasar", short: "Likuiditas" },
  },
  services: {
    "morpho-grove": { blurb: "Menyetor ke vault AUSD imbal hasil tinggi Grove x Steakhouse di Morpho.", flow: "Vault meminjamkan AUSD Anda ke pasar Morpho; peminjam membayar bunga dan vault meneruskannya.", risk: "Risiko kontrak pintar dan mutu pasar tempat vault meminjamkan." },
    "aave-ausd": { blurb: "Meminjamkan AUSD di pasar uang Aave v3 di Monad.", flow: "Peminjam membayar bunga; pemberi pinjaman (kota Anda) menerimanya, dikurangi bagian Aave.", risk: "Risiko kontrak pintar, dan suku bunga naik-turun mengikuti permintaan peminjam." },
    "euler-ausd": { blurb: "Meminjamkan AUSD di vault Euler v2 (eAUSD).", flow: "Peminjam membayar bunga lewat vault; penyetor menerimanya.", risk: "Tiap vault Euler punya pengaturan risiko sendiri; suku bunga mengikuti permintaan peminjam." },
    "curvance-ausd": { blurb: "Meminjamkan AUSD di pasar Curvance.", flow: "Peminjam membayar bunga atas pinjaman berjaminan aset lain; pemberi pinjaman menerimanya.", risk: "Risiko kontrak pintar dan mutu jaminan di balik pinjaman." },
    "upshift-earnausd": { blurb: "Memegang earnAUSD, token imbal hasil Upshift yang menyebar AUSD ke beberapa strategi.", flow: "Upshift menempatkan AUSD di strategi pinjaman dan likuiditas, lalu membayarkan imbal hasil bersihnya ke pemegang.", risk: "Risiko strategi dan kurator, di atas risiko protokol di bawahnya." },
    "curve-ausd-3pool": { blurb: "Menyediakan likuiditas di kolam stabil AUSD/USDC/USDT0 di Curve.", flow: "Pedagang membayar biaya tukar kepada penyedia likuiditas.", risk: "Salah satu stablecoin di kolam bisa lepas dari patokan; ada risiko selisih harga antar stablecoin." },
    "balancer-avusd": { blurb: "Menyediakan likuiditas di kolam AVUSD/AUSD di Balancer v3.", flow: "Pedagang membayar biaya tukar, kadang ditambah insentif, kepada penyedia likuiditas.", risk: "AVUSD bisa lepas dari patokan; risiko kontrak pintar." },
    shmonad: { blurb: "Menaruh MON di staking lewat ShMonad dan menerima imbal hasil staking.", flow: "Validator mendapat hadiah blok dan biaya; penaruh ikut membaginya. Distrik ini meniru imbal hasil itu.", risk: "Risiko validator dan pemotongan (slashing), serta harga MON." },
    "accountable-ausd": { blurb: "Meminjamkan AUSD di Accountable, protokol pinjaman di Monad.", flow: "Peminjam membayar bunga; pemberi pinjaman menerimanya, dikurangi bagian protokol.", risk: "Risiko kontrak pintar dan mutu peminjam; suku bunga naik-turun mengikuti permintaan." },
    "neverland-ausd": { blurb: "Meminjamkan AUSD di Neverland, pasar pinjaman yang lebih kecil di Monad.", flow: "Peminjam membayar bunga; pemberi pinjaman menerimanya.", risk: "Pasar kecil: likuiditas tipis bisa memperlambat penarikan, dan suku bunga berayun lebar." },
    "morpho-hyperusdc": { blurb: "Menyetor ke vault HyperUSDC di Morpho.", flow: "Vault meminjamkan ke pasar Morpho; peminjam membayar bunga dan vault meneruskannya.", risk: "Risiko kontrak pintar dan mutu pasar tempat vault meminjamkan." },
    "yuzu-syzusd": { blurb: "Memegang syzUSD, stablecoin berimbal hasil dari Yuzu Money.", flow: "Yuzu menanamkan stablecoin terkumpul ke strategi imbal hasil dan membayarkan hasil bersihnya ke pemegang.", risk: "Risiko strategi, dan stablecoin bisa lepas dari patokan." },
    "beefy-usdc": { blurb: "Menyetor USDC ke vault Beefy yang memajemukkan otomatis.", flow: "Beefy memanen hadiah lalu menanamkannya kembali, sehingga imbal hasil berbunga-bunga.", risk: "Risiko kontrak pintar pada Beefy dan protokol di bawahnya." },
    "infinifi-siusd": { blurb: "Memegang siUSD, token tabungan stablecoin berimbal hasil dari infiniFi.", flow: "infiniFi menanamkan setoran ke strategi imbal hasil dan membagi hasil bersihnya ke pemegang.", risk: "Risiko strategi, dan token bisa lepas dari patokan." },
    "pendle-ausd-fixed": { blurb: "Membeli token pokok Pendle untuk AUSD agar suku bunga tetap terkunci sampai jatuh tempo.", flow: "Pendle memisahkan imbal hasil dari pokok; token pokok dibeli dengan diskon dan dibayar penuh saat jatuh tempo.", risk: "Risiko kontrak pintar, dan menjual sebelum jatuh tempo bisa merugikan." },
    "mento-ausd-usdm": { blurb: "Menyediakan likuiditas di kolam AUSD/USDm di Mento.", flow: "Pedagang membayar biaya tukar kepada penyedia likuiditas.", risk: "Salah satu stablecoin bisa lepas dari patokan, dan kolam tipis mudah menggeser harga." },
    "uniswap-wmon-usdc": { blurb: "Menyediakan likuiditas di kolam WMON/USDC di Uniswap v3.", flow: "Pedagang membayar biaya tukar kepada penyedia likuiditas. Angkanya tinggi karena pasangan ini bergejolak.", risk: "Risiko tinggi: bila harga MON bergerak, nilai Anda bisa lebih kecil daripada hanya memegang (impermanent loss), dan suku bunga berayun lebar." },
    "kintsu-smon": { blurb: "Menaruh MON di staking lewat Kintsu dan memegang sMON.", flow: "Validator mendapat hadiah blok dan biaya; penaruh ikut membaginya. Distrik ini meniru imbal hasil itu.", risk: "Risiko validator dan pemotongan (slashing), serta harga MON." },
  },
  fallback: {
    bank: { blurb: "Meminjamkan di pasar uang protokol ini dan menerima suku bunga langsungnya.", flow: "Peminjam membayar bunga; pemberi pinjaman (kota Anda) menerimanya, dikurangi bagian protokol.", risk: "Risiko kontrak pintar, dan suku bunga naik-turun mengikuti permintaan peminjam." },
    vault: { blurb: "Menyetor ke vault imbal hasil protokol ini dan menerima suku bunga langsungnya.", flow: "Vault menempatkan dana di strategi imbal hasil dan membayarkan hasil bersihnya ke penyetor.", risk: "Risiko strategi dan kurator, di atas risiko protokol di bawahnya." },
    staking: { blurb: "Menaruh MON di staking lewat protokol ini dan menerima imbal hasil staking.", flow: "Validator mendapat hadiah blok dan biaya; penaruh ikut membaginya.", risk: "Risiko validator dan pemotongan (slashing), serta harga MON." },
    market: { blurb: "Menyediakan likuiditas di kolam protokol ini dan menerima biaya tukar.", flow: "Pedagang membayar biaya tukar kepada penyedia likuiditas.", risk: "Risiko selisih harga antar aset di kolam, dan risiko kontrak pintar." },
  },
  live: "Data mainnet langsung", snapshot: "Potret terbaru data mainnet", soon: "Segera hadir", mirror: "Imbal hasil mainnet langsung, dana simulasi",
};

export const CATALOG_COPY: Record<Lang, CatalogCopy> = { en: EN, id: ID };

/** Teks layanan: teks dua bahasa bila id dikenal, lalu teks bawaan relayer, lalu teks umum per jenis. */
export function serviceCopy(lang: Lang, id: string, category: ServiceCategory, relayer?: Partial<ServiceCopy>): ServiceCopy {
  const c = CATALOG_COPY[lang];
  const own = c.services[id];
  if (own) return own;
  const fb = c.fallback[category];
  return { blurb: relayer?.blurb || fb.blurb, flow: relayer?.flow || fb.flow, risk: relayer?.risk || fb.risk };
}
