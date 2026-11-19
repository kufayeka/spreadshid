// Saving from the File menu in a real Chrome: the three items show because the host saves (onSave), each hands the host its mode and the document,
// Ctrl+S saves, the items are greyed while a save is on its way (one click never saves twice), a failed save is told as an error, and the access rows
// grey what a person may not do (file.* for a viewer, file.save alone for a supervisor) and refuse Ctrl+S with the row's message.
//   node test/grid-save.test.js     (needs Chrome)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js, click, key, wait }) => {
    for (let i = 0; i < 60 && !(await js('!!window.__workbook')); i++) await wait(250);
    await wait(400);
    const q = (expr) => js(expr);
    const centerOf = (expr) => q(`(function(){ var e = ${expr}; if (!e) return null; var b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    const menuItem = (text) => `Array.from(document.querySelectorAll('.ks-menu-item')).find(function(x){ return x.textContent.indexOf(${JSON.stringify(text)}) === 0; })`;
    const openFile = async () => {
        const at = await centerOf(`Array.from(document.querySelectorAll('.ks-menubar-item')).find(function(x){ return x.textContent === 'File'; })`);
        await click(at.x, at.y);
        await wait(200);
    };
    const greyed = (text) => q(`(function(){ var x = ${menuItem(text)}; return !!x && (x.getAttribute('aria-disabled') === 'true' || x.hasAttribute('data-disabled')); })()`);
    const choose = async (text) => { const at = await centerOf(menuItem(text)); await click(at.x, at.y); await wait(300); };
    const saves = () => q('JSON.stringify(window.__saves.map(function(s){ return s.mode; }))').then(JSON.parse);
    const lastNotice = () => q('JSON.stringify(window.__notices[window.__notices.length - 1] || null)').then(JSON.parse);
    const clickCell = async () => { const at = await centerOf(`document.querySelector('.ks-rowhead[data-r="1"]')`); await click(at.x + 80, at.y); await wait(150); };

    await openFile();
    check('the File menu has Save, Save as new version and Save as a copy', (await q(`!!${menuItem('Save')} && !!${menuItem('Save as new version')} && !!${menuItem('Save as a copy')}`)));
    await choose('Save as new version');
    check('Save as new version hands the host its mode and the document', JSON.stringify(await saves()) === '["saveAsNewVersion"]' && (await q('window.__saves[0].id === window.__workbook.toJSON().id')), await saves());
    check('a save that went through is told as "Saved as a new version"', (await lastNotice()).reason === 'Saved as a new version', await lastNotice());

    await openFile();
    await choose('Save as a copy');
    await clickCell();
    await key('s', 'KeyS', 83, 2);
    await wait(300);
    check('Save as a copy, then Ctrl+S (save)', JSON.stringify(await saves()) === '["saveAsNewVersion","saveAsACopy","save"]', await saves());

    // a slow save: the items are greyed until it ends, and a second Ctrl+S does not save twice
    await q('window.__slow = 1200');
    await key('s', 'KeyS', 83, 2);
    await wait(150);
    await key('s', 'KeyS', 83, 2);
    await wait(150);
    await openFile();
    check('while a save is on its way the three items are greyed', (await greyed('Save')) && (await greyed('Save as new version')) && (await greyed('Save as a copy')));
    await key('Escape', 'Escape', 27);
    await wait(1400);
    check('a second Ctrl+S while saving did not save twice', (await saves()).length === 4, await saves());
    await q('window.__slow = 0; window.__fail = "the server is down"');
    await clickCell();
    await key('s', 'KeyS', 83, 2);
    await wait(300);
    const failed = await lastNotice();
    check('a failed save is told as an error with the host\'s reason', failed.kind === 'error' && failed.reason === 'The file was not saved: the server is down', failed);
    await q('window.__fail = null');

    // the access rows: a viewer may save in no way, a supervisor may not overwrite but may save a version or a copy
    const ROWS = [
        { who: '*', effect: 'allow', action: '*' },
        { who: 'group:viewer', effect: 'deny', action: 'file.*', message: 'You can only view this file' },
        { who: 'group:spv', effect: 'deny', action: 'file.save', message: 'Save a new version instead' }
    ];
    const PEOPLE = { users: [{ id: 'v', name: 'Vina' }, { id: 's', name: 'Satria' }], groups: { viewer: ['v'], spv: ['s'] } };
    const asPerson = (id) => q(`(function(){ var w = window.__workbook; w.setPeople(${JSON.stringify(PEOPLE)}); w.setWho({ who: ${JSON.stringify(id)} }); w.setAccess(${JSON.stringify(ROWS)}); })()`);
    await asPerson('v');
    await wait(300);
    await openFile();
    check('a viewer: the three are greyed', (await greyed('Save')) && (await greyed('Save as new version')) && (await greyed('Save as a copy')));
    await key('Escape', 'Escape', 27);
    await clickCell();
    const before = (await saves()).length;
    await key('s', 'KeyS', 83, 2);
    await wait(300);
    const refused = await lastNotice();
    check('a viewer: Ctrl+S is refused with the row\'s message and nothing is saved', refused.kind === 'refused' && refused.reason === 'You can only view this file' && (await saves()).length === before, refused);

    await asPerson('s');
    await wait(300);
    await openFile();
    check('a supervisor: Save greyed, the other two not', (await greyed('Save')) && !(await greyed('Save as new version')) && !(await greyed('Save as a copy')));
    await key('Escape', 'Escape', 27);
}, 'save.js');

console.log(failures ? failures + ' FAILED' : 'ALL OK');
process.exit(failures ? 1 : 0);
