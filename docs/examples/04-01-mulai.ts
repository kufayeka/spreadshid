import { createWorkbook } from '@kufayeka/sheet/core';
import type { Workbook, SheetApi, CellResult } from '@kufayeka/sheet/core';

// Pelajaran 1: buat workbook, tulis ke sel, baca kembali.
const wb: Workbook = createWorkbook();        // workbook baru: satu sheet "Sheet1", 1000 baris, 26 kolom
const s: SheetApi = wb.sheet('Sheet1');       // pegangan untuk sheet itu

s.setValues('A1', 'Semen');                   // teks
s.setValues('B1', 72000);                     // angka
s.setValues('C1', '=B1*10');                  // diawali "=": rumus

const nama: CellResult = s.value('A1');       // isi sel
const total: CellResult = s.value('C1');      // hasil rumus
const rumus: string = s.input('C1');          // rumusnya, seperti di formula bar

console.log(nama, total, rumus);
console.log('sheet:', wb.sheetIds().length, 'buah, ukuran', s.size());
