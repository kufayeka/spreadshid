import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.js';
import { rectText } from './FormulaBar.js';
import { refusalOf } from '../core/policy.js';

// when a comment was written, as a person says it: "13:05" today, "26 Oct" before
function when(at, locale) {
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return '';
    return d.toDateString() === new Date().toDateString()
        ? d.toLocaleTimeString(locale || undefined, { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString(locale || undefined, { day: 'numeric', month: 'short' });
}

/**
 * The comments of a sheet, in a panel on the right of the grid (View > Comments, Insert > Comment, Ctrl+Alt+M): a box to comment on the selected cell,
 * then every thread in the order of its cells (open ones, or resolved ones), each with its cell's address (a click goes there), its comments (who,
 * when, what; Edit and Delete), a reply box and Resolve / Reopen. What the access policy does not let the person do (comment.*) is not offered.
 *
 * @param {object} props
 * @param {any} props.workbook @param {string} props.sheetId
 * @param {{ r: number, c: number }} props.active  The selected cell: what a new comment is on, and the thread shown first.
 * @param {number} props.revision  So the panel is drawn again after a change.
 * @param {boolean} props.start  Opened to write a comment: its box is focused.
 * @param {(r: number, c: number) => void} props.onGo  An address clicked: that cell is selected.
 * @param {(message: string) => void} props.onError
 * @param {() => void} props.onClose
 */
export function CommentsPanel({ workbook: wb, sheetId: s, active, revision, start, onGo, onError, onClose }) {
    void revision;
    const [show, setShow] = useState('open');
    const [text, setText] = useState('');
    const [replies, setReplies] = useState({});
    const [editing, setEditing] = useState(null); // { thread, item, text }
    const box = useRef(null);
    useEffect(() => { if (start && box.current) box.current.focus(); }, [start, active.r, active.c]);
    const can = (a) => wb.can(a);
    const how = { source: 'user' };
    const locale = wb.settings().locale;
    const run = (fn) => { try { fn(); return true; } catch (err) { onError(err.message[0].toUpperCase() + err.message.slice(1)); return false; } };
    const threads = wb.comments(s).filter((t) => t.at && (show === 'open' ? !t.resolved : t.resolved))
        .sort((a, b) => a.at.r - b.at.r || a.at.c - b.at.c);
    const here = wb.commentAt(s, active.r, active.c);
    const address = rectText({ r1: active.r, c1: active.c, r2: active.r, c2: active.c });

    function send() {
        if (!text.trim()) return;
        if (!can(here ? 'comment.reply' : 'comment.create')) { onError(refusalOf(here ? 'comment.reply' : 'comment.create', wb.access().message)); return; }
        if (run(() => wb.addComment(s, active.r, active.c, text, how))) setText('');
    }
    const keys = (fn) => (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); fn(); } };

    return (
        <aside className="ks-panel ks-comments" aria-label="Comments">
            <div className="ks-panel-head">
                <h2 className="ks-panel-title">Comments</h2>
                <button type="button" className="ks-tool" aria-label="Close" title="Close" onClick={onClose}>✕</button>
            </div>
            {can(here ? 'comment.reply' : 'comment.create') ? (
                <div className="ks-comment-new">
                    <textarea ref={box} aria-label={'Comment on ' + address} placeholder={(here ? 'Reply on ' : 'Comment on ') + address + '…'} value={text}
                        onChange={(e) => setText(e.target.value)} onKeyDown={keys(send)} />
                    <div className="ks-dialog-actions"><span style={{ flex: 1 }} />
                        <button type="button" className="ks-button ks-primary" disabled={!text.trim()} onClick={send}>{here ? 'Reply' : 'Comment'}</button>
                    </div>
                </div>
            ) : null}
            <div className="ks-tabs-choice" role="tablist">
                <button type="button" role="tab" aria-selected={show === 'open'} className={show === 'open' ? 'ks-on' : ''} onClick={() => setShow('open')}>Open</button>
                <button type="button" role="tab" aria-selected={show === 'resolved'} className={show === 'resolved' ? 'ks-on' : ''} onClick={() => setShow('resolved')}>Resolved</button>
            </div>
            {threads.length ? null : <p className="ks-panel-help">{show === 'open' ? 'No open comments on this sheet.' : 'No resolved comments.'}</p>}
            <ol className="ks-thread-list">
                {threads.map((t) => {
                    const mine = t.at.r === active.r && t.at.c === active.c;
                    const reply = replies[t.id] || '';
                    const sendReply = () => { if (reply.trim() && run(() => wb.replyComment(s, t.id, reply, how))) setReplies({ ...replies, [t.id]: '' }); };
                    return (
                        <li key={t.id} className={'ks-thread' + (mine ? ' ks-current' : '')} data-thread={t.id}>
                            <div className="ks-thread-head">
                                <button type="button" className="ks-thread-cell" onClick={() => onGo(t.at.r, t.at.c)}>{rectText({ r1: t.at.r, c1: t.at.c, r2: t.at.r, c2: t.at.c })}</button>
                                {can('comment.resolve') ? <button type="button" className="ks-tool" aria-label={t.resolved ? 'Reopen' : 'Resolve'} title={t.resolved ? 'Reopen' : 'Resolve'}
                                    onClick={() => run(() => wb.resolveComment(s, t.id, !t.resolved, how))}>{t.resolved ? '↺' : '✓'}</button> : null}
                            </div>
                            <ol className="ks-comment-list">
                                {t.items.map((item) => (
                                    <li key={item.id} className="ks-comment">
                                        <div className="ks-comment-by"><b>{item.by && item.by.name}</b><span>{when(item.at, locale)}{item.edited ? ' (edited)' : ''}</span>
                                            <span className="ks-comment-tools">
                                                {can('comment.edit') || can('comment.moderate') ? <button type="button" aria-label="Edit comment" title="Edit" onClick={() => setEditing({ thread: t.id, item: item.id, text: item.text })}>✎</button> : null}
                                                {can('comment.delete') || can('comment.moderate') ? <button type="button" aria-label="Delete comment" title="Delete" onClick={() => run(() => wb.deleteComment(s, t.id, item.id, how))}><Icon name="trash" /></button> : null}
                                            </span>
                                        </div>
                                        {editing && editing.item === item.id ? (
                                            <div className="ks-comment-edit">
                                                <textarea aria-label="Edit comment" value={editing.text} autoFocus onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                                                    onKeyDown={keys(() => { if (run(() => wb.editComment(s, t.id, item.id, editing.text, how))) setEditing(null); })} />
                                                <div className="ks-dialog-actions"><span style={{ flex: 1 }} />
                                                    <button type="button" className="ks-button" onClick={() => setEditing(null)}>Cancel</button>
                                                    <button type="button" className="ks-button ks-primary" onClick={() => { if (run(() => wb.editComment(s, t.id, item.id, editing.text, how))) setEditing(null); }}>Save</button>
                                                </div>
                                            </div>
                                        ) : <p className="ks-comment-text">{item.text}</p>}
                                    </li>
                                ))}
                            </ol>
                            {can('comment.reply') && !mine ? (
                                <div className="ks-comment-new">
                                    <textarea aria-label={'Reply on ' + rectText({ r1: t.at.r, c1: t.at.c, r2: t.at.r, c2: t.at.c })} placeholder="Reply…" value={reply}
                                        onChange={(e) => setReplies({ ...replies, [t.id]: e.target.value })} onKeyDown={keys(sendReply)} />
                                    {reply.trim() ? <div className="ks-dialog-actions"><span style={{ flex: 1 }} /><button type="button" className="ks-button ks-primary" onClick={sendReply}>Reply</button></div> : null}
                                </div>
                            ) : null}
                        </li>
                    );
                })}
            </ol>
        </aside>
    );
}
