// Access control without a screen: a policy of roles (owner, estimator, site, viewer) given for a person; what each may do (per action: bold yes,
// italic no; insert rows; sort without editing), where (an 'edit' range open to a role that only looks; read-only, hidden and invisible ranges, with a
// condition), what they see (ui), groups and several roles together, the host's own code never stopped, the policy taken away.
//   node test/policy.test.js
import assert from 'node:assert';
import { createWorkbook } from '../src/core/index.js';
import { sortRange } from '../src/core/search.js';
import { resolveAccess } from '../src/core/policy.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };
const user = { source: 'user' };

const POLICY = {
    owners: ['user:yeka'],
    members: { 'user:rina': 'estimator', 'group:mandor': 'site', 'user:dodi': ['site', 'auditor'] },
    default: 'viewer',
    roles: {
        estimator: { can: ['edit', 'format', 'rows', 'sort', 'filter', 'copy', 'download'], ranges: [{ sheet: 'BOQ', columns: ['Rate'], mode: 'readonly', message: 'Rates are set by the owner' }] },
        site: {
            can: ['format.bold', 'copy'], ui: { menubar: false, toolbar: false, area: 'A1:E20' },
            ranges: [{ sheet: 'BOQ', range: 'D2:D20', mode: 'edit' }, { sheet: 'BOQ', columns: ['Cost'], mode: 'invisible' }, { sheet: 'BOQ', range: 'A2:F20', when: '=$E2="Approved"', mode: 'readonly', message: 'An approved line is locked' }]
        },
        auditor: { can: ['download'], ui: { toolbar: true } },
        viewer: { can: ['copy'], ranges: [{ sheet: 'BOQ', columns: ['Cost'], mode: 'hidden' }] }
    }
};

function boq() {
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setSheetProps(s, { name: 'BOQ' });
    wb.setValues(s, 0, 0, [['Item', 'Rate', 'Qty', 'Done', 'Status', 'Cost'], ['Pile', 500, 10, 2, 'Draft', 400], ['Beam', 900, 4, 1, 'Approved', 700], ['Slab', 1200, 2, 0, 'Draft', 1000]]);
    return { wb, s };
}
const refusals = (wb) => { const out = []; wb.on('reject', (e) => out.push(e.reason)); return out; };

{
    const { wb, s } = boq();
    wb.setValues(s, 1, 2, 11, user);
    wb.setStyle(s, { r1: 0, c1: 0, r2: 0, c2: 0 }, { italic: true }, user);
    assert.deepStrictEqual([wb.value(s, 1, 2), wb.access().owner, wb.can('access')], [11, true, true], 'no policy: everything is allowed');
    ok('a workbook without a policy: everything is allowed');
}

{
    // a viewer (anyone not listed): looks, copies, sees the cost as •••
    const { wb, s } = boq();
    const said = refusals(wb);
    wb.setAccess(POLICY, 'user:someone');
    assert.deepStrictEqual(wb.access().roles, ['viewer']);
    wb.setValues(s, 1, 2, 99, user);
    assert.deepStrictEqual([wb.value(s, 1, 2), said[0]], [10, 'You can only view this sheet'], 'a viewer cannot write a cell');
    wb.setStyle(s, { r1: 1, c1: 0, r2: 1, c2: 0 }, { bold: true }, user);
    assert.ok(/cannot change the formatting/.test(said[1]), said[1]);
    wb.insertRows(s, 2, 1, user);
    assert.strictEqual(wb.size(s).rows, 1000, 'nor insert a row');
    assert.deepStrictEqual([wb.can('copy'), wb.can('download')], [true, false]);
    assert.deepStrictEqual([wb.display(s, 1, 5).text, wb.input(s, 1, 5)], ['•••', ''], 'the cost is hidden');
    wb.setValues(s, 1, 2, 12);
    assert.strictEqual(wb.value(s, 1, 2), 12, 'the host\'s own code is not stopped');
    ok('a viewer: reads, copies, cannot write, format or insert; a hidden column shows •••; the host\'s code still writes');
}

