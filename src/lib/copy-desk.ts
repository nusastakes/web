import type { AdviceId, PresetId, StageId, StepId } from "./coach";
import type { Lang } from "./lang";

/** Teks Meja Walikota (ringkasan, langkah berikutnya, kesehatan dana, strategi cepat, saran) dalam bahasa awam. */

interface Advice { title: string; body: string; cta?: string }
export interface DeskCopy {
  tab: string; title: string; reading: string;
  stage: Record<StageId, { name: string; blurb: string }>;
  stageHdr: string; stageProgress: (pct: number, next: string, at: string) => string; stageTop: string; nextWork: (label: string, at: string) => string;
  stepsHdr: string; stepsDone: (done: number, total: number) => string; allDone: string;
  steps: Record<StepId, { title: string; why: string; cta: string }>;
  healthHdr: string; health: {
    working: [string, string]; reserve: [string, string]; apy: [string, string]; income: [string, string]; residents: [string, string]; rank: [string, string]; momentum: [string, string];
  };
  perYear: (p: string) => string; simulated: string; perMonth: (a: string) => string; none: string; rankNo: (min: string) => string; rankOf: (n: number) => string;
  trendUp: (p: string, h: string) => string; trendDown: (p: string, h: string) => string; trendFlat: (h: string) => string; trendNone: string;
  presetsHdr: string; presetsIntro: string;
  presets: Record<PresetId, { name: string; line: string; risk: string }>;
  presetDone: (n: number, a: string) => string; presetPartial: (left: number) => string;
  apply: string; applying: string; current: string; matches: string; presetNoFunds: string; presetNoDistrict: string; presetStep: (limit: string) => string; presetMoved: (a: string, from: string, to: string) => string;
  adviceHdr: string; adviceNote: string; advice: Record<AdviceId, Advice>;
  principlesHdr: string; principles: [string, string][];
  glossaryHdr: string; glossary: [string, string][];
  stripOpen: string; stripNext: string; stripDone: string;
  moneyHdr: string;
  servicesHdr: string; servicesIntro: string; svcShare: (pct: string) => string; svcBest: string; svcNone: string; moveBtn: string;
  flowHdr: string; flow: (a: { total: string; working: string; n: number; yearly: string; mayor: string }) => string[];
  /** Ukuran kota dari relayer (`/score`): variasi layanan, layanan aktif, dan ekonomi kota sendiri (vault TC67.8). */
  score: {
    hdr: string; points: (n: number) => string; next: (pts: number, name: string) => string; top: string;
    why: string; kinds: (n: number, of: number) => string; active: (n: number) => string; noKinds: string;
    kindName: { launchpad: string; staff: string };
    levels: { wealth: string; income: string; traffic: string }; levelsNote: string; offline: string;
  };
  /** Kartu ekonomi kota 7 hari dari relayer (`/history`, `/score`). */
  econ: {
    hdr: string; intro: string; waiting: string;
    traffic: { title: string; value: (a: string) => string; sub: (count: number, users: number) => string };
    income: { title: string; value: (a: string) => string; sub: (yieldA: string, fees: string) => string };
    coins: { title: string; value: (working: string, idle: string) => string; sub: (net: string, turnover: string, moves: number) => string };
  };
}

