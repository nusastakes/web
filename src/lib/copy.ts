import type { Lang } from "./lang";

/** Teks halaman depan dan halaman masuk dalam bahasa Inggris dan Indonesia. Bahasa awam: istilah kripto dijelaskan. */

export interface BeatCopy { label: string; title: string; body: string; look: string }
export interface Copy {
  nav: { demo: string; signIn: string; openCity: string };
  hero: { badge: string; h1: [string, string]; sub: string; ctaStart: string; ctaEnter: string; ctaDemo: string; plain: string; stats: [string, string, string, string] };
  chapters: Record<1 | 2 | 3, { tag: string; title: string; lead: string }>;
  beats: Record<"intro" | "deposit" | "mayor" | "profit" | "passkey" | "book" | "staff", BeatCopy>;
  lookLabel: string;
  tryIt: string;
  tryItIn: string;
  legend: { title: string; items: [string, string, string][]; note: string };
  districts: { idle: string; lend: string; vault: string };
  visuals: {
    money: string; level: string; levels: string[]; depositHint: string;
    atMost: string; neverWallet: string; plazaNote: string; lendNote: string; vaultNote: string;
    best: string; cutHere: string; profit: string; keep: string; cut: string; onlyProfit: string; loss: string; noCut: string;
    onePasskey: string; keys: [string, string][]; noStore: string;
    before: string; end: string; sealed: string; sealedNote: string; matches: string; quote: string; written: string;
    staff: [string, string, string, string][];
  };
  cities: { title: string; lead: string; all: string; loading: string; none: string; mayor: string; resident: string; residents: string };
  cta: { title: string; body: string; create: string; found: string; demo: string };
  footer: { note: string; web: string; contracts: string; relayer: string; cre: string };
  auth: {
    lookAround: string; h1: string; lead: string; points: [string, string][]; works: string; worksList: string[]; notWorks: string; notWorksList: string[];
    tabNew: string; tabBack: string; unlockTitle: string; createTitle: string; backTitle: string; unlockSub: string; createSub: string; backSub: string;
    btnUnlock: string; btnCreate: string; btnBack: string; waiting: string; busyCreate: string; busyHint: string; prf: string; seeDevices: string; testnet: string; inTitle: string; inBody: string; enter: string;
    steps: [string, string, string]; devicesTitle: string; cancelled: string; needHttps: string; noPasskeys: string; inApp: string; account: string; tryAgain: string;
  };
}

