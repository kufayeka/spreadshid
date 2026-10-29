// The functions of xlfuncs-extra.js (finance, construction, schedules, analysis, text and checks), against the answers Excel gives: most numbers are
// the examples of Excel's own help pages for each function.
//   node test/formulas-extra.test.js
import assert from 'node:assert';
import { createWorkbook, isError } from '../src/core/index.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID' });
const s = wb.sheet('Sheet1');
let row = 40;
// a formula in a cell of its own, its value rounded to the 10th decimal (an error as its code)
const calc = (f) => { s.setValues(row, 0, f); const v = s.value(row++, 0); return isError(v) ? v.code : typeof v === 'number' ? Math.round(v * 1e10) / 1e10 : v; };
const near = (f, want, digits = 2) => { const got = calc(f); assert.ok(typeof got === 'number' && Math.abs(got - want) < Math.pow(10, -digits), f + ' -> ' + got + ', Excel gives ' + want); };
const date = (y, m, d) => 'DATE(' + y + ',' + m + ',' + d + ')';

// ---- finance: loans
near('=NPER(0.12/12,-100,-1000,10000,1)', 59.6738657, 6);
near('=NPER(0.12/12,-100,-1000,10000)', 60.0821229, 6);
near('=NPER(0,-100,1000)', 10, 6);
near('=RATE(4*12,-200,8000)', 0.0077014724, 8);
near('=IPMT(0.1/12,1,3*12,8000)', -66.67);
near('=IPMT(0.1,3,3,8000)', -292.45);
near('=PPMT(0.1/12,1,2*12,2000)', -75.62);
near('=PPMT(0.08,10,10,200000)', -27598.05);
near('=IPMT(0.1/12,6,36,8000)+PPMT(0.1/12,6,36,8000)-PMT(0.1/12,36,8000)', 0, 6);
assert.strictEqual(calc('=IPMT(0.1,4,3,8000)'), '#NUM!', 'a period past the last one');
near('=CUMIPMT(0.09/12,30*12,125000,13,24,0)', -11135.23);
near('=CUMIPMT(0.09/12,30*12,125000,1,1,0)', -937.50);
near('=CUMPRINC(0.09/12,30*12,125000,13,24,0)', -934.1071234, 5);
near('=CUMPRINC(0.09/12,30*12,125000,1,1,0)', -68.27827118, 5);
assert.strictEqual(calc('=CUMIPMT(0.09/12,360,125000,0,1,0)'), '#NUM!');
near('=EFFECT(0.0525,4)', 0.0535427, 6);
near('=NOMINAL(0.053543,4)', 0.0525003, 6);
ok('loans: NPER, RATE, IPMT, PPMT, CUMIPMT, CUMPRINC, EFFECT, NOMINAL');

// ---- finance: cash flows on their own dates (a project's terms paid when they are paid)
s.setValues('H1', [[-10000], [2750], [4250], [3250], [2750]]);
s.setValues('I1', [[39448], [39508], [39751], [39859], [39904]]); // 1/1/2008, 3/1/2008, 10/30/2008, 2/15/2009, 4/1/2009
near('=XNPV(0.09,H1:H5,I1:I5)', 2086.65);
near('=XIRR(H1:H5,I1:I5)', 0.373362535, 6);
near('=XIRR(H1:H5,I1:I5,0.5)', 0.373362535, 6);
assert.strictEqual(calc('=XIRR(H2:H5,I2:I5)'), '#NUM!', 'only money coming in: no rate');
s.setValues('J1', [[-120000], [39000], [30000], [21000], [37000], [46000]]);
near('=MIRR(J1:J6,0.1,0.12)', 0.126094, 5);
near('=MIRR(J1:J4,0.1,0.12)', -0.048044655, 6);
ok('cash flows: XNPV, XIRR, MIRR');

// ---- finance: depreciation
near('=SLN(30000,7500,10)', 2250);
near('=SYD(30000,7500,10,1)', 4090.91);
near('=SYD(30000,7500,10,10)', 409.09);
near('=DDB(2400,300,10*365,1)', 1.32);
near('=DDB(2400,300,10*12,1,2)', 40);
near('=DDB(2400,300,10,1,2)', 480);
near('=DDB(2400,300,10,2,1.5)', 306);
near('=DDB(2400,300,10,10)', 22.12);
[[1, 186083.33], [2, 259639.42], [3, 176814.44], [4, 120410.64], [5, 81999.64], [6, 55841.76], [7, 15845.10]]
    .forEach(([p, want]) => near('=DB(1000000,100000,6,' + p + ',7)', want));
