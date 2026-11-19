// Access control as rows of a table (policy.js): who / effect / action / where / when / message. The most specific row wins (user > role > everyone),
// deny wins within a level, and what nobody allows is not given. The same rows decide in the browser (setAccess) and on the server (viewFor, checkPatch).
//   node test/policy.test.js
import { createWorkbook, resolveAccess, validateAccess, parseWhere, viewFor, checkPatch, mergePatch } from '../src/core/index.js';

let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

const ROWS = [
    { who: 'group:kasir', effect: 'allow', action: 'read', where: 'Stok!A1:F10' },
    { who: 'group:kasir', effect: 'allow', action: 'edit', where: 'Stok!C2:C10' },
    { who: 'group:kasir', effect: 'allow', action: 'edit', where: 'Stok!D2:D10', when: '=$E2<>"Approved"', message: 'Already approved' },
    { who: 'group:kasir', effect: 'deny', action: 'read', where: 'Stok!F2:F10' },
    { who: 'group:kasir', effect: 'allow', action: 'format' },
    { who: 'group:kasir', effect: 'deny', action: 'format.bold' },
    { who: 'group:kasir', effect: 'deny', action: 'ui.toolbar' },
    { who: 'group:kasir', effect: 'allow', action: 'sort' },
    { who: 'user:budi', effect: 'allow', action: 'edit', where: 'Stok!B2:B10' },
    { who: 'user:budi', effect: 'allow', action: 'format.bold' },
    { who: 'user:yeka', effect: 'allow', action: '*' },
    { who: '*', effect: 'allow', action: 'view.area', where: 'Stok!A1:F10' }
];

function stok() {
    const wb = createWorkbook();
    wb.sheet(wb.sheetIds()[0]).setSheetProps({ name: 'Stok' });
    const s = wb.sheet('Stok');
    s.setValues('A1', [['Kode', 'Barang', 'Qty', 'Harga', 'Status', 'Modal'], ['S1', 'Semen', 10, 50000, 'Open', 42000], ['B1', 'Besi', 5, 90000, 'Approved', 80000]]);
    return wb;
}

// the parts of where
check('where "Stok!A1:F10"', JSON.stringify(parseWhere('Stok!A1:F10')) === JSON.stringify({ sheet: 'Stok', range: 'A1:F10', columns: null }), parseWhere('Stok!A1:F10'));
check('where "Stok!col:Qty, Harga"', JSON.stringify(parseWhere('Stok!col:Qty, Harga').columns) === '["Qty","Harga"]');
check('where "Stok" is a whole sheet', parseWhere('Stok').sheet === 'Stok' && parseWhere('Stok').range === null);

// actions: a role, a user on top, deny within a level
const rina = resolveAccess(ROWS, { user: 'rina', roles: ['kasir'] });
const budi = resolveAccess(ROWS, { user: 'budi', roles: ['kasir'] });
check('kasir may italic (allow format)', rina.can('format.italic'));
check('kasir may not bold (deny wins in the same level)', !rina.can('format.bold'));
check('budi may bold (a user row beats a role row)', budi.can('format.bold'));
check('kasir may sort, not insert rows (nothing said: not allowed)', rina.can('sort') && !rina.can('rows.insert'));
check('kasir has no toolbar, still a formula bar', rina.ui.toolbar === false && rina.ui.formulaBar === true);
check('everyone sees only Stok!A1:F10', JSON.stringify(rina.ui.area) === '{"Stok":"A1:F10"}', rina.ui.area);
check('yeka is the owner (allow *)', resolveAccess(ROWS, 'yeka').owner === true);
check('someone with no rows may do nothing', !resolveAccess(ROWS, { user: 'tamu' }).can('sort'));

