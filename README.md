# nusastakes/web

Antarmuka web **Nusastakes**, game kota di Monad. Setiap kota adalah vault ERC-4626 yang dikelola walikota: penduduk
menitipkan AUSD dengan passkey, tanpa seed phrase dan tanpa token gas, dan walikota hanya mendapat fee dari keuntungan
penduduknya. Kotanya tampil sebagai kota 3D dari peta asli yang tumbuh mengikuti dana dan hidup mengikuti kejadian onchain.

Jaringan: **Monad testnet** (chainId 10143). Yield di testnet adalah simulasi yang mengikuti APY pool mainnet,
dan selalu diberi label "simulated" di layar.

**Live: https://nusastakes.vercel.app** (Vercel, proyek `nusastakes`; relayer https://relayer-production-39e1.up.railway.app).

## Halaman

| Route | Isi |
|---|---|
| `/` | Halaman depan: kota 3D hidup di latar, angka platform langsung, cara kerja, kota teratas |
| `/signin` | Buat akun atau masuk lagi dengan passkey, daftar perangkat yang didukung; `?next=` menentukan tujuan setelah masuk |
| `/city` | Aplikasi kota; `?c=<alamat vault>` membuka kota tertentu, `?demo=1` memutar demo 80 detik, `?all=1` menampilkan kota uji |

## Fitur

| Fitur | Isi | Kode |
|---|---|---|
| Akun passkey (Mera) | Satu prompt untuk membuat akun; masuk lagi tanpa state lokal; sesi terkunci otomatis setelah 10 menit diam; tarik dana selalu meminta passkey baru | `src/lib/wallet.tsx` |
| Setor dan tarik | Penduduk hanya menandatangani `permit`; relayer mengirim transaksi dan membayar gas | `src/lib/actions.ts`, `src/lib/relayer.ts` |
| Dirikan kota | Walikota memilih nama, komunitas, fee (maksimal 20%), dan area: peta bawaan atau area sembarang yang dipilih di peta OpenStreetMap (Leaflet; kotak 360, 520, atau 800 m); bangunan dan jalan diambil dari OpenStreetMap, dengan lahan kosong prosedural bila data gagal dimuat | `src/components/sheets/FoundCitySheet.tsx`, `AreaPickerModal.tsx`, `src/lib/osm.ts` |
| Layanan protokol | Tiap distrik kota adalah cermin satu pool protokol Monad (18 layanan: Bank, Brankas, Menara Staking, Pasar) dengan APY dan TVL mainnet langsung dari katalog relayer (`GET /catalog`) dan dana simulasi di testnet; slot layanan saat mendirikan kota dibuka bertahap (3, lalu 5, lalu 8) lewat tahap kota terbaik atau dana walikota sendiri di kotanya, tanpa top-up ke platform (aturan aplikasi; kontrak tetap maksimal 8); lencana "Bisa disetel"; landmark 3D per jenis | `src/lib/catalog.ts`, `ServicePicker.tsx`, `src/lib/tier.ts`, `src/lib/scene/services3d.ts` |
| Setel layanan | Dari kartu gedung: walikota menyetel layanan sebatas hak penyetor di protokol aslinya (hadiah token atau bunga dasar saja, looping bila protokol menerima AUSD sebagai jaminan, rentang harga Uniswap v3), dengan perkiraan hasil dari rumus yang sama dengan relayer dan angka yang benar-benar tertulis di feed; pengunjung melihat setelan yang sama tanpa bisa mengubah | `src/components/sheets/TuningSheet.tsx`, `src/lib/tuning.ts` |
| Aturan kota dan autopilot | Walikota menulis aturan sendiri ("jika ..., maka pindahkan atau setel ...") atau menyalakan aturan siap pakai, menandatanganinya (EIP-712 `CityRules`), dan mengizinkan autopilot sebagai session key yang hanya boleh memindah dan menyetel dana kota; log menautkan tiap transaksi autopilot | `src/components/sheets/RulesSheet.tsx`, `src/lib/rules.ts` |
| Panggung | Loket kota untuk pengunjung (`CityServices`): luncurkan token di kurva harga, beli dan jual; walikota menyalakan layanan dan memilih fee 0–3%, yang dialirkan ke vault kota | `src/components/sheets/PanggungSheet.tsx`, `src/lib/panggung.ts` |
| Skor kota | Tahap kota di Meja Walikota dari `GET /score/:city` (variasi layanan, jumlah layanan aktif, kekayaan, penghasilan, lalu lintas luar) dan kartu mingguan dari `GET /history/:city`; keramaian 3D mengikuti `crowd` (lalu lintas dibatasi kekayaan) | `src/lib/cityStats.ts`, `MayorDesk.tsx`, `App.tsx` |
| Meja Walikota | Untuk walikota awam: tahap kota dan kemajuannya, langkah berikutnya yang bisa diketuk, kesehatan dana dalam bahasa sehari-hari, tiga strategi cepat satu ketukan, saran dari aturan sederhana (bukan AI), glosarium; kartu ringkas di layar utama | `src/components/sheets/MayorDesk.tsx`, `MayorStrip.tsx`, `src/lib/coach.ts` |
| Balai kota (walikota) | Pindah dana antar distrik dalam batas kontrak, kunci wakil untuk kerja harian tanpa prompt, buku strategi tersegel, staf AI, desain kota | `src/components/sheets/ManageSheet.tsx` dan panel di sebelahnya |
| Buku strategi tersegel | Alasan walikota dienkripsi di perangkat dengan kunci dari passkey; hanya hash ciphertext yang tercatat onchain; satu entri bisa dibuka publik di akhir musim | `src/lib/book.ts`, `BookPanel.tsx` |
| Staf AI | Sewa dan cabut Satpam (workflow Chainlink CRE, izin langsung), Analis (usulan yang disetujui satu ketukan), Humas (laporan mingguan), dan agen komunitas; staf berbayar disewa lewat marketplace onchain (satu passkey: permit AUSD lalu `hireWithPermit`) | `StaffPanel.tsx`, `lib/actions.ts` |
| Kota 3D | Bangunan dan jalan asli (Overture/OSM), tumbuh dari tanah kosong mengikuti dana; siang-malam, hujan, lalu lintas, bus, ojek, pedagang, pasar malam; gedung bisa dibelah untuk melihat isinya | `src/lib/scene/` |
| Kejadian onchain | `Deposit`, `Withdraw`, `Rebalanced`, `FeeAccrued`, `Evacuated`, usulan Analis, kunci wakil, fee, reveal, sewa staf menjadi truk, kerumunan, rapat, dan alarm di kota | `src/lib/activity.ts` |

