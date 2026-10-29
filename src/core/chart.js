// Charts: what a chart is made of, read from its range of cells. Pure (no DOM): the workbook keeps the chart (charts in a sheet's props), this file
// turns the cells it points at into what is drawn, and the drawing itself is the React side's (src/react/chart).
//
// A chart is kept as:
//   { id, type, at: { r1, c1, r2, c2 } (the ids of the rows and columns of the cells it covers), data: { s, r1, c1, r2, c2 } (the ids of its data),
//     seriesIn: 'auto' | 'cols' | 'rows', title, subtitle, legend, labels, stacked, grid, smooth, background, align, y, y2, series: [...], ... }
// so it moves with its cells when rows or columns are inserted or deleted above or left of it, as a named range does.

/** The kinds of chart. */
export const CHART_TYPES = ['column', 'bar', 'line', 'area', 'pie', 'donut', 'combo', 'bullet', 'waterfall'];

/** What a new chart starts with (anything the host leaves out). */
export const CHART_DEFAULTS = Object.freeze({
    type: 'column', seriesIn: 'auto', title: '', subtitle: '', legend: 'top', labels: false, stacked: false, grid: true, smooth: false,
    markers: true, background: 'white', align: 'fit', xAxis: true, yAxis: true
});

// a cell's value counts as a number of the chart when it is a number (a date is a number too); text, empty cells and errors do not
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * The categories and series of a chart, read from its block of cells the way Excel reads a selection:
 *   - the series run down the columns when the block has at least as many rows as columns, else along the rows (seriesIn 'cols' / 'rows' says so);
 *   - the first row holds the series' names when it has text and no numbers (past the category column);
 *   - the first column holds the categories when it has text (or the chart's `categories` is true), else they are 1, 2, 3 ...
 * A cell that is not a number is a gap (null): a line breaks there and a column is left out.
 *
 * @param {Array<Array<{ value: any, text: string }>>} block  The cells of the data range, row by row: their value and the text they show.
 * @param {{ seriesIn?: string, categories?: boolean, series?: Array<object> }} spec
 * @returns {{ categories: string[], series: Array<{ name: string, values: Array<number|null>, index: number }>, seriesIn: 'cols'|'rows' }}
 */
export function chartSeries(block, spec = {}) {
    const rows = block.length, cols = rows ? block[0].length : 0;
    if (!rows || !cols) return { categories: [], series: [], seriesIn: 'cols' };
    const by = spec.seriesIn === 'rows' || spec.seriesIn === 'cols' ? spec.seriesIn : rows >= cols ? 'cols' : 'rows';
    // worked on as series down the columns: a block of series along its rows is turned first
    const m = by === 'cols' ? block : block[0].map((_, c) => block.map((row) => row[c]));
    const R = m.length, C = m[0].length;
    // (the first row is left out of the test: it may be the header, "Bulan", over a column of numbers)
    const catCol = spec.categories === true || (spec.categories !== false && C > 1 && m.slice(1).some((row) => isText(row[0].value)));
    const from = catCol ? 1 : 0;
    const head = m[0].slice(from);
    const headerRow = R > 1 && head.some((x) => isText(x.value)) && !head.some((x) => isNum(x.value));
    const body = headerRow ? m.slice(1) : m;
    const categories = body.map((row, i) => (catCol ? String(row[0].text !== undefined && row[0].text !== '' ? row[0].text : row[0].value ?? '') : String(i + 1)));
    const series = [];
    for (let c = from; c < C; c++) {
        const own = (spec.series && spec.series[c - from]) || {};
        const name = own.name || (headerRow ? String(m[0][c].text || m[0][c].value || '') : 'Series ' + (c - from + 1));
        // the format of the series' first number (a percent column makes a percent axis, money a money axis)
        const first = body.find((row) => isNum(row[c].value));
        series.push({ name, values: body.map((row) => (isNum(row[c].value) ? row[c].value : null)), index: c - from, format: (first && first[c].format) || null });
    }
    // how the block was read, for whoever needs the cells of each part (the Excel file names each series' own range)
    return { categories, series, seriesIn: by, layout: { by, catCol, headerRow } };
}

/** "Sheet1!A1:D7" or "A1:D7" (the chart's own sheet) as { sheet, range } parts; null when it is not a range. */
export function splitRangeText(text) {
    const m = /^\s*(?:(?:'((?:[^']|'')+)'|([^!'"]+))!)?\s*\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?\s*$/.exec(String(text || ''));
    if (!m) return null;
    const sheet = m[1] ? m[1].replace(/''/g, "'") : m[2] ? m[2].trim() : null;
    return { sheet, a: m[3] + m[4], b: m[5] ? m[5] + m[6] : m[3] + m[4] };
}
