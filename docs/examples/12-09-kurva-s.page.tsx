import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatJadwal } from './data/proyek.js';

// Kurva S di atas time schedule: chart garis transparan yang titik-titiknya jatuh di tengah kolom minggu.
function buat() {
    const wb = buatJadwal();
    const s = wb.sheet('Jadwal');
    s.addChart({
        at: 'E2:N9', data: 'E11:N12', type: 'line', seriesIn: 'rows',
        background: 'none', align: 'cells', grid: false, smooth: true, legend: 'top',
        y: { min: 0, max: 1 }, yAxis: true,
        series: [{ name: 'Rencana', axis: 'right' }, { name: 'Realisasi', axis: 'right', dash: true, color: '#1192e8', endLabel: 'Realisasi ' }]
    });
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buat);
    return <div style={{ height: 420 }}><Sheet workbook={wb} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
