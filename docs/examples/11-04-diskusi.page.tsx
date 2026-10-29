import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { buatDiskusi } from './data/diskusi.js';

// 11.4 Workbook yang sudah berisi diskusi: Dewi bertanya soal stok keramik di G9, Joko dari gudang menjawab, dan Joko menulis catatan di G7.
export default function Halaman() {
    // baru: isinya dibuat oleh orang-orang lain sebelumnya. Dewi yang membuka, jadi komentar Dewi tanpa tanda "orang lain"
    const [wb] = useState(() => createWorkbook(buatDiskusi().doc));
    return <div style={{ height: 520 }}><Sheet workbook={wb} user={{ id: 'user:dewi', name: 'Dewi' }} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
