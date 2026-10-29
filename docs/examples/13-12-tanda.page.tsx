import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import type { CellMarks } from '@kufayeka/sheet';
import type { AccessRow } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { buatStok } from './data/stok-akses.js';

// Tanda di sel yang tidak boleh diubah: prop marks. Aturan dan orangnya sama di keempat sheet, hanya tandanya yang berbeda.
const ATURAN: AccessRow[] = [
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:I13' },
    { who: 'role:kasir', effect: 'allow', action: 'edit', where: 'Produk!col:Stok' },
    { who: 'role:kasir', effect: 'deny', action: 'read', where: 'Produk!col:Harga beli' },
    ...['menubar', 'toolbar', 'formulaBar', 'tabs'].map((bagian): AccessRow => ({ who: '*', effect: 'deny', action: 'ui.' + bagian }))
];
const RINA = { user: 'rina', roles: ['kasir'] };

const PILIHAN: Array<{ judul: string; marks: false | CellMarks | undefined }> = [
    { judul: 'Bawaan (gembok + mata)', marks: undefined },
    { judul: '{ tint: true }: abu-abu + gembok + mata', marks: { tint: true } },
    { judul: '{ stripes: true, lock: false }: garis-garis + mata', marks: { stripes: true, lock: false } },
    { judul: 'false: tanpa tanda', marks: false }
];

function Contoh({ judul, marks }: { judul: string; marks: false | CellMarks | undefined }) {
    const [wb] = useState(buatStok);
    return (
        <div style={{ border: '1px solid #dadce0', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '6px 10px', fontWeight: 600 }}>{judul}</div>
            <div style={{ height: 160 }}><Sheet workbook={wb} access={{ rows: ATURAN, who: RINA }} marks={marks} /></div>
        </div>
    );
}

export default function PilihanTanda() {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 12, font: '13px system-ui' }}>
            {PILIHAN.map((p) => <Contoh key={p.judul} judul={p.judul} marks={p.marks} />)}
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<PilihanTanda />);
