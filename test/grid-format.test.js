// The toolbar, the formula bar, the name box and the menu bar (step R3), in a real Chrome with the real mouse and keyboard. The rules underneath are checked
// without a browser in format.test.js and toolbar.test.js.
//   node test/grid-format.test.js     (needs Chrome)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js, send, click, mouse, type, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    const q = (expr) => js(expr);
    const S = 'window.__workbook.sheetIds()[0]';
    const W = 'window.__workbook';
    const style = (r, c) => q(`${W}.style(${S}, ${r}, ${c}) || {}`);
    const shown = (r, c) => q(`${W}.display(${S}, ${r}, ${c}).text`);
    const centerOf = (expr) => q(`(function(){ var e = ${expr}; if (!e) return null; var b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const cellAt = (r, c) => centerOf(`(function(){ var h = document.querySelector('.ks-colhead[data-c="${c}"]'), v = document.querySelector('.ks-rowhead[data-r="${r}"]'); if (!h || !v) return null; var a = h.getBoundingClientRect(), b = v.getBoundingClientRect(); return { getBoundingClientRect: function(){ return { left: a.left, top: b.top, width: a.width, height: b.height }; } }; })()`);
    const clickCell = async (r, c, extra) => { const p = await cellAt(r, c); await click(p.x, p.y, extra); await wait(120); };
    const tool = (label) => centerOf(`document.querySelector('.ks-toolbar [aria-label="${label}"]')`);
    const clickTool = async (label) => { const p = await tool(label); await click(p.x, p.y); await wait(200); };
    const menuPick = async (text) => { const p = await centerOf(`Array.from(document.querySelectorAll('.ks-menu-item')).find(function(x){ return x.textContent.indexOf(${JSON.stringify(text)}) >= 0; })`); if (!p) return false; await mouse('mouseMoved', p.x - 20, p.y); await mouse('mouseMoved', p.x, p.y); await wait(250); await click(p.x, p.y); await wait(300); return true; };
    const hoverItem = async (text) => { const p = await centerOf(`Array.from(document.querySelectorAll('.ks-menu-item')).find(function(x){ return x.textContent.indexOf(${JSON.stringify(text)}) >= 0; })`); await mouse('mouseMoved', p.x - 20, p.y); await mouse('mouseMoved', p.x, p.y); await wait(400); };
    const menubar = async (name) => { const p = await centerOf(`Array.from(document.querySelectorAll('.ks-menubar-item')).find(function(x){ return x.textContent === ${JSON.stringify(name)}; })`); await click(p.x, p.y); await wait(300); };
    const select = async (label, value) => q(`(function(){ var s = document.querySelector('.ks-toolbar [aria-label="${label}"]'); var set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify(String(value))}); s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);

    // bold: the button, its pressed state, and Ctrl+B
    await clickCell(3, 2);
    await clickTool('Bold (Ctrl+B)');
    check('the Bold button makes the selection bold', (await style(3, 2)).bold === true);
    check('and shows pressed for the active cell', await q('document.querySelector(\'.ks-toolbar [aria-label="Bold (Ctrl+B)"]\').getAttribute("aria-pressed") === "true"'));
    await key('b', 'KeyB', 66, 2);
    check('Ctrl+B takes it away again (the keyboard stayed with the grid)', !(await style(3, 2)).bold);

    // money and decimals on the rates of column E
    await clickCell(3, 4);
    await clickCell(5, 4, { modifiers: 8 });
    await clickTool('Format as currency');
    check('the currency button shows the rates as rupiah', (await shown(3, 4)) === 'Rp 15.000,00', await shown(3, 4));
    await clickTool('Decrease decimal places');
    await clickTool('Decrease decimal places');
    check('two clicks on fewer decimals: Rp 15.000', (await shown(3, 4)) === 'Rp 15.000' && (await shown(5, 4)) === 'Rp 20.000', await shown(3, 4));
    await key('z', 'KeyZ', 90, 2);
    check('Ctrl+Z takes one click back', (await shown(3, 4)) === 'Rp 15.000,0', await shown(3, 4));

    // font size: the row grows
    await clickCell(7, 1);
    await select('Font size', 18);
    await wait(300);
    check('a bigger font size makes the row grow', (await style(7, 1)).fontSize === 18 && (await q(`${W}.rowAxis(${S}).size(7)`)) > 21, await q(`${W}.rowAxis(${S}).size(7)`));

    // the text colour from the palette
    await clickCell(8, 1);
    await clickTool('Text color');
    const swatch = await centerOf('document.querySelector(\'.ks-palette [aria-label="#cc0000"]\')');
    await click(swatch.x, swatch.y);
    await wait(200);
    check('a swatch of the palette colours the text', (await style(8, 1)).color === '#cc0000', await style(8, 1));
    check('and the palette closes', !(await q('!!document.querySelector(".ks-palette")')));

    // borders and merge from their menus
    await clickCell(10, 7);
    await clickCell(11, 8, { modifiers: 8 });
    await clickTool('Borders');
    await menuPick('Outer borders');
    check('Borders, Outer borders: the corners get their two sides', Object.keys((await style(10, 7)).borders || {}).sort().join() === 'left,top' && Object.keys((await style(11, 8)).borders || {}).sort().join() === 'bottom,right');
    await clickTool('Merge cells');
    await menuPick('Merge all');
    check('Merge cells, Merge all: one block', JSON.stringify(await q(`${W}.merges(${S}).filter(function(m){ return m.r1 === 10; })`)) === '[{"r1":10,"c1":7,"r2":11,"c2":8}]');

    // paint format: from the bold red cell to another
    await q(`${W}.setStyle(${S}, { r1: 13, c1: 7, r2: 13, c2: 7 }, { bold: true, fill: '#fce5cd' })`);
    await clickCell(13, 7);
    await clickTool('Paint format');
    check('Paint format is on (pressed) after a click', await q('document.querySelector(\'.ks-toolbar [aria-label="Paint format"]\').getAttribute("aria-pressed") === "true"'));
    await clickCell(15, 9);
    check('the next click paints the style there, and paint format turns off', JSON.stringify(await style(15, 9)) === '{"bold":true,"fill":"#fce5cd"}' && (await q('document.querySelector(\'.ks-toolbar [aria-label="Paint format"]\').getAttribute("aria-pressed")')) === 'false', await style(15, 9));

    // zoom
    await select('Zoom', 1.5);
    await wait(300);
    check('zoom 150%: a column of 100 px is drawn 150 px wide', (await q('Math.round(document.querySelector(".ks-colhead[data-c=\\"2\\"]").getBoundingClientRect().width)')) === 150);
    await select('Zoom', 1);
    await wait(300);

    // a link with Ctrl+K
    await clickCell(17, 7);
    await type('Spec sheet');
    await key('Enter', 'Enter', 13);
    await clickCell(17, 7);
    await key('k', 'KeyK', 75, 2);
    await wait(300);
    await type('example.com/spec');
    await key('Enter', 'Enter', 13);
    await wait(300);
    check('Ctrl+K, an address, Enter: the cell links to it (https added)', (await style(17, 7)).link === 'https://example.com/spec' && (await q('!!document.querySelector(".ks-cell[data-r=\\"17\\"][data-c=\\"7\\"] .ks-link")')), await style(17, 7));

    // Σ under three numbers
    await q(`${W}.setValues(${S}, 20, 9, [[1], [2], [3]])`);
    await clickCell(23, 9);
    await clickTool('Functions');
    await menuPick('SUM');
    await wait(200);
    check('Σ, SUM under three numbers starts =SUM(J21:J23)', (await q('document.querySelector(".ks-input").value')) === '=SUM(J21:J23)', await q('document.querySelector(".ks-input").value'));
    await key('Enter', 'Enter', 13);
    check('and Enter works it out', (await q(`${W}.value(${S}, 23, 9)`)) === 6);

    // the formula bar
    await clickCell(25, 9);
    const fx = await centerOf('document.querySelector(".ks-formula")');
    await click(fx.x, fx.y);
    await type('=J24*2');
    await key('Enter', 'Enter', 13);
    await wait(200);
    check('typed in the formula bar, Enter writes the cell and moves down', (await q(`${W}.value(${S}, 25, 9)`)) === 12 && (await q('document.querySelector(".ks-namebox").value')) === 'J27');

    // the name box
    const box = await centerOf('document.querySelector(".ks-namebox")');
    await click(box.x, box.y);
    await key('a', 'KeyA', 65, 2);
    await type('D2000');
    await key('Enter', 'Enter', 13);
    await wait(400);
    check('the name box: D2000 and Enter goes there', (await q('document.querySelector(".ks-input").getAttribute("aria-label")')) === 'Cell D2000' && !!(await cellAt(1999, 3)));

    // typing a date and a percent shortcut, in Indonesian
    await clickCell(1999, 3);
    await type('26/10/2026');
    await key('Enter', 'Enter', 13);
    check('typing 26/10/2026 in an Indonesian sheet gives a date', (await q(`(${W}.cellFormat(${S}, 1999, 3) || {}).type`)) === 'date' && (await shown(1999, 3)) === '26/10/2026');
    await q(`${W}.setValues(${S}, 2000, 3, 0.25)`);
    await key('5', 'Digit5', 53, 10);
    await wait(200);
    check('Ctrl+Shift+5 shows a percent', (await shown(2000, 3)) === '25,00%', await shown(2000, 3));

    // the menu bar
    await menubar('View');
    await hoverItem('Freeze');
    await menuPick('No rows');
    check('View, Freeze, No rows', !(await q(`${W}.sheetProps(${S}).freezeRows`)));
    await menubar('View');
    await hoverItem('Show');
    await menuPick('Gridlines');
    check('View, Show, Gridlines hides the grid lines', (await q('document.querySelectorAll(".ks-line-h").length')) === 0);
    await menubar('File');
    await menuPick('Spreadsheet settings');
    await wait(300);
    await q(`(function(){ var s = document.querySelectorAll('.ks-dialog select'); var set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s[0], 'en-US'); s[0].dispatchEvent(new Event('change', { bubbles: true })); set.call(s[1], 'USD'); s[1].dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
    await wait(200);
    const save = await centerOf('Array.from(document.querySelectorAll(".ks-dialog .ks-button")).find(function(x){ return x.textContent === "Save settings"; })');
    await click(save.x, save.y);
    await wait(300);
    check('File, settings: English (US) and dollars show the amounts as $15,000.00', (await shown(3, 5)) === '$15,000.00', await shown(3, 5));
});
console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