## Cara Mera dipakai

Satu passkey menghasilkan beberapa kunci yang terpisah, semuanya bisa dibuat ulang di perangkat lain dengan passkey yang
sama, dan tidak ada yang disimpan di disk atau server:

| Namespace | Salt PRF | Dipakai untuk |
|---|---|---|
| Akun | salt bawaan Mera `sha256("mera.prf.salt.v1")` | Akun EVM (EOA) penduduk dan walikota, jalur BIP32 `m/44'/60'/0'/0/0` |
| Kunci wakil | sama dengan akun, jalur `m/44'/60'/0'/0/1` | Didaftarkan di vault (`setSessionKey`) dengan izin hanya `rebalance`, batas per aksi, dan masa berlaku |
| Buku strategi | `sha256("nusastakes/buku-strategi/v1")` | Kunci induk enkripsi. Kunci per entri = HKDF-SHA256(kunci induk, `nusastakes.book.entry.v1:<id>`); AES-256-GCM dengan id entri sebagai data tambahan |

Kunci hanya ada di memori halaman dan dibuang saat sesi dikunci. Relayer hanya menyimpan ciphertext buku strategi.

## Cara menjalankan

Syarat: Node.js (diuji dengan v26.11.1) dan npm. Repo ini bagian dari monorepo; di monorepo jalankan `npm install` dari
root.

```
npm install
npm run dev            # http://localhost:3000
npm run build && npm run start
npm run lint
```

Alamat kontrak dibaca dari `GET /config` relayer saat halaman dibuka (`src/lib/addresses.ts`); `src/lib/deployment.json` hanya cadangan bila relayer tidak terjangkau.

Variabel lingkungan (opsional, di `.env.local`):

| Variabel | Bawaan |
|---|---|
| `NEXT_PUBLIC_RELAYER_URL` | `http://localhost:8787`; relayer yang di-host: `https://relayer-production-39e1.up.railway.app` |
| `NEXT_PUBLIC_MONAD_TESTNET_RPC` | `https://testnet-rpc.monad.xyz` |
| `NEXT_PUBLIC_MONAD_TESTNET_RPC_FALLBACKS` | `https://rpc.ankr.com/monad_testnet,https://monad-testnet.drpc.org` (baca dan kirim pindah ke sini bila RPC utama menolak) |
| `NEXT_PUBLIC_FACTORY` | alamat `CityFactory` dari `src/lib/deployment.json` |

Skrip lain:

```
npm run sync:deployment   # salin alamat kontrak dari ../contracts/deployments ke src/lib/deployment.json
npm run prep:maps         # ubah GeoJSON Overture di public/maps menjadi berkas kota kompak (*.city.json)
node scripts/build-demo.mjs   # tulis demo/city-demo.html: kota 3D mandiri dalam satu berkas
```

