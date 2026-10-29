import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { penjualan, KOLOM_PENJUALAN, barisPenjualan } from './data/toko.js';

// 5.11 Named range: range diberi nama, sehingga rumus laporan terbaca seperti kalimat.
function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const jual = wb.sheet('Sheet1');
    jual.setSheetProps({ name: 'Penjualan' });
    jual.setValues('A1', [KOLOM_PENJUALAN]);
    jual.setValues('A2', barisPenjualan(penjualan(300), 2));

    // baru: tiga nama untuk tiga kolom data
    wb.addName('Cabang', 'Penjualan', 'C2:C301');
    wb.addName('Kategori', 'Penjualan', 'G2:G301');
    wb.addName('Omzet', 'Penjualan', 'K2:K301');

    const lap = wb.sheet(wb.addSheet('Laporan'));
    lap.setValues('A1', [
        ['Omzet Bandung', '=SUMIFS(Omzet, Cabang, "Bandung")'],              // baru: nama, bukan Penjualan!$K$2:$K$301
        ['Omzet semen', '=SUMIFS(Omzet, Kategori, "Semen")'],
        ['Semen di Bandung', '=SUMIFS(Omzet, Kategori, "Semen", Cabang, "Bandung")']
    ]);
    lap.setColProps('A', { width: 150 });
    lap.setColProps('B', { format: { type: 'money', decimals: 0 }, width: 150 });
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buat);
    return (
        <div style={{ height: 240 }}>
            <Sheet workbook={wb} sheet={wb.sheetIdByName('Laporan') ?? undefined} />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
