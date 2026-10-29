import { useState } from 'react';
import { Icon } from './icons.js';
import { ColorPicker } from './ColorPicker.js';
import { rectText } from './FormulaBar.js';
import { parseRangeText } from '../core/validation.js';
import { conditionalRects, conditionalFormulaText } from '../core/conditional.js';
import { OPS, DAYS, DATE_OPS, conditionOf } from './conditions.js';
import { formatValue } from '../core/format.js';

// the styles a new rule starts with and the colour scales to start from, as in Google Sheets
const DEFAULT_STYLE = { fill: '#b7e1cd' };
const SCALES = [
    { min: '#ffffff', max: '#57bb8a' }, { min: '#57bb8a', max: '#ffffff' }, { min: '#ffffff', max: '#e67c73' }, { min: '#e67c73', max: '#ffffff' },
    { min: '#e67c73', mid: '#ffd666', max: '#57bb8a' }, { min: '#57bb8a', mid: '#ffd666', max: '#e67c73' }
];
const POINT_TYPES = [['min', 'Min'], ['max', 'Max'], ['number', 'Number'], ['percent', 'Percent'], ['percentile', 'Percentile']];

/** What a rule says, in words ("Text is exactly late"), for its card in the list. */
function ruleSays(wb, s, rule) {
    if (rule.kind === 'scale') return 'Color scale';
    if (rule.kind === 'bar') return 'Data bar';
    const label = (OPS.find(([v]) => v === rule.op) || [, rule.op])[1];
    if (rule.op === 'formula') return label + ' ' + conditionalFormulaText(wb, s, rule);
    if (rule.op === 'empty' || rule.op === 'notEmpty') return label;
    const shown = (v) => (DATE_OPS.has(rule.op) ? (typeof v === 'number' ? formatValue(v, { type: 'date' }, wb.settings()).text : (DAYS.find(([d]) => d === v) || [, v])[1]) : String(v));
    return label + ' ' + shown(rule.a) + (rule.op === 'between' || rule.op === 'notBetween' ? ' and ' + shown(rule.b) : '');
}

const rangesText = (wb, s, rule) => conditionalRects(wb, s, rule).map(rectText).join(', ');
const sampleStyle = (style) => ({ fontWeight: style.bold ? 'bold' : undefined, fontStyle: style.italic ? 'italic' : undefined, color: style.color || undefined, background: style.fill || undefined,
    textDecoration: [style.underline ? 'underline' : '', style.strike ? 'line-through' : ''].filter(Boolean).join(' ') || undefined });

/** A rule made ready for the editor: texts to type in, as the person sees them. */
function draftOf(wb, s, rule, range) {
    if (!rule) return { id: null, ranges: range, kind: 'single', op: 'notEmpty', a: '', b: '', day: 'today', formula: '', style: { ...DEFAULT_STYLE }, ...scaleDraft(SCALES[0]), barColor: '#6929c4' };
    const show = (v) => (typeof v === 'number' && DATE_OPS.has(rule.op) ? formatValue(v, { type: 'date' }, wb.settings()).text : v === undefined || v === null ? '' : typeof v === 'number' ? formatValue(v, { type: 'general' }, wb.settings()).text : String(v));
    return {
        id: rule.id, ranges: rangesText(wb, s, rule), kind: rule.kind,
        op: rule.op || 'notEmpty', a: typeof rule.a === 'string' && DATE_OPS.has(rule.op) ? '' : show(rule.a), b: show(rule.b),
        day: DATE_OPS.has(rule.op) ? (typeof rule.a === 'number' ? 'exact' : rule.a) : 'today',
        formula: rule.op === 'formula' ? conditionalFormulaText(wb, s, rule) : '', style: { ...(rule.style || DEFAULT_STYLE) },
        ...(rule.kind === 'scale' ? { min: { ...rule.min }, mid: rule.mid ? { ...rule.mid } : null, max: { ...rule.max } } : scaleDraft(SCALES[0])),
        barColor: rule.kind === 'bar' ? rule.color : '#6929c4'
    };
}
function scaleDraft(preset) {
    return { min: { type: 'min', value: '', color: preset.min }, mid: preset.mid ? { type: 'percentile', value: 50, color: preset.mid } : null, max: { type: 'max', value: '', color: preset.max } };
}

