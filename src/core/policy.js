// Access control: who may do what in a workbook, as a list of rows the host keeps in a table of its database (one row, one rule) and gives to the
// sheet for the person who opens it. The same rows, and the same code, decide on the server (viewFor, checkPatch): the browser is never trusted with
// what a person may not see or do. Pure (no DOM).
//
//   who          effect  action          where             when                message
//   role:kasir   allow   read            Stok!A1:F100
//   role:kasir   allow   edit            Stok!col:Qty      =$G2<>"Approved"    Already approved
//   role:kasir   deny    read            Stok!F2:F100                          (shows •••)
//   role:kasir   deny    format.bold
//   role:kasir   allow   view.area       Stok!A1:F20                           (only this part of the sheet shows)
//   role:kasir   deny    ui.toolbar
//   user:budi    allow   edit            Stok!col:Price                        (budi, a kasir, gets what kasir does not)
//   user:yeka    allow   *                                                     (the owner)
//
// How a question is decided ("may this person do this action, here?"):
//   1. only the rows for this person count: their user, their roles, and '*' (everyone);
//   2. the most specific of those that say something wins: a row for the user beats a row for a role, a row for a role beats one for everyone;
//   3. among rows of the same level, deny wins over allow;
//   4. nothing said: not allowed. The parts of the screen (ui.*) are the only exception: they show unless a row hides them.
// For cells the actions are read, edit and see: edit lets it be changed (and read), read lets it be read, deny read shows ••• (the content is not
// sent), deny see shows an empty cell (nothing tells it holds anything). A cell nobody allows is shown empty.

/** Every action a row can name. A group ('format', 'rows', 'cols', 'sheets', 'view', 'comment') names every action under it; '*' names everything. */
export const ACTIONS = [
    'read', 'edit', 'see',
    'format.bold', 'format.italic', 'format.underline', 'format.strike', 'format.color', 'format.fill', 'format.borders', 'format.align', 'format.wrap',
    'format.rotate', 'format.size', 'format.font', 'format.number', 'format.link', 'format.merge', 'format.conditional', 'format.clear',
    'rows.insert', 'rows.delete', 'rows.resize', 'rows.hide', 'rows.group',
    'cols.insert', 'cols.delete', 'cols.resize', 'cols.hide', 'cols.group',
    'sheets.add', 'sheets.delete', 'sheets.rename', 'sheets.move', 'sheets.hide',
    'view.freeze', 'view.gridlines', 'view.area', 'view.sheet',
    'sort', 'filter', 'validation', 'names', 'settings', 'pivot',
    'copy', 'paste', 'download', 'import',
    'comment.read', 'comment.create', 'comment.reply', 'comment.resolve', 'comment.edit', 'comment.delete', 'comment.moderate',
    'access'
];

const UI_PARTS = ['menubar', 'toolbar', 'formulaBar', 'headers', 'gridlines', 'tabs'];
const RANK = { edit: 1, readonly: 2, hidden: 3, invisible: 4 };
export const strongerMode = (a, b) => (!a ? b : !b ? a : RANK[b.mode] > RANK[a.mode] ? b : a);

/** The person who opens: 'rina' (a user), or { user: 'rina', roles: ['kasir'] }. Made into the who-texts their rows are written with. */
function whoTexts(who) {
    if (!who) return { user: null, roles: [] };
    if (typeof who === 'string') return { user: who, roles: [] };
    return { user: who.user || null, roles: who.roles || [] };
}

/** How specific a row is for this person: 3 their user, 2 one of their roles, 1 everyone, 0 not for them. */
function levelFor(row, person) {
    const w = String(row.who || '').trim();
    if (w === '*') return 1;
    if (person.user !== null && w === 'user:' + person.user) return 3;
    if (w.startsWith('role:') && person.roles.includes(w.slice(5))) return 2;
    return 0;
}

/** True when a row's action names this action: the same one, its group ('format' for 'format.bold'), or '*'. */
function names(rowAction, action) {
    if (rowAction === '*') return true;
    if (rowAction === action) return true;
    return action.startsWith(rowAction + '.');
}

