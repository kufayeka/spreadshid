import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const nama = () => wb.sheetIds().map((s) => wb.sheetProps(s).name + (wb.sheetProps(s).hidden ? ' (tersembunyi)' : '')).join(', ');

wb.setSheetProps('Sheet1', { name: 'BOQ' });
const harga = wb.addSheet('Harga');         // id sheet baru
const salinan = wb.duplicateSheet(harga);   // "Copy of Harga"
wb.moveSheet(salinan, 0);                   // pindah ke paling depan
wb.hideSheet(harga, true);
console.log('sheet  :', nama());

wb.removeSheet(salinan);
wb.removeSheet('Harga');
console.log('sisa   :', nama());
try { wb.removeSheet('BOQ'); } catch (err) { console.log('error  :', err.message); }
