import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { PROGRES } from './data/proyek.js';

// 12.7 Bullet: progres aktual setiap proyek (bar) terhadap rencananya (garis hitam), warnanya menurut deviasi.
function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID' });
    const s = wb.sheet('Sheet1');
    s.setSheetProps({ name: 'Progres' });
    s.setValues('A1', [['Proyek', 'Minggu', 'Aktual', 'Rencana'], ...PROGRES]);
    s.setColProps('A', { width: 140 });
    s.setColProps('C:D', { format: { type: 'percent', decimals: 2 } });
    s.setStyle('A1:D1', { bold: true, fill: '#eef2f7' });
    s.addChart({
        at: 'F1:L18', data: 'A1:D8', type: 'bullet', title: 'Progres per proyek', subtitle: 'merah: terlambat lebih dari 5%, kuning: lebih dari 1%',
        // baru: seri pertama (Minggu) disembunyikan; Aktual jadi bar, Rencana jadi garis target
        series: [{ hidden: true }], warn: 1, bad: 5
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
