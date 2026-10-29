import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { sortRange } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 7.3 Mengurutkan dari tombol: produk diurutkan menurut stok, dari yang terbanyak. Baris judul dan baris total tidak ikut.
export default function Halaman() {
    const [wb] = useState(buatProduk);
    return (
        <div>
            <p>
                <button className="stok" onClick={() => sortRange(wb, 'Produk', 'A2:E4', 'D', 'desc')}>Stok terbanyak dulu</button>{' '}
                <button className="nama" onClick={() => sortRange(wb, 'Produk', 'A2:E4', 'B', 'asc')}>Nama A-Z</button>
            </p>
            <div style={{ height: 300 }}><Sheet workbook={wb} /></div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
