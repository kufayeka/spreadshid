import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const boq = wb.sheet('Sheet1');
boq.setValues('A1', [
    ['Pekerjaan', 'Jumlah'],
    ['1. Tanah', '=SUBTOTAL(9, B3:B4)'],
    ['Galian', 10200000],
    ['Urugan', 8400000],
    ['2. Beton', '=SUBTOTAL(9, B6:B7)'],
    ['Pile', 12500000],
    ['Balok', 29500000],
    ['Total', '=SUBTOTAL(9, B2:B7)']
]);
console.log('total (bab tidak dihitung dua kali):', boq.value('B8'));

// named range: nama untuk sebuah range, dipakai di rumus
wb.addName('Pajak', 'Sheet1', 'D1');
boq.setValues('D1', 0.11);
boq.setValues('B9', '=B8 * Pajak');
console.log('PPN                               :', boq.value('B9'));

// rumus yang ditulis sebelum namanya ada: #NAME? dulu, lalu jalan
boq.setValues('B10', '=SUM(Volume)');
console.log('sebelum nama dibuat               :', boq.value('B10').code);
wb.addName('Volume', 'Sheet1', 'B3:B4');
console.log('sesudah                           :', boq.value('B10'));

// baris yang disembunyikan filter tidak ikut dihitung SUBTOTAL
boq.createFilter('A2:B7');
boq.setFilterColumn('A', { hidden: ['Urugan'] });
console.log('total setelah filter              :', boq.value('B8'));