{
    // the estimator: edits and formats, not the rates; sorts
    const { wb, s } = boq();
    const said = refusals(wb);
    wb.setAccess(POLICY, { user: 'rina' });
    wb.setValues(s, 1, 2, 20, user);
    wb.setValues(s, 1, 1, 1, user);
    assert.deepStrictEqual([wb.value(s, 1, 2), wb.value(s, 1, 1), said[0]], [20, 500, 'Rates are set by the owner'], 'edits, but not the rates');
    wb.setStyle(s, { r1: 1, c1: 0, r2: 1, c2: 0 }, { italic: true, fill: '#ff0' }, user);
    assert.deepStrictEqual(wb.style(s, 1, 0), { italic: true, fill: '#ff0' }, 'every format');
    wb.insertRows(s, 4, 2, user);
    assert.strictEqual(wb.size(s).rows, 1002, 'inserts rows');
    wb.setSheetProps(s, { name: 'Renamed' }, user);
    assert.deepStrictEqual([wb.sheetProps(s).name, said[1]], ['BOQ', 'You cannot change sheets here'], 'but not rename a sheet (no "sheets")');
    ok('an estimator: edits and formats everywhere but the rates, inserts rows, may not rename sheets');
}

{
    // a mandor (group): writes the Done column only, bold yes, italic no, the cost is invisible, an approved line is locked
    const { wb, s } = boq();
    const said = refusals(wb);
    wb.setAccess(POLICY, { user: 'budi', groups: ['mandor'] });
    assert.deepStrictEqual(wb.access().roles, ['site']);
    wb.setValues(s, 1, 3, 5, user);
    wb.setValues(s, 1, 2, 5, user);
    assert.deepStrictEqual([wb.value(s, 1, 3), wb.value(s, 1, 2), said[0]], [5, 10, 'You can only view this sheet'], 'writes in the edit range only');
    wb.setValues(s, 2, 3, 9, user);
    assert.deepStrictEqual([wb.value(s, 2, 3), said[1]], [1, 'An approved line is locked'], 'an approved line is locked, even in the edit range (readonly is stronger)');
    wb.setStyle(s, { r1: 1, c1: 3, r2: 1, c2: 3 }, { bold: true }, user);
    wb.setStyle(s, { r1: 1, c1: 3, r2: 1, c2: 3 }, { italic: true }, user);
    assert.deepStrictEqual([wb.style(s, 1, 3), said[2]], [{ bold: true }, 'You cannot change the formatting here'], 'bold yes, italic no');
    wb.setStyle(s, { r1: 1, c1: 0, r2: 1, c2: 0 }, { bold: true }, user);
    assert.ok(!wb.style(s, 1, 0), 'and bold only where it may write');
    assert.deepStrictEqual([wb.display(s, 1, 5).text, wb.display(s, 1, 5).kind, wb.input(s, 1, 5)], ['', 'empty', ''], 'the cost is invisible: an empty cell');
    assert.deepStrictEqual(wb.access().ui, { menubar: false, toolbar: false, formulaBar: true, headers: true, gridlines: true, tabs: true, area: 'A1:E20' }, 'what it sees');
    ok('a mandor by group: writes its edit range only, an approved line stays locked, bold but not italic, the cost invisible, no menus');
}

{
    // two roles: what either may do, what either sees
    const a = resolveAccess(POLICY, 'user:dodi');
    assert.deepStrictEqual([a.roles, a.can('download'), a.can('format.bold'), a.can('format.italic'), a.ui.toolbar, a.ui.menubar, a.ui.area], [['site', 'auditor'], true, true, false, true, true, null], 'the actions and the parts of either role (the auditor does not hide the menu bar); an area only when every role has one');
    const owner = resolveAccess(POLICY, 'user:yeka');
    assert.deepStrictEqual([owner.owner, owner.can('access'), owner.can('sheets.delete')], [true, true, true]);
    assert.strictEqual(resolveAccess(POLICY, 'user:rina').can('access'), false, 'only an owner (or a role given it) changes the policy');
    ok('several roles together, an owner, who may change the policy');
}

{
    // sort without edit; the policy taken away
    const { wb, s } = boq();
    const said = refusals(wb);
    wb.setAccess({ default: 'sorter', roles: { sorter: { can: ['sort'] } } }, 'user:x');
    sortRange(wb, s, { r1: 1, c1: 0, r2: 3, c2: 5 }, 0, 'desc');
    assert.deepStrictEqual([wb.value(s, 1, 0), wb.value(s, 3, 0), said.length], ['Slab', 'Beam', 0], 'a role that may sort sorts, without editing');
    wb.setValues(s, 1, 2, 1, user);
    assert.strictEqual(said[0], 'You can only view this sheet');
    wb.setAccess(null);
    wb.setValues(s, 1, 2, 1, user);
    assert.strictEqual(wb.value(s, 1, 2), 1, 'no policy any more: everything');
    ok('a role that may sort but not edit sorts; the policy taken away');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
