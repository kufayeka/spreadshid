import { useState, useEffect } from 'react';
import { PALETTE } from './draw.js';

// the kinds of chart, as the panel offers them, each with a small picture of itself
const TYPES = [
    ['column', 'Column', 'M4 20V11h4v9zm6 0V5h4v15zm6 0v-7h4v7z'],
    ['bar', 'Bar', 'M3 4h14v4H3zm0 6h18v4H3zm0 6h9v4H3z'],
    ['line', 'Line', 'M3 17l6-6 4 3 8-8'],
    ['area', 'Area', 'M3 20V15l6-6 4 3 8-7v15z'],
    ['combo', 'Combo', 'M4 20v-7h3v7zm6 0V9h3v11zm6 0v-5h3v5zM3 9l6-4 5 3 7-5'],
    ['pie', 'Pie', 'M12 3a9 9 0 1 0 9 9h-9z'],
    ['donut', 'Donut', 'M12 3a9 9 0 1 0 9 9h-4a5 5 0 1 1-5-5z'],
    ['bullet', 'Bullet', 'M3 6h12v4H3zm0 8h16v4H3zM17 4v8M21 12v8'],
    ['waterfall', 'Waterfall', 'M3 20V6h4v14zm5-14h4v6H8zm5 6h4v4h-4zm5 4h3v4h-3z']
];
const STROKED = new Set(['line', 'combo', 'bullet']);

// a text field that changes the chart when Enter is pressed or the field is left, not at every key
function Field({ label, value, onApply, placeholder, width }) {
    const [text, setText] = useState(value ?? '');
    useEffect(() => { setText(value ?? ''); }, [value]);
    const apply = () => { if (String(text) !== String(value ?? '')) onApply(text); };
    return (
        <label className="ks-field-stack" style={width ? { width } : undefined}>
            <span>{label}</span>
            <input className="ks-panel-input" value={text} placeholder={placeholder} aria-label={label}
                onChange={(e) => setText(e.target.value)} onBlur={apply} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }} />
        </label>
    );
}
function Toggle({ label, on, onChange }) {
    return (
        <label className="ks-chart-toggle">
            <span>{label}</span>
            <input type="checkbox" role="switch" checked={!!on} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
        </label>
    );
}
const numOrUndefined = (t) => (String(t).trim() === '' ? undefined : Number(String(t).replace(',', '.')));

/**
 * The editor of the selected chart, in the panel on the right of the grid: its kind, its data (the range, the series from its columns or rows,
 * each series' name, colour, kind, axis and line), and how it looks (title, legend, labels, stacked, gridlines, smooth, transparent, laid over its
 * cells, the value axis). Every change is one change of the workbook (setChart), undone as any other.
 *
 * @param {object} props
 * @param {any} props.workbook @param {string} props.sheetId @param {string} props.id
 * @param {number} props.revision
 * @param {(message: string) => void} props.onError
 * @param {() => void} props.onClose
 */
