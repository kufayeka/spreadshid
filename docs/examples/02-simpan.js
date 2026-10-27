import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const sh = wb.sheet('Sheet1');
sh.setValues('A1', [['Pekerjaan', 'Volume'], ['Galian', 120]]);

// yang belum tersimpan, siap dikirim ke server
let patch = wb.pendingPatch();
console.log('simpan pertama :', patch.sheets.upsert.length, 'sheet,', patch.columns.upsert.length, 'kolom,', patch.rows.upsert.length, 'baris');
wb.saved(patch); // anggap server sudah menyimpannya

sh.setValues('B2', 125);
patch = wb.pendingPatch();
console.log('satu perubahan :', patch.rows.upsert.length, 'baris dikirim');

// seluruh workbook jadi objek biasa, lalu dibuka lagi
const doc = wb.toJSON();
const dibukaLagi = createWorkbook(doc);
console.log('dibuka lagi    :', dibukaLagi.sheet('Sheet1').value('B2'));
