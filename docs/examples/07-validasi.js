import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const sh = wb.sheet('Sheet1');
const pesan = [];
wb.on('reject', (e) => pesan.push(e.reason));
sh.setValues('A1', [['Pekerjaan', 'Status', 'Volume', 'Selesai', 'Satuan']]);

sh.addValidation('B2:B50', { kind: 'list', values: ['Draft', 'Approved', 'Rejected'], help: 'Pilih status' });
sh.addValidation('C2:C50', { kind: 'number', op: 'gte', a: 0, reject: true });
sh.addValidation('D2:D50', { kind: 'checkbox' });
sh.setValues('G1', [['m3'], ['kg'], ['bh']]);
sh.addValidation('E2:E50', { kind: 'listFrom', source: 'G1:G3', reject: false }); // nilai lain diterima tapi ditandai

const user = { source: 'user' };
sh.setValues('B2', 'Approved', user);
sh.setValues('B3', 'Selesai', user);   // bukan pilihan: ditolak
sh.setValues('C2', -5, user);          // < 0: ditolak
sh.setValues('D2', true, user);
sh.setValues('E2', 'liter', user);     // diterima, tapi ditandai

console.log('B2, B3   :', sh.value('B2'), sh.value('B3'));
console.log('C2       :', sh.value('C2'));
console.log('ditolak  :', pesan.join(' | '));
console.log('pilihan  :', sh.choicesAt('E2').join(', '));
console.log('E2       :', sh.value('E2'), '-> tidak valid:', sh.invalidAt('E2'));
console.log('aturan D2:', sh.validationAt('D2').kind);