// cells
const wb = stok();
const PEOPLE = { users: [{ id: 'rina', name: 'Rina' }, { id: 'budi', name: 'Budi' }, { id: 'yeka', name: 'Yeka' }, { id: 'tamu', name: 'Tamu' }], groups: { kasir: ['rina', 'budi', 'yeka'] } };
wb.setPeople(PEOPLE);
wb.setWho({ who: 'rina' });
wb.setAccess(ROWS);
const mode = (a) => { const m = wb.modeAt('Stok', ...cellOf(a)); return m ? m.mode : 'edit'; };
function cellOf(a) { const c = a.charCodeAt(0) - 65, r = Number(a.slice(1)) - 1; return [r, c]; }
check('A2: read', mode('A2') === 'readonly', mode('A2'));
check('C2: edit', mode('C2') === 'edit', mode('C2'));
check('D2: edit while the row is Open', mode('D2') === 'edit', mode('D2'));
check('D3: read once the row is Approved (when)', mode('D3') === 'readonly', mode('D3'));
check('F2: deny read shows •••', mode('F2') === 'hidden', mode('F2'));
check('B2: read for rina', mode('B2') === 'readonly', mode('B2'));
check('H1: nobody allows it, it is empty', mode('H1') === 'invisible', mode('H1'));
wb.setPeople(PEOPLE);
wb.setWho({ who: 'budi' });
wb.setAccess(ROWS);
check('B2: edit for budi (his own row)', mode('B2') === 'edit', mode('B2'));

// a person's change is refused where they may not write; the code of the app is not stopped
wb.setPeople(PEOPLE);
wb.setWho({ who: 'rina' });
wb.setAccess(ROWS);
const s = wb.sheet('Stok');
s.setValues('C2', 12, { source: 'user' });
s.setValues('A2', 'X', { source: 'user' });
check('rina writes Qty, not the code', s.value('C2') === 12 && s.value('A2') === 'S1', [s.value('C2'), s.value('A2')]);

// the server: the same rows
const doc = stok().toJSON();
const seen = viewFor(doc, { access: ROWS, who: 'rina', people: PEOPLE });
const json = JSON.stringify(seen);
check('viewFor does not send the hidden Modal (42000)', !json.includes('42000') && json.includes('Semen'));
const other = createWorkbook(doc);
other.setPeople(PEOPLE);
other.setWho({ who: 'budi' });
other.setAccess(ROWS);
other.sheet('Stok').setValues('B2', 'Semen Gresik', { source: 'user' });
const patch = other.pendingPatch();
check('checkPatch lets budi change Barang', checkPatch(doc, patch, { access: ROWS, who: 'budi', people: PEOPLE }).ok);
check('checkPatch refuses the same change from rina', !checkPatch(doc, patch, { access: ROWS, who: 'rina', people: PEOPLE }).ok);

// the owner: a deny for a role or for everyone does not take it away, a deny for the owner's own user does
const OWNED = [{ who: 'user:yeka', effect: 'allow', action: '*' }, { who: '*', effect: 'deny', action: 'edit', where: 'Stok!F:F' }, { who: 'group:kasir', effect: 'deny', action: 'ui.toolbar' }];
check('yeka (also a kasir) stays the owner despite denies for everyone and for kasir', resolveAccess(OWNED, { user: 'yeka', roles: ['kasir'] }).owner === true);
check('a deny for yeka herself ends it', resolveAccess([...OWNED, { who: 'user:yeka', effect: 'deny', action: 'download' }], 'yeka').owner === false);

// a deny of edit only caps: alone, it gives nothing to read
const capped = stok();
capped.setWho({ who: 'tamu' });
capped.setAccess([{ who: '*', effect: 'deny', action: 'edit', where: 'Stok!F:F' }]);
check('deny edit with no allow: the cell stays unseen (not read only)', capped.modeAt('Stok', 1, 5).mode === 'invisible', capped.modeAt('Stok', 1, 5));
capped.setAccess([{ who: '*', effect: 'allow', action: 'edit' }, { who: '*', effect: 'deny', action: 'edit', where: 'Stok!F:F' }]);
check('deny edit over an allow edit of the same level: read only', capped.modeAt('Stok', 1, 5).mode === 'readonly', capped.modeAt('Stok', 1, 5));
capped.setAccess([{ who: 'user:tamu', effect: 'allow', action: 'edit' }, { who: '*', effect: 'deny', action: 'edit', where: 'Stok!F:F' }]);
check('a user\'s own allow edit beats a deny of edit for everyone', capped.modeAt('Stok', 1, 5) === null, capped.modeAt('Stok', 1, 5));

