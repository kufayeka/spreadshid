// What a cell shows: its value through its format, in the workbook's locale, and where the text sits when the style does not say. Numbers (dates and
// money too) sit on the right, booleans in the middle, texts on the left, as in Google Sheets.

import { isError } from './formula/xlvalue.js';
import { formatValue } from './format.js';

/**
 * @param {any} value  The value of the cell (a formula worked out, or what was typed).
 * @param {object} [format]  The cell's format (or its column's).
 * @param {{ locale?: string, currency?: string }} [settings]  The workbook's.
 * @param {{ suffixText?: string }} [extra]  What the format takes from the row (the unit of a quantity).
 * @returns {{ text: string, align: 'left'|'center'|'right', kind: 'empty'|'number'|'text'|'boolean'|'error', color?: string }}
 */
export function displayOf(value, format, settings, extra) {
    if (value === null || value === undefined || value === '') return { text: '', align: 'left', kind: 'empty' };
    if (isError(value)) return { text: value.code, align: 'center', kind: 'error' };
    if (typeof value === 'boolean') return { text: value ? 'TRUE' : 'FALSE', align: 'center', kind: 'boolean' };
    if (typeof value === 'number') { const f = formatValue(value, format, settings, extra); return { text: f.text, align: 'right', kind: 'number', color: f.color }; }
    const f = format ? formatValue(String(value), format, settings, extra) : { text: String(value) };
    return { text: f.text, align: 'left', kind: 'text', color: f.color };
}
