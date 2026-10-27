# 5. Rumus

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [4. API workbook](04-api-workbook.md) · Berikutnya: [6. Format dan locale](06-format.md)

Rumus ditulis seperti di Excel dan dihitung oleh library sendiri, di browser maupun di server, tanpa Excel dan tanpa layanan luar. Hanya rumus yang
terkena sebuah perubahan yang dihitung ulang, jadi mengubah satu harga di sheet 100.000 baris tetap cepat.

- [5.1 Dasar](#51-dasar)
- [5.2 Laporan dengan rumus](#52-laporan-dengan-rumus)
- [5.3 Named range](#53-named-range)
- [5.4 SUBTOTAL](#54-subtotal)
- [5.5 Error](#55-error)
- [5.6 Daftar fungsi](#56-daftar-fungsi)

## 5.1 Dasar

Nota penjualan ini mengambil nama dan harga produk dari sheet Produk, tarif PPN dari sheet Pengaturan, lalu menghitung subtotal, pajak, total, dan jatuh
tempo:

<!-- contoh: 05-rumus.js -->
```js
import { createWorkbook, fillBlock } from '@kufayeka/sheet/core';
import { PRODUK, KOLOM_PRODUK } from './data/toko.js';

// Nota penjualan yang mengambil harga dari sheet Produk dan tarif PPN dari sheet Pengaturan.
// now: jam untuk TODAY() dan NOW(), dipatok supaya hasil contoh ini selalu sama
const wb = createWorkbook(null, { now: () => new Date(2026, 9, 27, 9, 30) });
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

const produk = wb.sheet(wb.addSheet('Produk'));
produk.setValues('A1', [KOLOM_PRODUK, ...PRODUK]);
const atur = wb.sheet(wb.addSheet('Pengaturan'));
atur.setValues('A1', [['PPN', 0.11], ['Jatuh tempo (hari)', 14]]);

const nota = wb.sheet('Sheet1');
nota.setSheetProps({ name: 'Nota' });
nota.setValues('A1', [
    ['Kode', 'Produk', 'Qty', 'Harga', 'Jumlah', 'PPN'],
    ['SMN-01', '=XLOOKUP(A2, Produk!$A$2:$A$13, Produk!$B$2:$B$13, "?")', 40, '=XLOOKUP(A2, Produk!$A:$A, Produk!$F:$F)', '=C2*D2', '=E2*Pengaturan!$B$1']
]);
nota.setValues('A3', [['BSI-13', null, 25], ['CAT-05', null, 6], ['XXX-99', null, 1]]);

// fill handle dari kode: rumus diulang ke bawah. Bagian tanpa $ ikut bergeser, yang ber-$ tetap. Kolom Qty (C) tidak ikut, karena angka
// yang di-fill menjadi deret (40, 41, 42), sama seperti menarik fill handle di layar
fillBlock(wb, 'Nota', 'B2', 'B3:B5', 'down');
fillBlock(wb, 'Nota', 'D2:F2', 'D3:F5', 'down');
console.log('rumus B3      :', nota.input('B3'));
console.log('rumus F4      :', nota.input('F4'));
console.log('produk        :', [2, 3, 4, 5].map((r) => nota.value('B' + r)).join(' | '));
console.log('jumlah        :', [2, 3, 4, 5].map((r) => { const v = nota.value('E' + r); return v.code || v; }).join(' | '));

nota.setValues('A7', [
    ['Subtotal', null, null, null, '=SUMIF(A2:A5, "<>XXX-99", E2:E5)'],
    ['PPN', null, null, null, '=ROUND(E7*Pengaturan!B1, 0)'],
    ['Total', null, null, null, '=E7+E8'],
    ['Ringkas', '="Total " & ROUND(E9/1000000, 1) & " juta, " & COUNTIF(D2:D5, ">0") & " barang"'],
    ['Tanggal', '=TODAY()', 'Jatuh tempo', '=B11+Pengaturan!B2', 'Sisa hari', '=D11-TODAY()']
]);
console.log('subtotal      :', nota.value('E7'), '| PPN', nota.value('E8'), '| total', nota.value('E9'));
console.log('teks          :', nota.value('B10'));
console.log('tanggal       :', nota.value('B11'), '(27 Okt 2026) | jatuh tempo', nota.value('D11'), '| sisa', nota.value('F11'), 'hari');

// sheet diganti nama, tarif PPN diubah: semua rumus ikut
wb.setSheetProps('Pengaturan', { name: 'Atur Toko' });
atur.setValues('B1', 0.12);
console.log('setelah ubah  :', nota.input('E8'), '=', nota.value('E8'));
```
<!-- /contoh -->

<!-- hasil: 05-rumus.js -->
```text
rumus B3      : =XLOOKUP(A3, Produk!$A$2:$A$13, Produk!$B$2:$B$13, "?")
rumus F4      : =E4*Pengaturan!$B$1
produk        : Semen Portland 50 kg | Besi beton 13 mm | Cat tembok 5 kg putih | ?
jumlah        : 2880000 | 3200000 | 870000 | #N/A
subtotal      : 6950000 | PPN 764500 | total 7714500
teks          : Total 7.7 juta, 3 barang
tanggal       : 46322 (27 Okt 2026) | jatuh tempo 46336 | sisa 14 hari
setelah ubah  : =ROUND(E7*'Atur Toko'!B1, 0) = 834000
```
<!-- /hasil -->

**Referensi.** `A1`, range `A1:C10`, kolom utuh `F:F`, baris utuh `2:2`, sheet lain `Produk!A2:B13`, atau `'Atur Toko'!B1` dengan tanda kutip kalau nama
sheet memuat spasi. Nama sheet diganti, rumus ikut menulis nama baru, seperti terlihat di baris terakhir hasil.

**`$` mengunci saat disalin.** `$` tidak mengubah ke mana referensi menunjuk. Pengaruhnya hanya terasa saat rumus disalin, di-paste, atau di-fill:

| Ditulis di F2 | Di-fill ke F3 | Artinya |
|---|---|---|
| `=E2*B1` | `=E3*B2` | dua-duanya bergeser |
| `=E2*$B$1` | `=E3*$B$1` | tarif tetap di B1 |
| `=E2*B$1` | `=E3*B$1` | baris terkunci, kolom bebas (fill ke kanan: `C$1`) |
| `=E2*$B1` | `=E3*$B2` | kolom terkunci, baris bebas |

`fillBlock(wb, sheet, sumber, tujuan, arah)` adalah fill handle versi kode. Arahnya `'down'`, `'up'`, `'right'`, atau `'left'`. Angka biasa di-fill
menjadi deret (40, 41, 42, ...), sama seperti menarik fill handle di layar. Karena itu contoh di atas hanya mem-fill kolom rumus. Tambahkan `true` di
parameter terakhir untuk menyalin apa adanya tanpa deret. `copyBlock` dan `pasteClip` dari `@kufayeka/sheet/core` melakukan copy dan paste yang sama
seperti Ctrl+C dan Ctrl+V.

**Rumus menempel ke baris, bukan ke nomor.** Baris disisipkan, dihapus, atau di-sort, referensi tetap menunjuk ke sel yang sama ([2.4](02-konsep.md)).
Range yang kehilangan baris di ujungnya akan menyusut ([4.4](04-api-workbook.md#44-baris-dan-kolom)).

**Angka di dalam rumus selalu memakai titik desimal**, apa pun locale-nya: `=E2*1.5`, bukan `=E2*1,5`, karena koma adalah pemisah argumen. Locale hanya
berlaku untuk nilai yang diketik di sel.

**Teks** ditulis dengan tanda kutip dua: `="Total " & E9`. `&` menyambung teks. Tanda kutip di dalam teks ditulis dua kali: `="ukuran ""besar"""`.

**Tanggal adalah angka**, yaitu jumlah hari sejak 30 Desember 1899, sama dengan Excel. `46322` adalah 27 Oktober 2026. Karena itu `=B11+14` berarti 14
hari setelah B11, dan `=D11-TODAY()` adalah sisa hari. Format tanggal ([bab 6](06-format.md)) membuatnya tampil sebagai `27/10/2026`.

**`TODAY()` dan `NOW()`** dihitung ulang setiap ada perubahan lain, atau saat `wb.tick()` dipanggil. Opsi `now` di `createWorkbook` mengganti jamnya.
Contoh di atas memakainya supaya hasilnya selalu sama. Di aplikasi, opsi ini berguna untuk test, atau untuk memakai jam server.

**Uang dibulatkan.** Rumus di sel yang formatnya uang dibulatkan ke jumlah desimal format itu. Dengan `Rp` tanpa desimal, `=E7*0.11` menghasilkan rupiah
utuh, dan total di bawahnya tidak meleset sepeser pun dari yang tampil.

## 5.2 Laporan dengan rumus

Laporan bulanan dari 300 transaksi, tanpa kode JavaScript untuk menghitung. Semuanya rumus di sheet Laporan yang membaca sheet Penjualan. Transaksi baru
masuk, laporan langsung ikut:

<!-- contoh: 05-laporan.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';
import { penjualan, KOLOM_PENJUALAN, barisPenjualan, CABANG } from './data/toko.js';

// Laporan bulanan dari 300 transaksi: ringkasan per cabang, per kategori, dan per minggu, hanya dengan rumus.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const jual = wb.sheet('Sheet1');
jual.setSheetProps({ name: 'Penjualan' });
jual.setValues('A1', [KOLOM_PENJUALAN]);
jual.setValues('A2', barisPenjualan(penjualan(300), 2));      // A2:K301, kolom K = Qty x Harga x (1 - Diskon)

const lap = wb.sheet(wb.addSheet('Laporan'));
// ---- per cabang: omzet, transaksi, rata-rata, transaksi terbesar, pangsa, peringkat
lap.setValues('A1', [['Cabang', 'Omzet', 'Transaksi', 'Rata-rata', 'Terbesar', 'Pangsa', 'Peringkat', 'Nilai']]);
lap.setValues('A2', CABANG.map((c, i) => {
    const r = i + 2;
    return [c,
        `=SUMIFS(Penjualan!$K$2:$K$301, Penjualan!$C$2:$C$301, A${r})`,
        `=COUNTIFS(Penjualan!$C$2:$C$301, A${r})`,
        `=ROUND(AVERAGEIFS(Penjualan!$K$2:$K$301, Penjualan!$C$2:$C$301, A${r}), 0)`,
        `=MAXIFS(Penjualan!$K$2:$K$301, Penjualan!$C$2:$C$301, A${r})`,
        `=B${r}/SUM($B$2:$B$4)`,
        `=RANK(B${r}, $B$2:$B$4)`,
        `=IFS(F${r}>=0.4, "A", F${r}>=0.25, "B", TRUE, "C")`];
}));
lap.setValues('A5', [['Total', '=SUM(B2:B4)', '=SUM(C2:C4)', '=ROUND(B5/C5, 0)', '=MAX(E2:E4)', '=SUM(F2:F4)']]);
for (let r = 2; r <= 5; r++) {
    const v = (c) => lap.value(c + r);
    console.log(String(v('A')).padEnd(9), 'omzet', String(v('B')).padStart(9), '| trx', v('C'), '| rata2', v('D'), '| max', v('E'),
        '| pangsa', (v('F') * 100).toFixed(1) + '%', r < 5 ? '| #' + v('G') + ' ' + v('H') : '');
}

// ---- jawaban satu sel: INDEX + MATCH, XLOOKUP + LARGE, teks yang digabung
lap.setValues('A7', [
    ['Cabang terbaik', '=INDEX(A2:A4, MATCH(MAX(B2:B4), B2:B4, 0))'],
    ['Omzet kedua', '=XLOOKUP(LARGE(B2:B4, 2), B2:B4, A2:A4)'],
    ['Diskon diberikan', '=COUNTIF(Penjualan!J2:J301, ">0") & " transaksi"'],
    ['Qty terbanyak', '=MAX(Penjualan!H2:H301) & " x " & INDEX(Penjualan!F2:F301, MATCH(MAX(Penjualan!H2:H301), Penjualan!H2:H301, 0))'],
    ['Semua cabang', '=TEXTJOIN(", ", TRUE, A2:A4)']
]);
for (let r = 7; r <= 11; r++) console.log(String(lap.value('A' + r)).padEnd(17), ':', lap.value('B' + r).code || lap.value('B' + r));

// ---- per minggu: tanggal dihitung dari nomor hari, WEEKDAY dan selisih tanggal
lap.setValues('D7', [['Minggu', 'Dari', 'Sampai', 'Omzet']]);
lap.setValues('D8', [1, 2, 3, 4, 5].map((w, i) => [w, `=DATE(2026, 10, 1) + ${i * 7}`, `=MIN(E${i + 8} + 6, DATE(2026, 10, 31))`,
    `=SUMIFS(Penjualan!$K$2:$K$301, Penjualan!$B$2:$B$301, ">=" & E${i + 8}, Penjualan!$B$2:$B$301, "<=" & F${i + 8})`]));
lap.setColProps('E:F', { format: { type: 'date' } });
lap.setValues('D13', [['Cek', '=SUM(G8:G12)=B5', 'Hari pertama', '=WEEKDAY(E8, 2)']]);
for (let r = 8; r <= 12; r++) console.log('minggu', lap.value('D' + r), lap.display('E' + r).text, '-', lap.display('F' + r).text, ':', lap.value('G' + r));
console.log('jumlah 5 minggu = total omzet:', lap.value('E13'), '| 1 Oktober 2026 hari ke', lap.value('G13'), '(Senin = 1, jadi Kamis)');
```
<!-- /contoh -->

<!-- hasil: 05-laporan.js -->
```text
Jakarta   omzet 295305000 | trx 150 | rata2 1968700 | max 12495000 | pangsa 47.6% | #1 A
Bandung   omzet 143583350 | trx 75 | rata2 1914445 | max 9760000 | pangsa 23.1% | #3 C
Surabaya  omzet 181564800 | trx 75 | rata2 2420864 | max 12495000 | pangsa 29.3% | #2 B
Total     omzet 620453150 | trx 300 | rata2 2068177 | max 12495000 | pangsa 100.0% 
Cabang terbaik    : Jakarta
Omzet kedua       : Surabaya
Diskon diberikan  : 46 transaksi
Qty terbanyak     : 27 x Semen Portland 50 kg
Semua cabang      : Jakarta, Bandung, Surabaya
minggu 1 01/10/2026 - 07/10/2026 : 143905350
minggu 2 08/10/2026 - 14/10/2026 : 138327500
minggu 3 15/10/2026 - 21/10/2026 : 142789900
minggu 4 22/10/2026 - 28/10/2026 : 151715250
minggu 5 29/10/2026 - 31/10/2026 : 43715150
jumlah 5 minggu = total omzet: true | 1 Oktober 2026 hari ke 4 (Senin = 1, jadi Kamis)
```
<!-- /hasil -->

Pola yang dipakai:

- **`SUMIFS`, `COUNTIFS`, `AVERAGEIFS`, `MAXIFS`, `MINIFS`**: total, jumlah, rata-rata, terbesar, dan terkecil dengan satu syarat atau lebih. Syaratnya
  bisa berupa nilai (`A2`), perbandingan (`">0"`, `"<>Batal"`), atau perbandingan yang disambung dengan sel (`">=" & E8`). Semua range di satu
  `SUMIFS` harus sama panjang. Kalau tidak, hasilnya `#VALUE!`, sama seperti di Excel.
- **Pangsa dan peringkat**: `=B2/SUM($B$2:$B$4)` dengan penyebut yang dikunci `$`, lalu `RANK`.
- **Mencari satu jawaban**: `INDEX(..., MATCH(MAX(...), ..., 0))` atau `XLOOKUP(LARGE(..., 2), ...)` untuk "siapa yang paling besar" dan "siapa yang
  kedua".
- **Tanggal**: `DATE(2026, 10, 1) + 7` adalah satu minggu kemudian. `SUMIFS` dengan `">=" & dari` dan `"<=" & sampai` menjumlahkan per periode.
  `WEEKDAY(tanggal, 2)` memberi 1 untuk Senin sampai 7 untuk Minggu.
- **Cek silang**: `=SUM(G8:G12)=B5` menghasilkan `TRUE` kalau jumlah per minggu sama dengan total. Ini berguna sebagai penjaga laporan.

## 5.3 Named range

Nama untuk sebuah range membuat rumus laporan bisa dibaca seperti kalimat. `=SUMIFS(Omzet, Cabang, "Bandung")` lebih jelas daripada
`=SUMIFS(Penjualan!$K$2:$K$301, Penjualan!$C$2:$C$301, "Bandung")`, dan tidak perlu `$`.

<!-- contoh: 05-nama-subtotal.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';
import { penjualan, KOLOM_PENJUALAN, barisPenjualan } from './data/toko.js';

// Named range: rumus laporan yang terbaca seperti kalimat. SUBTOTAL: total yang menghormati filter dan tidak terhitung dua kali.
const wb = createWorkbook();
const jual = wb.sheet('Sheet1');
jual.setSheetProps({ name: 'Penjualan' });
jual.setValues('A1', [KOLOM_PENJUALAN]);
jual.setValues('A2', barisPenjualan(penjualan(300), 2));

// ---- nama untuk kolom data, dan untuk satu sel tarif
wb.addName('Cabang', 'Penjualan', 'C2:C301');
wb.addName('Kategori', 'Penjualan', 'G2:G301');
wb.addName('Omzet', 'Penjualan', 'K2:K301');
const lap = wb.sheet(wb.addSheet('Laporan'));
lap.setValues('A1', [
    ['Omzet Bandung', '=SUMIFS(Omzet, Cabang, "Bandung")'],
    ['Omzet semen', '=SUMIFS(Omzet, Kategori, "Semen")'],
    ['Komisi sales', '=ROUND(B1 * Komisi, 0)']
]);
console.log('rumus             :', lap.input('B1'));
console.log('omzet Bandung     :', lap.value('B1'), '| semen', lap.value('B2'));
console.log('komisi (belum ada):', lap.value('B3').code, '<- nama Komisi belum dibuat');
lap.setValues('D1', [['Tarif komisi', 0.015]]);
wb.addName('Komisi', 'Laporan', 'E1');
console.log('komisi            :', lap.value('B3'), '<- rumus jalan begitu namanya ada');

// ---- nama diganti: semua rumus ikut menulis nama baru. Range-nya diperluas: semua rumus ikut menghitung baris baru
const id = wb.names().find((n) => n.name === 'Omzet').id;
wb.setName(id, { name: 'Total' });
console.log('ganti nama        :', lap.input('B1'));
jual.setValues('A302', barisPenjualan([{ No: 301, Tanggal: 46325, Cabang: 'Bandung', Sales: 'Asep', Kode: 'PSR-01', Produk: 'Pasir beton', Kategori: 'Pasir', Qty: 10, Harga: 290000, Diskon: 0 }], 302));
wb.setName(id, { range: 'K2:K302' });
wb.setName(wb.names().find((n) => n.name === 'Cabang').id, { range: 'C2:C302' });
wb.setName(wb.names().find((n) => n.name === 'Kategori').id, { range: 'G2:G302' });   // range yang dipakai bersama di SUMIFS harus sama panjang
console.log('baris baru masuk  :', lap.value('B1'), '(+2.900.000)');
console.log('semua nama        :', wb.names().map((n) => n.name + ' = ' + n.ref).join(', '));
console.log('nama tidak boleh  :', JSON.stringify(wb.nameProblem('A1')), '|', JSON.stringify(wb.nameProblem('Total')));

// ---- SUBTOTAL: kelompok kategori di sheet Rekap, total per kelompok, total akhir yang tidak menghitung subtotal
const rekap = wb.sheet(wb.addSheet('Rekap'));
rekap.setValues('A1', [
    ['Kategori / cabang', 'Omzet'],
    ['Semen', '=SUBTOTAL(9, B3:B5)'],
    ['  Jakarta', '=SUMIFS(Total, Kategori, "Semen", Cabang, "Jakarta")'],
    ['  Bandung', '=SUMIFS(Total, Kategori, "Semen", Cabang, "Bandung")'],
    ['  Surabaya', '=SUMIFS(Total, Kategori, "Semen", Cabang, "Surabaya")'],
    ['Besi', '=SUBTOTAL(9, B7:B9)'],
    ['  Jakarta', '=SUMIFS(Total, Kategori, "Besi", Cabang, "Jakarta")'],
    ['  Bandung', '=SUMIFS(Total, Kategori, "Besi", Cabang, "Bandung")'],
    ['  Surabaya', '=SUMIFS(Total, Kategori, "Besi", Cabang, "Surabaya")'],
    ['Semen + besi', '=SUBTOTAL(9, B2:B9)'],
    ['SUM biasa', '=SUM(B2:B9)']
]);
console.log('SUBTOTAL vs SUM   :', rekap.value('B10'), 'vs', rekap.value('B11'), '<- SUM menghitung subtotal dua kali');

// baris yang disembunyikan: 9 tetap menghitungnya, 109 tidak. Baris yang disaring filter tidak dihitung keduanya
rekap.setRowProps('4', { hidden: true });
rekap.setValues('C10', [['=SUBTOTAL(109, B2:B9)']]);
console.log('Bandung semen disembunyikan :', rekap.value('B10'), '(9) |', rekap.value('C10'), '(109)');
rekap.setRowProps('4', { hidden: null });
rekap.createFilter('A1:B9');
rekap.setFilterColumn('A', { hidden: ['  Surabaya'] });
console.log('filter tanpa Surabaya       :', rekap.value('B10'), '(9) |', rekap.value('C10'), '(109)');
```
<!-- /contoh -->

<!-- hasil: 05-nama-subtotal.js -->
```text
rumus             : =SUMIFS(Omzet, Cabang, "Bandung")
omzet Bandung     : 143583350 | semen 97448800
komisi (belum ada): #NAME? <- nama Komisi belum dibuat
komisi            : 2153750 <- rumus jalan begitu namanya ada
ganti nama        : =SUMIFS(Total, Cabang, "Bandung")
baris baru masuk  : 146483350 (+2.900.000)
semua nama        : Cabang = Penjualan!C2:C302, Kategori = Penjualan!G2:G302, Total = Penjualan!K2:K302, Komisi = Laporan!E1
nama tidak boleh  : "\"A1\" is the address of a cell, not a name" | "there is a named range \"Total\" already"
SUBTOTAL vs SUM   : 140157500 vs 280315000 <- SUM menghitung subtotal dua kali
Bandung semen disembunyikan : 140157500 (9) | 127759100 (109)
filter tanpa Surabaya       : 114438500 (9) | 114438500 (109)
```
<!-- /hasil -->

- Rumus boleh ditulis sebelum namanya dibuat. Hasilnya `#NAME?` sampai nama itu ada, lalu langsung dihitung.
- Mengganti nama membuat semua rumus menulis nama baru. Memindahkan atau memperluas range membuat semua rumus menghitung range baru, tanpa satu rumus pun
  ditulis ulang.
- Range sebuah nama mengikuti barisnya, sama seperti referensi biasa. Baris disisipkan di tengah range, nama ikut membesar. Baris ditambahkan di
  **bawah** range, nama tidak ikut, jadi range perlu diperluas dengan `setName` seperti di contoh. Cara lain: buat range nama sedikit lebih panjang
  dari datanya, lalu tambahkan transaksi baru di dalam range itu. Baris kosong tidak mengubah `SUMIFS`. Nama untuk seluruh kolom (`K:K`) belum didukung.
- Di layar, nama dibuat dan diatur lewat menu Data → Named ranges.

| Fungsi | Artinya |
|---|---|
| `wb.addName(nama, sheet, range)` | buat nama. Mengembalikan id-nya |
| `wb.setName(id, { name, sheetId, range })` | ganti nama, pindahkan ke sheet lain, atau ubah range. Boleh salah satu saja |
| `wb.removeName(id)` | hapus. Rumus yang memakainya menjadi `#NAME?` sampai ada nama itu lagi |
| `wb.names()` | `[{ id, name, sheetId, range, ref }]`. `ref` adalah teks seperti `'Penjualan!C2:C302'`, `range` dalam nomor |
| `wb.nameRange(nama)` | `{ sheetId, range }`, atau `null` kalau tidak ada |
| `wb.nameProblem(nama)` | alasan nama itu tidak boleh dipakai, atau `''` kalau boleh. Pakai ini untuk memeriksa isian di form-mu sendiri. Pesannya dalam bahasa Inggris |

Nama yang boleh mengikuti aturan Google Sheets: diawali huruf atau `_`, lalu huruf, angka, `_`, dan titik. Nama tidak boleh berupa alamat sel. `A1`
jelas alamat, tetapi `PPN2026` juga alamat (kolom PPN, baris 2026), jadi pakai `Tarif_PPN`. Huruf besar dan kecil tidak dibedakan.

## 5.4 SUBTOTAL

Bagian akhir contoh di atas adalah rekap dengan kelompok. Baris Semen dan Besi berisi `SUBTOTAL(9, ...)` dari baris di bawahnya, dan total akhir
`SUBTOTAL(9, B2:B9)` mencakup semuanya. `SUBTOTAL` **melewati SUBTOTAL lain** di dalam range-nya, jadi totalnya benar. `SUM` biasa menghitung subtotal
dua kali (lihat hasil: 280 juta, bukan 140 juta).

Angka pertama memilih fungsi. Kalau angkanya ditambah 100, baris yang disembunyikan dengan tangan (`hidden`, grup yang dilipat) juga dilewati. Baris
yang disaring filter selalu dilewati:

| Angka | Fungsi | | Angka | Fungsi |
|---|---|---|---|---|
| 1 / 101 | `AVERAGE` | | 7 / 107 | `STDEV` |
| 2 / 102 | `COUNT` | | 8 / 108 | `STDEVP` |
| 3 / 103 | `COUNTA` | | 9 / 109 | `SUM` |
| 4 / 104 | `MAX` | | 10 / 110 | `VAR` |
| 5 / 105 | `MIN` | | 11 / 111 | `VARP` |
| 6 / 106 | `PRODUCT` | | | |

Grup baris untuk melipat kelompok seperti ini dibahas di [bab 7](07-data.md). Dengan `SUBTOTAL(109, ...)`, kelompok yang dilipat ikut hilang dari total.

## 5.5 Error

<!-- contoh: 05-error.js -->
```js
import { createWorkbook, isError } from '@kufayeka/sheet/core';

// Semua error rumus, dari mana datangnya, dan cara menangkapnya.
const wb = createWorkbook();
const s = wb.sheet('Sheet1');
s.setValues('A1', [
    ['Omzet', 0, 'Transaksi', 0],
    ['Rata-rata', '=B1/D1', '', '=IFERROR(B1/D1, 0)'],
    ['Kode', '=VLOOKUP("ZZZ-00", A1:B1, 2, FALSE)', '', '=IFNA(VLOOKUP("ZZZ-00", A1:B1, 2, FALSE), "tidak dijual")'],
    ['Teks x angka', '="dua" * 3', '', '=IF(ISNUMBER(A4), A4 * 3, "bukan angka")'],
    ['Akar negatif', '=SQRT(-4)'],
    ['Nama salah', '=SUMM(B1:B2)'],
    ['Melingkar', '=C7 + 1', '=B7 * 2'],
    ['Membaca B7', '=B7']
]);
for (let r = 2; r <= 8; r++) {
    const v = s.value('B' + r);
    console.log(String(s.value('A' + r)).padEnd(13), s.input('B' + r).padEnd(36), isError(v) ? v.code : v, s.value('D' + r) !== null ? '| tertangkap: ' + s.value('D' + r) : '');
}

// error menjalar ke rumus yang membacanya, dan hilang sendiri begitu sebabnya hilang
s.setValues('B10', '=B2 + 100');
console.log('menjalar      :', s.value('B10').code);
s.setValues('D1', 4);
console.log('sebab hilang  :', s.value('B2'), '|', s.value('B10'));

// #REF!: sel yang dibaca dihapus
s.setValues('F1', [[5, '=F1*2']]);
s.deleteCols('F');
console.log('kolom dihapus :', s.input('F1'), '=', s.value('F1').code);
```
<!-- /contoh -->

<!-- hasil: 05-error.js -->
```text
Rata-rata     =B1/D1                               #DIV/0! | tertangkap: 0
Kode          =VLOOKUP("ZZZ-00", A1:B1, 2, FALSE)  #N/A | tertangkap: tidak dijual
Teks x angka  ="dua" * 3                           #VALUE! | tertangkap: bukan angka
Akar negatif  =SQRT(-4)                            #NUM! 
Nama salah    =SUMM(B1:B2)                         #NAME? 
Melingkar     =C7 + 1                              #CYCLE! 
Membaca B7    =B7                                  #CYCLE! 
menjalar      : #DIV/0!
sebab hilang  : 0 | 100
kolom dihapus : =#REF!*2 = #REF!
```
<!-- /hasil -->

Hasil rumus yang gagal adalah objek `{ code }`. Periksa dengan `isError(v)` dari `@kufayeka/sheet/core`, dan di layar error tampil sebagai kodenya. Error
menjalar ke setiap rumus yang membacanya, dan hilang sendiri begitu penyebabnya hilang.

| Kode | Sebab | Tangkap dengan |
|---|---|---|
| `#DIV/0!` | dibagi nol, termasuk dibagi sel kosong | `IFERROR(..., 0)` atau `IF(D1=0, 0, B1/D1)` |
| `#N/A` | tidak ketemu: `VLOOKUP`, `XLOOKUP` tanpa cadangan, `MATCH` | `IFNA(..., "tidak ada")` atau parameter ke-4 `XLOOKUP` |
| `#VALUE!` | jenis nilai salah (teks dikali angka), atau range di `SUMIFS` tidak sama panjang | `ISNUMBER`, `VALUE` |
| `#NUM!` | angka tidak mungkin: `SQRT(-4)` | |
| `#NAME?` | fungsi atau named range tidak dikenal | betulkan namanya |
| `#REF!` | sel tunggal, sheet, atau seluruh range yang dibaca sudah dihapus | undo, atau tulis ulang rumusnya |
| `#CYCLE!` | rumus membaca dirinya sendiri, langsung atau memutar lewat sel lain | |

`IFERROR` menangkap semua error, sedangkan `IFNA` hanya `#N/A`. Pakai `IFNA` untuk pencarian, supaya salah ketik yang menghasilkan `#NAME?` atau
`#VALUE!` tetap terlihat dan tidak tertutup angka 0.

## 5.6 Daftar fungsi

Daftarnya diambil dari library itu sendiri (`FUNCTION_NAMES` dari `@kufayeka/sheet/core`), jadi selalu sama dengan yang benar-benar tersedia:

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

Argumen dan hasilnya sama dengan Excel. Dikelompokkan menurut kebutuhan:

| Kebutuhan | Fungsi |
|---|---|
| total, rata-rata, hitung | `SUM`, `AVERAGE`, `COUNT`, `COUNTA`, `COUNTBLANK`, `MAX`, `MIN`, `MEDIAN`, `PRODUCT`, `SUBTOTAL` |
| dengan syarat | `SUMIF`, `SUMIFS`, `COUNTIF`, `COUNTIFS`, `AVERAGEIF`, `AVERAGEIFS`, `MAXIFS`, `MINIFS` |
| mencari | `XLOOKUP`, `VLOOKUP`, `HLOOKUP`, `INDEX`, `MATCH`, `CHOOSE` |
| urutan | `LARGE`, `SMALL`, `RANK`, `RANK.EQ` |
| kondisi | `IF`, `IFS`, `SWITCH`, `AND`, `OR`, `NOT`, `XOR`, `IFERROR`, `IFNA` |
| memeriksa | `ISBLANK`, `ISNUMBER`, `ISTEXT`, `ISLOGICAL`, `ISERROR`, `ISNA`, `N`, `EXACT` |
| pembulatan | `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `CEILING`, `FLOOR`, `INT`, `TRUNC`, `MOD` |
| matematika | `ABS`, `SIGN`, `SQRT`, `POWER`, `EXP`, `LN`, `LOG`, `LOG10`, `PI` |
| statistik | `STDEV`, `STDEV.S`, `STDEV.P`, `VAR`, `VAR.S`, `VAR.P` |
| tanggal dan jam | `TODAY`, `NOW`, `DATE`, `TIME`, `YEAR`, `MONTH`, `DAY`, `HOUR`, `MINUTE`, `SECOND`, `WEEKDAY`, `EDATE`, `DATEDIF` |
| teks | `CONCAT`, `CONCATENATE`, `TEXTJOIN`, `TEXT`, `LEFT`, `RIGHT`, `MID`, `LEN`, `FIND`, `SEARCH`, `REPLACE`, `SUBSTITUTE`, `UPPER`, `LOWER`, `PROPER`, `TRIM`, `REPT`, `VALUE` |
| posisi | `ROW`, `ROWS`, `COLUMN`, `COLUMNS` |

Fungsi yang tidak ada di daftar menghasilkan `#NAME?`. Yang belum tersedia antara lain `SUMPRODUCT`, `NA`, `EOMONTH`, `NETWORKDAYS`, `FILTER`, `SORT`,
`UNIQUE` (fungsi yang hasilnya menumpah ke banyak sel), dan `IMPORTRANGE` untuk membaca file lain.

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [4. API workbook](04-api-workbook.md) · Berikutnya: [6. Format dan locale](06-format.md)
