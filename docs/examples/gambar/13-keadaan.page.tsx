import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import type { AccessRow } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// Gambar untuk 13.2: empat keadaan sel, berdampingan, dilihat oleh Rina (kasir).
function buat() {
    const wb = createWorkbook();
    const s = wb.sheet('Sheet1');
    s.setSheetProps({ name: 'Produk' });
    s.setValues('A1', [['Boleh diubah', 'Hanya baca', 'Tersembunyi', 'Tidak terlihat'], [420, 'Semen', 64000, 'rahasia']]);
    s.setStyle('A1:D1', { bold: true, fill: '#eef2f7', align: 'center' });
    s.setStyle('A2:D2', { align: 'center' });
    s.setColProps('A:D', { width: 130 });
    return wb;
}
const ATURAN: AccessRow[] = [
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'A1:D1' },
    { who: 'role:kasir', effect: 'allow', action: 'edit', where: 'A2' },
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'B2' },
    { who: 'role:kasir', effect: 'deny', action: 'read', where: 'C2' },
    ...['menubar', 'toolbar', 'formulaBar', 'tabs', 'headers'].map((p): AccessRow => ({ who: '*', effect: 'deny', action: 'ui.' + p }))
];

export default function Keadaan() {
    const [wb] = useState(buat);
    return <div style={{ height: 70, width: 524, padding: 8 }}><Sheet workbook={wb} access={{ rows: ATURAN, who: { user: 'rina', roles: ['kasir'] } }} /></div>;
}
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Keadaan />);
