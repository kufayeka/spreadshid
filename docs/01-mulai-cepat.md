# 1. Mulai cepat

[Daftar isi](../README.md#daftar-isi) · Berikutnya: [2. Konsep dasar](02-konsep.md)

Bab ini membawa Anda dari nol sampai punya halaman dengan sheet BOQ yang berjalan: memasang paket, memasang komponen, membuat isi sheet dari kode,
dan memakainya di Next.js.

- [1.1 Memasang](#11-memasang)
- [1.2 Halaman pertama](#12-halaman-pertama)
- [1.3 Mengenal bagian layar](#13-mengenal-bagian-layar)
- [1.4 Workbook buatan Anda sendiri](#14-workbook-buatan-anda-sendiri)
- [1.5 Next.js](#15-nextjs)
- [1.6 Hal yang sering terlewat](#16-hal-yang-sering-terlewat)

## 1.1 Memasang

```bash
npm install @kufayeka/sheet
```

Paket ini membutuhkan **React 18 atau lebih baru** (`react` dan `react-dom`) yang sudah ada di aplikasi Anda. Library ini tidak membawa React sendiri,
supaya tidak ada dua salinan React di satu halaman.

Ada tiga hal yang bisa di-import:

| Import | Dipakai untuk |
|---|---|
| `import { Sheet } from '@kufayeka/sheet'` | menampilkan spreadsheet di halaman |
| `import { createWorkbook, ... } from '@kufayeka/sheet/core'` | membuat dan mengubah isi workbook lewat kode, di browser maupun di server |
| `import '@kufayeka/sheet/style.css'` | tampilan; cukup sekali di aplikasi Anda |

## 1.2 Halaman pertama

<!-- contoh: 01-halaman.page.js -->
```jsx
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';

// Halaman paling sederhana: sheet kosong seperti Google Sheets.
// Sheet mengisi tinggi pembungkusnya, jadi pembungkus harus punya tinggi.
export default function Halaman() {
    return (
        <div style={{ height: 600 }}>
            <Sheet />
        </div>
    );
}
```
<!-- /contoh -->

Hasilnya:

![Sheet kosong](img/mulai-cepat.png)

Tanpa prop apa pun, `<Sheet>` membuat workbook kosong sendiri: satu sheet dengan 1000 baris dan 26 kolom (A sampai Z). Orang bisa langsung mengetik,
menulis rumus, memformat, menambah sheet, dan seterusnya. Isinya hilang saat halaman ditutup, karena belum ada yang menyimpannya. Cara menyimpan ada
di [bab 2](02-konsep.md#26-menyimpan).

## 1.3 Mengenal bagian layar

![Bagian-bagian layar](img/bagian-layar.png)

Dari atas ke bawah:

| Bagian | Isinya |
|---|---|
| **Menu bar** | File, Edit, View, Insert, Format, Data, seperti di Google Sheets |
| **Toolbar** | undo/redo, paint format, zoom, format angka (Rp, %, desimal), huruf, tebal/miring/coret/garis bawah, warna, border, merge, rata, wrap, rotasi, link, fungsi, hapus format |
| **Formula bar** | kotak nama di kiri (alamat sel atau nama range; ketik alamat lalu Enter untuk pindah), lalu isi sel aktif yang bisa diedit |
| **Grid** | huruf kolom, nomor baris, sel; baris dan kolom bisa dibekukan (freeze), diubah ukurannya, dikelompokkan |
| **Tab sheet** | `+` untuk sheet baru, `☰` untuk daftar semua sheet, lalu satu tab per sheet (klik kanan untuk ganti nama, duplikat, sembunyikan, geser kiri/kanan, hapus; tab juga bisa diseret) |

Setiap bagian bisa disembunyikan per orang lewat access control (bab 11), misalnya mandor di lapangan yang hanya mengisi kolom realisasi tanpa menu
dan toolbar.

## 1.4 Workbook buatan Anda sendiri

Biasanya isi sheet datang dari aplikasi Anda: dari database, dari template, atau dari data proyek. Untuk itu, buat **workbook** dengan
`createWorkbook()`, isi lewat kode, lalu berikan ke `<Sheet workbook={...}>`:

<!-- contoh: 01-boq.page.js -->
```jsx
import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// Workbook dibuat oleh kode Anda, lalu diberikan ke <Sheet>.
function buatBoq() {
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    wb.setSheetProps(s, { name: 'BOQ', freezeRows: 1 });
    wb.setValues(s, 0, 0, [
        ['No', 'Pekerjaan', 'Volume', 'Satuan', 'Harga satuan', 'Jumlah'],
        [1, 'Galian tanah', 120, 'm3', 85000, '=C2*E2'],
        [2, 'Urugan pasir', 40, 'm3', 210000, '=C3*E3'],
        [3, 'Beton K-300', 18.5, 'm3', 1250000, '=C4*E4'],
        [4, 'Besi tulangan', 2400, 'kg', 14500, '=C5*E5'],
        ['', 'Total', '', '', '', '=SUM(F2:F5)']
    ]);
    wb.setStyle(s, { r1: 0, c1: 0, r2: 0, c2: 5 }, { bold: true, fill: '#e8f0fe' });
    wb.setStyle(s, { r1: 1, c1: 4, r2: 5, c2: 5 }, { format: { type: 'money', decimals: 0 } });
    wb.setStyle(s, { r1: 5, c1: 0, r2: 5, c2: 5 }, { bold: true });
    wb.setColProps(s, [1], { width: 160 });
    wb.setColProps(s, [4, 5], { width: 130 });
    return wb;
}

export default function HalamanBoq() {
    // useState dengan fungsi: workbook dibuat sekali saja, tidak setiap render
    const [wb] = useState(buatBoq);
    return (
        <div style={{ height: 600 }}>
            <Sheet workbook={wb} fileName="BOQ Gedung A" />
        </div>
    );
}
```
<!-- /contoh -->

Hasilnya:

![Sheet BOQ](img/boq.png)

Penjelasan baris per baris:

| Kode | Artinya |
|---|---|
| `createWorkbook()` | workbook baru dengan satu sheet kosong bernama `Sheet1` |
| `wb.sheetIds()` | daftar id sheet; `[s]` mengambil yang pertama. Hampir semua fungsi butuh id sheet sebagai parameter pertama |
| `setSettings({ locale: 'id-ID', currency: 'IDR' })` | angka ditulis `1.250,5`, uang `Rp 1.250`, tanggal `26/10/2026` |
| `setSheetProps(s, { name: 'BOQ', freezeRows: 1 })` | nama tab, dan baris pertama dibekukan (tetap terlihat saat menggulir) |
| `setValues(s, 0, 0, [...])` | menulis mulai dari baris 0 kolom 0 (sel **A1**); satu array per baris. Teks yang diawali `=` adalah rumus |
| `setStyle(s, { r1, c1, r2, c2 }, {...})` | memberi gaya ke satu kotak sel. `r` = baris, `c` = kolom, semuanya mulai dari 0 |
| `setColProps(s, [1], { width: 160 })` | lebar kolom B dalam piksel |
| `useState(buatBoq)` | **penting:** workbook adalah objek yang menyimpan semua isi dan riwayat undo. Buat sekali, simpan di state atau ref, jangan dibuat ulang setiap render |
| `fileName="BOQ Gedung A"` | nama file saat orang memilih File → Download |

> **Baris dan kolom dihitung dari 0 di kode, dari 1 di layar.** Sel `C2` di layar adalah baris 1, kolom 2 di kode. Ini sama seperti indeks array
> JavaScript. Alamat dalam teks (rumus, `select('B2:C4')`) tetap memakai cara layar.

## 1.5 Next.js

`<Sheet>` adalah **client component**: ia memakai state, event mouse dan keyboard, dan DOM. Berkas `@kufayeka/sheet` sudah diawali `"use client"`,
jadi di App Router Anda bisa memakainya langsung di halaman server tanpa `dynamic(..., { ssr: false })`:

<!-- contoh: 01-next-page.js -->
```js
// app/boq/page.js  (Next.js App Router)
// <Sheet> sudah bertanda "use client", jadi boleh langsung dipakai di halaman ini.
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';

export default function Page() {
    return (
        <main style={{ height: '100vh' }}>
            <Sheet fileName="BOQ" />
        </main>
    );
}
```
<!-- /contoh -->

Next.js tetap merender client component sekali di server untuk HTML awal. Sheet aman di tahap itu: ia tidak menyentuh `window` atau `document`
saat render (test `ssr.test.js` dan `docs.test.js` memeriksanya). Ukuran layar diukur setelah halaman tampil di browser.

Kalau workbook Anda dibuat dengan `createWorkbook()` di dalam komponen (seperti contoh BOQ), komponen itu juga harus client component. Tambahkan
`'use client';` di baris pertama berkasnya.

Untuk **Vite, Create React App, atau React biasa**, tidak ada yang perlu diatur. Pakai seperti contoh di 1.2.

## 1.6 Hal yang sering terlewat

| Gejala | Sebab | Perbaikan |
|---|---|---|
| Sheet tidak terlihat, tingginya 0 | pembungkusnya tidak punya tinggi | beri tinggi: `style={{ height: 600 }}`, `100vh`, atau `flex: 1` di dalam kolom flex yang punya tinggi |
| Tampilan berantakan, tanpa garis | CSS belum di-import | `import '@kufayeka/sheet/style.css'` sekali di aplikasi |
| Isi kembali kosong / undo hilang setiap render | `createWorkbook()` dipanggil langsung di badan komponen | `const [wb] = useState(createWorkbook)` atau `useState(buatBoq)` |
| Angka tampil `1250.5`, bukan `1.250,5` | locale bawaan `en-US` | `wb.setSettings({ locale: 'id-ID', currency: 'IDR' })` |

[Daftar isi](../README.md#daftar-isi) · Berikutnya: [2. Konsep dasar](02-konsep.md)
