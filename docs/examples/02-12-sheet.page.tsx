import { useState } from 'react';
import { Sheet, useWorkbook } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 2.12 Workbook yang sama, sekarang juga dengan <Sheet>. Yang diketik di sheet langsung terbaca oleh komponen lain.
export default function Halaman() {
    const [wb] = useState(buatProduk);
    const total = useWorkbook(wb, (w) => w.display('Produk', 'E5').text);
    return (
        <div data-siap style={{ font: '15px system-ui' }}>
            <p style={{ padding: '0 16px' }}>Total nilai stok: <b>{total}</b></p>
            <div style={{ height: 280 }}>
                <Sheet workbook={wb} />                                              {/* baru */}
            </div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
