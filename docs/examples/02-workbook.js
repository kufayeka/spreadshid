import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const [s] = wb.sheetIds(); // id sheet pertama
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

// baris 0, kolom 0 = sel A1; satu array per baris
wb.setValues(s, 0, 0, [
    ['Volume', 'Harga', 'Jumlah'],
    [12.5, 85000, '=A2*B2']
]);
wb.setStyle(s, { r1: 1, c1: 1, r2: 1, c2: 2 }, { format: { type: 'money', decimals: 0 } });

console.log('nama sheet  :', wb.sheetProps(s).name);
console.log('ukuran      :', wb.size(s));
console.log('value(C2)   :', wb.value(s, 1, 2));          // nilai sebenarnya (angka)
console.log('input(C2)   :', wb.input(s, 1, 2));          // yang terlihat saat sel diedit
console.log('display(C2) :', wb.display(s, 1, 2).text);   // yang tampil di sel

// teks diketik seperti orang mengetik, dibaca dengan locale workbook (id-ID)
wb.setValues(s, 1, 0, '1.250,5');
console.log('A2 sekarang :', wb.value(s, 1, 0), '->', wb.display(s, 1, 2).text);
