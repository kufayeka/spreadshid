import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 4.8 Sheet dari kode: menambah, menyalin, mengganti nama.
export default function Halaman() {
    const [wb] = useState(buatProduk);

    function tambahBulan() {
        const id = wb.duplicateSheet('Produk');                       // baru: salinan yang berdiri sendiri
        wb.sheet(id).setSheetProps({ name: 'Produk Nov' });           // baru: ganti nama
        const rekap = wb.addSheet('Rekap');                           // baru: sheet kosong di belakang
        wb.sheet(rekap).setValues('A1', [['Total Okt', "=SUM(Produk!E2:E4)"], ['Total Nov', "='Produk Nov'!E5"]]);
    }

    return (
        <div>
            <p><button className="tambah-sheet" onClick={tambahBulan}>Tambah sheet bulan depan</button></p>
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
