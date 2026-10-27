// Access control: who may do what in a workbook, as one plain object the host keeps in its database (per workbook) and gives to the sheet for the
// person who opens it. The same object, and the same code, decide on the server (viewFor, checkPatch): the browser is never trusted with what a person
// may not see or do. Pure (no DOM).
//
//   {
//     owners: ['user:yeka'],                         may do everything, the policy itself too ('access')
//     members: { 'user:budi': 'estimator',           a person's role (or roles); a group's roles count for everyone in it
//                'group:mandor': ['site'] },
//     default: 'viewer',                             the role of anyone not listed (none: the built-in one, which may only look)
//     message: 'Only the estimator changes this',    what a person is told when something is not theirs to do (else a plain sentence)
//     roles: {
//       estimator: {
//         can: ['edit', 'format', 'rows', 'sort', 'filter', 'copy', 'download'],     what the role may do (see ACTIONS; 'format' is every format.*)
//         ui: { menubar: true, toolbar: true, formulaBar: true, headers: true, gridlines: true, tabs: true, area: 'A1:H500' },   what it sees
//         ranges: [                                    places with their own rule (as setRules takes them, and a sheet):
//           { sheet: 'BOQ', columns: ['Rate'], mode: 'readonly', message: 'Rates are set by the owner' },
//           { sheet: 'BOQ', range: 'A2:H500', when: '=$G2="Approved"', mode: 'readonly' },
//           { sheet: 'Cost', columns: ['Margin'], mode: 'invisible' }
//         ]
//       },
//       site: { can: ['format.bold'], ui: { menubar: false, toolbar: false }, ranges: [{ sheet: 'Opname', range: 'D2:D500', mode: 'edit' }] }
//     }
//   }
//
// Range modes, from weak to strong (where two rules meet, the stronger wins):
//   edit       may be changed, even by a role that may not edit elsewhere (the whitelist of a role that only looks)
//   readonly   may be read, not changed
//   hidden     shows as ••• (its content is not sent to the person: see viewFor)
//   invisible  shows as an empty cell (nothing tells it holds anything)
// A role that may not 'edit' may change only its 'edit' ranges: anyone not given more only looks (the default is a whitelist).

/** Every action a role can be given. A group ('format', 'rows', 'cols', 'sheets', 'view') gives every action under it; '*' gives everything. */
export const ACTIONS = [
    'edit',
    'format.bold', 'format.italic', 'format.underline', 'format.strike', 'format.color', 'format.fill', 'format.borders', 'format.align', 'format.wrap',
    'format.rotate', 'format.size', 'format.font', 'format.number', 'format.link', 'format.merge', 'format.conditional', 'format.clear',
    'rows.insert', 'rows.delete', 'rows.resize', 'rows.hide', 'rows.group',
    'cols.insert', 'cols.delete', 'cols.resize', 'cols.hide', 'cols.group',
    'sheets.add', 'sheets.delete', 'sheets.rename', 'sheets.move', 'sheets.hide',
    'view.freeze', 'view.gridlines',
    'sort', 'filter', 'validation', 'names', 'settings',
    'copy', 'paste', 'download', 'import',
    'comment.read', 'comment.create', 'comment.reply', 'comment.resolve', 'comment.edit', 'comment.delete', 'comment.moderate',
    'access'
];

const UI_PARTS = ['menubar', 'toolbar', 'formulaBar', 'headers', 'gridlines', 'tabs'];
const RANK = { edit: 1, readonly: 2, hidden: 3, invisible: 4 };
export const strongerMode = (a, b) => (!a ? b : !b ? a : RANK[b.mode] > RANK[a.mode] ? b : a);

/** "user:budi" / { user: 'budi', groups: ['site'] } made into the keys it is listed by in members: ['user:budi', 'group:site']. */
function keysOf(who) {
    if (!who) return [];
    if (typeof who === 'string') return [who.includes(':') ? who : 'user:' + who];
    return [].concat(who.user ? ['user:' + who.user] : [], (who.groups || []).map((g) => 'group:' + g));
}

