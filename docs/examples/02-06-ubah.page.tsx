import { useState } from 'react';
import { useWorkbook } from '@kufayeka/sheet';
import { buatProduk } from './data/produk.js';

// 2.6 Mengubah dari tombol: stok semen diubah dari kode, dan total yang dibaca di 2.5 ikut berubah sendiri.
export default function Halaman() {
    const [wb] = useState(buatProduk);
    const total = useWorkbook(wb, (w) => w.display('Produk', 'E5').text);
    const stokSemen = useWorkbook(wb, (w) => w.value('Produk', 'D2'));          // baru

    const ubah = () => wb.sheet('Produk').setValues('D2', 400);                 // baru

    return (
        <div data-siap style={{ font: '15px system-ui', padding: 16 }}>
            <p>Stok semen: <b>{String(stokSemen)}</b> <button className="ubah" onClick={ubah}>Jadikan 400</button></p>
            <p>Total nilai stok: <b>{total}</b></p>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