const EN: DeskCopy = {
  tab: "Overview", title: "Mayor's desk", reading: "Reading your city…",
  stage: {
    land: { name: "Fresh land", blurb: "A brand-new city. Put in your first funds and invite residents." },
    hamlet: { name: "Hamlet", blurb: "The first buildings rise. Put the funds to work." },
    town: { name: "Small town", blurb: "Streets get busy and civic works open up." },
    city: { name: "City", blurb: "A big city that lives all day. Keep cash and trust healthy." },
    metro: { name: "Metropolis", blurb: "The top stage. Protect it: keep the cash and keep residents informed." },
  },
  stageHdr: "Your city's stage", stageProgress: (pct, next, at) => `${pct}% of the way to ${next}. It needs about ${at} AUSD in total.`, stageTop: "Top stage reached.",
  nextWork: (label, at) => `Next to unlock: ${label}, at about ${at} AUSD.`,
  stepsHdr: "Your next steps", stepsDone: (d, n) => `${d} of ${n} basics done`, allDone: "All the basics are done. Keep an eye on the health of your funds below.",
  steps: {
    fund: { title: "Put in your first funds", why: "The city grows from the money in it. Deposit a little yourself (for example 10 AUSD) so residents see a living city.", cta: "Deposit now" },
    invite: { title: "Invite your first resident", why: "A city with no residents earns you no fee. Share the city link with friends or your community.", cta: "Copy city link" },
    work: { title: "Put the funds to work", why: "Money waiting in the plaza earns nothing. Move part of it into your services so it earns interest.", cta: "Pick a strategy" },
    spread: { title: "Spread funds across services", why: "Everything in one service concentrates the risk. Place funds in at least two services.", cta: "Pick a strategy" },
    analyst: { title: "Hire the Analyst", why: "The Analyst watches yields and proposes moves; you only approve.", cta: "See AI staff" },
    book: { title: "Write your first plan", why: "Write why you make each move in the strategy book. At season end you can reveal it to prove you decided first.", cta: "Open the book" },
    design: { title: "Make the city yours", why: "Pick a theme and civic works. Looks only, but it makes your city stand out.", cta: "Open design" },
    deputy: { title: "Register a deputy key", why: "With a deputy key, small moves need no fingerprint each time. The contract limits what it can do.", cta: "Set up deputy key" },
  },
  healthHdr: "How healthy are your funds?",
  health: {
    working: ["Funds at work", "The share of the city's funds placed in a district where they earn interest. The rest waits in the plaza."],
    reserve: ["Cash in the plaza", "Used when residents withdraw. Too little cash and a big withdrawal may have to wait."],
    apy: ["Yield", "The district's estimated yearly interest. On testnet it follows the real mainnet rate."],
    income: ["Your estimated income", "Funds at work × yield × your fee, minus the platform's 10% of your fee. Only from profit. A rough estimate."],
    residents: ["Residents", "Accounts that hold a share of this city."],
    rank: ["Rank", "Where your city stands among all cities, by total funds."],
    momentum: ["Momentum", "How total funds changed since your last visit on this device."],
  },
  perYear: (p) => `${p}% a year`, simulated: "simulated on testnet", perMonth: (a) => `about ${a} AUSD a month`, none: "none yet", rankNo: (min) => `Not ranked yet (needs at least ${min} AUSD)`, rankOf: (n) => `#${n}`,
  trendUp: (p, h) => `Up ${p}% in ${h} h`, trendDown: (p, h) => `Down ${p}% in ${h} h`, trendFlat: (h) => `Steady over ${h} h`, trendNone: "Not enough data yet. Come back later.",
  presetsHdr: "Quick strategy", presetsIntro: "Pick how much of the city's money works for you. The rest stays in the plaza as cash for withdrawals. One tap moves the funds.",
  presets: {
    safe: { name: "Careful", line: "30% at work (banks and vaults), 70% cash", risk: "Withdrawals almost always go through at once; interest is smaller." },
    balanced: { name: "Balanced", line: "60% at work: 70% banks and vaults, 30% markets and staking", risk: "A balance between interest and cash." },
    bold: { name: "Bold", line: "90% at work: 40% banks and vaults, 60% markets and staking", risk: "Most interest, but a big withdrawal may have to wait for a moment." },
  },
  presetDone: (n, a) => `Done: ${n} move${n === 1 ? "" : "s"}, ${a} AUSD moved in total.`, presetPartial: (left) => `${left} more move${left === 1 ? "" : "s"} were not run; tap the strategy again to continue.`,
  apply: "Apply", applying: "Working…", current: "In use", matches: "Already matches", presetNoFunds: "Deposit funds first.", presetNoDistrict: "This city has no district to put funds into.",
  presetStep: (limit) => `One change can move at most ${limit} of the city. Tap again to continue.`, presetMoved: (a, f, t) => `Moved ${a} AUSD from ${f} to ${t}.`,
  adviceHdr: "Advice for you", adviceNote: "Automatic tips from simple rules, not financial advice. Testnet yield is simulated.",
  advice: {
    empty: { title: "Your city is empty", body: "Start with a small deposit of your own. The city begins to grow right away and you can try everything here.", cta: "Deposit now" },
    concentrated: { title: "Too much in one service", body: "Most of your working funds sit in a single service. If it has a problem, the whole city feels it. Spread some to other services.", cta: "Pick a strategy" },
    bestRate: { title: "A service pays more than your average", body: "One of your services pays clearly above your average rate but holds little of your funds. Compare its risk on the service card before moving money.", cta: "Move funds" },
    singleService: { title: "Your city has one service", body: "Services cannot be added after a city is founded (a contract rule). Found a new city with several services to spread the risk and show more of Monad.", cta: "Found a city" },
    idleHigh: { title: "Most funds are idle", body: "Money in the plaza earns no interest. Try the Balanced strategy to put part of it to work.", cta: "Pick a strategy" },
    trendDown: { title: "Funds are falling", body: "Residents have withdrawn since your last visit. Check the yield, and let the Public Relations staff write a report to keep residents informed.", cta: "See AI staff" },
    lockedHigh: { title: "Keep some cash", body: "Almost all funds are locked in the district. Leave 10–30% in the plaza so residents can withdraw without waiting.", cta: "Pick a strategy" },
    noResidents: { title: "No other residents yet", body: "Share the city link. Busy, profitable cities climb the leaderboard." , cta: "Copy city link" },
    hireAnalyst: { title: "Get a second pair of eyes", body: "The Analyst (about 0.50 AUSD a week) watches yields and proposes moves; you only approve.", cta: "See AI staff" },
    feeHigh: { title: "Your fee is high", body: "Residents compare cities. A lower fee attracts more residents; a higher one earns more per resident.", cta: "Change fee" },
    feeZero: { title: "Your fee is 0%", body: "Residents will like it, but you earn nothing. Pick a number you think is fair.", cta: "Change fee" },
    trendUp: { title: "Momentum is up", body: "Funds are growing. Keep enough cash in the plaza and tell residents your plan.", cta: "Open the book" },
    allGood: { title: "Nothing urgent", body: "Your funds look healthy. Check back after residents deposit or withdraw." },
  },
  principlesHdr: "Three habits of a good mayor",
  principles: [
    ["Put funds to work, keep some cash", "Interest comes from funds at work, but residents need to withdraw any time. Keep 10–30% in the plaza."],
    ["Move in small steps", "Many small changes beat one big move. The contract also limits each change for your residents' safety."],
    ["Explain what you do", "Write your reasons in the strategy book and let the Public Relations staff report weekly. Trust brings new residents."],
  ],
  glossaryHdr: "Plain-language glossary",
  glossary: [
    ["Plaza", "The city's cash box: funds that are not placed anywhere. They earn nothing and can be withdrawn at any time."],
    ["District", "A place where funds work and earn interest. On testnet the interest is simulated and follows the real mainnet rate."],
    ["Fee", "Your share of the residents' profit. You never take anyone's deposit, and you earn only when residents profit."],
    ["Deputy key", "A second key for small, everyday moves without a fingerprint. It can only move funds between districts, never withdraw."],
    ["Strategy book", "Your reasons, encrypted on your device. You can reveal one entry at season end to prove you decided before the result."],
    ["Total funds", "All the money residents have put into the city, in AUSD. It decides the city's stage."],
  ],
  stripOpen: "Open the mayor's desk", stripNext: "Next step", stripDone: "Basics done",
  moneyHdr: "Where the money works",
  servicesHdr: "Your city's services", servicesIntro: "Each service is a district that puts funds into a real Monad protocol (live mainnet rates, simulated funds on testnet). The more funds and residents a service has, the livelier its district.",
  svcShare: (p) => `${p} of working funds`, svcBest: "Highest rate", svcNone: "No funds placed yet", moveBtn: "Move funds",
  flowHdr: "How the money flows", flow: (a) => [
    `Residents put ${a.total} AUSD into the city.`,
    `${a.working} AUSD work in ${a.n} service${a.n === 1 ? "" : "s"}; the rest waits in the plaza as cash.`,
    `At today's mainnet rates they earn about ${a.yearly} AUSD a year.`,
    `Your fee on that profit, after the platform's 10% cut, is about ${a.mayor} AUSD a year; residents keep the rest.`,
  ],
  score: {
    hdr: "Your city's size", points: (n) => `${n} of 100 points`, next: (pts, name) => `${pts} more point${pts === 1 ? "" : "s"} to ${name}.`, top: "Top stage reached.",
    why: "The size grows by itself from three things: how many kinds of service your city runs, how many of them are in use, and the city's own money: its funds, what it earned this week, and how much visitors moved through it. A busy city with little money never looks rich.",
    kinds: (n, of) => `${n} of ${of} kinds of service`, active: (n) => `${n} service${n === 1 ? "" : "s"} in use`, noKinds: "No service in use yet",
    kindName: { launchpad: "Launchpad", staff: "AI staff" },
    levels: { wealth: "Funds", income: "Earnings this week", traffic: "Visitors this week" }, levelsNote: "Each bar is full at 100,000 AUSD of funds, 500 AUSD earned, or 50,000 AUSD moved by visitors in a week.",
    offline: "The city score is not available yet, so the stage below follows total funds only.",
  },
  econ: {
    hdr: "Your city this week", intro: "Only what happened in your city in the last 7 days. Your own moves are not counted as visitors.", waiting: "Waiting for the city's history…",
    traffic: { title: "Visitors", value: (a) => `${a} AUSD moved`, sub: (c, u) => `${c} transaction${c === 1 ? "" : "s"} · ${u} visitor${u === 1 ? "" : "s"} (not you)` },
    income: { title: "Earnings", value: (a) => `${a} AUSD earned`, sub: (y, f) => `Interest ${y} AUSD + service fees ${f} AUSD. Residents earn it; you get your fee on the profit.` },
    coins: { title: "Your stablecoins", value: (w, i) => `${w} AUSD working · ${i} AUSD cash`, sub: (n, t, m) => `Net in/out ${n} AUSD · you moved ${t} AUSD in ${m} move${m === 1 ? "" : "s"}` },
  },
};

