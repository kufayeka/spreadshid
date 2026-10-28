import { createWorkbook } from '@kufayeka/sheet/core';
import type { Op, OpContext } from '@kufayeka/sheet/core';

// Pelajaran 10: beforeOp, pintu yang dilewati setiap perubahan. Bisa meloloskan, mengubah, membuang, atau menolak.
function periksa(op: Op, ctx: OpContext): Op | null | { reject: string } {
    // hanya perubahan isi sel dari orang yang diperiksa; kode aplikasi dibiarkan
    if (op.t !== 'cells' || ctx.source !== 'user') return op;
    const kolom = (col: string) => ctx.workbook.colIndex(op.sheet ?? '', col);
    // menolak: Qty (kolom B) lebih dari stok di D1
    const stok = ctx.workbook.value(op.sheet ?? '', 0, 3);
    if (op.changes.some((ch) => kolom(ch.col) === 1 && typeof ch.after === 'number' && typeof stok === 'number' && ch.after > stok)) {
        return { reject: 'Qty melebihi stok (' + stok + ')' };
    }
    // membuang diam-diam: isi kolom E (catatan internal) tidak boleh diubah orang
    const changes = op.changes.filter((ch) => kolom(ch.col) !== 4);
    if (!changes.length) return null;
    // mengubah: kode produk (kolom A) selalu huruf besar
    return { ...op, changes: changes.map((ch) => (kolom(ch.col) === 0 && typeof ch.after === 'string' ? { ...ch, after: ch.after.toUpperCase() } : ch)) };
}

const wb = createWorkbook(null, { beforeOp: periksa });
const s = wb.sheet('Sheet1');
s.setValues('C1', [['Stok', 50]]);
const ditolak: string[] = [];
wb.on('reject', (e) => ditolak.push(e.reason));

const orang = { source: 'user' } as const;
s.setValues('A2', 'smn-01', orang);
s.setValues('B2', 40, orang);
s.setValues('B2', 80, orang);
s.setValues('E2', 'catatan', orang);
console.log('A2 diubah jadi huruf besar :', s.value('A2'));
console.log('B2: 80 ditolak, 40 tetap   :', s.value('B2'));
console.log('E2 dibuang diam-diam       :', s.value('E2'));
console.log('ditolak                    :', ditolak.join(' / '));
s.setValues('B2', 999);                                  // kode aplikasi: source 'code', dibiarkan
console.log('dari kode                  :', s.value('B2'));
