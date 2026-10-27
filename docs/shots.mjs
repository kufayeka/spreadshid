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
    { name: 'mulai-cepat', page: '01-halaman.page.js', clip: { x: 0, y: 0, width: 1000, height: 420 } },
    { name: 'boq', page: '01-boq.page.js', clip: { x: 0, y: 0, width: 1000, height: 330 } },
    { name: 'bagian-layar', page: '01-boq.page.js', clip: { x: 0, y: 0, width: 1366, height: 768 } },
    { name: 'handle-select', page: '03-handle.page.js', act: async ({ js, wait }) => { await js('document.querySelector("#pilih").click()'); await wait(400); }, clip: { x: 0, y: 0, width: 1000, height: 380 } },
    { name: 'events', page: '03-events.page.js', act: async ({ js, click, type, key, wait }) => {
        const p = await cellAt(js, 1, 2); await click(p.x, p.y); await wait(150); await type('15'); await key('Enter', 'Enter', 13); await wait(300);
        const q = await cellAt(js, 1, 1); await click(q.x, q.y); await wait(150); await type('Besi'); await key('Enter', 'Enter', 13); await wait(400);
    }, clip: { x: 0, y: 0, width: 1000, height: 480 } },
    { name: 'tema', page: '03-tema.page.js', clip: { x: 0, y: 0, width: 1000, height: 360 } },
    { name: 'invoice', page: '04-gaya.page.js', clip: { x: 0, y: 110, width: 720, height: 330 } },
    { name: 'data', page: '07-data.page.js', clip: { x: 0, y: 110, width: 900, height: 260 } },
    { name: 'filter-menu', page: '07-data.page.js', act: async ({ js, click, wait }) => {
        const p = await js('(function(){ var b = document.querySelector(\'.ks-filter-button[data-filter-col="3"]\').getBoundingClientRect(); return { x: Math.round(b.left + 10), y: Math.round(b.top + 10) }; })()');
        await click(p.x, p.y); await wait(500);
    }, clip: { x: 0, y: 110, width: 900, height: 560 } },
    { name: 'dropdown', page: '07-data.page.js', act: async ({ js, click, key, wait }) => {
        const p = await cellAt(js, 3, 3); await click(p.x, p.y); await wait(200); await key('ArrowDown', 'ArrowDown', 40, 1); await wait(400);
    }, clip: { x: 0, y: 110, width: 900, height: 330 } },
    { name: 'aturan', page: '10-aturan.page.js', act: async ({ js, click, type, wait }) => {
        const p = await cellAt(js, 1, 2); await click(p.x, p.y); await wait(200); await type('1'); await wait(300);
    }, clip: { x: 0, y: 110, width: 900, height: 510 } }
];

export async function takeShots(filter) {
    execFileSync(process.execPath, [join(here, '..', 'build.js')], { stdio: 'inherit' });
    for (const shot of SHOTS.filter((x) => !filter || x.name.includes(filter))) {
        await withExample(async (p) => {
            for (let i = 0; i < 60 && !(await p.js('!!document.querySelector(".ks-sheet")')); i++) await p.wait(250);
            await p.wait(600);
            if (shot.act) await shot.act(p);
            const res = await p.send('Page.captureScreenshot', { format: 'png', clip: { ...(shot.clip || { x: 0, y: 0, width: 1366, height: 768 }), scale: 1 } });
            writeFileSync(join(img, shot.name + '.png'), Buffer.from(res.result.data, 'base64'));
            console.log('taken: docs/img/' + shot.name + '.png');
        }, '../docs/examples/' + shot.page);
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await takeShots(process.argv[2]);
