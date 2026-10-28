import { createWorkbook } from '@kufayeka/sheet/core';
import type { Settings } from '@kufayeka/sheet/core';

// Pelajaran 8: pengaturan workbook. Locale dan mata uang mengubah cara angka ditampilkan dan dibaca, tidak mengubah nilainya.
const wb = createWorkbook();
const s = wb.sheet('Sheet1');
s.setValues('A1', [[1250000, 46322]]);
s.setStyle('A1', { format: { type: 'money', decimals: 0 } });
s.setStyle('B1', { format: { type: 'date' } });

const tampil = () => s.display('A1').text + ' | ' + s.display('B1').text;
console.log('bawaan      :', JSON.stringify(wb.settings()), '->', tampil());

wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
console.log('id-ID, IDR  :', tampil());

// yang diketik orang juga dibaca menurut locale
s.setValues('C1', '72.500', { source: 'user' });
console.log('ketik 72.500:', s.value('C1'), '(angka)');

const sekarang: Settings = wb.settings();
console.log('settings    :', JSON.stringify(sekarang), '| nilai A1 tetap', s.value('A1'));
wb.undo(); wb.undo();
console.log('dua undo    :', JSON.stringify(wb.settings()));