const EN: Copy = {
  nav: { demo: "Watch demo", signIn: "Sign in", openCity: "Open my city" },
  hero: {
    badge: "Test version on Monad · no real money",
    h1: ["A city you can save in.", "And watch grow."],
    sub: "Put digital dollars into a city. Its mayor invests them for everyone and is paid only when you profit. The city on screen is the savings pot itself: the more money inside, the bigger it gets.",
    plain: "Like a shared savings pot, but you can walk through it.",
    ctaStart: "Start with a fingerprint", ctaEnter: "Enter the city", ctaDemo: "Watch the 80-second demo",
    stats: ["cities", "mayors", "savers", "digital dollars saved"],
  },
  chapters: {
    1: { tag: "Start here", title: "What is this?", lead: "Scroll slowly. The city behind the cards reacts to every step." },
    2: { tag: "Chapter 1", title: "How a city works", lead: "Three steps, no finance degree needed." },
    3: { tag: "Chapter 2", title: "Why you do not have to trust the mayor", lead: "The safety is built into the code, not into promises." },
  },
  beats: {
    intro: { label: "What you are looking at", title: "This city is a savings pot", body: "Every city on this site is a pot of money that many people saved into together, shown as a real neighbourhood on the map. More money means a bigger city. Each district is a place where the money is put to work.", look: "Look at the map behind this card: that is the pot. The legend below tells you what each thing is." },
    deposit: { label: "Savers", title: "You put money in, the city grows", body: "Make an account in seconds with your fingerprint or face: no secret words to write down, no app to install. Then deposit digital dollars (called AUSD). You can take your money out any time.", look: "Little trucks bring deposits to the town square. New roads, parks and towers get built as more money arrives." },
    mayor: { label: "Mayors", title: "A mayor puts the money to work", body: "The mayor decides where the pot earns interest: lent out, or kept in a savings vault. The rules are in the code: a mayor can only move so much at once, and can never send your money to their own wallet.", look: "Trucks drive money from the town square to the blue district, where it is lent out. That is the mayor moving funds." },
    profit: { label: "Fair pay", title: "The mayor earns only when you profit", body: "The mayor takes a small cut of the profit, never of your deposit. If the pot loses value, the mayor earns nothing, and is not paid twice for winning back the same ground.", look: "The gold coins in the square are the mayor's small cut. They only appear when there is profit." },
    passkey: { label: "Simple and safe login", title: "One fingerprint, no password to lose", body: "Your phone or laptop makes a secure key from your fingerprint or face. It is called a passkey. No email, no password, no seed phrase. The same passkey on another device opens the same account.", look: "At night the windows glow where money is earning interest. The city keeps running while you sleep." },
    book: { label: "Honest mayors", title: "Mayors must show their homework", body: "Before moving your money, a mayor writes down why. The note is locked on their device so nobody can copy it, and only a fingerprint of it is made public. Later they open it, and anyone can check it was written first.", look: "We opened the town hall for you. The mayor's office is on the top floor, writing the plan." },
    staff: { label: "Helpers with limits", title: "AI helpers that cannot touch your money", body: "A mayor can hire AI helpers: a Guard that can only pull money back to safety, an Analyst that only suggests, and a Reporter that writes a weekly summary. The code decides what each one may do.", look: "Inside the town hall: the AI staff room is floor 2. The red alarm means the Guard is pulling money back to safety." },
  },
  lookLabel: "In the city",
  tryIt: "Try it with a fingerprint", tryItIn: "Enter the city",
  legend: {
    title: "How to read the city",
    items: [
      ["#9aa6cf", "Town square", "money waiting, earning nothing, withdraw any time"],
      ["#3f6bff", "Blue district", "money lent out to earn interest"],
      ["#7a5cff", "Purple district", "money kept in a savings vault"],
      ["#f59e0b", "Little trucks", "money moving between places"],
      ["#ffd166", "Glowing windows", "money earning interest"],
      ["#10b981", "Cranes and new towers", "more savings arriving"],
    ],
    note: "All of it is test money on a test network.",
  },
  districts: { idle: "Town square", lend: "Lending district", vault: "Vault district" },
  visuals: {
    money: "Money in the city", level: "Size", levels: ["Empty land", "Hamlet", "Town", "City", "Metropolis"],
    depositHint: "Roads, parks, lamps and towers appear as the money grows. Watch the city behind this card.",
    atMost: "At most half moves at once", neverWallet: "Never to the mayor's wallet",
    plazaNote: "Town square · cash waiting", lendNote: "Lending district · lent out", vaultNote: "Vault district · in a vault",
    best: "highest price so far", cutHere: "mayor's cut only here", profit: "Profit 100", keep: "savers keep 90", cut: "Mayor's cut 10", onlyProfit: "only above the peak", loss: "Loss: 0", noCut: "no cut if it dips",
    onePasskey: "One passkey",
    keys: [["Your account", "lets you deposit"], ["Limited key", "can only shift money between districts"], ["Plan key", "locks the mayor's notes"]],
    noStore: "Nothing is stored. The same passkey on another device recreates all three.",
    before: "1 · Before the move", end: "2 · End of the season", sealed: "Locked on this device", sealedNote: "Only a fingerprint of it is public. Nobody can read or copy the plan.",
    matches: "The fingerprint matches the public record", quote: "“Move a quarter to the lending district: interest beats idle cash, keep the rest ready to withdraw.”", written: "written 3 days before the result",
    staff: [
      ["Guard", "Chainlink CRE workflow", "Can pull money back to safety", "Cannot send it anywhere else"],
      ["Analyst", "AI that explains its reasons", "Can suggest a move", "Cannot move anything itself"],
      ["Reporter", "AI that writes the weekly summary", "Writes the report", "Cannot send any transaction"],
    ],
  },
  cities: { title: "Cities right now", lead: "Ranked by how much savers earned, read from the public record.", all: "See all cities", loading: "Loading the cities…", none: "No community", mayor: "mayor", resident: "saver", residents: "savers" },
  cta: { title: "Good with money? Found a city.", body: "Pick a real neighbourhood on the map, set your cut, and run the city. Your track record is public and cannot be faked.", create: "Create your account", found: "Found a city", demo: "Watch the demo" },
  footer: { note: "Test network only; no real money. Yield on the test network is simulated and follows a live mainnet digital-dollar vault. Map data © OpenStreetMap contributors · Overture Maps Foundation.", web: "Web app", contracts: "Contracts", relayer: "Helper server and AI staff", cre: "Chainlink CRE guard" },
  auth: {
    lookAround: "Look around first", h1: "Your account is your fingerprint.",
    lead: "Your phone or laptop creates the account from your fingerprint, face or device PIN. No secret words to write down, no app, no email, no password. We pay the network fee when you deposit.",
    points: [["One passkey, separate keys", "Your account, a limited key for mayors, and the key for the mayor's locked notes all come from the same passkey, each kept apart."], ["Nothing is stored", "The keys live only in this page's memory and vanish when it locks after 10 idle minutes. The same synced passkey on another device recreates them."], ["Withdrawals always ask again", "Taking money out, changing a limited key, or hiring AI helpers needs your fingerprint once more."]],
    works: "Works with", worksList: ["Android with Google Password Manager", "iPhone, iPad or Mac with iCloud Keychain (iOS 18+, macOS 15+)", "Chrome on desktop, signed in to your Google account", "1Password"],
    notWorks: "Does not work", notWorksList: ["A Chrome profile not signed in to Google", "Bitwarden or Dashlane", "Browsers inside chat apps"],
    tabNew: "New here", tabBack: "I have an account", unlockTitle: "Unlock your account", createTitle: "Create your account", backTitle: "Welcome back",
    unlockSub: "Your session locked itself after 10 idle minutes.", createSub: "One prompt from your device. That is the whole sign-up.", backSub: "Choose the passkey you used before. Same passkey, same account, on any device.",
    btnUnlock: "Unlock with fingerprint", btnCreate: "Create account with fingerprint", btnBack: "Sign in with fingerprint", waiting: "Waiting for your passkey…", busyCreate: "Creating your passkey…",
    busyHint: "Your device is asking for your fingerprint, face or PIN. Look for its pop-up.",
    prf: "This device or password manager cannot make the keys we need (a feature called PRF). Try one of the devices below.", seeDevices: "See devices that work", testnet: "Test network only. Test money is free; nothing here is real money.",
    inTitle: "You are in", inBody: "Taking you to the city…", enter: "Enter the city",
    steps: ["Tap the button", "Confirm with fingerprint, face or PIN", "You arrive in the city"], devicesTitle: "Will it work on my device?",
    cancelled: "You closed the prompt. Tap the button again when you are ready.", needHttps: "Passkeys only work on a secure page (https).",
    noPasskeys: "This browser does not support passkeys. Open this page in Chrome, Safari or Edge.",
    inApp: "You look to be inside another app's browser, where passkeys often fail. Open this page in Chrome or Safari.",
    account: "Account", tryAgain: "Try again",
  },
};

