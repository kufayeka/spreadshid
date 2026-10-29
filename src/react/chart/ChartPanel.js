import { useState, useEffect } from 'react';
import { PALETTE } from './draw.js';
import { CHART_FIELDS, SPARKLINE_FIELDS, NODES, isFor, fieldsOf, valueAt, patchFor } from '../../core/chart-fields.js';

// the kinds of chart, as the editor offers them, each with a small picture of itself (a path in a 24 x 24 box; `line` paths are stroked)
const TYPES = [
    ['column', 'Column', 'M4 20V11h4v9zm6 0V5h4v15zm6 0v-7h4v7z'],
    ['bar', 'Bar', 'M3 4h14v4H3zm0 6h18v4H3zm0 6h9v4H3z'],
    ['line', 'Line', 'M3 17l6-6 4 3 8-8', true],
    ['area', 'Area', 'M3 20V15l6-6 4 3 8-7v15z'],
    ['combo', 'Combo', 'M4 20v-7h3v7zm6 0V9h3v11zm6 0v-5h3v5z'],
    ['scatter', 'Scatter', 'M5 17a1.6 1.6 0 1 0 0 .1zM9 11a1.6 1.6 0 1 0 0 .1zM13 14a1.6 1.6 0 1 0 0 .1zM17 7a1.6 1.6 0 1 0 0 .1zM20 10a1.6 1.6 0 1 0 0 .1z'],
    ['pie', 'Pie', 'M12 3a9 9 0 1 0 9 9h-9z'],
    ['donut', 'Donut', 'M12 3a9 9 0 1 0 9 9h-4a5 5 0 1 1-5-5z'],
    ['bullet', 'Bullet', 'M3 6h12v4H3zm0 8h16v4H3z'],
    ['waterfall', 'Waterfall', 'M3 20V6h4v14zm5-14h4v6H8zm5 6h4v4h-4zm5 4h3v4h-3z']
];
// the quick colours of a colour field: the first of Carbon's palette, the rest behind "More"
const QUICK = PALETTE.slice(0, 6);

// the style of a chart copied by ⧉, to put on another chart: everything but where it stands and what it reads
let copied = null;
const STYLE_SKIP = new Set(['id', 'at', 'atText', 'data', 'dataText', 'dataAt', 'categories']);
function styleOf(chart) {
    const out = {};
    for (const [k, v] of Object.entries(chart)) if (!STYLE_SKIP.has(k)) out[k] = v;
    // a series keeps its look, not its ranges
    if (chart.series) out.series = chart.series.map((s) => { const o = { ...s }; delete o.values; delete o.x; delete o.nameFrom; return o; });
    return out;
}

// ---- the fields --------------------------------------------------------------------------------------------------------------------------------

// a text, number or range field: it changes the chart when Enter is pressed or the field is left, not at every key
function TextField({ field, value, onApply, onPick, readOnly }) {
    const shown = value === undefined || value === null ? '' : String(value);
    const [text, setText] = useState(shown);
    useEffect(() => { setText(shown); }, [shown]);
    const apply = () => {
        if (text === shown) return;
        if (field.kind === 'number') { const n = text.trim() === '' ? undefined : Number(text.replace(',', '.')); onApply(Number.isFinite(n) ? n : undefined); }
        else onApply(text.trim() === '' ? undefined : text);
    };
    return (
        <span className="ks-ins-input">
            <input value={text} aria-label={field.label} placeholder={field.placeholder || ''} readOnly={readOnly}
                onChange={(e) => setText(e.target.value)} onBlur={apply} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); e.currentTarget.blur(); } }} />
            {field.unit ? <span className="ks-ins-unit">{field.unit}</span> : null}
            {field.kind === 'range' && onPick && !readOnly ? <button type="button" className="ks-ins-pick" title="Pick the cells in the grid" aria-label={'Pick ' + field.label} onClick={() => onPick((t) => onApply(t))}>⊞</button> : null}
        </span>
    );
}
function ColorField({ field, value, fallback, onApply }) {
    const now = value || fallback;
    return (
        <span className="ks-ins-colors" role="group" aria-label={field.label}>
            {QUICK.map((c) => <button key={c} type="button" className={'ks-ins-swatch' + (now && now.toLowerCase() === c ? ' ks-on' : '')} style={{ background: c }} aria-label={c} title={c} onClick={() => onApply(c)} />)}
            <label className="ks-ins-more" title="More colours">More<input type="color" aria-label={field.label + ' (any colour)'} value={now || '#6929c4'} onChange={(e) => onApply(e.target.value)} /></label>
            {value ? <button type="button" className="ks-ins-clear" title="Back to the default" aria-label={'Reset ' + field.label} onClick={() => onApply(undefined)}>↺</button> : null}
        </span>
    );
}
function Segment({ field, value, onApply }) {
    const now = value === undefined || value === null ? field.options[0][0] : value;
    return (
        <span className="ks-ins-seg" role="radiogroup" aria-label={field.label}>
            {field.options.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={now === v} className={now === v ? 'ks-on' : ''} onClick={() => onApply(v === '' ? undefined : v)}>{l}</button>)}
        </span>
    );
}
function Toggle({ field, value, onApply }) {
    const on = value === undefined ? !!field.default : !!value;
    return <input type="checkbox" role="switch" className="ks-ins-switch" aria-label={field.label} checked={on} onChange={(e) => onApply(e.target.checked === !!field.default ? undefined : e.target.checked)} />;
}

