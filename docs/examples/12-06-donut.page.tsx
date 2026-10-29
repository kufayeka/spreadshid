import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { PEKTAM } from './data/proyek.js';

// 12.6 Pie dan donut: status pekerjaan tambah (PEKTAM), dihitung dengan COUNTIF dari tabelnya.
function buat() {
    const wb = createWorkbook();
    const s = wb.sheet('Sheet1');
    s.setSheetProps({ name: 'PEKTAM' });
    s.setValues('A1', [['Pekerjaan', 'Status'], ...PEKTAM.map((p) => [p[0], p[1]])]);
    s.setColProps('A', { width: 220 });
    s.setValues('D1', [['Status', 'Jumlah'], ...['Lunas', 'Retensi blm nagih', 'Submit', 'Cancel'].map((st, i) => [st, '=COUNTIF($B$2:$B$13,D' + (i + 2) + ')'])]);
    s.setColProps('D', { width: 130 });
    s.setStyle('A1:E1', { bold: true, fill: '#eef2f7' });
    const warna = ['#198038', '#f1c21b', '#1192e8', '#a8a8a8'];
    // baru: dua chart dari data yang sama, satu pie dan satu donut
    s.addChart({ at: 'D7:G18', data: 'D1:E5', type: 'pie', title: 'Pie', legend: 'right', labels: true, colors: warna });
    s.addChart({ at: 'H1:L18', data: 'D1:E5', type: 'donut', title: 'PEKTAM menurut status', legend: 'right', centerLabel: 'item', colors: warna });
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
