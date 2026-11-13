import { createWorkbook } from '@kufayeka/sheet/core';

// Merekam History / Audit Trail Excel dari event wb.on('op')
const wb = createWorkbook(null, {
    user: { id: 'u-andi', name: 'Andi' },
    now: () => new Date(Date.UTC(2026, 10, 13, 4, 30)),
});
const sh = wb.sheet('Sheet1');
sh.setSheetProps({ name: 'Stok' });
sh.setValues('A1', [['Produk', 'Qty'], ['Semen', 100]]);

// Buffer audit log untuk dikirim ke API (/api/workbooks/:id/history)
const auditLogs = [];
const namaSheet = (id) => wb.sheetProps(id)?.name ?? id;

wb.on('op', ({ ops, source }) => {
    for (const op of ops) {
        const sheetName = op.sheet ? namaSheet(op.sheet) : null;
        if (op.t === 'cells') {
            for (const ch of op.changes) {
                const r = wb.rowIndex(op.sheet, ch.row);
                const c = wb.colIndex(op.sheet, ch.col);
                auditLogs.push({
                    at: op.at,
                    user: op.user,
                    source,
                    action: 'edit_cell',
                    sheet: sheetName,
                    address: r >= 0 && c >= 0 ? wb.address(r, c) : `${ch.row}:${ch.col}`,
                    before: ch.before,
                    after: ch.after,
                });
            }
        } else {
            auditLogs.push({ at: op.at, user: op.user, source, action: op.t, sheet: sheetName });
        }
    }
});

// Simulasi aktivitas user: ubah Qty lalu undo
sh.setValues('B2', 125, { source: 'user' });
wb.undo();

for (const log of auditLogs) {
    console.log(`${log.at} | ${log.user?.name} | ${log.source.padEnd(4)} | ${log.action} ${log.sheet}!${log.address} (${log.before} -> ${log.after})`);
}
