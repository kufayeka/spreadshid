import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import type { AccessRow, Who } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { buatStok } from './data/stok-akses.js';

// 13.15 Role: aturan untuk semua kasir, dan satu role lagi, gudang.
const ORANG_GRUP = { users: [{ id: 'rina', name: 'Rina Dewi' }, { id: 'joko', name: 'Joko Susilo' }, { id: 'sari', name: 'Sari Utami' }], groups: { gudang: ['joko', 'sari'], kasir: ['rina', 'sari'] } };

const rows: AccessRow[] = [
    { who: 'group:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:I13' },
    { who: 'group:gudang', effect: 'allow', action: 'read', where: 'Produk!A1:I13' },        // baru
    { who: 'group:gudang', effect: 'allow', action: 'edit', where: 'Produk!col:Stok' }       // baru
];

const ORANG: Record<string, Who> = {
    rina: 'rina',
    joko: 'joko',
    sari: 'sari'       // dua role sekaligus
};

export default function Halaman() {
    const [wb] = useState(buatStok);
    const [sebagai, setSebagai] = useState('rina');
    return (
        <div>
            <p>Lihat sebagai <select className="lihat-sebagai" value={sebagai} onChange={(e) => setSebagai(e.target.value)}>
                {Object.keys(ORANG).map((nama) => <option key={nama}>{nama}</option>)}
            </select></p>
            <div style={{ height: 300 }}>
                <Sheet workbook={wb} people={ORANG_GRUP} access={{ rows, who: ORANG[sebagai] }} />
            </div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
