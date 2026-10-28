// Access control as rows of a table (policy.js): who / effect / action / where / when / message. The most specific row wins (user > role > everyone),
// deny wins within a level, and what nobody allows is not given. The same rows decide in the browser (setAccess) and on the server (viewFor, checkPatch).
//   node test/policy.test.js
import { createWorkbook, resolveAccess, validateAccess, parseWhere, viewFor, checkPatch } from '../src/core/index.js';

let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

const ROWS = [
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Stok!A1:F10' },
    { who: 'role:kasir', effect: 'allow', action: 'edit', where: 'Stok!C2:C10' },
    { who: 'role:kasir', effect: 'allow', action: 'edit', where: 'Stok!D2:D10', when: '=$E2<>"Approved"', message: 'Already approved' },
    { who: 'role:kasir', effect: 'deny', action: 'read', where: 'Stok!F2:F10' },
    { who: 'role:kasir', effect: 'allow', action: 'format' },
    { who: 'role:kasir', effect: 'deny', action: 'format.bold' },
    { who: 'role:kasir', effect: 'deny', action: 'ui.toolbar' },
    { who: 'role:kasir', effect: 'allow', action: 'sort' },
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
wb.setAccess(ROWS, { user: 'rina', roles: ['kasir'] });
const mode = (a) => { const m = wb.modeAt('Stok', ...cellOf(a)); return m ? m.mode : 'edit'; };
function cellOf(a) { const c = a.charCodeAt(0) - 65, r = Number(a.slice(1)) - 1; return [r, c]; }
check('A2: read', mode('A2') === 'readonly', mode('A2'));
check('C2: edit', mode('C2') === 'edit', mode('C2'));
check('D2: edit while the row is Open', mode('D2') === 'edit', mode('D2'));
check('D3: read once the row is Approved (when)', mode('D3') === 'readonly', mode('D3'));
check('F2: deny read shows •••', mode('F2') === 'hidden', mode('F2'));
check('B2: read for rina', mode('B2') === 'readonly', mode('B2'));
check('H1: nobody allows it, it is empty', mode('H1') === 'invisible', mode('H1'));
wb.setAccess(ROWS, { user: 'budi', roles: ['kasir'] });
check('B2: edit for budi (his own row)', mode('B2') === 'edit', mode('B2'));

// a person's change is refused where they may not write; the code of the app is not stopped
wb.setAccess(ROWS, { user: 'rina', roles: ['kasir'] });
const s = wb.sheet('Stok');
s.setValues('C2', 12, { source: 'user' });
s.setValues('A2', 'X', { source: 'user' });
check('rina writes Qty, not the code', s.value('C2') === 12 && s.value('A2') === 'S1', [s.value('C2'), s.value('A2')]);

// the server: the same rows
const doc = stok().toJSON();
const seen = viewFor(doc, { access: ROWS, who: { user: 'rina', roles: ['kasir'] } });
const json = JSON.stringify(seen);
check('viewFor does not send the hidden Modal (42000)', !json.includes('42000') && json.includes('Semen'));
const other = createWorkbook(doc);
other.setAccess(ROWS, { user: 'budi', roles: ['kasir'] });
other.sheet('Stok').setValues('B2', 'Semen Gresik', { source: 'user' });
const patch = other.pendingPatch();
check('checkPatch lets budi change Barang', checkPatch(doc, patch, { access: ROWS, who: { user: 'budi', roles: ['kasir'] } }).ok);
check('checkPatch refuses the same change from rina', !checkPatch(doc, patch, { access: ROWS, who: { user: 'rina', roles: ['kasir'] } }).ok);

// the owner: a deny for a role or for everyone does not take it away, a deny for the owner's own user does
const OWNED = [{ who: 'user:yeka', effect: 'allow', action: '*' }, { who: '*', effect: 'deny', action: 'edit', where: 'Stok!F:F' }, { who: 'role:kasir', effect: 'deny', action: 'ui.toolbar' }];
check('yeka (also a kasir) stays the owner despite denies for everyone and for kasir', resolveAccess(OWNED, { user: 'yeka', roles: ['kasir'] }).owner === true);
check('a deny for yeka herself ends it', resolveAccess([...OWNED, { who: 'user:yeka', effect: 'deny', action: 'download' }], 'yeka').owner === false);

// a deny of edit only caps: alone, it gives nothing to read
const capped = stok();
capped.setAccess([{ who: '*', effect: 'deny', action: 'edit', where: 'Stok!F:F' }], 'tamu');
check('deny edit with no allow: the cell stays unseen (not read only)', capped.modeAt('Stok', 1, 5).mode === 'invisible', capped.modeAt('Stok', 1, 5));
capped.setAccess([{ who: '*', effect: 'allow', action: 'edit' }, { who: '*', effect: 'deny', action: 'edit', where: 'Stok!F:F' }], 'tamu');
check('deny edit over an allow edit of the same level: read only', capped.modeAt('Stok', 1, 5).mode === 'readonly', capped.modeAt('Stok', 1, 5));
capped.setAccess([{ who: 'user:tamu', effect: 'allow', action: 'edit' }, { who: '*', effect: 'deny', action: 'edit', where: 'Stok!F:F' }], 'tamu');
check('a user\'s own allow edit beats a deny of edit for everyone', capped.modeAt('Stok', 1, 5) === null, capped.modeAt('Stok', 1, 5));

// the validator
check('right rows: no problems', validateAccess(ROWS).length === 0, validateAccess(ROWS));
const bad = validateAccess([{ who: 'kasir', effect: 'maybe', action: 'format.blod', where: 'Stok!A1:ZZZZ9' }]);
check('wrong who, effect, action and range are all said', bad.length === 4, bad);

console.log(failures ? failures + ' FAILED' : 'ALL OK');
process.exit(failures ? 1 : 0);
