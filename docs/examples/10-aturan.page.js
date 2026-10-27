import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatProdukKasir } from './10-aturan.js';

export default function HalamanKasir() {
    const [wb] = useState(buatProdukKasir);
    // showProtected: sel yang dilindungi aturan digambar bergaris, berguna saat menyusun aturan
    return <div style={{ height: 520 }}><Sheet workbook={wb} showProtected /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<HalamanKasir />);