/**
 * What a policy gives a person: { owner, roles, can(action), ui, ranges, message }. No policy: everything (a sheet without access control).
 * @param {object|null} policy
 * @param {string|{ user?: string, groups?: string[] }} who
 */
export function resolveAccess(policy, who) {
    if (!policy) return { owner: true, roles: [], can: () => true, ui: allShown(), ranges: [], message: null };
    const keys = keysOf(who);
    const owner = keys.some((k) => (policy.owners || []).includes(k));
    const named = new Set();
    for (const k of keys) for (const r of [].concat((policy.members || {})[k] || [])) named.add(r);
    if (!named.size && policy.default) named.add(policy.default);
    const roles = [...named].filter((r) => policy.roles && policy.roles[r]).map((r) => ({ name: r, ...policy.roles[r] }));
    const message = policy.message || null;
    if (owner) return { owner: true, roles: roles.map((r) => r.name), can: () => true, ui: allShown(), ranges: [], message };
    // what the roles give together: an action any of them may do, a part of the screen any of them sees
    const granted = new Set();
    for (const r of roles) for (const a of r.can || []) granted.add(a);
    const can = (action) => {
        if (action === 'access') return granted.has('*') || granted.has('access');
        if (granted.has('*') || granted.has(action)) return true;
        const group = action.split('.')[0];
        return group !== action && granted.has(group);
    };
    const ui = allShown();
    if (roles.length) for (const part of UI_PARTS) ui[part] = roles.some((r) => !r.ui || r.ui[part] !== false);
    // a view limited to an area only when every role limits it (the first one's area is taken)
    ui.area = roles.length && roles.every((r) => r.ui && r.ui.area) ? roles[0].ui.area : null;
    const ranges = [];
    for (const r of roles) for (const g of r.ranges || []) ranges.push({ ...g, mode: RANK[g.mode] ? g.mode : 'readonly' });
    return { owner: false, roles: roles.map((r) => r.name), can, ui, ranges, message };
}

const allShown = () => ({ menubar: true, toolbar: true, formulaBar: true, headers: true, gridlines: true, tabs: true, area: null });

// ---- what a change asks to do ----------------------------------------------------------------------------------------------------------------------

const STYLE_ACTION = { bold: 'format.bold', italic: 'format.italic', underline: 'format.underline', strike: 'format.strike', color: 'format.color', fill: 'format.fill',
    borders: 'format.borders', align: 'format.align', valign: 'format.align', wrap: 'format.wrap', rotate: 'format.rotate', fontSize: 'format.size', font: 'format.font',
    format: 'format.number', link: 'format.link' };
const ROW_ACTION = { height: 'rows.resize', hidden: 'rows.hide', level: 'rows.group', fold: 'rows.group' };
const COL_ACTION = { width: 'cols.resize', hidden: 'cols.hide', level: 'cols.group', fold: 'cols.group', format: 'format.number' };
const SHEET_ACTION = { name: 'sheets.rename', hidden: 'sheets.hide', freezeRows: 'view.freeze', freezeCols: 'view.freeze', hideGridlines: 'view.gridlines', filter: 'filter',
    conditionals: 'format.conditional', validations: 'validation', merges: 'format.merge', colWidth: 'cols.resize', rowHeight: 'rows.resize' };
const OP_ACTION = { insertRows: 'rows.insert', deleteRows: 'rows.delete', insertCols: 'cols.insert', deleteCols: 'cols.delete', moveRows: 'sort', moveCols: 'cols.insert',
    addSheet: 'sheets.add', removeSheet: 'sheets.delete', moveSheet: 'sheets.move' };

// the keys whose value is not the same in two objects
const changedKeys = (a, b) => { const out = new Set(); for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) if (JSON.stringify((a || {})[k]) !== JSON.stringify((b || {})[k])) out.add(k); return out; };

