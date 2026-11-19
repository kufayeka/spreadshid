import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook, type AccessRow } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { buatDiskusi } from './data/diskusi.js';

// 11.7 Siapa boleh apa: baris akses yang sama dengan bab 10. Rina dari keuangan boleh membaca sel dan komentar, tapi tidak ikut menulis.
const akses: AccessRow[] = [
    { who: 'user:dewi', effect: 'allow', action: '*' },
    { who: 'group:gudang', effect: 'allow', action: 'read' },
    { who: 'group:gudang', effect: 'allow', action: 'comment.read' },
    { who: 'group:gudang', effect: 'allow', action: 'comment.reply' },
    { who: 'group:keuangan', effect: 'allow', action: 'read' },
    // baru: comment.read saja, tanpa comment.create dan comment.reply
    { who: 'group:keuangan', effect: 'allow', action: 'comment.read' }
];

export default function Halaman() {
    const [wb] = useState(() => createWorkbook(buatDiskusi().doc));
    return (
        <div style={{ height: 520 }}>
            <Sheet workbook={wb} people={{ users: [{ id: 'rina', name: 'Rina Dewi' }], groups: { keuangan: ['rina'] } }} access={{ rows: akses, who: 'rina' }} />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
