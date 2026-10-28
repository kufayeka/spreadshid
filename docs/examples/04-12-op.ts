import { createWorkbook } from '@kufayeka/sheet/core';
import type { Op } from '@kufayeka/sheet/core';

// Pelajaran 12: seperti apa sebuah op. Setiap perubahan dicetak dengan id diganti nama pendek supaya mudah dibaca.
const wb = createWorkbook(null, { user: { id: 'u1', name: 'Rina' }, now: () => new Date(Date.UTC(2026, 9, 27, 9, 0)) });
const s = wb.sheet('Sheet1');
const pendek = new Map<string, string>();
const nama = (id: string) => { if (!pendek.has(id)) pendek.set(id, 'id' + (pendek.size + 1)); return pendek.get(id) ?? id; };
const ringkas = (op: Op): string => {
    switch (op.t) {
        case 'cells': case 'styles':
            return op.t + ' ' + op.changes.map((ch) => nama(ch.row) + '/' + nama(ch.col) + ': ' + JSON.stringify(ch.before) + ' -> ' + JSON.stringify(ch.after)).join(', ');
        case 'insertRows': case 'deleteRows':
            return op.t + ' ' + op.rows.map((r) => nama(r.id) + ' key ' + r.key).join(', ');
        case 'rowProps': case 'colProps':
            return op.t + ' ' + op.changes.map((ch) => nama(ch.id) + ': ' + JSON.stringify(ch.before) + ' -> ' + JSON.stringify(ch.after)).join(', ');
        case 'sheetProps': case 'settings':
            return op.t + ' ' + JSON.stringify(op.before) + ' -> ' + JSON.stringify(op.after);
        default:
            return op.t;
    }
};
wb.on('op', (e) => e.ops.forEach((op) => console.log(e.source.padEnd(5), '|', ringkas(op), '| oleh', JSON.stringify(op.user), 'pada', op.at)));

s.setValues('A1', 'Semen');
s.setStyle('A1', { bold: true });
s.setValues('B1', '=A1');
s.insertRows('1');
s.setColProps('A', { width: 140 });
s.setSheetProps({ freezeRows: 1 });
wb.setSettings({ locale: 'id-ID' });
wb.undo();
