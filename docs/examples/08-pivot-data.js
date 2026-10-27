import { createWorkbook, tableOf, pivot, PIVOT_FUNCTIONS } from '@kufayeka/sheet/core';
import { penjualan, KOLOM_PENJUALAN, barisPenjualan } from './data/toko.js';

// pivot() tanpa sheet: data dari database atau API langsung diringkas, misalnya di server untuk laporan harian yang dikirim lewat email.
const dariDatabase = penjualan(300).map((r) => ({ ...r, Total: r.Qty * r.Harga * (1 - r.Diskon) }));
const p = pivot(dariDatabase, {
    rows: ['Kategori'], columns: ['Tanggal'], group: { Tanggal: 'month' },
    values: [{ field: 'Total', as: 'Omzet' }, { field: 'Qty', fn: 'SUM', as: 'Qty' }],
    sort: { Kategori: { by: 'Omzet', dir: 'desc' } }
});
console.log('tabel jadi (cells), baris judul', p.header + ':');
for (const row of p.cells.slice(0, 4)) console.log('  ' + row.map((x) => String(x ?? '').padStart(12)).join(''));
console.log('  ...', p.cells.length, 'baris');

// atau dibaca per angka: value(baris, kolom, nomor value)
console.log('omzet semen Oktober :', p.value(['Semen'], ['2026-10'], 0));
console.log('qty semua           :', p.value([], [], 1));
console.log('grup baris          :', p.rowKeys.map((k) => k[0]).join(', '));

// tableOf: sheet dibaca sebagai daftar record (baris pertama = nama field), lalu diringkas dengan pivot yang sama
const wb = createWorkbook();
wb.setValues('Sheet1', 'A1', [KOLOM_PENJUALAN]);
wb.setValues('Sheet1', 'A2', barisPenjualan(penjualan(300), 2));
const { fields, records } = tableOf(wb, 'Sheet1', 'A1:K301');
console.log('field               :', fields.join(', '));
console.log('record pertama      :', JSON.stringify(records[0]));
const perSales = pivot(records, { rows: ['Sales'], values: [{ field: 'Total', fn: 'MEDIAN', as: 'Median' }], sort: { Sales: { by: 'Median', dir: 'desc' } }, totals: false });
console.log('median per sales    :', perSales.cells.slice(1).map((r) => r[0] + ' ' + r[1]).join(' | '));
console.log('fungsi              :', Object.keys(PIVOT_FUNCTIONS).join(', '));
