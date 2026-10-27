# 9. Mengisi sheet dari data

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [8. Pivot table](08-pivot.md) · Berikutnya: [10. Aturan dan tipe kolom](10-aturan.md)

`populate` menulis data dari aplikasimu (hasil API, query database, file JSON) ke sheet: satu nilai, daftar, blok, atau tabel objek. Bedanya dengan
`setValues` adalah **data tetap data**. Teks `'=HYPERLINK(...)'` dari database tetap teks dan tidak berubah jadi rumus, dan teks `'007'` tetap teks
dengan nol di depannya. Jadi data dari luar, termasuk yang diketik pelanggan di form web, tidak bisa menyelipkan rumus ke sheet.

## Contoh: laporan pesanan harian

Templatenya (judul, format kolom, rumus total) dibuat sekali di kode. Datanya diisi dari API setiap kali halaman dibuka:

<!-- contoh: 09-populate.js -->
```js
import { createWorkbook, populate, dateToSerial } from '@kufayeka/sheet/core';

// Laporan pesanan harian: templatenya dibuat sekali (judul, gaya, rumus total), datanya diisi dari API setiap kali halaman dibuka.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const lap = wb.sheet('Sheet1');
lap.setSheetProps({ name: 'Pesanan hari ini' });
lap.setValues('A1', 'Pesanan masuk, Jakarta');
lap.setStyle('A1', { bold: true, fontSize: 14 });
lap.setColProps('B', { format: { type: 'date' } });
lap.setColProps('E:F', { format: { type: 'money', decimals: 0 } });

// ---- yang dikembalikan API pesanan (JSON apa adanya)
const dariApi = [
    { id: 'PO-2611', tanggal: '2026-10-27', pelanggan: 'CV Bangun Karya', qty: 40, harga: 72000, catatan: 'Kirim pagi' },
    { id: 'PO-2612', tanggal: '2026-10-27', pelanggan: 'Toko Maju', qty: 25, harga: 128000, catatan: '=HYPERLINK("http://contoh.invalid","klik")' },
    { id: 'PO-2613', tanggal: '2026-10-27', pelanggan: 'Pak Darto', qty: 6, harga: 145000, catatan: '007' }
];

// tanggal dari API berupa teks: diubah ke nomor hari supaya jadi tanggal di sheet. Sisanya ditulis apa adanya
const baris = dariApi.map((p) => ({ ...p, tanggal: dateToSerial(new Date(p.tanggal)), jumlah: p.qty * p.harga }));
const area = populate(wb, 'Pesanan hari ini', {
    at: 'A3',
    fields: ['id', 'tanggal', 'pelanggan', 'qty', 'harga', 'jumlah', 'catatan'],
    header: ['No. PO', 'Tanggal', 'Pelanggan', 'Qty', 'Harga', 'Jumlah', 'Catatan']      // judul kolom, urut seperti fields
}, baris);
console.log('ditulis       :', wb.address(area.r1, area.c1) + ':' + wb.address(area.r2, area.c2));
for (let r = area.r1; r <= area.r2; r++) console.log('  ', [0, 1, 2, 3, 4, 5, 6].map((c) => lap.display(r, c).text).join(' | '));

// data tetap data: teks yang mirip rumus atau angka tidak berubah jadi rumus atau angka
console.log('catatan PO-2612 :', JSON.stringify(lap.value('G5')), '-> tetap teks, bukan rumus');
console.log('catatan PO-2613 :', JSON.stringify(lap.value('G6')), '-> nol di depan tetap ada');

// total di bawah tabel, ditulis dengan setValues (ini rumus milik template, bukan data)
const akhir = area.r2 + 1;                                 // nomor layar baris terakhir data
lap.setValues(`E${akhir + 1}`, [['Total', `=SUM(F4:F${akhir})`]]);
console.log('total         :', lap.display(`F${akhir + 1}`).text);

// ---- refresh: API sekarang mengembalikan 2 pesanan. Area lama dikosongkan dulu, lalu diisi lagi
lap.clear(`A3:G${akhir + 1}`);
const baru = populate(wb, 'Pesanan hari ini', { at: 'A3', header: { id: 'No. PO' }, fields: ['id', 'pelanggan', 'qty'] }, dariApi.slice(0, 2));
console.log('judul         :', ['A3', 'B3', 'C3'].map((a) => lap.value(a)).join(', '), '(field tanpa judul memakai namanya)');
console.log('setelah refresh:', baru.r2 - baru.r1 + 1, 'baris, sel A6 kini', JSON.stringify(lap.value('A6')));

// ---- bentuk-bentuk lain: daftar ke kanan, blok, cell object dengan gaya, batas baris
populate(wb, 'Pesanan hari ini', { at: 'I3', direction: 'right' }, ['Sen', 'Sel', 'Rab', 'Kam', 'Jum']);
populate(wb, 'Pesanan hari ini', { at: 'I4' }, [[12, 9, 15, 11, 18]]);
populate(wb, 'Pesanan hari ini', { at: 'I6', direction: 'right' }, [{ value: 'Terlambat', fill: '#f4c7c3', bold: true }, { value: 'Tepat', fill: '#b7e1cd' }]);
console.log('ke kanan      :', ['I3', 'J3', 'M3'].map((a) => lap.value(a)).join(', '), '| blok', lap.value('M4'), '| gaya I6', JSON.stringify(lap.style('I6')));
const sedikit = populate(wb, 'Pesanan hari ini', { at: 'I8', limit: 2 }, ['a', 'b', 'c', 'd']);
console.log('limit 2       :', sedikit.r2 - sedikit.r1 + 1, 'baris ditulis');

// satu panggilan = satu perubahan: satu undo membatalkan semuanya
wb.undo();
console.log('undo          :', JSON.stringify(lap.value('I8')));
```
<!-- /contoh -->

