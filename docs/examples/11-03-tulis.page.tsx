import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 11.3 Komentar pertama: Sheet tahu siapa yang membuka lewat prop user. Pilih sel, tekan Ctrl+Alt+M, tulis, Ctrl+Enter.
export default function Halaman() {
    const [wb] = useState(() => createWorkbook(buatProduk().toJSON()));
    // baru: user, nama dan id orang yang membuka sheet. Namanya tercatat di setiap komentar yang ia tulis
    return <div style={{ height: 300 }}><Sheet workbook={wb} user={{ id: 'user:dewi', name: 'Dewi' }} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
