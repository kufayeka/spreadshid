import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { hitungOverview, storage } from './galeri-overview.js';

// Halaman overview proyek: tabel kurva S hasil hitungan server, dihitung ulang tiap halaman dibuka, tidak bisa diedit.
function bukaOverview() {
    // di aplikasi sungguhan: const rows = await fetch('/api/proyek/1/overview/kurva-s').then((r) => r.json());
    const rows = hitungOverview(storage);
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID' });
    const sh = wb.sheet('Sheet1');
    sh.setSheetProps({ name: 'Kurva S' });
    sh.setValues('A1', [['Minggu', 'Rencana', 'Realisasi', 'Rencana kumulatif', 'Realisasi kumulatif', 'Deviasi'],
        ...rows.map((r, i) => [...r, `=E${i + 2}-D${i + 2}`])]);
    const end = rows.length + 1;
    sh.setStyle('A1:F1', { bold: true, fill: '#1a73e8', color: '#ffffff', align: 'center', wrap: 'wrap' });
    sh.setStyle(`A2:A${end}`, { align: 'center', format: { type: 'number', decimals: 0, prefix: 'M' } });
    sh.setStyle(`B2:F${end}`, { format: { type: 'percent', decimals: 1 } });
    sh.setColProps('B:F', { width: 120 });
    sh.setRowProps('1', { height: 36 });
    sh.addConditional(`F2:F${end}`, { op: 'lt', a: 0, style: { color: '#d93025', bold: true } });
    sh.addConditional(`F2:F${end}`, { op: 'gte', a: 0, style: { color: '#188038', bold: true } });
    sh.addConditional(`E2:E${end}`, { kind: 'scale', min: { type: 'number', value: 0, color: '#ffffff' }, max: { type: 'number', value: 1, color: '#57bb8a' } });
    return wb;
}

// siapa pun yang membuka overview cuma melihat: tanpa menu, toolbar, formula bar, tab; hanya area tabelnya
const HANYA_LIHAT = {
    default: 'pembaca',
    roles: { pembaca: { can: ['copy', 'download'], ui: { menubar: false, toolbar: false, formulaBar: false, tabs: false, area: 'A1:F9' } } }
};

export default function HalamanOverview() {
    const [wb] = useState(bukaOverview);
    return (
        <div style={{ height: 300 }}>
            <Sheet workbook={wb} access={{ policy: HANYA_LIHAT, who: 'user:owner' }} />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<HalamanOverview />);