/** "Stok!A1:F100", "Stok!col:Qty", "A1:F100", "col:Qty", "Stok" (a whole sheet) or nothing (everywhere): the sheet, the range and the columns. */
export function parseWhere(where) {
    const text = String(where || '').trim();
    if (!text) return { sheet: null, range: null, columns: null };
    const bang = text.lastIndexOf('!');
    const sheet = bang >= 0 ? text.slice(0, bang).replace(/^'|'$/g, '') : null;
    const place = bang >= 0 ? text.slice(bang + 1).trim() : text;
    if (place.startsWith('col:')) return { sheet, range: null, columns: place.slice(4).split(',').map((s) => s.trim()).filter(Boolean) };
    if (bang < 0 && !/^\$?[A-Za-z]{1,3}\$?\d*(:\$?[A-Za-z]{1,3}\$?\d*)?$/.test(place)) return { sheet: place, range: null, columns: null };
    return { sheet, range: place || null, columns: null };
}

// a row of the cells made into the mode it gives (edit < readonly < hidden < invisible, so within one level the stronger, the deny, wins)
function cellModeOf(row) {
    const deny = row.effect === 'deny';
    if (row.action === 'edit') return deny ? 'readonly' : 'edit';
    if (row.action === 'read') return deny ? 'hidden' : 'readonly';
    if (row.action === 'see') return deny ? 'invisible' : 'readonly';
    if (row.action === '*') return deny ? 'invisible' : 'edit';
    return null;
}

/**
 * What the rows give a person: { owner, roles, can(action), ui, ranges, message }. No rows: everything (a sheet without access control).
 * @param {object[]|null} rows
 * @param {string|{ user?: string, roles?: string[] }} who
 */
export function resolveAccess(rows, who) {
    if (!rows) return { owner: true, roles: [], can: () => true, ui: allShown(), ranges: [], message: null };
    const person = whoTexts(who);
    const mine = [];
    for (const row of rows) { const level = levelFor(row, person); if (level) mine.push({ ...row, level, action: String(row.action || '').trim() }); }
    const message = (mine.find((r) => r.effect === 'deny' && r.message) || {}).message || null;

    // an action anywhere: the most specific level that says something decides, deny winning within it. Rows tied to a place (a where) are the cells'
    // to decide, except view.area and view.sheet, whose where is what they show
    const decide = (action, placed) => {
        let best = 0, allow = false, deny = false;
        for (const r of mine) {
            if (!placed && r.where && !r.action.startsWith('view.')) continue;
            if (!names(r.action, action)) continue;
            if (r.level > best) { best = r.level; allow = false; deny = false; }
            if (r.level === best) { if (r.effect === 'deny') deny = true; else allow = true; }
        }
        return best ? (deny ? 'deny' : allow ? 'allow' : null) : null;
    };
    const can = (action) => decide(action, false) === 'allow';
    const owner = can('*') && !mine.some((r) => r.effect === 'deny');

    // the parts of the screen show unless a row hides them; a single item (ui.tool.bold, ui.menu.Insert) is hidden the same way
    const ui = allShown();
    for (const part of UI_PARTS) ui[part] = decide('ui.' + part, false) !== 'deny';
    ui.hide = [...new Set(mine.filter((r) => r.action.startsWith('ui.') && !UI_PARTS.includes(r.action.slice(3)) && r.action !== 'ui.disallowed').map((r) => r.action.slice(3)))].filter((id) => decide('ui.' + id, false) === 'deny');
    ui.disallowed = decide('ui.disallowed', false) === 'deny' ? 'hide' : 'grey';
    // only part of a sheet shows (view.area), only some sheets show (view.sheet): the rows of the most specific level that has them
    const topRows = (action) => { const list = mine.filter((r) => r.action === action && r.effect !== 'deny' && r.where); const top = Math.max(0, ...list.map((r) => r.level)); return list.filter((r) => r.level === top); };
    const areas = topRows('view.area');
    if (areas.length) { ui.area = {}; for (const r of areas) { const w = parseWhere(r.where); if (w.range) ui.area[w.sheet || '*'] = w.range; } if (Object.keys(ui.area).length === 1 && ui.area['*']) ui.area = ui.area['*']; }
    const sheets = topRows('view.sheet');
    if (sheets.length) ui.sheets = sheets.map((r) => parseWhere(r.where).sheet).filter(Boolean);

    // the cells: every row of read / edit / see (and '*') becomes a range with its mode and its level; a cell nobody allows is empty
    const ranges = [];
    for (const r of mine) {
        const mode = cellModeOf(r);
        if (!mode) continue;
        const w = parseWhere(r.where);
        // a cell a person may only read says so in plain words, unless the row has its own message (or the rows one for every refusal)
        const said = r.message || (mode === 'readonly' ? message || 'You can only view this here' : undefined);
        ranges.push({ sheet: w.sheet || undefined, range: w.range || undefined, columns: w.columns || undefined, when: r.when || undefined, mode, message: said, level: r.level, deny: r.effect === 'deny' });
    }
    if (owner) return { owner: true, roles: person.roles.slice(), can: () => true, ui: allShown(), ranges: [], message };
    ranges.push({ mode: 'invisible', level: 0.5, message: message || undefined });
    return { owner: false, roles: person.roles.slice(), can, ui, ranges, message };
}

