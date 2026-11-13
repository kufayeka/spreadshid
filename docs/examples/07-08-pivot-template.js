import { createWorkbook, populate, tableOf, pivot } from '@kufayeka/sheet/core';

// Template laporan dengan sumber data dinamis dari API + Pivot Table di sheet terpisah
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

const data = wb.sheet('Sheet1');
data.setSheetProps({ name: 'Transaksi' });
data.setValues('A1', [['Cabang', 'Kategori', 'Total']]);
data.setStyle('A1:C1', { bold: true, fill: '#eef2f7' });

const ringkasan = wb.sheet(wb.addSheet('Ringkasan'));
// Gunakan range ber-buffer (misal 'Transaksi!A1:C100') atau Named Range agar baris baru dari populate() otomatis masuk ke pivot
ringkasan.addPivot('A1', 'Transaksi!A1:C100', {
    rows: ['Cabang'],
    columns: ['Kategori'],
    values: [{ field: 'Total', fn: 'SUM', as: 'Omzet' }],
    totals: true,
});

// Simulasi data masuk dari REST API setelah template dibuka
populate(wb, 'Transaksi', { at: 'A2', fields: ['Cabang', 'Kategori', 'Total'], header: false }, [
    { Cabang: 'Jakarta', Kategori: 'Semen', Total: 720000 },
    { Cabang: 'Bandung', Kategori: 'Semen', Total: 360000 },
    { Cabang: 'Jakarta', Kategori: 'Cat', Total: 290000 },
]);

// Pivot ikut tersimpan di JSON template/dokumen (di dalam sheet.props.pivots)
const saved = wb.toJSON();
const reopened = createWorkbook(saved);
const r = reopened.sheet('Ringkasan');
console.log('Pivot tersimpan di JSON:', saved.sheets[1].props.pivots.length, 'pivot');
console.log('Grand Total Jakarta:', r.value('D3'), '| Total Semua:', r.value('D4'));

// Agregasi multi-file di server: gabungkan records dari banyak workbook lewat tableOf() + pivot()
const gabungan = [
    ...tableOf(wb, 'Transaksi', 'A:C').records,
    { Cabang: 'Surabaya', Kategori: 'Semen', Total: 500000 },
];
const hasilServer = pivot(gabungan, { rows: ['Cabang'], values: [{ field: 'Total', fn: 'SUM' }] });
console.log('Agregasi server:', hasilServer.rows.map((row) => row.cells.join(':')).join(', '));
