import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import type { Op, OpContext } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// 8.7 beforeOp: aturan yang membaca sel lain. Qty yang dipesan (kolom C) tidak boleh melebihi stok (kolom B) di baris yang sama.
function periksa(op: Op, ctx: OpContext): Op | { reject: string } {
    if (op.t !== 'cells' || ctx.source !== 'user') return op;                  // hanya yang diketik orang
    const sheet = op.sheet ?? '';
    for (const ch of op.changes) {
        if (ctx.workbook.colIndex(sheet, ch.col) !== 2 || typeof ch.after !== 'number') continue;   // hanya kolom C
        const r = ctx.workbook.rowIndex(sheet, ch.row);
        const stok = ctx.workbook.value(sheet, r, 1);
        if (typeof stok === 'number' && ch.after > stok) return { reject: 'Qty melebihi stok (' + stok + ')' };
    }
    return op;
}

function buat() {
    const wb = createWorkbook(null, { beforeOp: periksa });                    // baru
    wb.sheet('Sheet1').setValues('A1', [['Produk', 'Stok', 'Dipesan'], ['Semen Portland 50 kg', 420, 0], ['Cat tembok 5 kg', 64, 0]]);
    wb.sheet('Sheet1').setStyle('A1:C1', { bold: true, fill: '#eef2f7' });
    wb.sheet('Sheet1').setColProps('A', { width: 180 });
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buat);
    return <div style={{ height: 300 }}><Sheet workbook={wb} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
