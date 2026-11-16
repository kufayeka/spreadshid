import { createWorkbook } from '@kufayeka/sheet/core';

// 14.10 Pivot itu hidup: data berubah, pivot ikut; pengaturannya bisa diganti dari kode; selnya tidak bisa diketik orang;
// dan rumus di luar pivot membaca hasilnya seperti sel biasa. Data: kunjungan klinik, satu baris per pasien.
const wb = createWorkbook();
const kunjungan = wb.sheet('Sheet1');
kunjungan.setSheetProps({ name: 'Kunjungan' });
kunjungan.setValues('A1', [
    ['Tanggal',    'Poli',  'Pasien'],
    ['2026-11-02', 'Umum',  'Rina'],
    ['2026-11-02', 'Gigi',  'Tono'],
    ['2026-11-03', 'Umum',  'Budi'],
    ['2026-11-10', 'Anak',  'Dafa'],
    ['2026-11-11', 'Umum',  'Sari']
]);

const rekap = wb.sheet(wb.addSheet('Rekap'));
// Sumber sengaja dibuat sampai baris 500: baris kosong dilewati, dan kunjungan baru di bawahnya langsung ikut terhitung
const id = rekap.addPivot('A1', 'Kunjungan!A1:C500', {
    rows: ['Poli'],
    values: [{ field: 'Pasien', fn: 'COUNTA', as: 'Kunjungan' }]
});
// rumus biasa yang membaca pivot: berapa persen kunjungan ke poli Umum
rekap.setValues('D1', [['Porsi Umum'], ['=SUMIF(A:A, "Umum", B:B) / SUMIF(A:A, "Grand total", B:B)']]);
rekap.setStyle('D2', { format: { type: 'percent', decimals: 0 } });

const baris = () => rekap.pivots()[0].area;
const isi = () => {
    const a = baris();
    const hasil = [];
    for (let r = a.r1; r <= a.r2; r++) hasil.push(rekap.display(r, 0).text + ' ' + rekap.display(r, 1).text);
    return hasil.join(', ');
};

console.log('awal             :', isi(), '| porsi Umum', rekap.display('D2').text);

// 1. data bertambah: satu kunjungan baru di baris 7, pivot dihitung ulang dengan sendirinya
kunjungan.setValues('A7', [['2026-11-12', 'Gigi', 'Wati']]);
console.log('kunjungan baru   :', isi(), '| porsi Umum', rekap.display('D2').text);

// 2. pengaturan diganti dari kode: per minggu, bukan per poli
rekap.setPivot(id, { spec: { rows: ['Tanggal'], group: { Tanggal: 'week' }, values: [{ field: 'Pasien', fn: 'COUNTA', as: 'Kunjungan' }] } });
console.log('per minggu       :', isi());

// 3. orang mencoba mengetik di sel pivot: ditolak, karena pivot diubah lewat pengaturannya, bukan diketik
const ditolak = [];
wb.on('reject', (e) => ditolak.push(e.reason));
rekap.setValues('B2', 99, { source: 'user' });
console.log('diketik di pivot :', ditolak[0]);

// 4. pivot dihapus: sel yang tadi ditulisnya kosong lagi
rekap.removePivot(id);
console.log('dihapus          :', rekap.pivots().length, 'pivot, A1 sekarang', JSON.stringify(rekap.value('A1')));