<!-- hasil: 09-populate.js -->
```text
ditulis       : A3:G6
   No. PO | Tanggal | Pelanggan | Qty | Harga | Jumlah | Catatan
   PO-2611 | 27/10/2026 | CV Bangun Karya | 40 | Rp 72.000 | Rp 2.880.000 | Kirim pagi
   PO-2612 | 27/10/2026 | Toko Maju | 25 | Rp 128.000 | Rp 3.200.000 | =HYPERLINK("http://contoh.invalid","klik")
   PO-2613 | 27/10/2026 | Pak Darto | 6 | Rp 145.000 | Rp 870.000 | 007
catatan PO-2612 : "=HYPERLINK(\"http://contoh.invalid\",\"klik\")" -> tetap teks, bukan rumus
catatan PO-2613 : "007" -> nol di depan tetap ada
total         : Rp 6.950.000
judul         : No. PO, pelanggan, qty (field tanpa judul memakai namanya)
setelah refresh: 3 baris, sel A6 kini null
ke kanan      : Sen, Sel, Jum | blok 18 | gaya I6 {"fill":"#f4c7c3","bold":true}
limit 2       : 2 baris ditulis
undo          : null
```
<!-- /hasil -->

Pola yang dipakai:

- **Template dan data dipisah.** Judul, format, dan rumus total ditulis dengan `setValues` atau `setStyle` karena itu milik laporanmu. Isi tabel ditulis
  dengan `populate` karena itu data dari luar.
- **Tanggal dari JSON** biasanya berupa teks (`'2026-10-27'`). Ubah dulu menjadi nomor hari dengan `dateToSerial(new Date(teks))` supaya menjadi
  tanggal di sheet dan bisa dihitung.
- **Refresh**: kosongkan area lama dengan `clear`, lalu isi lagi. `populate` hanya menulis sel yang ia isi, jadi baris lama di bawahnya tidak hilang
  dengan sendirinya.
- **Rumus total di bawah data** ditulis setelah `populate`, memakai range yang dikembalikannya (`area.r2`), supaya panjangnya selalu pas.

## `populate(wb, sheet, spec, data)`

Mengembalikan range yang ditulis (`{ r1, c1, r2, c2 }`, dalam nomor), atau `null` kalau tidak ada yang ditulis. Satu panggilan adalah satu perubahan
dengan source `'code'`, jadi aturan untuk orang di layar (validasi, hak akses) tidak menghalanginya. Satu undo membatalkannya.

| `spec` | Artinya | Bawaan |
|---|---|---|
| `at` | sel awal: `'A3'` atau `{ r, c }` | wajib |
| `direction` | daftar ditulis ke `'down'` (bawah) atau `'right'` (kanan) | `'down'` |
| `fields` | untuk tabel objek: field yang diambil dan urutannya | semua field, urut kemunculan |
| `header` | untuk tabel objek: baris judul di atas data. `true` memakai nama field, array memberi judul urut seperti `fields`, objek memberi judul per field (`{ id: 'No. PO' }`) | tanpa baris judul |
| `limit` | paling banyak berapa baris (atau kolom ke kanan) | sampai ujung sheet |

Bentuk `data` yang diterima:

| Data | Ditulis sebagai |
|---|---|
| `12` | satu sel |
| `['Sen', 'Sel', 'Rab']` | tiga sel ke bawah, atau ke kanan dengan `direction: 'right'` |
| `[[12, 9], [15, 11]]` | blok. Setiap array di dalamnya adalah satu baris, atau satu kolom kalau `direction: 'right'` |
| `[{ id: 'PO-2611', qty: 40 }, ...]` | tabel: satu baris per objek, satu kolom per field |
| `{ value: 'Terlambat', fill: '#f4c7c3', bold: true }` | **cell object**: nilai beserta gayanya. Bisa diletakkan di mana pun nilai bisa diletakkan: di daftar, di blok, atau sebagai field tabel. Kunci gayanya sama dengan [4.3](04-api-workbook.md#43-gaya-dan-merge) |

Daftar objek yang semuanya punya `value` dianggap daftar cell object. Kalau tidak, daftar itu dianggap tabel.

Kalau datanya memang harus menjadi rumus atau dibaca menurut locale, misalnya template yang ditulis kodemu sendiri, pakai `setValues` atau `setBlock`.

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [8. Pivot table](08-pivot.md) · Berikutnya: [10. Aturan dan tipe kolom](10-aturan.md)