// every way of writing a range, and one that cannot be read touches nothing (never the whole sheet)
const shapes = stok();
shapes.setWho({ who: 'x' });
const at = (where, a) => { shapes.setAccess([{ who: '*', effect: 'allow', action: 'edit' }, { who: '*', effect: 'deny', action: 'read', where }]); const m = shapes.modeAt('Stok', ...cellOf(a)); return m ? m.mode : 'edit'; };
check('one cell "C2": C2 hidden, C3 not', at('Stok!C2', 'C2') === 'hidden' && at('Stok!C2', 'C3') === 'edit');
check('with $: "$C$2"', at('Stok!$C$2', 'C2') === 'hidden');
check('whole columns "C:D": C3 and D3 hidden, E3 not', at('Stok!C:D', 'C3') === 'hidden' && at('Stok!C:D', 'D3') === 'hidden' && at('Stok!C:D', 'E3') === 'edit');
check('whole rows "2:3": A2 hidden, A4 not', at('Stok!2:3', 'A2') === 'hidden' && at('Stok!2:3', 'A4') === 'edit');
check('rows without a sheet are a range, not a sheet named "2:3"', parseWhere('2:3').range === '2:3' && parseWhere('2:3').sheet === null);
check('a range that cannot be read touches no cell', at('Stok!C2:', 'A1') === 'edit' && at('Stok!C2:', 'C2') === 'edit');
check('and the validator says so', validateAccess([{ who: '*', effect: 'deny', action: 'read', where: 'Stok!C2:' }]).length === 1);

// the validator
check('right rows: no problems', validateAccess(ROWS).length === 0, validateAccess(ROWS));
const bad = validateAccess([{ who: '', effect: 'maybe', action: 'format.blod', where: 'Stok!A1:ZZZZ9' }]);
check('wrong who, effect, action and range are all said', bad.length === 4, bad);

// A refusal tells the message of the row that refused that action, not the first deny row that has a message.
const told = resolveAccess([
    { who: '*', effect: 'allow', action: '*' },
    { who: 'user:4', effect: 'deny', action: 'format', message: 'Formatting is locked' },
    { who: 'user:4', effect: 'deny', action: 'sheets.add', message: 'No new sheets' }
], '4');
// A who without a prefix is a user: "empat" and "user:empat" name the same person, and so do who: 'empat' and who: 'user:empat'.
{
    const rows = [
        { who: 'satu', effect: 'allow', action: '*' },
        { who: 'dua', effect: 'deny', action: 'ui.menubar', message: 'No menu bar' },
        { who: 'empat', effect: 'deny', action: 'sheets.add', message: 'No new sheets' }
    ];
    check('a bare who is a user', resolveAccess(rows, 'satu').can('sheets.add') && resolveAccess(rows, { user: 'satu' }).owner, resolveAccess(rows, 'satu'));
    check('"user:empat" as the person is empat too', resolveAccess(rows, 'user:empat').refusalFor('sheets.add') === 'No new sheets');
    check('a bare who is no mistake', validateAccess(rows).length === 0, validateAccess(rows));
    // dua's only message is about the menu bar: it is not told when dua is refused something else
    check('a deny row of one action does not speak for other refusals', resolveAccess(rows, 'dua').refusalFor('sheets.add') === 'You cannot change sheets here',
        resolveAccess(rows, 'dua').refusalFor('sheets.add'));
    check('a deny row of everything speaks for every refusal',
        resolveAccess([{ who: 'lima', effect: 'deny', action: '*', message: 'Read only for you' }], 'lima').refusalFor('sort') === 'Read only for you');
}

check('a refused action tells its own row\'s message', told.refusalFor('sheets.add') === 'No new sheets' && told.refusalFor('format.bold') === 'Formatting is locked',
    [told.refusalFor('sheets.add'), told.refusalFor('format.bold')]);
check('an action refused by no deny row keeps the sheet\'s own words', resolveAccess([{ who: 'user:4', effect: 'allow', action: 'read' }], '4').refusalFor('sort') === 'You cannot sort here');

