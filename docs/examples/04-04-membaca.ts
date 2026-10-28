import { createWorkbook, isError } from '@kufayeka/sheet/core';
import type { CellResult, CellValue } from '@kufayeka/sheet/core';
import { penjualan, KOLOM_PENJUALAN, barisPenjualan } from './data/toko.js';

// Pelajaran 4: satu sel dibaca dengan beberapa cara, error rumus, mencari ujung data, dan membaca semua baris.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const jual = wb.sheet('Sheet1');
jual.setSheetProps({ name: 'Penjualan' });
jual.setValues('A1', [KOLOM_PENJUALAN]);
jual.setValues('A2', barisPenjualan(penjualan(20), 2));
jual.setColProps('B', { format: { type: 'date' } });
jual.setColProps('K', { format: { type: 'money', decimals: 0 } });

// satu sel, beberapa cara membacanya
console.log('value   :', jual.value('K2'));                         // angka untuk dihitung
console.log('input   :', jual.input('K2'));                         // rumus yang diketik
console.log('display :', JSON.stringify(jual.display('K2')));       // yang tampil di layar
console.log('format  :', JSON.stringify(jual.cellFormat('K2')));    // format sel (dari kolom K)
console.log('tanggal :', jual.value('B2'), '->', jual.display('B2').text);

// value() bisa berupa error rumus: periksa dengan isError sebelum dipakai sebagai angka
jual.setValues('M1', '=K2/0');
const hasil: CellResult = jual.value('M1');
if (isError(hasil)) console.log('error   :', hasil.code);
else { const angka: CellValue = hasil; console.log('angka   :', angka); }

// ujung data dan tabel di sekitar sebuah sel
const akhir = jual.lastFilled();
const tabel = jual.dataRegion(5, 3);
console.log('terisi  : sampai', wb.address(akhir.r, akhir.c), '| tabel di sekitar D6:', wb.address(tabel.r1, tabel.c1) + ':' + wb.address(tabel.r2, tabel.c2));

// semua baris yang berisi, cepat: baris kosong dilewati. cells memakai id kolom sebagai kunci
let jakarta = 0;
const kolomCabang = jual.colId(2);
jual.forEachFilledRow((r, cells) => { if (r > 0 && cells[kolomCabang] === 'Jakarta') jakarta++; });
console.log('Jakarta :', jakarta, 'transaksi');

// nomor berubah, id tetap: simpan id kalau perlu mengingat sebuah baris
const id = jual.rowId(4);
jual.insertRows('2', 3);
console.log('baris 5 sekarang di nomor', jual.rowIndex(id) + 1);
