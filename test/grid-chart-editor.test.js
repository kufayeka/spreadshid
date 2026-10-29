// The chart editor in a real Chrome, by real mouse moves and keys: a click on a column of the chart picks its series in the editor's tree; every kind
// of field changes the chart (a colour swatch, a choice, a switch, a number with Enter, a text); the eye hides a series; Axes and Title nodes;
// Data > Add series and its range picked from the grid with ⊞; ⧉ copies a chart's style and ⎘ pastes it on another; a cell of a group of sparklines
// opens their editor.
//   node test/grid-chart-editor.test.js     (needs Chrome)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js, click, mouse, type, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    const q = (expr) => js(expr);
    const W = 'window.__workbook', S = 'window.__workbook.sheetIds()[0]';
    const cellAt = (r, c) => q(`(function(){ var h = document.querySelector('.ks-colhead[data-c="${c}"]'), v = document.querySelector('.ks-rowhead[data-r="${r}"]'); var a = h.getBoundingClientRect(), b = v.getBoundingClientRect(); return { x: Math.round(a.left + a.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const centerOf = (expr) => q(`(function(){ var e = ${expr}; if (!e) return null; e.scrollIntoView({ block: 'nearest' }); var b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const press = async (expr) => { const p = await centerOf(expr); if (!p) return false; await click(p.x, p.y); await wait(200); return true; };
    const node = (label) => `Array.from(document.querySelectorAll('.ks-ins-tree [role="treeitem"]')).find(function(x){ return x.textContent.trim().indexOf(${JSON.stringify(label)}) === 0; })`;
    const picked = () => q(`(function(){ var e = document.querySelector('.ks-ins-tree [aria-selected="true"]'); return e ? e.textContent.trim() : null; })()`);
    const row = (key) => `document.querySelector('.ks-ins-row[data-key="${key}"]')`;
    const chart = () => q(`${W}.charts(${S})[0]`);
    const typeInto = async (key, text) => {
        await press(`${row(key)}.querySelector('input')`);
        await key_('a', 'KeyA', 65, 2);
        await key_('Backspace', 'Backspace', 8);
        if (text) await type(text);
        await key_('Enter', 'Enter', 13);
        await wait(200);
    };
    const key_ = key;

    await q(`${W}.setValues(${S}, 'B40', [['Bulan','Semen','Besi'],['Mei',182,96],['Jun',205,110],['Jul',171,124],['Agu',226,131]])`);
    const id = await q(`${W}.addChart(${S}, { at: 'B3:H16', data: 'B40:D44', type: 'column' })`);
    await wait(400);

    // a click on a column of the first series: the first purple pixel of the canvas
    const bar = await q(`(function(){ var cv = document.querySelector('.ks-chart canvas'), b = cv.getBoundingClientRect(), r = cv.width / b.width, d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        for (var y = Math.round(cv.height * 0.9); y > 0; y -= 2) for (var x = 0; x < cv.width; x += 2) { var i = (y * cv.width + x) * 4; if (d[i] === 105 && d[i + 1] === 41 && d[i + 2] === 196) return { x: Math.round(b.left + x / r) + 2, y: Math.round(b.top + y / r) - 2 }; } return null; })()`);
    await click(bar.x, bar.y);
    await wait(300);
    check('a click on a column picks its series in the editor', (await picked()) && (await picked()).indexOf('Semen') === 0, await picked());

    // the series' fields
    await press(`${row('series.color')}.querySelectorAll('.ks-ins-swatch')[2]`);
    check('a colour swatch sets the series\' colour', (await chart()).series[0].color === '#005d5d', (await chart()).series);
    await press(`Array.from(${row('series.type')}.querySelectorAll('button')).find(function(b){ return b.textContent === 'Line'; })`);
    check('a choice sets how the series is drawn', (await chart()).series[0].type === 'line');
    await press(`${row('series.labels')}.querySelector('input')`);
    check('a switch turns its labels on', (await chart()).series[0].labels === true);
    await typeInto('series.width', '4');
    check('a number with Enter sets the line width', (await chart()).series[0].width === 4, (await chart()).series[0]);
    await press(`${node('Besi')}.querySelector('.ks-ins-eye')`);
    check('the eye hides a series', (await chart()).series[1].hidden === true);

    // the axes and the title
    await press(node('Axes'));
    await typeInto('y.min', '50');
    await typeInto('y.suffix', ' zak');
    check('Axes: the value axis\' min and the text after its numbers', JSON.stringify((await chart()).y) === JSON.stringify({ min: 50, suffix: ' zak' }), (await chart()).y);
    await typeInto('y.min', '');
    check('emptying a field takes the setting away', JSON.stringify((await chart()).y) === JSON.stringify({ suffix: ' zak' }), (await chart()).y);
    await press(node('Title'));
    await typeInto('title', 'Penjualan');
    await press(`Array.from(${row('legend')}.querySelectorAll('button')).find(function(b){ return b.textContent === 'Right'; })`);
    check('Title and legend', (await chart()).title === 'Penjualan' && (await chart()).legend === 'right');

    // a series of its own range: Data > Add series, its values picked in the grid
    await press(node('Data'));
    await press(`Array.from(document.querySelectorAll('.ks-ins-actions button')).find(function(b){ return b.textContent === 'Add series'; })`);
    check('Add series: a new series, picked in the tree', (await picked()) === 'Series 3●' || ((await picked()) || '').indexOf('Series 3') === 0, await picked());
    await press(`${row('series.values')}.querySelector('.ks-ins-pick')`);
    await q("document.querySelector('.ks-grid').scrollTop = 600");
    await wait(300);
    const a = await cellAt(40, 2), b = await cellAt(43, 2);
    await mouse('mouseMoved', a.x, a.y); await mouse('mousePressed', a.x, a.y, { buttons: 1 });
    await mouse('mouseMoved', b.x, b.y, { buttons: 1 }); await mouse('mouseReleased', b.x, b.y);
    await wait(300);
    check('⊞ then a drag in the grid gives the field its range', (await chart()).series[2].values === 'C41:C44', (await chart()).series);
    check('and the chart draws it', (await q(`${W}.chartData(${S}, ${JSON.stringify(id)}).series[2].values.join()`)) === '182,205,171,226');
    await q("document.querySelector('.ks-grid').scrollTop = 0");
    await wait(300);
    check('the editor stayed open while picking', await q(`!!document.querySelector('.ks-chart-panel')`));

    // copy a style, paste it on another chart
    await press(`document.querySelector('.ks-chart-panel [aria-label="Copy style"]')`);
    const other = await q(`${W}.addChart(${S}, { at: 'B20:H30', data: 'B40:D44', type: 'line' })`);
    await wait(300);
    const second = await q(`(function(){ var e = document.querySelector('.ks-chart[data-chart=' + JSON.stringify(${JSON.stringify(other)}) + ']'); e.scrollIntoView({ block: 'center' }); var b = e.getBoundingClientRect(); return { x: Math.round(b.right - 20), y: Math.round(b.top + 20) }; })()`);
    await click(second.x, second.y);
    await wait(300);
    await press(`document.querySelector('.ks-chart-panel [aria-label="Paste style"]')`);
    const pasted = await q(`${W}.charts(${S}).find(function(c){ return c.id === ${JSON.stringify(other)}; })`);
    check('⧉ and ⎘: the other chart takes the style (kind, title, legend, axis, series colours), not the ranges', pasted.type === 'column' && pasted.title === 'Penjualan' && pasted.legend === 'right' && pasted.series[0].color === '#005d5d' && pasted.atText === 'B20:H30' && !pasted.series[2].values, pasted);
    await key('Escape', 'Escape', 27);

    // a cell of a group of sparklines opens their editor
    await q(`${W}.addSparkline(${S}, { at: 'J3:J6', data: 'C41:D44' })`);
    await q("document.querySelector('.ks-grid').scrollTop = 0; document.querySelector('.ks-grid').scrollLeft = 0; window.scrollTo(0, 0); document.scrollingElement.scrollTop = 0; document.querySelectorAll('*').forEach(function(e){ if (e.scrollTop && !e.classList.contains('ks-grid')) e.scrollTop = 0; })");
    await wait(300);
    const n31 = await cellAt(2, 9);
    await click(n31.x, n31.y);
    await wait(300);
    check('a cell of sparklines opens their editor', await q(`!!document.querySelector('[aria-label="Sparkline editor"]')`));
    await press(`Array.from(${row('type')}.querySelectorAll('button')).find(function(b){ return b.textContent === 'Column'; })`);
    check('and its fields change them', (await q(`${W}.sparklines(${S})[0].type`)) === 'column');
}, 'control.js');

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
