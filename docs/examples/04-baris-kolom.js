import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const sh = wb.sheet('Sheet1');
sh.setValues('A1', [['No', 'Pekerjaan', 'Volume'], [1, 'Galian', 120], [2, 'Urugan', 40], [3, 'Beton', 18.5]]);

sh.insertRows('3', 2);        // 2 baris baru mulai baris 3
sh.deleteRows('3:4');         // hapus baris 3 sampai 4 lagi
sh.insertCols('C');           // kolom baru di C, Volume geser ke D
console.log('D1             :', sh.value('D1'));
sh.deleteCols('C');

sh.moveRows(3, 1, 1);         // pindah 1 baris dari baris ke-4 (nomor 3) ke posisi nomor 1
console.log('urutan         :', [1, 2, 3].map((r) => sh.value(r, 1)).join(', '));

sh.setColProps('B', { width: 200 });
sh.setColProps('C', { hidden: true });
sh.setRowProps('1', { height: 32 });
sh.setSheetProps({ freezeRows: 1, freezeCols: 1 });
console.log('kolom B        :', sh.colProps(1));
console.log('kolom C        :', sh.colProps(2));
console.log('baris 1        :', sh.rowProps(0));
console.log('beku           :', sh.sheetProps().freezeRows, 'baris,', sh.sheetProps().freezeCols, 'kolom');
console.log('ukuran         :', sh.size());
