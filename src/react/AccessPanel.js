import { useState } from 'react';
import { Icon } from './icons.js';

// the actions a role can be given, in groups as the panel shows them (policy.js has the full list)
const GROUPS = [
    ['Cells', [['edit', 'Edit cells']]],
    ['Format', [['format', 'All formatting'], ['format.bold', 'Bold'], ['format.italic', 'Italic'], ['format.underline', 'Underline'], ['format.strike', 'Strikethrough'],
        ['format.color', 'Text color'], ['format.fill', 'Fill color'], ['format.borders', 'Borders'], ['format.align', 'Alignment'], ['format.wrap', 'Wrapping'],
        ['format.number', 'Number formats'], ['format.font', 'Font'], ['format.size', 'Font size'], ['format.merge', 'Merge'], ['format.link', 'Links'],
        ['format.conditional', 'Conditional formatting'], ['format.clear', 'Clear formatting']]],
    ['Rows and columns', [['rows', 'Rows: everything'], ['rows.insert', 'Insert rows'], ['rows.delete', 'Delete rows'], ['rows.resize', 'Resize rows'], ['rows.hide', 'Hide rows'], ['rows.group', 'Group rows'],
        ['cols', 'Columns: everything'], ['cols.insert', 'Insert columns'], ['cols.delete', 'Delete columns'], ['cols.resize', 'Resize columns'], ['cols.hide', 'Hide columns'], ['cols.group', 'Group columns']]],
    ['Sheets', [['sheets', 'Sheets: everything'], ['sheets.add', 'Add sheets'], ['sheets.delete', 'Delete sheets'], ['sheets.rename', 'Rename sheets'], ['sheets.move', 'Move sheets'], ['sheets.hide', 'Hide sheets']]],
    ['Data', [['sort', 'Sort'], ['filter', 'Filter'], ['validation', 'Data validation'], ['names', 'Named ranges'], ['view', 'Freeze and gridlines'], ['settings', 'Spreadsheet settings']]],
    ['Clipboard and files', [['copy', 'Copy out'], ['paste', 'Paste'], ['download', 'Download'], ['import', 'Import']]]
];
const PARTS = [['menubar', 'Menu bar'], ['toolbar', 'Toolbar'], ['formulaBar', 'Formula bar'], ['headers', 'Row and column headers'], ['gridlines', 'Gridlines'], ['tabs', 'Sheet tabs']];
const MODES = [['edit', 'Can edit'], ['readonly', 'Read only'], ['hidden', 'Hidden (•••)'], ['invisible', 'Invisible (empty)']];

const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * Access and roles (Data menu, for an owner), as one panel on the right of the grid: the roles (what each may do, what it sees, its protected ranges),
 * who has which role, the role of everyone else, and "View as" to see the sheet as a role does. Every change gives the host the whole policy again
 * (onChange) to keep in its database; the sheet uses it at once.
 *
 * @param {object} props
 * @param {object} props.policy  The policy (policy.js); an empty one is made into a start.
 * @param {(policy: object) => void} props.onChange
 * @param {string} props.range  The selection now ("BOQ!B2:B20"): what Protect range takes.
 * @param {(role: string) => void} props.onViewAs
 * @param {() => void} props.onClose
 */
