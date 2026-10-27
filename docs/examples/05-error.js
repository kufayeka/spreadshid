import { createWorkbook, isError } from '@kufayeka/sheet/core';

// Semua error rumus, dari mana datangnya, dan cara menangkapnya.
const wb = createWorkbook();
const s = wb.sheet('Sheet1');
s.setValues('A1', [
    ['Omzet', 0, 'Transaksi', 0],
    ['Rata-rata', '=B1/D1', '', '=IFERROR(B1/D1, 0)'],
    ['Kode', '=VLOOKUP("ZZZ-00", A1:B1, 2, FALSE)', '', '=IFNA(VLOOKUP("ZZZ-00", A1:B1, 2, FALSE), "tidak dijual")'],
    ['Teks x angka', '="dua" * 3', '', '=IF(ISNUMBER(A4), A4 * 3, "bukan angka")'],
    ['Akar negatif', '=SQRT(-4)'],
    ['Nama salah', '=SUMM(B1:B2)'],
    ['Melingkar', '=C7 + 1', '=B7 * 2'],
    ['Membaca B7', '=B7']
]);
for (let r = 2; r <= 8; r++) {
    const v = s.value('B' + r);
    console.log(String(s.value('A' + r)).padEnd(13), s.input('B' + r).padEnd(36), isError(v) ? v.code : v, s.value('D' + r) !== null ? '| tertangkap: ' + s.value('D' + r) : '');
}

// error menjalar ke rumus yang membacanya, dan hilang sendiri begitu sebabnya hilang
s.setValues('B10', '=B2 + 100');
console.log('menjalar      :', s.value('B10').code);
s.setValues('D1', 4);
console.log('sebab hilang  :', s.value('B2'), '|', s.value('B10'));

// #REF!: sel yang dibaca dihapus
s.setValues('F1', [[5, '=F1*2']]);
s.deleteCols('F');
console.log('kolom dihapus :', s.input('F1'), '=', s.value('F1').code);
