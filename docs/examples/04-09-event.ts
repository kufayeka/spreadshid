import { createWorkbook } from '@kufayeka/sheet/core';
import type { WorkbookEvents } from '@kufayeka/sheet/core';

// Pelajaran 9: semua event workbook, kapan muncul, dan isi datanya. Tipe isi data setiap event ada di WorkbookEvents.
const wb = createWorkbook(null, { user: { id: 'user:rina', name: 'Rina' } });
const s = wb.sheet('Sheet1');
s.setValues('A1', [['Produk', 'Qty'], ['Semen', 10]]);
s.addValidation('B2:B50', { kind: 'number', op: 'gte', a: 0, reject: true, message: 'Qty di {cell} tidak boleh minus' });
s.setTypes({ columns: { C: { kind: 'int' } } });

// fungsi pendengar dengan tipe isi datanya sendiri
const padaOp = (e: WorkbookEvents['op']) => console.log('op       :', e.source, '|', e.ops.map((o) => o.t).join('+'));
const padaReject = (e: WorkbookEvents['reject']) => console.log('reject   :', e.source, '|', e.reason);

// wb.on(nama, fungsi) mengembalikan fungsi untuk berhenti mendengarkan
const off: Array<() => void> = [
    wb.on('op', padaOp),
    wb.on('reject', padaReject),
    wb.on('cellError', (e) => console.log('cellError:', e.address, JSON.stringify(e.value), 'bukan', e.expected)),
    wb.on('saved', (e) => console.log('saved    : versi', e.version)),
    wb.on('access', (e) => console.log('access   : peran', JSON.stringify(e.roles), '| pemilik', e.owner)),
    wb.on('layout', (e) => console.log('layout   : ukuran berubah', e.sheet ? '(satu sheet)' : '(semua sheet)'))
];

const orang = { source: 'user' } as const;
s.setValues('B2', 12, orang);                            // op
s.setValues('B2', -3, orang);                            // reject: validasi
s.setValues('C2', 2.5, orang);                           // cellError lalu reject: tipe kolom
s.setRowProps('2', { height: 40 });                      // op: props baris juga perubahan biasa
wb.undo();                                               // op dengan source undo
wb.saved(wb.pendingPatch(), { version: 7 });             // saved
wb.setAccess([{ who: 'role:kasir', effect: 'allow', action: 'read' }], { user: 'rina', roles: ['kasir'] });   // access, lalu layout
s.setValues('A2', 'Besi', orang);                        // reject: kasir hanya boleh membaca

off.forEach((stop) => stop());                           // berhenti mendengarkan
s.setValues('A3', 'Cat');
console.log('setelah berhenti: perubahan A3 tidak tercetak');
