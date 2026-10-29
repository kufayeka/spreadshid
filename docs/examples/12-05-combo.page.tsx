import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { TERMIN } from './data/proyek.js';

// 12.5 Kolom dan garis dengan dua sumbu: tagihan termin per bulan (kiri, juta) dan progres kumulatif (kanan, persen).
function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const s = wb.sheet('Sheet1');
    s.setSheetProps({ name: 'Termin' });
    s.setValues('A1', [['Bulan', 'Tagihan (juta)', 'Progres kumulatif'], ...TERMIN]);
    s.setColProps('B:C', { width: 120 });
    s.setColProps('C', { width: 120, format: { type: 'percent', decimals: 1 } });
    s.setStyle('A1:C1', { bold: true, fill: '#eef2f7' });
    s.addChart({
        at: 'E1:L18', data: 'A1:C13', type: 'combo', title: 'Termin Legundi', subtitle: 'tagihan per bulan dan progres kumulatif', smooth: true,
        // baru: seri kedua digambar sebagai garis, di sumbu kanan
        series: [{ color: '#1192e8' }, { type: 'line', axis: 'right', color: '#6929c4' }]
    });
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buat);
    return <div style={{ height: 560 }}><Sheet workbook={wb} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
