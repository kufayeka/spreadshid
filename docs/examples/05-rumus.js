import { createWorkbook, fillBlock } from '@kufayeka/sheet/core';
import { PRODUK, KOLOM_PRODUK } from './data/toko.js';

// Nota penjualan yang mengambil harga dari sheet Produk dan tarif PPN dari sheet Pengaturan.
// now: jam untuk TODAY() dan NOW(), dipatok supaya hasil contoh ini selalu sama
const wb = createWorkbook(null, { now: () => new Date(2026, 9, 27, 9, 30) });
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

const produk = wb.sheet(wb.addSheet('Produk'));
produk.setValues('A1', [KOLOM_PRODUK, ...PRODUK]);
const atur = wb.sheet(wb.addSheet('Pengaturan'));
atur.setValues('A1', [['PPN', 0.11], ['Jatuh tempo (hari)', 14]]);

const nota = wb.sheet('Sheet1');
nota.setSheetProps({ name: 'Nota' });
nota.setValues('A1', [
    ['Kode', 'Produk', 'Qty', 'Harga', 'Jumlah', 'PPN'],
    ['SMN-01', '=XLOOKUP(A2, Produk!$A$2:$A$13, Produk!$B$2:$B$13, "?")', 40, '=XLOOKUP(A2, Produk!$A:$A, Produk!$F:$F)', '=C2*D2', '=E2*Pengaturan!$B$1']
]);
nota.setValues('A3', [['BSI-13', null, 25], ['CAT-05', null, 6], ['XXX-99', null, 1]]);

// fill handle dari kode: rumus diulang ke bawah. Bagian tanpa $ ikut bergeser, yang ber-$ tetap. Kolom Qty (C) tidak ikut, karena angka
// yang di-fill menjadi deret (40, 41, 42), sama seperti menarik fill handle di layar
fillBlock(wb, 'Nota', 'B2', 'B3:B5', 'down');
fillBlock(wb, 'Nota', 'D2:F2', 'D3:F5', 'down');
console.log('rumus B3      :', nota.input('B3'));
console.log('rumus F4      :', nota.input('F4'));
console.log('produk        :', [2, 3, 4, 5].map((r) => nota.value('B' + r)).join(' | '));
console.log('jumlah        :', [2, 3, 4, 5].map((r) => { const v = nota.value('E' + r); return v.code || v; }).join(' | '));

nota.setValues('A7', [
    ['Subtotal', null, null, null, '=SUMIF(A2:A5, "<>XXX-99", E2:E5)'],
    ['PPN', null, null, null, '=ROUND(E7*Pengaturan!B1, 0)'],
    ['Total', null, null, null, '=E7+E8'],
    ['Ringkas', '="Total " & ROUND(E9/1000000, 1) & " juta, " & COUNTIF(D2:D5, ">0") & " barang"'],
    ['Tanggal', '=TODAY()', 'Jatuh tempo', '=B11+Pengaturan!B2', 'Sisa hari', '=D11-TODAY()']
]);
console.log('subtotal      :', nota.value('E7'), '| PPN', nota.value('E8'), '| total', nota.value('E9'));
console.log('teks          :', nota.value('B10'));
console.log('tanggal       :', nota.value('B11'), '(27 Okt 2026) | jatuh tempo', nota.value('D11'), '| sisa', nota.value('F11'), 'hari');

// sheet diganti nama, tarif PPN diubah: semua rumus ikut
wb.setSheetProps('Pengaturan', { name: 'Atur Toko' });
atur.setValues('B1', 0.12);
console.log('setelah ubah  :', nota.input('E8'), '=', nota.value('E8'));
