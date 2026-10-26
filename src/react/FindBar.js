import { useEffect, useId, useRef } from 'react';
import * as dialog from '@zag-js/dialog';
import { useMachine, normalizeProps, Portal } from '@zag-js/react';

/**
 * The find bar (Ctrl+F), at the top right of the grid as in Google Sheets: what to find, "3 of 12", the previous and the next match (Shift+Enter, Enter),
 * the button to the find-and-replace dialog, and Escape to close it.
 */
export function FindBar({ query, onQuery, count, index, onNext, onPrev, onClose, onMore }) {
    const input = useRef(null);
    useEffect(() => { if (input.current) { input.current.focus(); input.current.select(); } }, []);
    return (
        <div className="ks-findbar" role="search">
            <input ref={input} className="ks-find-input" value={query} placeholder="Find in sheet" aria-label="Find in sheet"
                onChange={(e) => onQuery(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) onPrev(); else onNext(); }
                    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
                }} />
            <span className="ks-find-count" aria-live="polite">{query ? (count ? index + 1 + ' of ' + count : 'No results') : ''}</span>
            <button type="button" className="ks-icon-button" aria-label="Previous match" title="Previous (Shift+Enter)" disabled={!count} onClick={onPrev}>&#8963;</button>
            <button type="button" className="ks-icon-button" aria-label="Next match" title="Next (Enter)" disabled={!count} onClick={onNext}>&#8964;</button>
            <button type="button" className="ks-icon-button" aria-label="Find and replace" title="Find and replace (Ctrl+H)" onClick={onMore}>&#8942;</button>
            <button type="button" className="ks-icon-button" aria-label="Close" title="Close (Escape)" onClick={onClose}>&#10005;</button>
        </div>
    );
}

/**
 * The find-and-replace dialog (Ctrl+H), made with zag.js (focus kept inside, Escape closes, the rest of the page waits).
 *
 * @param {object} props
 * @param {object} props.find  { query, replacement, matchCase, wholeCell, regex, inFormulas, allSheets }
 * @param {(patch: object) => void} props.onChange
 * @param {number} props.count  Matches found.
 * @param {string} props.status  What the last action did ("Replaced 4 cells").
 * @param {() => void} props.onFindNext
 * @param {() => void} props.onReplace
 * @param {() => void} props.onReplaceAll
 * @param {() => void} props.onClose
 * @param {import('react').RefObject<HTMLElement>} props.container
 */
export function ReplaceDialog({ find, onChange, count, status, onFindNext, onReplace, onReplaceAll, onClose, container }) {
    const service = useMachine(dialog.machine, { id: useId(), open: true, onOpenChange: (d) => { if (!d.open) onClose(); } });
    const api = dialog.connect(service, normalizeProps);
    const box = (key, label) => (
        <label className="ks-check"><input type="checkbox" checked={!!find[key]} onChange={(e) => onChange({ [key]: e.target.checked })} /> {label}</label>
    );
    return (
        <Portal container={container}>
            <div {...api.getBackdropProps()} className="ks-backdrop" />
            <div {...api.getPositionerProps()} className="ks-dialog-positioner">
                <div {...api.getContentProps()} className="ks-dialog">
                    <h2 {...api.getTitleProps()} className="ks-dialog-title">Find and replace</h2>
                    <div className="ks-form">
                        <label className="ks-field"><span>Find</span><input value={find.query} onChange={(e) => onChange({ query: e.target.value })} autoFocus /></label>
                        <label className="ks-field"><span>Replace with</span><input value={find.replacement} onChange={(e) => onChange({ replacement: e.target.value })} /></label>
                        <label className="ks-field"><span>Search</span>
                            <select value={find.allSheets ? 'all' : 'this'} onChange={(e) => onChange({ allSheets: e.target.value === 'all' })}>
                                <option value="this">This sheet</option>
                                <option value="all">All sheets</option>
                            </select>
                        </label>
                        <div className="ks-checks">
                            {box('matchCase', 'Match case')}
                            {box('wholeCell', 'Match entire cell contents')}
                            {box('regex', 'Search using regular expressions')}
                            {box('inFormulas', 'Also search within formulas')}
                        </div>
                        <p className="ks-dialog-status" aria-live="polite">{status || (find.query ? count + (count === 1 ? ' match' : ' matches') : '')}</p>
                    </div>
                    <div className="ks-dialog-actions">
                        <button type="button" className="ks-button" onClick={onFindNext} disabled={!count}>Find</button>
                        <button type="button" className="ks-button" onClick={onReplace} disabled={!count}>Replace</button>
                        <button type="button" className="ks-button" onClick={onReplaceAll} disabled={!count}>Replace all</button>
                        <button type="button" className="ks-button ks-primary" {...api.getCloseTriggerProps()}>Done</button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
