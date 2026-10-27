import { createWorkbook, fromApiMakerType, checkValue } from '@kufayeka/sheet/core';

// Master produk yang nanti disimpan ke database: setiap kolom punya tipe, jadi yang masuk ke sheet sudah pasti cocok dengan tabelnya.
// Tipe ditulis seperti Type di Nexa API Maker (types/Produk.type.json), atau langsung dalam bentuk kind.
const Produk = {
    name: 'Produk',
    fields: {
        Kode: { type: 'string' },
        Nama: { type: 'string' },
        Kategori: { type: 'KategoriProduk' },
        Harga: { type: 'decimal', scale: 0 },
        Stok: { type: 'int' },
        Aktif: { type: 'boolean' },
        'Mulai dijual': { type: 'date' }
    }
};
const library = { KategoriProduk: { name: 'KategoriProduk', enum: ['Semen', 'Besi', 'Cat', 'Keramik', 'Pipa'] } };

const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const p = wb.sheet('Sheet1');
p.setValues('A1', [['Kode', 'Nama', 'Kategori', 'Harga', 'Stok', 'Aktif', 'Mulai dijual']]);
// judul di baris 1 menyebut nama field: kolom dengan judul itu mendapat tipenya
p.setTypes({ headerRow: 1, fields: fromApiMakerType(Produk, library).fields });
console.log('tipe kolom    :', ['A2', 'C2', 'D2', 'E2', 'F2', 'G2'].map((a) => { const t = p.typeAt(a); return a[0] + ' ' + t.kind + (t.enum ? ' (pilihan ' + t.enum.length + ')' : ''); }).join(', '));

const salah = [];
wb.on('cellError', (e) => salah.push(e.address + ' ' + e.field + ': ' + JSON.stringify(e.value) + ' bukan ' + e.expected));
const orang = { source: 'user' };
p.setValues('A2', '0081', orang);                          // string: angka yang diketik tetap teks
p.setValues('B2', 'Semen Portland 50 kg', orang);
p.setValues('C2', 'Semen', orang);
p.setValues('C3', 'Pasir', orang);                         // bukan nilai enum
p.setValues('D2', '72.000', orang);
p.setValues('D3', '72.000,5', orang);                      // decimal dengan scale 0: tidak boleh ada desimal
p.setValues('E2', 420, orang);
p.setValues('E3', 12.5, orang);                            // int
p.setValues('F2', 'TRUE', orang);
p.setValues('F3', 'ya', orang);                            // boolean
p.setValues('G2', '01/10/2026', orang);
p.setValues('G3', 'minggu depan', orang);                  // date

console.log('baris 2       :', ['A2', 'B2', 'C2', 'D2', 'E2', 'F2', 'G2'].map((a) => JSON.stringify(p.value(a))).join(', '));
console.log('ditolak       :');
for (const s of salah) console.log('  -', s);
console.log('baris 3 tetap :', ['C3', 'D3', 'E3', 'F3', 'G3'].map((a) => JSON.stringify(p.value(a))).join(', '));

// tipe per huruf kolom, tanpa judul, untuk sheet lain
const w2 = createWorkbook();
w2.sheet('Sheet1').setTypes({ columns: { B: { kind: 'int' }, C: { kind: 'string', enum: ['Grosir', 'Eceran'] } } });
w2.setValues('Sheet1', 'B1', 3.5, orang);
w2.setValues('Sheet1', 'C1', 'Eceran', orang);
console.log('per huruf     :', JSON.stringify(w2.value('Sheet1', 'B1')), JSON.stringify(w2.value('Sheet1', 'C1')), JSON.stringify(w2.sheet('Sheet1').typeAt('C1')));

// checkValue: pemeriksaan yang sama tanpa sheet, misalnya di server sebelum menyimpan
console.log('checkValue    :', JSON.stringify(checkValue({ kind: 'int' }, 4)), JSON.stringify(checkValue({ kind: 'int' }, 4.5)), JSON.stringify(checkValue({ kind: 'decimal', scale: 2 }, 1.234)));
