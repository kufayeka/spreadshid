import { createWorkbook } from '@kufayeka/sheet/core';

// Pelajaran 2: tiga cara menunjuk sel, bentuk-bentuk range, dan sheet lewat nama atau id.
const wb = createWorkbook();
const s = wb.sheet('Sheet1');
s.setValues('A1', [['Produk', 'Harga'], ['Semen', 72000], ['Besi', 79500]]);

// tiga cara menunjuk B2: semuanya sama
console.log('s.value("B2")          :', s.value('B2'));
console.log('wb.value("Sheet1","B2"):', wb.value('Sheet1', 'B2'));
console.log('s.value(1, 1)          :', s.value(1, 1), '(baris dan kolom dihitung dari 0)');

// range dalam bentuk teks
s.setStyle('A1:B1', { bold: true });                  // kotak
s.setStyle('A1:B1, A3:B3', { fill: '#fef7e0' });      // beberapa kotak sekaligus
s.setColProps('B', { width: 120 });                   // kolom
s.setRowProps('1', { height: 30 });                   // baris
console.log('gaya A1                :', JSON.stringify(s.style('A1')));

// nomor <-> alamat
console.log('alamat (2, 1)          :', wb.address(2, 1));

// sheet: nama bisa diganti orang, id tidak pernah berubah
const id: string = s.id;
s.setSheetProps({ name: 'Harga' });
console.log('nama sekarang          :', s.name, '| cari id dari nama:', wb.sheetIdByName('harga') === id);
console.log('lewat id tetap jalan   :', wb.sheet(id).value('A2'));

// alamat yang salah: error yang jelas, bukan diam-diam salah sel
try { s.value('ZZZZ1'); } catch (err) { console.log('alamat salah           :', (err as Error).message); }
