import { createWorkbook } from '@kufayeka/sheet/core';

// beforeOp: pintu yang dilewati setiap perubahan sebelum diterapkan. Aplikasimu bisa meloloskan, mengubah, membuang diam-diam, atau menolak.
const wb = createWorkbook(null, {
    beforeOp(op, ctx) {
        // hanya perubahan isi sel dari orang yang diperiksa; kode aplikasi sendiri dibiarkan
        if (op.t !== 'cells' || ctx.source !== 'user') return op;
        const kolom = (ch) => ctx.workbook.colIndex(op.sheet, ch.col);
        // menolak: Qty (kolom B) lebih dari stok di D1
        const stok = ctx.workbook.value(op.sheet, 0, 3);
        if (op.changes.some((ch) => kolom(ch) === 1 && typeof ch.after === 'number' && ch.after > stok)) return { reject: 'Qty melebihi stok (' + stok + ')' };
        // mengubah: kode produk (kolom A) selalu huruf besar
        return { ...op, changes: op.changes.map((ch) => (kolom(ch) === 0 && typeof ch.after === 'string' ? { ...ch, after: ch.after.toUpperCase() } : ch)) };
    }
});
const s = wb.sheet('Sheet1');
s.setValues('C1', [['Stok', 50]]);
const ditolak = [];
wb.on('reject', (e) => ditolak.push(e.reason));

const orang = { source: 'user' };
s.setValues('A2', 'smn-01', orang);
s.setValues('B2', 40, orang);
s.setValues('B2', 80, orang);
console.log('A2 (diubah jadi huruf besar):', s.value('A2'));
console.log('B2 (80 ditolak, 40 tetap)   :', s.value('B2'));
console.log('ditolak                     :', ditolak.join(' / '));

s.setValues('B2', 999);                                  // kode aplikasi: source 'code', tidak diperiksa
console.log('dari kode                   :', s.value('B2'));
