import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const [s] = wb.sheetIds();
wb.setValues(s, 0, 0, [['Pekerjaan', 'Volume'], ['Galian', 120]]);

// yang belum tersimpan, siap dikirim ke server
let patch = wb.pendingPatch();
console.log('simpan pertama :', patch.sheets.upsert.length, 'sheet,', patch.columns.upsert.length, 'kolom,', patch.rows.upsert.length, 'baris');
wb.saved(patch); // server sudah menyimpannya

wb.setValues(s, 1, 1, 125);
patch = wb.pendingPatch();
console.log('satu perubahan :', patch.rows.upsert.length, 'baris dikirim');

// seluruh workbook sebagai objek biasa, dan dibuka lagi darinya
const doc = wb.toJSON();
const dibukaLagi = createWorkbook(doc);
console.log('dibuka lagi    :', dibukaLagi.value(dibukaLagi.sheetIds()[0], 1, 1));
