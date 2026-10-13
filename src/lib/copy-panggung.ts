import type { Lang } from "./lang";

/** Teks Panggung (peluncur token di Loket kota) dalam bahasa sehari-hari, dua bahasa. */

export interface PanggungCopy {
  title: (city: string) => string; sub: string; testnet: string; previewNote: string; reading: string;
  how: string[];
  mayorHdr: string; mayorIntro: string; on: string; off: string; turnOn: string; turnOff: string; save: string; feeLbl: string; feeHint: string;
  statsVolume: string; statsFees: string; statsUses: string; streamLbl: (due: string, pending: string) => string; feeNote: string;
  offNote: string; offMayor: string;
  tokensHdr: string; noTokens: string; priceLbl: string; youHold: (n: string) => string;
  buy: string; sell: string; amountAusd: string; amountTokens: string; max: string; youGet: (x: string) => string; cityFee: (x: string) => string; quoting: string;
  launchHdr: string; launchIntro: (fee: string) => string; nameLbl: string; symbolLbl: string; firstBuyLbl: string; firstBuyHint: string; launchBtn: (total: string) => string;
  balance: (a: string) => string; needAccount: string;
  steps: { gas: string; approve: string; sign: string; send: string; confirm: string };
  ceremony: { settings: string; approveAusd: (a: string) => string; approveToken: (s: string) => string; launch: string; buy: string; sell: string };
  done: { settings: string; launch: string; buy: string; sell: string };
  again: string; retry: string; working: string;
  err: { badName: string; zero: string; notEnough: (need: string, have: string) => string; fee: string };
  prediction: string;
}

const EN: PanggungCopy = {
  title: (c) => `Launchpad · ${c}`, sub: "A ready-made service of this city: launch a token and trade it.", testnet: "Testnet: AUSD and tokens here have no real value.",
  previewNote: "This is a sample city. Open a real city to use its launchpad.", reading: "Reading the launchpad…",
  how: [
    "Anyone can launch a token here for 1 AUSD. The whole supply sits on a price curve: the price rises when people buy and falls when they sell.",
    "Every launch, buy and sell pays the city's fee. The fee flows into the city's funds over about 12 hours, so the residents earn it.",
    "The mayor never receives the fee directly; the mayor only earns the usual fee on the residents' profit.",
  ],
  mayorHdr: "Your launchpad (mayor)", mayorIntro: "Switch the service on for visitors and choose the city's fee (0–3%).", on: "On", off: "Off", turnOn: "Switch on", turnOff: "Switch off", save: "Save fee", feeLbl: "City fee", feeHint: "0 to 3%",
  statsVolume: "Traded so far", statsFees: "Fees for the city", statsUses: "Uses", streamLbl: (d, p) => `Flowing into the city: ${p} AUSD waiting (${d} AUSD ready now).`, feeNote: "Fees reach the city's funds gradually, so nobody can grab them with a last-minute deposit.",
  offNote: "This city's launchpad is switched off.", offMayor: "Switch it on above so visitors can use it.",
  tokensHdr: "Tokens launched in this city", noTokens: "No token launched here yet. Be the first.", priceLbl: "Price", youHold: (n) => `You hold ${n}`,
  buy: "Buy", sell: "Sell", amountAusd: "AUSD to spend", amountTokens: "Tokens to sell", max: "All", youGet: (x) => `You get about ${x}`, cityFee: (x) => `City fee ${x} AUSD`, quoting: "Checking the price…",
  launchHdr: "Launch a token", launchIntro: (fee) => `Costs ${fee} AUSD, paid to the city. You get no free tokens: buy some right away if you want a share.`, nameLbl: "Name (max 32)", symbolLbl: "Symbol (max 8)", firstBuyLbl: "Buy at launch (optional)", firstBuyHint: "AUSD", launchBtn: (t) => `Launch for ${t} AUSD`,
  balance: (a) => `Your AUSD: ${a}`, needAccount: "Sign in to launch or trade tokens.",
  steps: { gas: "Gas for your account", approve: "Allow the city counter to use your tokens", sign: "Sign", send: "Sent to Monad", confirm: "Confirmed on Monad" },
  ceremony: { settings: "Confirm the launchpad settings with your passkey…", approveAusd: (a) => `Allow the city counter to use ${a} AUSD…`, approveToken: (s) => `Allow the city counter to sell your ${s}…`, launch: "Launching…", buy: "Buying…", sell: "Selling…" },
  done: { settings: "Saved.", launch: "Token launched.", buy: "Bought.", sell: "Sold." },
  again: "Done", retry: "Try again", working: "Working…",
  err: { badName: "Give the token a name (max 32) and a symbol (max 8).", zero: "Enter an amount above 0.", notEnough: (n, h) => `You need ${n} AUSD and have ${h}. Get test AUSD from the Deposit screen first.`, fee: "The fee can be at most 3%." },
  prediction: "Prediction markets are built but held back for now.",
};

