// Sheets, find and the right-click menu (step R2e) in a real Chrome with the real mouse and keyboard: the tabs (show, add, rename, duplicate, hide and
// show again, delete, drag to move), Ctrl+F with Enter going to the matches, Ctrl+H replacing all, and the menu of a cell and of a column header
// (insert rows, sort the sheet, delete a column). The rules underneath are checked without a browser in search.test.js.
//   node test/grid-sheets.test.js     (needs Chrome)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js, click, mouse, type, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    const q = (expr) => js(expr);
    const centerOf = (selector) => q(`(function(){ var e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; var b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const clickOn = async (selector, extra) => { const p = await centerOf(selector); if (!p) return false; await click(p.x, p.y, extra); await wait(150); return true; };
    const rightClick = async (selector) => { const p = await centerOf(selector); await mouse('mouseMoved', p.x, p.y); await mouse('mousePressed', p.x, p.y, { button: 'right', buttons: 2 }); await mouse('mouseReleased', p.x, p.y, { button: 'right', buttons: 0 }); await wait(300); };
    const menuPick = async (label) => { const p = await q(`(function(){ var e = Array.from(document.querySelectorAll('.ks-menu-item')).find(function(x){ return x.textContent.indexOf(${JSON.stringify(label)}) === 0; }); if (!e) return null; var b = e.getBoundingClientRect(); return { x: Math.round(b.left + 20), y: Math.round(b.top + b.height / 2) }; })()`); if (!p) return false; await click(p.x, p.y); await wait(250); return true; };
    const tabs = () => q('Array.from(document.querySelectorAll(".ks-tab")).map(function(t){ return t.textContent + (t.classList.contains("ks-active-tab") ? "*" : ""); }).join(",")');
    const tabSel = async (name) => '.ks-tab[data-sheet="' + (await q(`window.__workbook.sheetIds().find(function(id){ return window.__workbook.sheetProps(id).name === ${JSON.stringify(name)}; })`)) + '"]';
    const W = 'window.__workbook';

    // tabs
    check('the tabs show the sheets, the first one active', (await tabs()) === 'BOQ*,Rates', await tabs());
    await clickOn(await tabSel('Rates'));
    check('clicking a tab shows its sheet', (await tabs()) === 'BOQ,Rates*' && (await q('document.querySelector(".ks-cell[data-r=\\"1\\"][data-c=\\"0\\"]").textContent')) === 'Concrete K-300');
    await clickOn('.ks-tab-button[aria-label="Add sheet"]');
    check('+ adds a sheet and shows it', (await tabs()) === 'BOQ,Rates,Sheet3*', await tabs());
    const s3 = await centerOf(await tabSel('Sheet3'));
    await mouse('mouseMoved', s3.x, s3.y); await mouse('mousePressed', s3.x, s3.y); await mouse('mouseReleased', s3.x, s3.y);
    await mouse('mousePressed', s3.x, s3.y, { clickCount: 2 }); await mouse('mouseReleased', s3.x, s3.y, { clickCount: 2 });
    await wait(200);
    await key('a', 'KeyA', 65, 2);
    await type('Progress');
    await key('Enter', 'Enter', 13);
    await wait(200);
    check('a double click renames the tab', (await tabs()) === 'BOQ,Rates,Progress*', await tabs());
    await rightClick(await tabSel('Progress'));
    await menuPick('Duplicate');
    check('Duplicate makes "Copy of Progress" right after it', (await tabs()) === 'BOQ,Rates,Progress,Copy of Progress*', await tabs());
    await rightClick(await tabSel('Rates'));
    await menuPick('Hide sheet');
    check('Hide sheet takes the tab away', (await tabs()).indexOf('Rates') === -1, await tabs());
    check('and the formulas still read it', await q(`${W}.value(${W}.sheetIdByName('Rates'), 1, 1)`) === 1250000);
    await clickOn('.ks-tab-button[aria-label="All sheets"]');
    await menuPick('(hidden) Rates');
    check('the list of all sheets shows a hidden one again', (await tabs()).indexOf('Rates*') !== -1, await tabs());
    await rightClick(await tabSel('Copy of Progress'));
    await menuPick('Delete');
    check('Delete removes the sheet', (await tabs()).indexOf('Copy of Progress') === -1, await tabs());

    // drag the tab "Progress" before "BOQ"
    const from = await centerOf(await tabSel('Progress'));
    const to = await q(`(function(){ var b = document.querySelector('.ks-tab').getBoundingClientRect(); return { x: Math.round(b.left + 4), y: Math.round(b.top + b.height / 2) }; })()`);
    await mouse('mouseMoved', from.x, from.y); await mouse('mousePressed', from.x, from.y);
    for (let i = 1; i <= 8; i++) { await mouse('mouseMoved', from.x + ((to.x - from.x) * i) / 8, from.y, { buttons: 1 }); await wait(30); }
    await mouse('mouseReleased', to.x, to.y);
    await wait(200);
    check('dragging a tab moves the sheet', (await tabs()).startsWith('Progress'), await tabs());

    // find
    await clickOn(await tabSel('BOQ'));
    await clickOn('.ks-rowhead[data-r="5"]');
    await key('f', 'KeyF', 70, 2);
    await wait(200);
    await type('number 99999');
    await wait(400);
    check('Ctrl+F opens the find bar and counts the matches', (await q('document.querySelector(".ks-find-count").textContent')) === '1 of 1' || (await q('document.querySelector(".ks-find-count").textContent')).endsWith('of 1'), await q('document.querySelector(".ks-find-count").textContent'));
    await key('Enter', 'Enter', 13);
    await wait(400);
    const label = await q('document.querySelector(".ks-input").getAttribute("aria-label")');
    check('Enter goes to the match, far down the sheet (B100002)', label === 'Cell B100002', label);
    check('and the grid scrolled to it', await q('!!document.querySelector(".ks-mark")'));
    await key('Escape', 'Escape', 27);
    await wait(150);
    check('Escape closes the find bar', !(await q('!!document.querySelector(".ks-findbar")')));

    // find and replace all, in the sheet Rates
    await clickOn(await tabSel('Rates'));
    await clickOn('.ks-rowhead[data-r="0"]');
    await key('h', 'KeyH', 72, 2);
    await wait(300);
    // the dialog keeps the last thing looked for (as Google Sheets does): it is typed over
    await key('a', 'KeyA', 65, 2);
    await type('e');
    const replaceBox = await q('(function(){ var i = document.querySelectorAll(".ks-dialog input")[1]; var b = i.getBoundingClientRect(); return { x: Math.round(b.left + 10), y: Math.round(b.top + b.height / 2) }; })()');
    await click(replaceBox.x, replaceBox.y);
    await type('E');
    await wait(300);
    const replaceAll = await q('(function(){ var b = Array.from(document.querySelectorAll(".ks-dialog .ks-button")).find(function(x){ return x.textContent === "Replace all"; }).getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()');
    await click(replaceAll.x, replaceAll.y);
    await wait(300);
    check('Ctrl+H, then Replace all, replaces in every cell and says how many', (await q('document.querySelector(".ks-dialog-status").textContent')) === 'Replaced 4 cells' && (await q(`${W}.value(${W}.sheetIdByName('Rates'), 1, 0)`)) === 'ConcrEtE K-300',
        [await q('document.querySelector(".ks-dialog-status").textContent'), await q(`${W}.value(${W}.sheetIdByName('Rates'), 1, 0)`)]);
    await key('Escape', 'Escape', 27);
    await wait(200);
    check('Escape closes the dialog', !(await q('!!document.querySelector(".ks-dialog")')));

    // the right-click menu
    await clickOn(await tabSel('BOQ'));
    // BOQ comes back where it was left (the find took it far down); Ctrl+Home goes back to the top, past its frozen header
    const firstShown = () => q('(function(){ var pane = document.querySelector(".ks-heads-rows:not(.ks-frozen)").getBoundingClientRect(); var seen = Array.from(document.querySelectorAll(".ks-heads-rows:not(.ks-frozen) .ks-rowhead")).filter(function(h){ return h.getBoundingClientRect().bottom > pane.top + 2; }); return seen.length ? Number(seen[0].textContent) : null; })()');
    const back = await firstShown();
    check('a sheet comes back where it was left (far down, where the find went: row ' + back + ')', back > 99000, back);
    await clickOn('.ks-heads-rows:not(.ks-frozen) .ks-rowhead');
    await key('Home', 'Home', 36, 2);
    await wait(300);
    check('Ctrl+Home goes to A1 and scrolls the rows under the frozen header back to the top', (await firstShown()) === 4, await firstShown());
    const B = `${W}.sheetIdByName('BOQ')`;
    const rowsBefore = await q(`${W}.size(${B}).rows`);
    await rightClick('.ks-cell[data-r="5"][data-c="1"]');
    await menuPick('Insert 1 row above');
    check('the menu of a cell inserts a row above', (await q(`${W}.size(${B}).rows`)) === rowsBefore + 1 && (await q(`${W}.value(${B}, 5, 1)`)) === null && (await q(`${W}.value(${B}, 6, 1)`)) === 'Work item number 3');
    await key('z', 'KeyZ', 90, 2);
    await wait(200);
    await rightClick('.ks-colhead[data-c="3"]');
    await menuPick('Sort sheet Z to A');
    await wait(500);
    check('the menu of a column header sorts the sheet below its frozen rows (quantity, Z to A)', (await q(`${W}.value(${B}, 3, 3)`)) === 50 && (await q(`${W}.value(${B}, 2, 3)`)) === 'Quantity',
        [await q(`${W}.value(${B}, 2, 3)`), await q(`${W}.value(${B}, 3, 3)`)]);
    check('and the grand total over the sorted column is the same', (await q(`${W}.value(${B}, 1, 7)`)) === 63749900000, await q(`${W}.value(${B}, 1, 7)`));
    await rightClick('.ks-colhead[data-c="6"]');
    await menuPick('Delete column G');
    check('the menu of a column header deletes the column', (await q(`${W}.input(${B}, 0, 6)`)) === 'Total', await q(`${W}.input(${B}, 0, 6)`));
});
console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
