import { createWorkbook } from '@kufayeka/sheet/core';
import { penjualan, KOLOM_PENJUALAN, barisPenjualan } from './data/toko.js';

// Named range: rumus laporan yang terbaca seperti kalimat. SUBTOTAL: total yang menghormati filter dan tidak terhitung dua kali.
const wb = createWorkbook();
const jual = wb.sheet('Sheet1');
jual.setSheetProps({ name: 'Penjualan' });
jual.setValues('A1', [KOLOM_PENJUALAN]);
jual.setValues('A2', barisPenjualan(penjualan(300), 2));

// ---- nama untuk kolom data, dan untuk satu sel tarif
wb.addName('Cabang', 'Penjualan', 'C2:C301');
wb.addName('Kategori', 'Penjualan', 'G2:G301');
wb.addName('Omzet', 'Penjualan', 'K2:K301');
const lap = wb.sheet(wb.addSheet('Laporan'));
lap.setValues('A1', [
    ['Omzet Bandung', '=SUMIFS(Omzet, Cabang, "Bandung")'],
    ['Omzet semen', '=SUMIFS(Omzet, Kategori, "Semen")'],
    ['Komisi sales', '=ROUND(B1 * Komisi, 0)']
]);
console.log('rumus             :', lap.input('B1'));
console.log('omzet Bandung     :', lap.value('B1'), '| semen', lap.value('B2'));
console.log('komisi (belum ada):', lap.value('B3').code, '<- nama Komisi belum dibuat');
lap.setValues('D1', [['Tarif komisi', 0.015]]);
wb.addName('Komisi', 'Laporan', 'E1');
console.log('komisi            :', lap.value('B3'), '<- rumus jalan begitu namanya ada');

// ---- nama diganti: semua rumus ikut menulis nama baru. Range-nya diperluas: semua rumus ikut menghitung baris baru
const id = wb.names().find((n) => n.name === 'Omzet').id;
wb.setName(id, { name: 'Total' });
console.log('ganti nama        :', lap.input('B1'));
jual.setValues('A302', barisPenjualan([{ No: 301, Tanggal: 46325, Cabang: 'Bandung', Sales: 'Asep', Kode: 'PSR-01', Produk: 'Pasir beton', Kategori: 'Pasir', Qty: 10, Harga: 290000, Diskon: 0 }], 302));
wb.setName(id, { range: 'K2:K302' });
wb.setName(wb.names().find((n) => n.name === 'Cabang').id, { range: 'C2:C302' });
wb.setName(wb.names().find((n) => n.name === 'Kategori').id, { range: 'G2:G302' });   // range yang dipakai bersama di SUMIFS harus sama panjang
console.log('baris baru masuk  :', lap.value('B1'), '(+2.900.000)');
console.log('semua nama        :', wb.names().map((n) => n.name + ' = ' + n.ref).join(', '));
console.log('nama tidak boleh  :', JSON.stringify(wb.nameProblem('A1')), '|', JSON.stringify(wb.nameProblem('Total')));

// ---- SUBTOTAL: kelompok kategori di sheet Rekap, total per kelompok, total akhir yang tidak menghitung subtotal
const rekap = wb.sheet(wb.addSheet('Rekap'));
rekap.setValues('A1', [
    ['Kategori / cabang', 'Omzet'],
    ['Semen', '=SUBTOTAL(9, B3:B5)'],
    ['  Jakarta', '=SUMIFS(Total, Kategori, "Semen", Cabang, "Jakarta")'],
    ['  Bandung', '=SUMIFS(Total, Kategori, "Semen", Cabang, "Bandung")'],
    ['  Surabaya', '=SUMIFS(Total, Kategori, "Semen", Cabang, "Surabaya")'],
    ['Besi', '=SUBTOTAL(9, B7:B9)'],
    ['  Jakarta', '=SUMIFS(Total, Kategori, "Besi", Cabang, "Jakarta")'],
    ['  Bandung', '=SUMIFS(Total, Kategori, "Besi", Cabang, "Bandung")'],
    ['  Surabaya', '=SUMIFS(Total, Kategori, "Besi", Cabang, "Surabaya")'],
    ['Semen + besi', '=SUBTOTAL(9, B2:B9)'],
    ['SUM biasa', '=SUM(B2:B9)']
]);
console.log('SUBTOTAL vs SUM   :', rekap.value('B10'), 'vs', rekap.value('B11'), '<- SUM menghitung subtotal dua kali');

// baris yang disembunyikan: 9 tetap menghitungnya, 109 tidak. Baris yang disaring filter tidak dihitung keduanya
rekap.setRowProps('4', { hidden: true });
rekap.setValues('C10', [['=SUBTOTAL(109, B2:B9)']]);
console.log('Bandung semen disembunyikan :', rekap.value('B10'), '(9) |', rekap.value('C10'), '(109)');
rekap.setRowProps('4', { hidden: null });
rekap.createFilter('A1:B9');
rekap.setFilterColumn('A', { hidden: ['  Surabaya'] });
console.log('filter tanpa Surabaya       :', rekap.value('B10'), '(9) |', rekap.value('C10'), '(109)');