const allShown = () => ({ menubar: true, toolbar: true, formulaBar: true, headers: true, gridlines: true, tabs: true, area: null, hide: [], disallowed: 'grey', sheets: null });

// ---- what a change asks to do ----------------------------------------------------------------------------------------------------------------------

const STYLE_ACTION = { bold: 'format.bold', italic: 'format.italic', underline: 'format.underline', strike: 'format.strike', color: 'format.color', fill: 'format.fill',
    borders: 'format.borders', align: 'format.align', valign: 'format.align', wrap: 'format.wrap', rotate: 'format.rotate', fontSize: 'format.size', font: 'format.font',
    format: 'format.number', link: 'format.link' };
const ROW_ACTION = { height: 'rows.resize', hidden: 'rows.hide', level: 'rows.group', fold: 'rows.group' };
const COL_ACTION = { width: 'cols.resize', hidden: 'cols.hide', level: 'cols.group', fold: 'cols.group', format: 'format.number' };
const SHEET_ACTION = { name: 'sheets.rename', hidden: 'sheets.hide', freezeRows: 'view.freeze', freezeCols: 'view.freeze', hideGridlines: 'view.gridlines', filter: 'filter',
    conditionals: 'format.conditional', validations: 'validation', merges: 'format.merge', colWidth: 'cols.resize', rowHeight: 'rows.resize', pivots: 'pivot' };
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
    ['read', 'Read cells', 'Cells'], ['edit', 'Edit cells', 'Cells'], ['see', 'See that cells hold something', 'Cells'],
    ['format.bold', 'Bold', 'Format'], ['format.italic', 'Italic', 'Format'], ['format.underline', 'Underline', 'Format'], ['format.strike', 'Strikethrough', 'Format'],
    ['format.color', 'Text color', 'Format'], ['format.fill', 'Fill color', 'Format'], ['format.borders', 'Borders', 'Format'], ['format.align', 'Alignment', 'Format'],
    ['format.wrap', 'Wrapping', 'Format'], ['format.rotate', 'Rotation', 'Format'], ['format.size', 'Font size', 'Format'], ['format.font', 'Font', 'Format'],
    ['format.number', 'Number formats', 'Format'], ['format.link', 'Links', 'Format'], ['format.merge', 'Merge cells', 'Format'], ['format.conditional', 'Conditional formatting', 'Format'],
    ['format.clear', 'Clear formatting', 'Format'],
    ['rows.insert', 'Insert rows', 'Rows'], ['rows.delete', 'Delete rows', 'Rows'], ['rows.resize', 'Resize rows', 'Rows'], ['rows.hide', 'Hide rows', 'Rows'], ['rows.group', 'Group rows', 'Rows'],
    ['cols.insert', 'Insert columns', 'Columns'], ['cols.delete', 'Delete columns', 'Columns'], ['cols.resize', 'Resize columns', 'Columns'], ['cols.hide', 'Hide columns', 'Columns'], ['cols.group', 'Group columns', 'Columns'],
    ['sheets.add', 'Add sheets', 'Sheets'], ['sheets.delete', 'Delete sheets', 'Sheets'], ['sheets.rename', 'Rename sheets', 'Sheets'], ['sheets.move', 'Move sheets', 'Sheets'], ['sheets.hide', 'Hide sheets', 'Sheets'],
    ['view.area', 'Only this part of a sheet shows', 'View'], ['view.sheet', 'Only these sheets show', 'View'], ['view.freeze', 'Freeze rows and columns', 'View'], ['view.gridlines', 'Show or hide gridlines', 'View'],
    ['sort', 'Sort', 'Data'], ['filter', 'Filter', 'Data'], ['pivot', 'Pivot tables', 'Data'], ['validation', 'Data validation', 'Data'], ['names', 'Named ranges', 'Data'], ['settings', 'Spreadsheet settings', 'Data'],
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
        ['menu.insert:comment', 'Insert > Comment'], ['menu.insert:pivot', 'Insert > Pivot table'], ['menu.format:conditional', 'Format > Conditional formatting'], ['menu.data:sortSheet', 'Data > Sort sheet'],
        ['menu.data:sortRange', 'Data > Sort range'], ['menu.data:filter', 'Data > Filter'], ['menu.data:validation', 'Data > Data validation'], ['menu.data:names', 'Data > Named ranges']
    ].map(([id, label]) => ({ id, label, group: 'Menu items' })),
    [['panel.comments', 'Comments panel'], ['panel.pivot', 'Pivot table editor'], ['panel.conditional', 'Conditional formatting panel'], ['panel.names', 'Named ranges panel'], ['panel.validation', 'Data validation dialog'],
        ['panel.find', 'Find and replace'], ['panel.settings', 'Settings dialog'], ['panel.filter', 'Filter buttons and menu']].map(([id, label]) => ({ id, label, group: 'Panels' })),
    [['feature.contextMenu', 'Right-click menu'], ['feature.fillHandle', 'Fill handle'], ['feature.resize', 'Resizing rows and columns by dragging'], ['feature.groups', 'Group buttons'],
        ['cell.commentMark', 'Comment marks on cells'], ['cell.validation', 'Dropdown arrows and checkboxes']].map(([id, label]) => ({ id, label, group: 'Features' }))
);

