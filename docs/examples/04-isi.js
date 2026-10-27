import { createWorkbook } from '@kufayeka/sheet/core';
import { PRODUK, KOLOM_PRODUK } from './data/toko.js';

// Daftar stok toko bangunan: isi sel, rumus per baris, membaca kembali.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const stok = wb.sheet('Sheet1');
stok.setSheetProps({ name: 'Stok' });

// judul kolom + satu baris per produk; kolom I dan J dihitung
stok.setValues('A1', [[...KOLOM_PRODUK, 'Nilai stok', 'Margin']]);
stok.setValues('A2', PRODUK.map((p, i) => [...p, `=E${i + 2}*G${i + 2}`, `=(F${i + 2}-E${i + 2})/F${i + 2}`]));
const akhir = PRODUK.length + 1;
stok.setColProps('E:F', { format: { type: 'money', decimals: 0 } });   // harga beli dan jual
stok.setColProps('I', { format: { type: 'money', decimals: 0 } });     // nilai stok
stok.setColProps('J', { format: { type: 'percent', decimals: 1 } });   // margin

// banyak sel sekaligus, isi dan gaya, sebagai satu perubahan
stok.setBlock([
    { at: `H${akhir + 2}`, value: 'Total nilai stok', style: { bold: true } },
    { at: `I${akhir + 2}`, value: `=SUM(I2:I${akhir})`, style: { bold: true, format: { type: 'money', decimals: 0 } } },
    { at: `H${akhir + 3}`, value: 'Produk habis', style: { bold: true } },
    { at: `I${akhir + 3}`, value: `=COUNTIF(G2:G${akhir}, 0)`, style: { bold: true } }
]);

console.log('nilai stok semen :', stok.value('I2'), '| tampil:', stok.display('I2').text);
console.log('total nilai stok :', stok.display(`I${akhir + 2}`).text);
console.log('produk habis     :', stok.value(`I${akhir + 3}`));
console.log('isi I2 (rumus)   :', stok.input('I2'), '| margin:', stok.display('J2').text);
console.log('terisi sampai    :', stok.lastFilled(), '=', wb.address(stok.lastFilled().r, stok.lastFilled().c));

// membaca baris demi baris: produk yang stoknya di bawah minimum
const kurang = [];
stok.forEachFilledRow((r) => {
    if (r === 0 || r >= akhir) return;
    if (stok.value(r, 6) < stok.value(r, 7)) kurang.push(stok.value(r, 1) + ' (' + stok.value(r, 6) + '/' + stok.value(r, 7) + ')');
});
console.log('perlu dipesan    :', kurang.join(', '));

// mengosongkan isi (gaya tetap), lalu undo
stok.clear('G9');
console.log('setelah clear G9 :', stok.value('G9'), '| produk habis:', stok.value(`I${akhir + 3}`));
wb.undo();
console.log('setelah undo     :', stok.value('G9'), '| produk habis:', stok.value(`I${akhir + 3}`));
