import { createWorkbook } from '@kufayeka/sheet/core';

// Satu workbook per bulan, satu sheet per cabang, plus rekap yang membaca semua cabang.
const wb = createWorkbook();
const nama = () => wb.sheetIds().map((s) => wb.sheetProps(s).name + (wb.sheetProps(s).hidden ? ' (tersembunyi)' : '')).join(', ');

wb.setSheetProps('Sheet1', { name: 'Jakarta' });
wb.setValues('Jakarta', 'A1', [['Omzet'], [125000000]]);
const bandung = wb.duplicateSheet('Jakarta');          // salinan: "Copy of Jakarta"
wb.setSheetProps(bandung, { name: 'Bandung' });
wb.setValues('Bandung', 'A2', 98000000);
const rekap = wb.addSheet('Rekap');
wb.setValues(rekap, 'A1', [['Total omzet', '=Jakarta!A2+Bandung!A2']]);
wb.moveSheet(rekap, 0);                                 // rekap di depan
console.log('sheet         :', nama());
console.log('total omzet   :', wb.value('Rekap', 'B1'));

wb.setSheetProps('Bandung', { name: 'Bandung Kota' }); // ganti nama: rumus ikut
console.log('rumus rekap   :', wb.input('Rekap', 'B1'));

wb.hideSheet('Jakarta', true);                          // disembunyikan, tetap dihitung
console.log('sembunyikan   :', nama(), '| total masih', wb.value('Rekap', 'B1'));

wb.removeSheet('Bandung Kota');                         // dihapus: rumus yang membacanya #REF!
console.log('hapus Bandung :', nama(), '| rumus', wb.input('Rekap', 'B1'), '=', wb.value('Rekap', 'B1').code);
wb.undo();
console.log('undo          :', nama(), '| total', wb.value('Rekap', 'B1'));
console.log('id dari nama  :', wb.sheetIdByName('rekap') === rekap);
