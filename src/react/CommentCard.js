import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.js';
import { refusalOf } from '../core/policy.js';

// when a comment was written, as a person says it: "13:05" today, "26 Oct" before
function when(at, locale) {
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return '';
    const today = new Date();
    return d.toDateString() === today.toDateString()
        ? d.toLocaleTimeString(locale || undefined, { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString(locale || undefined, { day: 'numeric', month: 'short' });
}

/**
 * The comments of a cell, as in Google Sheets: a card beside the cell with its thread (who wrote, when, what), a box to comment or reply (Ctrl+Enter
 * sends it), Resolve, and Edit and Delete on a person's own comments. It shows when a cell with an open thread is selected, or when a comment is
 * started (Insert > Comment, Ctrl+Alt+M).
 *
 * @param {object} props
 * @param {any} props.workbook @param {string} props.sheetId @param {number} props.r @param {number} props.c
 * @param {{ left: number, top: number }} props.at  Where it is drawn in the grid's box.
 * @param {boolean} props.start  Started from the menu or the keys: the box is focused.
 * @param {(message: string) => void} props.onError
 * @param {() => void} props.onDone  The card has nothing more to do (sent, cancelled, Escape): the keyboard goes back to the grid.
 */
export function CommentCard({ workbook: wb, sheetId: s, r, c, at, start, onError, onDone }) {
    const thread = wb.commentAt(s, r, c);
    const [text, setText] = useState('');
    const [editing, setEditing] = useState(null); // { id, text }
    const box = useRef(null);
    useEffect(() => { if (start && box.current) box.current.focus(); }, [start, r, c]);
    const how = { source: 'user' };
    const locale = wb.settings().locale;
    const can = wb.can('comment');
    const run = (fn) => { try { fn(); return true; } catch (err) { onError(err.message[0].toUpperCase() + err.message.slice(1)); return false; } };

    function send() {
        if (!text.trim()) return;
        if (!can) { onError(refusalOf('comment', wb.access().message)); return; }
        if (run(() => (thread ? wb.replyComment(s, thread.id, text, how) : wb.addComment(s, r, c, text, how)))) { setText(''); onDone(); }
    }

    return (
        <div className="ks-comment-card" style={{ left: at.left, top: at.top }} role="dialog" aria-label="Comments"
            onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); onDone(); } }}>
            {thread ? (
                <>
                    <div className="ks-comment-head">
                        <span className="ks-comment-count">{thread.items.length === 1 ? '1 comment' : thread.items.length + ' comments'}</span>
                        <button type="button" className="ks-tool" aria-label="Resolve" title="Resolve" disabled={!can} onClick={() => { if (run(() => wb.resolveComment(s, thread.id, true, how))) onDone(); }}>✓</button>
                    </div>
                    <ol className="ks-comment-list">
                        {thread.items.map((item) => (
                            <li key={item.id} className="ks-comment">
                                <div className="ks-comment-by"><b>{item.by && item.by.name}</b><span>{when(item.at, locale)}{item.edited ? ' (edited)' : ''}</span>
                                    <span className="ks-comment-tools">
                                        <button type="button" aria-label="Edit comment" title="Edit" onClick={() => setEditing({ id: item.id, text: item.text })}>✎</button>
                                        <button type="button" aria-label="Delete comment" title="Delete" onClick={() => run(() => wb.deleteComment(s, thread.id, item.id, how))}><Icon name="trash" /></button>
                                    </span>
                                </div>
                                {editing && editing.id === item.id ? (
                                    <div className="ks-comment-edit">
                                        <textarea aria-label="Edit comment" value={editing.text} autoFocus onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (run(() => wb.editComment(s, thread.id, item.id, editing.text, how))) setEditing(null); } }} />
                                        <div className="ks-dialog-actions"><span style={{ flex: 1 }} />
                                            <button type="button" className="ks-button" onClick={() => setEditing(null)}>Cancel</button>
                                            <button type="button" className="ks-button ks-primary" onClick={() => { if (run(() => wb.editComment(s, thread.id, item.id, editing.text, how))) setEditing(null); }}>Save</button>
                                        </div>
                                    </div>
                                ) : <p className="ks-comment-text">{item.text}</p>}
                            </li>
                        ))}
                    </ol>
                </>
            ) : null}
            {can ? (
                <div className="ks-comment-new">
                    <textarea ref={box} aria-label={thread ? 'Reply' : 'Comment'} placeholder={thread ? 'Reply…' : 'Comment…'} value={text} onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }} />
                    {text.trim() || !thread ? (
                        <div className="ks-dialog-actions"><span style={{ flex: 1 }} />
                            <button type="button" className="ks-button" onClick={() => { setText(''); onDone(); }}>Cancel</button>
                            <button type="button" className="ks-button ks-primary" disabled={!text.trim()} onClick={send}>{thread ? 'Reply' : 'Comment'}</button>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
