import { useId, useMemo, useState } from 'react';
import * as dialog from '@zag-js/dialog';
import { useMachine, normalizeProps, Portal } from '@zag-js/react';
import { Icon } from './icons.js';
import { tableOf, PIVOT_FUNCTIONS } from '../core/pivot.js';

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

/**
 * The editor of a pivot table, in the panel on the right of the grid (it opens when a cell of the table is selected), as in Google Sheets: its data
 * range, its Rows, Columns and Values (a field and how it is summed), Filters (the values left out), the totals, and Remove. Every change is written at
 * once (one change, undone at once).
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
    const rows = spec.rows || [], cols = spec.columns || [], values = spec.values || [], filters = spec.filters || {};
    const unused = (list) => data.fields.filter((f) => !list.includes(f));
    // the order of a field's groups: by their names ('asc' | 'desc'), or by a value ({ by, dir }: the biggest totals first)
    const sortOf = (f) => (spec.sort && spec.sort[f]) || 'asc';
    const dirOf = (f) => { const h = sortOf(f); return (typeof h === 'object' ? h.dir : h) || 'asc'; };
    const byOf = (f) => { const h = sortOf(f); return typeof h === 'object' && h.by ? h.by : ''; };
    const setSort = (f, dir, by) => change({ sort: { ...(spec.sort || {}), [f]: by ? { by, dir } : dir } });
    // dates put together by year, quarter, month or week: offered for a field that holds numbers (a date is a day number)
    const holdsNumbers = (f) => data.records.some((r) => typeof r[f] === 'number');
    const groupOf = (f) => (spec.group && spec.group[f]) || '';
    const setGroup = (f, unit) => {
        const next = { ...(spec.group || {}) };
        if (unit) next[f] = unit; else delete next[f];
        change({ group: Object.keys(next).length ? next : undefined });
    };

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
                            {values.map((v) => <option key={v.as || v.field} value={v.as || v.field}>by {v.as || String(v.fn || 'SUM').toUpperCase() + ' of ' + v.field}</option>)}
                        </select>
                        {holdsNumbers(f) || groupOf(f) ? (
                            <select aria-label={'Group ' + f} value={groupOf(f)} onChange={(e) => setGroup(f, e.target.value)}>
                                <option value="">No date groups</option><option value="year">Year</option><option value="quarter">Quarter</option>
                                <option value="month">Month</option><option value="week">Week</option>
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
                {values.map((v, i) => (
                    <div key={i} className="ks-pivot-item">
                        <b>{v.field}</b>
                        <select aria-label={'Summarise ' + v.field + ' by'} value={String(v.fn || 'SUM').toUpperCase()}
                            onChange={(e) => change({ values: values.map((x, j) => (j === i ? { ...x, fn: e.target.value } : x)) })}>
                            {FUNCTIONS.map((fn) => <option key={fn} value={fn}>{fn}</option>)}
                        </select>
                        <button type="button" className="ks-tool" aria-label={'Remove ' + v.field + ' from Values'} title="Remove" onClick={() => change({ values: values.filter((x, j) => j !== i) })}>✕</button>
                    </div>
                ))}
                <select className="ks-pivot-add" aria-label="Add to Values" value="" onChange={(e) => { if (e.target.value) change({ values: values.concat([{ field: e.target.value, fn: 'SUM' }]) }); }}>
                    <option value="">Add…</option>
                    {data.fields.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
            </section>
            <section className="ks-pivot-section" aria-label="Filters">
                <h3>Filters</h3>
                {Object.keys(filters).map((f) => {
                    const hidden = new Set((filters[f] && filters[f].hidden) || []);
                    const shown = [...new Set(data.records.map((r) => (r[f] === null || r[f] === undefined ? '' : r[f])))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
                    const flip = (v) => { const next = new Set(hidden); if (next.has(v)) next.delete(v); else next.add(v); change({ filters: { ...filters, [f]: { hidden: [...next] } } }); };
                    return (
                        <div key={f} className="ks-pivot-filter">
                            <div className="ks-pivot-item">
                                <b>{f}</b>
                                <button type="button" className="ks-button" onClick={() => setOpenFilter(openFilter === f ? null : f)}>{hidden.size ? hidden.size + ' hidden' : 'Showing all'}</button>
                                <button type="button" className="ks-tool" aria-label={'Remove filter ' + f} title="Remove" onClick={() => { const next = { ...filters }; delete next[f]; change({ filters: next }); }}>✕</button>
                            </div>
                            {openFilter === f ? (
                                <ul className="ks-filter-values">
                                    {shown.map((v) => <li key={String(v)}><label><input type="checkbox" checked={!hidden.has(v)} onChange={() => flip(v)} /><span className="ks-filter-value">{v === '' ? '(blank)' : String(v)}</span></label></li>)}
                                </ul>
                            ) : null}
                        </div>
                    );
                })}
                <select className="ks-pivot-add" aria-label="Add a filter" value="" onChange={(e) => { if (e.target.value) { change({ filters: { ...filters, [e.target.value]: { hidden: [] } } }); setOpenFilter(e.target.value); } }}>
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
