import { createWorkbook, isError } from '@kufayeka/sheet/core';

// Pelajaran 7: banyak sheet. Satu sheet per cabang, dan sheet Rekap yang membaca keduanya.
const wb = createWorkbook();
const daftar = () => wb.sheetIds().map((id) => wb.sheetProps(id).name + (wb.sheetProps(id).hidden ? ' (tersembunyi)' : '')).join(', ');

wb.sheet('Sheet1').setSheetProps({ name: 'Jakarta' });
wb.setValues('Jakarta', 'A1', [['Omzet'], [125000000]]);
const bandung: string = wb.duplicateSheet('Jakarta');           // salinan: mengembalikan id sheet baru
wb.sheet(bandung).setSheetProps({ name: 'Bandung' });
wb.setValues('Bandung', 'A2', 98000000);
const rekap: string = wb.addSheet('Rekap');                     // sheet baru di belakang: mengembalikan id
wb.setValues(rekap, 'A1', [['Total omzet', '=Jakarta!A2+Bandung!A2']]);
wb.moveSheet(rekap, 0);                                         // Rekap jadi tab pertama
console.log('sheet         :', daftar());
console.log('total         :', wb.value('Rekap', 'B1'));

wb.setSheetProps('Bandung', { name: 'Bandung Kota' });           // ganti nama: rumus ikut, karena rumus menyimpan id
console.log('rumus Rekap   :', wb.input('Rekap', 'B1'));

wb.hideSheet('Jakarta', true);                                  // tab disembunyikan, tetap dihitung
console.log('sembunyikan   :', daftar(), '| total', wb.value('Rekap', 'B1'));

wb.removeSheet('Bandung Kota');                                 // dihapus: rumus yang membacanya #REF!
const total = wb.value('Rekap', 'B1');
console.log('hapus         :', daftar(), '|', isError(total) ? total.code : total);
wb.undo();                                                      // undo mengembalikan sheet beserta isinya
console.log('undo          :', daftar(), '| total', wb.value('Rekap', 'B1'));
