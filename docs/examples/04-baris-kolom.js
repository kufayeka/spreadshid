import { createWorkbook } from '@kufayeka/sheet/core';
import { PRODUK } from './data/toko.js';

// Daftar harga: menyisipkan, menghapus, memindahkan, menyembunyikan, mengatur lebar, membekukan.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const sh = wb.sheet('Sheet1');
sh.setValues('A1', [['Kode', 'Nama produk', 'Harga jual']]);
sh.setValues('A2', PRODUK.slice(0, 5).map((p) => [p[0], p[1], p[5]]));
sh.setValues('A8', [['Jumlah produk', '=COUNTA(A2:A6)']]);
const kode = () => [1, 2, 3, 4, 5, 6].map((r) => sh.value(r, 0)).filter(Boolean).join(', ');

sh.insertRows('4', 1);                                  // baris baru di baris 4
sh.setValues('A4', [['CAT-01', 'Cat kayu 1 kg', 65000]]);
console.log('disisipkan    :', kode(), '| COUNTA:', sh.value('B9'), sh.input('B9'));

sh.deleteRows('2');                                     // hapus satu baris
console.log('dihapus       :', kode(), '| COUNTA:', sh.value('B8'));

sh.moveRows(3, 1, 1);                                   // 1 baris dari nomor 3 (baris 4) pindah ke depan nomor 1 (baris 2)
console.log('dipindah      :', kode());

sh.insertCols('C');                                     // kolom baru untuk kategori
sh.setValues('C1', 'Kategori');
console.log('kolom harga   :', sh.value('D1'));

sh.setColProps('B', { width: 200 });
sh.setColProps('D', { format: { type: 'money', decimals: 0 }, width: 120 });
sh.setColProps('C', { hidden: true });
sh.setRowProps('1', { height: 32 });
sh.setSheetProps({ freezeRows: 1, freezeCols: 1, hideGridlines: true });
console.log('kolom B, C, D :', JSON.stringify(sh.colProps(1)), JSON.stringify(sh.colProps(2)), JSON.stringify(sh.colProps(3)));
console.log('harga baris 2 :', sh.display('D2').text);
console.log('sheet         :', JSON.stringify(sh.sheetProps()));
console.log('lebar kolom   :', sh.colAxis().size(1), 'px, kolom C', sh.colAxis().size(2), 'px (tersembunyi)');