const ACTION_IDS = new Set(ACTIONS);
const GROUP_IDS = new Set(ACTIONS.filter((a) => a.includes('.')).map((a) => a.split('.')[0]));
const UI_IDS = new Set(UI_ITEMS.map((u) => u.id));
const RANGE_TEXT = /^\s*\$?[A-Za-z]{1,3}\$?\d*\s*(:\s*\$?[A-Za-z]{1,3}\$?\d*\s*)?$/;

/**
 * What is wrong with the access rows, for an editor (and before they are kept): [{ row, problem }] (row = its index; empty when they are right).
 * A who that is not user:, role: or *, an effect that is not allow or deny, an unknown action or part of the screen, a where or a when that cannot be read.
 * @param {unknown} rows
 */
export function validateAccess(rows) {
    if (!Array.isArray(rows)) return [{ row: -1, problem: 'the access is a list of rows' }];
    const out = [];
    rows.forEach((r, row) => {
        const say = (problem) => out.push({ row, problem });
        if (!r || typeof r !== 'object') { say('a row is an object'); return; }
        const who = String(r.who || '').trim();
        if (who !== '*' && !/^(user|role):.+/.test(who)) say('who is "user:<name>", "role:<name>" or "*"');
        if (r.effect !== 'allow' && r.effect !== 'deny') say('effect is "allow" or "deny"');
        const action = String(r.action || '').trim();
        if (action.startsWith('ui.')) {
            const id = action.slice(3);
            if (!UI_PARTS.includes(id) && id !== 'disallowed' && !UI_IDS.has(id) && !/^menu\.[a-z]+:[A-Za-z]+/.test(id)) say('there is no part of the screen "' + id + '"');
        } else if (action !== '*' && !ACTION_IDS.has(action) && !GROUP_IDS.has(action)) say('there is no action "' + action + '"');
        if (r.where) {
            const w = parseWhere(r.where);
            if (w.range && !RANGE_TEXT.test(w.range)) say('the range "' + w.range + '" cannot be read');
        }
        if ((action === 'view.area') && !(r.where && parseWhere(r.where).range)) say('view.area needs a range in where');
        if ((action === 'view.sheet') && !(r.where && parseWhere(r.where).sheet)) say('view.sheet needs a sheet in where');
        if (r.when && !String(r.when).trim().startsWith('=')) say('a condition is a formula: it starts with =');
    });
    return out;
}