const ID: DeskCopy = {
  tab: "Ringkasan", title: "Meja Walikota", reading: "Membaca kota Anda…",
  stage: {
    land: { name: "Lahan rintisan", blurb: "Kota yang baru berdiri. Setor modal pertama dan undang penduduk." },
    hamlet: { name: "Kampung", blurb: "Bangunan pertama mulai berdiri. Buat dana bekerja." },
    town: { name: "Kota kecil", blurb: "Jalan mulai ramai dan karya sipil terbuka." },
    city: { name: "Kota", blurb: "Kota besar yang hidup seharian. Jaga kas dan kepercayaan." },
    metro: { name: "Metropolis", blurb: "Tahap puncak. Jaga kas dan terus kabari penduduk." },
  },
  stageHdr: "Tahap kota Anda", stageProgress: (pct, next, at) => `${pct}% menuju ${next}. Butuh sekitar ${at} AUSD total dana.`, stageTop: "Tahap tertinggi tercapai.",
  nextWork: (label, at) => `Berikutnya terbuka: ${label}, di sekitar ${at} AUSD.`,
  stepsHdr: "Langkah berikutnya", stepsDone: (d, n) => `${d} dari ${n} langkah dasar selesai`, allDone: "Semua langkah dasar selesai. Pantau kesehatan dana Anda di bawah.",
  steps: {
    fund: { title: "Setor modal pertama", why: "Kota tumbuh dari uang di dalamnya. Setor sedikit sendiri (misalnya 10 AUSD) supaya penduduk melihat kota yang hidup.", cta: "Setor sekarang" },
    invite: { title: "Undang penduduk pertama", why: "Kota tanpa penduduk tidak memberi Anda fee. Bagikan tautan kota ke teman atau komunitas.", cta: "Salin tautan kota" },
    work: { title: "Buat dana bekerja", why: "Uang yang menunggu di Alun-alun tidak menghasilkan apa-apa. Pindahkan sebagian ke layanan kota Anda supaya berbunga.", cta: "Pilih strategi" },
    spread: { title: "Sebar dana ke beberapa layanan", why: "Semua di satu layanan memusatkan risiko. Tempatkan dana di sedikitnya dua layanan.", cta: "Pilih strategi" },
    analyst: { title: "Sewa Analis", why: "Analis memantau imbal hasil dan mengusulkan pemindahan; Anda cukup menyetujui.", cta: "Lihat staf AI" },
    book: { title: "Tulis rencana pertama", why: "Catat alasan tiap langkah di Buku strategi. Di akhir musim bisa dibuka sebagai bukti Anda memutuskan lebih dulu.", cta: "Buka buku" },
    design: { title: "Buat kota jadi milik Anda", why: "Pilih tema dan karya sipil. Hanya tampilan, tetapi membuat kota Anda khas.", cta: "Buka desain" },
    deputy: { title: "Daftarkan kunci wakil", why: "Dengan kunci wakil, pindah dana kecil tidak perlu sidik jari setiap kali. Kontrak membatasi apa yang bisa dilakukannya.", cta: "Atur kunci wakil" },
  },
  healthHdr: "Seberapa sehat dana kota?",
  health: {
    working: ["Dana bekerja", "Bagian dana kota yang ditempatkan di distrik dan menghasilkan bunga. Sisanya menunggu di Alun-alun."],
    reserve: ["Kas di Alun-alun", "Dipakai saat penduduk menarik dana. Kas terlalu kecil membuat penarikan besar bisa tertahan."],
    apy: ["Imbal hasil", "Perkiraan bunga setahun distrik. Di testnet mengikuti angka mainnet yang sebenarnya."],
    income: ["Perkiraan penghasilan Anda", "Dana bekerja × imbal hasil × fee Anda, dikurangi 10% bagian platform dari fee. Hanya dari keuntungan. Perkiraan kasar."],
    residents: ["Penduduk", "Jumlah akun yang memegang bagian kota ini."],
    rank: ["Peringkat", "Posisi kota Anda di antara semua kota, menurut total dana."],
    momentum: ["Momentum", "Perubahan total dana sejak kunjungan Anda sebelumnya di perangkat ini."],
  },
  perYear: (p) => `${p}% per tahun`, simulated: "simulasi di testnet", perMonth: (a) => `sekitar ${a} AUSD per bulan`, none: "belum ada", rankNo: (min) => `Belum masuk peringkat (butuh minimal ${min} AUSD)`, rankOf: (n) => `#${n}`,
  trendUp: (p, h) => `Naik ${p}% dalam ${h} jam`, trendDown: (p, h) => `Turun ${p}% dalam ${h} jam`, trendFlat: (h) => `Stabil selama ${h} jam`, trendNone: "Belum cukup data. Kembali lagi nanti.",
  presetsHdr: "Strategi cepat", presetsIntro: "Pilih seberapa banyak uang kota yang bekerja untuk Anda. Sisanya tetap di Alun-alun sebagai kas untuk penarikan. Satu ketukan memindahkan dananya.",
  presets: {
    safe: { name: "Hati-hati", line: "30% bekerja (bank dan brankas), 70% kas", risk: "Penarikan hampir selalu langsung lancar; bunganya lebih kecil." },
    balanced: { name: "Seimbang", line: "60% bekerja: 70% bank dan brankas, 30% pasar dan staking", risk: "Keseimbangan antara bunga dan kas." },
    bold: { name: "Agresif", line: "90% bekerja: 40% bank dan brankas, 60% pasar dan staking", risk: "Bunga terbesar, tetapi penarikan besar bisa tertahan sebentar." },
  },
  presetDone: (n, a) => `Selesai: ${n} pemindahan, total ${a} AUSD dipindahkan.`, presetPartial: (left) => `${left} pemindahan lagi belum dijalankan; ketuk strategi itu lagi untuk melanjutkan.`,
  apply: "Terapkan", applying: "Memproses…", current: "Sedang dipakai", matches: "Sudah sesuai", presetNoFunds: "Setor dana dulu.", presetNoDistrict: "Kota ini belum punya distrik untuk menempatkan dana.",
  presetStep: (limit) => `Satu perubahan memindahkan paling banyak ${limit} dari kota. Ketuk lagi untuk melanjutkan.`, presetMoved: (a, f, t) => `Memindahkan ${a} AUSD dari ${f} ke ${t}.`,
  adviceHdr: "Saran untuk Anda", adviceNote: "Saran otomatis dari aturan sederhana, bukan nasihat keuangan. Imbal hasil di testnet adalah simulasi.",
  advice: {
    empty: { title: "Kota Anda masih kosong", body: "Mulai dengan setoran kecil sendiri. Kota langsung mulai tumbuh dan Anda bisa mencoba semuanya di sini.", cta: "Setor sekarang" },
    concentrated: { title: "Terlalu banyak di satu layanan", body: "Sebagian besar dana yang bekerja ada di satu layanan. Kalau layanan itu bermasalah, seluruh kota terkena. Sebar sebagian ke layanan lain.", cta: "Pilih strategi" },
    bestRate: { title: "Ada layanan yang membayar lebih dari rata-rata", body: "Salah satu layanan Anda membayar jelas di atas rata-rata tetapi menyimpan sedikit dana Anda. Bandingkan risikonya di kartu layanan sebelum memindahkan uang.", cta: "Pindahkan dana" },
    singleService: { title: "Kota Anda punya satu layanan", body: "Layanan tidak bisa ditambah setelah kota berdiri (aturan kontrak). Dirikan kota baru dengan beberapa layanan untuk menyebar risiko dan menampilkan lebih banyak Monad.", cta: "Dirikan kota" },
    idleHigh: { title: "Sebagian besar dana menganggur", body: "Uang di Alun-alun tidak berbunga. Coba strategi Seimbang untuk menempatkan sebagian ke distrik.", cta: "Pilih strategi" },
    trendDown: { title: "Dana sedang turun", body: "Ada penduduk yang menarik dana sejak kunjungan terakhir Anda. Periksa imbal hasil, dan minta staf Humas menulis laporan supaya penduduk tetap terinformasi.", cta: "Lihat staf AI" },
    lockedHigh: { title: "Sisakan kas", body: "Hampir semua dana terkunci di distrik. Sisakan 10–30% di Alun-alun supaya penduduk bisa menarik tanpa menunggu.", cta: "Pilih strategi" },
    noResidents: { title: "Belum ada penduduk lain", body: "Bagikan tautan kota. Kota yang ramai dan menguntungkan naik di Peringkat.", cta: "Salin tautan kota" },
    hireAnalyst: { title: "Punya pengamat kedua", body: "Analis (sekitar 0,50 AUSD per minggu) memantau imbal hasil dan mengusulkan pemindahan; Anda cukup menyetujui.", cta: "Lihat staf AI" },
    feeHigh: { title: "Fee Anda tinggi", body: "Penduduk membandingkan kota. Fee lebih rendah menarik lebih banyak penduduk; fee lebih tinggi menghasilkan lebih banyak per penduduk.", cta: "Ubah fee" },
    feeZero: { title: "Fee Anda 0%", body: "Penduduk akan senang, tetapi Anda tidak mendapat apa-apa. Pilih angka yang menurut Anda adil.", cta: "Ubah fee" },
    trendUp: { title: "Momentum sedang naik", body: "Dana bertambah. Jaga kas di Alun-alun tetap cukup dan kabari penduduk soal rencana Anda.", cta: "Buka buku" },
    allGood: { title: "Tidak ada yang mendesak", body: "Dana Anda terlihat sehat. Cek lagi setelah ada penduduk yang menyetor atau menarik." },
  },
  principlesHdr: "Tiga kebiasaan walikota yang baik",
  principles: [
    ["Buat dana bekerja, sisakan kas", "Bunga datang dari dana yang bekerja, tetapi penduduk perlu bisa menarik kapan saja. Sisakan 10–30% di Alun-alun."],
    ["Bergerak sedikit demi sedikit", "Banyak perubahan kecil lebih baik daripada satu langkah besar. Kontrak juga membatasi tiap perubahan demi keamanan penduduk."],
    ["Jelaskan apa yang Anda lakukan", "Tulis alasan di Buku strategi dan biarkan staf Humas melapor tiap minggu. Kepercayaan mendatangkan penduduk baru."],
  ],
  glossaryHdr: "Istilah dalam bahasa sehari-hari",
  glossary: [
    ["Alun-alun", "Kotak kas kota: dana yang belum ditempatkan di mana pun. Tidak berbunga dan bisa ditarik kapan saja."],
    ["Distrik", "Tempat dana bekerja dan berbunga. Di testnet bunganya simulasi dan mengikuti angka mainnet yang sebenarnya."],
    ["Fee", "Bagian Anda dari keuntungan penduduk. Anda tidak pernah mengambil setoran siapa pun, dan hanya dapat bila penduduk untung."],
    ["Kunci wakil", "Kunci kedua untuk pindah dana kecil sehari-hari tanpa sidik jari. Hanya bisa memindahkan antar distrik, tidak bisa menarik."],
    ["Buku strategi", "Alasan Anda, dienkripsi di perangkat. Satu entri bisa dibuka di akhir musim sebagai bukti Anda memutuskan sebelum hasilnya."],
    ["Total dana", "Seluruh uang yang ditaruh penduduk di kota, dalam AUSD. Inilah yang menentukan tahap kota."],
  ],
  stripOpen: "Buka Meja Walikota", stripNext: "Langkah berikutnya", stripDone: "Langkah dasar selesai",
  moneyHdr: "Di mana uang bekerja",
  servicesHdr: "Layanan kota Anda", servicesIntro: "Tiap layanan adalah distrik yang menaruh dana ke protokol Monad yang nyata (imbal hasil mainnet langsung, dana simulasi di testnet). Makin banyak dana dan penduduk di sebuah layanan, makin ramai distriknya.",
  svcShare: (p) => `${p} dari dana yang bekerja`, svcBest: "Imbal hasil tertinggi", svcNone: "Belum ada dana", moveBtn: "Pindahkan dana",
  flowHdr: "Alur uang di kota", flow: (a) => [
    `Penduduk menaruh ${a.total} AUSD di kota.`,
    `${a.working} AUSD bekerja di ${a.n} layanan; sisanya menunggu di Alun-alun sebagai kas.`,
    `Pada imbal hasil mainnet hari ini, dana itu menghasilkan sekitar ${a.yearly} AUSD per tahun.`,
    `Fee Anda atas keuntungan itu, setelah dipotong bagian platform 10%, sekitar ${a.mayor} AUSD per tahun; sisanya milik penduduk.`,
  ],
  score: {
    hdr: "Ukuran kota Anda", points: (n) => `${n} dari 100 poin`, next: (pts, name) => `${pts} poin lagi menuju ${name}.`, top: "Tahap tertinggi tercapai.",
    why: "Ukuran kota tumbuh sendiri dari tiga hal: berapa jenis layanan yang dijalankan kota, berapa layanan yang dipakai, dan uang kota itu sendiri: dananya, penghasilan minggu ini, dan berapa banyak pengunjung bertransaksi di sana. Kota yang ramai tetapi miskin tidak akan terlihat kaya.",
    kinds: (n, of) => `${n} dari ${of} jenis layanan`, active: (n) => `${n} layanan dipakai`, noKinds: "Belum ada layanan yang dipakai",
    kindName: { launchpad: "Panggung", staff: "Staf AI" },
    levels: { wealth: "Dana", income: "Penghasilan minggu ini", traffic: "Pengunjung minggu ini" }, levelsNote: "Tiap batang penuh pada dana 100.000 AUSD, penghasilan 500 AUSD, atau transaksi pengunjung 50.000 AUSD dalam seminggu.",
    offline: "Skor kota belum tersedia, jadi tahap di bawah hanya mengikuti total dana.",
  },
  econ: {
    hdr: "Kota Anda minggu ini", intro: "Hanya yang terjadi di kota Anda dalam 7 hari terakhir. Pemindahan dana oleh Anda sendiri tidak dihitung sebagai pengunjung.", waiting: "Menunggu riwayat kota…",
    traffic: { title: "Pengunjung", value: (a) => `${a} AUSD bertransaksi`, sub: (c, u) => `${c} transaksi · ${u} pengunjung (selain Anda)` },
    income: { title: "Penghasilan", value: (a) => `${a} AUSD masuk`, sub: (y, f) => `Bunga ${y} AUSD + fee layanan ${f} AUSD. Penduduk yang menikmati; Anda mendapat fee atas keuntungannya.` },
    coins: { title: "Stablecoin kota Anda", value: (w, i) => `${w} AUSD bekerja · ${i} AUSD kas`, sub: (n, t, m) => `Arus bersih ${n} AUSD · Anda memindahkan ${t} AUSD dalam ${m} kali` },
  },
};

export const DESK: Record<Lang, DeskCopy> = { en: EN, id: ID };
