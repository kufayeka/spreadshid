import { useId, useState } from 'react';
import * as dialog from '@zag-js/dialog';
import { useMachine, normalizeProps, Portal } from '@zag-js/react';

const KINDS = [
    ['list', 'Dropdown (the values written here)'], ['listFrom', 'Dropdown (from a range)'], ['checkbox', 'Checkbox'],
    ['number', 'Number'], ['date', 'Date'], ['textLength', 'Length of the text'], ['text', 'Text']
];
const NUMBER_OPS = [['between', 'between'], ['notBetween', 'not between'], ['gt', 'greater than'], ['gte', 'greater than or equal to'], ['lt', 'less than'], ['lte', 'less than or equal to'], ['eq', 'equal to'], ['ne', 'not equal to']];
const TEXT_OPS = [['contains', 'contains'], ['notContains', 'does not contain'], ['email', 'is a valid email'], ['url', 'is a valid URL']];

/**
 * Data validation (Data menu), as in Google Sheets: the range, what its cells take (a dropdown, a checkbox, a number, a date, a length, a text), what
 * happens to a value that breaks it (refused, or kept and marked), and a help text. "Remove rule" takes the rules of the range away. Made with zag.js.
 *
 * @param {object} props
 * @param {string} props.range  "B2:B20" (the selection when the dialog opened).
 * @param {object|null} props.rule  The rule of the active cell, to edit; null for a new one.
 * @param {(range: string, spec: object) => string|null} props.onSave  Returns a reason when the range cannot be read.
 * @param {(range: string) => void} props.onRemove
 * @param {() => void} props.onClose
 * @param {import('react').RefObject<HTMLElement>} props.container
 */
export function ValidationDialog({ range, rule, onSave, onRemove, onClose, container }) {
    const service = useMachine(dialog.machine, { id: useId(), open: true, onOpenChange: (d) => { if (!d.open) onClose(); } });
    const api = dialog.connect(service, normalizeProps);
    const [where, setWhere] = useState(range);
    const [kind, setKind] = useState(rule ? rule.kind : 'list');
    const [values, setValues] = useState(rule && rule.values ? rule.values.join(', ') : '');
    const [source, setSource] = useState(rule && rule.source ? rule.source : '');
    const [op, setOp] = useState(rule && rule.op ? rule.op : 'between');
    const [a, setA] = useState(rule && rule.a !== undefined ? String(rule.a) : '');
    const [b, setB] = useState(rule && rule.b !== undefined ? String(rule.b) : '');
    const [reject, setReject] = useState(rule ? rule.reject !== false : true);
    const [help, setHelp] = useState(rule && rule.help ? rule.help : '');
    const [problem, setProblem] = useState('');
    const numeric = kind === 'number' || kind === 'date' || kind === 'textLength';
    const ops = kind === 'text' ? TEXT_OPS : NUMBER_OPS;

    function save() {
        const spec = { kind, reject, ...(help ? { help } : {}) };
        if (kind === 'list') spec.values = values.split(',').map((x) => x.trim()).filter(Boolean);
        if (kind === 'listFrom') spec.source = source.trim();
        if (numeric || kind === 'text') {
            // the condition chosen, or the first of the list when the kind changed under it (a number's "between" is no condition of a text)
            spec.op = ops.some(([v]) => v === op) ? op : ops[0][0];
            spec.a = numeric ? Number(a) : a;
            if (spec.op === 'between' || spec.op === 'notBetween') spec.b = Number(b);
        }
        if (kind === 'list' && !spec.values.length) { setProblem('Write the choices, separated by commas'); return; }
        if (kind === 'listFrom' && !spec.source) { setProblem('Write the range the choices come from, for example Rates!A2:A20'); return; }
        const why = onSave(where, spec);
        if (why) setProblem(why); else onClose();
    }

    return (
        <Portal container={container}>
            <div {...api.getBackdropProps()} className="ks-backdrop" />
            <div {...api.getPositionerProps()} className="ks-dialog-positioner">
                <div {...api.getContentProps()} className="ks-dialog">
                    <h2 {...api.getTitleProps()} className="ks-dialog-title">Data validation</h2>
                    <div className="ks-form">
                        <label className="ks-field"><span>Apply to range</span><input value={where} onChange={(e) => setWhere(e.target.value)} /></label>
                        <label className="ks-field"><span>Criteria</span>
                            <select value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                        </label>
                        {kind === 'list' ? <label className="ks-field"><span>Choices</span><input value={values} placeholder="Draft, Approved, Rejected" onChange={(e) => setValues(e.target.value)} /></label> : null}
                        {kind === 'listFrom' ? <label className="ks-field"><span>From range</span><input value={source} placeholder="Rates!A2:A20" onChange={(e) => setSource(e.target.value)} /></label> : null}
                        {numeric || kind === 'text' ? (
                            <label className="ks-field"><span>Condition</span>
                                <select value={ops.some(([v]) => v === op) ? op : ops[0][0]} onChange={(e) => setOp(e.target.value)}>{ops.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                            </label>
                        ) : null}
                        {numeric || (kind === 'text' && (op === 'contains' || op === 'notContains')) ? <label className="ks-field"><span>Value</span><input value={a} onChange={(e) => setA(e.target.value)} /></label> : null}
                        {numeric && (op === 'between' || op === 'notBetween') ? <label className="ks-field"><span>And</span><input value={b} onChange={(e) => setB(e.target.value)} /></label> : null}
                        <label className="ks-field"><span>If invalid</span>
                            <select value={reject ? 'reject' : 'warn'} onChange={(e) => setReject(e.target.value === 'reject')}>
                                <option value="reject">Reject the input</option>
                                <option value="warn">Show a warning</option>
                            </select>
                        </label>
                        <label className="ks-field"><span>Help text</span><input value={help} onChange={(e) => setHelp(e.target.value)} placeholder="Shown when a cell of the range is selected" /></label>
                        <p className="ks-dialog-status ks-problem" aria-live="polite">{problem}</p>
                    </div>
                    <div className="ks-dialog-actions">
                        <button type="button" className="ks-button" onClick={() => { onRemove(where); onClose(); }}>Remove rule</button>
                        <span style={{ flex: 1 }} />
                        <button type="button" className="ks-button" {...api.getCloseTriggerProps()}>Cancel</button>
                        <button type="button" className="ks-button ks-primary" onClick={save}>Done</button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
