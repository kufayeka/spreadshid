import { useState } from 'react';
import { Icon } from './icons.js';
import { rectText } from './FormulaBar.js';
import { parseRangeText } from '../core/validation.js';

/** "BOQ!D2:D200" (the sheet's name quoted when it needs to be): where a named range points, or "#REF!" when what it pointed at is gone. */
function whereText(wb, n) {
    if (!n.range) return '#REF!';
    const name = wb.sheetProps(n.sheetId).name;
    return (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) ? name : "'" + name.replace(/'/g, "''") + "'") + '!' + rectText(n.range);
}

/**
 * Named ranges (Data menu), as in Google Sheets: a panel on the right with the names of the workbook and where each points; a name opened to rename it
 * or point it elsewhere, or to take it away; "Add a range" names the selection. Formulas that use a name follow it (renamed, they show the new name).
 *
 * @param {object} props
 * @param {any} props.workbook @param {string} props.sheetId  The sheet shown (a range typed without a sheet is in it).
 * @param {string} props.range  The selection now ("B2:B20"): what a new name names.
 * @param {number} props.revision  So the list is drawn again after a change.
 * @param {(sheetId: string, range: object) => void} props.onGo  A name was clicked in the list: select its range.
 * @param {() => void} props.onClose
 */
export function NamesPanel({ workbook: wb, sheetId, range, revision, onGo, onClose }) {
    void revision;
    const list = wb.names();
    const [draft, setDraft] = useState(null); // { id, name, where }
    const [problem, setProblem] = useState('');
    const how = { source: 'user' };
    const ownName = wb.sheetProps(sheetId).name;
    const quoted = /^[A-Za-z_][A-Za-z0-9_.]*$/.test(ownName) ? ownName : "'" + ownName.replace(/'/g, "''") + "'";

    function done() {
        const at = parseRangeText(draft.where);
        const target = at && (at.sheet ? wb.sheetIdByName(at.sheet) : sheetId);
        if (!at || !target) { setProblem('Write a range, for example D2:D200 or BOQ!D2:D200'); return; }
        try {
            if (draft.id) wb.setName(draft.id, { name: draft.name, sheetId: target, range: at }, how);
            else wb.addName(draft.name, target, at, how);
        } catch (err) { setProblem(err.message[0].toUpperCase() + err.message.slice(1)); return; }
        setProblem('');
        setDraft(null);
    }

    const head = (
        <div className="ks-panel-head">
            <h2 className="ks-panel-title">Named ranges</h2>
            <button type="button" className="ks-tool" aria-label="Close" title="Close" onClick={onClose}>✕</button>
        </div>
    );

    if (draft) {
        return (
            <aside className="ks-panel" aria-label="Named ranges">
                {head}
                <div className="ks-form">
                    <label className="ks-field ks-field-stack"><span>Name</span><input aria-label="Name" value={draft.name} placeholder="Budget" autoFocus onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') done(); }} /></label>
                    <label className="ks-field ks-field-stack"><span>Range</span><input aria-label="Range" value={draft.where} onChange={(e) => setDraft({ ...draft, where: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') done(); }} /></label>
                    <p className="ks-panel-help">A name starts with a letter or _ and has no spaces. Use it in a formula: =SUM({draft.name || 'Budget'})</p>
                    <p className="ks-dialog-status ks-problem" aria-live="polite">{problem}</p>
                </div>
                <div className="ks-dialog-actions">
                    {draft.id ? <button type="button" className="ks-button" onClick={() => { wb.removeName(draft.id, how); setDraft(null); }}>Remove</button> : null}
                    <span style={{ flex: 1 }} />
                    <button type="button" className="ks-button" onClick={() => { setProblem(''); setDraft(null); }}>Cancel</button>
                    <button type="button" className="ks-button ks-primary" onClick={done}>Done</button>
                </div>
            </aside>
        );
    }

    return (
        <aside className="ks-panel" aria-label="Named ranges">
            {head}
            {list.length ? null : <p className="ks-panel-help">No named ranges yet. A name stands for a range in formulas (=SUM(Budget)) and in the name box.</p>}
            <ol className="ks-rule-list">
                {list.map((n) => (
                    <li key={n.id} className="ks-rule-card">
                        <button type="button" className="ks-rule-open" onClick={() => { if (n.range) onGo(n.sheetId, n.range); }}>
                            <span className="ks-rule-text"><span className="ks-rule-says ks-name">{n.name}</span><span className="ks-rule-ranges">{whereText(wb, n)}</span></span>
                        </button>
                        <span className="ks-rule-tools">
                            <button type="button" className="ks-tool" aria-label={'Edit ' + n.name} title="Edit" onClick={() => { setProblem(''); setDraft({ id: n.id, name: n.name, where: whereText(wb, n) }); }}>✎</button>
                            <button type="button" className="ks-tool" aria-label={'Delete ' + n.name} title="Delete" onClick={() => wb.removeName(n.id, how)}><Icon name="trash" /></button>
                        </span>
                    </li>
                ))}
            </ol>
            <button type="button" className="ks-button ks-add-rule" onClick={() => { setProblem(''); setDraft({ id: null, name: '', where: quoted + '!' + range }); }}><Icon name="add" /> Add a range</button>
        </aside>
    );
}
