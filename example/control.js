// A page for the tests of step R4: a BOQ with the host's rules (the rates are read only, an approved line is locked, the cost is hidden), the types of
// an API Maker Type, the protected cells drawn striped, and every event of the sheet written down where the tests read it.
import { createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Sheet } from '../src/index.js';
import { createWorkbook, fromApiMakerType, populate } from '../src/core/index.js';

const wb = createWorkbook();
const [s] = wb.sheetIds();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
wb.setSheetProps(s, { name: 'BOQ' });
wb.setValues(s, 0, 0, [
    ['Item', 'Qty', 'Rate', 'Amount', 'Status', 'Cost'],
    ['Pile', 10, 500, '=B2*C2', 'Draft', 400],
    ['Beam', 4, 900, '=B3*C3', 'Approved', 700],
    ['Slab', 2, 1200, '=B4*C4', 'Draft', 1000]
]);
wb.setStyle(s, { r1: 0, c1: 0, r2: 0, c2: 5 }, { bold: true, fill: '#e8f0fe' });
wb.saved(wb.pendingPatch());

// what the backend says this person may do
wb.setRules([
    { columns: ['Rate'], mode: 'readonly', message: 'The rates are set by the estimator' },
    { range: 'A2:F1000', when: '=$E2="Approved"', mode: 'readonly', message: 'An approved line is locked' },
    { columns: ['Cost'], mode: 'hidden' }
]);
const library = { LineStatus: { name: 'LineStatus', enum: ['Draft', 'Approved', 'Rejected'] } };
wb.setTypes(s, { headerRow: 1, fields: fromApiMakerType({ name: 'BoqLine', fields: { Qty: { type: 'int' }, Rate: { type: 'decimal', scale: 2 }, Status: { type: 'LineStatus' } } }, library).fields });

window.__workbook = wb;
window.__events = { op: [], reject: [], cellError: [], selection: [] };
window.__sheet = createRef();
window.__populate = (spec, value) => populate(wb, s, spec, value);
createRoot(document.getElementById('root')).render(
    <Sheet ref={window.__sheet} workbook={wb} showProtected style={{ height: '100%' }}
        onOp={(e) => window.__events.op.push(e)}
        onReject={(e) => window.__events.reject.push(e.reason)}
        onCellError={(e) => window.__events.cellError.push(e)}
        onSelectionChange={(sel) => window.__events.selection.push(sel.active)} />
);
