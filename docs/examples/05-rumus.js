import { createWorkbook } from '@kufayeka/sheet/core';

// now: jam untuk TODAY() dan NOW(), dipatok supaya hasil contoh ini selalu sama
const wb = createWorkbook(null, { now: () => new Date(2026, 9, 27, 9, 0) });
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

const harga = wb.sheet(wb.addSheet('Harga'));
harga.setValues('A1', [['Kode', 'Material', 'Harga'], ['B01', 'Beton K-300', 1250000], ['S01', 'Besi', 14500]]);

const boq = wb.sheet('Sheet1');
boq.setValues('A1', [
    ['Kode', 'Volume', 'Harga', 'Jumlah', 'Status'],
    ['B01', 18.5, '=VLOOKUP(A2, Harga!A2:C3, 3, FALSE)', '=B2*C2', '=IF(D2>30000000, "Besar", "Kecil")'],
    ['S01', 2400, '=VLOOKUP(A3, Harga!A2:C3, 3, FALSE)', '=B3*C3', '=IF(D3>30000000, "Besar", "Kecil")'],
    ['', '', 'Total', '=SUM(D2:D3)', '=ROUND(D4/1000000, 1) & " juta"']
]);
console.log('harga dari sheet lain :', boq.value('C2'), boq.value('C3'));
console.log('jumlah                :', boq.value('D2'), boq.value('D3'));
console.log('IF                    :', boq.value('E2'), boq.value('E3'));
console.log('total                 :', boq.value('D4'), '|', boq.value('E4'));

// sheet diganti nama: rumus yang menunjuk ke sana ikut berubah
wb.setSheetProps(harga.id, { name: 'Daftar Harga' });
console.log('setelah ganti nama    :', boq.input('C2'));

// tanggal dan error
boq.setValues('G1', [['=TODAY()'], ['=DATE(2026, 12, 31) - TODAY()'], ['=1/0'], ['=Tidak_Ada * 2'], ['=SQRT(-1)']]);
console.log('TODAY() sebagai angka :', boq.value('G1'));
console.log('hari ke akhir tahun   :', boq.value('G2'));
console.log('error                 :', [3, 4, 5].map((r) => boq.value('G' + r).code).join(', '));
