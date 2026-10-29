import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 4.3 Menulis dari kode: satu produk baru disisipkan di dalam tabel, lengkap dengan rumusnya, dan total ikut menghitungnya.
export default function Halaman() {
    const [wb] = useState(buatProduk);

    function tambah() {
        const s = wb.sheet('Produk');
        const produkTerakhir = s.lastFilled().r;                     // nomor baris produk terakhir, seperti di layar (4)
        s.insertRows(String(produkTerakhir));                        // baru: baris kosong DI DALAM range total (di atas baris 4)
        s.setValues('A' + produkTerakhir, [['PSR-01', 'Pasir beton', 290000, 31, '=C' + produkTerakhir + '*D' + produkTerakhir]]);   // baru
    }

    return (
        <div>
            <p><button className="tambah" onClick={tambah}>Tambah pasir</button></p>
            <div style={{ height: 300 }}>
                <Sheet workbook={wb} />
            </div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
