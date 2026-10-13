import type { Lang } from "./lang";

/**
 * Teks sisi walikota dan papan peringkat dalam bahasa Inggris dan Indonesia: lembar jelajah kota, dirikan kota, pilih
 * tempat, balai kota (kelola, staf AI, buku strategi), serta terjemahan label langkah transaksi.
 */

const STEP_ID: Record<string, string> = {
  "Confirm with your passkey": "Konfirmasi dengan passkey Anda",
  "Sign the deposit": "Tandatangani setoran",
  "Relayer sends it (gas paid for you)": "Relayer mengirimnya (gas kami yang bayar)",
  "Confirmed on Monad": "Terkonfirmasi di Monad",
  "Sign and send from your account": "Tandatangani dan kirim dari akun Anda",
  "Sent to Monad": "Terkirim ke Monad",
  "City founded": "Kota didirikan",
  "Sign the change": "Tandatangani perubahan",
  "Allocation updated": "Alokasi diperbarui",
  "Deputy key updated": "Kunci wakil diperbarui",
  Sign: "Tandatangani",
  "Fee updated": "Fee diperbarui",
  "Limit updated": "Batas diperbarui",
  "Confirm the new fee…": "Konfirmasi fee baru…",
  "Confirm the new limit…": "Konfirmasi batas baru…",
  "Seal your reasoning in the strategy book": "Segel alasan Anda di buku strategi",
  "Unlock the book with your passkey": "Buka buku dengan passkey Anda",
  "Key published on-chain": "Kunci dipublikasikan di chain",
  Reveal: "Buka",
  Approve: "Setujui",
  "Proposal carried out": "Usulan dijalankan",
  success: "berhasil",
};

/** Menerjemahkan label dan keterangan langkah transaksi yang dibuat di `lib/actions.ts` dan lembar walikota. */
export function stepText(lang: Lang, s: string): string {
  if (lang === "en") return s;
  if (STEP_ID[s]) return STEP_ID[s];
  let m: RegExpExecArray | null;
  if ((m = /^Confirm hiring (.+)…$/.exec(s))) return `Konfirmasi sewa ${m[1]}…`;
  if ((m = /^Confirm releasing (.+)…$/.exec(s))) return `Konfirmasi pencabutan ${m[1]}…`;
  if ((m = /^(.+) hired$/.exec(s))) return `${m[1]} disewa`;
  if ((m = /^(.+) released$/.exec(s))) return `${m[1]} dilepas`;
  if ((m = /^Sealed · (.+)$/.exec(s))) return `Tersegel · ${m[1]}`;
  return s;
}

