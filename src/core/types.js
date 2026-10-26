// The types of columns, taken from Nexa API Maker's Types (types/<Name>.type.json): the sheet checks that what is written in a typed column is of its
// type, and nothing else (minimum, maximum, pattern, required ... are checked by API Maker when the data is saved). Pure (no DOM).
//
//   a Type's field           the cell takes
//   string                   any text (a number typed is kept as text: "00123" stays "00123")
//   int                      a whole number
//   number                   a number
//   decimal (scale)          a number with at most `scale` digits after the point
//   boolean                  TRUE or FALSE
//   date                     a date (a whole day)
//   datetime                 a date and a time
//   an enum (or `enum`)      one of its values
//   json, or a type          anything (not checked here)
//
// An empty cell is always allowed (whether a value is required is API Maker's to say, on save).

/**
 * @typedef {object} FieldType
 * @property {'string'|'int'|'number'|'decimal'|'boolean'|'date'|'datetime'|'any'} kind
 * @property {number} [scale]  decimal: digits after the point.
 * @property {(string|number)[]} [enum]  The values allowed.
 */

/**
 * The column types of an API Maker Type: { fields: { <field name>: FieldType } }.
 * @param {object} type  The Type's JSON.
 * @param {Object<string, object>} [library]  Other Types by name (enums, and the types it extends), so that a field of type StatusPermintaan knows its values.
 */
export function fromApiMakerType(type, library) {
    const lib = library || {};
    const fields = {};
    const add = (t) => {
        if (!t) return;
        for (const parent of [].concat(t.extends || [])) add(lib[parent]);
        for (const [name, f] of Object.entries(t.fields || {})) fields[name] = fieldType(f, lib);
    };
    add(type);
    return { name: type.name, fields };
}

/** One field of a Type as a column type. */
export function fieldType(f, library) {
    const lib = library || {};
    const named = typeof f.type === 'string' ? lib[f.type] : null;
    if (named && Array.isArray(named.enum)) return { kind: 'string', enum: named.enum.slice() };
    if (Array.isArray(f.enum)) return { kind: typeof f.enum[0] === 'number' ? 'number' : 'string', enum: f.enum.slice() };
    switch (f.type) {
        case 'string': return { kind: 'string' };
        case 'int': case 'integer': return { kind: 'int' };
        case 'number': return { kind: 'number' };
        case 'decimal': return { kind: 'decimal', scale: f.scale === undefined ? undefined : Number(f.scale) };
        case 'boolean': return { kind: 'boolean' };
        case 'date': return { kind: 'date' };
        case 'datetime': return { kind: 'datetime' };
        default: return { kind: 'any' };
    }
}

const decimalsOf = (n) => { const s = String(Number(n.toPrecision(15))); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };

/**
 * Whether a value fits a column type: null when it does, else what the column expects, in words a person reads ("a whole number", "one of: A, B").
 * A formula is judged by what it works out to.
 * @param {FieldType} t
 * @param {any} value
 */
export function checkValue(t, value) {
    if (!t || t.kind === 'any' || value === null || value === undefined || value === '') return null;
    if (t.enum && !t.enum.some((x) => x === value || String(x) === String(value))) return 'one of: ' + t.enum.join(', ');
    switch (t.kind) {
        case 'string': return null;
        case 'int': return typeof value === 'number' && Number.isInteger(value) ? null : 'a whole number';
        case 'number': return typeof value === 'number' && isFinite(value) ? null : 'a number';
        case 'decimal':
            if (typeof value !== 'number' || !isFinite(value)) return 'a number';
            return t.scale !== undefined && decimalsOf(value) > t.scale ? 'a number with at most ' + t.scale + ' digits after the point' : null;
        case 'boolean': return typeof value === 'boolean' ? null : 'TRUE or FALSE';
        case 'date': return typeof value === 'number' && Number.isInteger(value) ? null : 'a date';
        case 'datetime': return typeof value === 'number' ? null : 'a date and a time';
        default: return null;
    }
}

/** How a typed column reads what is typed in it: a text column keeps it as text; the others read it as usual (a number, a date ...). */
export const typingFormatOf = (t) => (t && t.kind === 'string' ? { type: 'text' } : null);
