// Data contoh untuk bab 4-10: sebuah toko bangunan dengan tiga cabang. Produk dengan harga beli, harga jual dan stok, dan 300 transaksi penjualan
// bulan Oktober 2026. Angkanya dibuat dari rumus tetap (bukan acak), jadi hasil contoh selalu sama.

export const PRODUK = [
    // kode, nama, kategori, satuan, harga beli, harga jual, stok, stok minimum
    ['SMN-01', 'Semen Portland 50 kg', 'Semen', 'zak', 64000, 72000, 420, 100],
    ['SMN-02', 'Semen putih 40 kg', 'Semen', 'zak', 98000, 112000, 35, 40],
    ['BSI-10', 'Besi beton 10 mm', 'Besi', 'batang', 68000, 79500, 260, 80],
    ['BSI-13', 'Besi beton 13 mm', 'Besi', 'batang', 112000, 128000, 150, 60],
    ['CAT-05', 'Cat tembok 5 kg putih', 'Cat', 'galon', 118000, 145000, 64, 30],
    ['CAT-25', 'Cat tembok 25 kg putih', 'Cat', 'pail', 515000, 610000, 12, 15],
    ['KRM-60', 'Keramik 60x60 abu', 'Keramik', 'dus', 142000, 168000, 210, 50],
    ['KRM-40', 'Keramik 40x40 putih', 'Keramik', 'dus', 69000, 82000, 0, 50],
    ['PIP-34', 'Pipa PVC 3/4 inch', 'Pipa', 'batang', 31000, 38500, 340, 100],
    ['PIP-04', 'Pipa PVC 4 inch', 'Pipa', 'batang', 128000, 152000, 48, 30],
    ['BTR-01', 'Bata ringan 10 cm', 'Bata', 'm3', 640000, 735000, 22, 10],
    ['PSR-01', 'Pasir beton', 'Pasir', 'm3', 245000, 290000, 31, 10]
];
export const KOLOM_PRODUK = ['Kode', 'Nama produk', 'Kategori', 'Satuan', 'Harga beli', 'Harga jual', 'Stok', 'Stok min.'];

export const CABANG = ['Jakarta', 'Bandung', 'Surabaya'];
export const SALES = { Jakarta: ['Rina', 'Dodi'], Bandung: ['Asep', 'Wulan'], Surabaya: ['Bayu', 'Sari'] };

/**
 * 300 transaksi penjualan Oktober 2026: { No, Tanggal (nomor hari), Cabang, Sales, Kode, Produk, Kategori, Qty, Harga, Diskon }.
 * Tanggal disimpan sebagai nomor hari (seperti sel tanggal di sheet); 46296 = 1 Oktober 2026.
 */
export function penjualan(n = 300) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const p = PRODUK[(i * 7 + (i >> 3)) % PRODUK.length];
        const cabang = CABANG[(i * 5 + (i >> 2)) % 3];
        const sales = SALES[cabang][(i >> 1) % 2];
        const qty = 1 + ((i * 13) % 17) + (p[2] === 'Semen' ? 10 : 0);
        const diskon = i % 9 === 0 ? 0.05 : i % 23 === 0 ? 0.1 : 0;
        out.push({ No: i + 1, Tanggal: 46296 + Math.floor(i / 10), Cabang: cabang, Sales: sales, Kode: p[0], Produk: p[1], Kategori: p[2], Qty: qty, Harga: p[5], Diskon: diskon });
    }
    return out;
}
export const KOLOM_PENJUALAN = ['No', 'Tanggal', 'Cabang', 'Sales', 'Kode', 'Produk', 'Kategori', 'Qty', 'Harga', 'Diskon', 'Total'];

/** Baris penjualan untuk setValues mulai baris `start` (nomor layar), dengan kolom Total sebagai rumus. */
export function barisPenjualan(rows, start = 2) {
    return rows.map((x, i) => {
        const r = start + i;
        return [x.No, x.Tanggal, x.Cabang, x.Sales, x.Kode, x.Produk, x.Kategori, x.Qty, x.Harga, x.Diskon, `=H${r}*I${r}*(1-J${r})`];
    });
}
