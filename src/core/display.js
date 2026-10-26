// What a cell shows: its value as text, and where the text sits when the style does not say. Numbers sit on the right, booleans in the middle, texts on
// the left, as in Google Sheets. The number formats (money, percent, dates, prefix and suffix) come with the toolbar (step R3) and are applied here.

import { formatNumber, isError } from './formula/xlvalue.js';

/**
 * @param {any} value  The value of the cell (a formula worked out, or what was typed).
 * @returns {{ text: string, align: 'left'|'center'|'right', kind: 'empty'|'number'|'text'|'boolean'|'error' }}
 */
export function displayOf(value) {
    if (value === null || value === undefined || value === '') return { text: '', align: 'left', kind: 'empty' };
    if (isError(value)) return { text: value.code, align: 'center', kind: 'error' };
    if (typeof value === 'number') return { text: formatNumber(value), align: 'right', kind: 'number' };
    if (typeof value === 'boolean') return { text: value ? 'TRUE' : 'FALSE', align: 'center', kind: 'boolean' };
    return { text: String(value), align: 'left', kind: 'text' };
}
