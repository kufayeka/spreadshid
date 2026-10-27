import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatAnalisa } from './08-pivot.js';

// Satu workbook, dua tampilan berdampingan: data di kiri, pivot-nya di kanan. Mengubah Qty di kiri langsung mengubah pivot di kanan.
// Seleksi, gulir, dan sheet aktif milik masing-masing tampilan. Isi dan undo milik workbook, jadi sama untuk keduanya.
export default function DuaTampilan() {
    const [wb] = useState(buatAnalisa);
    return (
        <div style={{ display: 'flex', gap: 8, height: 520 }}>
            <Sheet workbook={wb} sheet={wb.sheetIdByName('Penjualan')} style={{ flex: 1 }} />
            <Sheet workbook={wb} sheet={wb.sheetIdByName('Analisa')} style={{ flex: 1 }} />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<DuaTampilan />);
