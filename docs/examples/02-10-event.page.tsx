import { useEffect, useState } from 'react';
import { buatProduk } from './data/produk.js';

// 2.10 Mendengar perubahan: setiap perubahan adalah sebuah op, dengan sumbernya (siapa yang mengubah).
export default function Halaman() {
    const [wb] = useState(buatProduk);
    const [catatan, setCatatan] = useState<string[]>([]);

    useEffect(() => {
        // baru: wb.on mengembalikan fungsi untuk berhenti mendengar; dipanggil saat komponen dilepas
        return wb.on('op', (e) => {
            const jenis = e.ops.map((op) => op.t).join(', ');
            setCatatan((c) => [...c, e.source + ': ' + jenis]);
        });
    }, [wb]);

    const s = wb.sheet('Produk');
    return (
        <div data-siap style={{ font: '15px system-ui', padding: 16 }}>
            <p>
                <button className="isi" onClick={() => s.setValues('D2', 400)}>Ubah stok</button>{' '}
                <button className="tebal" onClick={() => s.setStyle('B2', { bold: true })}>Tebalkan B2</button>{' '}
                <button className="orang" onClick={() => s.setValues('D3', 250, { source: 'user' })}>Ubah stok sebagai orang</button>{' '}
                <button className="undo" onClick={() => wb.undo()}>Undo</button>
            </p>
            <ol className="catatan">{catatan.map((c, i) => <li key={i}><code>{c}</code></li>)}</ol>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
