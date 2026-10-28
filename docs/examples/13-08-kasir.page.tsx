import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import type { AccessRow } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { buatStok } from './data/stok-akses.js';

// Langkah 8: di layar. Aturan dari database + orang yang login, diberikan ke <Sheet access>. Sheet langsung menerapkannya.
const ATURAN: AccessRow[] = [
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:I13' },
    { who: 'role:kasir', effect: 'allow', action: 'edit', where: 'Produk!col:Stok' },
    { who: 'role:kasir', effect: 'deny', action: 'read', where: 'Produk!col:Harga beli' },
    { who: 'role:kasir', effect: 'allow', action: 'sort' },
    { who: 'role:kasir', effect: 'deny', action: 'ui.toolbar' }
];

export default function StokUntukKasir() {
    const [wb] = useState(buatStok);
    // who: dari sesi login aplikasimu (akun + role-nya)
    return (
        <div style={{ height: 480 }}>
            <Sheet workbook={wb} access={{ rows: ATURAN, who: { user: 'rina', roles: ['kasir'] } }} user={{ id: 'rina', name: 'Rina' }} />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<StokUntukKasir />);
