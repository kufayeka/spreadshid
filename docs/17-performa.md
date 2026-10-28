# 17. Performa

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [16. Panduan layar](16-layar.md) · Berikutnya: [18. Referensi](18-referensi.md)

Sheet ini dibuat untuk data sungguhan: setahun transaksi, RAB proyek besar, ribuan baris dari database. Tiga hal yang membuatnya tetap cepat:

1. **Hanya yang terkena yang dihitung ulang.** Mengubah satu Qty menghitung ulang rumus Total di baris itu dan rumus yang membacanya, bukan 100.000
   rumus lainnya.
2. **Hanya yang tampil yang digambar.** Grid menggambar sel yang terlihat di layar saja, berapa pun jumlah barisnya.
3. **Hanya yang berubah yang dikirim.** Patch berisi baris yang berubah. Menyisipkan baris tidak menulis ulang baris-baris di bawahnya, karena rumus
   menyimpan id baris, bukan nomornya.

## Contoh: setahun penjualan

<!-- contoh: 17-performa.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';
import { penjualan, KOLOM_PENJUALAN, barisPenjualan } from './data/toko.js';

// Setahun penjualan: 100.000 transaksi dengan rumus Total per baris dan ringkasan per cabang.
// Yang dicetak di sini adalah hal yang tidak bergantung pada kecepatan komputer: berapa yang dihitung ulang dan berapa yang dikirim saat menyimpan.
const N = 100000;
const wb = createWorkbook(null, { undoLimit: 50 });
const jual = wb.sheet('Sheet1');
jual.setSheetProps({ name: 'Penjualan' });
jual.insertRows(1000, N + 1 - 1000);
jual.setValues('A1', [KOLOM_PENJUALAN]);
jual.setValues('A2', barisPenjualan(penjualan(N), 2));          // 1.100.000 sel, 100.000 rumus, satu perubahan
wb.setValues('Penjualan', 'M1', [['Jakarta', `=SUMIFS(K2:K${N + 1}, C2:C${N + 1}, M1)`], ['Bandung', `=SUMIFS(K2:K${N + 1}, C2:C${N + 1}, M2)`]]);
const sebelum = jual.value('N2');
console.log('ukuran         :', jual.size().rows, 'baris |', N, 'rumus Total | omzet Bandung', sebelum);

// satu ketikan: hanya rumus Total baris itu dan dua SUMIFS yang dihitung ulang, bukan 100.000 rumus
let dihitung = 0;
const off = wb.on('op', () => { dihitung++; });
wb.saved(wb.pendingPatch());
jual.setValues('H50001', 1000, { source: 'user' });            // transaksi ke-50.000, cabang Bandung
console.log('satu ketikan   :', dihitung, 'perubahan | omzet Bandung', sebelum, '->', jual.value('N2'));
off();

// yang dikirim saat menyimpan: satu baris, bukan seluruh workbook
const patch = wb.pendingPatch();
console.log('patch          :', patch.rows.upsert.length, 'baris,', Math.round(JSON.stringify(patch).length / 100) / 10, 'KB');

// menyisipkan baris di tengah tidak menulis ulang 50.000 rumus di bawahnya: rumus menyimpan id baris, bukan nomornya
wb.saved(patch);
jual.insertRows('50001', 1);
console.log('sisip baris    :', wb.pendingPatch().rows.upsert.length, 'baris di patch | rumus K50002 kini', jual.input('K50002'));
```
<!-- /contoh -->

<!-- hasil: 17-performa.js -->
```text
ukuran         : 100001 baris | 100000 rumus Total | omzet Bandung 59160874325
satu ketikan   : 1 perubahan | omzet Bandung 59160874325 -> 59888524325
patch          : 1 baris, 1.3 KB
sisip baris    : 1 baris di patch | rumus K50002 kini =H50002*I50002*(1-J50002)
```
<!-- /hasil -->

## Angka ukur

Diukur oleh `test/core-scale.test.js` di laptop pengembangan (Windows, Node 24), pada sheet 100.000 baris berisi 200.000 rumus, dua di setiap baris.
Salah satunya adalah running total yang membaca baris di atasnya, kasus terburuk untuk perhitungan ulang. Angka berubah sedikit setiap kali diukur, dan
test-nya menjaga batas atasnya.

| Kejadian | Waktu |
|---|---|
| satu ketikan di RAB biasa, termasuk menggambar layar | sekitar 50 ms |
| menyisipkan satu baris di tengah 100.000 baris | 50–130 ms |
| satu ketikan di baris 10, di atas 99.990 running total yang semuanya berubah | 150–250 ms |
| satu ketikan di baris terakhir | di bawah 1 ms |
| menulis 500.000 sel (200.000 rumus) sekaligus | beberapa detik, sekali saja |
| `toJSON` 100.000 baris | sekitar 0,4 detik |
| membuka lagi 100.000 baris dan 200.000 rumus | sekitar 2,5 detik |

## Saran

- **Ringkasan dengan `SUMIFS` dan pivot, bukan running total.** Running total (`=E1+D2`) adalah rantai: mengubah baris atas mengubah semua baris di
  bawahnya. `SUMIFS` atas sebuah kolom dihitung sekali per perubahan.
- **Satu panggilan untuk banyak sel.** `setValues` dengan tabel, `setBlock`, atau `populate` adalah satu perubahan dan satu kali hitung ulang. Memanggil
  `setValues` 10.000 kali dalam loop berarti 10.000 perubahan dan 10.000 langkah undo.
- **`undoLimit`.** Bawaannya 200 langkah. Untuk sheet sangat besar, `createWorkbook(doc, { undoLimit: 50 })` menghemat memori.
- **Simpan patch, bukan `toJSON`, setiap kali ada perubahan** ([11.9](11-react.md#119-menyimpan-otomatis)). Satu ketikan menghasilkan patch sekitar
  1 KB, sedangkan workbook 100.000 baris berukuran puluhan MB.
- **`useWorkbook` dengan nilai sederhana** ([11.7](11-react.md#117-membaca-workbook-dari-komponen-lain-useworkbook)), supaya komponen di luar sheet tidak
  digambar ulang di setiap ketikan.
- **Membuka workbook besar sekali, lalu memakainya terus.** `createWorkbook(doc)` untuk 100.000 baris butuh beberapa detik. Jangan membuatnya ulang
  saat props lain berubah ([11.6](11-react.md#116-workbook-bukan-state-react)).

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [16. Panduan layar](16-layar.md) · Berikutnya: [18. Referensi](18-referensi.md)
