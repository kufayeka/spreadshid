# 8. Mengisi sheet dari data

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [7. Data](07-data.md) · Berikutnya: [Daftar isi](../README.md#daftar-isi)

`populate` menulis data dari aplikasimu (hasil API, query database) ke sheet: satu nilai, daftar, blok, atau tabel objek. Bedanya dengan `setValues`:
**data tetap data**. Teks `'=1+1'` dari database tetap teks, tidak berubah jadi rumus, dan teks yang kelihatan seperti angka tetap teks. Jadi data dari
luar tidak bisa menyelipkan rumus ke sheet.

<!-- contoh: 08-populate.js -->
```js
import { createWorkbook, populate } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const sh = wb.sheet('Sheet1');
const baris = (range) => {
    const out = [];
    for (let r = range.r1; r <= range.r2; r++) {
        const row = [];
        for (let c = range.c1; c <= range.c2; c++) row.push(sh.display(r, c).text);
        out.push(row.join(' | '));
    }
    return out.join('\n                ');
};

// tabel: satu baris per objek, satu kolom per field, dengan baris judul
const data = [
    { pekerjaan: 'Galian', volume: 120, satuan: 'm3' },
    { pekerjaan: 'Urugan', volume: 40, satuan: 'm3' },
    { pekerjaan: 'Rumus?', volume: '=1+1', satuan: 'teks' }
];
let range = populate(wb, 'Sheet1', { at: 'A1', header: true }, data);
console.log('tabel         :', baris(range));
console.log('"=1+1" tetap teks:', JSON.stringify(sh.value('B4')));

// daftar ke kanan, mulai E1
range = populate(wb, 'Sheet1', { at: 'E1', direction: 'right' }, ['Sen', 'Sel', 'Rab']);
console.log('ke kanan      :', baris(range));

// pilih field dan urutannya
range = populate(wb, 'Sheet1', { at: 'A7', header: true, fields: ['satuan', 'pekerjaan'] }, data.slice(0, 2));
console.log('field tertentu:', baris(range));

// cell object: nilai plus gayanya
range = populate(wb, 'Sheet1', { at: 'E3' }, [{ value: 'Terlambat', fill: '#f4c7c3', bold: true }, { value: 'Tepat', fill: '#b7e1cd' }]);
console.log('cell object   :', baris(range), '| gaya E3:', JSON.stringify(sh.style('E3')));
```
<!-- /contoh -->

<!-- hasil: 08-populate.js -->
```text
tabel         : pekerjaan | volume | satuan
                Galian | 120 | m3
                Urugan | 40 | m3
                Rumus? | =1+1 | teks
"=1+1" tetap teks: "=1+1"
ke kanan      : Sen | Sel | Rab
field tertentu: satuan | pekerjaan
                m3 | Galian
                m3 | Urugan
cell object   : Terlambat
                Tepat | gaya E3: {"fill":"#f4c7c3","bold":true}
```
<!-- /hasil -->

## `populate(wb, sheet, spec, data)`

Mengembalikan range yang ditulis (`{ r1, c1, r2, c2 }`), atau `null` kalau tidak ada yang ditulis. Satu kali panggil = satu perubahan, dengan source
`'code'`, jadi aturan untuk orang di layar tidak menghalanginya.

| `spec` | Artinya | Bawaan |
|---|---|---|
| `at` | sel awal: `'A1'` atau `{ r, c }` | wajib |
| `direction` | daftar ditulis ke `'down'` (bawah) atau `'right'` (kanan) | `'down'` |
| `header` | untuk tabel objek: baris pertama berisi nama field | `false` |
| `fields` | untuk tabel objek: field yang diambil dan urutannya | semua field, urut kemunculan |
| `limit` | paling banyak berapa baris | sampai ujung sheet |

Bentuk `data` yang diterima:

| Data | Ditulis sebagai |
|---|---|
| `12` | satu sel |
| `[1, 2, 3]` | tiga sel ke bawah (atau ke kanan) |
| `[[1, 2], [3, 4]]` | blok; tiap array dalam = satu baris (atau satu kolom kalau `direction: 'right'`) |
| `[{ pekerjaan: 'Galian', volume: 120 }, ...]` | tabel: satu baris per objek, satu kolom per field |
| `{ value: 'Terlambat', fill: '#f4c7c3', bold: true }` | **cell object**: nilai plus gayanya. Bisa dipakai di mana pun nilai bisa ditaruh (di daftar, di blok, sebagai field tabel). Kunci gaya yang diterima sama dengan [4.2](04-api-workbook.md#42-gaya-sel) |

Daftar objek yang semuanya punya `value` dianggap daftar cell object; yang tidak, dianggap tabel.

Kalau datanya perlu jadi rumus atau dibaca sesuai locale (misalnya template BOQ dari kodemu sendiri), pakai `setValues` atau `setBlock`.

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [7. Data](07-data.md) · Berikutnya: [Daftar isi](../README.md#daftar-isi)
