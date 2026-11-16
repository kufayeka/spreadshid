import { createWorkbook } from '@kufayeka/sheet/core';
import { tabelSheet } from './data/cetak.js';

// 14.17 Penjual di marketplace. Data: pesanan satu bulan, satu baris per pesanan.
// Tiga pertanyaan, tiga jenis filter (Excel: Label Filters, Value Filters, Top 10):
//   a. "Berapa penjualan semua produk kaos?"                       -> kondisi label: Produk mengandung "kaos"
//   b. "Produk mana yang omzetnya lebih dari 1 juta?"              -> kondisi nilai: Omzet > 1.000.000
//   c. "Tiga produk terlaris paruh pertama bulan ini?"             -> top 3 menurut Qty, dan tanggal di antara 1 dan 15
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

const pesanan = wb.sheet('Sheet1');
pesanan.setSheetProps({ name: 'Pesanan' });
pesanan.setValues('A1', [
    ['Tanggal',    'Produk',            'Qty', 'Omzet'],
    ['2026-10-02', 'Kaos polos hitam',   12,    600000],
    ['2026-10-04', 'Kemeja flanel',       3,    540000],
    ['2026-10-06', 'Kaos polos putih',   10,    500000],
    ['2026-10-09', 'Celana jogger',       6,    720000],
    ['2026-10-12', 'Kaos oversize',       8,    640000],
    ['2026-10-14', 'Topi baseball',       9,    405000],
    ['2026-10-18', 'Celana jogger',       5,    600000],
    ['2026-10-21', 'Kemeja flanel',       4,    720000],
    ['2026-10-25', 'Kaos polos hitam',    7,    350000],
    ['2026-10-29', 'Topi baseball',       2,     90000]
]);
const DATA = 'Pesanan!A1:D11';
const hasil = wb.sheet(wb.addSheet('Hasil'));
hasil.setColProps('C', { format: { type: 'money', decimals: 0 } });
hasil.setColProps('G', { format: { type: 'money', decimals: 0 } });
hasil.setColProps('K', { format: { type: 'money', decimals: 0 } });

// a. kondisi label: hanya produk yang namanya mengandung "kaos" (huruf besar atau kecil sama saja)
hasil.addPivot('A1', DATA, {
    rows: ['Produk'],
    values: [{ field: 'Qty', as: 'Qty' }, { field: 'Omzet', as: 'Omzet' }],
    filters: { Produk: { label: { op: 'contains', value: 'kaos' } } }
});
// b. kondisi nilai: hanya produk yang total Omzet-nya lebih dari 1 juta (dihitung per produk, bukan per pesanan)
hasil.addPivot('E1', DATA, {
    rows: ['Produk'],
    values: [{ field: 'Qty', as: 'Qty' }, { field: 'Omzet', as: 'Omzet' }],
    filters: { Produk: { value: { by: 'Omzet', op: '>', value: 1000000 } } }
});
// c. dua filter sekaligus: tanggal 1 sampai 15 Oktober (kondisi label pada tanggal), lalu tiga produk dengan Qty terbanyak
hasil.addPivot('I1', DATA, {
    rows: ['Produk'],
    values: [{ field: 'Qty', as: 'Qty' }, { field: 'Omzet', as: 'Omzet' }],
    filters: {
        Tanggal: { label: { op: 'between', value: '2026-10-01', to: '2026-10-15' } },
        Produk: { top: { n: 3, by: 'Qty' } }
    },
    sort: { Produk: { by: 'Qty', dir: 'desc' } }
});

console.log('**a. Produk mengandung "kaos"**\n');
console.log(tabelSheet(hasil, 'A1:C5'));
console.log('\n**b. Omzet di atas Rp 1 juta**\n');
console.log(tabelSheet(hasil, 'E1:G4'));
console.log('\n**c. Tiga terlaris, 1–15 Oktober**\n');
console.log(tabelSheet(hasil, 'I1:K5'));
