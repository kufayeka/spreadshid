import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// 12.8 Waterfall: dari nilai kontrak, dikurangi uang muka, termin, dan retensi, sampai sisa yang masih bisa ditagih.
function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID' });
    const s = wb.sheet('Sheet1');
    s.setValues('A1', [['Langkah', 'Juta rupiah'], ['Nilai kontrak', 1110], ['Uang muka', -300], ['Termin 1-11', -520], ['Retensi ditahan', -55], ['Sisa tagih', null]]);
    s.setColProps('A', { width: 130 });
    s.setStyle('A1:B1', { bold: true, fill: '#eef2f7' });
    // baru: kategori pertama adalah total awal; sel terakhir kosong, jadi dihitung sebagai total akhir
    s.addChart({ at: 'D1:J18', data: 'A1:B6', type: 'waterfall', title: 'Dari nilai kontrak ke sisa tagih', subtitle: 'juta rupiah', totals: [0], downColor: '#1192e8' });
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
