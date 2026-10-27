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
//       site: { can: ['format.bold'], ui: { menubar: false, toolbar: false }, ranges: [{ sheet: 'Opname', range: 'D2:D500', mode: 'edit' }] },
//       client: { can: ['comment.read'], ui: { disallowed: 'hide', hide: ['menu.Insert', 'tool.paint', 'feature.contextMenu'], sheets: ['Summary'],
//                 area: { Summary: 'A1:F40' } } }   every part of the screen by its id (UI_ITEMS), what may not be done hidden, only some sheets
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
    // a view limited to an area only when every role limits it (the first one's area is taken): one range, or one per sheet ({ BOQ: 'A1:H200' })
    ui.area = roles.length && roles.every((r) => r.ui && r.ui.area) ? roles[0].ui.area : null;
    // a part of the screen is hidden when every role hides it; what is not allowed is hidden (not greyed) when every role says so
    ui.hide = roles.length ? (roles[0].ui && roles[0].ui.hide ? roles[0].ui.hide : []).filter((id) => roles.every((r) => r.ui && (r.ui.hide || []).includes(id))) : [];
    ui.disallowed = roles.length && roles.every((r) => r.ui && r.ui.disallowed === 'hide') ? 'hide' : 'grey';
    // the sheets it sees: those any role lists (a role that lists none sees every sheet)
    ui.sheets = roles.length && roles.every((r) => r.ui && Array.isArray(r.ui.sheets)) ? [...new Set(roles.flatMap((r) => r.ui.sheets))] : null;
    const ranges = [];
    for (const r of roles) for (const g of r.ranges || []) ranges.push({ ...g, mode: RANK[g.mode] ? g.mode : 'readonly' });
    return { owner: false, roles: roles.map((r) => r.name), can, ui, ranges, message };
}

const allShown = () => ({ menubar: true, toolbar: true, formulaBar: true, headers: true, gridlines: true, tabs: true, area: null, hide: [], disallowed: 'grey', sheets: null });

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

// ---- the catalogs a host builds its own editor of policies with --------------------------------------------------------------------------------------

/** Every action, with a label and its group, for an editor of policies (the order is the one an editor shows). */
export const ACTION_INFO = [
    ['edit', 'Edit cells', 'Cells'],
    ['format.bold', 'Bold', 'Format'], ['format.italic', 'Italic', 'Format'], ['format.underline', 'Underline', 'Format'], ['format.strike', 'Strikethrough', 'Format'],
    ['format.color', 'Text color', 'Format'], ['format.fill', 'Fill color', 'Format'], ['format.borders', 'Borders', 'Format'], ['format.align', 'Alignment', 'Format'],
    ['format.wrap', 'Wrapping', 'Format'], ['format.rotate', 'Rotation', 'Format'], ['format.size', 'Font size', 'Format'], ['format.font', 'Font', 'Format'],
    ['format.number', 'Number formats', 'Format'], ['format.link', 'Links', 'Format'], ['format.merge', 'Merge cells', 'Format'], ['format.conditional', 'Conditional formatting', 'Format'],
    ['format.clear', 'Clear formatting', 'Format'],
    ['rows.insert', 'Insert rows', 'Rows'], ['rows.delete', 'Delete rows', 'Rows'], ['rows.resize', 'Resize rows', 'Rows'], ['rows.hide', 'Hide rows', 'Rows'], ['rows.group', 'Group rows', 'Rows'],
    ['cols.insert', 'Insert columns', 'Columns'], ['cols.delete', 'Delete columns', 'Columns'], ['cols.resize', 'Resize columns', 'Columns'], ['cols.hide', 'Hide columns', 'Columns'], ['cols.group', 'Group columns', 'Columns'],
    ['sheets.add', 'Add sheets', 'Sheets'], ['sheets.delete', 'Delete sheets', 'Sheets'], ['sheets.rename', 'Rename sheets', 'Sheets'], ['sheets.move', 'Move sheets', 'Sheets'], ['sheets.hide', 'Hide sheets', 'Sheets'],
    ['view.freeze', 'Freeze rows and columns', 'View'], ['view.gridlines', 'Show or hide gridlines', 'View'],
    ['sort', 'Sort', 'Data'], ['filter', 'Filter', 'Data'], ['validation', 'Data validation', 'Data'], ['names', 'Named ranges', 'Data'], ['settings', 'Spreadsheet settings', 'Data'],
    ['copy', 'Copy out', 'Clipboard and files'], ['paste', 'Paste', 'Clipboard and files'], ['download', 'Download', 'Clipboard and files'], ['import', 'Import', 'Clipboard and files'],
    ['comment.read', 'See comments', 'Comments'], ['comment.create', 'Start a comment', 'Comments'], ['comment.reply', 'Reply', 'Comments'], ['comment.resolve', 'Resolve and reopen', 'Comments'],
    ['comment.edit', 'Edit own comments', 'Comments'], ['comment.delete', 'Delete own comments', 'Comments'], ['comment.moderate', 'Edit and delete anyone\'s comments', 'Comments'],
    ['access', 'Change the access policy', 'Access']
].map(([id, label, group]) => ({ id, label, group }));