ok('depreciation: SLN, SYD, DDB, DB');

// ---- construction
near('=DEGREES(ATAN2(1,1))', 45, 9);
near('=SIN(RADIANS(30))', 0.5, 9);
near('=COS(PI())', -1, 9);
near('=DEGREES(ATAN(3/4))', 36.869898, 6);
near('=DEGREES(ASIN(0.5))+DEGREES(ACOS(0.5))', 90, 9);
assert.strictEqual(calc('=ASIN(2)'), '#NUM!');
assert.strictEqual(calc('=ATAN2(0,0)'), '#DIV/0!');
assert.deepStrictEqual([calc('=QUOTIENT(100,12)'), calc('=QUOTIENT(-10,3)'), calc('=QUOTIENT(1,0)')], [8, -3, '#DIV/0!']);
assert.deepStrictEqual([calc('=EVEN(1.5)'), calc('=EVEN(3)'), calc('=EVEN(2)'), calc('=EVEN(-1)')], [2, 4, 2, -2]);
assert.deepStrictEqual([calc('=ODD(1.5)'), calc('=ODD(3)'), calc('=ODD(2)'), calc('=ODD(-1)'), calc('=ODD(-2)'), calc('=ODD(0)')], [3, 3, 3, -1, -3, 1]);
assert.deepStrictEqual([calc('=CEILING.MATH(24.3,5)'), calc('=CEILING.MATH(6.7)'), calc('=CEILING.MATH(-8.1,2)'), calc('=CEILING.MATH(-5.5,2,-1)')], [25, 7, -8, -6]);
assert.deepStrictEqual([calc('=FLOOR.MATH(24.3,5)'), calc('=FLOOR.MATH(6.7)'), calc('=FLOOR.MATH(-8.1,2)'), calc('=FLOOR.MATH(-5.5,2,-1)')], [20, 6, -10, -4]);
assert.strictEqual(calc('=SUMSQ(3,4)'), 25);
near('=CONVERT(1,"lbm","kg")', 0.4535924, 7);
near('=CONVERT(68,"F","C")', 20, 9);
near('=CONVERT(100,"ft2","m2")', 9.290304, 6);
near('=CONVERT(1,"m3","l")', 1000, 9);
near('=CONVERT(2.5,"km","m")', 2500, 9);
near('=CONVERT(1,"cm2","m2")', 0.0001, 9);
near('=CONVERT(1,"Mg","kg")', 1000, 9);
near('=CONVERT(1,"ton","kg")', 907.18474, 5);
near('=CONVERT(1,"psi","kPa")', 6.894757, 6);
near('=CONVERT(1,"HP","kW")', 0.7456999, 7);
assert.strictEqual(calc('=CONVERT(2.5,"ft","sec")'), '#N/A', 'units of other kinds');
assert.strictEqual(calc('=CONVERT(1,"m","furlong")'), '#N/A', 'a unit it does not know');
ok('construction: angles, QUOTIENT, EVEN, ODD, CEILING.MATH, FLOOR.MATH, SUMSQ, CONVERT');

