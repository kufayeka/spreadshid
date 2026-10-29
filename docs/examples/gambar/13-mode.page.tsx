import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import type { AccessRow } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// Gambar untuk 13.3: sheet dan aturan yang sama, di dua mode. Kiri: mode live (dilihat Rina). Kanan: mode pengaturan (pemilik).
function buat() {
    const wb = createWorkbook();
    const s = wb.sheet('Sheet1');
    s.setSheetProps({ name: 'Produk' });
    s.setValues('A1', [
        ['Kode', 'Produk', 'Harga beli', 'Stok'],
        ['SMN-01', 'Semen', 64000, 420],
        ['BSI-10', 'Besi', 68000, 260],
        ['CAT-05', 'Cat', 118000, 64]
    ]);
    s.setStyle('A1:D1', { bold: true, fill: '#eef2f7' });
    s.setColProps('A:D', { width: 90 });
    return wb;
}
const LAYAR = ['menubar', 'toolbar', 'formulaBar', 'tabs'].map((p): AccessRow => ({ who: '*', effect: 'deny', action: 'ui.' + p }));
// hanya untuk gambar ini: pemilik juga tanpa menu dan toolbar, supaya kedua panel sebanding
const LAYAR_PEMILIK = ['menubar', 'toolbar', 'formulaBar', 'tabs'].map((p): AccessRow => ({ who: 'user:yeka', effect: 'deny', action: 'ui.' + p }));
const ATURAN: AccessRow[] = [
    { who: 'user:yeka', effect: 'allow', action: '*' },
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:D4' },
    { who: 'role:kasir', effect: 'deny', action: 'read', where: 'Produk!col:Harga beli' },
    { who: 'role:gudang', effect: 'allow', action: 'edit', where: 'Produk!col:Stok' },
    ...LAYAR
];

function Panel({ judul, live }: { judul: string; live: boolean }) {
    const [wb] = useState(buat);
    return (
        <div style={{ border: '1px solid #dadce0', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
            <div style={{ padding: '6px 10px', font: '600 13px system-ui' }}>{judul}</div>
            <div style={{ height: 130 }}>
                <Sheet workbook={wb} access={live
                    ? { rows: ATURAN, who: { user: 'rina', roles: ['kasir'] } }
                    : { rows: [...ATURAN, ...LAYAR_PEMILIK], who: { user: 'yeka' }, view: 'setup' }} />
            </div>
        </div>
    );
}

export default function DuaMode() {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 10, width: 860, background: '#f8f9fa' }}>
            <Panel live judul="Mode live: dilihat Rina (kasir)" />
            <Panel live={false} judul="Mode pengaturan: dilihat pemilik" />
        </div>
    );
}
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<DuaMode />);