/**
 * Conditional formatting (Format menu), as in Google Sheets: a panel on the right of the grid with the rules of the sheet (in order: the first that
 * styles a cell wins), each one opened to change it; a rule is one colour (a style when a condition holds) or a colour scale. Done saves the rule as one
 * change; the sheet shows it at once.
 *
 * @param {object} props
 * @param {any} props.workbook @param {string} props.sheetId
 * @param {string} props.range  The selection when the panel opened ("B2:B20"): where a new rule goes.
 * @param {number} props.revision  So the list is drawn again after a change.
 * @param {() => void} props.onClose
 * @param {import('react').RefObject<HTMLElement>} props.container
 */
export function ConditionalPanel({ workbook: wb, sheetId: s, range, revision, onClose, container }) {
    void revision;
    const rules = wb.conditionals(s);
    // a sheet with no rules opens a new one on the selection at once, as Google Sheets does
    const [draft, setDraft] = useState(() => (rules.length ? null : draftOf(wb, s, null, range)));
    const [problem, setProblem] = useState('');
    const how = { source: 'user' };
    const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
    const setStyle = (k, v) => setDraft((d) => ({ ...d, style: { ...d.style, [k]: v || undefined } }));
    const setPoint = (name, patch) => setDraft((d) => ({ ...d, [name]: { ...d[name], ...patch } }));

    // the texts typed made into a rule (numbers and dates read in the sheet's locale), or a reason it cannot be
    function specOf(d) {
        if (d.kind === 'bar') return { kind: 'bar', color: d.barColor || '#6929c4' };
        if (d.kind === 'scale') {
            const point = (p) => (p ? { type: p.type, color: p.color, ...(p.type === 'min' || p.type === 'max' ? {} : { value: Number(String(p.value).replace(',', '.')) }) } : null);
            for (const p of [d.min, d.mid, d.max]) if (p && !(p.type === 'min' || p.type === 'max') && !Number.isFinite(Number(String(p.value).replace(',', '.')))) return 'Write a number for each point that is not Min or Max';
            return { kind: 'scale', min: point(d.min), mid: point(d.mid), max: point(d.max) };
        }
        const condition = conditionOf(wb, d);
        return typeof condition === 'string' ? condition : { kind: 'single', ...condition, style: d.style };
    }

    function done() {
        const rects = draft.ranges.split(/[,;]/).map((x) => x.trim()).filter(Boolean).map(parseRangeText);
        if (!rects.length || rects.some((b) => !b || b.sheet)) { setProblem('Write ranges of this sheet, for example B2:B200, D2:D200'); return; }
        const spec = specOf(draft);
        if (typeof spec === 'string') { setProblem(spec); return; }
        try {
            if (draft.id) wb.setConditional(s, draft.id, rects, spec, how);
            else wb.addConditional(s, rects, spec, how);
        } catch (err) { setProblem(err.message); return; }
        setProblem('');
        setDraft(null);
    }

    const head = (
        <div className="ks-panel-head">
            <h2 className="ks-panel-title">Conditional format rules</h2>
            <button type="button" className="ks-tool" aria-label="Close" title="Close" onClick={onClose}>✕</button>
        </div>
    );

    if (!draft) {
        return (
            <aside className="ks-panel" aria-label="Conditional format rules">
                {head}
                <ol className="ks-rule-list">
                    {rules.map((rule, i) => (
                        <li key={rule.id} className="ks-rule-card">
                            <button type="button" className="ks-rule-open" onClick={() => { setProblem(''); setDraft(draftOf(wb, s, rule, range)); }}>
                                {rule.kind === 'bar'
                                    ? <span className="ks-rule-sample" style={{ background: 'linear-gradient(90deg,' + rule.color + '55 60%, transparent 60%)' }}>123</span>
                                    : rule.kind === 'scale'
                                    ? <span className="ks-rule-sample" style={{ background: 'linear-gradient(90deg,' + [rule.min.color, rule.mid && rule.mid.color, rule.max.color].filter(Boolean).join(',') + ')' }}>123</span>
                                    : <span className="ks-rule-sample" style={sampleStyle(rule.style || {})}>123</span>}
                                <span className="ks-rule-text"><span className="ks-rule-says">{ruleSays(wb, s, rule)}</span><span className="ks-rule-ranges">{rangesText(wb, s, rule)}</span></span>
                            </button>
                            <span className="ks-rule-tools">
                                <button type="button" className="ks-tool" aria-label="Move up" title="Move up" disabled={i === 0} onClick={() => wb.moveConditional(s, rule.id, i - 1, how)}><Icon name="up" /></button>
                                <button type="button" className="ks-tool" aria-label="Move down" title="Move down" disabled={i === rules.length - 1} onClick={() => wb.moveConditional(s, rule.id, i + 1, how)}><Icon name="drop" /></button>
                                <button type="button" className="ks-tool" aria-label="Delete rule" title="Delete rule" onClick={() => wb.removeConditional(s, rule.id, how)}><Icon name="trash" /></button>
                            </span>
                        </li>
                    ))}
                </ol>
                <button type="button" className="ks-button ks-add-rule" onClick={() => { setProblem(''); setDraft(draftOf(wb, s, null, range)); }}><Icon name="add" /> Add another rule</button>
            </aside>
        );
    }

    const d = draft;
    const needsA = d.op !== 'empty' && d.op !== 'notEmpty' && d.op !== 'formula' && !DATE_OPS.has(d.op);
    const pointRow = (name, label) => {
        const p = d[name];
        return (
            <div className="ks-scale-point" key={name}>
                <span className="ks-scale-label">{label}</span>
                <select aria-label={label + ' point'} value={p.type} onChange={(e) => setPoint(name, { type: e.target.value })}>
                    {POINT_TYPES.filter(([v]) => (name === 'min' ? v !== 'max' : name === 'max' ? v !== 'min' : v !== 'min' && v !== 'max')).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input aria-label={label + ' value'} value={p.type === 'min' || p.type === 'max' ? '' : String(p.value ?? '')} disabled={p.type === 'min' || p.type === 'max'} onChange={(e) => setPoint(name, { value: e.target.value })} />
                <ColorPicker label={label + ' color'} icon={<span className="ks-swatch" style={{ background: p.color }} />} value={p.color} onPick={(color) => setPoint(name, { color: color || '#ffffff' })} container={container} />
            </div>
        );
    };

    return (
        <aside className="ks-panel" aria-label="Conditional format rules">
            {head}
            <div className="ks-tabs-choice" role="tablist">
                <button type="button" role="tab" aria-selected={d.kind === 'single'} className={d.kind === 'single' ? 'ks-on' : ''} onClick={() => set({ kind: 'single' })}>Single color</button>
                <button type="button" role="tab" aria-selected={d.kind === 'scale'} className={d.kind === 'scale' ? 'ks-on' : ''} onClick={() => set({ kind: 'scale' })}>Color scale</button>
                <button type="button" role="tab" aria-selected={d.kind === 'bar'} className={d.kind === 'bar' ? 'ks-on' : ''} onClick={() => set({ kind: 'bar' })}>Data bar</button>
            </div>
            <div className="ks-form">
                <label className="ks-field ks-field-stack"><span>Apply to range</span><input value={d.ranges} onChange={(e) => set({ ranges: e.target.value })} /></label>
                {d.kind === 'bar' ? (
                    <div className="ks-field-stack"><span className="ks-field-label">Bar color</span>
                        <div className="ks-style-row">
                            <span className="ks-rule-sample" style={{ background: 'linear-gradient(90deg,' + d.barColor + '55 60%, transparent 60%)' }}>123</span>
                            <ColorPicker label="Bar color" icon={<Icon name="fill" under={d.barColor} />} value={d.barColor} onPick={(c) => set({ barColor: c || '#6929c4' })} container={container} />
                        </div>
                        <span className="ks-panel-help">Each number gets a bar as long as its share between the smallest (0 when all are positive) and the largest of the range.</span>
                    </div>
                ) : d.kind === 'single' ? (
                    <>
                        <label className="ks-field ks-field-stack"><span>Format cells if…</span>
                            <select value={d.op} onChange={(e) => set({ op: e.target.value })}>{OPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                        </label>
                        {d.op === 'formula' ? <input className="ks-panel-input" aria-label="Custom formula" value={d.formula} placeholder='=$C2="Late"' onChange={(e) => set({ formula: e.target.value })} /> : null}
                        {DATE_OPS.has(d.op) ? <select className="ks-panel-input" aria-label="Date" value={d.day} onChange={(e) => set({ day: e.target.value })}>{DAYS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select> : null}
                        {DATE_OPS.has(d.op) && d.day === 'exact' ? <input className="ks-panel-input" aria-label="Exact date" value={d.a} placeholder="26/10/2026" onChange={(e) => set({ a: e.target.value })} /> : null}
                        {needsA ? <input className="ks-panel-input" aria-label="Value" value={d.a} placeholder="Value or number" onChange={(e) => set({ a: e.target.value })} /> : null}
                        {d.op === 'between' || d.op === 'notBetween' ? <input className="ks-panel-input" aria-label="And" value={d.b} placeholder="And" onChange={(e) => set({ b: e.target.value })} /> : null}
                        <div className="ks-field-stack"><span className="ks-field-label">Formatting style</span>
                            <div className="ks-style-row">
                                <span className="ks-rule-sample" style={sampleStyle(d.style)}>Sample</span>
                                {[['bold', 'Bold'], ['italic', 'Italic'], ['underline', 'Underline'], ['strike', 'Strikethrough']].map(([k, l]) => (
                                    <button key={k} type="button" className={'ks-tool' + (d.style[k] ? ' ks-on' : '')} aria-label={l} title={l} aria-pressed={!!d.style[k]} onClick={() => setStyle(k, !d.style[k])}><Icon name={k} /></button>
                                ))}
                                <ColorPicker label="Text color" icon={<Icon name="textColor" under={d.style.color || '#000000'} />} value={d.style.color || null} onPick={(c) => setStyle('color', c)} container={container} />
                                <ColorPicker label="Fill color" icon={<Icon name="fill" under={d.style.fill || '#ffffff'} />} value={d.style.fill || null} onPick={(c) => setStyle('fill', c)} container={container} />
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="ks-field-stack"><span className="ks-field-label">Preview</span>
                            <div className="ks-scale-presets">
                                {SCALES.map((p, i) => (
                                    <button key={i} type="button" className="ks-scale-preset" aria-label={'Scale ' + (i + 1)} style={{ background: 'linear-gradient(90deg,' + [p.min, p.mid, p.max].filter(Boolean).join(',') + ')' }}
                                        onClick={() => set(scaleDraft(p))} />
                                ))}
                            </div>
                        </div>
                        {pointRow('min', 'Minpoint')}
                        {d.mid ? pointRow('mid', 'Midpoint') : <button type="button" className="ks-button" onClick={() => set({ mid: { type: 'percentile', value: 50, color: '#ffd666' } })}>Add a midpoint</button>}
                        {d.mid ? <button type="button" className="ks-button" onClick={() => set({ mid: null })}>No midpoint</button> : null}
                        {pointRow('max', 'Maxpoint')}
                    </>
                )}
                <p className="ks-dialog-status ks-problem" aria-live="polite">{problem}</p>
            </div>
            <div className="ks-dialog-actions">
                {d.id ? <button type="button" className="ks-button" onClick={() => { wb.removeConditional(s, d.id, how); setDraft(null); }}>Remove rule</button> : null}
                <span style={{ flex: 1 }} />
                <button type="button" className="ks-button" onClick={() => { setProblem(''); if (wb.conditionals(s).length) setDraft(null); else onClose(); }}>Cancel</button>
                <button type="button" className="ks-button ks-primary" onClick={done}>Done</button>
            </div>
        </aside>
    );
}
