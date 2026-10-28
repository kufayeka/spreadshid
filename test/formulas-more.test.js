// The functions construction and finance sheets need (array arithmetic, SUMPRODUCT, working days, month ends, loans, cash flows, OFFSET, INDIRECT)
// and TERBILANG, against the answers Excel gives.
//   node test/formulas-more.test.js
import assert from 'node:assert';
import { createWorkbook, isError } from '../src/core/index.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };
const wb = createWorkbook();
const s = wb.sheet('Sheet1');
s.setValues('A1', [[2, 1000, 'Semen'], [3, 2000, 'Besi'], [4, 500, 'Semen']]);
s.setValues('E1', [[46300], [46301], [-1000], [300], [400], [500]]);
let row = 20;
const calc = (f) => { s.setValues(row, 0, f); const v = s.value(row++, 0); return isError(v) ? v.code : typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v; };

assert.strictEqual(calc('=SUM(A1:A3*B1:B3)'), 10000);
assert.strictEqual(calc('=SUM((C1:C3="Semen")*A1:A3*B1:B3)'), 4000);
assert.strictEqual(calc('=SUM(--(A1:A3>2))'), 2);
assert.strictEqual(calc('=SUM(A1:A3*B1:B2)'), '#N/A', 'ranges of other sizes: #N/A, as in Excel');
assert.strictEqual(calc('=A1:A3*10'), 20, 'an array alone in a cell shows its first value');
ok('ranges in arithmetic work cell by cell');

assert.strictEqual(calc('=SUMPRODUCT(A1:A3,B1:B3)'), 10000);
assert.strictEqual(calc('=SUMPRODUCT(--(C1:C3="Semen"),A1:A3)'), 6);
assert.strictEqual(calc('=SUMPRODUCT(A1:A3,B1:B2)'), '#VALUE!');
assert.strictEqual(calc('=MROUND(1234,50)'), 1250);
assert.strictEqual(calc('=LOOKUP(3.5,A1:A3,B1:B3)'), 2000);
ok('SUMPRODUCT, MROUND, LOOKUP');

// 1 October 2026 is a Thursday
assert.strictEqual(calc('=WORKDAY(46296,10)'), 46310, '10 working days on: 15 October');
assert.strictEqual(calc('=WORKDAY(46296,10,E1:E2)'), 46314, 'with 5 and 6 October off: 19 October');
assert.strictEqual(calc('=WORKDAY(46310,-10)'), 46296);
assert.strictEqual(calc('=NETWORKDAYS(46296,46325)'), 22);
assert.strictEqual(calc('=EOMONTH(46296,0)'), 46326);
assert.strictEqual(calc('=EOMONTH(46296,2)'), 46387);
assert.strictEqual(calc('=EOMONTH(46296,-1)'), 46295);
assert.strictEqual(calc('=WEEKNUM(46296)'), 40);
assert.strictEqual(calc('=ISOWEEKNUM(46296)'), 40);
assert.strictEqual(calc('=ISOWEEKNUM(46022)'), 1, '1 January 2026, a Thursday, is in ISO week 1');
assert.strictEqual(calc('=DAYS(46325,46296)'), 29);
ok('working days, month ends, weeks and days');

assert.strictEqual(calc('=ROUND(PMT(0.01,12,-1000000),2)'), 88848.79);
assert.strictEqual(calc('=ROUND(FV(0.01,12,-100),2)'), 1268.25);
assert.strictEqual(calc('=ROUND(PV(0.01,12,-100),2)'), 1125.51);
assert.strictEqual(calc('=ROUND(NPV(0.1,100,200),3)'), 256.198);
assert.strictEqual(calc('=ROUND(IRR(E3:E6),4)'), 0.089);      // 8,90%, as Excel
ok('PMT, FV, PV, NPV, IRR');

assert.strictEqual(calc('=OFFSET(A1,1,1)'), 2000);
assert.strictEqual(calc('=SUM(OFFSET(A1,0,0,3,1))'), 9);
assert.strictEqual(calc('=INDIRECT("B2")'), 2000);
assert.strictEqual(calc('=SUM(INDIRECT("Sheet1!A1:A3"))'), 9);
const at = row;
s.setValues(at, 0, '=INDIRECT("B" & 2)');
s.setValues('B2', 2500);
assert.strictEqual(s.value(at, 0), 2500, 'INDIRECT follows the cell it names when that cell changes');
row++;
assert.strictEqual(calc('=SUM(TRANSPOSE(A1:A3))'), 9);
assert.strictEqual(calc('=HYPERLINK("http://x","buka")'), 'buka');
ok('OFFSET, INDIRECT, TRANSPOSE, HYPERLINK');

assert.strictEqual(calc('=TERBILANG(1250000)'), 'satu juta dua ratus lima puluh ribu');
assert.strictEqual(calc('=TERBILANG(7714500,"rupiah")'), 'tujuh juta tujuh ratus empat belas ribu lima ratus rupiah');
assert.strictEqual(calc('=TERBILANG(1000)'), 'seribu');
assert.strictEqual(calc('=TERBILANG(11111)'), 'sebelas ribu seratus sebelas');
assert.strictEqual(calc('=TERBILANG(1000001)'), 'satu juta satu');
assert.strictEqual(calc('=TERBILANG(2000000000)'), 'dua miliar');
assert.strictEqual(calc('=TERBILANG(1250.75)'), 'seribu dua ratus lima puluh koma tujuh lima');
assert.strictEqual(calc('=TERBILANG(-5)'), 'minus lima');
assert.strictEqual(calc('=TERBILANG(0)'), 'nol');
assert.strictEqual(calc('=PROPER(TERBILANG(1500)) & " Rupiah"'), 'Seribu Lima Ratus Rupiah');
ok('TERBILANG');

console.log('\n' + passed + ' passed');
console.log('ALL OK');
