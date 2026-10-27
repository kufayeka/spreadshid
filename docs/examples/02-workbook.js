import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const sh = wb.sheet('Sheet1');

sh.setValues('A1', [
    ['Volume', 'Harga', 'Jumlah'],
    [12.5, 85000, '=A2*B2']
]);
sh.setStyle('B2:C2', { format: { type: 'money', decimals: 0 } });

console.log('ukuran      :', sh.size());
console.log('value(C2)   :', sh.value('C2'));          // nilai sebenarnya
console.log('input(C2)   :', sh.input('C2'));          // yang muncul saat sel diedit
console.log('display(C2) :', sh.display('C2').text);   // yang tampil di sel

// teks dibaca seperti diketik orang, pakai locale workbook (id-ID)
sh.setValues('A2', '1.250,5');
console.log('A2 sekarang :', sh.value('A2'), '->', sh.display('C2').text);

// cara yang sama dengan angka (baris dan kolom mulai dari 0)
const [s] = wb.sheetIds();
console.log('pakai angka :', wb.value(s, 1, 2));
