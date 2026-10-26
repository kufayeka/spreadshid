// Sizes (step R2c), in a real Chrome with the real mouse: dragging the edge of a column and of a row, several selected columns at once, a double click to
// fit the content, undo, rows that grow for a wrapped text and for a text of several lines (Alt+Enter), and the guide line while dragging.
//   node test/grid-resize.test.js     (needs Chrome)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js, click, mouse, type, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    const q = (expr) => js(expr);
    const S = 'window.__workbook.sheetIds()[0]';
    const colWidth = (c) => q(`window.__workbook.colAxis(${S}).size(${c})`);
    const rowHeight = (r) => q(`window.__workbook.rowAxis(${S}).size(${r})`);
    const centerOf = (selector) => q(`(function(){ var e = document.querySelector('${selector}'); if (!e) return null; var b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const dragBy = async (from, dx, dy, during) => {
        await mouse('mouseMoved', from.x, from.y);
        await mouse('mousePressed', from.x, from.y);
        for (let i = 1; i <= 6; i++) { await mouse('mouseMoved', from.x + (dx * i) / 6, from.y + (dy * i) / 6, { buttons: 1 }); await wait(25); }
        if (during) await during();
        await mouse('mouseReleased', from.x + dx, from.y + dy);
        await wait(150);
    };
    const doubleClick = async (p) => {
        await mouse('mouseMoved', p.x, p.y);
        await mouse('mousePressed', p.x, p.y); await mouse('mouseReleased', p.x, p.y);
        await mouse('mousePressed', p.x, p.y, { clickCount: 2 }); await mouse('mouseReleased', p.x, p.y, { clickCount: 2 });
        await wait(200);
    };

    // one column, dragged by its edge
    let guideSeen = false;
    await dragBy(await centerOf('.ks-colresize[data-resize-col="2"]'), 60, 0, async () => { guideSeen = await q('!!document.querySelector(".ks-guide.ks-v")'); });
    check('a line shows where the edge goes while it is dragged', guideSeen);
    check('dragging the edge of column C by 60 px makes it 160 px wide', (await colWidth(2)) === 160, await colWidth(2));
    check('and the guide is gone after', !(await q('!!document.querySelector(".ks-guide")')));
    await key('z', 'KeyZ', 90, 2);
    await wait(150);
    check('Ctrl+Z gives it its width back', (await colWidth(2)) === 100, await colWidth(2));

    // two whole columns selected: dragging one edge sizes both
    await click(...Object.values(await centerOf('.ks-colhead[data-c="3"]')));
    await click(...Object.values(await centerOf('.ks-colhead[data-c="4"]')), { modifiers: 8 });
    await wait(100);
    await dragBy(await centerOf('.ks-colresize[data-resize-col="4"]'), -30, 0);
    check('with columns D and E selected, dragging the edge of E sizes both to 70 px', (await colWidth(3)) === 70 && (await colWidth(4)) === 70, [await colWidth(3), await colWidth(4)]);

    // a double click on an edge fits the column to its widest text (column B: "Work item number 100000")
    await click(...Object.values(await centerOf('.ks-colhead[data-c="1"]')));
    await doubleClick(await centerOf('.ks-colresize[data-resize-col="1"]'));
    const fitted = await colWidth(1);
    check('a double click on the edge of B fits it to its widest text (' + fitted + ' px, it was 260)', fitted > 120 && fitted < 220, fitted);

    // rows: drag, then a double click gives the row the height its text needs again
    await dragBy(await centerOf('.ks-rowresize[data-resize-row="9"]'), 0, 20);
    check('dragging the bottom edge of row 10 by 20 px makes it 41 px high', (await rowHeight(9)) === 41, await rowHeight(9));
    await doubleClick(await centerOf('.ks-rowresize[data-resize-row="9"]'));
    check('a double click on its edge gives it back the height its text needs (21 px)', (await rowHeight(9)) === 21, await rowHeight(9));

    // rows grow for their text
    await q(`(function(){ var wb = window.__workbook, s = ${S}; wb.setValues(s, 14, 7, 'A long note that wraps inside its cell, so the row grows to show all of it'); wb.setStyle(s, { r1: 14, c1: 7, r2: 14, c2: 7 }, { wrap: 'wrap' }); return 1; })()`);
    await wait(250);
    const wrapped = await rowHeight(14);
    check('a wrapped long text makes its row grow (' + wrapped + ' px)', wrapped > 60, wrapped);
    check('and its text fits in the row', await q(`(function(){ var c = document.querySelector('.ks-cell[data-r="14"][data-c="7"]'); var t = c.querySelector('.ks-text'); return t.getBoundingClientRect().top >= c.getBoundingClientRect().top - 1; })()`));
    // Alt+Enter types a second line
    await click(...Object.values(await centerOf('.ks-cell[data-r="16"][data-c="1"]')));
    await key('F2', 'F2', 113);
    await key('Enter', 'Enter', 13, 1);
    await type('second line');
    await key('Enter', 'Enter', 13);
    await wait(250);
    check('Alt+Enter puts a new line in the cell, and the row grows for it', (await q(`window.__workbook.value(${S}, 16, 1)`)) === 'Work item number 14\nsecond line' && (await rowHeight(16)) > 30,
        [await q(`window.__workbook.value(${S}, 16, 1)`), await rowHeight(16)]);
    // a row whose height was set by hand keeps it, whatever its text
    await q(`window.__workbook.setRowProps(${S}, [14], { height: 30 })`);
    await wait(250);
    check('a height set by hand wins over the text', (await rowHeight(14)) === 30);
});
console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