// ---- schedules
assert.strictEqual(calc('=WORKDAY.INTL(' + date(2012, 1, 1) + ',30,0)'), '#NUM!');
assert.strictEqual(calc('=WORKDAY.INTL(' + date(2012, 1, 1) + ',90,11)'), 41013);
assert.strictEqual(calc('=WORKDAY.INTL(' + date(2012, 1, 1) + ',30,17)'), 40944);
assert.strictEqual(calc('=WORKDAY.INTL(' + date(2012, 1, 1) + ',30,"0000001")'), calc('=WORKDAY.INTL(' + date(2012, 1, 1) + ',30,11)'), 'a text weekend');
assert.strictEqual(calc('=WORKDAY.INTL(' + date(2012, 1, 1) + ',30,"1111111")'), '#VALUE!');
assert.strictEqual(calc('=NETWORKDAYS.INTL(' + date(2006, 1, 1) + ',' + date(2006, 1, 31) + ')'), 22);
assert.strictEqual(calc('=NETWORKDAYS.INTL(' + date(2006, 2, 28) + ',' + date(2006, 1, 31) + ')'), -21);
s.setValues('L1', [[38719], [38733]]); // 2 Jan 2006, 16 Jan 2006
assert.strictEqual(calc('=NETWORKDAYS.INTL(' + date(2006, 1, 1) + ',' + date(2006, 2, 1) + ',7,L1:L2)'), 22);
assert.strictEqual(calc('=NETWORKDAYS.INTL(' + date(2006, 1, 1) + ',' + date(2006, 2, 1) + ',"0010001",L1:L2)'), 20);
assert.strictEqual(calc('=NETWORKDAYS.INTL(' + date(2026, 10, 1) + ',' + date(2026, 10, 31) + ',11)'), 27, 'October 2026, six working days a week');
assert.strictEqual(calc('=DAYS360(' + date(2011, 1, 30) + ',' + date(2011, 12, 31) + ')'), 330);
assert.strictEqual(calc('=DAYS360(' + date(2011, 1, 15) + ',' + date(2011, 1, 31) + ')'), 16);
assert.strictEqual(calc('=DAYS360(' + date(2011, 1, 15) + ',' + date(2011, 2, 28) + ')'), 43);
assert.strictEqual(calc('=DAYS360(' + date(2011, 1, 30) + ',' + date(2011, 12, 31) + ',TRUE)'), 330);
near('=YEARFRAC(' + date(2012, 1, 1) + ',' + date(2012, 7, 30) + ')', 0.58055556, 7);
near('=YEARFRAC(' + date(2012, 1, 1) + ',' + date(2012, 7, 30) + ',1)', 0.57650273, 7);
near('=YEARFRAC(' + date(2012, 1, 1) + ',' + date(2012, 7, 30) + ',3)', 0.57808219, 7);
near('=YEARFRAC(' + date(2012, 1, 1) + ',' + date(2012, 7, 30) + ',2)', 0.58611111, 7);
near('=YEARFRAC(' + date(2010, 3, 15) + ',' + date(2013, 9, 1) + ',1)', 1266 / 365.25, 9); // 1266 days over the average year of 2010-2013 (1461 / 4)
assert.strictEqual(calc('=DATEVALUE("2008-08-22")'), 39682);
assert.strictEqual(calc('=DATEVALUE("22/8/2008")'), 39682, 'day first in the id-ID locale');
assert.strictEqual(calc('=DATEVALUE("22/8/2008 13:05")'), 39682);
assert.strictEqual(calc('=DATEVALUE("bukan tanggal")'), '#VALUE!');
near('=TIMEVALUE("2:24 AM")', 0.1, 9);
near('=TIMEVALUE("22/8/2008 6:35 AM")', 0.274305556, 8);
ok('schedules: WORKDAY.INTL, NETWORKDAYS.INTL, DAYS360, YEARFRAC, DATEVALUE, TIMEVALUE');

// ---- analysis
s.setValues('N1', [[2, 6], [3, 5], [9, 11], [1, 7], [8, 5], [7, 4], [5, 4]]);
near('=SLOPE(N1:N7,O1:O7)', 0.305556, 6);
near('=INTERCEPT(N1:N5,O1:O5)', 0.0483871, 7);
s.setValues('Q1', [[6, 20], [7, 28], [9, 31], [15, 38], [21, 40]]);
near('=FORECAST(30,Q1:Q5,R1:R5)', 10.607253, 6);
near('=FORECAST.LINEAR(30,Q1:Q5,R1:R5)', 10.607253, 6);
s.setValues('T1', [[3, 9], [2, 7], [4, 12], [5, 15], [6, 17]]);
near('=CORREL(T1:T5,U1:U5)', 0.997054, 6);
near('=TREND(Q1:Q5,R1:R5,30)', 10.607253, 6);
near('=TREND(Q1:Q5)', 4, 9); // x = 1, 2, 3 ...: slope 38 / 10 = 3.8, intercept 11.6 - 11.4 = 0.2, so 4 at x = 1
near('=TREND(Q1:Q5,,6)', 23, 9);
s.setValues('W1', [[1], [2], [3], [4]]);
near('=PERCENTILE(W1:W4,0.3)', 1.9, 9);
near('=PERCENTILE.INC(W1:W4,1)', 4, 9);
s.setValues('X1', [[1], [2], [3], [6], [6], [6], [7], [8], [9]]);
near('=PERCENTILE.EXC(X1:X9,0.25)', 2.5, 9);
assert.strictEqual(calc('=PERCENTILE.EXC(X1:X9,0.01)'), '#NUM!');
s.setValues('Y1', [[1], [2], [4], [7], [8], [9], [10], [12]]);
near('=QUARTILE(Y1:Y8,1)', 3.5, 9);
s.setValues('Z1', [[6], [7], [15], [36], [39], [40], [41], [42], [43], [47], [49]]);
near('=QUARTILE.EXC(Z1:Z11,1)', 15, 9);
near('=QUARTILE.EXC(Z1:Z11,3)', 43, 9);
s.setValues('B1', [[5.6], [4], [4], [3], [2], [4]]);
assert.strictEqual(calc('=MODE(B1:B6)'), 4);
assert.strictEqual(calc('=MODE.SNGL(1,2,3)'), '#N/A', 'no number comes twice');
// AGGREGATE: a total that keeps working although a cell of its range holds an error, or rows are hidden
s.setValues('C1', [[10], ['=1/0'], [30], [5], ['=SUBTOTAL(9,C1:C4)']]);
assert.strictEqual(calc('=MAX(C1:C4)'), '#DIV/0!');
assert.strictEqual(calc('=AGGREGATE(4,6,C1:C4)'), 30, 'MAX leaving out the errors');
assert.strictEqual(calc('=AGGREGATE(14,6,C1:C4,2)'), 10, 'the second largest');
assert.strictEqual(calc('=AGGREGATE(9,7,C1:C5)'), 45, 'SUM leaves out the error and the SUBTOTAL below');
assert.strictEqual(calc('=AGGREGATE(9,4,C1:C4)'), '#DIV/0!', 'option 4 leaves out nothing');
s.setValues('D1', [[1], [2], [100], [3]]);
s.setRowProps('3', { hidden: true });
assert.strictEqual(calc('=AGGREGATE(9,5,D1:D4)'), 6, 'a hidden row left out');
assert.strictEqual(calc('=AGGREGATE(9,4,D1:D4)'), 106);
ok('analysis: SLOPE, INTERCEPT, FORECAST, CORREL, TREND, PERCENTILE, QUARTILE, MODE, AGGREGATE');

