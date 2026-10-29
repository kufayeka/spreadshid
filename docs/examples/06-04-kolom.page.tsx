import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { PRODUK, KOLOM_PRODUK } from './data/toko.js';

// 6.4 Format satu kolom, dan stok yang tampil dengan satuannya sendiri (zak, batang, dus) dari kolom Satuan di baris yang sama.
function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const s = wb.sheet('Sheet1');
    s.setValues('A1', [KOLOM_PRODUK, ...PRODUK.slice(0, 6)]);
    s.setStyle('A1:H1', { bold: true, fill: '#eef2f7' });
    // baru: format di kolom berlaku untuk semua selnya, termasuk baris yang ditambah nanti
    s.setColProps('E:F', { format: { type: 'money', decimals: 0 } });
    // baru: akhiran diambil dari kolom D (Satuan) di baris yang sama
    s.setColProps('G:H', { format: { type: 'number', decimals: 0, suffixFrom: s.colId(3) } });
    s.setColProps('D', { hidden: true });                   // satuannya sudah tampil di stok
    s.setColProps('B', { width: 180 });
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buat);
    return <div style={{ height: 290 }}><Sheet workbook={wb} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
