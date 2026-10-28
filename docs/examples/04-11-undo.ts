import { createWorkbook } from '@kufayeka/sheet/core';
import type { Op, WorkbookEvents } from '@kufayeka/sheet/core';

// Pelajaran 11: undo dan redo, source, dan apply: perubahan sebagai daftar op yang bisa dicatat, dikirim, dan diterapkan di workbook lain.
const kasir = createWorkbook(null, { user: { id: 'k1', name: 'Kasir 1' }, now: () => new Date(Date.UTC(2026, 9, 27, 9, 0)) });
const log: Array<WorkbookEvents['op']> = [];
kasir.on('op', (e) => log.push(e));
const s = kasir.sheet('Sheet1');

s.setValues('A1', [['Barang', 'Qty'], ['Semen', 10]]);   // perubahan 1
s.setStyle('A1:B1', { bold: true });                     // perubahan 2
s.insertRows('2');                                       // perubahan 3
console.log('perubahan  :', log.map((e) => e.ops.map((o) => o.t).join('+')).join(', '));
console.log('bisa undo  :', kasir.canUndo(), '| bisa redo:', kasir.canRedo(), '| revision', kasir.revision);

kasir.undo(); kasir.undo();
console.log('dua undo   :', s.value('A1'), '| gaya A1:', s.style('A1') ?? 'tidak ada', '| bisa redo:', kasir.canRedo());
kasir.redo();
console.log('redo       :', JSON.stringify(s.style('A1')));
console.log('op dicatat :', log[0].ops[0].at, 'oleh', JSON.stringify(log[0].ops[0].user));

// op yang sama diterapkan di workbook lain yang isinya sama (server, atau komputer lain)
const server = createWorkbook(kasir.toJSON());
const ops: Op[] = log[0].ops;
const sesudah: Op[] | null = server.apply([{ t: 'cells', sheet: server.sheetIds()[0], changes: [{ row: server.rowId('Sheet1', 1), col: server.colId('Sheet1', 1), before: 10, after: 25 }] }], { source: 'remote' });
console.log('apply      :', server.value('Sheet1', 'B2'), '| diterapkan', sesudah?.length, 'op | masuk undo server:', server.canUndo(), '| op kasir pertama:', ops[0].t);
