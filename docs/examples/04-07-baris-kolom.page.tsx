import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 4.7 Baris dan kolom dari kode: menyembunyikan, mengubah ukuran, menghapus.
export default function Halaman() {
    const [wb] = useState(buatProduk);
    const s = wb.sheet('Produk');
    return (
        <div>
            <p>
                <button className="sembunyikan" onClick={() => s.setColProps('C', { hidden: true })}>Sembunyikan Harga</button>{' '}
                <button className="lebarkan" onClick={() => s.setColProps('A', { width: 140 })}>Lebarkan Kode</button>{' '}
                <button className="tinggikan" onClick={() => s.setRowProps('1', { height: 36 })}>Tinggikan judul</button>{' '}
                <button className="hapus" onClick={() => s.deleteRows('3')}>Hapus baris 3</button>
            </p>
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
