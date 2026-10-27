import { createWorkbook, fromApiMakerType, checkValue } from '@kufayeka/sheet/core';

// Type dari Nexa API Maker (types/BoqLine.type.json), plus enum yang dipakainya
const BoqLine = { name: 'BoqLine', fields: { Volume: { type: 'decimal', scale: 2 }, Jumlah: { type: 'int' }, Status: { type: 'StatusBoq' }, Mulai: { type: 'date' } } };
const library = { StatusBoq: { name: 'StatusBoq', enum: ['Draft', 'Approved'] } };

const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID' });
const sh = wb.sheet('Sheet1');
sh.setValues('A1', [['Pekerjaan', 'Volume', 'Jumlah', 'Status', 'Mulai']]);
// header di baris 1 menyebut nama field: kolom dengan judul itu dapat tipenya
sh.setTypes({ headerRow: 1, fields: fromApiMakerType(BoqLine, library).fields });

const salah = [];
wb.on('cellError', (e) => salah.push(e.address + ' ' + e.field + ' = ' + JSON.stringify(e.value) + ', expected: ' + e.expected));
const user = { source: 'user' };
sh.setValues('B2', '12,555', user);   // 3 desimal: ditolak
sh.setValues('B2', '12,5', user);
sh.setValues('C2', 3.5, user);        // bukan bilangan bulat
sh.setValues('D2', 'Selesai', user);  // bukan nilai enum
sh.setValues('D2', 'Approved', user);
sh.setValues('E2', 'besok', user);    // bukan tanggal

console.log('B2, D2   :', sh.value('B2'), sh.value('D2'));
console.log('cellError:');
for (const s of salah) console.log('  ' + s);
console.log('tipe B2  :', JSON.stringify(sh.typeAt('B2')));
console.log('checkValue langsung:', JSON.stringify(checkValue({ kind: 'int' }, 4)), JSON.stringify(checkValue({ kind: 'int' }, 4.5)));