/** One field of the inspector, by its kind. */
function FieldRow({ field, value, onApply, onPick, extra }) {
    let input;
    if (field.kind === 'color') input = <ColorField field={field} value={value} fallback={extra && extra.fallback} onApply={onApply} />;
    else if (field.kind === 'segment') input = <Segment field={field} value={value} onApply={onApply} />;
    else if (field.kind === 'toggle') input = <Toggle field={field} value={value} onApply={onApply} />;
    else if (field.kind === 'totals') input = <TextField field={field} value={(value || [0]).map((x) => x + 1).join(', ')} onApply={(t) => onApply(String(t || '1').split(/[,;\s]+/).filter(Boolean).map((x) => Number(x) - 1).filter((x) => x >= 0))} />;
    else input = <TextField field={field} value={value} onApply={onApply} onPick={onPick} readOnly={extra && extra.readOnly} />;
    return (
        <div className={'ks-ins-row' + (field.kind === 'color' || field.kind === 'segment' && field.options.length > 3 ? ' ks-ins-wide' : '')} data-key={field.key}>
            <label title={field.help || ''}>{field.label}</label>
            {input}
            {extra && extra.note ? <span className="ks-ins-note">{extra.note}</span> : null}
        </div>
    );
}

// ---- the chart editor ---------------------------------------------------------------------------------------------------------------------------

/**
 * The editor of the selected chart, in the panel on the right of the grid: a tree of what a chart is made of (its kind, its data, each series, its
 * axes, its title and legend, its labels, its place, and what only some kinds have: slices, the donut's center, the bullet's limits, the waterfall's
 * steps), and under it the settings of the node picked in the tree, or picked by a click on the chart itself (a column picks its series, the title
 * its node ...). Every setting of the code is here (props.js; a test holds them together). A colour, a switch or a choice changes the chart at once;
 * a text or a number when Enter is pressed or the field is left. Every change is one change of the workbook, undone as any other.
 *
 * @param {object} props
 * @param {any} props.workbook @param {string} props.sheetId @param {string} props.id
 * @param {string} [props.node]  The node picked ('chart', 'data', 'series:1', 'axes' ...).
 * @param {(node: string) => void} props.onNode
 * @param {(apply: (text: string) => void) => void} props.onPick  A range is picked in the grid: `apply` gets its text.
 * @param {number} props.revision
 * @param {(message: string) => void} props.onError
 * @param {() => void} props.onClose
 */
