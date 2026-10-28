import { createWorkbook } from '@kufayeka/sheet/core';
import type { Op } from '@kufayeka/sheet/core';

// Pelajaran 3: semua bentuk isi yang diterima setValues, setBlock untuk sel yang berjauhan, clear, dan apa yang dikembalikan.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const s = wb.sheet('Sheet1');
const lihat = (range: string) => {
    const [a, b] = range.split(':');
    const r1 = Number(a.slice(1)) - 1, r2 = Number(b.slice(1)) - 1, c1 = a.charCodeAt(0) - 65, c2 = b.charCodeAt(0) - 65;
    const out: string[] = [];
    for (let r = r1; r <= r2; r++) { const row: string[] = []; for (let c = c1; c <= c2; c++) row.push(s.display(r, c).text || '·'); out.push(row.join(' | ')); }
    return out.join('  /  ');
};

s.setValues('A1', 'Semen');                                     // satu nilai
s.setValues('A2', [['Kode', 'Produk', 'Harga']]);               // satu baris: ke kanan
s.setValues('A3', [['SMN-01'], ['BSI-10']]);                    // satu kolom: ke bawah
s.setValues('E1', ['Senin', 'Selasa', 'Rabu']);                 // array biasa: juga ke bawah
s.setValues('B3', [['Semen 50 kg', 72000], ['Besi 10 mm', 79500]]);   // tabel: satu array = satu baris
console.log('A1:C4 :', lihat('A1:C4'));
console.log('E1:E3 :', lihat('E1:E3'));

s.setValues('D2', [['Harga + PPN'], ['=C3*1.11'], ['=C4*1.11']]); // rumus
s.setValues('F1', "'=bukan rumus");                              // kutip satu di depan: teks apa adanya
s.setValues('A1', null);                                         // kosongkan
console.log('D3    :', s.value('D3'), '| F1:', s.value('F1'), '| A1:', s.value('A1'));

// setBlock: banyak sel di mana saja, isi dan gaya, sebagai SATU perubahan (satu undo)
s.setBlock([
    { at: 'B6', value: 'Total', style: { bold: true } },
    { at: 'C6', value: '=SUM(C3:C4)', style: { bold: true, format: { type: 'money', decimals: 0 } } }
]);
console.log('B6:C6 :', lihat('B6:C6'));

// setiap fungsi yang mengubah mengembalikan op yang diterapkan (atau null kalau ditolak)
const ops: Op[] | null = s.clear('E1:E3');
console.log('clear :', ops && ops.map((o) => o.t).join(', '), '| E1 sekarang', s.value('E1'));
wb.undo();
console.log('undo  :', s.value('E1'));
