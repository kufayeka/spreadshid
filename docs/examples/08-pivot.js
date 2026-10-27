import { createWorkbook } from '@kufayeka/sheet/core';
import { penjualan, KOLOM_PENJUALAN, barisPenjualan } from './data/toko.js';

// Tiga pivot table dari 300 transaksi Oktober, di sheet Analisa. Data berubah, pivot ikut.
export function buatAnalisa() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const jual = wb.sheet('Sheet1');
    jual.setSheetProps({ name: 'Penjualan' });
    jual.setValues('A1', [KOLOM_PENJUALAN]);
    jual.setValues('A2', barisPenjualan(penjualan(300), 2));
    jual.setColProps('B', { format: { type: 'date' } });

    const an = wb.sheet(wb.addSheet('Analisa'));
    // 1. omzet per kategori dan cabang, kategori dengan omzet terbesar di atas
    an.addPivot('A1', 'Penjualan!A1:K301', {
        rows: ['Kategori'], columns: ['Cabang'],
        values: [{ field: 'Total', fn: 'SUM', as: 'Omzet' }],
        sort: { Kategori: { by: 'Omzet', dir: 'desc' } }
    });
    // 2. per minggu: omzet, jumlah transaksi, rata-rata per transaksi
    an.addPivot('G1', 'Penjualan!A1:K301', {
        rows: ['Tanggal'], group: { Tanggal: 'week' },
        values: [{ field: 'Total', as: 'Omzet' }, { field: 'No', fn: 'COUNT', as: 'Transaksi' }, { field: 'Total', fn: 'AVERAGE', as: 'Rata-rata' }]
    });
    // 3. sales per cabang, tanpa Surabaya, sales terbaik di atas dalam cabangnya
    an.addPivot('L1', 'Penjualan!A1:K301', {
        rows: ['Cabang', 'Sales'], values: [{ field: 'Total', as: 'Omzet' }, { field: 'Produk', fn: 'COUNTUNIQUE', as: 'Jenis produk' }],
        filters: { Cabang: { hidden: ['Surabaya'] } }, sort: { Sales: { by: 'Omzet', dir: 'desc' } }
    });
    an.setColProps('B:E', { format: { type: 'money', decimals: 0 }, width: 120 });
    an.setColProps('H', { format: { type: 'money', decimals: 0 }, width: 120 });
    an.setColProps('J', { format: { type: 'money', decimals: 0 }, width: 120 });
    an.setColProps('N', { format: { type: 'money', decimals: 0 }, width: 120 });
    an.setColProps('A', { width: 110 });
    return wb;
}

const wb = buatAnalisa();
const an = wb.sheet('Analisa');
const tabel = (a1, a2) => {
    const [c1, r1] = [a1.charCodeAt(0) - 65, Number(a1.slice(1)) - 1], [c2, r2] = [a2.charCodeAt(0) - 65, Number(a2.slice(1)) - 1];
    for (let r = r1; r <= r2; r++) {
        const row = [];
        for (let c = c1; c <= c2; c++) { const d = an.display(r, c).text; row.push(c === c1 ? d.padEnd(14) : d.padStart(16)); }
        console.log('  ' + row.join(''));
    }
};
console.log('1. kategori x cabang:'); tabel('A1', 'E9');
console.log('2. per minggu:'); tabel('G1', 'J7');
console.log('3. sales:'); tabel('L1', 'O7');

// pivot ditulis sebagai nilai biasa: rumus bisa membacanya
an.setValues('A12', [['Kategori teratas', '=A2'], ['Pangsa', '=E2/E9']]);
an.setStyle('B13', { format: { type: 'percent', decimals: 1 } });
console.log('rumus membaca pivot :', an.value('B12'), an.display('B13').text);

// data berubah: pivot dihitung ulang setelah perubahan itu
wb.setValues('Penjualan', 'H2', 2000);                   // transaksi 1: semen, 2000 zak
console.log('Qty semen jadi 2000 :', [2, 3, 4].map((r) => an.value('A' + r)).join(', '), '| teratas', an.value('B12'), an.display('B13').text);
// sel pivot dikunci untuk orang: diubah lewat editornya, bukan diketik
const ditolak = [];
wb.on('reject', (e) => ditolak.push(e.reason));
an.setValues('B3', 1, { source: 'user' });
console.log('diketik di pivot    :', ditolak[0]);

// spesifikasi bisa diubah dari kode: per bulan, bukan per minggu
const kedua = an.pivots()[1].id;
an.setPivot(kedua, { spec: { ...an.pivots()[1].spec, group: { Tanggal: 'month' } } });
console.log('per bulan           :', an.value('G2'), an.display('H2').text, '| pivot di sheet ini:', an.pivots().length);
an.removePivot(kedua);
console.log('pivot dihapus       :', an.pivots().length, 'tersisa, G3 sekarang', JSON.stringify(an.value('G3')));
