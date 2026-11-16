import { createWorkbook } from '@kufayeka/sheet/core';
import { tabelSheet } from './data/cetak.js';

// 14.8 Bagian keuangan. Data: jurnal pengeluaran setahun, satu baris per transaksi.
// Pertanyaan direktur: "Berapa pengeluaran tiap departemen per kuartal, dirinci per jenis biaya, dengan subtotal per departemen?"
// Dua tingkat baris (Departemen, lalu Akun di dalamnya) menghasilkan subtotal per departemen dengan sendirinya.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

const jurnal = wb.sheet('Sheet1');
jurnal.setSheetProps({ name: 'Jurnal' });
jurnal.setValues('A1', [
    ['Tanggal',    'Departemen', 'Akun',        'Jumlah'],
    ['2026-01-15', 'Pemasaran',  'Iklan',       12000000],
    ['2026-02-03', 'Pemasaran',  'Perjalanan',   3500000],
    ['2026-03-20', 'IT',         'Lisensi',      8000000],
    ['2026-04-11', 'Pemasaran',  'Iklan',       15000000],
    ['2026-05-07', 'IT',         'Perangkat',   22000000],
    ['2026-06-25', 'IT',         'Lisensi',      8000000],
    ['2026-07-14', 'Pemasaran',  'Perjalanan',   4200000],
    ['2026-08-02', 'Pemasaran',  'Iklan',        9000000],
    ['2026-09-30', 'IT',         'Perangkat',    6500000],
    ['2026-10-19', 'Pemasaran',  'Iklan',       18000000],
    ['2026-11-05', 'IT',         'Lisensi',      8000000],
    ['2026-12-12', 'Pemasaran',  'Perjalanan',   5100000]
]);

const laporan = wb.sheet(wb.addSheet('Per kuartal'));
laporan.addPivot('A1', 'Jurnal!A1:D13', {
    rows: ['Departemen', 'Akun'],                        // dua tingkat: departemen, lalu akun di dalamnya
    columns: ['Tanggal'],
    group: { Tanggal: 'quarter' },                       // 2026-Q1 ... 2026-Q4
    values: [{ field: 'Jumlah', fn: 'SUM' }],
    totals: true                                         // subtotal tiap departemen dan grand total
});
laporan.setColProps('C:G', { format: { type: 'money', decimals: 0 } });

console.log(tabelSheet(laporan, 'A1:G8'));
