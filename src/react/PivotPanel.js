import { useId, useMemo, useState } from 'react';
import * as dialog from '@zag-js/dialog';
import { useMachine, normalizeProps, Portal } from '@zag-js/react';
import { Icon } from './icons.js';
import { tableOf, PIVOT_FUNCTIONS, PIVOT_LABEL_OPS, PIVOT_VALUE_OPS, parseCalculated } from '../core/pivot.js';

const FUNCTIONS = Object.keys(PIVOT_FUNCTIONS);

/**
 * Making a pivot table (Insert > Pivot table), as in Google Sheets: the range of the data (the block around the selection to start with) and where the
 * table goes, a new sheet or a cell of a sheet. Made with zag.js.
 *
 * @param {object} props
 * @param {string} props.range  The data to start with ("Sheet1!A1:F20").
 * @param {(source: string, where: { newSheet: boolean, at: string }) => string|null} props.onCreate  Returns a reason when it cannot be made.
 * @param {() => void} props.onClose
 * @param {import('react').RefObject<HTMLElement>} props.container
 */
export function PivotDialog({ range, onCreate, onClose, container }) {
    const service = useMachine(dialog.machine, { id: useId(), open: true, onOpenChange: (d) => { if (!d.open) onClose(); } });
    const api = dialog.connect(service, normalizeProps);
    const [source, setSource] = useState(range);
    const [newSheet, setNewSheet] = useState(true);
    const [at, setAt] = useState('');
    const [problem, setProblem] = useState('');
    const create = () => { const why = onCreate(source.trim(), { newSheet, at: at.trim() }); if (why) setProblem(why); };
    return (
        <Portal container={container}>
            <div {...api.getBackdropProps()} className="ks-backdrop" />
            <div {...api.getPositionerProps()} className="ks-dialog-positioner">
                <div {...api.getContentProps()} className="ks-dialog">
                    <h2 {...api.getTitleProps()} className="ks-dialog-title">Create pivot table</h2>
                    <div className="ks-form">
                        <label className="ks-field"><span>Data range</span><input aria-label="Data range" value={source} onChange={(e) => setSource(e.target.value)} /></label>
                        <div className="ks-field"><span>Insert to</span>
                            <div className="ks-radios">
                                <label><input type="radio" name="pivot-where" checked={newSheet} onChange={() => setNewSheet(true)} /> New sheet</label>
                                <label><input type="radio" name="pivot-where" checked={!newSheet} onChange={() => setNewSheet(false)} /> Existing sheet</label>
                            </div>
                        </div>
                        {newSheet ? null : <label className="ks-field"><span>Cell</span><input aria-label="Cell" value={at} placeholder="Sheet1!H1" onChange={(e) => setAt(e.target.value)} /></label>}
                        <p className="ks-dialog-status ks-problem" aria-live="polite">{problem}</p>
                    </div>
                    <div className="ks-dialog-actions">
                        <span style={{ flex: 1 }} />
                        <button type="button" className="ks-button" {...api.getCloseTriggerProps()}>Cancel</button>
                        <button type="button" className="ks-button ks-primary" onClick={create}>Create</button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}


// The words of the editor for the choices of a pivot, in the order a person looks for them (Excel's names).
const SHOW_AS = [
    ['', 'No calculation'], ['percentOfTotal', '% of grand total'], ['percentOfColumn', '% of column total'], ['percentOfRow', '% of row total'],
    ['runningTotal', 'Running total in'], ['percentRunningTotal', '% running total in'], ['difference', 'Difference from previous'],
    ['percentDifference', '% difference from previous'], ['rank', 'Rank largest to smallest']
];
// the ways of showing that walk along a field (they ask which one)
const WALKS = new Set(['runningTotal', 'percentRunningTotal', 'difference', 'percentDifference', 'rank']);
const DATE_GROUPS = [['', 'No date groups'], ['year', 'Year'], ['quarter', 'Quarter'], ['month', 'Month'], ['week', 'Week'], ['day', 'Day'], ['weekday', 'Day of week']];
const LABEL_WORDS = {
    equals: 'Equals', notEquals: 'Does not equal', beginsWith: 'Begins with', notBeginsWith: 'Does not begin with', endsWith: 'Ends with',
    notEndsWith: 'Does not end with', contains: 'Contains', notContains: 'Does not contain', greaterThan: 'Greater than', greaterOrEqual: 'Greater than or equal to',
    lessThan: 'Less than', lessOrEqual: 'Less than or equal to', between: 'Between', notBetween: 'Not between'
};
const VALUE_WORDS = { '=': 'Equals', '<>': 'Does not equal', '>': 'Greater than', '>=': 'Greater than or equal to', '<': 'Less than', '<=': 'Less than or equal to', between: 'Between', notBetween: 'Not between' };

// A number typed in an editor field: a number when it reads as one, else the text as it is (a label condition compares texts too).
const typed = (text) => (text.trim() !== '' && Number.isFinite(Number(text)) ? Number(text) : text);

/**
 * A text field of the editor that is applied when the person is done with it (Enter or leaving it), not on every key: the pivot is worked out again
 * once, and the field is not drawn again under the person's fingers.
 */
function Entry({ label, value, placeholder, onApply }) {
    const shown = value === undefined || value === null ? '' : String(value);
    return (
        <input aria-label={label} placeholder={placeholder} defaultValue={shown} key={shown}
            onBlur={(e) => { if (e.target.value !== shown) onApply(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
    );
}

/**
 * The editor of a pivot table, in the panel on the right of the grid (it opens when a cell of the table is selected), with what Excel's has: its data
 * range; its Rows and Columns (each with its order and, for dates, its date groups); its Values (a field, how it is summed up, and how it is shown:
 * shares, running totals, differences, ranks); its calculated fields; its Filters (the values left out, a label condition, a value condition, the
 * top n); the totals, and Remove. Every change is written at once (one change, undone at once).
 *
 * @param {object} props
 * @param {any} props.workbook @param {string} props.sheetId  The sheet the table is in.
 * @param {string} props.id  The pivot table.
 * @param {number} props.revision  So the panel is drawn again after a change.
 * @param {(message: string) => void} props.onError
 * @param {() => void} props.onClose
 */
export function PivotPanel({ workbook: wb, sheetId: s, id, revision, onError, onClose }) {
    const p = wb.pivots(s).find((x) => x.id === id);
    const [openFilter, setOpenFilter] = useState(null);
    const [newCalc, setNewCalc] = useState({ name: '', formula: '' });
    // the fields and the records of the data, for the lists of fields and the values of a filter
    const data = useMemo(() => {
        if (!p) return { fields: [], records: [] };
        try {
            const named = wb.nameRange(p.source);
            if (named) return tableOf(wb, named.sheetId, named.range);
            const m = /^(?:(?:'((?:[^']|'')+)'|([^!'"]+))!)?(.+)$/.exec(p.source);
            const sheet = m && (m[1] ? m[1].replace(/''/g, "'") : m[2]);
            return tableOf(wb, sheet ? sheet.trim() : s, m ? m[3] : p.source);
        } catch { return { fields: [], records: [] }; }
    }, [wb, s, p && p.source, revision]);
    if (!p) return null;
    const spec = p.spec || {};
    const how = { source: 'user' };
    const change = (next) => { try { wb.setPivot(s, id, { spec: { ...spec, ...next } }, how); } catch (err) { onError(err.message); } };
    const rows = spec.rows || [], cols = spec.columns || [], values = spec.values || [], filters = spec.filters || {}, calculated = spec.calculated || [];
    const unused = (list) => data.fields.filter((f) => !list.includes(f));
    const valueTitle = (v) => v.as || (calculated.some((c) => c.name === v.field) ? v.field : String(v.fn || 'SUM').toUpperCase() + ' of ' + v.field);
    // the order of a field's groups: by their names ('asc' | 'desc'), or by a value ({ by, dir }: the biggest totals first)
    const sortOf = (f) => (spec.sort && spec.sort[f]) || 'asc';
    const dirOf = (f) => { const h = sortOf(f); return (typeof h === 'object' ? h.dir : h) || 'asc'; };
    const byOf = (f) => { const h = sortOf(f); return typeof h === 'object' && h.by ? h.by : ''; };
    const setSort = (f, dir, by) => change({ sort: { ...(spec.sort || {}), [f]: by ? { by, dir } : dir } });
    // dates put together by year, quarter, month, week, day or day of the week: offered for a field that holds dates (day numbers, or ISO texts)
    const holdsDates = (f) => data.records.some((r) => typeof r[f] === 'number' || (typeof r[f] === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r[f])));
    const groupOf = (f) => (spec.group && spec.group[f]) || '';
    const setGroup = (f, unit) => {
        const next = { ...(spec.group || {}) };
        if (unit) next[f] = unit; else delete next[f];
        change({ group: Object.keys(next).length ? next : undefined });
    };
    const setValue = (i, patch) => change({ values: values.map((x, j) => (j === i ? clean({ ...x, ...patch }) : x)) });
    // a filter of a field changed in one of its parts (hidden, label, value, top); a part set to null is taken away
    const setFilter = (f, patch) => change({ filters: { ...filters, [f]: clean({ ...(filters[f] || {}), ...patch }) } });

    // a list of group fields (Rows or Columns): each with its order and a remove button, and a select to add one
    const groups = (label, key, list) => (
        <section className="ks-pivot-section" aria-label={label}>
            <h3>{label}</h3>
            {list.map((f) => (
                <div key={f} className="ks-pivot-item">
                    <b>{f}</b>
                    <button type="button" className="ks-tool" aria-label={'Remove ' + f + ' from ' + label} title="Remove" onClick={() => change({ [key]: list.filter((x) => x !== f) })}>✕</button>
                    <div className="ks-pivot-opts">
                        <select aria-label={'Order of ' + f} value={dirOf(f)} onChange={(e) => setSort(f, e.target.value, byOf(f))}>
                            <option value="asc">Ascending</option><option value="desc">Descending</option>
                        </select>
                        <select aria-label={'Sort ' + f + ' by'} value={byOf(f)} onChange={(e) => setSort(f, dirOf(f), e.target.value)}>
                            <option value="">by {f}</option>
                            {values.map((v) => <option key={v.as || v.field} value={v.as || v.field}>by {valueTitle(v)}</option>)}
                        </select>
                        {holdsDates(f) || groupOf(f) ? (
                            <select aria-label={'Group ' + f} value={groupOf(f)} onChange={(e) => setGroup(f, e.target.value)}>
                                {DATE_GROUPS.map(([v, words]) => <option key={v} value={v}>{words}</option>)}
                            </select>
                        ) : null}
                    </div>
                </div>
            ))}
            <select className="ks-pivot-add" aria-label={'Add to ' + label} value="" onChange={(e) => { if (e.target.value) change({ [key]: list.concat([e.target.value]) }); }}>
                <option value="">Add…</option>
                {unused([...rows, ...cols]).map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
        </section>
    );

    // the conditions of a filter, under its values: a label condition, and for a row or column field a value condition and the top n
    const conditions = (f) => {
        const flt = filters[f] || {};
        const grouped = rows.includes(f) || cols.includes(f);
        const byChoices = values.map((v) => <option key={v.as || v.field} value={v.as || v.field}>{valueTitle(v)}</option>);
        const firstBy = values.length ? values[0].as || values[0].field : '';
        const label = flt.label || null, val = flt.value || null, top = flt.top || null;
        return (
            <div className="ks-pivot-conditions">
                <div className="ks-pivot-opts" aria-label={'Label condition of ' + f}>
                    <select aria-label={'Label condition of ' + f} value={label ? label.op : ''}
                        onChange={(e) => setFilter(f, { label: e.target.value ? { op: e.target.value, value: label ? label.value : '', to: label ? label.to : undefined } : null })}>
                        <option value="">No label condition</option>
                        {PIVOT_LABEL_OPS.map((op) => <option key={op} value={op}>{LABEL_WORDS[op]}</option>)}
                    </select>
                    {label ? <Entry label={'Label value of ' + f} value={label.value} placeholder="Value" onApply={(t) => setFilter(f, { label: { ...label, value: typed(t) } })} /> : null}
                    {label && /between/i.test(label.op) ? <Entry label={'Label value to of ' + f} value={label.to} placeholder="and" onApply={(t) => setFilter(f, { label: { ...label, to: typed(t) } })} /> : null}
                </div>
                {grouped && values.length ? (
                    <div className="ks-pivot-opts">
                        <select aria-label={'Value condition of ' + f} value={val ? val.op : ''}
                            onChange={(e) => setFilter(f, { value: e.target.value ? { by: val ? val.by : firstBy, op: e.target.value, value: val ? val.value : 0, to: val ? val.to : undefined } : null })}>
                            <option value="">No value condition</option>
                            {PIVOT_VALUE_OPS.map((op) => <option key={op} value={op}>{VALUE_WORDS[op]}</option>)}
                        </select>
                        {val ? <select aria-label={'Value condition of ' + f + ' on'} value={val.by} onChange={(e) => setFilter(f, { value: { ...val, by: e.target.value } })}>{byChoices}</select> : null}
                        {val ? <Entry label={'Value of ' + f} value={val.value} placeholder="Number" onApply={(t) => setFilter(f, { value: { ...val, value: Number(t) || 0 } })} /> : null}
                        {val && /between/i.test(val.op) ? <Entry label={'Value to of ' + f} value={val.to} placeholder="and" onApply={(t) => setFilter(f, { value: { ...val, to: Number(t) || 0 } })} /> : null}
                    </div>
                ) : null}
                {grouped && values.length ? (
                    <div className="ks-pivot-opts">
                        <select aria-label={'Top of ' + f} value={top ? (top.bottom ? 'bottom' : 'top') : ''}
                            onChange={(e) => setFilter(f, { top: e.target.value ? { n: top ? top.n : 10, by: top ? top.by : firstBy, bottom: e.target.value === 'bottom' || undefined } : null })}>
                            <option value="">All items</option><option value="top">Top</option><option value="bottom">Bottom</option>
                        </select>
                        {top ? <Entry label={'Top count of ' + f} value={top.n} placeholder="10" onApply={(t) => setFilter(f, { top: { ...top, n: Math.max(0, Math.floor(Number(t) || 0)) } })} /> : null}
                        {top ? <select aria-label={'Top of ' + f + ' by'} value={top.by} onChange={(e) => setFilter(f, { top: { ...top, by: e.target.value } })}>{byChoices}</select> : null}
                    </div>
                ) : null}
            </div>
        );
    };
    // what a filter's button says: how many values are left out, and the conditions it has
    const filterSummary = (flt) => {
        const parts = [];
        if (flt && flt.hidden && flt.hidden.length) parts.push(flt.hidden.length + ' hidden');
        if (flt && flt.label) parts.push(LABEL_WORDS[flt.label.op].toLowerCase());
        if (flt && flt.value) parts.push('value ' + flt.value.op);
        if (flt && flt.top) parts.push((flt.top.bottom ? 'bottom ' : 'top ') + flt.top.n);
        return parts.length ? parts.join(', ') : 'Showing all';
    };

    const addCalculated = () => {
        const name = newCalc.name.trim(), formula = newCalc.formula.trim();
        if (!name || !formula) { onError('A calculated field needs a name and a formula'); return; }
        if (data.fields.includes(name) || calculated.some((c) => c.name === name)) { onError('There is already a field called "' + name + '"'); return; }
        try { parseCalculated(formula); } catch (err) { onError(err.message); return; }
        change({ calculated: calculated.concat([{ name, formula }]), values: values.concat([{ field: name }]) });
        setNewCalc({ name: '', formula: '' });
    };

    return (
        <aside className="ks-panel ks-pivot" aria-label="Pivot table editor">
            <div className="ks-panel-head">
                <h2 className="ks-panel-title">Pivot table editor</h2>
                <button type="button" className="ks-tool" aria-label="Close" title="Close" onClick={onClose}>✕</button>
            </div>
            <label className="ks-field ks-field-stack"><span>Data range</span>
                <input aria-label="Data range" defaultValue={p.source} key={p.source}
                    onBlur={(e) => { if (e.target.value.trim() !== p.source) { try { wb.setPivot(s, id, { source: e.target.value.trim() }, how); } catch (err) { onError(err.message); } } }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
            </label>
            {data.fields.length ? null : <p className="ks-panel-help ks-problem">The data range has no fields: its first row names them.</p>}
            {groups('Rows', 'rows', rows)}
            {groups('Columns', 'columns', cols)}
            <section className="ks-pivot-section" aria-label="Values">
                <h3>Values</h3>
                {values.map((v, i) => {
                    const isCalc = calculated.some((c) => c.name === v.field);
                    return (
                        <div key={i} className="ks-pivot-item">
                            <b title={v.field}>{valueTitle(v)}</b>
                            <button type="button" className="ks-tool" aria-label={'Remove ' + v.field + ' from Values'} title="Remove" onClick={() => change({ values: values.filter((x, j) => j !== i) })}>✕</button>
                            <div className="ks-pivot-opts">
                                {isCalc ? <span className="ks-pivot-note">Calculated</span> : (
                                    <select aria-label={'Summarise ' + v.field + ' by'} value={String(v.fn || 'SUM').toUpperCase()} onChange={(e) => setValue(i, { fn: e.target.value })}>
                                        {FUNCTIONS.map((fn) => <option key={fn} value={fn}>{fn}</option>)}
                                    </select>
                                )}
                                <select aria-label={'Show ' + v.field + ' as'} value={v.show || ''} onChange={(e) => setValue(i, { show: e.target.value || null, base: WALKS.has(e.target.value) ? v.base : null })}>
                                    {SHOW_AS.map(([key, words]) => <option key={key} value={key}>{words}</option>)}
                                </select>
                                {v.show && WALKS.has(v.show) && rows.length + cols.length ? (
                                    <select aria-label={'Base field of ' + v.field} value={v.base || ''} onChange={(e) => setValue(i, { base: e.target.value || null })}>
                                        <option value="">along {rows[rows.length - 1] || cols[0]}</option>
                                        {[...rows, ...cols].map((f) => <option key={f} value={f}>along {f}</option>)}
                                    </select>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
                <select className="ks-pivot-add" aria-label="Add to Values" value="" onChange={(e) => { if (e.target.value) change({ values: values.concat([{ field: e.target.value, fn: 'SUM' }]) }); }}>
                    <option value="">Add…</option>
                    {data.fields.map((f) => <option key={f} value={f}>{f}</option>)}
                    {calculated.map((c) => <option key={'calc:' + c.name} value={c.name}>{c.name} (calculated)</option>)}
                </select>
            </section>
            <section className="ks-pivot-section" aria-label="Calculated fields">
                <h3>Calculated fields</h3>
                {calculated.map((c) => (
                    <div key={c.name} className="ks-pivot-item">
                        <b>{c.name}</b>
                        <button type="button" className="ks-tool" aria-label={'Remove calculated field ' + c.name} title="Remove"
                            onClick={() => change({ calculated: clean(calculated.filter((x) => x.name !== c.name)), values: values.filter((v) => v.field !== c.name) })}>✕</button>
                        <div className="ks-pivot-opts">
                            <Entry label={'Formula of ' + c.name} value={c.formula}
                                onApply={(t) => { try { parseCalculated(t); change({ calculated: calculated.map((x) => (x.name === c.name ? { ...x, formula: t.trim() } : x)) }); } catch (err) { onError(err.message); } }} />
                        </div>
                    </div>
                ))}
                <div className="ks-pivot-opts">
                    <input aria-label="New calculated field name" placeholder="Name" value={newCalc.name} onChange={(e) => setNewCalc({ ...newCalc, name: e.target.value })} />
                    <input aria-label="New calculated field formula" placeholder="= Margin / Revenue" value={newCalc.formula}
                        onChange={(e) => setNewCalc({ ...newCalc, formula: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') addCalculated(); }} />
                    <button type="button" className="ks-button" onClick={addCalculated}>Add</button>
                </div>
                <p className="ks-panel-help">Each field stands for its sum. Names with spaces go in [brackets].</p>
            </section>
            <section className="ks-pivot-section" aria-label="Filters">
                <h3>Filters</h3>
                {Object.keys(filters).map((f) => {
                    const flt = filters[f] || {};
                    const hidden = new Set(flt.hidden || []);
                    const shown = [...new Set(data.records.map((r) => (r[f] === null || r[f] === undefined ? '' : r[f])))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
                    const flip = (v) => { const next = new Set(hidden); if (next.has(v)) next.delete(v); else next.add(v); setFilter(f, { hidden: next.size ? [...next] : null }); };
                    return (
                        <div key={f} className="ks-pivot-filter">
                            <div className="ks-pivot-item">
                                <b>{f}</b>
                                <button type="button" className="ks-button" onClick={() => setOpenFilter(openFilter === f ? null : f)}>{filterSummary(flt)}</button>
                                <button type="button" className="ks-tool" aria-label={'Remove filter ' + f} title="Remove" onClick={() => { const next = { ...filters }; delete next[f]; change({ filters: next }); }}>✕</button>
                            </div>
                            {openFilter === f ? (
                                <>
                                    {conditions(f)}
                                    <ul className="ks-filter-values">
                                        {shown.map((v) => <li key={String(v)}><label><input type="checkbox" checked={!hidden.has(v)} onChange={() => flip(v)} /><span className="ks-filter-value">{v === '' ? '(blank)' : String(v)}</span></label></li>)}
                                    </ul>
                                </>
                            ) : null}
                        </div>
                    );
                })}
                <select className="ks-pivot-add" aria-label="Add a filter" value="" onChange={(e) => { if (e.target.value) { change({ filters: { ...filters, [e.target.value]: {} } }); setOpenFilter(e.target.value); } }}>
                    <option value="">Add…</option>
                    {data.fields.filter((f) => !filters[f]).map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
            </section>
            <label className="ks-check-row"><input type="checkbox" checked={spec.totals !== false} onChange={(e) => change({ totals: e.target.checked })} /> Show totals</label>
            <div className="ks-dialog-actions">
                <button type="button" className="ks-button" onClick={() => { wb.removePivot(s, id, how); onClose(); }}><Icon name="trash" /> Remove pivot table</button>
            </div>
        </aside>
    );
}

// An object without its parts that are null or undefined (a value without a `show`, a filter without a condition), and a list left empty as undefined:
// what is not set is not saved.
function clean(x) {
    if (Array.isArray(x)) return x.length ? x : undefined;
    const out = {};
    for (const [k, v] of Object.entries(x)) if (v !== null && v !== undefined) out[k] = v;
    return out;
}
