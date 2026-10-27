import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// semua warna dan huruf adalah variabel CSS (--ks-...): ganti lewat style atau CSS Anda sendiri
const temaHijau = {
    '--ks-accent': '#188038',
    '--ks-head-bg': '#e6f4ea',
    '--ks-head-fg': '#0d652d',
    '--ks-grid': '#cfe8d6',
    '--ks-ui-font': '13px/1.4 "Segoe UI", system-ui, sans-serif'
};

function buat() {
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [['Pekerjaan', 'Volume', 'Satuan'], ['Galian', 120, 'm3'], ['Urugan', 40, 'm3']]);
    return wb;
}

export default function HalamanTema() {
    const [wb] = useState(buat);
    return (
        <div style={{ height: 600 }}>
            <Sheet workbook={wb} style={{ ...temaHijau, height: '100%' }} />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<HalamanTema />);