const ID: Copy = {
  nav: { demo: "Tonton demo", signIn: "Masuk", openCity: "Buka kota saya" },
  hero: {
    badge: "Versi uji di Monad · bukan uang sungguhan",
    h1: ["Kota tempat Anda menabung.", "Dan melihatnya tumbuh."],
    sub: "Setor dolar digital ke sebuah kota. Walikotanya menginvestasikannya untuk semua penabung dan hanya dibayar kalau Anda untung. Kota di layar adalah celengannya sendiri: makin banyak uang di dalamnya, makin besar kotanya.",
    plain: "Seperti celengan bersama, tapi bisa Anda jelajahi.",
    ctaStart: "Mulai dengan sidik jari", ctaEnter: "Masuk ke kota", ctaDemo: "Tonton demo 80 detik",
    stats: ["kota", "walikota", "penabung", "dolar digital ditabung"],
  },
  chapters: {
    1: { tag: "Mulai dari sini", title: "Ini apa sih?", lead: "Scroll pelan-pelan. Kota di belakang kartu bereaksi di setiap langkah." },
    2: { tag: "Bab 1", title: "Cara kerja sebuah kota", lead: "Tiga langkah, tanpa perlu paham keuangan." },
    3: { tag: "Bab 2", title: "Kenapa Anda tidak perlu percaya begitu saja pada walikota", lead: "Keamanannya tertanam di kode, bukan di janji." },
  },
  beats: {
    intro: { label: "Yang sedang Anda lihat", title: "Kota ini adalah celengan bersama", body: "Setiap kota di situs ini adalah satu celengan yang ditabung bersama oleh banyak orang, ditampilkan sebagai lingkungan nyata di peta. Makin banyak uang, makin besar kotanya. Tiap distrik adalah tempat uang itu dikerjakan.", look: "Lihat peta di belakang kartu ini: itulah celengannya. Legenda di bawah menjelaskan arti tiap benda." },
    deposit: { label: "Penabung", title: "Anda menabung, kota ikut tumbuh", body: "Buat akun dalam hitungan detik dengan sidik jari atau wajah: tanpa kata rahasia yang harus dicatat, tanpa aplikasi tambahan. Lalu setor dolar digital (disebut AUSD). Uang bisa Anda tarik kapan saja.", look: "Truk-truk kecil membawa setoran ke alun-alun. Jalan, taman, dan gedung baru dibangun saat uang makin banyak." },
    mayor: { label: "Walikota", title: "Walikota mengerjakan uang itu", body: "Walikota menentukan di mana celengan menghasilkan bunga: dipinjamkan, atau disimpan di brankas tabungan. Aturannya ada di kode: walikota hanya boleh memindahkan sebagian dalam sekali jalan, dan tidak pernah bisa mengirim uang Anda ke dompetnya sendiri.", look: "Truk mengantar uang dari alun-alun ke distrik biru, tempat uang dipinjamkan. Itulah walikota memindahkan dana." },
    profit: { label: "Bayaran yang adil", title: "Walikota dibayar hanya saat Anda untung", body: "Walikota mengambil bagian kecil dari keuntungan, tidak pernah dari setoran Anda. Kalau nilai celengan turun, walikota tidak dapat apa-apa, dan tidak dibayar dua kali untuk mengembalikan nilai yang sama.", look: "Koin emas di alun-alun adalah bagian kecil walikota. Koin itu hanya muncul kalau ada keuntungan." },
    passkey: { label: "Masuk mudah dan aman", title: "Satu sidik jari, tanpa kata sandi yang bisa hilang", body: "Ponsel atau laptop Anda membuat kunci aman dari sidik jari atau wajah. Namanya passkey. Tanpa email, tanpa kata sandi, tanpa frasa rahasia. Passkey yang sama di perangkat lain membuka akun yang sama.", look: "Saat malam, jendela menyala di tempat uang menghasilkan bunga. Kota terus berjalan selagi Anda tidur." },
    book: { label: "Walikota yang jujur", title: "Walikota wajib menunjukkan catatannya", body: "Sebelum memindahkan uang Anda, walikota menulis alasannya. Catatan itu dikunci di perangkatnya sehingga tidak bisa disalin, dan hanya sidik jarinya yang dibuka ke publik. Nanti ia membukanya, dan siapa pun bisa memeriksa bahwa catatan itu ditulis lebih dulu.", look: "Balai kota kami bukakan untuk Anda. Ruang walikota ada di lantai atas, sedang menulis rencananya." },
    staff: { label: "Pembantu yang dibatasi", title: "Pembantu AI yang tidak bisa menyentuh uang Anda", body: "Walikota bisa menyewa pembantu AI: Satpam yang hanya bisa menarik uang kembali ke tempat aman, Analis yang hanya memberi saran, dan Humas yang menulis ringkasan mingguan. Kodelah yang menentukan apa yang boleh dilakukan masing-masing.", look: "Di dalam balai kota: ruang staf AI ada di lantai 2. Alarm merah artinya Satpam sedang menarik uang ke tempat aman." },
  },
  lookLabel: "Di dalam kota",
  tryIt: "Coba dengan sidik jari", tryItIn: "Masuk ke kota",
  legend: {
    title: "Cara membaca kota",
    items: [
      ["#9aa6cf", "Alun-alun", "uang yang menunggu, belum berbunga, bisa ditarik kapan saja"],
      ["#3f6bff", "Distrik biru", "uang yang dipinjamkan untuk menghasilkan bunga"],
      ["#7a5cff", "Distrik ungu", "uang yang disimpan di brankas tabungan"],
      ["#f59e0b", "Truk kecil", "uang yang berpindah tempat"],
      ["#ffd166", "Jendela menyala", "uang yang sedang berbunga"],
      ["#10b981", "Derek dan gedung baru", "tabungan baru yang masuk"],
    ],
    note: "Semuanya uang uji di jaringan uji.",
  },
  districts: { idle: "Alun-alun", lend: "Distrik pinjaman", vault: "Distrik brankas" },
  visuals: {
    money: "Uang di kota ini", level: "Ukuran", levels: ["Tanah kosong", "Dusun", "Kota kecil", "Kota", "Metropolis"],
    depositHint: "Jalan, taman, lampu, dan gedung muncul seiring uang bertambah. Lihat kota di belakang kartu ini.",
    atMost: "Paling banyak setengah sekali jalan", neverWallet: "Tidak pernah ke dompet walikota",
    plazaNote: "Alun-alun · uang menunggu", lendNote: "Distrik pinjaman · dipinjamkan", vaultNote: "Distrik brankas · di brankas",
    best: "harga tertinggi sejauh ini", cutHere: "bagian walikota hanya di sini", profit: "Untung 100", keep: "penabung dapat 90", cut: "Bagian walikota 10", onlyProfit: "hanya di atas puncak", loss: "Rugi: 0", noCut: "tak ada bagian saat turun",
    onePasskey: "Satu passkey",
    keys: [["Akun Anda", "untuk menyetor"], ["Kunci terbatas", "hanya bisa menggeser uang antar distrik"], ["Kunci rencana", "mengunci catatan walikota"]],
    noStore: "Tidak ada yang disimpan. Passkey yang sama di perangkat lain membuat ulang ketiganya.",
    before: "1 · Sebelum dipindah", end: "2 · Akhir musim", sealed: "Dikunci di perangkat ini", sealedNote: "Hanya sidik jarinya yang terbuka ke publik. Tidak ada yang bisa membaca atau menyalin rencananya.",
    matches: "Sidik jarinya cocok dengan catatan publik", quote: "“Pindahkan seperempat ke distrik pinjaman: bunga lebih baik daripada uang diam, sisanya tetap siap ditarik.”", written: "ditulis 3 hari sebelum hasilnya keluar",
    staff: [
      ["Satpam", "Alur kerja Chainlink CRE", "Bisa menarik uang ke tempat aman", "Tidak bisa mengirimnya ke tempat lain"],
      ["Analis", "AI yang menjelaskan alasannya", "Bisa menyarankan pemindahan", "Tidak bisa memindahkan apa pun sendiri"],
      ["Humas", "AI penulis ringkasan mingguan", "Menulis laporan", "Tidak bisa mengirim transaksi"],
    ],
  },
  cities: { title: "Kota-kota saat ini", lead: "Diurutkan dari seberapa besar untung penabungnya, dibaca dari catatan publik.", all: "Lihat semua kota", loading: "Memuat kota…", none: "Tanpa komunitas", mayor: "walikota", resident: "penabung", residents: "penabung" },
  cta: { title: "Jago soal uang? Dirikan sebuah kota.", body: "Pilih lingkungan nyata di peta, tentukan bagian Anda, dan kelola kotanya. Rekam jejak Anda terbuka untuk umum dan tidak bisa dipalsukan.", create: "Buat akun Anda", found: "Dirikan kota", demo: "Tonton demo" },
  footer: { note: "Hanya jaringan uji; bukan uang sungguhan. Imbal hasil di jaringan uji adalah simulasi yang mengikuti brankas dolar digital sungguhan di mainnet. Data peta © OpenStreetMap contributors · Overture Maps Foundation.", web: "Aplikasi web", contracts: "Kontrak", relayer: "Server pembantu dan staf AI", cre: "Satpam Chainlink CRE" },
  auth: {
    lookAround: "Lihat-lihat dulu", h1: "Akun Anda adalah sidik jari Anda.",
    lead: "Ponsel atau laptop Anda membuat akun dari sidik jari, wajah, atau PIN perangkat. Tanpa kata rahasia yang harus dicatat, tanpa aplikasi, tanpa email, tanpa kata sandi. Biaya jaringan kami yang bayar saat Anda menyetor.",
    points: [["Satu passkey, kunci terpisah", "Akun Anda, kunci terbatas untuk walikota, dan kunci catatan terkunci walikota semuanya berasal dari passkey yang sama, masing-masing terpisah."], ["Tidak ada yang disimpan", "Kunci hanya ada di memori halaman ini dan hilang saat terkunci setelah 10 menit diam. Passkey tersinkron yang sama di perangkat lain membuatnya ulang."], ["Penarikan selalu meminta lagi", "Menarik uang, mengganti kunci terbatas, atau menyewa pembantu AI butuh sidik jari Anda sekali lagi."]],
    works: "Bisa dipakai di", worksList: ["Android dengan Google Password Manager", "iPhone, iPad, atau Mac dengan iCloud Keychain (iOS 18+, macOS 15+)", "Chrome di komputer yang masuk ke akun Google", "1Password"],
    notWorks: "Belum bisa", notWorksList: ["Profil Chrome yang tidak masuk ke Google", "Bitwarden atau Dashlane", "Browser di dalam aplikasi chat"],
    tabNew: "Baru di sini", tabBack: "Sudah punya akun", unlockTitle: "Buka kunci akun Anda", createTitle: "Buat akun Anda", backTitle: "Selamat datang kembali",
    unlockSub: "Sesi Anda terkunci sendiri setelah 10 menit diam.", createSub: "Satu permintaan dari perangkat Anda. Hanya itu pendaftarannya.", backSub: "Pilih passkey yang dulu Anda pakai. Passkey sama, akun sama, di perangkat mana pun.",
    btnUnlock: "Buka dengan sidik jari", btnCreate: "Buat akun dengan sidik jari", btnBack: "Masuk dengan sidik jari", waiting: "Menunggu passkey Anda…", busyCreate: "Membuat passkey Anda…",
    busyHint: "Perangkat Anda sedang meminta sidik jari, wajah, atau PIN. Cari jendela kecilnya.",
    prf: "Perangkat atau pengelola kata sandi ini belum bisa membuat kunci yang kami butuhkan (fitur bernama PRF). Coba salah satu perangkat di bawah.", seeDevices: "Lihat perangkat yang bisa", testnet: "Hanya jaringan uji. Uang uji gratis; tidak ada uang sungguhan di sini.",
    inTitle: "Anda sudah masuk", inBody: "Mengantar Anda ke kota…", enter: "Masuk ke kota",
    steps: ["Ketuk tombolnya", "Konfirmasi dengan sidik jari, wajah, atau PIN", "Anda tiba di kota"], devicesTitle: "Apakah bisa di perangkat saya?",
    cancelled: "Anda menutup jendela permintaannya. Ketuk tombolnya lagi kalau sudah siap.", needHttps: "Passkey hanya bisa dipakai di halaman aman (https).",
    noPasskeys: "Browser ini belum mendukung passkey. Buka halaman ini di Chrome, Safari, atau Edge.",
    inApp: "Sepertinya Anda membuka halaman ini di dalam browser aplikasi lain, tempat passkey sering gagal. Buka di Chrome atau Safari.",
    account: "Akun", tryAgain: "Coba lagi",
  },
};

export const COPY: Record<Lang, Copy> = { en: EN, id: ID };
