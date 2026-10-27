import { useId, useMemo, useState } from 'react';
import * as popover from '@zag-js/popover';
import { useMachine, normalizeProps, Portal } from '@zag-js/react';
import { colName } from '../core/formula/address.js';
import { OPS, DAYS, DATE_OPS, takesValue, conditionOf, conditionDraft } from './conditions.js';

// a list of values longer than this shows its first ones: typing in the search finds the others (a column of 100 000 different values stays quick)
const MAX_SHOWN = 500;

/**
 * The menu of a column of the filter, as in Google Sheets: sort the filter's rows by the column, filter by condition, filter by values (a search, Select
 * all, Clear, a box for each value; an empty cell is "(Blanks)"). OK applies it (the rows are filtered again); Cancel or Escape leaves it as it was.
 *
 * @param {object} props
 * @param {any} props.workbook @param {string} props.sheetId
 * @param {number} props.c  The column, by its index.
 * @param {{ x: number, y: number }} props.at  Where it opens (window pixels): under the column's button.
 * @param {(dir: 'asc'|'desc') => void} props.onSort
 * @param {(message: string) => void} props.onError
 * @param {() => void} props.onClose
 * @param {import('react').RefObject<HTMLElement>} props.container
 */
export function FilterMenu({ workbook: wb, sheetId: s, c, at, onSort, onError, onClose, container }) {
    const service = useMachine(popover.machine, {
        id: useId(), open: true, modal: false,
        positioning: { placement: 'bottom-end', gutter: 2, strategy: 'fixed', getAnchorRect: () => ({ x: at.x, y: at.y, width: 20, height: 0 }) },
        onOpenChange: (d) => { if (!d.open) onClose(); }
    });
    const api = popover.connect(service, normalizeProps);
    const filter = wb.filterOf(s);
    const crit = (filter && filter.columns[c]) || null;
    const values = useMemo(() => wb.filterValues(s, c), [wb, s, c]);
    const [hidden, setHidden] = useState(() => new Set(crit && crit.hidden ? crit.hidden : []));
    const [search, setSearch] = useState('');
    const [byCondition, setByCondition] = useState(!!(crit && crit.op));
    const [byValues, setByValues] = useState(true);
    const [cond, setCond] = useState(() => ({ ...conditionDraft(wb, crit, crit && crit.formula), op: crit && crit.op ? crit.op : 'none' }));
    const [problem, setProblem] = useState('');

    const wanted = search.trim().toLowerCase();
    const matching = wanted ? values.filter((v) => (v.text || '(Blanks)').toLowerCase().includes(wanted)) : values;
    const shown = matching.slice(0, MAX_SHOWN);
    // Select all and Clear act on what the search shows, as in Google Sheets
    const selectAll = () => setHidden((h) => { const next = new Set(h); for (const v of matching) next.delete(v.text); return next; });
    const clear = () => setHidden((h) => { const next = new Set(h); for (const v of matching) next.add(v.text); return next; });
    const flip = (text) => setHidden((h) => { const next = new Set(h); if (next.has(text)) next.delete(text); else next.add(text); return next; });

    function ok() {
        const out = {};
        if (hidden.size) out.hidden = [...hidden];
        if (cond.op !== 'none') {
            const condition = conditionOf(wb, cond);
            if (typeof condition === 'string') { setProblem(condition); return; }
            Object.assign(out, condition);
        }
        try { wb.setFilterColumn(s, c, Object.keys(out).length ? out : null, { source: 'user' }); } catch (err) { onError(err.message); }
        onClose();
    }

    return (
        <Portal container={container}>
            <div {...api.getPositionerProps()} className="ks-pop-positioner">
                <div {...api.getContentProps()} className="ks-filter-menu" aria-label={'Filter column ' + colName(c)}>
                    <button type="button" className="ks-filter-item" onClick={() => { onSort('asc'); onClose(); }}>Sort A → Z</button>
                    <button type="button" className="ks-filter-item" onClick={() => { onSort('desc'); onClose(); }}>Sort Z → A</button>
                    <hr className="ks-filter-line" />

                    <button type="button" className="ks-filter-section" aria-expanded={byCondition} onClick={() => setByCondition(!byCondition)}>{byCondition ? '▾' : '▸'} Filter by condition</button>
                    {byCondition ? (
                        <div className="ks-filter-body">
                            <select aria-label="Condition" value={cond.op} onChange={(e) => setCond({ ...cond, op: e.target.value })}>
                                <option value="none">None</option>
                                {OPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                            {cond.op === 'formula' ? <input aria-label="Custom formula" value={cond.formula} placeholder={'=' + colName(c) + (filter.range.r1 + 2) + '>100'} onChange={(e) => setCond({ ...cond, formula: e.target.value })} /> : null}
                            {DATE_OPS.has(cond.op) ? <select aria-label="Date" value={cond.day} onChange={(e) => setCond({ ...cond, day: e.target.value })}>{DAYS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select> : null}
                            {DATE_OPS.has(cond.op) && cond.day === 'exact' ? <input aria-label="Exact date" value={cond.a} onChange={(e) => setCond({ ...cond, a: e.target.value })} /> : null}
                            {cond.op !== 'none' && takesValue(cond.op) ? <input aria-label="Value" value={cond.a} placeholder="Value" onChange={(e) => setCond({ ...cond, a: e.target.value })} /> : null}
                            {cond.op === 'between' || cond.op === 'notBetween' ? <input aria-label="And" value={cond.b} placeholder="And" onChange={(e) => setCond({ ...cond, b: e.target.value })} /> : null}
                        </div>
                    ) : null}

                    <button type="button" className="ks-filter-section" aria-expanded={byValues} onClick={() => setByValues(!byValues)}>{byValues ? '▾' : '▸'} Filter by values</button>
                    {byValues ? (
                        <div className="ks-filter-body">
                            <div className="ks-filter-links">
                                <button type="button" onClick={selectAll}>Select all</button><span>·</span><button type="button" onClick={clear}>Clear</button>
                                <span className="ks-filter-count">{values.length - [...hidden].filter((t) => values.some((v) => v.text === t)).length} of {values.length}</span>
                            </div>
                            <input aria-label="Search values" value={search} placeholder="Search" onChange={(e) => setSearch(e.target.value)} />
                            <ul className="ks-filter-values" role="listbox" aria-label="Values">
                                {shown.map((v) => (
                                    <li key={v.text}>
                                        <label><input type="checkbox" checked={!hidden.has(v.text)} onChange={() => flip(v.text)} /><span className="ks-filter-value">{v.text === '' ? '(Blanks)' : v.text}</span><span className="ks-filter-n">{v.count}</span></label>
                                    </li>
                                ))}
                            </ul>
                            {matching.length > MAX_SHOWN ? <p className="ks-panel-help">The first {MAX_SHOWN} of {matching.length}: search to find the others.</p> : null}
                        </div>
                    ) : null}

                    <p className="ks-dialog-status ks-problem" aria-live="polite">{problem}</p>
                    <div className="ks-dialog-actions">
                        <span style={{ flex: 1 }} />
                        <button type="button" className="ks-button" onClick={onClose}>Cancel</button>
                        <button type="button" className="ks-button ks-primary" onClick={ok}>OK</button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
