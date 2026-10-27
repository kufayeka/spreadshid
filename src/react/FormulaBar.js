import { useEffect, useRef, useState } from 'react';
import { colName, colIndex } from '../core/formula/address.js';

/** "B7" -> { r: 6, c: 1 }; "A1:C3" -> a rectangle; null when it is not an address. */
export function parseAddressText(text) {
    const one = (t) => { const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,8})$/.exec(t.trim()); return m && colIndex(m[1]) >= 0 ? { r: Number(m[2]) - 1, c: colIndex(m[1]) } : null; };
    const [a, b] = String(text).split(':');
    const p = one(a), q = b === undefined ? p : one(b);
    if (!p || !q || p.r < 0 || q.r < 0) return null;
    return { r1: Math.min(p.r, q.r), c1: Math.min(p.c, q.c), r2: Math.max(p.r, q.r), c2: Math.max(p.c, q.c) };
}

/**
 * The bar above the grid, as in Google Sheets: the name box (the address of the selection; type one and Enter to go there) and the formula bar (what the
 * active cell holds: its formula as it reads, or its value as typed; edit it there as well as in the cell, both show the same text).
 *
 * @param {object} props
 * @param {string} props.address  "B7" or "A1:C3".
 * @param {string} props.content  What the active cell holds, as it is edited.
 * @param {{ text: string, from?: string }|null} props.editing  The edit under way, wherever it started.
 * @param {(text: string) => void} props.onStartEdit  The bar was clicked into: the edit starts (or goes on) here.
 * @param {(text: string) => void} props.onText
 * @param {(move: { dr: number, dc: number }|null) => void} props.onCommit
 * @param {() => void} props.onCancel
 * @param {(rect: object) => void} props.onGo  An address was typed in the name box.
 * @param {(text: string) => void} [props.onGoName]  A word that is no address was typed in the name box (a named range, or a new name for the selection).
 */
export function FormulaBar({ address, content, editing, onStartEdit, onText, onCommit, onCancel, onGo, onGoName }) {
    const [name, setName] = useState(null); // what is typed in the name box, while it is typed
    const input = useRef(null);
    const text = editing ? editing.text : content;

    // an edit that started in the bar keeps the keyboard there
    useEffect(() => {
        if (editing && editing.from === 'bar' && input.current && document.activeElement !== input.current) input.current.focus();
    }, [editing && editing.from]);

    return (
        <div className="ks-formulabar">
            <input className="ks-namebox" aria-label="Name box" value={name !== null ? name : address} spellCheck={false}
                onFocus={(e) => { setName(address); requestAnimationFrame(() => e.target.select()); }}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setName(null)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const rect = parseAddressText(name || '');
                        setName(null);
                        e.currentTarget.blur();
                        if (rect) onGo(rect);
                        else if (onGoName && /\S/.test(name || '')) onGoName((name || '').trim());
                    }
                    if (e.key === 'Escape') { setName(null); e.currentTarget.blur(); }
                }} />
            <span className="ks-fx" aria-hidden="true">fx</span>
            <input ref={input} className="ks-formula" aria-label="Formula bar" data-formula-bar="" value={text} spellCheck={false}
                onFocus={() => { if (!editing || editing.from !== 'bar') onStartEdit(text); }}
                onChange={(e) => onText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); onCommit({ dr: e.shiftKey ? -1 : 1, dc: 0 }); }
                    else if (e.key === 'Tab') { e.preventDefault(); onCommit({ dr: 0, dc: e.shiftKey ? -1 : 1 }); }
                    else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
                }} />
        </div>
    );
}

/** The address of a rectangle as the name box shows it. */
export const rectText = (b) => (b.r1 === b.r2 && b.c1 === b.c2 ? colName(b.c1) + (b.r1 + 1) : colName(b.c1) + (b.r1 + 1) + ':' + colName(b.c2) + (b.r2 + 1));
