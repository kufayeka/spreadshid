// Charts on the grid in a real Chrome, by real mouse moves: a chart is drawn on its block of cells; a click selects it (frame, handles, the chart
// editor on the right); a drag moves it by whole cells and a handle resizes it (one change each, undone as one); Delete takes it away; the editor
// changes its kind; the tooltip shows the value under the mouse; a transparent chart laid over its cells lets a click go through to the cell under
// it and is picked by its edge, its points in the middle of its columns; Insert > Chart makes a chart of the selection; someone without the access
// row `chart` sees the charts and their tooltips but cannot select, move or edit them.
//   node test/grid-charts.test.js     (needs Chrome)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js, click, mouse, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    const q = (expr) => js(expr);
    const W = 'window.__workbook', S = 'window.__workbook.sheetIds()[0]';
    const cellAt = (r, c) => q(`(function(){ var h = document.querySelector('.ks-colhead[data-c="${c}"]'), v = document.querySelector('.ks-rowhead[data-r="${r}"]'); var a = h.getBoundingClientRect(), b = v.getBoundingClientRect(); return { x: Math.round(a.left + a.width / 2), y: Math.round(b.top + b.height / 2), left: Math.round(a.left), right: Math.round(a.right) }; })()`);
    const boxOf = (sel) => q(`(function(){ var e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; var b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; })()`);
    const drag = async (from, to) => {
        await mouse('mouseMoved', from.x, from.y); await mouse('mousePressed', from.x, from.y, { buttons: 1 });
        for (let k = 1; k <= 6; k++) await mouse('mouseMoved', from.x + ((to.x - from.x) * k) / 6, from.y + ((to.y - from.y) * k) / 6, { buttons: 1 });
        await mouse('mouseReleased', to.x, to.y); await wait(300);
    };
    const charts = () => q(`${W}.charts(${S}).map(function(c){ return c.type + ' ' + c.atText; }).join(' | ')`);

    // data on the page's own sheet, far from what the other tests use: months and two series
    await q(`${W}.setValues(${S}, 'K30', [['Bulan','Semen','Besi'],['Mei',182,96],['Jun',205,110],['Jul',171,124],['Agu',226,131]])`);
    const id = await q(`${W}.addChart(${S}, { at: 'B3:E14', data: 'K30:M34', type: 'column', title: 'Penjualan' })`);
    await wait(400);
    check('the chart is drawn on its block of cells', await q(`(function(){ var c = document.querySelector('.ks-chart'); var a = document.querySelector('.ks-colhead[data-c="1"]').getBoundingClientRect(); var b = c.getBoundingClientRect(); return Math.abs(b.left - a.left) < 2 && b.width > 200; })()`));
    check('its canvas has pixels drawn (not empty)', await q(`(function(){ var cv = document.querySelector('.ks-chart canvas'); var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; var n = 0; for (var i = 3; i < d.length; i += 4000) if (d[i]) n++; return n > 20; })()`));

    // a click selects it, its editor opens
    const inside = await boxOf('.ks-chart');
    await click(inside.x + inside.w - 20, inside.y + 20);
    await wait(300);
    check('a click selects the chart: frame and handles', await q(`!!document.querySelector('.ks-chart.ks-chart-selected') && document.querySelectorAll('.ks-chart-handle').length === 8`));
    check('and opens the chart editor on the right', await q(`!!document.querySelector('.ks-chart-panel')`));

    // the tooltip
    const bar = await q(`(function(){ var c = document.querySelector('.ks-chart canvas').getBoundingClientRect(); return { x: Math.round(c.left + c.width * 0.62), y: Math.round(c.top + c.height * 0.8) }; })()`);
    await mouse('mouseMoved', bar.x, bar.y);
    await wait(200);
    check('the value under the mouse shows in a tooltip', await q(`(function(){ var t = document.querySelector('.ks-chart-tip'); return !!t && /\\d/.test(t.textContent); })()`), await q(`document.querySelector('.ks-chart-tip') && document.querySelector('.ks-chart-tip').textContent`));

    // a drag moves it by whole cells
    const c3 = await cellAt(5, 2), c6 = await cellAt(8, 5);
    await drag({ x: inside.x + inside.w - 20, y: inside.y + 20 }, { x: inside.x + inside.w - 20 + (c6.x - c3.x), y: inside.y + 20 + (c6.y - c3.y) });
    check('a drag moves it by whole cells (3 down, 3 right)', (await charts()) === 'column E6:H17', await charts());
    await q(`${W}.undo()`);
    await wait(200);
    check('undo puts it back', (await charts()) === 'column B3:E14', await charts());

    // a handle resizes it
    await click(inside.x + inside.w - 20, inside.y + 20);
    await wait(200);
    const se = await boxOf('.ks-chart-handle.ks-h-se');
    const g20 = await cellAt(19, 6);
    await drag({ x: se.x + 4, y: se.y + 4 }, { x: g20.x, y: g20.y });
    check('the corner handle resizes it to the cell under the mouse', (await charts()) === 'column B3:G20', await charts());

    // the editor changes its kind
    await q(`(function(){ var b = Array.from(document.querySelectorAll('.ks-chart-type')).find(function(x){ return x.title === 'Line'; }); b.click(); })()`);
    await wait(200);
    check('the editor changes its kind (Line)', (await charts()) === 'line B3:G20', await charts());

    // Delete takes it away
    await click(inside.x + inside.w - 20, inside.y + 20);
    await wait(200);
    await key('Delete', 'Delete', 46);
    await wait(200);
    check('Delete takes the selected chart away', (await charts()) === '', await charts());
    await q(`${W}.undo()`);
    await wait(300);

    // a transparent chart laid over its cells: clicks go through, its edge picks it, its points stand on the middle of its columns
    await q(`${W}.setChart(${S}, ${JSON.stringify(id)}, { type: 'line', background: 'none', align: 'cells', at: 'B3:E14' })`);
    await wait(300);
    const c5 = await cellAt(6, 3);
    await click(c5.x, c5.y);
    await wait(200);
    check('a click inside a transparent chart goes through to the cell', (await q('window.__sheet.current.getSelection().active.address')) === 'D7' && !(await q(`!!document.querySelector('.ks-chart-selected')`)));
    const over = await boxOf('.ks-chart');
    await click(over.x + 1, over.y + over.h / 2);
    await wait(200);
    check('its edge picks it', await q(`!!document.querySelector('.ks-chart.ks-chart-selected')`));
    await key('Escape', 'Escape', 27);
    // the first point stands on the middle of column B: the canvas has the line's colour there
    const mid = await cellAt(2, 1);
    check('laid over its cells, its first point is on the middle of the first column', await q(`(function(){ var cv = document.querySelector('.ks-chart canvas'), b = cv.getBoundingClientRect(), r = cv.width / b.width; var x = Math.round((${mid.x} - b.left) * r); var d = cv.getContext('2d').getImageData(x - 3 * r, 0, 6 * r, cv.height).data; for (var i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] < 140 && d[i + 2] > 150) return true; return false; })()`));

    // Insert > Chart: a chart of the selection
    await q(`${W}.removeChart(${S}, ${JSON.stringify(id)})`);
    const k30 = await cellAt(29, 10);
    await q(`window.__sheet.current.select('K30:M34')`);
    await wait(200);
    await q(`(function(){ var b = Array.from(document.querySelectorAll('.ks-menubar-item')).find(function(x){ return x.textContent === 'Insert'; }); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.click(); })()`);
    await wait(250);
    await q(`(function(){ var it = Array.from(document.querySelectorAll('.ks-menu-item')).find(function(x){ return x.textContent.trim().indexOf('Chart') === 0; }); it.click(); })()`);
    await wait(300);
    check('Insert > Chart: a column chart of the selection, beside it, selected', (await charts()) === 'column O30:U45' && (await q(`!!document.querySelector('.ks-chart-panel')`)), await charts());
    void k30;

    // without the access row `chart`: seen, not changed
    await q(`${W}.setAccess([{ who: '*', effect: 'allow', action: 'read' }], 'tamu')`);
    await wait(300);
    const only = await q(`${W}.charts(${S})[0].id`);
    await q(`${W}.setChart(${S}, ${JSON.stringify(only)}, { at: 'B3:E14' })`);
    await wait(300);
    const seen = await boxOf('.ks-chart');
    await click(seen.x + seen.w - 20, seen.y + 20);
    await wait(250);
    check('without `chart`: a click does not select it, no editor', !(await q(`!!document.querySelector('.ks-chart-selected') || !!document.querySelector('.ks-chart-panel')`)));
    await q(`${W}.setAccess(null)`);
}, 'control.js');

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