// A pivot never tells a person what its hidden data holds: not on their screen, not in what the server sends them, and what they save does not
// overwrite the stored full table with their own smaller one.
{
    const sales = () => {
        const wb = createWorkbook();
        wb.sheet('Sheet1').setSheetProps({ name: 'Sales' });
        wb.setValues('Sales', 'A1', [['Rep', 'Region', 'Revenue', 'Margin'], ['Rudi', 'West', 12, 24], ['Tomi', 'East', 15, 22]]);
        const sum = wb.sheet(wb.addSheet('Summary'));
        sum.addPivot('A1', 'Sales!A1:D3', { rows: ['Region'], values: [{ field: 'Revenue', as: 'Revenue' }, { field: 'Margin', as: 'Margin' }] });
        return wb;
    };
    const rules = [
        { who: '*', effect: 'allow', action: 'read' },
        { who: 'group:rep', effect: 'allow', action: 'edit', where: 'Sales!C2:C100' },
        { who: 'group:rep', effect: 'deny', action: 'read', where: 'Sales!D1:D100' }
    ];
    const rep = 'rudi';
    const REPS = { users: [{ id: 'rudi', name: 'Rudi' }], groups: { rep: ['rudi'] } };
    const margins = (wb) => [1, 2, 3].map((r) => wb.value('Summary', r, 2));

    const onScreen = sales();
    onScreen.setPeople(REPS);
    onScreen.setWho({ who: rep });
    onScreen.setAccess(rules);
    check('a pivot is worked out again for the person the access is set for', margins(onScreen).every((v) => v === 0), margins(onScreen));

    const stored = sales().toJSON();
    const sent = createWorkbook(viewFor(stored, { access: rules, who: rep, people: REPS }));
    check('the server does not send the margins a pivot holds', margins(sent).every((v) => v === null || v === 0), margins(sent));

    sent.setPeople(REPS);
    sent.setWho({ who: rep });
    sent.setAccess(rules);
    sent.setValues('Sales', 'C2', 20, { source: 'user' });
    const after = createWorkbook(mergePatch(stored, sent.pendingPatch(), { access: rules, who: rep, people: REPS }));
    check('a save by that person keeps the full pivot, worked out again with their change',
        after.value('Summary', 1, 1) === 15 && after.value('Summary', 2, 1) === 20 && margins(after).join() === '22,24,46',
        [after.value('Summary', 1, 1), after.value('Summary', 2, 1), margins(after)]);
}

// ---- the three saves of the File menu: one by one, the group "file" or "file.*", a viewer who may save nothing ---------------------------------------
{
    const base = [{ who: '*', effect: 'allow', action: '*' }];
    const viewer = resolveAccess(base.concat([{ who: 'group:viewer', effect: 'deny', action: 'file.*', message: 'You can only view' }]), { user: 'v', roles: ['viewer'] });
    check('file.*: a viewer may save in none of the three ways',
        ['file.save', 'file.saveAsNewVersion', 'file.saveAsACopy'].every((a) => !viewer.can(a)) && viewer.can('download'));
    check('file.*: the refusal carries the message of its row', viewer.refusalFor('file.save') === 'You can only view', viewer.refusalFor('file.save'));
    const group = resolveAccess(base.concat([{ who: '*', effect: 'deny', action: 'file' }]), 'x');
    check('"file" names the three too', !group.can('file.save') && !group.can('file.saveAsACopy'));
    const spv = resolveAccess(base.concat([{ who: 'group:spv', effect: 'deny', action: 'file.save' }]), { user: 's', roles: ['spv'] });
    check('one by one: a supervisor may not overwrite, but may save a new version or a copy',
        !spv.can('file.save') && spv.can('file.saveAsNewVersion') && spv.can('file.saveAsACopy'));
    check('validateAccess knows the three, "file" and "file.*"',
        validateAccess(['file.save', 'file.saveAsNewVersion', 'file.saveAsACopy', 'file', 'file.*'].map((action) => ({ who: '*', effect: 'deny', action }))).length === 0);
    check('validateAccess still says an unknown one', validateAccess([{ who: '*', effect: 'deny', action: 'file.saveAll' }]).length === 1);
}

console.log(failures ? failures + ' FAILED' : 'ALL OK');
process.exit(failures ? 1 : 0);
