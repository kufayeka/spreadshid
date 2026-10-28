import { createWorkbook } from '@kufayeka/sheet/core';

// Simulasi penyimpanan: sheet kecil seperti di Excel, lalu bentuk JSON-nya, lalu isi tabel-tabel database-nya,
// lalu apa yang berubah di tabel saat orang mengedit. Id asli berupa UUID panjang; di sini diganti nama pendek supaya mudah dibaca.

// ---- alat cetak: nama pendek untuk id, dan tabel bergaris seperti di layar database
const pendek = new Map();
const nama = (id, awalan) => { if (!pendek.has(id)) pendek.set(id, awalan + ([...pendek.values()].filter((x) => x.startsWith(awalan)).length + 1)); return pendek.get(id); };
const isiSel = (cells) => JSON.stringify(Object.fromEntries(Object.entries(cells).map(([k, v]) => [pendek.get(k) || k, v && v.f ? v.f.replace(/⟦\d+⟧/g, '…') : v])));
function tabel(judul, kolom, baris) {
    const lebar = kolom.map((k, i) => Math.max(k.length, ...baris.map((b) => String(b[i]).length)));
    const garis = '+' + lebar.map((l) => '-'.repeat(l + 2)).join('+') + '+';
    const satu = (b) => '| ' + b.map((x, i) => String(x).padEnd(lebar[i])).join(' | ') + ' |';
    console.log(judul);
    console.log([garis, satu(kolom), garis, ...baris.map(satu), garis].join('\n'));
}
function seperExcel(wb) {
    const s = wb.sheetIds()[0];
    const akhir = wb.lastFilled(s);
    const baris = [];
    for (let r = 0; r <= akhir.r; r++) baris.push([r + 1, ...Array.from({ length: akhir.c + 1 }, (_, c) => wb.display(s, r, c).text)]);
    tabel('', ['', ...Array.from({ length: akhir.c + 1 }, (_, c) => String.fromCharCode(65 + c))], baris);
}
function isiDatabase(doc) {
    const sh = doc.sheets[0];
    sh.columns.slice(0, 4).forEach((c) => nama(c.id, 'k'));
    tabel('tabel rows   (urut menurut key; kolom yang dipakai saja)', ['id', 'sheet_id', 'key', 'cells'],
        sh.rows.filter((r) => Object.keys(r.cells).length).sort((a, b) => (a.key < b.key ? -1 : 1)).map((r) => [nama(r.id, 'r'), 's1', r.key, isiSel(r.cells)]));
}

// ---- 1. di layar: daftar harga tiga produk
const wb = createWorkbook();
wb.setSheetProps('Sheet1', { name: 'Harga' });
wb.setValues('Harga', 'A1', [['Kode', 'Produk', 'Harga', 'Stok'], ['SMN-01', 'Semen 50 kg', 72000, 420], ['BSI-10', 'Besi 10 mm', 79500, 260], ['CAT-05', 'Cat 5 kg', 145000, 64]]);
wb.setValues('Harga', 'E1', [['Nilai'], ['=C2*D2'], ['=C3*D3'], ['=C4*D4']]);
console.log('1. YANG TAMPIL DI LAYAR (seperti Excel)');
seperExcel(wb);

// ---- 2. yang disimpan: toJSON(). Satu objek berisi sheet, kolom, dan baris; setiap sel disimpan di barisnya
const doc = wb.toJSON();
const sh = doc.sheets[0];
nama(doc.id, 'wb'); nama(sh.id, 's');
sh.columns.slice(0, 5).forEach((c) => nama(c.id, 'k'));
sh.rows.slice(0, 4).forEach((r) => nama(r.id, 'r'));
console.log('\n2. YANG DISIMPAN: wb.toJSON() (dipendekkan)');
console.log(JSON.stringify({ id: 'wb1', version: 0, sheets: [{ id: 's1', props: sh.props, columns: sh.columns.slice(0, 2).map((c) => ({ id: pendek.get(c.id), key: c.key })).concat(['…']),
    rows: sh.rows.slice(0, 2).map((r) => ({ id: pendek.get(r.id), key: r.key, cells: JSON.parse(isiSel(r.cells)) })).concat(['…']) }] }, null, 1).replace(/\n\s*/g, ' '));

// ---- 3. di database: empat tabel. Satu baris sheet = satu baris di tabel rows
console.log('\n3. DI DATABASE');
tabel('tabel workbooks', ['id', 'version'], [['wb1', 0]]);
tabel('tabel sheets', ['id', 'workbook_id', 'key', 'props'], [['s1', 'wb1', sh.key, JSON.stringify(sh.props)]]);
tabel('tabel columns (5 yang dipakai, dari 26)', ['id', 'sheet_id', 'key'], sh.columns.slice(0, 5).map((c) => [pendek.get(c.id), 's1', c.key]));
isiDatabase(doc);
console.log('Rumus disimpan dengan id kolom dan baris, bukan "C2": rumus tetap benar walau baris disisipkan. Ditulis … di sini.');

// ---- 4. orang mengubah stok besi menjadi 300: patch hanya berisi baris r3
wb.saved(wb.pendingPatch());
wb.setValues('Harga', 'D3', 300, { source: 'user' });
let patch = wb.pendingPatch();
console.log('\n4. STOK BESI DIUBAH JADI 300');
console.log('patch:', patch.rows.upsert.length, 'baris diubah (' + patch.rows.upsert.map((r) => pendek.get(r.id)).join(', ') + '),', patch.rows.delete.length, 'dihapus');
console.log('perintah ke database: UPDATE rows SET cells = ' + isiSel(patch.rows.upsert[0].cells) + ' WHERE id = \'' + pendek.get(patch.rows.upsert[0].id) + '\'');
console.log('Baris lain tidak disentuh. Nilai E3 (rumus) tidak dikirim: dihitung ulang saat dibuka.');

// ---- 5. baris baru disisipkan di antara semen dan besi: hanya SATU baris baru, dengan key di antara key kedua tetangganya
wb.saved(patch);
wb.insertRows('Harga', '3');
wb.setValues('Harga', 'A3', [['SMN-02', 'Semen putih', 112000, 35, '=C3*D3']], { source: 'user' });
patch = wb.pendingPatch();
console.log('\n5. BARIS BARU DISISIPKAN DI BARIS 3');
seperExcel(wb);
const baru = patch.rows.upsert.find((r) => !pendek.has(r.id));
console.log('patch:', patch.rows.upsert.length, 'baris -> INSERT INTO rows (id, key, cells) VALUES (\'' + nama(baru.id, 'r') + '\', \'' + baru.key + '\', ' + isiSel(baru.cells) + ')');
console.log('Baris besi dan cat TIDAK ditulis ulang walau nomornya bergeser: urutan ditentukan key, dan', baru.key, 'ada di antara',
    sh.rows[1].key, 'dan', sh.rows[2].key + '.');
wb.saved(patch);
isiDatabase(wb.toJSON());

// ---- 6. baris cat dihapus
wb.deleteRows('Harga', '5');
patch = wb.pendingPatch();
console.log('\n6. BARIS CAT DIHAPUS');
console.log('patch: DELETE FROM rows WHERE id IN (' + patch.rows.delete.map((id) => '\'' + pendek.get(id) + '\'').join(', ') + ')');

// ---- 7. dibuka lagi: baca keempat tabel, susun jadi bentuk toJSON(), createWorkbook
const dibuka = createWorkbook(wb.toJSON());
console.log('\n7. DIBUKA LAGI: E3 dihitung ulang dari rumusnya =', dibuka.input('Harga', 'E3'), '=', dibuka.value('Harga', 'E3'));
