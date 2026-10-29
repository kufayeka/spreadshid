import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import type { WorkbookEvents } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 3.4 Mendengar perubahan dari sheet: onOp dipanggil setiap kali isi berubah, dengan sumbernya.
export default function Halaman() {
    const [wb] = useState(buatProduk);
    const [catatan, setCatatan] = useState<string[]>([]);

    // baru: satu baris catatan per perubahan
    function padaPerubahan(e: WorkbookEvents['op']) {
        setCatatan((c) => [...c, e.source + ': ' + e.ops.map((op) => op.t).join(', ')]);
    }

    return (
        <div style={{ display: 'flex', height: 300 }}>
            <Sheet workbook={wb} style={{ flex: 1 }} onOp={padaPerubahan} />          {/* baru */}
            <ol style={{ width: 220, margin: 0, padding: '8px 8px 8px 28px', font: '13px system-ui', borderLeft: '1px solid #dadce0' }}>
                {catatan.map((c, i) => <li key={i}><code>{c}</code></li>)}
            </ol>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
