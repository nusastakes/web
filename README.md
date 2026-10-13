# nusastakes/web

Antarmuka web **Nusastakes**, game kota di Monad. Setiap kota adalah vault ERC-4626 yang dikelola walikota: penduduk
menitipkan AUSD dengan passkey, tanpa seed phrase dan tanpa token gas, dan walikota hanya mendapat fee dari keuntungan
penduduknya. Kotanya tampil sebagai kota 3D dari peta asli yang tumbuh mengikuti dana dan hidup mengikuti kejadian onchain.

Jaringan: **Monad testnet** (chainId 10143). Yield di testnet adalah simulasi yang mengikuti APY vault AUSD di mainnet,
dan selalu diberi label "simulated" di layar.

## Halaman

| Route | Isi |
|---|---|
| `/` | Halaman depan: kota 3D hidup di latar, angka platform langsung, cara kerja, kota teratas |
| `/signin` | Buat akun atau masuk lagi dengan passkey, daftar perangkat yang didukung; `?next=` menentukan tujuan setelah masuk |
| `/city` | Aplikasi kota; `?demo=1` memutar demo 80 detik, `?all=1` menampilkan kota uji |

## Fitur

| Fitur | Isi | Kode |
|---|---|---|
| Akun passkey (Mera) | Satu prompt untuk membuat akun; masuk lagi tanpa state lokal; sesi terkunci otomatis setelah 10 menit diam; tarik dana selalu meminta passkey baru | `src/lib/wallet.tsx` |
| Setor dan tarik | Penduduk hanya menandatangani `permit`; relayer mengirim transaksi dan membayar gas | `src/lib/actions.ts`, `src/lib/relayer.ts` |
| Dirikan kota | Walikota memilih nama, komunitas, peta, dan fee (maksimal 20%) | `src/components/sheets/FoundCitySheet.tsx` |
| Balai kota (walikota) | Pindah dana antar distrik dalam batas kontrak, kunci wakil untuk kerja harian tanpa prompt, buku strategi tersegel, staf AI, desain kota | `src/components/sheets/ManageSheet.tsx` dan panel di sebelahnya |
| Buku strategi tersegel | Alasan walikota dienkripsi di perangkat dengan kunci dari passkey; hanya hash ciphertext yang tercatat onchain; satu entri bisa dibuka publik di akhir musim | `src/lib/book.ts`, `BookPanel.tsx` |
| Staf AI | Sewa dan cabut Satpam (workflow Chainlink CRE), Analis (usulan yang disetujui satu ketukan), dan Humas (laporan mingguan) | `StaffPanel.tsx` |
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

Variabel lingkungan (opsional, di `.env.local`):

| Variabel | Bawaan |
|---|---|
| `NEXT_PUBLIC_RELAYER_URL` | `http://localhost:8787`; relayer yang di-host: `https://relayer-production-39e1.up.railway.app` |
| `NEXT_PUBLIC_MONAD_TESTNET_RPC` | `https://testnet-rpc.monad.xyz` |
| `NEXT_PUBLIC_FACTORY` | alamat `CityFactory` dari `src/lib/deployment.json` |

Skrip lain:

```
npm run sync:deployment   # salin alamat kontrak dari ../contracts/deployments ke src/lib/deployment.json
npm run prep:maps         # ubah GeoJSON Overture di public/maps menjadi berkas kota kompak (*.city.json)
node scripts/build-demo.mjs   # tulis demo/city-demo.html: kota 3D mandiri dalam satu berkas
```

Passkey terikat ke domain (rpId). Akun yang dibuat di `localhost` tidak bisa dipakai di domain lain.

## Pengujian

- Uji E2E di Monad testnet dengan Chrome headless dan authenticator virtual yang mendukung PRF:
  - buat akun, setor, dan tarik
  - masuk lagi setelah penyimpanan dihapus (alamat sama)
  - dirikan kota, tata ulang dengan passkey dan dengan kunci wakil
  - gaya kota tersimpan bersama lewat relayer
  - alasan tersegel di buku strategi, buku dibuka (juga setelah penyimpanan dihapus), dan reveal onchain
  - sewa Analis, minta usulan, setujui satu ketukan
- Logika kota (rute, lampu lalu lintas, jadwal harian) diuji dengan simulasi satu hari penuh tanpa layar: tanpa kendaraan
  macet permanen dan tanpa angka tidak valid.
- `tsc --noEmit`, `eslint`, dan `next build` lulus.

**Belum diuji:**
- Passkey Mera di perangkat sungguhan dan uji lintas perangkat buku strategi. Authenticator virtual Chrome tidak membawa
  rahasia PRF ke profil lain.
- Gerakan kota 3D di GPU sungguhan dan performa di ponsel. Ada mode hemat untuk layar di bawah 820 px.

## Data peta

`public/maps/` berisi cuplikan bangunan dan jalan dari Overture Maps (rilis `2026-09-23.1`) untuk SCBD Jakarta dan
Malioboro Yogyakarta, diambil sekali; frontend tidak memanggil Overture saat runtime.

Atribusi wajib: **© OpenStreetMap contributors, Overture Maps Foundation**. Sebagian bangunan berasal dari Google
Open Buildings (CC BY 4.0) dan Microsoft ML Buildings (ODbL). Nama toko dan gedung di kota adalah fiktif.

## Repo lain di organisasi

- [nusastakes/contracts](https://github.com/nusastakes/contracts): kontrak Solidity (`CityFactory`, `CityVault`, `CityGuardian`, adapter)
- [nusastakes/relayer](https://github.com/nusastakes/relayer): relayer gas, keeper APY, Analis, Humas, penyimpanan buku strategi dan gaya kota
- [nusastakes/cre-guardian](https://github.com/nusastakes/cre-guardian): workflow Chainlink CRE "City Guardian" (Satpam)

## Penggunaan alat AI

Dibangun dengan Claude Code: Claude Opus mengerjakan frontend ini, Claude Sonnet mengerjakan kontrak, relayer, dan
workflow CRE. Keluaran AI diperiksa dengan uji di atas; yang belum diuji ditulis di bagian "Belum diuji".

## Komponen yang sudah ada sebelumnya

- Next.js 16.4.0, React 19.3.0, Tailwind CSS 4, TypeScript (kerangka `create-next-app`)
- three.js 0.186.1, viem 2.57.4, `@category-labs/mera` 0.2.0, `@scure/bip32`, `@scure/bip39`
- Data Overture Maps / OpenStreetMap (lihat atribusi di atas)

## Lisensi

MIT. Lihat `LICENSE`.
