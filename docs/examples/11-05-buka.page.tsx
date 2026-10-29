import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { buatDiskusi } from './data/diskusi.js';

// 11.5 Kartu muncul saat mouse di atas sel bertanda (hover), atau hanya saat sel diklik (click). Tombol di atas menggantinya.
export default function Halaman() {
    const [wb] = useState(() => createWorkbook(buatDiskusi().doc));
    const [cara, setCara] = useState<'hover' | 'click'>('hover');
    return (
        <div>
            <p>
                Kartu terbuka saat: <button className="hover" onClick={() => setCara('hover')}>mouse di atas sel</button>{' '}
                <button className="click" onClick={() => setCara('click')}>sel diklik</button> (sekarang: <b>{cara}</b>)
            </p>
            {/* baru: comments.open */}
            <div style={{ height: 520 }}><Sheet workbook={wb} user={{ id: 'user:dewi', name: 'Dewi' }} comments={{ open: cara }} /></div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
