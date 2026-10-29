import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { findAll, replaceIn } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 7.7 Cari dan ganti dari kode: merek "Portland" diganti "Gresik" di seluruh sheet, dan jumlah yang diganti ditampilkan.
export default function Halaman() {
    const [wb] = useState(buatProduk);
    const [pesan, setPesan] = useState('');

    function ganti() {
        const ketemu = findAll(wb, 'Produk', 'Portland');                      // baru: semua sel yang memuat "Portland"
        const jumlah = replaceIn(wb, 'Produk', ketemu, 'Portland', 'Gresik');  // baru: ganti di sel-sel itu
        setPesan(ketemu.length + ' sel ditemukan, ' + jumlah + ' diganti');
    }

    return (
        <div>
            <p><button className="ganti" onClick={ganti}>Ganti "Portland" menjadi "Gresik"</button> {pesan}</p>
            <div style={{ height: 300 }}><Sheet workbook={wb} /></div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
