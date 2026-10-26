// The grid on screen (step R2a), in a real Chrome with the real mouse wheel: the headers, the frozen rows and columns, merged blocks, texts that run on,
// styles, and a sheet of 100 000 rows that scrolls to its end with only the cells on screen drawn.
//   node test/grid-view.test.js     (needs Chrome)
import { geometryChecks } from './geometry-checks.js';
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

geometryChecks(check);

await withExample(async ({ js, mouse, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    const q = (expr) => js(expr);
    const cellText = (r, c) => q(`(function(){ var e = document.querySelector('.ks-main .ks-cell[data-r="${r}"][data-c="${c}"], .ks-left .ks-cell[data-r="${r}"][data-c="${c}"], .ks-top .ks-cell[data-r="${r}"][data-c="${c}"], .ks-corner .ks-cell[data-r="${r}"][data-c="${c}"]'); return e ? e.textContent : null; })()`);
    const firstRowShown = () => q(`(function(){ var heads = Array.from(document.querySelectorAll('.ks-heads-rows:not(.ks-frozen) .ks-rowhead')); var pane = document.querySelector('.ks-heads-rows:not(.ks-frozen)').getBoundingClientRect(); var seen = heads.filter(function(h){ var r = h.getBoundingClientRect(); return r.bottom > pane.top + 2; }); return seen.length ? Number(seen[0].textContent) : null; })()`);

    check('column letters and row numbers', (await q('document.querySelector(".ks-colhead[data-c=\\"1\\"]").textContent')) === 'B' && (await q('document.querySelector(".ks-rowhead[data-r=\\"3\\"]").textContent')) === '4');
    check('a cell shows its value, a formula its result', (await cellText(3, 1)) === 'Work item number 1' && (await cellText(3, 5)) === '15000');
    check('the grand total of 100 000 formulas', (await cellText(1, 7)) === '63749900000', await cellText(1, 7));
    check('a style shows: bold, a fill, centred', await q(`(function(){ var t = document.querySelector('.ks-cell[data-r="2"][data-c="1"] .ks-text'); var cs = getComputedStyle(t); var cell = t.parentElement; return cs.fontWeight === '700' && getComputedStyle(cell).backgroundColor === 'rgb(232, 240, 254)' && cs.textAlign === 'center'; })()`));
    check('a border from the style is drawn', await q(`(function(){ var b = document.querySelector('.ks-cell[data-r="2"][data-c="1"] .ks-borders'); return !!b && getComputedStyle(b).borderBottomWidth === '2px'; })()`));
    check('a merged block is one cell as wide as its columns (A to F)', await q(`(function(){ var m = document.querySelector('.ks-top .ks-merged[data-r="1"][data-c="0"]'); return !!m && Math.round(m.getBoundingClientRect().width) === 100 + 260 + 100 * 3 + 140; })()`));
    check('and the cells under it are not drawn', !(await q('!!document.querySelector(".ks-top .ks-cell[data-r=\\"1\\"][data-c=\\"2\\"]")')));
    check('a text runs on into the empty cells on its right ("Total" in H1)', await q(`(function(){ var t = document.querySelector('.ks-top .ks-cell[data-r="0"][data-c="7"]'); return !!t && Math.round(t.getBoundingClientRect().width) > 100 && !document.querySelector('.ks-top .ks-cell[data-r="0"][data-c="8"]'); })()`));

    // the real wheel, over the grid
    const before = await firstRowShown();
    for (let i = 0; i < 5; i++) { await mouse('mouseWheel', 700, 400, { deltaX: 0, deltaY: 300 }); await wait(80); }
    await wait(300);
    const after = await firstRowShown();
    check('the wheel scrolls the rows (first row below the frozen ones: ' + before + ' -> ' + after + ')', after > before + 40, { before, after });
    check('the frozen rows stay where they are', (await cellText(2, 1)) === 'Description');
    check('the frozen column stays where it is', (await q('(function(){ var e = document.querySelector(".ks-left .ks-cell[data-c=\\"0\\"]"); return !!e && e.getBoundingClientRect().left < 160; })()')));

    // the end of the sheet: the scroller's own end (what dragging the scrollbar to the bottom does)
    const t0 = await q('performance.now()');
    await q('(function(){ var g = document.querySelector(".ks-grid"); g.scrollTop = g.scrollHeight; return 1; })()');
    await wait(400);
    const lastHead = await q('(function(){ var h = Array.from(document.querySelectorAll(".ks-heads-rows:not(.ks-frozen) .ks-rowhead")).map(function(x){ return Number(x.textContent); }); return Math.max.apply(null, h); })()');
    check('the last of 100 010 rows can be reached', lastHead === 100010, lastHead);
    check('its cells show (row 100 003: "Work item number 100000")', (await cellText(100002, 1)) === 'Work item number 100000', await cellText(100002, 1));
    const drawn = await q('document.querySelectorAll(".ks-cell").length');
    check('only the cells on screen are drawn (' + drawn + ')', drawn < 1500, drawn);
    void t0;

    // a frame after a scroll is drawn quickly: 20 scrolls by a screen, timed in the page
    const frame = await q(`(async function(){ var g = document.querySelector('.ks-grid'); var times = []; for (var i = 0; i < 20; i++) { var t = performance.now(); g.scrollTop = 500000 + i * 700; await new Promise(function(r){ requestAnimationFrame(function(){ requestAnimationFrame(r); }); }); times.push(performance.now() - t); } times.sort(function(a,b){ return a-b; }); return Math.round(times[10]); })()`);
    check('a scroll by a screen is drawn in under 50 ms (median ' + frame + ' ms)', frame < 50, frame);
});
console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
