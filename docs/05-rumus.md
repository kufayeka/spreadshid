# 5. Rumus

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [4. API workbook](04-api-workbook.md) · Berikutnya: [6. Format dan locale](06-format.md)

Rumus ditulis seperti di Excel dan Google Sheets: diawali `=`, nama fungsi dalam bahasa Inggris, argumen dipisah koma. Rumus dihitung ulang otomatis
tiap ada sel yang dibacanya berubah, dan cuma rumus yang terkena saja yang dihitung ulang (100.000 baris tetap cepat, lihat bab 14).

- [5.1 Dasar](#51-dasar)
- [5.2 Daftar fungsi](#52-daftar-fungsi)
- [5.3 Named range dan SUBTOTAL](#53-named-range-dan-subtotal)
- [5.4 Error](#54-error)

## 5.1 Dasar

<!-- contoh: 05-rumus.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

// now: jam untuk TODAY() dan NOW(), dipatok supaya hasil contoh ini selalu sama
const wb = createWorkbook(null, { now: () => new Date(2026, 9, 27, 9, 0) });
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

const harga = wb.sheet(wb.addSheet('Harga'));
harga.setValues('A1', [['Kode', 'Material', 'Harga'], ['B01', 'Beton K-300', 1250000], ['S01', 'Besi', 14500]]);

const boq = wb.sheet('Sheet1');
boq.setValues('A1', [
    ['Kode', 'Volume', 'Harga', 'Jumlah', 'Status'],
    ['B01', 18.5, '=VLOOKUP(A2, Harga!A2:C3, 3, FALSE)', '=B2*C2', '=IF(D2>30000000, "Besar", "Kecil")'],
    ['S01', 2400, '=VLOOKUP(A3, Harga!A2:C3, 3, FALSE)', '=B3*C3', '=IF(D3>30000000, "Besar", "Kecil")'],
    ['', '', 'Total', '=SUM(D2:D3)', '=ROUND(D4/1000000, 1) & " juta"']
]);
console.log('harga dari sheet lain :', boq.value('C2'), boq.value('C3'));
console.log('jumlah                :', boq.value('D2'), boq.value('D3'));
console.log('IF                    :', boq.value('E2'), boq.value('E3'));
console.log('total                 :', boq.value('D4'), '|', boq.value('E4'));

// sheet diganti nama: rumus yang menunjuk ke sana ikut berubah
wb.setSheetProps(harga.id, { name: 'Daftar Harga' });
console.log('setelah ganti nama    :', boq.input('C2'));

// tanggal dan error
boq.setValues('G1', [['=TODAY()'], ['=DATE(2026, 12, 31) - TODAY()'], ['=1/0'], ['=Tidak_Ada * 2'], ['=SQRT(-1)']]);
console.log('TODAY() sebagai angka :', boq.value('G1'));
console.log('hari ke akhir tahun   :', boq.value('G2'));
console.log('error                 :', [3, 4, 5].map((r) => boq.value('G' + r).code).join(', '));
```
<!-- /contoh -->

<!-- hasil: 05-rumus.js -->
```text
harga dari sheet lain : 1250000 14500
jumlah                : 23125000 34800000
IF                    : Kecil Besar
total                 : 57925000 | 57.9 juta
setelah ganti nama    : =VLOOKUP(A2, 'Daftar Harga'!A2:C3, 3, FALSE)
TODAY() sebagai angka : 46322
hari ke akhir tahun   : 65
error                 : #DIV/0!, #NAME?, #NUM!
```
<!-- /hasil -->

Yang perlu diingat:

- **Referensi**: `A1`, `A1:C10`, kolom utuh `B:B`, baris utuh `2:2`, sheet lain `Harga!A2:C3` atau `'Daftar Harga'!A2` (pakai petik kalau ada spasi).
  `$` mengunci kolom atau baris waktu rumus disalin atau di-fill (`$A$1`, `$C2`).
- **Rumus menempel ke sel, bukan ke nomor.** Sisip/hapus baris, ganti nama sheet, sort: referensi ikut ([2.4](02-konsep.md#24-id-baris-dan-kolom)).
  Menghapus sel yang dibaca rumus bikin `#REF!`.
- **Angka di dalam rumus selalu pakai titik desimal**, apa pun locale-nya: `=A1*1.5`, bukan `=A1*1,5`. Koma adalah pemisah argumen. Locale cuma
  berlaku untuk nilai yang diketik di sel.
- **Tanggal adalah angka**: jumlah hari sejak 30 Desember 1899 (sama dengan Excel). `TODAY()` di contoh di atas = 46322 = 27 Oktober 2026. Format
  tanggal (bab 6) yang membuatnya tampil sebagai tanggal.
- **Teks** di rumus ditulis dengan petik dua: `="Rp " & A1`. Petik dua di dalam teks ditulis dua kali: `="Kata ""ini"""`.
- **Uang dibulatkan**: rumus di sel yang formatnya uang dibulatkan ke jumlah desimal formatnya, supaya totalnya tidak meleset sepeser pun.
- `NOW()` dan `TODAY()` baru berubah kalau ada perubahan lain atau `wb.tick()` dipanggil. Opsi `now` di `createWorkbook` mengganti jamnya (seperti di
  contoh, supaya hasilnya selalu sama).

## 5.2 Daftar fungsi

Daftarnya diambil dari library itu sendiri (`FUNCTION_NAMES` dari `@kufayeka/sheet/core`), jadi selalu sama dengan yang benar-benar ada:

<!-- contoh: 05-fungsi.js -->
```js
import { FUNCTION_NAMES } from '@kufayeka/sheet/core';

// semua fungsi yang bisa dipakai di rumus, diambil dari library itu sendiri
console.log(FUNCTION_NAMES.length + ' fungsi:');
for (let i = 0; i < FUNCTION_NAMES.length; i += 8) console.log(FUNCTION_NAMES.slice(i, i + 8).join(', '));
```
<!-- /contoh -->

<!-- hasil: 05-fungsi.js -->
```text
105 fungsi:
ABS, AND, AVERAGE, AVERAGEIF, AVERAGEIFS, CEILING, CHOOSE, COLUMN
COLUMNS, CONCAT, CONCATENATE, COUNT, COUNTA, COUNTBLANK, COUNTIF, COUNTIFS
DATE, DATEDIF, DAY, EDATE, EXACT, EXP, FALSE, FIND
FLOOR, HLOOKUP, HOUR, IF, IFERROR, IFNA, IFS, INDEX
INT, ISBLANK, ISERROR, ISLOGICAL, ISNA, ISNUMBER, ISTEXT, LARGE
LEFT, LEN, LN, LOG, LOG10, LOWER, MATCH, MAX
MAXIFS, MEDIAN, MID, MIN, MINIFS, MINUTE, MOD, MONTH
N, NOT, NOW, OR, PI, POWER, PRODUCT, PROPER
RANK, RANK.EQ, REPLACE, REPT, RIGHT, ROUND, ROUNDDOWN, ROUNDUP
ROW, ROWS, SEARCH, SECOND, SIGN, SMALL, SQRT, STDEV
STDEV.P, STDEV.S, SUBSTITUTE, SUBTOTAL, SUM, SUMIF, SUMIFS, SWITCH
TEXT, TEXTJOIN, TIME, TODAY, TRIM, TRUE, TRUNC, UPPER
VALUE, VAR, VAR.P, VAR.S, VLOOKUP, WEEKDAY, XLOOKUP, XOR
YEAR
```
<!-- /hasil -->

Fungsi-fungsi ini bekerja seperti di Excel. Beberapa yang sering dipakai di proyek konstruksi:

| Kebutuhan | Fungsi |
|---|---|
| total, rata-rata, hitung | `SUM`, `AVERAGE`, `COUNT`, `COUNTA`, `MAX`, `MIN`, `SUBTOTAL` |
| total bersyarat | `SUMIF`, `SUMIFS`, `COUNTIF`, `COUNTIFS`, `AVERAGEIF(S)`, `MAXIFS`, `MINIFS` |
| ambil harga dari tabel lain | `VLOOKUP`, `HLOOKUP`, `XLOOKUP`, `INDEX` + `MATCH` |
| kondisi | `IF`, `IFS`, `SWITCH`, `IFERROR`, `AND`, `OR`, `NOT` |
| pembulatan | `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `CEILING`, `FLOOR`, `INT`, `TRUNC` |
| tanggal | `TODAY`, `NOW`, `DATE`, `EDATE`, `DATEDIF`, `YEAR`, `MONTH`, `DAY`, `WEEKDAY` |
| teks | `CONCAT`, `TEXTJOIN`, `TEXT`, `LEFT`, `RIGHT`, `MID`, `LEN`, `UPPER`, `TRIM`, `SUBSTITUTE` |

Rumus dengan fungsi yang tidak ada di daftar menghasilkan `#NAME?`.

## 5.3 Named range dan SUBTOTAL

<!-- contoh: 05-nama-subtotal.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const boq = wb.sheet('Sheet1');
boq.setValues('A1', [
    ['Pekerjaan', 'Jumlah'],
    ['1. Tanah', '=SUBTOTAL(9, B3:B4)'],
    ['Galian', 10200000],
    ['Urugan', 8400000],
    ['2. Beton', '=SUBTOTAL(9, B6:B7)'],
    ['Pile', 12500000],
    ['Balok', 29500000],
    ['Total', '=SUBTOTAL(9, B2:B7)']
]);
console.log('total (bab tidak dihitung dua kali):', boq.value('B8'));

// named range: nama untuk sebuah range, dipakai di rumus
wb.addName('Pajak', 'Sheet1', 'D1');
boq.setValues('D1', 0.11);
boq.setValues('B9', '=B8 * Pajak');
console.log('PPN                               :', boq.value('B9'));

// rumus yang ditulis sebelum namanya ada: #NAME? dulu, lalu jalan
boq.setValues('B10', '=SUM(Volume)');
console.log('sebelum nama dibuat               :', boq.value('B10').code);
wb.addName('Volume', 'Sheet1', 'B3:B4');
console.log('sesudah                           :', boq.value('B10'));

// baris yang disembunyikan filter tidak ikut dihitung SUBTOTAL
boq.createFilter('A2:B7');
boq.setFilterColumn('A', { hidden: ['Urugan'] });
console.log('total setelah filter              :', boq.value('B8'));
```
<!-- /contoh -->

<!-- hasil: 05-nama-subtotal.js -->
```text
total (bab tidak dihitung dua kali): 60600000
PPN                               : 6666000
sebelum nama dibuat               : #NAME?
sesudah                           : 18600000
total setelah filter              : 52200000
```
<!-- /hasil -->

**Named range** adalah nama untuk sebuah range, dipakai di rumus seperti alamat (`=SUM(Volume)`). Di layar ada di Data → Named ranges, dan bisa
diketik di kotak nama.

| Fungsi | Artinya |
|---|---|
| `wb.addName(nama, sheet, range)` | bikin nama. Mengembalikan id-nya |
| `wb.setName(id, { name, sheetId, range })` | ganti nama (rumus yang memakainya ikut menampilkan nama baru) atau pindahkan range-nya |
| `wb.removeName(id)` | hapus. Rumus yang memakainya jadi `#NAME?` sampai ada range dengan nama itu lagi |
| `wb.names()` | `[{ id, name, sheetId, range }]` |
| `wb.nameRange(nama)` | `{ sheetId, range }`, atau `null` |
| `wb.nameProblem(nama)` | alasan kalau nama itu tidak boleh dipakai, atau `''` |

Aturan nama: diawali huruf atau `_`, tanpa spasi, bukan alamat sel (`A1`, `abc123`), bukan `TRUE`/`FALSE`, dan belum dipakai (huruf besar-kecil sama
saja).

**`SUBTOTAL(kode, range...)`** menjumlahkan (atau rata-rata, hitung, dan sebagainya) tapi **melewati sel yang isinya `SUBTOTAL` juga**, jadi total di
bawah tidak menghitung total bab dua kali. Baris yang disembunyikan filter selalu dilewati.

| Kode | Fungsi | Kode yang juga melewati baris disembunyikan manual dan grup terlipat |
|---|---|---|
| 1 | AVERAGE | 101 |
| 2 | COUNT | 102 |
| 3 | COUNTA | 103 |
| 4 | MAX | 104 |
| 5 | MIN | 105 |
| 6 | PRODUCT | 106 |
| 7 | STDEV | 107 |
| 8 | STDEV.P | 108 |
| 9 | SUM | 109 |
| 10 | VAR | 110 |
| 11 | VAR.P | 111 |

## 5.4 Error

Hasil rumus yang gagal adalah objek `{ code }`. Di layar tampil sebagai kodenya.

| Kode | Sebab |
|---|---|
| `#DIV/0!` | dibagi nol |
| `#NAME?` | nama fungsi atau named range tidak dikenal |
| `#REF!` | sel atau sheet yang dibaca sudah dihapus |
| `#VALUE!` | jenis nilai salah (misalnya teks dikali angka) |
| `#NUM!` | angka tidak mungkin (misalnya `SQRT(-1)`) |
| `#N/A` | tidak ketemu (`VLOOKUP`, `MATCH`) |
| `#CYCLE!` | rumus membaca dirinya sendiri, langsung atau berputar |

`IFERROR(rumus, cadangan)` dan `IFNA(...)` menangkap error.

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [4. API workbook](04-api-workbook.md) · Berikutnya: [6. Format dan locale](06-format.md)
