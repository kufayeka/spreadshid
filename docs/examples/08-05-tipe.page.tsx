import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 8.5 Tipe kolom: kolom Stok hanya menerima bilangan bulat, seperti kolom INTEGER di tabel database.
function buat() {
    const wb = buatProduk();
    wb.sheet('Produk').setTypes({ headerRow: 1, fields: { Stok: { kind: 'int' } } });   // baru: kolom berjudul Stok
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
