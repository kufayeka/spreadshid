import { useState } from 'react';
import { useWorkbook } from '@kufayeka/sheet';
import { buatProduk } from './data/produk.js';

// 2.8 Seluruh sheet sebagai tabel HTML biasa: workbook adalah data, tampilannya boleh apa saja.
export default function Halaman() {
    const [wb] = useState(buatProduk);
    const w = useWorkbook(wb);
    const akhir = w.sheet('Produk').lastFilled();                  // baru: baris dan kolom terakhir yang berisi (mulai dari 0)
    const rows = akhir.r + 1, cols = akhir.c + 1;

    const baris = [];
    for (let r = 0; r < rows; r++) {                               // baru: nomor baris dan kolom mulai dari 0
        const sel = [];
        for (let c = 0; c < cols; c++) {
            const d = w.display('Produk', r, c);                   // baru: sel ditunjuk dengan nomor, bukan alamat
            sel.push(<td key={c} align={d.align} style={{ padding: '4px 10px', fontWeight: r === 0 || r === rows - 1 ? 600 : 400 }}>{d.text}</td>);
        }
        baris.push(<tr key={r} style={{ borderTop: '1px solid #ddd' }}>{sel}</tr>);
    }

    return (
        <div data-siap style={{ font: '14px system-ui', padding: 16 }}>
            <p>{rows} baris, {cols} kolom</p>
            <table style={{ borderCollapse: 'collapse' }}><tbody>{baris}</tbody></table>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
