import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import type { SheetSelection } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 3.5 Seleksi: range yang dipilih orang, dan jumlah angkanya, ditampilkan di luar sheet.
export default function Halaman() {
    const [wb] = useState(buatProduk);
    const [pilihan, setPilihan] = useState<SheetSelection | null>(null);       // baru

    // baru: jumlahkan angka di semua range yang dipilih
    let jumlah = 0;
    for (const r of pilihan?.ranges ?? []) {
        for (let baris = r.r1; baris <= r.r2; baris++) {
            for (let kolom = r.c1; kolom <= r.c2; kolom++) {
                const v = wb.value(pilihan!.sheet.id, baris, kolom);
                if (typeof v === 'number') jumlah += v;
            }
        }
    }

    return (
        <div>
            <p style={{ font: '14px system-ui' }}>
                Dipilih: <b className="dipilih">{pilihan ? pilihan.address : '-'}</b> · jumlah: <b>{jumlah.toLocaleString('id-ID')}</b>
            </p>
            <div style={{ height: 300 }}>
                <Sheet workbook={wb} onSelectionChange={setPilihan} />              {/* baru */}
            </div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
