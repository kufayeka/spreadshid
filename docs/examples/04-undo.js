import { createWorkbook } from '@kufayeka/sheet/core';

// Undo, redo, dan apply: perubahan sebagai daftar op yang bisa disimpan, dikirim, dan diterapkan lagi di workbook lain.
const kasir = createWorkbook(null, { user: { id: 'k1', name: 'Kasir 1' } });
const log = [];
kasir.on('op', (e) => log.push(e));
kasir.setValues('Sheet1', 'A1', [['Barang', 'Qty'], ['Semen', 10]]);
kasir.setStyle('Sheet1', 'A1:B1', { bold: true });
kasir.insertRows('Sheet1', '2');
console.log('perubahan     :', log.map((e) => e.ops.map((o) => o.t).join('+')).join(', '));
console.log('bisa undo     :', kasir.canUndo(), '| bisa redo:', kasir.canRedo());

kasir.undo();
kasir.undo();
console.log('dua kali undo :', kasir.value('Sheet1', 'A1'), '| gaya A1:', kasir.style('Sheet1', 'A1') || 'tidak ada', '| bisa redo:', kasir.canRedo());
kasir.redo();
console.log('redo          :', JSON.stringify(kasir.style('Sheet1', 'A1')));

// op yang sama diterapkan di workbook lain yang isinya sama (misalnya di server, atau di komputer lain)
const server = createWorkbook(kasir.toJSON());
const sebelum = server.revision;
server.apply([{ t: 'cells', sheet: server.sheetIds()[0], changes: [{ row: server.rowId('Sheet1', 1), col: server.colId('Sheet1', 1), before: 10, after: 25 }] }], { source: 'remote' });
console.log('apply di server:', server.value('Sheet1', 'B2'), '| revision naik:', server.revision > sebelum, '| masuk undo:', server.canUndo());
console.log('op dicatat siapa:', log[0].ops[0].user.name, 'pada', typeof log[0].ops[0].at);