export function ChartPanel({ workbook: wb, sheetId, id, node = 'chart', onNode, onPick, revision, onError, onClose }) {
    void revision;
    const [, redraw] = useState(0);
    const chart = wb.charts(sheetId).find((c) => c.id === id);
    if (!chart) return null;
    let model;
    try { model = wb.chartData(sheetId, id); } catch (err) { model = { categories: [], series: [], fromBlock: 0 }; }
    const fromBlock = model.fromBlock || 0;
    const set = (patch) => { try { wb.setChart(sheetId, id, patch, { source: 'user' }); } catch (err) { onError(err.message[0].toUpperCase() + err.message.slice(1)); } };
    // the chart's list of series settings: one per series drawn, by its place (the block's first, then those of their own ranges at their `index`)
    const listPlaceOf = (pos) => (pos < fromBlock ? pos : (model.series[pos] ? model.series[pos].index : pos));
    const setSeries = (pos, patch) => {
        const list = (chart.series || []).map((x) => ({ ...x }));
        const at = listPlaceOf(pos);
        while (list.length <= at) list.push({});
        list[at] = { ...list[at], ...patch };
        for (const k of Object.keys(list[at])) if (list[at][k] === undefined) delete list[at][k];
        set({ series: list });
    };
    const type = chart.type;
    const [kind, which] = node.split(':');
    const pos = which === undefined ? -1 : Number(which);
    const nodes = NODES.filter((n) => isFor(n, type));

    // the settings of the node picked
    let body = null;
    if (kind === 'series' && model.series[pos]) {
        const s = model.series[pos];
        const spec = (chart.series || [])[listPlaceOf(pos)] || {};
        const own = pos >= fromBlock;
        body = (
            <>
                <div className="ks-ins-head"><span className="ks-ins-dot" style={{ background: s.color || (chart.colors && chart.colors[pos]) || PALETTE[pos % PALETTE.length] }} />{s.name}</div>
                {/* a series drawn as a line (or an area) in a column chart gets the fields of a line too */}
                {CHART_FIELDS.filter((f) => f.node === 'series' && (isFor(f, type) || (s.type && f.for && f.for.includes(s.type === 'area' ? 'area' : s.type)))
                    && !(f.key === 'series.type' && f.for && !f.for.includes(type))).map((f) => {
                    const k = f.key.slice('series.'.length);
                    // a series of the block takes its values from the block: its range is shown, not changed here
                    const extra = k === 'values' && !own ? { readOnly: true, note: 'from the block (Data)' } : k === 'color' ? { fallback: (chart.colors && chart.colors[pos]) || PALETTE[pos % PALETTE.length] } : null;
                    if ((k === 'values' || k === 'x') && !own && type !== 'scatter') return k === 'values' ? <FieldRow key={f.key + f.for} field={f} value={chart.dataText || ''} extra={extra} onApply={() => {}} /> : null;
                    // the name the series has now (from the block's header or its cell) shows in an empty Name field
                    const shown = k === 'name' ? { ...f, placeholder: s.name } : f;
                    return <FieldRow key={f.key + (f.for || '')} field={shown} value={spec[k]} extra={extra} onPick={onPick} onApply={(v) => setSeries(pos, { [k]: v })} />;
                })}
                <div className="ks-ins-actions">
                    {own ? <button type="button" className="ks-button" onClick={() => { const list = (chart.series || []).filter((_, i) => i !== listPlaceOf(pos)); set({ series: list }); onNode('data'); }}>Remove series</button>
                        : <span className="ks-panel-help">A series of the block: hide it, or change the block in Data.</span>}
                </div>
            </>
        );
    } else if (kind === 'chart') {
        body = (
            <>
                <div className="ks-chart-types" role="radiogroup" aria-label="Chart type">
                    {TYPES.map(([value, label, d, stroked]) => (
                        <button key={value} type="button" role="radio" aria-checked={type === value} className={'ks-chart-type' + (type === value ? ' ks-on' : '')} onClick={() => set({ type: value })} title={label}>
                            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d={d} fill={stroked ? 'none' : 'currentColor'} stroke={stroked ? 'currentColor' : 'none'} strokeWidth="2" /></svg>
                            <span>{label}</span>
                        </button>
                    ))}
                </div>
            </>
        );
    } else {
        const fields = fieldsOf(kind, type);
        let group = null;
        body = (
            <>
                {fields.map((f) => {
                    const head = f.group && f.group !== group ? <div key={'g' + f.group} className="ks-chart-sec">{f.group}</div> : null;
                    group = f.group || group;
                    if (f.kind === 'colors') {
                        // a pie's slices: one colour per category
                        return [head, ...model.categories.map((c, i) => (
                            <FieldRow key={'slice' + i} field={{ key: 'colors', label: c || 'Slice ' + (i + 1), kind: 'color' }} value={chart.colors && chart.colors[i]} extra={{ fallback: PALETTE[i % PALETTE.length] }}
                                onApply={(v) => { const list = (chart.colors || []).slice(); while (list.length <= i) list.push(PALETTE[list.length % PALETTE.length]); list[i] = v || PALETTE[i % PALETTE.length]; set({ colors: list }); }} />
                        ))];
                    }
                    const value = f.key === 'data' ? chart.dataText : f.key === 'at' ? chart.atText : f.key === 'categories' && typeof chart.categories !== 'string' ? '' : valueAt(chart, f.key);
                    return [head, <FieldRow key={f.key} field={f} value={value} onPick={onPick} onApply={(v) => set(f.key === 'data' ? { data: v === undefined ? null : v } : patchFor(chart, f.key, v))} />];
                })}
                {kind === 'data' ? (
                    <div className="ks-ins-actions">
                        <button type="button" className="ks-button" onClick={() => { const list = (chart.series || []).map((x) => ({ ...x })); while (list.length < fromBlock) list.push({}); list.push({ name: 'Series ' + (model.series.length + 1) }); set({ series: list }); onNode('series:' + model.series.length); }}>Add series</button>
                    </div>
                ) : null}
            </>
        );
    }

    return (
        <aside className="ks-panel ks-chart-panel" aria-label="Chart editor">
            <div className="ks-panel-head">
                <h2 className="ks-panel-title">Chart</h2>
                <span>
                    <button type="button" className="ks-tool" title="Copy this chart's style" aria-label="Copy style" onClick={() => { copied = styleOf(chart); redraw((n) => n + 1); }}>⧉</button>
                    {copied ? <button type="button" className="ks-tool" title="Paste the copied style on this chart" aria-label="Paste style" onClick={() => set(copied)}>⎘</button> : null}
                    <button type="button" className="ks-tool" aria-label="Close" title="Close" onClick={onClose}>✕</button>
                </span>
            </div>
            <ul className="ks-ins-tree" role="tree" aria-label="Chart parts">
                {nodes.map((n) => n.id === 'series' ? (
                    <li key="series" role="treeitem" aria-expanded="true">
                        <span className="ks-ins-node ks-ins-group">Series</span>
                        <ul role="group">
                            {model.series.map((s, i) => (
                                <li key={i} role="treeitem" aria-selected={node === 'series:' + i} className={'ks-ins-node ks-ins-leaf' + (node === 'series:' + i ? ' ks-on' : '')} onClick={() => onNode('series:' + i)}>
                                    <span className="ks-ins-dot" style={{ background: s.color || (chart.colors && chart.colors[i]) || PALETTE[i % PALETTE.length] }} />
                                    <span className={s.hidden ? 'ks-ins-off' : ''}>{s.name}</span>
                                    <button type="button" className="ks-ins-eye" aria-label={(s.hidden ? 'Show ' : 'Hide ') + s.name} title={s.hidden ? 'Show' : 'Hide'}
                                        onClick={(e) => { e.stopPropagation(); setSeries(i, { hidden: s.hidden ? undefined : true }); }}>{s.hidden ? '◌' : '●'}</button>
                                </li>
                            ))}
                        </ul>
                    </li>
                ) : (
                    <li key={n.id} role="treeitem" aria-selected={kind === n.id} className={'ks-ins-node' + (kind === n.id ? ' ks-on' : '')} onClick={() => onNode(n.id)}>
                        <span>{n.label}</span>
                        <span className="ks-ins-hint">{n.id === 'chart' ? (TYPES.find((x) => x[0] === type) || [, type])[1] : n.id === 'data' ? (chart.dataText || 'own ranges') : n.id === 'place' ? chart.atText : ''}</span>
                    </li>
                ))}
            </ul>
            <div className="ks-ins-body" aria-label="Settings">{body}</div>
            <div className="ks-dialog-actions">
                <button type="button" className="ks-button" onClick={() => { try { wb.removeChart(sheetId, id, { source: 'user' }); onClose(); } catch (err) { onError(err.message); } }}>Delete chart</button>
            </div>
        </aside>
    );
}

