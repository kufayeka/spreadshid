import { createWorkbook } from '@kufayeka/sheet/core';
import { PRODUK } from './data/toko.js';

// Pelajaran 6: menyisipkan, menghapus, memindah, menyembunyikan, mengatur ukuran, membekukan.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const s = wb.sheet('Sheet1');
s.setValues('A1', [['Kode', 'Produk', 'Harga']]);
s.setValues('A2', PRODUK.slice(0, 5).map((p) => [p[0], p[1], p[5]]));
s.setValues('A8', [['Jumlah produk', '=COUNTA(A2:A6)']]);
const kode = () => [1, 2, 3, 4, 5, 6].map((r) => s.value(r, 0)).filter((v) => v !== null).join(', ');

s.insertRows('4');                                     // satu baris kosong di baris 4
s.setValues('A4', [['CAT-01', 'Cat kayu 1 kg', 65000]]);
console.log('disisipkan :', kode(), '| rumus ikut membesar:', s.input('B9'), '=', s.value('B9'));

s.deleteRows('2');                                     // hapus baris pertama range: range menyusut, bukan #REF!
console.log('dihapus    :', kode(), '| rumus:', s.input('B8'), '=', s.value('B8'));

s.moveRows(3, 1, 1);                                   // 1 baris dari nomor 3 (baris 4) ke depan nomor 1 (baris 2)
console.log('dipindah   :', kode());

s.insertCols('C');                                     // kolom baru di C, Harga bergeser ke D
s.setValues('C1', 'Kategori');
s.setColProps('D', { format: { type: 'money', decimals: 0 }, width: 120 });
s.setColProps('C', { hidden: true });                  // disembunyikan, tetap dihitung
s.setRowProps('1', { height: 32 });
s.setSheetProps({ freezeRows: 1, freezeCols: 1 });     // bekukan judul dan kolom pertama
console.log('kolom D    :', s.value('D1'), '|', s.display('D2').text, '| lebar C', s.colAxis().size(2), 'px (tersembunyi)');
console.log('props      :', JSON.stringify(s.colProps(3)), JSON.stringify(s.rowProps(0)), JSON.stringify(s.sheetProps()));