Passkey terikat ke domain (rpId). Akun yang dibuat di `localhost` tidak bisa dipakai di domain lain.

Deploy: `vercel deploy --prod` dari folder ini (`vercel.json` menetapkan framework Next.js; `.vercelignore` mencegah file
env terunggah). Di Vercel hanya `NEXT_PUBLIC_RELAYER_URL` yang diisi.

## Pengujian

- Uji E2E di Monad testnet dengan Chrome headless dan authenticator virtual yang mendukung PRF:
  - buat akun, setor, dan tarik
  - masuk lagi setelah penyimpanan dihapus (alamat sama)
  - dirikan kota, tata ulang dengan passkey dan dengan kunci wakil
  - gaya kota tersimpan bersama lewat relayer
  - alasan tersegel di buku strategi, buku dibuka (juga setelah penyimpanan dihapus), dan reveal onchain
  - pilih area di peta, bangun kota dari area itu (Braga 800 m: 1.408 bangunan), dan lahan kosong cadangan saat data gagal
  - sewa Analis lewat marketplace, minta usulan, setujui satu ketukan; sewa Satpam dan agen komunitas
- Logika kota (rute, lampu lalu lintas, jadwal harian) diuji dengan simulasi satu hari penuh tanpa layar: tanpa kendaraan
  macet permanen dan tanpa angka tidak valid.
- Sesi di situs produksi (14 Okt 2026, Brave dengan authenticator virtual PRF): akun baru, dana dari relayer, dirikan kota
  dengan layanan bersetelan, setor 200 AUSD, simpan setelan Neverland 2×, simpan aturan bertanda tangan, nyalakan Panggung,
  dan luncurkan token; semuanya terverifikasi on-chain (kota `0xfb4Bf15294ed593931fc597482F48a24e9639DF4`). Strategi cepat
  dan izin autopilot dari UI belum terkonfirmasi di sesi itu; autopilot sudah terbukti jalan di kota uji lain.
- `tsc --noEmit`, `eslint`, dan `next build` lulus.

**Belum diuji:**
- Jalur karantina (setor dijeda, penarikan mandiri): butuh adapter yang rusak.
- Passkey Mera di perangkat sungguhan dan uji lintas perangkat buku strategi. Authenticator virtual Chrome tidak membawa
  rahasia PRF ke profil lain.
- Gerakan kota 3D di GPU sungguhan dan performa di ponsel. Ada mode hemat untuk layar di bawah 820 px.

## Data peta

`public/maps/` berisi cuplikan bangunan dan jalan dari Overture Maps (rilis `2026-09-23.1`) untuk SCBD Jakarta dan
Malioboro Yogyakarta, diambil sekali; frontend tidak memanggil Overture saat runtime. Area lain yang dipilih walikota
diambil dari OpenStreetMap (Overpass API) di browser; `mapURI` kota (`osm:<lat>,<lon>[@<ukuran>]`) memungkinkan siapa pun
membangun ulang peta yang sama. Ubin peta di pemilih area: OpenStreetMap.

Atribusi wajib: **© OpenStreetMap contributors, Overture Maps Foundation**. Sebagian bangunan berasal dari Google
Open Buildings (CC BY 4.0) dan Microsoft ML Buildings (ODbL). Nama toko dan gedung di kota adalah fiktif.

## Repo lain di organisasi

- [nusastakes/contracts](https://github.com/nusastakes/contracts): kontrak Solidity (`CityFactory`, `CityVault`, `CityGuardian`, adapter)
- [nusastakes/relayer](https://github.com/nusastakes/relayer): relayer gas, keeper APY, Analis, Humas, penyimpanan buku strategi dan gaya kota
- [nusastakes/cre-guardian](https://github.com/nusastakes/cre-guardian): workflow Chainlink CRE "City Guardian" (Satpam)

## Penggunaan alat AI

Dibangun dengan Claude Code: Claude Opus mengerjakan frontend ini; sampai 13 Okt Claude Sonnet mengerjakan kontrak,
relayer, dan workflow CRE, dan mulai 14 Okt Claude Opus mengerjakan semuanya. Keluaran AI diperiksa dengan uji di atas; yang belum diuji ditulis di bagian "Belum diuji".

## Komponen yang sudah ada sebelumnya

- Next.js 16.4.0, React 19.3.0, Tailwind CSS 4, TypeScript (kerangka `create-next-app`)
- three.js 0.186.1, viem 2.57.4, `@category-labs/mera` 0.2.0, `@scure/bip32`, `@scure/bip39`
- Data Overture Maps / OpenStreetMap (lihat atribusi di atas)

## Lisensi

MIT. Lihat `LICENSE`.
