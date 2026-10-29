import { useState } from 'react';
import { rectText } from './FormulaBar.js';
import { Avatar, when } from './CommentCard.js';

/**
 * Every discussion of the workbook, in a panel on the right of the grid (View > Comments), as a list to find one: "Dewi commented on Produk!E7",
 * the time, the first comment, and how many replies it has and who wrote last. A click goes to the cell and opens its card, where the reading
 * and the replying happen; the panel has no box to write in. Three filters: every sheet, this sheet, and the discussions the person wrote in.
 *
 * @param {object} props
 * @param {any} props.workbook @param {string} props.sheetId  The sheet shown (the "This sheet" filter, and the discussion of the active cell).
 * @param {{ r: number, c: number }} props.active  The selected cell: its discussion is marked.
 * @param {number} props.revision  So the panel is drawn again after a change.
 * @param {(sheetId: string, r: number, c: number) => void} props.onOpen  A discussion clicked: its cell is selected and its card opened.
 * @param {() => void} props.onClose
 */
export function CommentsPanel({ workbook: wb, sheetId, active, revision, onOpen, onClose }) {
    void revision;
    const [show, setShow] = useState('all'); // 'all' | 'sheet' | 'mine'
    const me = wb.user().id;
    const locale = wb.settings().locale;

    // every discussion still on a cell, sheet by sheet in the order of the tabs, and cell by cell in reading order
    const all = [];
    for (const id of wb.sheetIds()) {
        const name = wb.sheet(id).name;
        const threads = wb.comments(id).filter((t) => t.at && t.items.length).sort((a, b) => a.at.r - b.at.r || a.at.c - b.at.c);
        for (const t of threads) all.push({ sheetId: id, sheetName: name, thread: t });
    }
    const mine = (t) => me !== null && t.items.some((x) => x.by && x.by.id === me);
    const shown = all.filter((x) => (show === 'sheet' ? x.sheetId === sheetId : show === 'mine' ? mine(x.thread) : true));
    const many = wb.sheetIds().length > 1;
    const chips = [['all', 'All', all.length], ['sheet', 'This sheet', all.filter((x) => x.sheetId === sheetId).length], ['mine', 'Mine', all.filter((x) => mine(x.thread)).length]];

    return (
        <aside className="ks-panel ks-comments" aria-label="Comments">
            <div className="ks-panel-head">
                <h2 className="ks-panel-title">Comments</h2>
                <button type="button" className="ks-tool" aria-label="Close" title="Close" onClick={onClose}>✕</button>
            </div>
            <div className="ks-chips" role="radiogroup" aria-label="Show">
                {chips.map(([value, label, n]) => (
                    <button key={value} type="button" role="radio" aria-checked={show === value} className={'ks-chip' + (show === value ? ' ks-on' : '')}
                        onClick={() => setShow(value)}>{label} ({n})</button>
                ))}
            </div>
            {shown.length ? null : <p className="ks-panel-help">{all.length ? 'No comments here.' : 'No comments yet. Select a cell and press Ctrl+Alt+M to write one.'}</p>}
            <ol className="ks-thread-list">
                {shown.map(({ sheetId: id, sheetName, thread: t }) => {
                    const first = t.items[0], last = t.items[t.items.length - 1];
                    const cell = rectText({ r1: t.at.r, c1: t.at.c, r2: t.at.r, c2: t.at.c });
                    const where = many ? sheetName + '!' + cell : cell;
                    const current = id === sheetId && t.at.r === active.r && t.at.c === active.c;
                    const replies = t.items.length - 1;
                    return (
                        <li key={t.id} data-thread={t.id}>
                            <button type="button" className={'ks-thread' + (current ? ' ks-current' : '')} onClick={() => onOpen(id, t.at.r, t.at.c)}>
                                <span className="ks-thread-top">
                                    <Avatar by={first.by} />
                                    <span className="ks-thread-who">
                                        <span><b>{first.by ? first.by.name : '?'}</b> commented on <span className="ks-thread-cell">{where}</span></span>
                                        <small>{when(first.at, locale)}</small>
                                    </span>
                                </span>
                                <span className="ks-thread-text">{first.text}</span>
                                {replies ? <span className="ks-thread-more">{replies === 1 ? '1 reply' : replies + ' replies'} · last {last.by ? last.by.name : '?'}, {when(last.at, locale)}</span> : null}
                            </button>
                        </li>
                    );
                })}
            </ol>
        </aside>
    );
}