// ---- text and checks
assert.strictEqual(calc('=TEXTBEFORE("Red riding hood\'s, red hood","hood")'), 'Red riding ');
assert.strictEqual(calc('=TEXTAFTER("Red riding hood\'s, red hood","hood")'), "'s, red hood");
assert.strictEqual(calc('=TEXTAFTER("Red riding hood\'s, red hood","HOOD",2,1)'), '');
assert.strictEqual(calc('=TEXTBEFORE("PIP-34-A","-")'), 'PIP');
assert.strictEqual(calc('=TEXTBEFORE("PIP-34-A","-",-1)'), 'PIP-34');
assert.strictEqual(calc('=TEXTAFTER("PIP-34-A","-",-1)'), 'A');
assert.strictEqual(calc('=TEXTBEFORE("SMN01","-")'), '#N/A');
assert.strictEqual(calc('=TEXTBEFORE("SMN01","-",1,0,0,"tanpa kode")'), 'tanpa kode');
assert.strictEqual(calc('=TEXTBEFORE("SMN01","-",1,0,1)'), 'SMN01', 'match end: the end of the text counts as a delimiter');
near('=NUMBERVALUE("2.500,27",",",".")', 2500.27, 9);
near('=NUMBERVALUE("3.5%")', 0.035, 9);
near('=NUMBERVALUE("1 250 000")', 1250000, 9);
assert.strictEqual(calc('=NUMBERVALUE("1,2,3",",",".")'), '#VALUE!');
assert.deepStrictEqual([calc('=FIXED(1234.567,1)'), calc('=FIXED(1234.567,-1)'), calc('=FIXED(-1234.567,-1,TRUE)'), calc('=FIXED(44.332)')], ['1,234.6', '1,230', '-1230', '44.33']);
assert.deepStrictEqual([calc('=CHAR(65)'), calc('=CODE("A")'), calc('=CLEAN(CHAR(9)&"Monthly report"&CHAR(10))')], ['A', 65, 'Monthly report']);
assert.deepStrictEqual([calc('=ISEVEN(-1)'), calc('=ISEVEN(2.5)'), calc('=ISODD(5)'), calc('=ISODD(-3)')], [false, true, true, true]);
assert.deepStrictEqual([calc('=ISERR(NA())'), calc('=ISERR(1/0)'), calc('=ISNA(NA())')], [false, true, true]);
assert.deepStrictEqual([calc('=ERROR.TYPE(1/0)'), calc('=ERROR.TYPE(NA())'), calc('=ERROR.TYPE(1)')], [2, 7, '#N/A']);
s.setValues('E1', [['=1+1'], [5]]);
assert.deepStrictEqual([calc('=ISFORMULA(E1)'), calc('=ISFORMULA(E2)')], [true, false]);
ok('text and checks: TEXTBEFORE, TEXTAFTER, NUMBERVALUE, FIXED, CHAR, CODE, CLEAN, ISEVEN, ISODD, ISERR, NA, ERROR.TYPE, ISFORMULA');

console.log('\n' + passed + ' passed');
console.log('ALL OK');
