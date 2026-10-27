import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const [s] = wb.sheetIds();
wb.setValues(s, 0, 0, [[10], [20], ['=SUM(A1:A2)']]);

// setiap baris dan kolom punya id tetap; nomor barisnya bisa berubah
const idBaris = wb.rowId(s, 0);
console.log('id baris pertama :', typeof idBaris, idBaris.length, 'karakter');

wb.insertRows(s, 0, 2); // dua baris baru di atas
console.log('baris tadi sekarang nomor', wb.rowIndex(s, idBaris));
console.log('formula ikut pindah:', wb.input(s, 4, 0), '=', wb.value(s, 4, 0));

wb.setValues(s, 0, 0, 5); // sel di baris baru, di luar range SUM
wb.insertRows(s, 3, 1);   // satu baris di tengah range SUM
wb.setValues(s, 3, 0, 70);
console.log('range ikut melebar  :', wb.input(s, 5, 0), '=', wb.value(s, 5, 0));