const ID: PanggungCopy = {
  title: (c) => `Panggung · ${c}`, sub: "Layanan siap pakai kota ini: luncurkan token dan jual-beli.", testnet: "Testnet: AUSD dan token di sini tidak bernilai sungguhan.",
  previewNote: "Ini kota contoh. Buka kota sungguhan untuk memakai Panggung-nya.", reading: "Membaca Panggung…",
  how: [
    "Siapa pun bisa meluncurkan token di sini dengan 1 AUSD. Seluruh token ada di kurva harga: harga naik saat orang membeli dan turun saat orang menjual.",
    "Setiap peluncuran, pembelian, dan penjualan membayar fee kota. Fee itu mengalir ke dana kota selama sekitar 12 jam, jadi penduduk yang menikmatinya.",
    "Walikota tidak pernah menerima fee itu langsung; walikota hanya mendapat fee biasa atas keuntungan penduduk.",
  ],
  mayorHdr: "Panggung Anda (walikota)", mayorIntro: "Nyalakan layanan untuk pengunjung dan pilih fee kota (0–3%).", on: "Menyala", off: "Mati", turnOn: "Nyalakan", turnOff: "Matikan", save: "Simpan fee", feeLbl: "Fee kota", feeHint: "0 sampai 3%",
  statsVolume: "Total transaksi", statsFees: "Fee untuk kota", statsUses: "Dipakai", streamLbl: (d, p) => `Mengalir ke kota: ${p} AUSD menunggu (${d} AUSD siap sekarang).`, feeNote: "Fee masuk ke dana kota sedikit demi sedikit, supaya tidak bisa diambil orang yang menyetor di menit terakhir.",
  offNote: "Panggung kota ini sedang mati.", offMayor: "Nyalakan di atas supaya pengunjung bisa memakainya.",
  tokensHdr: "Token yang diluncurkan di kota ini", noTokens: "Belum ada token di sini. Jadilah yang pertama.", priceLbl: "Harga", youHold: (n) => `Anda punya ${n}`,
  buy: "Beli", sell: "Jual", amountAusd: "AUSD yang dibelanjakan", amountTokens: "Token yang dijual", max: "Semua", youGet: (x) => `Anda menerima sekitar ${x}`, cityFee: (x) => `Fee kota ${x} AUSD`, quoting: "Mengecek harga…",
  launchHdr: "Luncurkan token", launchIntro: (fee) => `Biayanya ${fee} AUSD, dibayar ke kota. Anda tidak mendapat token gratis: beli sebagian saat peluncuran bila ingin punya.`, nameLbl: "Nama (maks. 32)", symbolLbl: "Simbol (maks. 8)", firstBuyLbl: "Beli saat peluncuran (opsional)", firstBuyHint: "AUSD", launchBtn: (t) => `Luncurkan dengan ${t} AUSD`,
  balance: (a) => `AUSD Anda: ${a}`, needAccount: "Masuk dulu untuk meluncurkan atau jual-beli token.",
  steps: { gas: "Bensin (MON) untuk akun Anda", approve: "Izinkan Loket kota memakai token Anda", sign: "Tanda tangan", send: "Terkirim ke Monad", confirm: "Terkonfirmasi di Monad" },
  ceremony: { settings: "Konfirmasi pengaturan Panggung dengan passkey Anda…", approveAusd: (a) => `Izinkan Loket kota memakai ${a} AUSD…`, approveToken: (s) => `Izinkan Loket kota menjual ${s} Anda…`, launch: "Meluncurkan…", buy: "Membeli…", sell: "Menjual…" },
  done: { settings: "Tersimpan.", launch: "Token diluncurkan.", buy: "Terbeli.", sell: "Terjual." },
  again: "Selesai", retry: "Coba lagi", working: "Memproses…",
  err: { badName: "Beri token nama (maks. 32) dan simbol (maks. 8).", zero: "Isi jumlah lebih dari 0.", notEnough: (n, h) => `Anda butuh ${n} AUSD dan punya ${h}. Ambil AUSD uji dari layar Setor dulu.`, fee: "Fee paling tinggi 3%." },
  prediction: "Pasar prediksi sudah dibuat tetapi ditahan dulu.",
};

export const PANGGUNG: Record<Lang, PanggungCopy> = { en: EN, id: ID };