/**
 * Every part of the screen a role can hide by its id (ui.hide), with a label and its group, for an editor of policies. The six big parts (menubar,
 * toolbar, formulaBar, headers, gridlines, tabs) are ui flags of their own.
 */
export const UI_ITEMS = [
    ['tool.undo', 'Undo'], ['tool.redo', 'Redo'], ['tool.paint', 'Paint format'], ['tool.zoom', 'Zoom'], ['tool.currency', 'Currency'], ['tool.percent', 'Percent'],
    ['tool.decimals', 'Decimal places'], ['tool.formats', 'More formats'], ['tool.font', 'Font'], ['tool.size', 'Font size'], ['tool.bold', 'Bold'], ['tool.italic', 'Italic'],
    ['tool.strike', 'Strikethrough'], ['tool.underline', 'Underline'], ['tool.color', 'Text color'], ['tool.fill', 'Fill color'], ['tool.borders', 'Borders'], ['tool.merge', 'Merge cells'],
    ['tool.align', 'Horizontal align'], ['tool.valign', 'Vertical align'], ['tool.wrap', 'Text wrapping'], ['tool.rotate', 'Text rotation'], ['tool.link', 'Insert link'],
    ['tool.functions', 'Functions'], ['tool.clear', 'Clear formatting']
].map(([id, label]) => ({ id, label, group: 'Toolbar' })).concat(
    ['File', 'Edit', 'View', 'Insert', 'Format', 'Data'].map((m) => ({ id: 'menu.' + m, label: m + ' menu', group: 'Menus' })),
    [['menu.file:import', 'File > Import'], ['menu.file:download', 'File > Download'], ['menu.file:settings', 'File > Spreadsheet settings'],
        ['menu.edit:find', 'Edit > Find and replace'], ['menu.edit:deleteRows', 'Edit > Delete rows'], ['menu.edit:deleteCols', 'Edit > Delete columns'],
        ['menu.view:freezeRows', 'View > Freeze rows'], ['menu.view:freezeCols', 'View > Freeze columns'], ['menu.view:group', 'View > Group'], ['menu.view:comments', 'View > Comments'],
        ['menu.view:zoom', 'View > Zoom'], ['menu.insert:rowsAbove', 'Insert > Rows'], ['menu.insert:colsLeft', 'Insert > Columns'], ['menu.insert:sheet', 'Insert > Sheet'],
        ['menu.insert:checkbox', 'Insert > Checkbox'], ['menu.insert:dropdown', 'Insert > Dropdown'], ['menu.insert:fn', 'Insert > Function'], ['menu.insert:link', 'Insert > Link'],
        ['menu.insert:comment', 'Insert > Comment'], ['menu.format:conditional', 'Format > Conditional formatting'], ['menu.data:sortSheet', 'Data > Sort sheet'],
        ['menu.data:sortRange', 'Data > Sort range'], ['menu.data:filter', 'Data > Filter'], ['menu.data:validation', 'Data > Data validation'], ['menu.data:names', 'Data > Named ranges']
    ].map(([id, label]) => ({ id, label, group: 'Menu items' })),
    [['panel.comments', 'Comments panel'], ['panel.conditional', 'Conditional formatting panel'], ['panel.names', 'Named ranges panel'], ['panel.validation', 'Data validation dialog'],
        ['panel.find', 'Find and replace'], ['panel.settings', 'Settings dialog'], ['panel.filter', 'Filter buttons and menu']].map(([id, label]) => ({ id, label, group: 'Panels' })),
    [['feature.contextMenu', 'Right-click menu'], ['feature.fillHandle', 'Fill handle'], ['feature.resize', 'Resizing rows and columns by dragging'], ['feature.groups', 'Group buttons'],
        ['cell.commentMark', 'Comment marks on cells'], ['cell.validation', 'Dropdown arrows and checkboxes']].map(([id, label]) => ({ id, label, group: 'Features' }))
);

