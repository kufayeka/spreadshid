// Comments without a screen (step R6): a thread on a cell, replies, its writer's name and time, edited and taken away by its writer only, resolved and
// opened again by a reply, following its cell when a row is inserted above, undone, saved; a person who may comment but not edit comments.
//   node test/comments.test.js
import assert from 'node:assert';
import { createWorkbook, viewFor, mergePatch, checkPatch } from '../src/core/index.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };
const user = { source: 'user' };

{
    const wb = createWorkbook(null, { user: { id: 'u1', name: 'Rina' } });
    const [s] = wb.sheetIds();
    wb.setValues(s, 1, 1, 120);
    const { thread, item } = wb.addComment(s, 1, 1, '  Volume ini dari opname minggu 3?  ', user);
    const t = wb.commentAt(s, 1, 1);
    assert.deepStrictEqual([t.id, t.items.length, t.items[0].text, t.items[0].by, typeof t.items[0].at], [thread, 1, 'Volume ini dari opname minggu 3?', { id: 'u1', name: 'Rina' }, 'string'], 'a thread, its text trimmed, who wrote it, when');
    assert.strictEqual(wb.commentAt(s, 1, 2), null, 'a cell without one');

    wb.setUser({ id: 'u2', name: 'Budi' });
    wb.addComment(s, 1, 1, 'Ya, sudah dicek', user);
    assert.deepStrictEqual(wb.commentAt(s, 1, 1).items.map((x) => [x.by.name, x.text]), [['Rina', 'Volume ini dari opname minggu 3?'], ['Budi', 'Ya, sudah dicek']], 'a comment on a cell with an open thread is a reply');
    assert.throws(() => wb.editComment(s, thread, item, 'changed', user), /only the one who wrote/, 'Budi cannot change Rina\'s comment');
    assert.throws(() => wb.addComment(s, 1, 1, '   ', user), /needs some text/);

    wb.setUser({ id: 'u1', name: 'Rina' });
    wb.editComment(s, thread, item, 'Volume dari opname minggu 3?', user);
    assert.ok(wb.commentAt(s, 1, 1).items[0].edited, 'edited by its writer, and marked so');
    wb.resolveComment(s, thread, true, user);
    assert.strictEqual(wb.commentAt(s, 1, 1), null, 'resolved: the cell shows none');
    assert.strictEqual(wb.comments(s)[0].resolved, true, 'but it is kept');
    wb.replyComment(s, thread, 'Dibuka lagi', user);
    assert.strictEqual(wb.commentAt(s, 1, 1).items.length, 3, 'a reply opens it again');

    wb.insertRows(s, 0, 2);
    assert.ok(wb.commentAt(s, 3, 1), 'it follows its cell');
    assert.deepStrictEqual(wb.comments(s)[0].at, { r: 3, c: 1 });
    wb.undo();
    wb.undo();
    assert.deepStrictEqual([wb.comments(s)[0].items.length, wb.comments(s)[0].resolved], [2, true], 'undone: the reply goes, and with it the thread is resolved again');

    const again = createWorkbook(wb.toJSON());
    assert.strictEqual(again.comments(again.sheetIds()[0])[0].items[1].text, 'Ya, sudah dicek', 'saved with the sheet');
    wb.deleteComment(s, thread, item, user);
    assert.deepStrictEqual(wb.comments(s), [], 'its first comment taken away: the thread goes');
    ok('a thread: replies, who and when, edited and taken away by its writer, resolved and opened again, follows its cell, undone, saved');
}

{
    const access = [
        { who: 'role:reviewer', effect: 'allow', action: 'read' },
        { who: 'role:reviewer', effect: 'allow', action: 'comment' },
        { who: 'role:viewer', effect: 'allow', action: 'read' }
    ];
    const wb = createWorkbook(null, { user: { id: 'r', name: 'Reviewer' } });
    const [s] = wb.sheetIds();
    const said = [];
    wb.on('reject', (e) => said.push(e.reason));
    wb.setAccess(access, { user: 'r', roles: ['reviewer'] });
    wb.addComment(s, 0, 0, 'Cek angka ini', user);
    wb.setValues(s, 0, 0, 5, user);
    assert.deepStrictEqual([!!wb.commentAt(s, 0, 0), wb.value(s, 0, 0), said[0]], [true, null, 'You can only view this here'], 'a reviewer comments, but does not edit');
    wb.setAccess(access, { user: 'v', roles: ['viewer'] });
    wb.addComment(s, 2, 2, 'Boleh?', user);
    assert.deepStrictEqual([wb.commentAt(s, 2, 2), said[1]], [null, 'You cannot comment here'], 'a viewer without "comment" cannot');
    ok('access control: a role may comment without editing; one without "comment" may not');
}