const EN = {
  locale: "en-GB",
  exp: {
    title: "Explore cities", sub: "Ranked by residents' return since founding, from on-chain events.", tabRank: "Leaderboard", tabEco: "Monad economy",
    cities: "cities", mayors: "mayors", residents: "residents", allCommunities: "All communities", reading: "Reading the city index…",
    yours: " · yours", noCommunity: "No community", mayor: "mayor", resident: (n: number) => `${n} resident${n === 1 ? "" : "s"}`, none: "No cities in this community yet.",
    footnote: (min: string) => `Cities with less than ${min} AUSD are listed but not ranked. Return is the change in share price since founding; yield on testnet is simulated.`,
    readingEco: "Reading DefiLlama…", fees24: "fees 24h", fees7: "fees 7d", fees30: "fees 30d", protocols: (n: number) => `${n} protocols`, top: "top",
    source: "Source", fetched: "fetched", stale: " The figures are stale.", badge: "Mainnet data, for the mayor's decisions",
  },
  found: {
    title: "Found a city", sub: "You become the mayor. You choose the fee; the contract keeps your hands off the funds.", name: "City name", namePh: "e.g. Kota Jogja",
    tierNow: (n: number) => `${n} service slots open for you.`,
    tierNext: (n: number, stage: string, funds: number) => `${n} open once one of your cities reaches "${stage}", or you keep ${funds} AUSD of your own in your city.`,
    tierMax: "All 8 slots are open.", stageTown: "town", stageCity: "city",
    community: "Community (optional)", communityPh: "e.g. Web3 Jogja", where: "Where is your city?", preset: "Ready-made map", real: "A real place (OpenStreetMap)",
    fee: "Your fee on profit", feeNote: "You earn this share of the residents' profit, only when they profit. 10% of your fee goes to the platform.",
    gas: (need: string, have: string) => [`Founding a city needs about `, `${need} MON`, ` for gas. You have ${have}.`] as [string, string, string],
    getGas: "Get gas", faucetMore: "Need more? Open the Monad faucet", live: "Your city is live. You can see it in the city list.", working: "Working…", btn: "Found city",
    pName: "Give the city a name (3+ letters).", pPlace: "Pick a real place first.", pService: "Pick at least one service.", pGas: "You need more testnet MON first.",
  },
  place: {
    search: "Search a neighbourhood, e.g. Blok M Jakarta", searchAria: "Search a place", searchBtn: "Search", none: "No places found.",
    fetching: "Fetching buildings and streets from OpenStreetMap…", previewAria: "Map preview",
    info: (name: string, b: number, r: number, size: number, km2: string) => `${name} · ${b} buildings and ${r} streets in ${size} × ${size} m (${km2} km²).`, another: "Choose another place",
    openMap: "Choose on the map", changeMap: "Change on the map", mapTitle: "Choose your city's area", mapHint: "Drag and zoom the map. The frame in the middle becomes your city.",
    sizeLabel: "Area size", sizes: { small: "Neighbourhood", mid: "District", large: "City centre" } as Record<string, string>,
    areaInfo: (km2: string, size: number) => `${size} × ${size} m · ${km2} km²`, useArea: "Use this area", cancel: "Cancel", areaDefault: "Chosen area",
    tilesFail: "The base map could not load. Check your connection, or close this and pick a quick place instead.",
    density: { sparse: "Sparse", medium: "Medium", dense: "Dense" } as Record<string, string>,
    densityNote: "Mapped buildings per km². A sparse area makes a quiet city; a dense one makes a busy city.",
  },
  manage: {
    title: (n: string) => `City hall · ${n}`,
    sub: "Run your city: move funds, keep a sealed strategy book, hire AI staff, and design the city. The contract never lets you send funds to your own wallet.",
    preview: "This is a preview city. Found your own city to manage it.", notMayor: "Only the mayor of this city can manage it. Found your own city from the dock.", reading: "Reading the city…",
    tabs: { funds: "Funds", book: "Strategy book", staff: "AI staff", design: "Design" },
    pNowhere: "This city has nowhere to move funds yet.", pNothing: "There is nothing to move yet.", pAmount: "Pick an amount to move.",
    moved: (a: string, f: string, t: string) => `Moved ${a} AUSD from ${f} to ${t}.`, moveFunds: "Move funds", badgeDeputy: "Deputy key · no prompt", badgePasskey: "Passkey · prompt",
    from: "From", to: "To", amount: "Amount", amountAria: "Amount to move",
    limit: (pct: string, cap: string) => `One change can move at most ${pct} of the city (${cap} AUSD from here).`,
    reason: "Your reasoning (optional)", reasonPh: "Why this move? Write it before the result is known.",
    sealIt: ["Seal it in your strategy book.", " Encrypted on this device with a key from your passkey; only its fingerprint goes on-chain. You can reveal it at the end of the season to prove you called it in advance."] as [string, string],
    lowGas: (deputy: boolean, mon: string) => `The ${deputy ? "deputy key" : "account"} needs a little MON for gas (${mon} MON now).`, getGas: "Get gas", working: "Working…",
    deputyHdr: "Deputy key",
    deputyActive: (until: string, pct: string) => `Active until ${until}, up to ${pct} per change. It can only move funds between districts, never withdraw them.`,
    deputyOther: " This browser session holds a different deputy key, so changes here use your passkey.",
    deputyBudget: (left: string, total: string) => `Hourly budget left: ${left} of ${total} AUSD; above that, use your passkey.`,
    deputyNone: (pct: string) => `Register a second key so day-to-day changes need no prompt. It can only move funds between districts (up to ${pct} per change, for 24 hours) and can never withdraw.`,
    renew: "Renew", register: "Register deputy key", remove: "Remove",
    rules: "City rules", fee: "Your fee on profit", feeAria: "Fee on profit", maxMove: "Most one change may move", maxMoveAria: "Largest share of the city one change may move",
    rulesNote: "The fee is taken only from profit above the city's best share price. Pending fees are settled at the old rate first. Each change needs your passkey.",
    saveFee: "Save fee", saveLimit: "Save limit",
    design: "City design", designNote: "Make your city beautiful. This is looks only: it never changes residents' money. Bigger cities unlock more civic works.",
    unlocksAt: (n: string) => `Unlocks at about ${n} AUSD in the city`,
    styleShared: "Saved for everyone: residents see this look when they open the city.", styleSaving: "Saving for everyone…",
    styleErr: (e: string) => `Saved in this browser only (${e}).`, styleLocal: "Saved in this browser.", relayerError: "relayer error", previewLink: " Preview link: ",
  },
  staff: {
    roles: { satpam: "Guards the city: pulls money back to the plaza when a protocol looks risky.", analis: "Watches yields and proposes moves; nothing moves until you approve.", humas: "Writes the weekly report for your residents, in Indonesian." } as Record<string, string>,
    loading: "Loading the AI staff market…",
    intro: (d: number) => `Hire AI staff for your city. Each one can only do what the contract allows its role; none can move money to a wallet. Hiring lasts ${d} days. Paid staff are hired through the on-chain marketplace: you sign once with your passkey and the price goes straight to the agent's wallet (platform fee 5%).`,
    hiredUntil: (d: string) => `Hired until ${d}`, available: "Available", release: "Release", hire: "Hire", na: "Not available right now.",
    perWeek: (p: string) => `${p} AUSD per week`, free: "Free", community: "Community",
    erc: (id: string) => `ERC-8004 #${id}`, ercTitle: (registry: string) => `Registered in the ERC-8004 Identity Registry: ${registry}`,
    noRating: "No ratings yet", rating: (avg: number, n: number) => `Rating ${avg} (${n})`, ratingSeed: (avg: number, n: number) => `Initial rating by the team: ${avg} (${n}), a demo, not user reviews`,
    ask: "Ask for a proposal now", readReport: "Read this week's report", asking: "Asking the Analyst…",
    proposals: (n: number) => `Analyst proposals${n ? ` · ${n} waiting` : ""}`, deploy: "Plaza → yield district", withdraw: "Yield district → Plaza", move: "Move funds", approve: "Approve (one tap)",
    status: { pending: "pending", approved: "approved", rejected: "rejected", expired: "expired" } as Record<string, string>,
    msgs: { proposed: "The Analyst sent a proposal. Approve it below.", "nothing-to-do": "The Analyst sees nothing worth moving right now.", "not-granted": "Hire the Analyst first.", pending: "A proposal is already waiting for you.", cooldown: "The Analyst looked at this city a moment ago. Try again in a few minutes." } as Record<string, string>,
    analyst: "Analyst", noReport: "No report yet.", writing: "The weekly report is still being written. Try again in a minute.",
  },
  book: {
    intro: "Each plan you write when moving funds is encrypted on this device with a key that only your passkey can recreate, on any device. The relayer keeps the ciphertext; the chain keeps its fingerprint. Reveal one entry at the end of the season and anyone can check you wrote it before the result.",
    unlock: "Unlock my strategy book", read: "Read my strategy book",
    none: "No sealed plans for this city yet. Write your reasoning when you move funds in the Funds tab.",
    cannotOpen: "Cannot open", decrypted: "Decrypted", reveal: "Reveal publicly", keyPublic: "Key is public now",
    others: (n: number) => `${n} more entries belong to your other cities.`, footer: "Revealing publishes the key of that entry only. Your other entries stay sealed.",
  },
};