const ACTION_IDS = new Set(ACTION_INFO.map((a) => a.id));
const GROUP_IDS = new Set(ACTION_INFO.map((a) => a.id.split('.')[0]).filter((g, i, all) => all.indexOf(g) === i && ACTION_INFO.some((a) => a.id.startsWith(g + '.'))));
const UI_IDS = new Set(UI_ITEMS.map((u) => u.id));
const RANGE_TEXT = /^\s*\$?[A-Za-z]{1,3}\$?\d+\s*(:\s*\$?[A-Za-z]{1,3}\$?\d+\s*)?$/;

/**
 * What is wrong with a policy, for an editor (and before it is kept): [{ path, problem }] (empty when it is right). Unknown actions and parts of the
 * screen, roles that are named but not there, modes and ranges that cannot be read.
 */
export function validatePolicy(policy) {
    const out = [];
    const say = (path, problem) => out.push({ path, problem });
    if (!policy || typeof policy !== 'object') return [{ path: '', problem: 'a policy is an object' }];
    const roles = policy.roles || {};
    if (typeof roles !== 'object') say('roles', 'roles is an object of roles by their name');
    for (const [name, role] of Object.entries(roles)) {
        const at = 'roles.' + name;
        for (const a of role.can || []) if (a !== '*' && !ACTION_IDS.has(a) && !GROUP_IDS.has(a)) say(at + '.can', 'there is no action "' + a + '"');
        const ui = role.ui || {};
        for (const id of ui.hide || []) if (!UI_IDS.has(id) && !/^menu\.[a-z]+:[A-Za-z]+/.test(id)) say(at + '.ui.hide', 'there is no part of the screen "' + id + '"');
        if (ui.disallowed && !['grey', 'hide'].includes(ui.disallowed)) say(at + '.ui.disallowed', 'disallowed is "grey" or "hide"');
        const areas = typeof ui.area === 'string' ? { '*': ui.area } : ui.area || {};
        for (const [sheet, area] of Object.entries(areas)) if (!RANGE_TEXT.test(area)) say(at + '.ui.area' + (sheet === '*' ? '' : '.' + sheet), 'the area "' + area + '" is not a range');
        (role.ranges || []).forEach((g, i) => {
            if (g.mode && !RANK[g.mode]) say(at + '.ranges.' + i, 'the mode "' + g.mode + '" is not edit, readonly, hidden or invisible');
            if (g.range && !RANGE_TEXT.test(g.range)) say(at + '.ranges.' + i, 'the range "' + g.range + '" cannot be read');
            if (g.when && !String(g.when).trim().startsWith('=')) say(at + '.ranges.' + i, 'a condition is a formula: it starts with =');
        });
    }
    for (const [who, r] of Object.entries(policy.members || {})) {
        if (!/^(user|group):.+/.test(who)) say('members.' + who, 'a member is "user:<id>" or "group:<id>"');
        for (const name of [].concat(r)) if (!roles[name]) say('members.' + who, 'there is no role "' + name + '"');
    }
    if (policy.default && !roles[policy.default]) say('default', 'there is no role "' + policy.default + '"');
    return out;
}
