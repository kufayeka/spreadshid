import { createWorkbook, findAll, replaceIn } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const sh = wb.sheet('Sheet1');
sh.setValues('A1', [['Beton K-300', '=B1*2'], ['beton K-250', 5], ['Besi', 'Beton']]);

const alamat = (list) => list.map((p) => wb.address(p.r, p.c)).join(', ');
console.log('"beton"                :', alamat(findAll(wb, 'Sheet1', 'beton')));
console.log('huruf besar-kecil sama :', alamat(findAll(wb, 'Sheet1', 'beton', { matchCase: true })));
console.log('seluruh isi sel        :', alamat(findAll(wb, 'Sheet1', 'beton', { wholeCell: true })));
console.log('regex                  :', alamat(findAll(wb, 'Sheet1', 'K-\\d+', { regex: true })));
console.log('di dalam rumus         :', alamat(findAll(wb, 'Sheet1', 'B1', { inFormulas: true })));

const hasil = findAll(wb, 'Sheet1', 'K-300');
replaceIn(wb, 'Sheet1', hasil, 'K-300', 'K-350');
console.log('setelah ganti          :', sh.value('A1'));
