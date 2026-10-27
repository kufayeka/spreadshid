import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const sh = wb.sheet('Sheet1');
sh.setValues('A1', [[10], [20], ['=SUM(A1:A2)']]);

// tiap baris dan kolom punya id tetap; nomor barisnya bisa berubah
const idBaris = sh.rowId(0);
console.log('id baris pertama :', typeof idBaris, idBaris.length, 'karakter');

sh.insertRows('1', 2); // dua baris baru di atas baris 1
console.log('baris tadi sekarang nomor', sh.rowIndex(idBaris) + 1);
console.log('rumus ikut pindah:', sh.input('A5'), '=', sh.value('A5'));

sh.insertRows('4');    // satu baris di tengah range SUM
sh.setValues('A4', 70);
console.log('range ikut lebar :', sh.input('A6'), '=', sh.value('A6'));
