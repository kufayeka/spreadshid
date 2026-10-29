import { useState } from 'react';
import { Sheet, useWorkbook } from '@kufayeka/sheet';
import { tableOf } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 4.4 Membaca kembali sebagai data: baris produk menjadi daftar objek, siap dikirim ke API.
export default function Halaman() {
    const [wb] = useState(buatProduk);
    // baru: judul di baris 1 menjadi nama field, baris 2-4 menjadi objek
    const produk = useWorkbook(wb, (w) => JSON.stringify(tableOf(w, 'Produk', 'A1:D4').records, null, 1));

    return (
        <div style={{ display: 'flex', height: 300 }}>
            <Sheet workbook={wb} style={{ flex: 1 }} />
            <pre style={{ width: 300, margin: 0, padding: 8, font: '12px Consolas, monospace', borderLeft: '1px solid #dadce0', overflow: 'auto' }}>{produk}</pre>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
