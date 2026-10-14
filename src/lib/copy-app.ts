import type { Lang } from "./lang";

/** Teks di dalam aplikasi kota (`/city`) dalam bahasa Inggris dan Indonesia. Bahasa awam, sama seperti halaman depan. */

const EN = {
  onb: {
    welcomeTitle: "Your account is ready",
    welcomeLead: "Three things to know before you start:",
    welcomePoints: [
      ["A city is a shared savings pot", "You deposit digital dollars (AUSD). The mayor puts them to work and you can take them out any time."],
      ["You only sign", "We pay the network fee. Your fingerprint, face or PIN approves each step."],
      ["Test money, simulated interest", "This is a test network. The money is free and the interest is simulated, so nothing here is real."],
    ] as [string, string][],
    start: "Show me the steps", skip: "Just look around",
    title: "Get started", progress: (n: number, t: number) => `${n} of ${t} steps`,
    collapse: "Minimise", expand: "Open the guide", hide: "Hide guide", optional: "Optional",
    steps: {
      account: ["Account created", "You can now deposit and withdraw with your fingerprint."],
      money: ["Get test money", "Free test dollars (AUSD) so you can try a city. None of it is real."],
      deposit: ["Make your first deposit", "Put some AUSD into a city. You can withdraw it whenever you like."],
      look: ["See your money at work", "Tap any building to look inside, or watch the trucks carry money between districts."],
      mayor: ["Found your own city", "Become a mayor: pick a real place on the map and decide where the money works."],
    },
    getMoney: "Get 10,000 test AUSD", sending: "Sending…", queued: (s: number) => `The test-money tap is busy. Trying again in ${s}s…`, moneyFail: "Could not send test money right now.",
    moneyHint: "If that keeps failing, try again in a minute or use the account menu.",
    depositTo: (name: string) => `Deposit into ${name}`, chooseCity: "Choose a city",
    inCity: (name: string) => `Selected city: ${name}`,
    celebrateTitle: "You are a resident now", celebrateBody: "Your money is working in the city. Come back to watch it grow, or try one of these:",
    foundCity: "Found your own city", seeBoard: "See the leaderboard", close: "Done",
    reopen: "Show getting-started guide",
  },
  top: { choose: "Choose a city", preview: "Preview", liveOn: "Live on Monad testnet", noLive: "No live cities yet. Found the first one.", previewHdr: "Preview · sample data", board: "Leaderboard", exploreAria: "Explore cities", home: "Home", net: "Monad testnet" },
  dock: { deposit: "Deposit", withdraw: "Withdraw", found: "Found city", manage: "Manage", panggung: "Stage", rules: "Rules", reset: "Reset view", details: "City details" },
  kpi: {
    assets: "Total assets", districts: (n: number) => `${n} district${n === 1 ? "" : "s"}`, yield: "Yield", simulated: "Simulated · mirrors mainnet", none: "No funds placed yet", protocol: "From the protocol",
    price: "Share price", since: "since founding", residents: "Residents", sample: "Sample data", fee: "Mayor fee", onlyProfit: "Only on profit",
  },
  acct: {
    working: "Working…", signIn: "Sign in", oneTap: "One tap, no wallet", oneTapBody: "Your fingerprint, face or device PIN creates your account. No seed phrase, no extension, and no gas token needed.",
    create: "Create account", have: "I already have an account", aria: "Account", locked: "Locked · tap to unlock", copy: "Copy address", passkeyAcct: "Passkey account · Monad testnet",
    ausd: "AUSD", gas: "MON (gas)", getAusd: "Get 10,000 test AUSD", ausdSent: "10,000 test AUSD sent to your account.", getGas: "Get gas for mayor actions", gasSent: "A little testnet MON was sent for mayor actions.",
    keys: "Keys in this session", keyAccount: ["Account", "signs deposits and approvals without a prompt"], keyDeputy: ["Deputy key", "may only move funds between districts, within limits"],
    keyBook: ["Strategy book", "unlocked (separate passkey namespace)", "locked"],
    keysNote: "A fresh passkey prompt is always needed to withdraw, change the deputy key, or hire and release AI staff. Keys live only in this page's memory and are wiped when it locks.",
    locksIn: "Locks in", lockNow: "Lock now", signOut: "Sign out",
  },
  need: { locked: "Your session locked itself after 10 idle minutes. Unlock it with your passkey.", create: "Create your account with a fingerprint, face or device PIN. No seed phrase, no wallet app, and no gas token.", unlock: "Unlock with passkey", createBtn: "Create account", have: "I already have an account" },
  dep: {
    title: (n: string) => `Deposit into ${n}`, sub: "Move your funds into the city. You can withdraw at any time.", previewNote: "This is a preview city with sample data. Pick a live city from the list at the top, or found your own.",
    amount: "Amount (AUSD)", amountAria: "Amount in AUSD", max: (v: string) => `Max ${v}`, haveBal: (v: string) => `You have ${v} AUSD. Test money is free on this network.`, getBtn: "Get 10,000 AUSD",
    pErrEnter: "Enter an amount, for example 10.", pErrMin: "The minimum is 0.01 AUSD.", pErrBal: "You do not have that much AUSD.", pErrCap: "This city cannot take that much more.", pErrQuarantine: "Deposits are paused: one district is in withdraw-only mode. You can still withdraw.",
    receive: (p: string) => `You receive city shares worth the same amount at today's price (${p} AUSD each). You pay no gas: you only sign, and a relayer sends the transaction.`, simYield: " Yield here is simulated on testnet.",
    deposited: "Deposited.", firstTx: (s: string, c: number) => ` Account to first transaction: ${s} s with ${c} passkey prompt${c === 1 ? "" : "s"}.`, working: "Working…", btn: (a: string) => `Deposit ${a} AUSD`, again: (a: string) => `Deposit ${a} AUSD again`,
  },
  wd: {
    title: (n: string) => `Withdraw from ${n}`, sub: "Your funds come back to your account. Money leaving always asks for your passkey.", previewNote: "This is a preview city with sample data, so there is nothing to withdraw.", quarantined: "One district is in withdraw-only mode (quarantined). Withdrawing now is paid at the price of what is liquid today and gives up your share of the locked part. The amount below already uses that price.",
    withdrawn: "Withdrawn. The funds are back in your account.", done: "Done", retry: "Try again", reading: "Reading your position…", none: "You have no funds in this city yet. Deposit first.",
    yours: "Your funds in this city", all: "All", receive: "You receive", working: "Working…", btn: (all: boolean, pct: number) => `Withdraw ${all ? "everything" : `${pct}%`}`,
  },
  panel: {
    notPlaced: "Not placed anywhere", empty: "empty", noReport: "No report yet.", notHired: "This city has no Public Relations staff yet. The mayor can hire one in the town hall.", writing: "The weekly report is still being written. Try again in a minute.",
    noCommunity: "No community", previewBadge: "Preview · sample data", live: "Live", youMayor: "You are the mayor", mayor: "Mayor", copyAria: "Copy mayor address", copied: "Copied", vault: "Vault", link: "Copy city link", linkCopied: "Link copied", svcFlow: "How it earns", svcRisk: "Risk", svcTvl: (v: string) => `The real protocol holds about ${v} on mainnet.`,
    where: "Where the money is", showAll: "Show all", simulated: "Simulated", idle: "Idle", liveProto: "Live protocol", funds: "Funds", share: "Share", apy: "APY",
    quarantined: "Quarantined", quarantineNote: "The city could not read this service's value, so it is set aside and not counted until it works again. Anyone can try to restore it.", restore: "Try to restore", restoring: "Restoring…", restored: "Restored: the service is counted again.",
    simNote: (p: string) => [`Testnet has no lending protocol that accepts AUSD, so nothing is lent here. This district earns the live APY of `, p, `, paid from a testnet reserve. The real protocol is used on mainnet.`] as [string, string, string],
    idleNote: "The plaza holds funds that the mayor has not placed anywhere. They earn nothing and can be withdrawn at any time.",
    loadingReport: "Loading the weekly report…", hideReport: "Hide the weekly report", readReport: "Read the weekly report (Public Relations)",
    keeps: (fee: string) => [`The mayor keeps `, fee, ` of profit only, and can never move funds to their own wallet.`] as [string, string, string], founded: (ago: string) => ` Founded ${ago}.`,
  },
  hud: {
    vehicles: "vehicles", people: "people", buses: "buses", trips: "trips", deliveries: "deliveries", sales: "sales", weatherAuto: "Weather: auto", clear: "clear", rain: "rain",
    demo: "▶ Watch the demo (80 s)", note: "Simulated city life. Click a building to look inside, or a car, bus, or person to see what they are doing.", close: "Close", closeBuilding: "Close building",
    peopleInside: (n: number) => `${n} people inside`, floor: "Fl", agenda: "City agenda",
  },
  attribution: "Map data © OpenStreetMap contributors · Overture Maps Foundation. Testnet only; no real money.",
  no3d: "This device cannot show the 3D city, so here is the map. Everything else works.",
  building3d: "Building the city…", canvasAria: "3D city", sampleEvent: "Sample event",
  mapFallback: "The real map of this area could not be loaded, so you see open land for now. Trying again in the background.",
  intro: {
    kicker: "Welcome to Nusastakes", next: "Next", skip: "Skip", demo: "Watch the 80-second demo", explore: "Explore cities", look: "Look around",
    steps: [
      ["Every city is a savings pool", "Residents deposit AUSD into a city. Each city is an ERC-4626 vault on Monad, and the 3D city grows with its economy: the money in it, what it earns, its visitors, and how many kinds of services the mayor runs."],
      ["The mayor runs the city", "The mayor places the funds in districts that earn yield. The mayor earns a fee only from residents' profit, and the contract never lets them send funds to their own wallet."],
      ["One passkey, no seed phrase", "Your account comes from a passkey (Mera). The same passkey also locks the mayor's sealed strategy book: plans written before the results, revealed at the end of the season."],
      ["AI staff with hard limits", "Mayors hire AI staff: the Security Guard (a Chainlink CRE workflow) can only pull funds back to safety, the Analyst only proposes, and Public Relations writes the weekly report."],
      ["Testnet, simulated yield", "This is Monad testnet. Yield follows a live mainnet AUSD vault and is labelled simulated. Test money is free."],
    ] as [string, string][],
  },
  banner: { citiesFail: "Cannot reach the network to load cities. Retrying…" },
};

