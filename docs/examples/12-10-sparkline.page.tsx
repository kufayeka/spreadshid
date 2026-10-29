import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { PROGRES } from './data/proyek.js';

// 12.10 Sparkline dan data bar: tren 8 minggu di satu sel per proyek, dan bar di belakang angka aktual.
function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID' });
    const s = wb.sheet('Sheet1');
    s.setSheetProps({ name: 'Progres' });
    const minggu = ['M-7', 'M-6', 'M-5', 'M-4', 'M-3', 'M-2', 'M-1', 'M0'];
    s.setValues('A1', [['Proyek', 'Aktual', 'Tren 8 minggu', ...minggu],
        ...PROGRES.map(([nama, , aktual], i) => [nama, aktual, null, ...minggu.map((_, k) => Math.round(aktual * (0.55 + k * 0.0643 + Math.sin(k + i) * 0.01) * 1000) / 1000)])]);
    s.setColProps('A', { width: 140 });
    s.setColProps('B', { width: 110, format: { type: 'percent', decimals: 1 } });
    s.setColProps('C', { width: 150 });
    s.setColProps('D:K', { width: 56, format: { type: 'percent', decimals: 0 } });
    s.setStyle('A1:K1', { bold: true, fill: '#eef2f7' });
    // baru: sparkline di C2:C8, sel ke-i menggambar baris ke-i dari D2:K8
    s.addSparkline({ at: 'C2:C8', data: 'D2:K8', type: 'line', color: '#6929c4' });
    // baru: data bar di kolom Aktual (aturan conditional formatting)
    s.addConditional('B2:B8', { kind: 'bar', color: '#1192e8' });
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buat);
    return <div style={{ height: 350 }}><Sheet workbook={wb} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
