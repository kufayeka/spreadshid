import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

function buat() {
    // kolom Volume (B) hanya menerima angka: aturanmu sendiri, lewat beforeOp
    const wb = createWorkbook(null, {
        beforeOp(op, ctx) {
            if (op.t !== 'cells' || ctx.source !== 'user') return op;
            const salah = op.changes.some((ch) => ctx.workbook.colIndex(op.sheet, ch.col) === 1 && ch.after !== null && typeof ch.after !== 'number');
            return salah ? { reject: 'Volume harus angka' } : op;
        }
    });
    wb.sheet('Sheet1').setValues('A1', [['Pekerjaan', 'Volume', 'Satuan'], ['Galian', 120, 'm3']]);
    return wb;
}

export default function HalamanEvent() {
    const [wb] = useState(buat);
    const [log, setLog] = useState([]);
    const tulis = (teks) => setLog((l) => [teks, ...l].slice(0, 6));
    return (
        <div style={{ height: 600, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 300 }}>
                <Sheet workbook={wb}
                    onOp={(e) => tulis('onOp: ' + e.source + ' ' + e.ops.map((o) => o.t).join(', '))}
                    onReject={(e) => tulis('onReject: ' + e.reason)}
                    onSelectionChange={(sel) => tulis('onSelectionChange: baris ' + sel.active.r + ', kolom ' + sel.active.c)} />
            </div>
            <ol id="log" style={{ margin: 0, fontFamily: 'monospace' }}>{log.map((t, i) => <li key={i}>{t}</li>)}</ol>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<HalamanEvent />);
