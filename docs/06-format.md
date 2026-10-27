# 6. Format dan locale

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [5. Rumus](05-rumus.md) · Berikutnya: [7. Data](07-data.md)

Format mengatur **cara angka ditampilkan**, bukan nilainya. Sel berisi 1250000 dengan format uang tampil `Rp 1.250.000`, tapi rumus yang membacanya
tetap dapat 1250000.

- [6.1 Jenis format](#61-jenis-format)
- [6.2 Format di kolom, satuan dari kolom lain](#62-format-di-kolom-satuan-dari-kolom-lain)
- [6.3 Locale](#63-locale)

## 6.1 Jenis format

Format ditaruh di gaya sel (`setStyle(range, { format })`) atau di kolom (6.2). Semua jenis, dengan hasilnya di workbook `id-ID`:

<!-- contoh: 06-format.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const sh = wb.sheet('Sheet1');

const contoh = [
    [1234567.891, { type: 'general' }],
    [1234567.891, { type: 'number', decimals: 2 }],
    [1234567.891, { type: 'number', decimals: 0, thousands: false }],
    [1250000, { type: 'money', decimals: 0 }],
    [1250000, { type: 'money', currency: 'USD', decimals: 2 }],
    [-1250000, { type: 'money', decimals: 0, negative: 'parens' }],
    [0.125, { type: 'percent', decimals: 1 }],
    [123456, { type: 'scientific', decimals: 2 }],
    [46321, { type: 'date' }],
    [46321, { type: 'date', pattern: 'd MMMM yyyy' }],
    [46321.5625, { type: 'datetime' }],
    [0.5625, { type: 'time', pattern: 'HH:mm' }],
    [1.25, { type: 'duration' }],
    [850, { type: 'number', decimals: 0, suffix: ' m3' }],
    [12, { type: 'number', decimals: 0, prefix: 'Termin ' }],
    [-42.5, { type: 'custom', pattern: '#,##0.00;[Red](#,##0.00);"-"' }],
    ['007', { type: 'text' }]
];
contoh.forEach(([v, format], i) => {
    sh.setValues(i, 0, typeof v === 'string' ? "'" + v : v);
    sh.setStyle({ r1: i, c1: 0, r2: i, c2: 0 }, { format });
    const d = sh.display(i, 0);
    console.log(JSON.stringify(format).padEnd(66), '->', d.text + (d.color ? '  (warna ' + d.color + ')' : ''));
});
```
<!-- /contoh -->

<!-- hasil: 06-format.js -->
```text
{"type":"general"}                                                 -> 1234567,891
{"type":"number","decimals":2}                                     -> 1.234.567,89
{"type":"number","decimals":0,"thousands":false}                   -> 1234568
{"type":"money","decimals":0}                                      -> Rp 1.250.000
{"type":"money","currency":"USD","decimals":2}                     -> $1.250.000,00
{"type":"money","decimals":0,"negative":"parens"}                  -> (Rp 1.250.000)
{"type":"percent","decimals":1}                                    -> 12,5%
{"type":"scientific","decimals":2}                                 -> 1,23E+05
{"type":"date"}                                                    -> 26/10/2026
{"type":"date","pattern":"d MMMM yyyy"}                            -> 26 Oktober 2026
{"type":"datetime"}                                                -> 26/10/2026 13:30:00
{"type":"time","pattern":"HH:mm"}                                  -> 13:30
{"type":"duration"}                                                -> 30:00:00
{"type":"number","decimals":0,"suffix":" m3"}                      -> 850 m3
{"type":"number","decimals":0,"prefix":"Termin "}                  -> Termin 12
{"type":"custom","pattern":"#,##0.00;[Red](#,##0.00);\"-\""}       -> (42,50)  (warna red)
{"type":"text"}                                                    -> 007
```
<!-- /hasil -->

| `type` | Pilihan | Keterangan |
|---|---|---|
| `general` | | seperti diketik |
| `number` | `decimals` (bawaan 2), `thousands` (pemisah ribuan, bawaan `true`) | |
| `money` | `decimals`, `currency` (bawaan: mata uang workbook), `symbol` (ganti simbolnya sendiri) | rumus di sel uang dibulatkan ke `decimals` |
| `percent` | `decimals` | 0,125 tampil 12,5% |
| `scientific` | `decimals` | |
| `date`, `time`, `datetime` | `pattern` (bawaan: pola locale) | huruf pola: `d dd` hari, `M MM MMM MMMM` bulan, `yy yyyy` tahun, `H HH` jam, `mm` menit, `ss` detik |
| `duration` | | jam bisa lebih dari 24: `1.25` hari = `30:00:00` |
| `text` | | yang diketik selalu disimpan sebagai teks (kode `007` tetap `007`) |
| `custom` | `pattern` | kode format seperti Excel: `#,##0.00;[Red](#,##0.00);"-"` (positif; negatif; nol) |

Pilihan yang berlaku untuk semua jenis:

| Kunci | Artinya | Contoh |
|---|---|---|
| `prefix` | teks di depan | `'Termin '` → `Termin 12` |
| `suffix` | teks di belakang | `' m3'` → `850 m3` |
| `negative` | angka negatif: `'minus'` (bawaan), `'parens'` → `(1.250)`, `'red'` → merah | |
| `suffixFrom` | id kolom yang teksnya jadi suffix (6.2) | |

Di layar, format dipilih lewat toolbar (`Rp`, `%`, `.0←`, `.00→`, `123`) dan menu Format → Number. `FORMAT_PRESETS` dari `@kufayeka/sheet/core` berisi
format siap pakai yang sama dengan menu itu.

## 6.2 Format di kolom, satuan dari kolom lain

<!-- contoh: 06-kolom.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const sh = wb.sheet('Sheet1');
sh.setValues('A1', [['Pekerjaan', 'Volume', 'Satuan', 'Harga'], ['Galian', 120, 'm3', 85000], ['Besi', 2400, 'kg', 14500]]);

// format di kolom: berlaku untuk semua sel kolom itu yang tidak punya format sendiri
sh.setColProps('D', { format: { type: 'money', decimals: 0 } });
// satuan diambil dari kolom lain di baris yang sama
sh.setColProps('B', { format: { type: 'number', decimals: 0, suffixFrom: sh.colId(2) } });
console.log('B2, B3 :', sh.display('B2').text, '|', sh.display('B3').text);
console.log('D2, D3 :', sh.display('D2').text, '|', sh.display('D3').text);
sh.setValues('D4', 99000);
console.log('D4 baru:', sh.display('D4').text, '(ikut format kolom)');
```
<!-- /contoh -->

<!-- hasil: 06-kolom.js -->
```text
B2, B3 : 120 m3 | 2.400 kg
D2, D3 : Rp 85.000 | Rp 14.500
D4 baru: Rp 99.000 (ikut format kolom)
```
<!-- /hasil -->

`setColProps(kolom, { format })` memberi format bawaan untuk seluruh kolom, termasuk baris yang ditambah nanti. Sel yang punya format sendiri tetap
pakai formatnya sendiri.

`suffixFrom: idKolom` menempelkan teks kolom lain di baris yang sama, misalnya volume yang tampil dengan satuan di barisnya (`120 m3`, `2.400 kg`).
Nilainya tetap angka.

## 6.3 Locale

Locale mengatur pemisah desimal dan ribuan, urutan hari-bulan-tahun, dan simbol uang. Berlaku untuk tampilan **dan** untuk membaca yang diketik orang:

<!-- contoh: 06-locale.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

// angka, uang dan tanggal yang sama di tiga locale; ketikan juga dibaca sesuai locale
const coba = [
    { locale: 'id-ID', currency: 'IDR', angka: '1.250,5', tanggal: '26/10/2026' },
    { locale: 'en-US', currency: 'USD', angka: '1,250.5', tanggal: '10/26/2026' },
    { locale: 'de-DE', currency: 'EUR', angka: '1.250,5', tanggal: '26.10.2026' }
];
for (const { locale, currency, angka, tanggal } of coba) {
    const wb = createWorkbook();
    wb.setSettings({ locale, currency });
    const sh = wb.sheet('Sheet1');
    sh.setValues('A1', [[angka, 1250000, tanggal]]);
    sh.setStyle('B1', { format: { type: 'money', decimals: 2 } });
    console.log(locale, '| ketik', angka.padEnd(7), '->', String(sh.value('A1')).padEnd(6), '| uang:', sh.display('B1').text.padEnd(16),
        '| ketik', tanggal, '->', sh.value('C1'), '->', sh.display('C1').text);
}
```
<!-- /contoh -->

<!-- hasil: 06-locale.js -->
```text
id-ID | ketik 1.250,5 -> 1250.5 | uang: Rp 1.250.000,00  | ketik 26/10/2026 -> 46321 -> 26/10/2026
en-US | ketik 1,250.5 -> 1250.5 | uang: $1,250,000.00    | ketik 10/26/2026 -> 46321 -> 10/26/2026
de-DE | ketik 1.250,5 -> 1250.5 | uang: €1.250.000,00    | ketik 26.10.2026 -> 46321 -> 26.10.2026
```
<!-- /hasil -->

Diatur lewat `wb.setSettings({ locale, currency })` (atau di layar: File → Spreadsheet settings). Kode `locale` adalah kode BCP 47 yang dikenal
browser dan Node (`id-ID`, `en-US`, `en-GB`, `de-DE`, `ja-JP`, ...).

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [5. Rumus](05-rumus.md) · Berikutnya: [7. Data](07-data.md)
