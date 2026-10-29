import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatProdukKasir } from './10-aturan.js';

export default function HalamanKasir() {
    const [wb] = useState(buatProdukKasir);
    // sel yang dilindungi aturan diberi gembok kecil di pojok (bawaan); marks={{ stripes: true }} menambah garis-garis
    return <div style={{ height: 520 }}><Sheet workbook={wb} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<HalamanKasir />);
