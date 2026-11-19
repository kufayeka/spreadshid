import { createWorkbook, viewFor } from '@kufayeka/sheet/core';

// 14.13 Pivot dan hak akses. Data: penjualan per salesman, dengan kolom Margin (keuntungan) yang hanya boleh dilihat manajer.
// Satu workbook yang sama dibuka manajer dan salesman. Pertanyaannya: apakah pivot bisa dipakai salesman untuk mengintip margin?
// Jawabannya tidak: pivot membaca sel yang tidak boleh dibaca seseorang sebagai KOSONG, jadi ringkasannya pun tidak membocorkan isinya.
function buat() {
    const wb = createWorkbook();
    const jual = wb.sheet('Sheet1');
    jual.setSheetProps({ name: 'Penjualan' });
    jual.setValues('A1', [
        ['Sales', 'Wilayah', 'Omzet',   'Margin'],
        ['Rudi',  'Barat',   12000000,  2400000],
        ['Sari',  'Barat',    9500000,  2100000],
        ['Tomi',  'Timur',   15000000,  2250000],
        ['Wina',  'Timur',    7000000,  1750000]
    ]);
    const rekap = wb.sheet(wb.addSheet('Rekap'));
    rekap.addPivot('A1', 'Penjualan!A1:D5', {
        rows: ['Wilayah'],
        values: [{ field: 'Omzet', fn: 'SUM', as: 'Omzet' }, { field: 'Margin', fn: 'SUM', as: 'Margin' }]
    });
    return wb;
}

// Semua orang boleh membaca; kolom Margin (D) ditutup untuk role sales
const ATURAN = [
    { who: '*', effect: 'allow', action: 'read' },
    { who: 'group:sales', effect: 'deny', action: 'read', where: 'Penjualan!D1:D100' }
];
const ORANG = { users: [{ id: 'bu-ani', name: 'Ani' }, { id: 'rudi', name: 'Rudi' }], groups: { manajer: ['bu-ani'], sales: ['rudi'] } };
const ringkas = (wb) => [1, 2, 3].map((r) => wb.display('Rekap', r, 0).text + ' ' + wb.value('Rekap', r, 1) + ' / ' + wb.value('Rekap', r, 2)).join(' | ');

// 1. di browser: workbook diberi hak akses orang yang membukanya (<Sheet access> melakukan ini), pivot dihitung ulang untuk orang itu
const manajer = buat();
manajer.setPeople({ users: [{ id: 'bu-ani', name: 'BU-ANI' }], groups: { manajer: ['bu-ani'] } });
manajer.setWho({ who: 'bu-ani' });
manajer.setAccess(ATURAN);
console.log('manajer  (Omzet / Margin):', ringkas(manajer));

const sales = buat();
sales.setPeople({ users: [{ id: 'rudi', name: 'RUDI' }], groups: { sales: ['rudi'] } });
sales.setWho({ who: 'rudi' });
sales.setAccess(ATURAN);
console.log('salesman (Omzet / Margin):', ringkas(sales));

// 2. di server: viewFor menyiapkan dokumen yang dikirim ke salesman. Isi kolom Margin tidak ikut terkirim sama sekali,
//    jadi ringkasan yang dihitung di browsernya juga tidak punya angka margin.
const dokumenSales = viewFor(buat().toJSON(), { access: ATURAN, who: 'rudi', people: ORANG });
const dibukaSales = createWorkbook(dokumenSales);
dibukaSales.setPeople({ users: [{ id: 'rudi', name: 'RUDI' }], groups: { sales: ['rudi'] } });
dibukaSales.setWho({ who: 'rudi' });
dibukaSales.setAccess(ATURAN);
console.log('dikirim server ke salesman:', ringkas(dibukaSales));
