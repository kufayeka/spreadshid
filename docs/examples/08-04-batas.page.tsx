import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 8.4 Angka dengan batas: stok harus 0 sampai 10.000. Yang di luar itu ditolak dengan pesan sendiri.
function buat() {
    const wb = buatProduk();
    wb.sheet('Produk').addValidation('D2:D4', {                       // baru
        kind: 'number', op: 'between', a: 0, b: 10000,
        message: 'Stok di {cell} harus 0 sampai 10.000'
    });
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buat);
    return <div style={{ height: 300 }}><Sheet workbook={wb} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
