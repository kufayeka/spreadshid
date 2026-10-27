# @kufayeka/sheet

Spreadsheet untuk React yang terasa seperti Google Sheets. Orang yang memakainya membuat dan merapikan sheet sendiri lewat toolbar dan menu: rumus,
format Rupiah, merge, filter, grup baris, komentar, import dan download Excel. Sementara itu, **kode aplikasi Anda tetap memegang kendali penuh**:
setiap perubahan bisa diizinkan, diubah, atau ditolak, dan setiap orang hanya bisa melakukan apa yang diberikan perannya.

![Sheet BOQ dengan rumus dan format Rupiah](docs/img/boq.png)

Library ini ditulis dalam JavaScript dengan komentar JSDoc. Deklarasi tipe untuk TypeScript (`.d.ts`) dibuat dari komentar itu saat build, jadi editor
Anda tetap memberi saran nama fungsi dan parameter.

## Pasang

```bash
npm install @kufayeka/sheet
```

Butuh `react` dan `react-dom` versi 18 atau lebih baru di aplikasi Anda.

## Contoh terkecil

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

## Tiga pintu masuk

| Import | Isinya | Jalan di |
|---|---|---|
| `@kufayeka/sheet` | komponen `<Sheet>`: grid, toolbar, menu, panel | browser (sudah bertanda `"use client"` untuk Next.js) |
| `@kufayeka/sheet/core` | workbook, rumus, format, Excel, access control, tanpa React | browser **dan** server Node, dengan kode yang sama |
| `@kufayeka/sheet/style.css` | tampilan; semua warna dan ukuran berupa variabel CSS | |

Pembagian ini penting: server Anda (misalnya Nexa API Maker) memakai `@kufayeka/sheet/core` untuk memeriksa setiap simpanan dengan aturan yang sama
persis dengan yang dipakai browser.

## Daftar isi

1. [Mulai cepat](docs/01-mulai-cepat.md): memasang, halaman pertama, workbook buatan sendiri, Next.js
2. [Konsep dasar](docs/02-konsep.md): workbook, sheet, alamat sel, id baris dan kolom, perubahan (op), undo, menyimpan
3. [Komponen `<Sheet>`](docs/03-komponen-sheet.md): semua props, event, handle (`ref`), keyboard, tema
4. API workbook *(menyusul)*
5. Rumus *(menyusul)*
6. Format dan locale *(menyusul)*
7. Data: sort, filter, grup, validasi, conditional formatting *(menyusul)*
8. Mengisi sheet dari data (populate) *(menyusul)*
9. Menyimpan ke database *(menyusul)*
10. Aturan dan tipe kolom *(menyusul)*
11. Access control *(menyusul)*
12. Komentar *(menyusul)*
13. Excel dan CSV *(menyusul)*
14. Performa *(menyusul)*
15. Referensi lengkap *(menyusul)*

## Tentang dokumentasi ini

Semua contoh kode di dokumentasi ini adalah file sungguhan di [`docs/examples/`](docs/examples/). Kode dan hasil yang tercetak di halaman disisipkan
oleh `node docs/build.mjs`, dan gambar diambil dari contoh yang sama di Chrome oleh `node docs/shots.mjs`. Test `test/docs.test.js` gagal kalau ada
contoh yang tidak lagi berjalan atau halaman yang tidak sama dengan hasil terbarunya. Jadi yang Anda baca di sini memang yang terjadi.
