import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatAnalisa } from './08-pivot.js';

function buat() {
    const wb = buatAnalisa();
    wb.moveSheet('Analisa', 0);                            // sheet Analisa tampil pertama
    return wb;
}

export default function HalamanAnalisa() {
    const [wb] = useState(buat);
    return <div style={{ height: 560 }}><Sheet workbook={wb} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<HalamanAnalisa />);
