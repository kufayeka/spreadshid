import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './icons.js';
import { rectText } from './FormulaBar.js';
import { refusalOf } from '../core/policy.js';

// when a comment was written, as a person says it: "13:05" today, "26 Oct 13:05" before
export function when(at, locale) {
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return '';
    const time = d.toLocaleTimeString(locale || undefined, { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date().toDateString() ? time : d.toLocaleDateString(locale || undefined, { day: 'numeric', month: 'short' }) + ' ' + time;
}

// The two letters in a writer's circle ("Dewi Lestari" -> "DL", "Joko" -> "JO"), and the circle's colour, always the same one for the same person.
const COLOURS = ['#1a73e8', '#e37400', '#188038', '#a142f4', '#d93025', '#007b83', '#b06000', '#3f51b5'];
export function initials(name) {
    const words = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
    return (words[0] || '?').slice(0, 2).toUpperCase();
}
export function colourOf(id) {
    let h = 0;
    for (const ch of String(id || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return COLOURS[h % COLOURS.length];
}
export function Avatar({ by }) {
    return <span className="ks-avatar" style={{ background: colourOf(by && by.id) }} aria-hidden="true">{initials(by && by.name)}</span>;
}

/**
 * The comments of one cell, in a card that floats beside the cell, as in Excel: every comment one under the other (the writer's circle, name and
 * time, the text), a menu on the comments the person may change (Edit, Delete), and a box at the bottom to reply (or to start the discussion
 * when the cell has none yet). What the access rows do not let the person do (comment.*) is not offered.
 *
 * The card stands beside the cell's place on the screen, measured from the grid's row and column heads, and is measured again when the grid
 * scrolls or changes; a cell scrolled out of sight takes the card away until it comes back.
 *
 * @param {object} props
 * @param {any} props.workbook @param {string} props.sheetId
 * @param {{ r: number, c: number }} props.at  The cell.
 * @param {number} props.revision  So the card is drawn again after a change (a reply from someone else, a row inserted above).
 * @param {number} props.start  Not 0: opened to write, so the box is focused (again each time it changes).
 * @param {HTMLElement | null} props.frame  The element the card is placed in (the sheet's body).
 * @param {Map<string, string>} props.drafts  What was typed and not sent yet, by cell, kept while the card is closed.
 * @param {() => void} props.onPin  The person started to use the card (typing, a menu): a hover card stays open.
 * @param {() => void} props.onClose  Escape or the close button.
 * @param {() => void} [props.onEnter] @param {() => void} [props.onLeave]  The mouse came onto the card or left it (a hover card).
 * @param {(message: string, why?: object) => void} props.onError
 */
export function CommentCard({ workbook: wb, sheetId: s, at, revision, start, frame, drafts, onPin, onClose, onEnter, onLeave, onError }) {
    const card = useRef(null);
    const box = useRef(null);
    const list = useRef(null);
    const key = s + '!' + at.r + ':' + at.c;
    const [text, setTextState] = useState(() => drafts.get(key) || '');
    const setText = (t) => { setTextState(t); if (t) drafts.set(key, t); else drafts.delete(key); };
    const [editing, setEditing] = useState(null); // { item, text }
    const [menu, setMenu] = useState(null); // the id of the comment whose menu is open
    const [place, setPlace] = useState(null); // { left, top } in the frame, or null when the cell is out of sight

    // another cell: its own draft, nothing being edited
    useEffect(() => { setTextState(drafts.get(key) || ''); setEditing(null); setMenu(null); }, [key]);
    // (only once the card has its place: a card still hidden while it is measured cannot take the focus)
    const placed = place !== null;
    useEffect(() => { if (start && placed && box.current) box.current.focus(); }, [start, key, placed]);

    const thread = wb.commentAt(s, at.r, at.c);
    const count = thread ? thread.items.length : 0;
    // a new comment (mine or someone else's) is scrolled into view at the bottom of the card
    useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }, [count, key]);

    // Where the card stands: on the right of the cell, its top on the cell's top; on the left of the cell when there is no room on the right,
    // and pushed up when it would go below the frame.
    useLayoutEffect(() => {
        if (!frame) return undefined;
        let raf = 0;
        const measure = () => {
            raf = 0;
            const head = frame.querySelector('.ks-colhead[data-c="' + at.c + '"]');
            const side = frame.querySelector('.ks-rowhead[data-r="' + at.r + '"]');
            const grid = frame.querySelector('.ks-grid');
            if (!head || !side || !grid || !card.current) { setPlace(null); return; }
            const f = frame.getBoundingClientRect(), g = grid.getBoundingClientRect(), a = head.getBoundingClientRect(), b = side.getBoundingClientRect();
            // out of sight: under the frozen heads or past the grid's edges
            if (a.right <= g.left || a.left >= g.right || b.bottom <= g.top || b.top >= g.bottom) { setPlace(null); return; }
            const w = card.current.offsetWidth || 300, h = card.current.offsetHeight || 200;
            // the room ends at the grid's right edge, not the frame's: a panel open beside the grid (View > Comments) is not covered
            let left = a.right - f.left + 8;
            if (left + w > g.right - f.left - 4) left = Math.max(4, a.left - f.left - w - 8);
            let top = b.top - f.top;
            if (top + h > f.height - 4) top = Math.max(4, f.height - h - 4);
            setPlace((p) => (p && p.left === left && p.top === top ? p : { left, top }));
        };
        const later = () => { if (!raf) raf = requestAnimationFrame(measure); };
        measure();
        frame.addEventListener('scroll', later, true);
        window.addEventListener('resize', later);
        return () => { frame.removeEventListener('scroll', later, true); window.removeEventListener('resize', later); if (raf) cancelAnimationFrame(raf); };
    }, [frame, at.r, at.c, revision, count, editing]);

    const can = (a) => wb.can(a);
    const how = { source: 'user' };
    const locale = wb.settings().locale;
    const me = wb.user().id;
    const run = (fn) => { try { fn(); return true; } catch (err) { onError(err.message[0].toUpperCase() + err.message.slice(1)); return false; } };
    const action = thread ? 'comment.reply' : 'comment.create';
    const address = rectText({ r1: at.r, c1: at.c, r2: at.r, c2: at.c });

    function send() {
        const words = text.trim();
        if (!words) return;
        if (!can(action)) { onError(refusalOf(action, wb.access().message), { kind: 'refused', action }); return; }
        // a reply goes to the discussion of the cell as it is now (it may have been started by someone else since the card opened)
        const now = wb.commentAt(s, at.r, at.c);
        const ok = run(() => (now ? wb.replyComment(s, now.id, words, how) : wb.addComment(s, at.r, at.c, words, how)));
        if (ok) setText('');
    }
    function saveEdit(item) {
        if (run(() => wb.editComment(s, thread.id, item.id, editing.text, how))) setEditing(null);
    }
    const keys = (e, fn, cancel) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); fn(); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
    };

    // nothing to show and nothing to write: the card is not drawn
    if (!thread && !can('comment.create')) return null;
    return (
        <div ref={card} className="ks-comment-card" role="dialog" aria-label={'Comments on ' + address}
            style={place ? { left: place.left, top: place.top } : { visibility: 'hidden', left: 0, top: 0 }}
            onMouseEnter={onEnter} onMouseLeave={onLeave} onFocus={onPin} onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(); } }}>
            <div className="ks-card-head">
                <span className="ks-card-cell">{address}</span>
                <button type="button" className="ks-card-close" aria-label="Close" title="Close (Esc)" onClick={onClose}>✕</button>
            </div>
            {thread ? (
                <ol className="ks-card-list" ref={list}>
                    {thread.items.map((item, i) => {
                        const own = me !== null && !!item.by && item.by.id === me;
                        const mayEdit = wb.mayChangeComment(s, thread.id, item.id, 'edit');
                        const mayDelete = wb.mayChangeComment(s, thread.id, item.id, 'delete');
                        return (
                            <li key={item.id} className={'ks-card-item' + (own ? ' ks-mine' : '')} data-item={item.id}>
                                <Avatar by={item.by} />
                                <div className="ks-card-body">
                                    <div className="ks-card-by">
                                        <b>{item.by ? item.by.name : '?'}</b>
                                        <span>{when(item.at, locale)}{item.edited ? ' · edited' : ''}</span>
                                        {mayEdit || mayDelete ? (
                                            <button type="button" className="ks-card-more" aria-label="More" aria-expanded={menu === item.id}
                                                onClick={() => setMenu(menu === item.id ? null : item.id)}>⋯</button>
                                        ) : null}
                                        {menu === item.id ? (
                                            <div className="ks-card-menu" role="menu">
                                                {mayEdit ? <button type="button" role="menuitem" onClick={() => { setMenu(null); setEditing({ item: item.id, text: item.text }); }}>Edit</button> : null}
                                                {mayDelete ? <button type="button" role="menuitem" onClick={() => { setMenu(null); run(() => wb.deleteComment(s, thread.id, item.id, how)); }}>{i === 0 ? 'Delete discussion' : 'Delete'}</button> : null}
                                            </div>
                                        ) : null}
                                    </div>
                                    {editing && editing.item === item.id ? (
                                        <div className="ks-card-edit">
                                            <textarea aria-label="Edit comment" value={editing.text} autoFocus rows={2}
                                                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                                                onKeyDown={(e) => keys(e, () => saveEdit(item), () => setEditing(null))} />
                                            <div className="ks-card-actions">
                                                <button type="button" className="ks-button" onClick={() => setEditing(null)}>Cancel</button>
                                                <button type="button" className="ks-button ks-primary" disabled={!editing.text.trim()} onClick={() => saveEdit(item)}>Save</button>
                                            </div>
                                        </div>
                                    ) : <p className="ks-card-text">{item.text}</p>}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            ) : null}
            {can(action) ? (
                <div className="ks-card-reply">
                    <textarea ref={box} rows={1} aria-label={(thread ? 'Reply on ' : 'Comment on ') + address}
                        placeholder={thread ? 'Reply…' : 'Comment on ' + address + '…'} value={text}
                        onChange={(e) => setText(e.target.value)} onKeyDown={(e) => keys(e, send, onClose)} />
                    <button type="button" className="ks-card-send" aria-label={thread ? 'Reply' : 'Comment'} title="Send (Ctrl+Enter)" disabled={!text.trim()} onClick={send}>
                        <Icon name="send" />
                    </button>
                </div>
            ) : null}
        </div>
    );
}
