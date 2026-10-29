import { useRef, useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import type { SheetHandle } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 3.6 Memberi perintah ke sheet dari tombolmu sendiri, lewat ref.
export default function Halaman() {
    const [wb] = useState(buatProduk);
    const sheet = useRef<SheetHandle>(null);                                      // baru

    return (
        <div>
            <p>
                <button className="ke-total" onClick={() => sheet.current?.select('E5')}>Ke total</button>{' '}
                <button className="pilih-stok" onClick={() => sheet.current?.select('D2:D4')}>Pilih semua stok</button>{' '}
                <button className="isi-stok" onClick={() => { sheet.current?.select('D3'); sheet.current?.startEdit('300'); }}>Isi stok besi</button>
            </p>
            <div style={{ height: 300 }}>
                <Sheet ref={sheet} workbook={wb} />                                  {/* baru: ref */}
            </div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
