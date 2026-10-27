import { useRef, useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

function buat() {
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setValues(s, 0, 0, [['Pekerjaan', 'Volume', 'Satuan'], ['Galian', 120, 'm3'], ['Urugan', 40, 'm3'], ['Beton', 18.5, 'm3']]);
    return wb;
}

// ref memberi "handle": hal yang bisa diminta kode Anda dari sheet
export default function HalamanHandle() {
    const [wb] = useState(buat);
    const sheet = useRef(null);
    const [pilihan, setPilihan] = useState('');
    return (
        <div style={{ height: 600, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
                <button id="pilih" onClick={() => sheet.current.select('B2:C4')}>
                    Pilih B2:C4
                </button>
                <button onClick={() => sheet.current.scrollTo('A500')}>Ke A500</button>
                <button onClick={() => sheet.current.startEdit('=SUM(B2:B4)')}>Tulis SUM</button>
                <span style={{ marginLeft: 8 }}>{pilihan}</span>
            </div>
            <div style={{ flex: 1 }}>
                <Sheet ref={sheet} workbook={wb}
                    onSelectionChange={(sel) => setPilihan('sel aktif: baris ' + sel.active.r + ', kolom ' + sel.active.c)} />
            </div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<HalamanHandle />);
