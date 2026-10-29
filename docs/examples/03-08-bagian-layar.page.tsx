import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import type { AccessRow } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 3.8 Sheet yang lebih sederhana: tanpa menu, toolbar, dan tab. Bagian layar diatur dengan baris aturan (bab 10).
const LAYAR: AccessRow[] = [
    { who: '*', effect: 'allow', action: '*' },                  // semua orang boleh semuanya...
    { who: '*', effect: 'deny', action: 'ui.menubar' },          // ...tanpa menu bar
    { who: '*', effect: 'deny', action: 'ui.toolbar' },          // ...tanpa toolbar
    { who: '*', effect: 'deny', action: 'ui.tabs' }              // ...tanpa tab sheet
];

export default function Halaman() {
    const [wb] = useState(buatProduk);
    return (
        <div style={{ height: 220 }}>
            <Sheet workbook={wb} access={{ rows: LAYAR, who: 'siapa saja' }} />     {/* baru */}
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
