import { useState } from 'react';
import { useWorkbook } from '@kufayeka/sheet';
import { buatProduk } from './data/produk.js';

// 2.7 Tiga sisi isi sebuah sel: value (nilai sebenarnya), input (yang diketik), display (yang tampil).
const SEL = ['E2', 'C2', 'B2'];

export default function Halaman() {
    const [wb] = useState(buatProduk);
    const w = useWorkbook(wb);                                     // tanpa fungsi baca: komponen dirender ulang di setiap perubahan
    return (
        <div data-siap style={{ font: '14px system-ui', padding: 16 }}>
            <table cellPadding={6} style={{ borderCollapse: 'collapse' }}>
                <thead><tr><th align="left">Sel</th><th align="left">value</th><th align="left">input</th><th align="left">display.text</th></tr></thead>
                <tbody>
                    {SEL.map((a) => (
                        <tr key={a} style={{ borderTop: '1px solid #ddd' }}>
                            <td><b>{a}</b></td>
                            <td><code>{JSON.stringify(w.value('Produk', a))}</code></td>
                            <td><code>{JSON.stringify(w.input('Produk', a))}</code></td>
                            <td><code>{JSON.stringify(w.display('Produk', a).text)}</code></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
