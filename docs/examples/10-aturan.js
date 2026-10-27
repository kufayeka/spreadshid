import { createWorkbook } from '@kufayeka/sheet/core';
import { PRODUK, KOLOM_PRODUK } from './data/toko.js';

// Daftar produk yang dibuka kasir: harga beli tidak boleh terlihat, harga jual hanya boleh dibaca, produk yang dihentikan terkunci seluruhnya.
// Kasir hanya boleh mengubah stok dan status.
export function buatProdukKasir() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const p = wb.sheet('Sheet1');
    p.setSheetProps({ name: 'Produk', freezeRows: 1 });
    p.setValues('A1', [[...KOLOM_PRODUK, 'Status'], ...PRODUK.map((x, i) => [...x, i === 7 ? 'Dihentikan' : 'Aktif'])]);
    p.setStyle('A1:I1', { bold: true, fill: '#e8f0fe' });
    p.setColProps('E:F', { format: { type: 'money', decimals: 0 } });
    p.setColProps('B', { width: 180 });

    // aturan dari backend untuk peran "kasir". Kolom disebut menurut judulnya, jadi tetap benar walau kolom dipindah
    wb.setRules([
        { sheet: 'Produk', columns: ['Harga beli'], mode: 'hidden' },
        { sheet: 'Produk', columns: ['Kode', 'Nama produk', 'Kategori', 'Satuan', 'Harga jual', 'Stok min.'], mode: 'readonly',
            message: 'Data produk diatur bagian pembelian' },
        { sheet: 'Produk', range: 'A2:I1000', when: '=$I2="Dihentikan"', mode: 'readonly', message: 'Produk ini sudah dihentikan' }
    ]);
    return wb;
}

const wb = buatProdukKasir();
const p = wb.sheet('Produk');
const ditolak = [];
wb.on('reject', (e) => ditolak.push(e.reason));
const kasir = { source: 'user' };                            // yang diketik kasir di layar

p.setValues('G2', 400, kasir);                               // stok: boleh
p.setValues('F2', 1, kasir);                                 // harga jual: ditolak
p.setValues('G9', 30, kasir);                                // stok produk yang dihentikan: ditolak
p.setValues('I3', 'Dihentikan', kasir);                      // status: boleh, dan baris itu langsung terkunci
p.setValues('G3', 50, kasir);
console.log('stok G2, G3   :', p.value('G2'), p.value('G3'));
console.log('ditolak       :');
for (const alasan of ditolak) console.log('  -', alasan);

console.log('mode sel      :', ['E2', 'F2', 'G2', 'G9'].map((a) => a + ' ' + ((p.modeAt(a) || {}).mode || 'bebas')).join(' | '));
console.log('harga beli E2 :', p.display('E2').text, '| input', JSON.stringify(p.input('E2')), '| judul E1 tetap:', p.display('E1').text);

// kode aplikasi sendiri tidak dihalangi aturan: misalnya sinkron harga dari sistem pembelian
p.setValues('F2', 75000);
console.log('dari kode     :', p.display('F2').text);

// aturan bukan bagian workbook: tidak disimpan, tidak masuk undo, diganti utuh oleh setRules berikutnya
console.log('isi toJSON    :', Object.keys(wb.toJSON()).join(', '), '(aturan tidak ikut)');
wb.setRules([]);                                             // peran manajer: tanpa aturan
console.log('manajer       :', p.display('E2').text, '| mode F2', p.modeAt('F2'));
