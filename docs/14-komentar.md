# 14. Komentar

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [13. Access control](13-hak-akses.md) · Berikutnya: [15. Excel dan CSV](15-excel.md)

Diskusi yang menempel di sel: pertanyaan, jawaban, lalu ditutup kalau sudah selesai. Komentar disimpan di workbook, jadi ikut tersimpan lewat patch
seperti isi sel, ikut ke undo, dan dikirim atau ditahan oleh `viewFor` menurut hak akses.

## Contoh: stok yang habis

<!-- contoh: 14-komentar.js -->
```js
import { createWorkbook, viewFor } from '@kufayeka/sheet/core';
import { PRODUK, KOLOM_PRODUK } from './data/toko.js';

// Diskusi di sel: manajer bertanya soal stok keramik yang habis, gudang menjawab, manajer menutup diskusinya.
export function buatDiskusi() {
    const doc = (() => {
        const w = createWorkbook();
        w.setSettings({ locale: 'id-ID', currency: 'IDR' });
        w.setSheetProps('Sheet1', { name: 'Produk' });
        w.setValues('Produk', 'A1', [KOLOM_PRODUK, ...PRODUK]);
        w.setColProps('Produk', 'E:F', { format: { type: 'money', decimals: 0 } });
        w.setColProps('Produk', 'B', { width: 180 });
        return w.toJSON();
    })();
    // setiap orang membuka workbook-nya sendiri dengan user-nya: nama penulis dan waktu tercatat di komentar
    const dewi = createWorkbook(doc, { user: { id: 'user:dewi', name: 'Dewi' }, now: () => new Date(Date.UTC(2026, 9, 27, 9, 15)) });
    const t = dewi.addComment('Produk', 'G9', 'Keramik 40x40 habis. Kapan datang lagi?');
    dewi.replyComment('Produk', t.thread, 'Sekalian cek harga beli dari pemasok baru ya.');
    const joko = createWorkbook(dewi.toJSON(), { user: { id: 'user:joko', name: 'Joko' }, now: () => new Date(Date.UTC(2026, 9, 27, 10, 2)) });
    joko.replyComment('Produk', t.thread, 'PO sudah dikirim, barang datang Kamis. Harga naik 3%.');
    joko.addComment('Produk', 'G7', 'Sisa 12 pail, di bawah minimum.');
    return { doc: joko.toJSON(), thread: t.thread };
}

const { doc, thread } = buatDiskusi();
const dewi = createWorkbook(doc, { user: { id: 'user:dewi', name: 'Dewi' } });
const tampil = (x) => `${wantedAt(x)} ${x.resolved ? '(selesai)' : '(terbuka)'}: ` + x.items.map((i) => i.by.name + ' ' + i.at.slice(11, 16) + ' "' + i.text + '"').join(' / ');
const wantedAt = (x) => (x.at ? dewi.address(x.at.r, x.at.c) : '(sel terhapus)');
for (const x of dewi.comments('Produk')) console.log(tampil(x));
console.log('G9 punya komentar:', dewi.hasComment('Produk', 'G9'), '| G2:', dewi.hasComment('Produk', 'G2'));

// diskusi mengikuti selnya: baris disisipkan di atas, komentar ikut turun
dewi.insertRows('Produk', '2');
console.log('setelah sisip   :', dewi.comments('Produk').map(wantedAt).join(', '));

// menutup diskusi. Jawaban baru membukanya lagi
dewi.resolveComment('Produk', thread, true);
console.log('ditutup         :', dewi.hasComment('Produk', 'G10'), '(tanda di sel hilang, diskusinya tetap ada)');

// hanya penulis yang boleh mengubah atau menghapus komentarnya. Dari kode, yang tidak boleh melempar error (di layar tombolnya tidak ada)
const punyaJoko = dewi.comments('Produk')[0].items[2];
try { dewi.editComment('Produk', thread, punyaJoko.id, 'diubah orang lain'); } catch (err) { console.log('ubah milik Joko :', err.message); }

// komentar ikut tersimpan di workbook, dan viewFor tidak mengirimnya ke orang tanpa hak comment.read
const policy = { roles: { tamu: { can: [] } }, default: 'tamu' };
console.log('dikirim ke tamu :', createWorkbook(viewFor(dewi.toJSON(), { policy, who: 'user:tamu' })).comments('Produk').length, 'diskusi');
```
<!-- /contoh -->