export function ChartPanel({ workbook: wb, sheetId, id, revision, onError, onClose }) {
    void revision;
    const chart = wb.charts(sheetId).find((c) => c.id === id);
    if (!chart) return null;
    let model;
    try { model = wb.chartData(sheetId, id); } catch (err) { model = { series: [] }; }
    const set = (patch) => { try { wb.setChart(sheetId, id, patch, { source: 'user' }); } catch (err) { onError(err.message[0].toUpperCase() + err.message.slice(1)); } };
    // a change to one series: the chart keeps a list of the series' own settings, by their place in the data
    const setSeries = (i, patch) => {
        const list = (chart.series || []).slice();
        while (list.length <= i) list.push({});
        list[i] = { ...list[i], ...patch };
        for (const k of Object.keys(list[i])) if (list[i][k] === undefined || list[i][k] === '' || list[i][k] === false) delete list[i][k];
        set({ series: list });
    };
    const onAxes = !['pie', 'donut'].includes(chart.type);
    const y = chart.y || {};

    return (
        <aside className="ks-panel ks-chart-panel" aria-label="Chart editor">
            <div className="ks-panel-head">
                <h2 className="ks-panel-title">Chart</h2>
                <button type="button" className="ks-tool" aria-label="Close" title="Close" onClick={onClose}>✕</button>
            </div>

            <div className="ks-chart-sec">Type</div>
            <div className="ks-chart-types" role="radiogroup" aria-label="Chart type">
                {TYPES.map(([value, label, d]) => (
                    <button key={value} type="button" role="radio" aria-checked={chart.type === value} className={'ks-chart-type' + (chart.type === value ? ' ks-on' : '')}
                        onClick={() => set({ type: value })} title={label}>
                        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                            <path d={d} fill={STROKED.has(value) && value !== 'combo' ? 'none' : 'currentColor'} stroke={STROKED.has(value) ? 'currentColor' : 'none'} strokeWidth="2" />
                        </svg>
                        <span>{label}</span>
                    </button>
                ))}
            </div>

            <div className="ks-chart-sec">Data</div>
            <Field label="Range" value={chart.dataText || ''} onApply={(v) => set({ data: v })} placeholder="A1:D7" />
            <label className="ks-field-stack">
                <span>Series from</span>
                <select aria-label="Series from" value={chart.seriesIn || 'auto'} onChange={(e) => set({ seriesIn: e.target.value })}>
                    <option value="auto">Automatic</option><option value="cols">Columns</option><option value="rows">Rows</option>
                </select>
            </label>
            <ol className="ks-chart-series">
                {model.series.map((s, i) => (
                    <li key={i}>
                        <input type="color" aria-label={'Colour of ' + s.name} value={s.color || (chart.colors && chart.colors[i]) || PALETTE[i % PALETTE.length]}
                            onChange={(e) => setSeries(i, { color: e.target.value })} />
                        <Field label={'Series ' + (i + 1)} value={s.name} onApply={(v) => setSeries(i, { name: v || undefined })} />
                        {chart.type === 'combo' || chart.type === 'line' || chart.type === 'column' ? (
                            <select aria-label={'Kind of ' + s.name} value={s.type || ''} onChange={(e) => setSeries(i, { type: e.target.value || undefined })}>
                                <option value="">{chart.type === 'line' ? 'Line' : 'Column'}</option><option value="line">Line</option><option value="column">Column</option><option value="area">Area</option>
                            </select>
                        ) : null}
                        {onAxes && chart.type !== 'bullet' && chart.type !== 'waterfall' ? (
                            <span className="ks-chart-series-flags">
                                <label><input type="checkbox" checked={s.axis === 'right'} onChange={(e) => setSeries(i, { axis: e.target.checked ? 'right' : undefined })} /> Right axis</label>
                                <label><input type="checkbox" checked={!!s.dash} onChange={(e) => setSeries(i, { dash: e.target.checked || undefined })} /> Dashed</label>
                                <label><input type="checkbox" checked={!!s.hidden} onChange={(e) => setSeries(i, { hidden: e.target.checked || undefined })} /> Hide</label>
                            </span>
                        ) : null}
                    </li>
                ))}
            </ol>

            <div className="ks-chart-sec">Look</div>
            <Field label="Title" value={chart.title || ''} onApply={(v) => set({ title: v })} />
            <Field label="Subtitle" value={chart.subtitle || ''} onApply={(v) => set({ subtitle: v })} />
            <label className="ks-field-stack">
                <span>Legend</span>
                <select aria-label="Legend" value={chart.legend || 'top'} onChange={(e) => set({ legend: e.target.value })}>
                    <option value="top">Top</option><option value="right">Right</option><option value="bottom">Bottom</option><option value="none">Off</option>
                </select>
            </label>
            <Toggle label="Data labels" on={chart.labels} onChange={(v) => set({ labels: v })} />
            {onAxes ? <Toggle label="Stacked" on={chart.stacked} onChange={(v) => set({ stacked: v })} /> : null}
            {onAxes ? <Toggle label="Gridlines" on={chart.grid !== false} onChange={(v) => set({ grid: v })} /> : null}
            {onAxes ? <Toggle label="Smooth lines" on={chart.smooth} onChange={(v) => set({ smooth: v })} /> : null}
            {onAxes ? <Toggle label="Markers" on={chart.markers !== false} onChange={(v) => set({ markers: v })} /> : null}
            <Toggle label="Transparent (over the cells)" on={chart.background === 'none'} onChange={(v) => set({ background: v ? 'none' : 'white' })} />
            {onAxes ? <Toggle label="Points on the middle of each column" on={chart.align === 'cells'} onChange={(v) => set({ align: v ? 'cells' : 'fit' })} /> : null}

            {onAxes ? (
                <>
                    <div className="ks-chart-sec">Value axis</div>
                    <div className="ks-chart-row">
                        <Field label="Min" width={70} value={y.min ?? ''} onApply={(v) => set({ y: { ...y, min: numOrUndefined(v) } })} placeholder="auto" />
                        <Field label="Max" width={70} value={y.max ?? ''} onApply={(v) => set({ y: { ...y, max: numOrUndefined(v) } })} placeholder="auto" />
                        <Field label="After" width={70} value={y.suffix ?? ''} onApply={(v) => set({ y: { ...y, suffix: v || undefined } })} placeholder="%" />
                    </div>
                    <Toggle label="Show the value axis" on={chart.yAxis !== false} onChange={(v) => set({ yAxis: v })} />
                    <Toggle label="Show the categories" on={chart.xAxis !== false} onChange={(v) => set({ xAxis: v })} />
                </>
            ) : null}
            {chart.type === 'bullet' ? (
                <div className="ks-chart-row">
                    <Field label="Amber below by" width={110} value={chart.warn ?? 1} onApply={(v) => set({ warn: numOrUndefined(v) })} />
                    <Field label="Red below by" width={110} value={chart.bad ?? 5} onApply={(v) => set({ bad: numOrUndefined(v) })} />
                </div>
            ) : null}
            {chart.type === 'waterfall' ? (
                <Field label="Totals (category numbers, from 1)" value={(chart.totals || [0]).map((x) => x + 1).join(', ')}
                    onApply={(v) => set({ totals: String(v).split(/[,;\s]+/).filter(Boolean).map((x) => Number(x) - 1).filter((x) => x >= 0) })} />
            ) : null}

            <div className="ks-dialog-actions" style={{ marginTop: 8 }}>
                <button type="button" className="ks-button" onClick={() => { try { wb.removeChart(sheetId, id, { source: 'user' }); onClose(); } catch (err) { onError(err.message); } }}>Delete chart</button>
            </div>
        </aside>
    );
}
