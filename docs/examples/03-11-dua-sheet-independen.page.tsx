import { useState } from 'react';
import { Sheet, useWorkbook } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// 3.11 Dua <Sheet> paralel pada 1 workbook: panel kiri membuka sheet Input, panel kanan membuka sheet Rekap secara independen.
function buatWorkbookDuaSheet() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const input = wb.sheet('Sheet1');
    input.setSheetProps({ name: 'Input' });
    input.setValues('A1', [
        ['Item', 'Qty', 'Harga', 'Subtotal'],
        ['Semen', 10, 72000, '=B2*C2'],
        ['Besi', 5, 79500, '=B3*C3'],
    ]);
    input.setStyle('A1:D1', { bold: true, fill: '#eef2f7' });
    input.setStyle('C2:D3', { format: { type: 'money', decimals: 0 } });

    const rekap = wb.sheet(wb.addSheet('Rekap'));
    rekap.setValues('A1', [
        ['Ringkasan', 'Nilai'],
        ['Total Item', '=SUM(Input!B2:B3)'],
        ['Grand Total', '=SUM(Input!D2:D3)'],
    ]);
    rekap.setStyle('A1:B1', { bold: true, fill: '#e8f0fe' });
    rekap.setStyle('B3', { bold: true, format: { type: 'money', decimals: 0 } });
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buatWorkbookDuaSheet);
    // State sheet aktif dikelola terpisah per panel <Sheet>, sementara datanya berbagi 1 instance wb
    const [sheetKiri, setSheetKiri] = useState<string>(() => wb.sheetIdByName('Input') ?? '');
    const [sheetKanan, setSheetKanan] = useState<string>(() => wb.sheetIdByName('Rekap') ?? '');
    const grandTotal = useWorkbook(wb, (w) => w.value('Rekap', 'B3'));

    return (
        <div>
            <p>Grand Total (sinkron via <code>useWorkbook</code>): <strong>{String(grandTotal ?? 0)}</strong></p>
            <div style={{ display: 'flex', gap: 12, height: 320 }}>
                <Sheet workbook={wb} sheet={sheetKiri} onSheetChange={setSheetKiri} style={{ flex: 1 }} />
                <Sheet workbook={wb} sheet={sheetKanan} onSheetChange={setSheetKanan} style={{ flex: 1 }} />
            </div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
