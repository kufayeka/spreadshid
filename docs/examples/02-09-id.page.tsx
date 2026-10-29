import { useState } from 'react';
import { useWorkbook } from '@kufayeka/sheet';
import { buatProduk } from './data/produk.js';

// 2.9 Nomor baris bisa bergeser, id baris tidak. Baris total dicari lewat id-nya, jadi tetap ketemu walaupun baris baru disisipkan.
export default function Halaman() {
    const [wb] = useState(buatProduk);
    // baru: id baris total (baris 5), diambil sekali; id ini tidak pernah berubah
    const [idTotal] = useState(() => wb.sheet('Produk').rowId(4));

    // setiap render, cari lagi nomor baris dari id-nya
    const nomor = useWorkbook(wb, (w) => w.sheet('Produk').rowIndex(idTotal));
    const rumus = useWorkbook(wb, (w) => w.sheet('Produk').input(nomor, 4));
    const total = useWorkbook(wb, (w) => w.sheet('Produk').display(nomor, 4).text);

    function sisipkan() {                                                    // baru
        const s = wb.sheet('Produk');
        s.insertRows('3');                                                   // baris kosong di atas baris 3
        s.setValues('A3', [['PSR-01', 'Pasir beton', 290000, 31, '=C3*D3']]);
    }

    return (
        <div data-siap style={{ font: '15px system-ui', padding: 16 }}>
            <p><button className="sisipkan" onClick={sisipkan}>Sisipkan produk di baris 3</button></p>
            <p>Baris total sekarang nomor <b>{nomor + 1}</b>, rumusnya <code>{rumus}</code> = <b>{total}</b></p>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
