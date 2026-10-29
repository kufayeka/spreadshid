import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 3.9 Warna sendiri: semua warna dan huruf sheet adalah variabel CSS (--ks-...).
const temaHijau = {
    '--ks-accent': '#188038',                  // sel aktif, seleksi, tab aktif
    '--ks-head-bg': '#e6f4ea',                 // latar huruf kolom dan nomor baris
    '--ks-head-fg': '#0d652d',
    '--ks-grid': '#cfe8d6'                     // garis grid
} as CSSProperties;

export default function Halaman() {
    const [wb] = useState(buatProduk);
    return (
        <div style={{ height: 300 }}>
            <Sheet workbook={wb} style={temaHijau} />                            {/* baru */}
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
