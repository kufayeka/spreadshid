// What a person types into a cell, read as Google Sheets reads it: "=..." is a formula, "12.5" a number, "12%" a number (0.12), "TRUE" a boolean,
// "'123" the text 123 (the apostrophe says "keep it as text"), anything else a text. Numbers with the separators of a locale ("1.234,5") come with the
// locale settings of the workbook (step R3); here the plain form is read.

const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;
const GROUPED = /^[-+]?\d{1,3}(?:,\d{3})+(?:\.\d*)?$/;

/**
 * @param {string} text
 * @returns {{ formula: string } | { value: string|number|boolean|undefined }}
 */
export function parseInput(text) {
    const s = String(text);
    if (s === '') return { value: undefined };
    if (s[0] === "'") return { value: s.slice(1) };
    if (s.length > 1 && s[0] === '=') return { formula: s };
    const t = s.trim();
    if (/^true$/i.test(t)) return { value: true };
    if (/^false$/i.test(t)) return { value: false };
    if (NUMBER.test(t)) return { value: Number(t) };
    if (GROUPED.test(t)) return { value: Number(t.replace(/,/g, '')) };
    if (/%$/.test(t) && NUMBER.test(t.slice(0, -1).trim())) return { value: Number(t.slice(0, -1).trim()) / 100 };
    return { value: s };
}
