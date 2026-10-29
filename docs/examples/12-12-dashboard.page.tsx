import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatDashboard } from './data/proyek.js';

// Dashboard: sheet yang hanya berisi rumus dan chart dari sheet-sheet tabel.
export default function Halaman() {
    const [wb] = useState(() => { const w = buatDashboard(); return w; });
    return <div style={{ height: 900 }}><Sheet workbook={wb} sheet={wb.sheetIdByName("Dashboard")} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
