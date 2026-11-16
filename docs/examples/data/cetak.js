// Bantuan bab 14: hasil sebuah pivot ditulis sebagai tabel markdown, supaya tabel di dokumentasi keluar dari kode yang benar-benar dijalankan
// (dan tidak bisa berbeda dari apa yang dibuat library-nya).

/** Kolom huruf ("A", "C", "AA") menjadi nomor kolom yang dihitung dari 0. */
function nomorKolom(huruf) {
    let n = 0;
    for (const h of huruf) n = n * 26 + (h.charCodeAt(0) - 64);
    return n - 1;
}

/** Satu baris tabel markdown dari daftar teks (tanda | di dalam teks diberi garis miring supaya tidak memecah tabel). */
function barisMd(teks) {
    return '| ' + teks.map((t) => String(t).replace(/\|/g, '\\|')).join(' | ') + ' |';
}

/**
 * Sel-sel sebuah sheet seperti yang tampil di layar (teks terformat), sebagai tabel markdown. Baris pertama range dipakai sebagai judul.
 * @param {any} sheet  sheet handle dari wb.sheet(...)
 * @param {string} range  misalnya "A1:E9"
 */
export function tabelSheet(sheet, range) {
    const [awal, akhir] = range.split(':');
    const [, k1, b1] = /^([A-Z]+)(\d+)$/.exec(awal);
    const [, k2, b2] = /^([A-Z]+)(\d+)$/.exec(akhir);
    const baris = [];
    for (let r = Number(b1) - 1; r <= Number(b2) - 1; r++) {
        const isi = [];
        for (let c = nomorKolom(k1); c <= nomorKolom(k2); c++) isi.push(sheet.display(r, c).text);
        baris.push(isi);
    }
    return tabelDari(baris);
}

/**
 * Hasil pivot() (tanpa sheet) sebagai tabel markdown: angka ditulis dengan pemisah ribuan Indonesia.
 * @param {{ cells: any[][] }} hasil
 */
export function tabelPivot(hasil) {
    const teks = (v) => (v === null || v === undefined ? '' : typeof v === 'number' ? v.toLocaleString('id-ID') : String(v));
    return tabelDari(hasil.cells.map((baris) => baris.map(teks)));
}

function tabelDari(baris) {
    const [judul, ...isi] = baris;
    return [barisMd(judul), barisMd(judul.map(() => '---')), ...isi.map(barisMd)].join('\n');
}
