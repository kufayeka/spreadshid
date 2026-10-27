import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook(null, {
    user: { id: 'u1', name: 'Rina' },
    // melihat setiap perubahan sebelum diterapkan: kembalikan op, null (abaikan), atau { reject: 'alasan' }
    beforeOp(op, ctx) {
        if (op.t === 'deleteRows' && ctx.source === 'user') return { reject: 'Baris BOQ tidak boleh dihapus' };
        return op;
    }
});
const [s] = wb.sheetIds();

wb.on('op', (e) => console.log('op     :', e.source, '->', e.ops.map((o) => o.t).join(', ')));
wb.on('reject', (e) => console.log('tolak  :', e.reason));

wb.setValues(s, 0, 0, 5, { source: 'user' }); // seperti diketik orang
wb.setValues(s, 0, 0, 7);                     // dari kode Anda
wb.undo();
console.log('undo   :', wb.value(s, 0, 0));
wb.redo();
console.log('redo   :', wb.value(s, 0, 0));

wb.deleteRows(s, 0, 1, { source: 'user' }); // ditolak oleh beforeOp
console.log('baris  :', wb.size(s).rows);
