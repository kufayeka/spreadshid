import { useState } from 'react';
import { useWorkbook } from '@kufayeka/sheet';
import { buatProduk } from './data/produk.js';

// 2.5 Membaca satu nilai dari workbook ke komponen React. Belum ada <Sheet>.
export default function Halaman() {
    const [wb] = useState(buatProduk);
    // E5 berisi =SUM(E2:E4); display memberi teks yang sudah diformat
    const total = useWorkbook(wb, (w) => w.display('Produk', 'E5').text);
    return (
        <div data-siap style={{ font: '15px system-ui', padding: 16 }}>
            <p>Total nilai stok: <b>{total}</b></p>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