export function AccessPanel({ policy, onChange, range, onViewAs, onClose }) {
    const p = policy && policy.roles ? policy : { owners: [], members: {}, default: 'viewer', roles: { viewer: { can: [] } } };
    const names = Object.keys(p.roles);
    const [open, setOpen] = useState(names[0] || null);
    const [problem, setProblem] = useState('');
    const change = (fn) => { const next = clone(p); fn(next); onChange(next); };
    const role = open && p.roles[open];

    function addRole() {
        let n = 1;
        while (p.roles['role' + n]) n++;
        change((x) => { x.roles['role' + n] = { can: [] }; });
        setOpen('role' + n);
    }
    function renameRole(from, to) {
        to = to.trim();
        if (!to || to === from) return;
        if (p.roles[to]) { setProblem('There is a role "' + to + '" already'); return; }
        setProblem('');
        change((x) => {
            x.roles[to] = x.roles[from];
            delete x.roles[from];
            for (const k of Object.keys(x.members || {})) x.members[k] = [].concat(x.members[k]).map((r) => (r === from ? to : r));
            if (x.default === from) x.default = to;
        });
        setOpen(to);
    }
    const toggle = (action) => change((x) => { const can = new Set(x.roles[open].can || []); if (can.has(action)) can.delete(action); else can.add(action); x.roles[open].can = [...can]; });
    const setPart = (part, shown) => change((x) => { const ui = { ...(x.roles[open].ui || {}) }; if (shown) delete ui[part]; else ui[part] = false; x.roles[open].ui = ui; });

    return (
        <aside className="ks-panel ks-access" aria-label="Access and roles">
            <div className="ks-panel-head">
                <h2 className="ks-panel-title">Access and roles</h2>
                <button type="button" className="ks-tool" aria-label="Close" title="Close" onClick={onClose}>✕</button>
            </div>

            <section className="ks-access-section">
                <h3>Roles</h3>
                <div className="ks-access-roles" role="tablist">
                    {names.map((n) => <button key={n} type="button" role="tab" aria-selected={n === open} className={'ks-chip' + (n === open ? ' ks-on' : '')} onClick={() => setOpen(n)}>{n}</button>)}
                    <button type="button" className="ks-chip ks-chip-add" onClick={addRole}><Icon name="add" /> Role</button>
                </div>
                {role ? (
                    <div className="ks-access-role">
                        <div className="ks-access-row">
                            <input aria-label="Role name" defaultValue={open} key={open} onBlur={(e) => renameRole(open, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                            <button type="button" className="ks-button" onClick={() => onViewAs(open)}>View as</button>
                            <button type="button" className="ks-tool" aria-label={'Delete role ' + open} title="Delete role" disabled={names.length < 2}
                                onClick={() => { change((x) => { delete x.roles[open]; for (const k of Object.keys(x.members || {})) { const left = [].concat(x.members[k]).filter((r) => r !== open); if (left.length) x.members[k] = left; else delete x.members[k]; } if (x.default === open) x.default = Object.keys(x.roles)[0]; }); setOpen(names.find((n) => n !== open)); }}><Icon name="trash" /></button>
                        </div>
                        {GROUPS.map(([group, actions]) => (
                            <fieldset key={group} className="ks-access-group">
                                <legend>{group}</legend>
                                {actions.map(([a, label]) => {
                                    const can = new Set(role.can || []);
                                    const byGroup = a.includes('.') && can.has(a.split('.')[0]);
                                    return <label key={a} className={'ks-check' + (byGroup ? ' ks-implied' : '')}><input type="checkbox" checked={can.has(a) || byGroup || can.has('*')} disabled={byGroup || can.has('*')} onChange={() => toggle(a)} />{label}</label>;
                                })}
                            </fieldset>
                        ))}
                        <fieldset className="ks-access-group">
                            <legend>What it sees</legend>
                            {PARTS.map(([part, label]) => <label key={part} className="ks-check"><input type="checkbox" checked={!role.ui || role.ui[part] !== false} onChange={(e) => setPart(part, e.target.checked)} />{label}</label>)}
                            <label className="ks-field ks-field-stack"><span>Only this area (empty: the whole sheet)</span>
                                <input aria-label="Area" defaultValue={(role.ui && role.ui.area) || ''} key={open + ':area'} placeholder="A1:H200"
                                    onBlur={(e) => change((x) => { const ui = { ...(x.roles[open].ui || {}) }; if (e.target.value.trim()) ui.area = e.target.value.trim().toUpperCase(); else delete ui.area; x.roles[open].ui = ui; })} />
                            </label>
                        </fieldset>
                        <fieldset className="ks-access-group">
                            <legend>Protected ranges</legend>
                            <ol className="ks-rule-list">
                                {(role.ranges || []).map((g, i) => (
                                    <li key={i} className="ks-rule-card ks-access-range">
                                        <span className="ks-rule-text"><span className="ks-rule-says">{(g.sheet ? g.sheet + '!' : '') + (g.range || (g.columns ? 'columns ' + g.columns.join(', ') : 'whole sheet'))}</span>
                                            {g.when ? <span className="ks-rule-ranges">when {g.when}</span> : null}</span>
                                        <select aria-label="Mode" value={g.mode} onChange={(e) => change((x) => { x.roles[open].ranges[i].mode = e.target.value; })}>{MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                                        <button type="button" className="ks-tool" aria-label="Remove range" title="Remove" onClick={() => change((x) => { x.roles[open].ranges.splice(i, 1); })}><Icon name="trash" /></button>
                                    </li>
                                ))}
                            </ol>
                            <button type="button" className="ks-button ks-add-rule" onClick={() => {
                                const [sheet, cells] = range.includes('!') ? [range.slice(0, range.lastIndexOf('!')).replace(/^'|'$/g, '').replace(/''/g, "'"), range.slice(range.lastIndexOf('!') + 1)] : [null, range];
                                change((x) => { x.roles[open].ranges = (x.roles[open].ranges || []).concat([{ ...(sheet ? { sheet } : {}), range: cells.includes(':') ? cells : cells + ':' + cells, mode: 'readonly' }]); });
                            }}><Icon name="add" /> Protect range {range}</button>
                        </fieldset>
                    </div>
                ) : null}
            </section>

            <section className="ks-access-section">
                <h3>People and groups</h3>
                <ol className="ks-rule-list">
                    {Object.entries(p.members || {}).map(([who, r]) => (
                        <li key={who} className="ks-rule-card ks-access-member">
                            <span className="ks-rule-says">{who}</span>
                            <select aria-label={'Role of ' + who} value={[].concat(r)[0]} onChange={(e) => change((x) => { x.members[who] = e.target.value; })}>{names.map((n) => <option key={n} value={n}>{n}</option>)}</select>
                            <button type="button" className="ks-tool" aria-label={'Remove ' + who} title="Remove" onClick={() => change((x) => { delete x.members[who]; })}><Icon name="trash" /></button>
                        </li>
                    ))}
                </ol>
                <form className="ks-access-row" onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.who;
                    const who = input.value.trim();
                    if (!who) return;
                    const key = who.includes(':') ? who : 'user:' + who;
                    change((x) => { x.members = { ...(x.members || {}), [key]: open || names[0] }; });
                    input.value = '';
                }}>
                    <input name="who" aria-label="Person or group" placeholder="user:budi or group:mandor" />
                    <button type="submit" className="ks-button">Add</button>
                </form>
                <label className="ks-field ks-field-stack"><span>Everyone else</span>
                    <select aria-label="Everyone else" value={p.default || ''} onChange={(e) => change((x) => { x.default = e.target.value || undefined; })}>
                        <option value="">No access to anything but looking</option>
                        {names.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                </label>
                <label className="ks-field ks-field-stack"><span>Owners (may change all of this)</span>
                    <input aria-label="Owners" defaultValue={(p.owners || []).join(', ')} onBlur={(e) => change((x) => { x.owners = e.target.value.split(',').map((v) => v.trim()).filter(Boolean).map((v) => (v.includes(':') ? v : 'user:' + v)); })} />
                </label>
            </section>
            <p className="ks-dialog-status ks-problem" aria-live="polite">{problem}</p>
        </aside>
    );
}
