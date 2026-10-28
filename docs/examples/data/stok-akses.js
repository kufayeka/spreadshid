import { createWorkbook } from '@kufayeka/sheet/core';
import { PRODUK, KOLOM_PRODUK } from './toko.js';

// Bahan bersama bab 13: workbook stok toko, dan "peta akses" yang mencetak apa yang didapat seseorang di setiap sel.

/** Sheet Produk: Kode, Nama produk, Kategori, Satuan, Harga beli, Harga jual, Stok, Stok min., Status (A..I), 12 produk. */
export function buatStok() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const p = wb.sheet('Sheet1');
    p.setSheetProps({ name: 'Produk' });
    p.setValues('A1', [[...KOLOM_PRODUK, 'Status'], ...PRODUK.map((x, i) => [...x, i === 7 ? 'Dihentikan' : 'Aktif'])]);
    p.setStyle('A1:I1', { bold: true, fill: '#eef2f7' });
    return wb;
}

const TANDA = { edit: 'E', readonly: 'r', hidden: '•', invisible: '.' };

/**
 * Peta akses baris 1-5, kolom A-I, untuk satu orang:
 *   E = boleh diubah, r = hanya baca, • = tersembunyi (•••), . = tidak terlihat (kosong)
 */
export function peta(wb, rows, who, judul) {
    wb.setAccess(rows, who);
    console.log(judul);
    console.log('      A B C D E F G H I');
    for (let r = 0; r < 5; r++) {
        let line = '  ' + String(r + 1).padStart(2) + '  ';
        for (let c = 0; c < 9; c++) {
            const m = wb.modeAt('Produk', r, c);
            line += (m ? TANDA[m.mode] : TANDA.edit) + ' ';
        }
        console.log(line);
    }
}
