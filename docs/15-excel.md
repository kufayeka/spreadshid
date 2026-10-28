# 15. Excel dan CSV

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [14. Komentar](14-komentar.md) · Berikutnya: [16. Panduan layar](16-layar.md)

File `.xlsx` ditulis dan dibaca oleh library sendiri, tanpa paket tambahan, di browser maupun di server. Di layar, File → Download → Microsoft Excel
mengunduh workbook, dan File → Import membuka `.xlsx` atau `.csv`.

## Contoh

<!-- contoh: 15-excel.js -->
```js
import { exportXlsx, importXlsx, importXlsxInto, exportCsv, importCsvInto, parseCsv, createWorkbook } from '@kufayeka/sheet/core';
import { PRODUK, KOLOM_PRODUK } from './data/toko.js';

// ---- ke Excel: daftar stok dengan rumus, format rupiah, conditional formatting, named range, dan judul yang dibekukan
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
wb.setSheetProps('Sheet1', { name: 'Stok', freezeRows: 1 });
wb.setValues('Stok', 'A1', [[...KOLOM_PRODUK, 'Margin'], ...PRODUK.map((p, i) => [...p, `=(F${i + 2}-E${i + 2})/F${i + 2}`])]);
wb.setColProps('Stok', 'E:F', { format: { type: 'money', decimals: 0 } });
wb.setColProps('Stok', 'I', { format: { type: 'percent', decimals: 1 } });
wb.addConditional('Stok', 'G2:G13', { op: 'eq', a: 0, style: { fill: '#d93025', color: '#ffffff', bold: true } });
wb.addName('Stok', 'Stok', 'G2:G13');
wb.setValues('Stok', 'K1', [['Total stok', '=SUM(Stok)']]);
const bytes = exportXlsx(wb);                              // Uint8Array: kirim sebagai unduhan, lampiran email, atau simpan ke storage
console.log('file xlsx      :', bytes.length > 4000 ? 'lebih dari 4 KB' : bytes.length + ' byte', '| diawali', String.fromCharCode(bytes[0], bytes[1]), '(zip)');

// ---- dari Excel: file yang sama dibaca lagi, seperti file dari laptop orang
// .xlsx tidak menyimpan locale: berikan pengaturan workbook barunya sendiri
const { workbook: balik, warnings } = await importXlsx(bytes, { settings: { locale: 'id-ID', currency: 'IDR' } });
const s = balik.sheet('Stok');
console.log('rumus I2       :', s.input('I2'), '=', s.display('I2').text);
console.log('format E2      :', s.display('E2').text, '| beku', s.sheetProps().freezeRows, 'baris');
console.log('named range    :', balik.names().map((n) => n.name + ' = ' + n.ref).join(', '), '| K1:L1', s.value('K1'), s.value('L1'));
console.log('conditional    :', s.conditionals().length, 'aturan | G9 digambar', JSON.stringify(s.shownStyle('G9')));
console.log('peringatan     :', warnings.length ? warnings.join(' / ') : 'tidak ada');

// ditambahkan ke workbook yang sudah ada, sebagai sheet baru (nama yang sudah dipakai diberi nomor)
const laporan = createWorkbook();
const masuk = await importXlsxInto(laporan, bytes);
console.log('masuk ke wb lain:', laporan.sheetIds().map((id) => laporan.sheetProps(id).name).join(', '), '| sheet baru', masuk.sheetIds.length);

// ---- CSV keluar: teks seperti yang tampil di sel. Titik koma untuk Excel berbahasa Indonesia, yang memakai koma sebagai desimal
const csv = exportCsv(wb, 'Stok', { delimiter: ';' });
console.log('CSV baris 1-2  :', csv.split('\r\n').slice(0, 2).join(' | '));

// ---- CSV masuk: ekspor pesanan dari marketplace. Setiap field dibaca seperti diketik di locale workbook
const dariMarketplace = 'No Pesanan;Tanggal;Produk;Qty;Harga\r\nINV/2610/001;26/10/2026;"Semen Portland 50 kg; zak";40;72.000\r\nINV/2610/002;26/10/2026;Pipa PVC 4 inch;3;152.000,50';
console.log('parseCsv       :', JSON.stringify(parseCsv(dariMarketplace)[1]));
const toko = createWorkbook();
toko.setSettings({ locale: 'id-ID', currency: 'IDR' });
const hasil = importCsvInto(toko, dariMarketplace, 'Marketplace');
const m = toko.sheet('Marketplace');
console.log('sheet baru     :', toko.sheetProps(hasil.sheetIds[0]).name, '| B2', m.value('B2'), '(tanggal) | E3', m.value('E3'), '(angka) | C2', JSON.stringify(m.value('C2')));
```
<!-- /contoh -->

