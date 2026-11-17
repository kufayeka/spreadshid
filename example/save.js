// A page for test/grid-save.test.js: a sheet whose host saves (onSave). Every save is written down in window.__saves; the test makes the next save
// slow (window.__slow) or fail (window.__fail) to see the items greyed while it runs and the error told.
import { createRoot } from 'react-dom/client';
import { Sheet } from '../src/index.js';
import { createWorkbook } from '../src/core/index.js';
import '../src/sheet.css';

const wb = createWorkbook();
wb.setValues('Sheet1', 'A1', [['Item', 'Price'], ['Pile', 400]]);
window.__workbook = wb;
window.__saves = [];
window.__notices = [];

async function onSave({ mode, doc }) {
    window.__saves.push({ mode, id: doc.id });
    if (window.__slow) await new Promise((done) => setTimeout(done, window.__slow));
    if (window.__fail) throw new Error(window.__fail);
}

createRoot(document.getElementById('root')).render(
    <Sheet workbook={wb} style={{ height: '100%' }} onSave={onSave} onNotice={(n) => { window.__notices.push({ kind: n.kind, reason: n.reason, action: n.action }); }} />
);
