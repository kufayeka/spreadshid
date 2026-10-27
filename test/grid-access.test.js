// Access control in a real Chrome: a mandor (no menu bar, no toolbar, an area, an edit range) types where it may and is told where it may not; a role
// that may bold but not italic sees Italic greyed, and the Data menu's Sort greyed; copy refused for a role without it; headers and grid lines hidden;
// the policy taken away gives everything back. The rules underneath are in policy.test.js.
//   node test/grid-access.test.js     (needs Chrome)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js, click, mouse, type, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    const q = (expr) => js(expr);
    const W = 'window.__workbook', S = 'window.__workbook.sheetIds()[0]';
    const centerOf = (expr) => q(`(function(){ var e = ${expr}; if (!e) return null; var b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const cellAt = (r, c) => q(`(function(){ var h = document.querySelector('.ks-colhead[data-c="${c}"]'), v = document.querySelector('.ks-rowhead[data-r="${r}"]'); var a = h.getBoundingClientRect(), b = v.getBoundingClientRect(); return { x: Math.round(a.left + a.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const clickCell = async (r, c) => { const p = await cellAt(r, c); await click(p.x, p.y); await wait(150); };
    const notice = () => q('(function(){ var n = document.querySelector(".ks-notice"); return n ? n.textContent : null; })()');
    const setAccess = (policy, who) => q(`${W}.setAccess(${JSON.stringify(policy)}, ${JSON.stringify(who)})`).then(() => wait(300));
    const has = (sel) => q(`!!document.querySelector(${JSON.stringify(sel)})`);
    // the example's own rules (rates read only, approved lines locked, cost hidden) are the host's: they stay under the policy
    const POLICY = {
        owners: ['user:yeka'], default: 'viewer',
        members: { 'group:mandor': 'site', 'user:ani': 'typist' },
        roles: {
            site: { can: ['format.bold'], ui: { menubar: false, toolbar: false, area: 'A1:E20' }, ranges: [{ range: 'B2:B20', mode: 'edit' }] },
            typist: { can: ['edit', 'format.bold'] },
            viewer: { can: [], ui: { headers: false, gridlines: false } }
        }
    };

    await setAccess(POLICY, { user: 'budi', groups: ['mandor'] });
    check('a mandor: no menu bar, no toolbar, the formula bar stays', !(await has('.ks-menubar')) && !(await has('.ks-toolbar')) && (await has('.ks-formulabar')));
    check('only the area A1:E20: column F has no width', (await q('Math.round(document.querySelector(\'.ks-colhead[data-c="5"]\') ? document.querySelector(\'.ks-colhead[data-c="5"]\').getBoundingClientRect().width : 0)')) === 0);
    await clickCell(1, 1);
    await type('12');
    await key('Enter', 'Enter', 13);
    await wait(200);
    check('types in its edit range (Qty)', (await q(`${W}.value(${S}, 1, 1)`)) === 12);
    await clickCell(1, 0);
    await type('X');
    await wait(200);
    check('is told it may not write elsewhere', (await notice()) === 'You can only view this sheet' && (await q(`${W}.value(${S}, 1, 0)`)) === 'Pile', await notice());
    await clickCell(1, 1);
    await key('c', 'KeyC', 67, 2);
    await wait(200);
    check('copy refused (the role was not given it)', (await notice()) === 'You cannot copy from this sheet here', await notice());

    await setAccess(POLICY, 'user:ani');
    check('a typist: the toolbar shows, Bold usable, Italic greyed', (await has('.ks-toolbar')) && !(await q('document.querySelector(\'.ks-toolbar [aria-label^="Bold"]\').disabled')) && (await q('document.querySelector(\'.ks-toolbar [aria-label^="Italic"]\').disabled')));
    check('the fill colour is greyed too', await q('document.querySelector(\'.ks-toolbar [aria-label="Fill color"]\').disabled'));
    const data = await centerOf(`Array.from(document.querySelectorAll('.ks-menubar-item')).find(function(x){ return x.textContent === 'Data'; })`);
    await click(data.x, data.y);
    await wait(300);
    check('the Data menu greys Sort and Create a filter', await q(`Array.from(document.querySelectorAll('.ks-menu-item')).filter(function(x){ return /Sort sheet|Create a filter/.test(x.textContent); }).every(function(x){ return x.getAttribute('aria-disabled') === 'true' || x.hasAttribute('data-disabled'); })`));
    await key('Escape', 'Escape', 27);
    await wait(150);

    await setAccess(POLICY, 'user:someone');
    check('a viewer of this policy: no row numbers, no column letters', (await q('Array.from(document.querySelectorAll(".ks-rowhead")).every(function(h){ return h.getBoundingClientRect().width === 0; })')) && (await q('Array.from(document.querySelectorAll(".ks-colhead")).every(function(h){ return h.getBoundingClientRect().height === 0; })')));
    check('and no grid lines', !(await has('.ks-line-h')));
    const a1 = await q('(function(){ var c = document.querySelector(\'.ks-cell[data-r="0"][data-c="0"]\').getBoundingClientRect(), g = document.querySelector(".ks-grid").getBoundingClientRect(); return [Math.round(c.left - g.left), Math.round(c.top - g.top)]; })()');
    check('A1 is in the corner of the grid', JSON.stringify(a1) === '[0,0]', a1);

    await setAccess(null, null);
    check('the policy taken away: everything is back', (await has('.ks-menubar')) && (await has('.ks-toolbar')) && (await has('.ks-line-h')) && !(await q('document.querySelector(\'.ks-toolbar [aria-label^="Italic"]\').disabled')));
}, 'control.js');

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