// ---- the sparkline editor ---------------------------------------------------------------------------------------------------------------------

/**
 * The editor of a group of sparklines (opened when a cell of the group is selected): every setting of SparklineSpec.
 * @param {object} props
 * @param {any} props.workbook @param {string} props.sheetId @param {string} props.id
 * @param {(apply: (text: string) => void) => void} props.onPick
 * @param {number} props.revision
 * @param {(message: string) => void} props.onError
 * @param {() => void} props.onClose
 */
export function SparklinePanel({ workbook: wb, sheetId, id, onPick, revision, onError, onClose }) {
    void revision;
    const g = wb.sparklines(sheetId).find((x) => x.id === id);
    if (!g) return null;
    const set = (patch) => { try { wb.setSparkline(sheetId, id, patch, { source: 'user' }); } catch (err) { onError(err.message[0].toUpperCase() + err.message.slice(1)); } };
    return (
        <aside className="ks-panel ks-chart-panel" aria-label="Sparkline editor">
            <div className="ks-panel-head">
                <h2 className="ks-panel-title">Sparklines</h2>
                <button type="button" className="ks-tool" aria-label="Close" title="Close" onClick={onClose}>✕</button>
            </div>
            <div className="ks-ins-body">
                {SPARKLINE_FIELDS.map((f) => (
                    <FieldRow key={f.key} field={f} value={f.key === 'at' ? g.atText : f.key === 'data' ? g.dataText : g[f.key]} onPick={onPick}
                        extra={f.key === 'color' ? { fallback: PALETTE[0] } : f.key === 'negColor' ? { fallback: '#da1e28' } : null}
                        onApply={(v) => { if ((f.key === 'at' || f.key === 'data') && !v) return; set({ [f.key]: v }); }} />
                ))}
            </div>
            <div className="ks-dialog-actions">
                <button type="button" className="ks-button" onClick={() => { try { wb.removeSparkline(sheetId, id, { source: 'user' }); onClose(); } catch (err) { onError(err.message); } }}>Delete sparklines</button>
            </div>
        </aside>
    );
}

export { CHART_FIELDS };