{
    // comments by CRUD: who may see, start, reply, resolve, change their own, change anyone's
    const access = [
        ...['comment.read', 'comment.create', 'comment.edit', 'comment.delete'].map((action) => ({ who: 'user:a', effect: 'allow', action })),
        ...['comment.read', 'comment.reply'].map((action) => ({ who: 'user:r', effect: 'allow', action })),
        { who: 'user:m', effect: 'allow', action: 'comment' },
        { who: 'user:x', effect: 'allow', action: 'edit' }
    ];
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    const said = [];
    wb.on('reject', (e) => said.push(e.reason));
    const as = (id) => { wb.setUser({ id, name: id.toUpperCase() }); wb.setAccess(access, id); };

    as('a');
    const { thread, item } = wb.addComment(s, 0, 0, 'Mulai', user);
    as('r');
    wb.addComment(s, 1, 1, 'Baru', user);
    assert.deepStrictEqual([wb.commentAt(s, 1, 1), said.pop()], [null, 'You cannot comment here'], 'a replier cannot start a thread');
    const reply = wb.replyComment(s, thread, 'Balas', user);
    assert.strictEqual(wb.commentAt(s, 0, 0).items.length, 2, 'but replies');
    wb.resolveComment(s, thread, true, user);
    assert.deepStrictEqual([!!wb.commentAt(s, 0, 0), said.pop()], [true, 'You cannot resolve comments here'], 'and may not resolve');
    as('a');
    assert.throws(() => wb.editComment(s, thread, reply, 'ubah', user), /only the one who wrote/, 'an author changes only their own');
    wb.editComment(s, thread, item, 'Mulai (ubah)', user);
    as('m');
    wb.editComment(s, thread, reply, 'Dirapikan moderator', user);
    assert.strictEqual(wb.commentAt(s, 0, 0).items[1].text, 'Dirapikan moderator', 'a moderator changes anyone\'s');
    as('x');
    assert.deepStrictEqual([wb.commentAt(s, 0, 0), wb.hasComment(s, 0, 0), wb.comments(s)], [null, false, []], 'a role without comment.read sees none');
    const sent = viewFor(wb.toJSON(), { access, who: 'x' });
    assert.strictEqual(sent.sheets[0].props.comments, undefined, 'and the server does not send them');
    assert.strictEqual(viewFor(wb.toJSON(), { access, who: 'r' }).sheets[0].props.comments.length, 1, 'one who may read gets them');
    // the blind one opens what they were sent, freezes a row (a change to the sheet's props) and saves: the comments they never had stay
    const stored = wb.toJSON();
    const theirs = createWorkbook(sent);
    theirs.saved(theirs.pendingPatch());
    theirs.setSheetProps(theirs.sheetIds()[0], { name: 'Renamed' });
    const kept = mergePatch(stored, theirs.pendingPatch(), { access, who: 'x' });
    assert.strictEqual(kept.sheets[0].props.comments.length, 1, 'their save does not take away the comments they were not sent');
    assert.ok(!checkPatch(stored, theirs.pendingPatch(), { access, who: 'x' }).problems.some((p) => /comment/.test(p.reason)), 'nor is it read as deleting them');
    ok('comments by CRUD: start, reply, resolve, own edit, moderate, read; the server leaves out what may not be read');
}

// a comment is dated by the workbook's clock (opt.now), as NOW() is
{
    const wb = createWorkbook(null, { user: { id: 'u', name: 'U' }, now: () => new Date(Date.UTC(2026, 9, 27, 9, 15)) });
    wb.addComment('Sheet1', 'A1', 'hai');
    assert.strictEqual(wb.comments('Sheet1')[0].items[0].at, '2026-10-27T09:15:00.000Z');
    ok('a comment is dated by the workbook clock');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