<!-- hasil: 14-komentar.js -->
```text
G9 (terbuka): Dewi 09:15 "Keramik 40x40 habis. Kapan datang lagi?" / Dewi 09:15 "Sekalian cek harga beli dari pemasok baru ya." / Joko 10:02 "PO sudah dikirim, barang datang Kamis. Harga naik 3%."
G7 (terbuka): Joko 10:02 "Sisa 12 pail, di bawah minimum."
G9 punya komentar: true | G2: false
setelah sisip   : G10, G8
ditutup         : false (tanda di sel hilang, diskusinya tetap ada)
ubah milik Joko : only the one who wrote a comment can change it
dikirim ke tamu : 0 diskusi
```
<!-- /hasil -->

Di layar, komentar ada di panel samping (View → Comments, Insert → Comment, atau Ctrl+Alt+M). Sel yang punya diskusi terbuka diberi tanda di pojoknya. Panel
memisahkan diskusi yang masih terbuka dan yang sudah selesai, dan setiap diskusi bisa dibalas di tempat:

![Panel komentar](img/komentar.png)

<!-- contoh: 14-komentar.page.js -->
```jsx
import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { buatDiskusi } from './14-komentar.js';

// Dewi membuka workbook yang sudah berisi diskusi. Komentar ada di panel samping (View > Comments), sel berkomentar diberi tanda di pojoknya.
export default function DiskusiStok() {
    const [wb] = useState(() => createWorkbook(buatDiskusi().doc));
    return <div style={{ height: 480 }}><Sheet workbook={wb} user={{ id: 'user:dewi', name: 'Dewi' }} /></div>;
}
```
<!-- /contoh -->

## Cara kerjanya

- **Penulis** diambil dari opsi `user` di `createWorkbook(doc, { user: { id, name } })`, atau dari prop `user` di `<Sheet>`. Waktunya dari jam workbook
  (opsi `now`, bawaannya jam komputer).
- **Diskusi mengikuti selnya.** Baris disisipkan atau di-sort, diskusinya ikut. Kalau baris atau kolomnya dihapus, diskusinya tetap ada dengan `at: null`,
  dan kembali ke selnya kalau penghapusan itu di-undo.
- **Ditutup, bukan dihapus.** `resolveComment(..., true)` menutup diskusi: tanda di sel hilang, isinya tetap bisa dibaca di tab Resolved. Balasan baru
  membukanya lagi.
- **Hanya penulisnya** yang boleh mengubah atau menghapus komentar. Pengecualiannya orang dengan hak `comment.moderate` kalau ada policy. Dari kode,
  percobaan yang tidak boleh melempar error, sedangkan di layar tombolnya tidak ditampilkan. Menghapus komentar pertama sebuah diskusi menghapus seluruh
  diskusinya.
- **Hak akses** ([bab 13](13-hak-akses.md)): `comment.read`, `comment.create`, `comment.reply`, `comment.resolve`, `comment.edit`, `comment.delete`,
  `comment.moderate`. Tanpa policy, semua orang boleh membaca dan menulis. Dengan policy, orang tanpa `comment.read` tidak melihat panelnya, dan `viewFor`
  tidak mengirim komentar kepadanya.

| Fungsi | Artinya |
|---|---|
| `addComment(sel, teks)` | diskusi baru di sel itu, atau balasan kalau sel itu sudah punya diskusi terbuka. Mengembalikan `{ thread, item }` |
| `replyComment(thread, teks)` | balas sebuah diskusi. Mengembalikan id balasan |
| `editComment(thread, item, teks)` | ubah teks komentar sendiri. Komentarnya diberi `edited` |
| `deleteComment(thread, item)` | hapus komentar sendiri |
| `resolveComment(thread, true/false)` | tutup atau buka lagi |
| `comments()` | semua diskusi sheet: `[{ id, resolved, items: [{ id, by: { id, name }, text, at, edited? }], at: { r, c } }]` |
| `commentAt(sel)` | diskusi terbuka di sel itu, atau `null` |
| `hasComment(sel)` | apakah sel itu punya diskusi terbuka (cepat, untuk menggambar tanda) |

Semua fungsi di atas dipanggil dari handle sheet (`wb.sheet('Produk').addComment('G9', ...)`), atau dari `wb` dengan nama sheet di depan. Setiap
panggilan adalah satu perubahan yang bisa di-undo.

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [13. Access control](13-hak-akses.md) · Berikutnya: [15. Excel dan CSV](15-excel.md)