<!-- hasil: 15-excel.js -->
```text
file xlsx      : lebih dari 4 KB | diawali PK (zip)
rumus I2       : =(F2-E2)/F2 = 11,1%
format E2      : Rp 64.000 | beku 1 baris
named range    : Stok = Stok!G2:G13 | K1:L1 Total stok 1592
conditional    : 1 aturan | G9 digambar {"bold":true,"color":"#ffffff","fill":"#d93025"}
peringatan     : tidak ada
masuk ke wb lain: Sheet1, Stok | sheet baru 1
CSV baris 1-2  : Kode;Nama produk;Kategori;Satuan;Harga beli;Harga jual;Stok;Stok min.;Margin;;Total stok;1592 | SMN-01;Semen Portland 50 kg;Semen;zak;Rp 64.000;Rp 72.000;420;100;11,1%;;;
parseCsv       : ["INV/2610/001","26/10/2026","Semen Portland 50 kg; zak","40","72.000"]
sheet baru     : Marketplace | B2 46321 (tanggal) | E3 152000.5 (angka) | C2 "Semen Portland 50 kg; zak"
```
<!-- /hasil -->

| Fungsi | Artinya |
|---|---|
| `exportXlsx(wb)` | isi file `.xlsx` sebagai `Uint8Array` |
| `importXlsx(bytes, opsi?)` | workbook baru dari file: `{ workbook, warnings }`. `opsi` sama dengan `createWorkbook`, ditambah `settings` untuk locale dan mata uang |
| `importXlsxInto(wb, bytes)` | sheet-sheet file ditambahkan ke workbook yang sudah ada, sebagai satu perubahan: `{ sheetIds, warnings }` |
| `exportCsv(wb, sheet, { delimiter })` | satu sheet sebagai teks CSV, berisi teks seperti yang tampil di sel. Pemisah bawaannya koma |
| `parseCsv(teks, pemisah?)` | CSV menjadi array baris. Pemisah ditebak dari baris pertama (koma, titik koma, atau tab) kalau tidak diberikan |
| `importCsvInto(wb, teks, nama)` | CSV sebagai sheet baru. Setiap field dibaca seperti diketik di locale workbook: `152.000,50` menjadi angka, `26/10/2026` menjadi tanggal |
| `codeOfFormat(format, settings)` | kode format Excel untuk sebuah format (`'"Rp" #,##0'`), untuk alat sendiri |

**Mengunduh di browser:**

```js
const blob = new Blob([exportXlsx(wb)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'Stok.xlsx' });
a.click();
URL.revokeObjectURL(a.href);
```

**Membuka file yang dipilih orang:** `importXlsx(new Uint8Array(await file.arrayBuffer()))`.

## Yang ikut dan yang tidak

| Bagian | Ke `.xlsx` | Dari `.xlsx` |
|---|---|---|
| nilai, rumus (termasuk antar sheet), tanggal | ya | ya. Fungsi yang tidak dikenal disebut di `warnings` |
| format angka, uang, persen, tanggal | ya | ya |
| gaya: huruf, warna, latar, perataan, border, teks turun | ya | ya |
| merge, lebar kolom, tinggi baris, baris dan kolom tersembunyi | ya | ya |
| baris dan kolom yang dibekukan | ya | ya |
| named range | ya | ya |
| conditional formatting | ya | ya. Jenis yang tidak ada di sini (data bar, ikon) dilewati dan disebut di `warnings` |
| filter | ya | ya. Filter warna dan top 10 disebut di `warnings` |
| grup baris dan kolom | ya | ya |
| pivot table | sebagai nilai | sebagai nilai |
| validasi data (dropdown) | **belum** | **belum**, disebut di `warnings` |
| komentar | **belum** | **belum**, disebut di `warnings` |
| gambar dan grafik | tidak ada di library ini | dilewati, disebut di `warnings` |
| locale | tidak disimpan oleh Excel | beri lewat `settings` |
| aturan, tipe kolom, policy | tidak ikut: itu milik aplikasimu | |

Tampilkan `warnings` kepada orang yang mengimpor, supaya ia tahu apa yang tidak terbawa dari filenya.

**CSV** hanya membawa teks. `exportCsv` menulis yang tampil di sel (`Rp 64.000`, `420 zak`), dan isi sel yang tersembunyi untuk orang itu ditulis
kosong. Untuk Excel berbahasa Indonesia, yang memakai koma sebagai tanda desimal, pakai `{ delimiter: ';' }`.

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [14. Komentar](14-komentar.md) · Berikutnya: [16. Panduan layar](16-layar.md)
