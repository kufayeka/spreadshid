// The example page: a bill of quantities of 100 000 lines in a sheet that fills the window. The tests in Chrome open this page; they reach the workbook
// through window.__workbook.
import { createRoot } from 'react-dom/client';
import { Sheet } from '../src/index.js';
import { createWorkbook } from '../src/core/index.js';

const LINES = 100000;
const wb = createWorkbook();
const [boq] = wb.sheetIds();
wb.setSheetProps(boq, { name: 'BOQ', freezeRows: 3, freezeCols: 1 });
wb.insertRows(boq, 1000, LINES + 10 - 1000);

wb.setValues(boq, 0, 0, [['Bill of quantities: Gedung A, Jakarta (this title runs on into the empty cells beside it)']]);
wb.mergeCells(boq, { r1: 1, c1: 0, r2: 1, c2: 5 });
wb.setValues(boq, 1, 0, 'Section 1: preparation and structure');
wb.setValues(boq, 2, 0, [['No', 'Description', 'Unit', 'Quantity', 'Rate', 'Amount']]);
wb.setStyle(boq, { r1: 2, c1: 0, r2: 2, c2: 5 }, { bold: true, fill: '#e8f0fe', align: 'center',
    borders: { bottom: { width: 2, color: '#1a73e8' } } });
wb.setStyle(boq, { r1: 0, c1: 0, r2: 0, c2: 0 }, { bold: true, fontSize: 14 });
wb.setStyle(boq, { r1: 1, c1: 0, r2: 1, c2: 0 }, { italic: true, align: 'center', fill: '#fef7e0' });
wb.setColProps(boq, [1], { width: 260 });
wb.setColProps(boq, [5], { width: 140, format: { type: 'money', decimals: 2 } });

const units = ['m2', 'm3', "m'", 'kg', 'ls', 'unit'];
const rows = new Array(LINES);
for (let i = 0; i < LINES; i++) {
    const n = i + 4;
    rows[i] = ["'1." + (i + 1), 'Work item number ' + (i + 1), units[i % units.length], (i % 50) + 1, 15000 + (i % 9) * 2500, '=D' + n + '*E' + n];
}
wb.setValues(boq, 3, 0, rows);
wb.setValues(boq, 0, 7, [['Total'], ['=SUM(F4:F' + (LINES + 3) + ')']]);
wb.setStyle(boq, { r1: 0, c1: 7, r2: 1, c2: 7 }, { bold: true });
wb.saved(wb.pendingPatch());

window.__workbook = wb;
createRoot(document.getElementById('root')).render(<Sheet workbook={wb} style={{ height: '100%' }} />);