const ID: typeof EN = {
  onb: {
    welcomeTitle: "Akun Anda sudah siap",
    welcomeLead: "Tiga hal yang perlu diketahui sebelum mulai:",
    welcomePoints: [
      ["Kota adalah celengan bersama", "Anda menyetor dolar digital (AUSD). Walikota mengerjakan uangnya, dan Anda bisa menariknya kapan saja."],
      ["Anda hanya menandatangani", "Biaya jaringan kami yang bayar. Sidik jari, wajah, atau PIN Anda menyetujui tiap langkah."],
      ["Uang uji, bunga simulasi", "Ini jaringan uji. Uangnya gratis dan bunganya simulasi, jadi tidak ada yang sungguhan."],
    ],
    start: "Tunjukkan langkahnya", skip: "Lihat-lihat dulu",
    title: "Mulai di sini", progress: (n, t) => `${n} dari ${t} langkah`,
    collapse: "Kecilkan", expand: "Buka panduan", hide: "Sembunyikan panduan", optional: "Opsional",
    steps: {
      account: ["Akun sudah dibuat", "Sekarang Anda bisa menyetor dan menarik dengan sidik jari."],
      money: ["Ambil uang uji", "Dolar uji gratis (AUSD) supaya Anda bisa mencoba sebuah kota. Semuanya bukan uang sungguhan."],
      deposit: ["Setor pertama Anda", "Masukkan sedikit AUSD ke sebuah kota. Bisa Anda tarik kapan saja."],
      look: ["Lihat uang Anda bekerja", "Ketuk gedung mana saja untuk melihat isinya, atau perhatikan truk yang membawa uang antar distrik."],
      mayor: ["Dirikan kota sendiri", "Jadi walikota: pilih tempat nyata di peta dan tentukan di mana uang bekerja."],
    },
    getMoney: "Ambil 10.000 AUSD uji", sending: "Mengirim…", queued: (s) => `Keran uang uji sedang ramai. Mencoba lagi dalam ${s} dtk…`, moneyFail: "Uang uji belum bisa dikirim sekarang.",
    moneyHint: "Kalau terus gagal, coba lagi semenit lagi atau pakai menu akun.",
    depositTo: (name) => `Setor ke ${name}`, chooseCity: "Pilih kota",
    inCity: (name) => `Kota terpilih: ${name}`,
    celebrateTitle: "Anda sudah jadi penduduk", celebrateBody: "Uang Anda bekerja di kota. Kembali lagi untuk melihatnya tumbuh, atau coba salah satu ini:",
    foundCity: "Dirikan kota sendiri", seeBoard: "Lihat papan peringkat", close: "Selesai",
    reopen: "Tampilkan panduan mulai",
  },
  top: { choose: "Pilih kota", preview: "Contoh", liveOn: "Aktif di Monad testnet", noLive: "Belum ada kota aktif. Dirikan yang pertama.", previewHdr: "Contoh · data contoh", board: "Peringkat", exploreAria: "Jelajahi kota", home: "Beranda", net: "Monad testnet" },
  dock: { deposit: "Setor", withdraw: "Tarik", found: "Dirikan kota", manage: "Kelola", panggung: "Panggung", rules: "Aturan", reset: "Setel ulang tampilan", details: "Rincian kota" },
  kpi: {
    assets: "Total dana", districts: (n) => `${n} distrik`, yield: "Imbal hasil", simulated: "Simulasi · meniru mainnet", none: "Belum ada dana yang ditempatkan", protocol: "Dari protokol",
    price: "Harga saham kota", since: "sejak didirikan", residents: "Penduduk", sample: "Data contoh", fee: "Fee walikota", onlyProfit: "Hanya dari untung",
  },
  acct: {
    working: "Memproses…", signIn: "Masuk", oneTap: "Satu ketukan, tanpa dompet", oneTapBody: "Sidik jari, wajah, atau PIN perangkat Anda membuat akun. Tanpa frasa rahasia, tanpa ekstensi, tanpa token gas.",
    create: "Buat akun", have: "Saya sudah punya akun", aria: "Akun", locked: "Terkunci · ketuk untuk membuka", copy: "Salin alamat", passkeyAcct: "Akun passkey · Monad testnet",
    ausd: "AUSD", gas: "MON (gas)", getAusd: "Ambil 10.000 AUSD uji", ausdSent: "10.000 AUSD uji sudah dikirim ke akun Anda.", getGas: "Ambil gas untuk aksi walikota", gasSent: "Sedikit MON testnet sudah dikirim untuk aksi walikota.",
    keys: "Kunci di sesi ini", keyAccount: ["Akun", "menandatangani setoran dan persetujuan tanpa permintaan baru"], keyDeputy: ["Kunci wakil", "hanya boleh memindahkan dana antar distrik, dalam batas"],
    keyBook: ["Buku strategi", "terbuka (namespace passkey terpisah)", "terkunci"],
    keysNote: "Menarik dana, mengganti kunci wakil, serta menyewa dan mencabut staf AI selalu meminta passkey baru. Kunci hanya ada di memori halaman ini dan dihapus saat terkunci.",
    locksIn: "Terkunci dalam", lockNow: "Kunci sekarang", signOut: "Keluar",
  },
  need: { locked: "Sesi Anda terkunci sendiri setelah 10 menit diam. Buka dengan passkey Anda.", create: "Buat akun dengan sidik jari, wajah, atau PIN perangkat. Tanpa frasa rahasia, tanpa aplikasi dompet, tanpa token gas.", unlock: "Buka dengan passkey", createBtn: "Buat akun", have: "Saya sudah punya akun" },
  dep: {
    title: (n) => `Setor ke ${n}`, sub: "Pindahkan dana Anda ke kota. Bisa ditarik kapan saja.", previewNote: "Ini kota contoh dengan data contoh. Pilih kota aktif dari daftar di atas, atau dirikan kota Anda sendiri.",
    amount: "Jumlah (AUSD)", amountAria: "Jumlah dalam AUSD", max: (v) => `Maks ${v}`, haveBal: (v) => `Anda punya ${v} AUSD. Uang uji gratis di jaringan ini.`, getBtn: "Ambil 10.000 AUSD",
    pErrEnter: "Masukkan jumlah, misalnya 10.", pErrMin: "Minimalnya 0,01 AUSD.", pErrBal: "AUSD Anda tidak cukup.", pErrCap: "Kota ini tidak bisa menampung sebanyak itu lagi.", pErrQuarantine: "Setoran dijeda: satu distrik sedang dalam mode hanya-tarik. Anda tetap bisa menarik dana.",
    receive: (p) => `Anda menerima saham kota senilai sama dengan harga hari ini (${p} AUSD per saham). Anda tidak membayar gas: Anda hanya menandatangani, dan relayer yang mengirim transaksinya.`, simYield: " Imbal hasil di sini adalah simulasi di testnet.",
    deposited: "Setoran berhasil.", firstTx: (s, c) => ` Dari akun ke transaksi pertama: ${s} dtk dengan ${c} permintaan passkey.`, working: "Memproses…", btn: (a) => `Setor ${a} AUSD`, again: (a) => `Setor ${a} AUSD lagi`,
  },
  wd: {
    title: (n) => `Tarik dari ${n}`, sub: "Dana kembali ke akun Anda. Uang yang keluar selalu meminta passkey Anda.", previewNote: "Ini kota contoh dengan data contoh, jadi tidak ada yang bisa ditarik.", quarantined: "Satu distrik sedang dalam mode hanya-tarik (karantina). Menarik sekarang dibayar pada harga bagian yang likuid hari ini dan melepas bagian Anda dari dana yang terkunci. Jumlah di bawah sudah memakai harga itu.",
    withdrawn: "Penarikan berhasil. Dana sudah kembali ke akun Anda.", done: "Selesai", retry: "Coba lagi", reading: "Membaca posisi Anda…", none: "Anda belum punya dana di kota ini. Setor dulu.",
    yours: "Dana Anda di kota ini", all: "Semua", receive: "Anda menerima", working: "Memproses…", btn: (all, pct) => `Tarik ${all ? "semuanya" : `${pct}%`}`,
  },
  panel: {
    notPlaced: "Belum ditempatkan di mana pun", empty: "kosong", noReport: "Belum ada laporan.", notHired: "Kota ini belum punya Humas. Walikota bisa menyewanya di balai kota.", writing: "Laporan mingguan masih ditulis. Coba lagi semenit lagi.",
    noCommunity: "Tanpa komunitas", previewBadge: "Contoh · data contoh", live: "Aktif", youMayor: "Anda walikotanya", mayor: "Walikota", copyAria: "Salin alamat walikota", copied: "Tersalin", vault: "Brankas", link: "Salin tautan kota", linkCopied: "Tautan tersalin", svcFlow: "Cara menghasilkan", svcRisk: "Risiko", svcTvl: (v) => `Protokol aslinya menyimpan sekitar ${v} di mainnet.`,
    where: "Di mana uangnya", showAll: "Tampilkan semua", simulated: "Simulasi", idle: "Menganggur", liveProto: "Protokol sungguhan", funds: "Dana", share: "Porsi", apy: "APY",
    quarantined: "Dikarantina", quarantineNote: "Kota tidak bisa membaca nilai layanan ini, jadi layanan disisihkan dan tidak dihitung sampai berfungsi lagi. Siapa pun boleh mencoba memulihkannya.", restore: "Coba pulihkan", restoring: "Memulihkan…", restored: "Pulih: layanan dihitung lagi.",
    simNote: (p) => [`Testnet tidak punya protokol pinjaman yang menerima AUSD, jadi tidak ada yang dipinjamkan di sini. Distrik ini mendapat APY langsung dari `, p, `, dibayar dari cadangan testnet. Protokol aslinya dipakai di mainnet.`],
    idleNote: "Alun-alun menyimpan dana yang belum ditempatkan walikota di mana pun. Dana ini tidak menghasilkan apa-apa dan bisa ditarik kapan saja.",
    loadingReport: "Memuat laporan mingguan…", hideReport: "Sembunyikan laporan mingguan", readReport: "Baca laporan mingguan (Humas)",
    keeps: (fee) => [`Walikota hanya mengambil `, fee, ` dari keuntungan, dan tidak pernah bisa memindahkan dana ke dompetnya sendiri.`], founded: (ago) => ` Didirikan ${ago}.`,
  },
  hud: {
    vehicles: "kendaraan", people: "orang", buses: "bus", trips: "perjalanan", deliveries: "pengiriman", sales: "penjualan", weatherAuto: "Cuaca: otomatis", clear: "cerah", rain: "hujan",
    demo: "▶ Tonton demo (80 dtk)", note: "Kehidupan kota hanya simulasi. Klik gedung untuk melihat isinya, atau mobil, bus, dan orang untuk melihat kegiatannya.", close: "Tutup", closeBuilding: "Tutup gedung",
    peopleInside: (n) => `${n} orang di dalam`, floor: "Lt", agenda: "Agenda kota",
  },
  attribution: "Data peta © OpenStreetMap contributors · Overture Maps Foundation. Hanya testnet; bukan uang sungguhan.",
  no3d: "Perangkat ini tidak bisa menampilkan kota 3D, jadi inilah petanya. Fitur lainnya tetap berfungsi.",
  building3d: "Membangun kota…", canvasAria: "Kota 3D", sampleEvent: "Acara contoh",
  mapFallback: "Peta asli area ini belum bisa dimuat, jadi untuk sementara tampil lahan kosong. Mencoba lagi di latar.",
  intro: {
    kicker: "Selamat datang di Nusastakes", next: "Lanjut", skip: "Lewati", demo: "Tonton demo 80 detik", explore: "Jelajahi kota", look: "Lihat-lihat",
    steps: [
      ["Setiap kota adalah celengan bersama", "Penduduk menyetor AUSD ke sebuah kota. Tiap kota adalah vault ERC-4626 di Monad, dan kota 3D tumbuh mengikuti ekonominya: uang di dalamnya, penghasilannya, pengunjungnya, dan berapa jenis layanan yang diurus walikota."],
      ["Walikota menjalankan kota", "Walikota menempatkan dana di distrik yang menghasilkan bunga. Walikota hanya mendapat fee dari keuntungan penduduk, dan kontrak tidak pernah mengizinkannya mengirim dana ke dompetnya sendiri."],
      ["Satu passkey, tanpa frasa rahasia", "Akun Anda berasal dari passkey (Mera). Passkey yang sama juga mengunci buku strategi tersegel walikota: rencana ditulis sebelum hasilnya, dibuka di akhir musim."],
      ["Staf AI dengan batas keras", "Walikota menyewa staf AI: Satpam (workflow Chainlink CRE) hanya bisa menarik dana ke tempat aman, Analis hanya memberi usulan, Humas menulis laporan mingguan."],
      ["Testnet, bunga simulasi", "Ini Monad testnet. Bunga mengikuti vault AUSD mainnet yang nyata dan diberi label simulasi. Uang uji gratis."],
    ],
  },
  banner: { citiesFail: "Tidak bisa menjangkau jaringan untuk memuat kota. Mencoba lagi…" },
};

export const APP: Record<Lang, typeof EN> = { en: EN, id: ID };

/** Nama distrik menurut bahasa untuk distrik bawaan (alun-alun, pinjaman, brankas); distrik lain memakai labelnya sendiri. */
export function districtName(lang: Lang, d: { kind: string; label: string; serviceId?: string }): string {
  if (lang === "en" || d.serviceId) return d.label;
  return d.kind === "idle" ? "Alun-alun" : d.kind === "lending" ? "Distrik pinjaman" : d.kind === "vault" ? "Distrik brankas" : d.label;
}
