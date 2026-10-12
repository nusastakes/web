# nusastakes/web

Antarmuka web **Nusastakes**: game kota di Monad. Setiap kota adalah vault ERC-4626 yang dikelola walikota; penduduk
menitipkan stablecoin dengan passkey, tanpa seed phrase dan tanpa token gas.

> **Status: kerangka.** Baru halaman bawaan `create-next-app` dan data peta contoh. Fitur (akun Mera, kota 3D, titip
> dan tarik) dikerjakan di fase 2 dan 3. Repo ini dipublikasikan lebih awal supaya riwayat commit hackathon terlihat.

## Cara menjalankan

Syarat: Node.js (diuji dengan v26.11.1) dan npm.

```
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

Repo ini tidak membawa `package-lock.json`; lockfile khusus dibuat saat publikasi untuk deploy. Rahasia tidak pernah
ditaruh di repo; gunakan `.env` lokal.

## Data peta

`public/maps/` berisi cuplikan bangunan dan jalan dari Overture Maps (rilis `2026-09-23.1`) untuk SCBD Jakarta dan
Malioboro Jogja, diambil sekali dan disimpan sebagai GeoJSON; frontend tidak memanggil Overture saat runtime.

Atribusi wajib: **© OpenStreetMap contributors, Overture Maps Foundation**. Sebagian bangunan berasal dari Google
Open Buildings (CC BY 4.0) dan Microsoft ML Buildings (ODbL).

## Repo lain di organisasi

- [nusastakes/contracts](https://github.com/nusastakes/contracts): kontrak Solidity
- [nusastakes/relayer](https://github.com/nusastakes/relayer): relayer gas dan keeper APY
- [nusastakes/cre-guardian](https://github.com/nusastakes/cre-guardian): workflow Chainlink CRE "City Guardian"

## Penggunaan alat AI

Dibuat dengan Claude Code (Claude Opus untuk rencana dan pemeriksaan, Claude Sonnet untuk pengerjaan). Keluaran AI
diperiksa pengembang; yang belum diuji ditulis "belum diuji".

## Komponen yang sudah ada sebelumnya

- Next.js 16.4.0, React 19.3.0, Tailwind CSS 4, TypeScript: kerangka bawaan `create-next-app`.
- Data Overture Maps / OpenStreetMap (lihat atribusi di atas).
- Rencana: `@category-labs/mera` (akun passkey), three.js (kota 3D), viem.

## Lisensi

MIT. Lihat `LICENSE`.
