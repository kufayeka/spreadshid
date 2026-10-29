import { useState } from 'react';
import { useWorkbook } from '@kufayeka/sheet';
import { buatProduk } from './data/produk.js';

// 2.11 Undo dan redo dari tombol sendiri, yang tahu kapan bisa dipakai.
export default function Halaman() {
    const [wb] = useState(buatProduk);
    const stok = useWorkbook(wb, (w) => w.value('Produk', 'D2'));
    const bisaUndo = useWorkbook(wb, (w) => w.canUndo());                    // baru
    const bisaRedo = useWorkbook(wb, (w) => w.canRedo());                    // baru

    return (
        <div data-siap style={{ font: '15px system-ui', padding: 16 }}>
            <p>Stok semen: <b>{String(stok)}</b></p>
            <p>
                <button className="kurang" onClick={() => wb.sheet('Produk').setValues('D2', Number(stok) - 10)}>Kurangi 10</button>{' '}
                <button className="undo" onClick={() => wb.undo()} disabled={!bisaUndo}>Undo</button>{' '}
                <button className="redo" onClick={() => wb.redo()} disabled={!bisaRedo}>Redo</button>
            </p>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
