import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// 12.3 Chart pertama: penjualan bahan per bulan sebagai chart kolom, menempel di sel E2:K16.
function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const s = wb.sheet('Sheet1');
    s.setSheetProps({ name: 'Penjualan' });
    s.setValues('A1', [
        ['Bulan', 'Semen (zak)', 'Besi (batang)'],
        ['Mei', 182, 96], ['Jun', 205, 110], ['Jul', 171, 124], ['Agu', 226, 131], ['Sep', 244, 118], ['Okt', 263, 142]
    ]);
    s.setStyle('A1:C1', { bold: true, fill: '#eef2f7' });
    s.setColProps('B:C', { width: 110 });
    // baru: chart di sel E2:K16 yang membaca A1:C7
    s.addChart({ at: 'E2:K16', data: 'A1:C7', type: 'column', title: 'Penjualan per bulan' });
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buat);
    return <div style={{ height: 710 }}><Sheet workbook={wb} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
