// The chart editor offers everything the code can do: every key of ChartSpec, ChartSeriesSpec, ChartAxis and SparklineSpec (as the types declare them)
// has its field in the editor's list (src/react/chart/props.js), from which the editor and the docs' reference are made. A key added to the types and
// not to the editor fails here.
//   node test/chart-props.test.js
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { CHART_FIELDS, SPARKLINE_FIELDS, NODES, fieldsOf, valueAt, patchFor } from '../src/react/chart/props.js';
import { CHART_TYPES } from '../src/core/index.js';

let passed = 0;
const ok = (label) => { passed++; console.log('ok   ' + label); };
const types = readFileSync(new URL('../src/types/core.d.ts', import.meta.url), 'utf8');
// the keys of an interface, from its body in the declarations (comments and the index signature left out)
function keysOf(name) {
    const at = types.indexOf('export interface ' + name);
    assert.ok(at >= 0, name + ' is declared');
    let depth = 0, i = types.indexOf('{', at), start = i;
    for (; i < types.length; i++) { if (types[i] === '{') depth++; else if (types[i] === '}' && --depth === 0) break; }
    const body = types.slice(start + 1, i).replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    // only the keys at the first level of the body
    let level = 0, flat = '';
    for (const ch of body) { if (ch === '{' || ch === '(' || ch === '<') level++; if (level === 0) flat += ch; if (ch === '}' || ch === ')' || ch === '>') level--; }
    return [...flat.matchAll(/(?:^|[;\n,]|\s)([a-zA-Z][\w]*)\??\s*:/g)].map((m) => m[1]);
}
const offered = new Set(CHART_FIELDS.map((f) => f.key));
const sparkOffered = new Set(SPARKLINE_FIELDS.map((f) => f.key));

const chartKeys = keysOf('ChartSpec').filter((k) => k !== 'series');
assert.deepStrictEqual(chartKeys.filter((k) => !offered.has(k) && !['y', 'y2', 'x'].includes(k)), [], 'every key of ChartSpec has its field in the editor');
const axisKeys = keysOf('ChartAxis');
for (const a of ['y', 'y2']) assert.deepStrictEqual(axisKeys.filter((k) => !offered.has(a + '.' + k)), [], 'every key of ChartAxis, for ' + a);
assert.deepStrictEqual(axisKeys.filter((k) => !offered.has('x.' + k)), [], 'every key of ChartAxis, for a scatter\'s x');
const seriesKeys = keysOf('ChartSeriesSpec');
assert.deepStrictEqual(seriesKeys.filter((k) => !offered.has('series.' + k)), [], 'every key of ChartSeriesSpec has its field in the series node');
assert.deepStrictEqual(keysOf('SparklineSpec').filter((k) => !sparkOffered.has(k)), [], 'every key of SparklineSpec has its field in the sparkline editor');
ok('the editor offers every setting of a chart, a series, an axis and a sparkline group (' + (chartKeys.length + axisKeys.length * 3 + seriesKeys.length) + ' keys)');

// every field stands in a node of the tree, and every kind of chart has a type field and something in each of its nodes
const nodeIds = new Set(NODES.map((n) => n.id));
assert.deepStrictEqual(CHART_FIELDS.filter((f) => !nodeIds.has(f.node)).map((f) => f.key), [], 'every field is in a node');
for (const type of CHART_TYPES) {
    for (const n of NODES) if ((!n.for || n.for.includes(type)) && n.id !== 'series') assert.ok(fieldsOf(n.id, type).length, 'the node ' + n.id + ' has fields for ' + type);
}
ok('every field stands in a node of the tree; no node is empty for any kind of chart');

// reading and writing a setting, inside an axis too
assert.strictEqual(valueAt({ y: { min: 0 } }, 'y.min'), 0);
assert.deepStrictEqual(patchFor({ y: { min: 0, max: 1 } }, 'y.max', ''), { y: { min: 0 } }, 'an empty value takes the setting away, the rest of the axis stays');
assert.deepStrictEqual(patchFor({ y: { min: 0 } }, 'y.min', undefined), { y: undefined }, 'the last one takes the axis away');
assert.deepStrictEqual(patchFor({}, 'title', 'X'), { title: 'X' });
ok('a setting is read and written by its key, inside an axis too');

console.log('\n' + passed + ' passed');
console.log('ALL OK');
