// Comments without a screen (step R6): a thread on a cell, replies, its writer's name and time, edited and taken away by its writer only, resolved and
// opened again by a reply, following its cell when a row is inserted above, undone, saved; a person who may comment but not edit comments.
//   node test/comments.test.js
import assert from 'node:assert';
import { createWorkbook } from '../src/core/index.js';

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
    const policy = { default: 'reviewer', roles: { reviewer: { can: ['comment'] }, viewer: { can: [] } }, members: { 'user:v': 'viewer' } };
    const wb = createWorkbook(null, { user: { id: 'r', name: 'Reviewer' } });
    const [s] = wb.sheetIds();
    const said = [];
    wb.on('reject', (e) => said.push(e.reason));
    wb.setAccess(policy, 'user:r');
    wb.addComment(s, 0, 0, 'Cek angka ini', user);
    wb.setValues(s, 0, 0, 5, user);
    assert.deepStrictEqual([!!wb.commentAt(s, 0, 0), wb.value(s, 0, 0), said[0]], [true, null, 'You can only view this sheet'], 'a reviewer comments, but does not edit');
    wb.setAccess(policy, 'user:v');
    wb.addComment(s, 2, 2, 'Boleh?', user);
    assert.deepStrictEqual([wb.commentAt(s, 2, 2), said[1]], [null, 'You cannot comment here'], 'a viewer without "comment" cannot');
    ok('access control: a role may comment without editing; one without "comment" may not');
}

console.log('\n' + passed + ' passed');
console.log('ALL OK');
