import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
wb.setSheetProps('Sheet1', { name: 'BOQ' });
const boq = wb.sheet('BOQ');
boq.setValues('A1', [
    ['Pekerjaan', 'Volume', 'Harga', 'Status', 'Biaya internal'],
    ['Galian', 120, 85000, 'Draft', 70000],
    ['Urugan', 40, 210000, 'Approved', 180000]
]);
const ditolak = [];
wb.on('reject', (e) => ditolak.push(e.reason));

// aturan dari backend untuk orang ini: kolom Harga hanya baca, baris Approved terkunci, biaya internal tersembunyi
wb.setRules([
    { sheet: 'BOQ', columns: ['Harga'], mode: 'readonly', message: 'Harga diatur estimator' },
    { sheet: 'BOQ', range: 'A2:E500', when: '=$D2="Approved"', mode: 'readonly', message: 'Baris yang sudah approved terkunci' },
    { sheet: 'BOQ', columns: ['Biaya internal'], mode: 'hidden' }
]);

const user = { source: 'user' };
boq.setValues('B2', 125, user);      // boleh
boq.setValues('C2', 1, user);        // kolom Harga: ditolak
boq.setValues('B3', 50, user);       // baris Approved: ditolak
boq.setValues('C2', 90000);          // kode sendiri: tidak dihalangi

console.log('B2, C2, B3     :', boq.value('B2'), boq.value('C2'), boq.value('B3'));
console.log('ditolak        :', ditolak.join(' | '));
console.log('mode C2, B3, A2:', JSON.stringify(boq.modeAt('C2')), JSON.stringify(boq.modeAt('B3')), JSON.stringify(boq.modeAt('A2')));
console.log('E2 tampil      :', boq.display('E2').text, '| input:', JSON.stringify(boq.input('E2')), '| nilai asli tetap ada:', boq.value('E2'));
console.log('judul E1 tetap :', boq.display('E1').text);
