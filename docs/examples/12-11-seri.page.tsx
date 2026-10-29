import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { PROGRES } from './data/proyek.js';

// 12.11 Seri dari range sendiri: Aktual di kolom C dan Rencana di kolom F, dengan kolom lain di antaranya. Lalu scatter: progres terhadap
// tanggal opname yang jaraknya tidak rata, dari sheet lain.
function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID' });
    const s = wb.sheet('Sheet1');
    s.setSheetProps({ name: 'Progres' });
    s.setValues('A1', [['Proyek', 'Minggu', 'Aktual', 'Catatan', 'PIC', 'Rencana'], ...PROGRES.map(([p, m, a, r]) => [p, m, a, '', '', r])]);
    s.setColProps('A', { width: 130 });
    s.setColProps('C', { format: { type: 'percent', decimals: 1 } });
    s.setColProps('F', { format: { type: 'percent', decimals: 1 } });
    s.setStyle('A1:F1', { bold: true, fill: '#eef2f7' });
    // baru: tanpa data blok; kategori dan setiap seri menunjuk range-nya sendiri
    s.addChart({
        at: 'H1:L14', type: 'bullet', title: 'Aktual (C) terhadap Rencana (F)',
        categories: 'A2:A8', series: [{ nameFrom: 'C1', values: 'C2:C8' }, { nameFrom: 'F1', values: 'F2:F8' }]
    });
    const opname = wb.sheet(wb.addSheet('Opname'));
    opname.setValues('A1', [['Tanggal', 'Progres'], [46266, 0.02], [46280, 0.08], [46301, 0.21], [46309, 0.27], [46330, 0.44], [46337, 0.5]]);
    opname.setColProps('A', { format: { type: 'date' } });
    opname.setColProps('B', { format: { type: 'percent', decimals: 0 } });
    // baru: scatter, X dan Y setiap seri sendiri-sendiri; X tanggal dengan jarak sebenarnya
    s.addChart({
        at: 'A10:F24', type: 'scatter', title: 'Progres per tanggal opname', lines: true, smooth: true, legend: 'none',
        series: [{ name: 'Realisasi', x: 'Opname!A2:A7', values: 'Opname!B2:B7' }]
    });
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