const ID: typeof EN = {
  locale: "id-ID",
  exp: {
    title: "Jelajahi kota", sub: "Diurutkan menurut imbal hasil penduduk sejak kota didirikan, dari kejadian di chain.", tabRank: "Peringkat", tabEco: "Ekonomi Monad",
    cities: "kota", mayors: "walikota", residents: "penduduk", allCommunities: "Semua komunitas", reading: "Membaca indeks kota…",
    yours: " · milik Anda", noCommunity: "Tanpa komunitas", mayor: "walikota", resident: (n) => `${n} penduduk`, none: "Belum ada kota di komunitas ini.",
    footnote: (min) => `Kota dengan dana kurang dari ${min} AUSD tetap ditampilkan tapi tidak diberi peringkat. Imbal hasil adalah perubahan harga saham kota sejak didirikan; bunga di testnet adalah simulasi.`,
    readingEco: "Membaca DefiLlama…", fees24: "fee 24 jam", fees7: "fee 7 hari", fees30: "fee 30 hari", protocols: (n) => `${n} protokol`, top: "teratas",
    source: "Sumber", fetched: "diambil", stale: " Angkanya sudah usang.", badge: "Data mainnet, untuk keputusan walikota",
  },
  found: {
    title: "Dirikan kota", sub: "Anda menjadi walikota. Anda menentukan fee; kontrak menjaga tangan Anda dari dana penduduk.", name: "Nama kota", namePh: "mis. Kota Jogja",
    tierNow: (n: number) => `${n} slot layanan terbuka untuk Anda.`,
    tierNext: (n: number, stage: string, funds: number) => `${n} terbuka begitu salah satu kota Anda mencapai tahap "${stage}", atau Anda menaruh ${funds} AUSD milik sendiri di kota Anda.`,
    tierMax: "Semua 8 slot terbuka.", stageTown: "kota kecil", stageCity: "kota",
    community: "Komunitas (opsional)", communityPh: "mis. Web3 Jogja", where: "Di mana kota Anda?", preset: "Peta siap pakai", real: "Tempat nyata (OpenStreetMap)",
    fee: "Fee Anda dari untung", feeNote: "Anda mendapat bagian ini dari keuntungan penduduk, hanya saat mereka untung. 10% dari fee Anda untuk platform.",
    gas: (need, have) => [`Mendirikan kota butuh sekitar `, `${need} MON`, ` untuk gas. Anda punya ${have}.`],
    getGas: "Ambil gas", faucetMore: "Butuh lebih? Buka faucet Monad", live: "Kota Anda sudah aktif. Anda bisa melihatnya di daftar kota.", working: "Memproses…", btn: "Dirikan kota",
    pName: "Beri nama kota (minimal 3 huruf).", pPlace: "Pilih tempat nyata dulu.", pService: "Pilih minimal satu layanan.", pGas: "Anda perlu MON testnet lebih banyak dulu.",
  },
  place: {
    search: "Cari kawasan, mis. Blok M Jakarta", searchAria: "Cari tempat", searchBtn: "Cari", none: "Tempat tidak ditemukan.",
    fetching: "Mengambil bangunan dan jalan dari OpenStreetMap…", previewAria: "Pratinjau peta",
    info: (name, b, r, size, km2) => `${name} · ${b} bangunan dan ${r} jalan dalam ${size} × ${size} m (${km2} km²).`, another: "Pilih tempat lain",
    openMap: "Pilih di peta", changeMap: "Ubah di peta", mapTitle: "Pilih area kota Anda", mapHint: "Geser dan zoom peta. Kotak di tengah menjadi kota Anda.",
    sizeLabel: "Ukuran area", sizes: { small: "Lingkungan", mid: "Distrik", large: "Pusat kota" },
    areaInfo: (km2, size) => `${size} × ${size} m · ${km2} km²`, useArea: "Pakai area ini", cancel: "Batal", areaDefault: "Area pilihan",
    tilesFail: "Peta dasar tidak bisa dimuat. Periksa koneksi, atau tutup ini lalu pilih tempat cepat.",
    density: { sparse: "Sepi", medium: "Sedang", dense: "Padat" },
    densityNote: "Bangunan terpetakan per km². Area sepi menjadi kota yang tenang; area padat menjadi kota yang ramai.",
  },
  manage: {
    title: (n) => `Balai kota · ${n}`,
    sub: "Jalankan kota Anda: pindahkan dana, simpan buku strategi tersegel, sewa staf AI, dan rancang kota. Kontrak tidak pernah mengizinkan Anda mengirim dana ke dompet sendiri.",
    preview: "Ini kota contoh. Dirikan kota Anda sendiri untuk mengelolanya.", notMayor: "Hanya walikota kota ini yang bisa mengelolanya. Dirikan kota Anda sendiri dari dok.", reading: "Membaca kota…",
    tabs: { funds: "Dana", book: "Buku strategi", staff: "Staf AI", design: "Desain" },
    pNowhere: "Kota ini belum punya tempat untuk memindahkan dana.", pNothing: "Belum ada yang bisa dipindahkan.", pAmount: "Pilih jumlah yang dipindahkan.",
    moved: (a, f, t) => `Memindahkan ${a} AUSD dari ${f} ke ${t}.`, moveFunds: "Pindahkan dana", badgeDeputy: "Kunci wakil · tanpa permintaan", badgePasskey: "Passkey · dengan permintaan",
    from: "Dari", to: "Ke", amount: "Jumlah", amountAria: "Jumlah yang dipindahkan",
    limit: (pct, cap) => `Satu perubahan hanya boleh memindahkan paling banyak ${pct} dari kota (${cap} AUSD dari sini).`,
    reason: "Alasan Anda (opsional)", reasonPh: "Kenapa pindah ini? Tulis sebelum hasilnya diketahui.",
    sealIt: ["Segel di buku strategi Anda.", " Dienkripsi di perangkat ini dengan kunci dari passkey Anda; hanya sidik jarinya yang masuk ke chain. Anda bisa membukanya di akhir musim untuk membuktikan Anda sudah menuliskannya lebih dulu."],
    lowGas: (deputy, mon) => `${deputy ? "Kunci wakil" : "Akun"} butuh sedikit MON untuk gas (sekarang ${mon} MON).`, getGas: "Ambil gas", working: "Memproses…",
    deputyHdr: "Kunci wakil",
    deputyActive: (until, pct) => `Aktif sampai ${until}, maksimal ${pct} per perubahan. Hanya bisa memindahkan dana antar distrik, tidak pernah menariknya.`,
    deputyOther: " Sesi browser ini memegang kunci wakil yang berbeda, jadi perubahan di sini memakai passkey Anda.",
    deputyBudget: (left, total) => `Sisa anggaran per jam: ${left} dari ${total} AUSD; di atas itu, pakai passkey Anda.`,
    deputyNone: (pct) => `Daftarkan kunci kedua supaya perubahan harian tanpa permintaan. Hanya bisa memindahkan dana antar distrik (maksimal ${pct} per perubahan, selama 24 jam) dan tidak pernah bisa menarik.`,
    renew: "Perpanjang", register: "Daftarkan kunci wakil", remove: "Hapus",
    rules: "Aturan kota", fee: "Fee Anda dari untung", feeAria: "Fee dari untung", maxMove: "Paling banyak satu perubahan memindahkan", maxMoveAria: "Porsi terbesar kota yang boleh dipindahkan satu perubahan",
    rulesNote: "Fee hanya diambil dari keuntungan di atas harga saham tertinggi kota. Fee yang tertunda diselesaikan dulu dengan tarif lama. Tiap perubahan membutuhkan passkey Anda.",
    saveFee: "Simpan fee", saveLimit: "Simpan batas",
    design: "Desain kota", designNote: "Buat kota Anda indah. Ini hanya tampilan: tidak pernah mengubah uang penduduk. Kota yang lebih besar membuka lebih banyak karya sipil.",
    unlocksAt: (n) => `Terbuka pada sekitar ${n} AUSD di kota`,
    styleShared: "Tersimpan untuk semua orang: penduduk melihat tampilan ini saat membuka kota.", styleSaving: "Menyimpan untuk semua orang…",
    styleErr: (e) => `Hanya tersimpan di browser ini (${e}).`, styleLocal: "Tersimpan di browser ini.", relayerError: "galat relayer", previewLink: " Tautan pratinjau: ",
  },
  staff: {
    roles: { satpam: "Menjaga kota: menarik uang kembali ke alun-alun saat sebuah protokol terlihat berisiko.", analis: "Memantau imbal hasil dan mengusulkan pemindahan; tidak ada yang bergerak sebelum Anda setujui.", humas: "Menulis laporan mingguan untuk penduduk Anda, dalam bahasa Indonesia." },
    loading: "Memuat bursa staf AI…",
    intro: (d) => `Sewa staf AI untuk kota Anda. Masing-masing hanya bisa melakukan apa yang diizinkan kontrak untuk perannya; tidak ada yang bisa memindahkan uang ke dompet. Masa sewa ${d} hari. Staf berbayar disewa lewat marketplace onchain: Anda menandatangani sekali dengan passkey dan harganya langsung ke dompet agen (biaya platform 5%).`,
    hiredUntil: (d) => `Disewa sampai ${d}`, available: "Tersedia", release: "Cabut", hire: "Sewa", na: "Belum tersedia sekarang.",
    perWeek: (p) => `${p} AUSD per minggu`, free: "Gratis", community: "Komunitas",
    erc: (id) => `ERC-8004 #${id}`, ercTitle: (registry) => `Terdaftar di Identity Registry ERC-8004: ${registry}`,
    noRating: "Belum ada penilaian", rating: (avg, n) => `Penilaian ${avg} (${n})`, ratingSeed: (avg, n) => `Penilaian awal dari tim: ${avg} (${n}), contoh, bukan ulasan pengguna`,
    ask: "Minta usulan sekarang", readReport: "Baca laporan minggu ini", asking: "Bertanya ke Analis…",
    proposals: (n) => `Usulan Analis${n ? ` · ${n} menunggu` : ""}`, deploy: "Alun-alun → distrik bunga", withdraw: "Distrik bunga → Alun-alun", move: "Pindahkan dana", approve: "Setujui (satu ketukan)",
    status: { pending: "menunggu", approved: "disetujui", rejected: "ditolak", expired: "kedaluwarsa" },
    msgs: { proposed: "Analis mengirim usulan. Setujui di bawah.", "nothing-to-do": "Analis tidak melihat yang layak dipindahkan saat ini.", "not-granted": "Sewa Analis dulu.", pending: "Sudah ada usulan yang menunggu Anda.", cooldown: "Analis baru saja memeriksa kota ini. Coba lagi beberapa menit lagi." },
    analyst: "Analis", noReport: "Belum ada laporan.", writing: "Laporan mingguan masih ditulis. Coba lagi semenit lagi.",
  },
  book: {
    intro: "Setiap rencana yang Anda tulis saat memindahkan dana dienkripsi di perangkat ini dengan kunci yang hanya bisa dibuat ulang oleh passkey Anda, di perangkat mana pun. Relayer menyimpan teks sandinya; chain menyimpan sidik jarinya. Buka satu catatan di akhir musim dan siapa pun bisa memeriksa bahwa Anda menulisnya sebelum hasilnya.",
    unlock: "Buka buku strategi saya", read: "Baca buku strategi saya",
    none: "Belum ada rencana tersegel untuk kota ini. Tulis alasan Anda saat memindahkan dana di tab Dana.",
    cannotOpen: "Tidak bisa dibuka", decrypted: "Terbuka", reveal: "Buka ke publik", keyPublic: "Kuncinya sudah publik",
    others: (n) => `${n} catatan lain milik kota Anda yang lain.`, footer: "Membuka ke publik hanya menerbitkan kunci catatan itu. Catatan Anda yang lain tetap tersegel.",
  },
};

export const MAYOR: Record<Lang, typeof EN> = { en: EN, id: ID };
