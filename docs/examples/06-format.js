import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const sh = wb.sheet('Sheet1');

const contoh = [
    [1234567.891, { type: 'general' }],
    [1234567.891, { type: 'number', decimals: 2 }],
    [1234567.891, { type: 'number', decimals: 0, thousands: false }],
    [1250000, { type: 'money', decimals: 0 }],
    [1250000, { type: 'money', currency: 'USD', decimals: 2 }],
    [-1250000, { type: 'money', decimals: 0, negative: 'parens' }],
    [0.125, { type: 'percent', decimals: 1 }],
    [123456, { type: 'scientific', decimals: 2 }],
    [46321, { type: 'date' }],
    [46321, { type: 'date', pattern: 'd MMMM yyyy' }],
    [46321.5625, { type: 'datetime' }],
    [0.5625, { type: 'time', pattern: 'HH:mm' }],
    [1.25, { type: 'duration' }],
    [850, { type: 'number', decimals: 0, suffix: ' m3' }],
    [12, { type: 'number', decimals: 0, prefix: 'Termin ' }],
    [-42.5, { type: 'custom', pattern: '#,##0.00;[Red](#,##0.00);"-"' }],
    ['007', { type: 'text' }]
];
contoh.forEach(([v, format], i) => {
    sh.setValues(i, 0, typeof v === 'string' ? "'" + v : v);
    sh.setStyle({ r1: i, c1: 0, r2: i, c2: 0 }, { format });
    const d = sh.display(i, 0);
    console.log(JSON.stringify(format).padEnd(66), '->', d.text + (d.color ? '  (warna ' + d.color + ')' : ''));
});
