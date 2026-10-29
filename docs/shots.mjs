// The screenshots of the documentation, taken from its own examples in a real Chrome: every picture shows what the code next to it makes.
//   node docs/shots.mjs            every picture
//   node docs/shots.mjs boq        only the ones whose name has "boq"
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { withExample } from '../test/chrome.js';

const here = dirname(fileURLToPath(import.meta.url));
const img = join(here, 'img');
mkdirSync(img, { recursive: true });

// the cell (r, c) in the window, by its headers
const cellAt = (js, r, c) => js(`(function(){ var h = document.querySelector('.ks-colhead[data-c="${c}"]'), v = document.querySelector('.ks-rowhead[data-r="${r}"]'); var a = h.getBoundingClientRect(), b = v.getBoundingClientRect(); return { x: Math.round(a.left + a.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);

// The pages of chapter 13 that show one sheet as several people see it have a "Lihat sebagai" select (.lihat-sebagai): it is set as a person
// picks it, before the picture. A person also types into a cell (as a click and keys), to show what the sheet says.
const asWho = (who) => async ({ js, wait }) => {
    await js(`(function(){ var e = document.querySelector('.lihat-sebagai'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(e, ${JSON.stringify(who)}); e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await wait(400);
};
const typeAt = (r, c, text) => async ({ js, click, type, wait }) => {
    const p = await cellAt(js, r, c);
    await click(p.x, p.y); await wait(200); await type(text); await wait(300);
};
// a button of a page, clicked as a person clicks it (chapter 2's pages are plain React with buttons)
const press = (...selectors) => async ({ js, click, wait }) => {
    for (const sel of selectors) {
        const p = await js(`(function(){ var e = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: e.left + 5, y: e.top + 5 }; })()`);
        await click(p.x, p.y); await wait(250);
    }
};
// a value typed into a cell and kept (Enter), as a person does
const enter = (r, c, text) => async (p) => { await typeAt(r, c, text)(p); await p.key('Enter', 'Enter', 13); await p.wait(250); };
// a range dragged with the mouse, from one cell to another
const dragFrom = (r1, c1, r2, c2) => async ({ js, mouse, wait }) => {
    const a = await cellAt(js, r1, c1), b = await cellAt(js, r2, c2);
    await mouse('mouseMoved', a.x, a.y); await mouse('mousePressed', a.x, a.y); await mouse('mouseMoved', b.x, b.y, { buttons: 1 }); await mouse('mouseReleased', b.x, b.y); await wait(300);
};
// a picture of chapter 13: the page's top 1000 x 330 (menus, toolbar, formula bar and the first rows)
const akses = (name, page, act) => ({ name, page, act, clip: { x: 0, y: 0, width: 1000, height: 330 } });

/**
 * Each picture: the page it is taken of (docs/examples), what is done on it first (with real input), and the part of the window it shows.
 * @type {{ name: string, page: string, act?: (p: any) => Promise<void>, clip?: { x: number, y: number, width: number, height: number } }[]}
 */
// a sheet of the project workbook shown (by its name), then what else is asked
const proyek = (name, sheet, act, clip) => ({ name, page: 'proyek.page.js', clip: clip || { x: 0, y: 0, width: 1366, height: 768 }, act: async (p) => {
    for (let i = 0; i < 40 && !(await p.js('!!(window.__sheet && window.__sheet.current)')); i++) await p.wait(250);
    await p.js(`window.__sheet.current.showSheet(window.__workbook.sheetIdByName(${JSON.stringify(sheet)}))`);
    await p.wait(500);
    if (act) await act(p);
} });

export const SHOTS = [
    { name: 'overview', page: 'galeri-overview.page.js', clip: { x: 0, y: 0, width: 800, height: 330 } },
    proyek('proyek-rab', 'RAB'),
    proyek('proyek-harga', 'Harga', null, { x: 0, y: 0, width: 1000, height: 520 }),
    proyek('proyek-ahsp', 'AHSP'),
    proyek('proyek-kurva-s', 'Kurva S'),
    proyek('proyek-opname', 'Opname M8'),
    proyek('proyek-termin', 'Termin 2', null, { x: 0, y: 0, width: 1000, height: 480 }),
    proyek('proyek-cco', 'CCO', null, { x: 0, y: 0, width: 1300, height: 480 }),
    proyek('proyek-harian', 'Harian 27-10'),
    proyek('proyek-cashflow', 'Cash Flow', null, { x: 0, y: 0, width: 1300, height: 440 }),
    proyek('proyek-ncr', 'NCR', null, { x: 0, y: 0, width: 1300, height: 420 }),
    // chapter 4: filling and reading from code
    { name: 'isi-tambah', page: '04-03-tambah.page.tsx', act: press('.tambah'), clip: { x: 0, y: 0, width: 1000, height: 340 } },
    { name: 'isi-baca-data', page: '04-04-baca-data.page.tsx', clip: { x: 0, y: 0, width: 1366, height: 300 } },
    { name: 'isi-populate', page: '04-05-populate.page.tsx', clip: { x: 0, y: 0, width: 1000, height: 300 } },
    { name: 'isi-baris-kolom', page: '04-07-baris-kolom.page.tsx', act: press('.sembunyikan', '.lebarkan', '.tinggikan'), clip: { x: 0, y: 0, width: 1000, height: 340 } },
    { name: 'isi-sheet', page: '04-08-sheet.page.tsx', act: press('.tambah-sheet'), clip: { x: 0, y: 0, width: 1000, height: 380 } },
    // chapter 3: the sheet on the screen
    { name: 'layar-perubahan', page: '03-04-perubahan.page.tsx', act: async (p) => { await enter(1, 3, '400')(p); await enter(2, 3, '250')(p); }, clip: { x: 0, y: 0, width: 1366, height: 300 } },
    { name: 'layar-seleksi', page: '03-05-seleksi.page.tsx', act: dragFrom(1, 4, 3, 4), clip: { x: 0, y: 0, width: 1000, height: 340 } },
    { name: 'layar-perintah', page: '03-06-perintah.page.tsx', act: press('.pilih-stok'), clip: { x: 0, y: 0, width: 1000, height: 340 } },
    { name: 'layar-sheet-aktif', page: '03-07-sheet-aktif.page.tsx', act: press('.ke-Catatan'), clip: { x: 0, y: 0, width: 1000, height: 330 } },
    { name: 'layar-sederhana', page: '03-08-bagian-layar.page.tsx', clip: { x: 0, y: 0, width: 1000, height: 220 } },
    { name: 'layar-tema', page: '03-09-tema.page.tsx', act: dragFrom(1, 2, 3, 2), clip: { x: 0, y: 0, width: 1000, height: 300 } },
    { name: 'layar-dua-sheet', page: '03-10-dua-sheet.page.tsx', act: enter(1, 3, '400'), clip: { x: 0, y: 0, width: 1366, height: 330 } },
    // chapter 2: plain React around a workbook, a sheet only at the end
    { name: 'konsep-baca', page: '02-05-baca.page.tsx', clip: { x: 0, y: 0, width: 520, height: 70 } },
    { name: 'konsep-ubah', page: '02-06-ubah.page.tsx', act: press('.ubah'), clip: { x: 0, y: 0, width: 520, height: 110 } },
    { name: 'konsep-isi-sel', page: '02-07-isi-sel.page.tsx', clip: { x: 0, y: 0, width: 620, height: 170 } },
    { name: 'konsep-tabel', page: '02-08-tabel.page.tsx', clip: { x: 0, y: 0, width: 620, height: 230 } },
    { name: 'konsep-id', page: '02-09-id.page.tsx', act: press('.sisipkan'), clip: { x: 0, y: 0, width: 620, height: 110 } },
    { name: 'konsep-event', page: '02-10-event.page.tsx', act: press('.isi', '.tebal', '.orang', '.undo'), clip: { x: 0, y: 0, width: 760, height: 200 } },
    { name: 'konsep-undo', page: '02-11-undo.page.tsx', act: press('.kurang', '.kurang', '.undo'), clip: { x: 0, y: 0, width: 520, height: 110 } },
    { name: 'konsep-sheet', page: '02-12-sheet.page.tsx', act: async (p) => { await typeAt(1, 3, '400')(p); await p.key('Enter', 'Enter', 13); await p.wait(300); }, clip: { x: 0, y: 0, width: 1000, height: 330 } },
    // chapter 1, one picture per step
    { name: 'mulai-kosong', page: '01-05-kosong.page.tsx', clip: { x: 0, y: 0, width: 1000, height: 420 } },
    { name: 'mulai-isi', page: '01-06-isi.page.tsx', act: async ({ js, click, wait }) => { const p = await cellAt(js, 4, 4); await click(p.x, p.y); await wait(300); }, clip: { x: 0, y: 0, width: 1000, height: 300 } },
    { name: 'mulai-rapi', page: '01-07-rapi.page.tsx', clip: { x: 0, y: 0, width: 1000, height: 300 } },
    { name: 'bagian-layar', page: '01-07-rapi.page.tsx', clip: { x: 0, y: 0, width: 1366, height: 300 } },
    { name: 'mulai-simpan', page: '01-08-simpan.page.tsx', act: async ({ js, click, type, key, wait }) => {
        await js("localStorage.removeItem('stok-toko'); 0");
        const p = await cellAt(js, 1, 3); await click(p.x, p.y); await wait(150); await type('400'); await key('Enter', 'Enter', 13); await wait(400);
    }, clip: { x: 0, y: 0, width: 1000, height: 340 } },
    { name: 'kondisional', page: '06-kondisional.page.js', clip: { x: 0, y: 110, width: 1000, height: 330 } },
    { name: 'pivot', page: '08-pivot.page.js', act: async ({ js, click, wait }) => {
        const p = await cellAt(js, 2, 1); await click(p.x, p.y); await wait(600);
    }, clip: { x: 0, y: 110, width: 1366, height: 470 } },
    { name: 'kasir', page: '11-kasir.page.js', act: async ({ js, click, wait }) => {
        const p = await cellAt(js, 3, 7); await click(p.x, p.y); await wait(600);
    }, clip: { x: 0, y: 0, width: 1366, height: 600 } },
    { name: 'dua-tampilan', page: '11-dua-tampilan.page.js', clip: { x: 0, y: 0, width: 1366, height: 520 } },
    // chapter 13, one picture per step (and per person where a step compares people)
    akses('akses-baca', '13-08-baca.page.tsx', typeAt(1, 6, '9')),
    akses('akses-tidak-disebut-rina', '13-09-tidak-disebut.page.tsx', asWho('rina')),
    akses('akses-tidak-disebut-tamu', '13-09-tidak-disebut.page.tsx', asWho('tamu')),
    akses('akses-ubah', '13-10-ubah.page.tsx'),
    akses('akses-campur', '13-11-campur.page.tsx'),
    akses('akses-kolom', '13-12-kolom.page.tsx'),
    akses('akses-kolom-sisip', '13-12-kolom.page.tsx', async ({ js, click, wait }) => {
        const b = await js('(function(){ var e = document.querySelector(".sisipkan").getBoundingClientRect(); return { x: e.left + 5, y: e.top + 5 }; })()');
        await click(b.x, b.y); await wait(400);
    }),
    akses('akses-sembunyi', '13-13-sembunyi.page.tsx'),
    { name: 'akses-gembok', page: '13-13-sembunyi.page.tsx', clip: { x: 0, y: 140, width: 760, height: 110 } },
    akses('akses-tak-terlihat', '13-14-tak-terlihat.page.tsx'),
    akses('akses-role-rina', '13-15-role.page.tsx', asWho('rina')),
    akses('akses-role-joko', '13-15-role.page.tsx', asWho('joko')),
    akses('akses-role-sari', '13-15-role.page.tsx', asWho('sari')),
    akses('akses-semua-tamu', '13-16-semua.page.tsx', asWho('tamu')),
    akses('akses-semua-rina', '13-16-semua.page.tsx', asWho('rina')),
    akses('akses-akun-rina', '13-17-akun.page.tsx', asWho('rina')),
    akses('akses-akun-budi', '13-17-akun.page.tsx', asWho('budi')),
    akses('akses-pemilik-yeka', '13-18-pemilik.page.tsx', asWho('yeka')),
    akses('akses-pemilik-rina', '13-18-pemilik.page.tsx', asWho('rina')),
    akses('akses-syarat', '13-19-syarat.page.tsx', typeAt(3, 6, '5')),
    akses('akses-format', '13-20-format.page.tsx'),
    akses('akses-aksi', '13-21-aksi.page.tsx', async ({ js, click, wait }) => { const p = await js(`(function(){ var e = Array.from(document.querySelectorAll('.ks-menubar-item')).find(function(x){ return x.textContent === 'Data'; }); var b = e.getBoundingClientRect(); return { x: b.left + 10, y: b.top + 8 }; })()`); await click(p.x, p.y); await wait(400); }),
    akses('akses-layar', '13-22-layar.page.tsx'),
    akses('akses-area', '13-23-area.page.tsx'),
    { name: 'akses-tanda-bawaan', page: '13-25-tanda.page.tsx', clip: { x: 0, y: 0, width: 760, height: 130 } },
    { name: 'akses-tanda-tint', page: '13-25-tanda.page.tsx', clip: { x: 0, y: 144, width: 760, height: 130 } },
    { name: 'akses-tanda-stripes', page: '13-25-tanda.page.tsx', clip: { x: 0, y: 288, width: 760, height: 130 } },
    { name: 'akses-tanda-tanpa-gembok', page: '13-25-tanda.page.tsx', clip: { x: 0, y: 432, width: 760, height: 130 } },
    { name: 'akses-tanda-tanpa-tanda', page: '13-25-tanda.page.tsx', clip: { x: 0, y: 576, width: 760, height: 130 } },
    { name: 'akses-pesan', page: '13-26-pesan.page.tsx', act: typeAt(2, 1, 'x'), clip: { x: 0, y: 0, width: 1000, height: 300 } },
    akses('akses-setup', '13-27-setup.page.tsx'),
    { name: 'akses-pilih', page: '13-28-pilih.page.tsx', clip: { x: 0, y: 0, width: 1366, height: 330 } },
    { name: 'akses-tambah', page: '13-29-tambah.page.tsx', act: async ({ js, click, mouse, wait }) => {
        const a = await cellAt(js, 1, 5), b = await cellAt(js, 4, 5);
        await mouse('mouseMoved', a.x, a.y); await mouse('mousePressed', a.x, a.y); await mouse('mouseMoved', b.x, b.y, { buttons: 1 }); await mouse('mouseReleased', b.x, b.y); await wait(200);
        const t = await js('(function(){ var e = document.querySelector(".tambah").getBoundingClientRect(); return { x: e.left + 5, y: e.top + 5 }; })()');
        await click(t.x, t.y); await wait(400);
    }, clip: { x: 0, y: 0, width: 1366, height: 330 } },
    { name: 'akses-keadaan', page: 'gambar/13-keadaan.page.tsx', clip: { x: 0, y: 0, width: 540, height: 86 } },
    { name: 'akses-mode', page: 'gambar/13-mode.page.tsx', clip: { x: 0, y: 0, width: 880, height: 190 } },
    { name: 'editor-akses-live', page: '04-13-editor-akses.page.tsx', act: async ({ js, click, mouse, wait }) => {
        // the same rule as the editor's picture (Harga beli hidden for kasir), then the sheet as Rina sees it
        const a = await cellAt(js, 1, 2), b = await cellAt(js, 4, 2);
        await mouse('mouseMoved', a.x, a.y); await mouse('mousePressed', a.x, a.y); await mouse('mouseMoved', b.x, b.y, { buttons: 1 }); await mouse('mouseReleased', b.x, b.y); await wait(200);
        await js(`(function(){ var e = document.querySelector('.pilih-mode'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(e, 'hidden'); e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        const t = await js('(function(){ var e = document.querySelector(".tambah-aturan").getBoundingClientRect(); return { x: e.left + 5, y: e.top + 5 }; })()');
        await click(t.x, t.y); await wait(300);
        await js(`(function(){ var e = document.querySelector('.lihat-sebagai'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(e, 'rina'); e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        await wait(400);
    }, clip: { x: 0, y: 0, width: 1366, height: 520 } },
    { name: 'komentar', page: '14-komentar.page.js', act: async ({ js, click, mouse, wait }) => {
        const at = (expr) => js(`(function(){ var e = ${expr}; var b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
        let p = await at(`Array.from(document.querySelectorAll('.ks-menubar-item')).find(function(x){ return x.textContent === 'View'; })`); await click(p.x, p.y); await wait(300);
        p = await at(`Array.from(document.querySelectorAll('.ks-menu-item')).find(function(x){ return x.textContent.indexOf('Comments') >= 0; })`);
        await mouse('mouseMoved', p.x - 20, p.y); await mouse('mouseMoved', p.x, p.y); await wait(200); await click(p.x, p.y); await wait(600);
    }, clip: { x: 0, y: 0, width: 1366, height: 480 } },
    { name: 'langkah2', page: '11-langkah2.page.js', clip: { x: 0, y: 0, width: 760, height: 300 } },
    { name: 'langkah3', page: '11-langkah3.page.js', act: async ({ js, click, wait }) => {
        const p = await js('(function(){ var b = document.querySelector(".tambah").getBoundingClientRect(); return { x: Math.round(b.left + 5), y: Math.round(b.top + 5) }; })()');
        await click(p.x, p.y); await wait(300);
    }, clip: { x: 0, y: 0, width: 760, height: 330 } },
    { name: 'langkah5', page: '11-langkah5.page.js', act: async ({ js, click, type, key, wait }) => {
        for (let i = 0; i < 30 && !(await js('!!document.querySelector(".ks-sheet")')); i++) await wait(200);
        const p = await cellAt(js, 1, 7); await click(p.x, p.y); await wait(100); await type('99'); await key('Enter', 'Enter', 13); await wait(300);
    }, clip: { x: 0, y: 0, width: 900, height: 330 } },
    { name: 'rumus-dasar', page: '05-nota.page.js', act: async ({ js, click, wait }) => { const p = await cellAt(js, 1, 5); await click(p.x, p.y); await wait(300); }, clip: { x: 0, y: 96, width: 760, height: 252 } },
    { name: 'rumus-sel', page: '05-nota.page.js', act: async ({ js, click, wait }) => { const p = await cellAt(js, 1, 3); await click(p.x, p.y); await wait(300); }, clip: { x: 0, y: 96, width: 760, height: 252 } },
    { name: 'rumus-sum', page: '05-nota.page.js', act: async ({ js, click, wait }) => { const p = await cellAt(js, 4, 3); await click(p.x, p.y); await wait(300); }, clip: { x: 0, y: 96, width: 760, height: 252 } },
    { name: 'rumus-fill', page: '05-nota.page.js', act: async ({ js, click, wait }) => { const p = await cellAt(js, 3, 3); await click(p.x, p.y); await wait(300); }, clip: { x: 0, y: 96, width: 760, height: 252 } },
    { name: 'rumus-dolar', page: '05-nota.page.js', act: async ({ js, click, wait }) => { const p = await cellAt(js, 5, 3); await click(p.x, p.y); await wait(300); }, clip: { x: 0, y: 96, width: 760, height: 252 } },
    { name: 'rumus-terbilang', page: '05-nota.page.js', act: async ({ js, click, wait }) => { const p = await cellAt(js, 7, 1); await click(p.x, p.y); await wait(300); }, clip: { x: 0, y: 96, width: 760, height: 252 } },
    { name: 'editor-akses', page: '04-13-editor-akses.page.tsx', act: async ({ js, click, mouse, wait }) => {
        const a = await cellAt(js, 1, 2), b = await cellAt(js, 4, 2);
        await mouse('mouseMoved', a.x, a.y); await mouse('mousePressed', a.x, a.y); await mouse('mouseMoved', b.x, b.y, { buttons: 1 }); await mouse('mouseReleased', b.x, b.y); await wait(200);
        const pick = (sel, v) => js(`(function(){ var e = document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        await pick('.pilih-mode', 'hidden');
        const t = await js('(function(){ var e = document.querySelector(".tambah-aturan").getBoundingClientRect(); return { x: e.left + 5, y: e.top + 5 }; })()');
        await click(t.x, t.y); await wait(400);
    }, clip: { x: 0, y: 0, width: 1366, height: 520 } },
    { name: 'invoice', page: '04-05-invoice.page.tsx', clip: { x: 0, y: 110, width: 720, height: 330 } },
    { name: 'filter', page: '07-filter.page.js', act: async ({ js, click, wait }) => {
        const p = await js(`(function(){ var b = document.querySelector('.ks-filter-button[data-filter-col="2"]').getBoundingClientRect(); return { x: Math.round(b.left + 8), y: Math.round(b.top + 8) }; })()`);
        await click(p.x, p.y); await wait(500);
    }, clip: { x: 0, y: 110, width: 1000, height: 560 } },
    { name: 'dropdown', page: '07-validasi.page.js', act: async ({ js, click, key, wait }) => {
        const p = await cellAt(js, 3, 2); await click(p.x, p.y); await wait(200); await key('ArrowDown', 'ArrowDown', 40, 1); await wait(400);
    }, clip: { x: 0, y: 110, width: 1000, height: 420 } },
    { name: 'aturan', page: '10-aturan.page.js', act: async ({ js, click, type, wait }) => {
        const p = await cellAt(js, 1, 5); await click(p.x, p.y); await wait(200); await type('1'); await wait(300);
    }, clip: { x: 0, y: 110, width: 1100, height: 400 } }
];

export async function takeShots(filter) {
    execFileSync(process.execPath, [join(here, '..', 'build.js')], { stdio: 'inherit' });
    for (const shot of SHOTS.filter((x) => !filter || x.name.includes(filter))) {
        await withExample(async (p) => {
            // a page is ready when its sheet is drawn, or, for a page with no sheet (chapter 2), when it says so (data-siap)
            for (let i = 0; i < 60 && !(await p.js('!!document.querySelector(".ks-sheet, [data-siap]")')); i++) await p.wait(250);
            await p.wait(600);
            if (shot.act) await shot.act(p);
            const res = await p.send('Page.captureScreenshot', { format: 'png', clip: { ...(shot.clip || { x: 0, y: 0, width: 1366, height: 768 }), scale: 1 } });
            writeFileSync(join(img, shot.name + '.png'), Buffer.from(res.result.data, 'base64'));
            console.log('taken: docs/img/' + shot.name + '.png');
        }, '../docs/examples/' + shot.page);
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await takeShots(process.argv[2]);
