import { createWorkbook } from '@kufayeka/sheet/core';
import { penjualan, KOLOM_PENJUALAN, barisPenjualan } from './data/toko.js';

// Penjualan seminggu: semua cara membaca satu sel, dan mencari tabel di sekitar sebuah sel.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const jual = wb.sheet('Sheet1');
jual.setSheetProps({ name: 'Penjualan' });
jual.setValues('A1', [KOLOM_PENJUALAN]);
jual.setValues('A2', barisPenjualan(penjualan(20), 2));
jual.setColProps('B', { format: { type: 'date' } });
jual.setColProps('I', { format: { type: 'money', decimals: 0 } });
jual.setColProps('J', { format: { type: 'percent', decimals: 0 } });
jual.setColProps('K', { format: { type: 'money', decimals: 0 } });

// satu sel, lima cara membacanya
const disimpan = jual.raw('K2');                         // { f, refs }: referensinya disimpan sebagai id baris dan kolom
console.log('raw K2     :', disimpan.f, '+', disimpan.refs.length, 'referensi', disimpan.refs.map((x) => x.k).join(', '));
console.log('input K2   :', jual.input('K2'));
console.log('value K2   :', jual.value('K2'));
console.log('display K2 :', JSON.stringify(jual.display('K2')));
console.log('format K2  :', JSON.stringify(jual.cellFormat('K2')), '(dari kolom K)');
console.log('tanggal B2 :', jual.value('B2'), '->', jual.display('B2').text);

// ukuran sheet dan tabel yang berisi data
console.log('ukuran     :', JSON.stringify(jual.size()), '| terisi sampai', wb.address(jual.lastFilled().r, jual.lastFilled().c));
const t = jual.dataRegion(5, 3);                         // tabel yang memuat sel D6, seperti Ctrl+A di Excel
console.log('tabel D6   :', wb.address(t.r1, t.c1) + ':' + wb.address(t.r2, t.c2));

// nomor dan id: nomor berubah saat baris disisipkan, id tidak
const id = jual.rowId(4);
jual.insertRows('2', 3);
console.log('baris 5 kini nomor', jual.rowIndex(id) + 1, '| kolom Qty nomor', jual.colIndex(jual.colId(7)) + 1);
