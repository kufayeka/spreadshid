import { createWorkbook } from '@kufayeka/sheet/core';

// Semua event workbook, dan isi data yang dibawa masing-masing.
const wb = createWorkbook(null, { user: { id: 'user:rina', name: 'Rina' } });
const s = wb.sheet('Sheet1');
s.setValues('A1', [['Produk', 'Qty'], ['Semen', 10]]);
s.addValidation('B2:B50', { kind: 'number', op: 'gte', a: 0, reject: true, message: 'Qty di {cell} tidak boleh minus' });
s.setTypes({ columns: { C: { kind: 'int' } } });

// wb.on(nama, fungsi) mengembalikan fungsi untuk berhenti mendengarkan
const off = [
    wb.on('op', (e) => console.log('op       :', e.source, '|', e.ops.map((o) => o.t).join('+'), '| oleh', e.ops[0].user && e.ops[0].user.name)),
    wb.on('reject', (e) => console.log('reject   :', e.source, '|', e.reason)),
    wb.on('cellError', (e) => console.log('cellError:', e.address, JSON.stringify(e.value), 'bukan', e.expected)),
    wb.on('saved', (e) => console.log('saved    : versi', e.version)),
    wb.on('layout', (e) => console.log('layout   : ukuran baris atau kolom berubah', e.sheet ? '(satu sheet)' : '(semua sheet)')),
    wb.on('access', (e) => console.log('access   : peran', JSON.stringify(e.roles), '| pemilik', e.owner))
];

const orang = { source: 'user' };
s.setValues('B2', 12, orang);                            // op
s.setValues('B2', -3, orang);                            // reject (validasi)
s.setValues('C2', 2.5, orang);                           // cellError + reject (tipe kolom)
s.setRowProps('2', { height: 40 });                      // op (props baris juga perubahan biasa)
wb.undo();                                               // op dengan source undo
wb.saved(wb.pendingPatch(), { version: 7 });             // saved
wb.setAccess({ default: 'kasir', roles: { kasir: { can: ['sort'] } } }, 'user:rina');   // access, lalu layout
s.setValues('A2', 'Besi', orang);                        // reject (kasir hanya boleh sort)

off.forEach((f) => f());                                 // berhenti mendengarkan
s.setValues('A3', 'Cat');
console.log('setelah off: tidak ada yang tercetak untuk A3');
