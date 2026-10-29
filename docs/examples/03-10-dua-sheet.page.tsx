import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 3.10 Dua <Sheet> untuk workbook yang sama: yang diketik di satu sheet langsung terlihat di sheet lainnya.
export default function Halaman() {
    const [wb] = useState(buatProduk);
    return (
        <div style={{ display: 'flex', gap: 12, height: 330 }}>
            <Sheet workbook={wb} style={{ flex: 1 }} />
            <Sheet workbook={wb} style={{ flex: 1 }} />                          {/* baru: workbook yang sama */}
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
