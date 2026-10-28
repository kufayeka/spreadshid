import { createWorkbook } from '@kufayeka/sheet/core';

// Paling sederhana: buat workbook, tulis ke sel, baca kembali.
const wb = createWorkbook();                  // workbook baru: satu sheet bernama "Sheet1", 1000 baris, 26 kolom
const s = wb.sheet('Sheet1');                 // pegangan untuk sheet itu

s.setValues('A1', 'Semen');                   // satu sel
s.setValues('B1', 72000);
s.setValues('C1', '=B1*10');                  // diawali "=": rumus

console.log(s.value('A1'));                   // isi sel
console.log(s.value('C1'));                   // hasil rumus
console.log(s.input('C1'));                   // rumusnya, seperti di formula bar