/**
 * What a change to the comments of a sheet asks for: a new thread is comment.create, a new item in a thread comment.reply, a thread resolved or opened
 * comment.resolve; a comment changed or taken away is comment.edit / comment.delete when it is the person's own (`me`, their id), comment.moderate when
 * it is someone else's.
 */
export function commentActions(before, after, me) {
    const out = new Set();
    const was = new Map((before || []).map((t) => [t.id, t])), now = new Map((after || []).map((t) => [t.id, t]));
    const own = (item) => me !== null && me !== undefined && item.by && item.by.id === me;
    for (const [id, t] of now) {
        const old = was.get(id);
        if (!old) { out.add('comment.create'); continue; }
        if (!!old.resolved !== !!t.resolved) out.add('comment.resolve');
        const oldItems = new Map(old.items.map((i) => [i.id, i]));
        for (const item of t.items) {
            const o = oldItems.get(item.id);
            if (!o) out.add('comment.reply');
            else if (o.text !== item.text) out.add(own(o) ? 'comment.edit' : 'comment.moderate');
        }
        const kept = new Set(t.items.map((i) => i.id));
        for (const o of old.items) if (!kept.has(o.id)) out.add(own(o) ? 'comment.delete' : 'comment.moderate');
    }
    // a thread taken away whole: its first comment was deleted (the person's own, or moderated)
    for (const [id, t] of was) if (!now.has(id)) out.add(t.items.every(own) ? 'comment.delete' : 'comment.moderate');
    return out;
}

/** The actions a change (an op) asks for. A cell written is 'edit' (whether it may be written there is the ranges' to say, not this). `me` is the id of
 * the person (for their own comments). */
export function actionsOfOp(op, me) {
    const out = new Set();
    switch (op.t) {
        case 'cells': out.add('edit'); break;
        case 'styles':
            for (const ch of op.changes) for (const k of changedKeys(ch.before, ch.after)) out.add(STYLE_ACTION[k] || 'format');
            // a style taken away whole is Clear formatting
            if (op.changes.some((ch) => ch.before && Object.keys(ch.before).length && (!ch.after || !Object.keys(ch.after).length))) out.add('format.clear');
            break;
        case 'rowProps': for (const ch of op.changes) for (const k of changedKeys(ch.before, ch.after)) out.add(ROW_ACTION[k] || 'rows.resize'); break;
        case 'colProps': for (const ch of op.changes) for (const k of changedKeys(ch.before, ch.after)) out.add(COL_ACTION[k] || 'cols.resize'); break;
        case 'sheetProps':
            for (const k of changedKeys(op.before, op.after)) {
                if (k === 'comments') for (const a of commentActions((op.before || {}).comments, (op.after || {}).comments, me)) out.add(a);
                else out.add(SHEET_ACTION[k] || 'settings');
            }
            break;
        case 'settings': for (const k of changedKeys(op.before, op.after)) out.add(k === 'names' ? 'names' : 'settings'); break;
        default: if (OP_ACTION[op.t]) out.add(OP_ACTION[op.t]);
    }
    return out;
}

// what a person is told, by the action that was refused
const SAY = { edit: 'change cells', sort: 'sort', filter: 'change the filter', names: 'change named ranges', validation: 'change data validation', settings: 'change the settings',
    copy: 'copy from this sheet', paste: 'paste here', 'comment.read': 'see the comments', 'comment.create': 'comment', 'comment.reply': 'reply to comments',
    'comment.resolve': 'resolve comments', 'comment.edit': 'change comments', 'comment.delete': 'delete comments', 'comment.moderate': 'change the comments of others', download: 'download this workbook', import: 'import files here', access: 'change who may do what' };
/** A sentence for an action a person may not do ("You cannot change cells here"). */
export function refusalOf(action, message) {
    if (message) return message;
    const what = SAY[action] || (action.startsWith('format') ? 'change the formatting' : action.startsWith('rows') ? 'change rows' : action.startsWith('cols') ? 'change columns'
        : action.startsWith('sheets') ? 'change sheets' : action.startsWith('view') ? 'change the view' : action);
    return 'You cannot ' + what + ' here';
}
