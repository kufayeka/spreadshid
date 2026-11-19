import { createWorkbook } from '@kufayeka/sheet/core';
import type { AccessRow, People } from '@kufayeka/sheet/core';
import { buatStok } from './data/stok-akses.js';

// 13.38 Akun sungguhan: id akun berupa uuid, role akun menjadi grup. Tiga jawaban server yang dipakai sheet, ditulis di sini apa adanya.

// GET /auth/me: siapa yang sedang login (dari sesi/token aplikasimu)
const BUDI = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const ANI = '7c1f0a2e-4b3d-4a91-8e22-5f6d7a8b9c01';
const CITRA = 'b2d4e6f8-1a3c-4e5f-9a7b-0c2d4e6f8a1b';

// GET /accounts/directory: semua akun, dalam bentuk yang diterima setPeople().
// users = kamus untuk tampilan, groups = akun per role (dibangun server dari kolom role tabel akun)
const people: People = {
    users: [
        { id: ANI, name: 'Ani Wijaya', username: 'ani', photoUrl: '/foto/ani.jpg' },
        { id: BUDI, name: 'Budi Santoso', username: 'budi', photoUrl: '/foto/budi.jpg' },
        { id: CITRA, name: 'Citra Lestari', username: 'citra', photoUrl: null }
    ],
    groups: { ADMINISTRATOR: [ANI], GUDANG: [BUDI], KEUANGAN: [CITRA] }
};

// GET /sheet/:id -> access: SEMUA baris akses workbook ini (bukan hanya milik pemanggil)
const access: AccessRow[] = [
    { who: 'group:GUDANG', effect: 'allow', action: 'read', where: 'Produk!A1:I13' },
    { who: 'group:GUDANG', effect: 'allow', action: 'edit', where: 'Produk!col:Stok' },
    { who: 'group:GUDANG', effect: 'deny', action: 'read', where: 'Produk!col:Harga beli' },
    { who: 'group:ADMINISTRATOR', effect: 'allow', action: '*' }
];

// Yang dilakukan FE setelah ketiga jawaban itu datang. Satu workbook per orang di sini, agar ketiganya bisa dibandingkan.
const content = buatStok().toJSON();                 // = jawaban GET /sheet/:id -> content
for (const me of [BUDI, ANI, CITRA]) {
    const wb = createWorkbook(content);
    wb.setPeople(people);
    wb.setWho({ who: me });                          // hanya id akun, tidak pernah role-nya
    wb.setAccess(access);
    const mode = (a: string) => (wb.modeAt('Produk', a) || { mode: 'edit' }).mode;
    console.log(wb.label(me).padEnd(22), '| grup:', wb.access().roles.join(',').padEnd(13),
        '| Stok G2:', mode('G2').padEnd(9), '| Harga beli E2:', mode('E2').padEnd(9), '| tambah sheet:', wb.can('sheets.add'));
}

// Yang tersimpan (baris akses, penulis komentar) tetap uuid; yang tampil di layar dicari di kamus
const wb = createWorkbook(content);
wb.setPeople(people);
console.log('');
console.log('user:' + BUDI, '->', wb.label(BUDI));
console.log('akun yang sudah dihapus ->', wb.label('0f0f0f0f-0000-4000-8000-000000000000'));
