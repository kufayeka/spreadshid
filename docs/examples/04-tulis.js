import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const sh = wb.sheet('Sheet1');

sh.setValues('A1', 'Rekap pekerjaan');                  // satu sel
sh.setValues('A2', [['Galian', 120], ['Urugan', 40]]);   // blok: satu array per baris
sh.setValues('D1', [[1], [2], [3]]);                     // satu kolom ke bawah

// banyak sel sekaligus, isi dan gaya, sebagai satu perubahan (satu undo)
sh.setBlock([
    { at: 'A4', value: 'Total', style: { bold: true } },
    { at: 'B4', value: '=SUM(B2:B3)', style: { bold: true } }
]);

console.log('B4            :', sh.value('B4'));
console.log('gaya A4       :', sh.style('A4'));
console.log('terisi sampai :', sh.lastFilled());

let berisi = 0;
sh.forEachFilledRow(() => { berisi++; });
console.log('baris berisi  :', berisi);

sh.clear('A2:B3'); // isinya hilang, gayanya tetap (seperti tombol Delete)
console.log('setelah clear :', sh.value('A2'), sh.value('B4'));
wb.undo();
console.log('setelah undo  :', sh.value('A2'), sh.value('B4'));
