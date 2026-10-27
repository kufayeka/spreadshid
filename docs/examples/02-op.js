import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook(null, {
    user: { id: 'u1', name: 'Rina' },
    // lihat tiap perubahan sebelum diterapkan: kembalikan op, null (abaikan), atau { reject: 'alasan' }
    beforeOp(op, ctx) {
        if (op.t === 'deleteRows' && ctx.source === 'user') return { reject: 'Baris BOQ tidak boleh dihapus' };
        return op;
    }
});
const sh = wb.sheet('Sheet1');

wb.on('op', (e) => console.log('op     :', e.source, '->', e.ops.map((o) => o.t).join(', ')));
wb.on('reject', (e) => console.log('tolak  :', e.reason));

sh.setValues('A1', 5, { source: 'user' }); // seolah diketik orang
sh.setValues('A1', 7);                     // dari kode
wb.undo();
console.log('undo   :', sh.value('A1'));
wb.redo();
console.log('redo   :', sh.value('A1'));

sh.deleteRows('1', { source: 'user' }); // ditolak beforeOp
console.log('baris  :', sh.size().rows);
