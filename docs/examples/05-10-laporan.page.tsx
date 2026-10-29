import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { penjualan, KOLOM_PENJUALAN, barisPenjualan, CABANG } from './data/toko.js';

// 5.10 Laporan dengan rumus: 300 transaksi di sheet Penjualan, diringkas per cabang di sheet Laporan.
function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const jual = wb.sheet('Sheet1');
    jual.setSheetProps({ name: 'Penjualan' });
    jual.setValues('A1', [KOLOM_PENJUALAN]);
    jual.setValues('A2', barisPenjualan(penjualan(300), 2));     // A2:K301; kolom C cabang, kolom K nilai transaksi

    const lap = wb.sheet(wb.addSheet('Laporan'));
    lap.setValues('A1', [['Cabang', 'Omzet', 'Transaksi', 'Rata-rata', 'Pangsa']]);
    // baru: satu baris rumus per cabang
    lap.setValues('A2', CABANG.map((cabang, i) => {
        const r = i + 2;
        return [cabang,
            `=SUMIFS(Penjualan!$K$2:$K$301, Penjualan!$C$2:$C$301, A${r})`,       // jumlah nilai, hanya baris cabang ini
            `=COUNTIFS(Penjualan!$C$2:$C$301, A${r})`,                             // jumlah transaksi
            `=ROUND(B${r}/C${r}, 0)`,                                              // rata-rata per transaksi
            `=B${r}/SUM($B$2:$B$4)`];                                              // bagian dari total
    }));
    lap.setValues('A5', [['Total', '=SUM(B2:B4)', '=SUM(C2:C4)', '=ROUND(B5/C5, 0)', '=SUM(E2:E4)']]);
    lap.setStyle('A1:E1, A5:E5', { bold: true });
    lap.setStyle('A1:E1', { fill: '#eef2f7' });
    lap.setColProps('B', { format: { type: 'money', decimals: 0 }, width: 150 });
    lap.setColProps('D', { format: { type: 'money', decimals: 0 }, width: 130 });
    lap.setColProps('E', { format: { type: 'percent', decimals: 1 } });
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buat);
    return (
        <div style={{ height: 290 }}>
            <Sheet workbook={wb} sheet={wb.sheetIdByName('Laporan') ?? undefined} />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
