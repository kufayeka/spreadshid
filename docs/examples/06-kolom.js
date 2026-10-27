import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const sh = wb.sheet('Sheet1');
sh.setValues('A1', [['Pekerjaan', 'Volume', 'Satuan', 'Harga'], ['Galian', 120, 'm3', 85000], ['Besi', 2400, 'kg', 14500]]);

// format di kolom: berlaku untuk semua sel kolom itu yang tidak punya format sendiri
sh.setColProps('D', { format: { type: 'money', decimals: 0 } });
// satuan diambil dari kolom lain di baris yang sama
sh.setColProps('B', { format: { type: 'number', decimals: 0, suffixFrom: sh.colId(2) } });
console.log('B2, B3 :', sh.display('B2').text, '|', sh.display('B3').text);
console.log('D2, D3 :', sh.display('D2').text, '|', sh.display('D3').text);
sh.setValues('D4', 99000);
console.log('D4 baru:', sh.display('D4').text, '(ikut format kolom)');
