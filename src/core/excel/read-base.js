// The pieces of reading an .xlsx package that do not depend on the sheet (copied from the Nexa data grid): the zip (a stored or a deflated entry, with
// limits so a small file that inflates to gigabytes is refused), a small XML parser (enough for what Excel writes), and the number formats Excel has
// built in. No DOM: inflating uses DecompressionStream, which browsers and Node 18+ have.


const MAX_ENTRY = 40 * 1024 * 1024;       // the most one file inside the package may have once inflated
const MAX_TOTAL = 120 * 1024 * 1024;      // and all of them together: a small zip that inflates to gigabytes is refused

// ---- the zip ----------------------------------------------------------------------------------------------------------------------------------

async function inflate(data, limit) {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const reader = stream.getReader();
    const parts = [];
    let size = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) { try { await reader.cancel(); } catch (e) { /* stopped */ } throw new Error("a file in the package is too big once inflated"); }
        parts.push(value);
    }
    const out = new Uint8Array(size);
    let at = 0;
    parts.forEach((p) => { out.set(p, at); at += p.length; });
    return out;
}

/** The files of a zip: Map name -> bytes (stored and deflated entries; no encryption, no zip64). Throws a short message for a file that is not a zip. */
export async function unzip(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) if (dv.getUint32(i, true) === 0x06054b50) { end = i; break; }
    if (end < 0) throw new Error("this is not an Excel file (no zip directory)");
    const count = dv.getUint16(end + 10, true);
    let at = dv.getUint32(end + 16, true);
    if (count > 2000) throw new Error("the package has too many files");
    const files = new Map();
    let total = 0;
    const text = new TextDecoder("utf-8");
    for (let k = 0; k < count; k++) {
        if (at + 46 > bytes.length || dv.getUint32(at, true) !== 0x02014b50) throw new Error("the zip directory is damaged");
        const method = dv.getUint16(at + 10, true), comp = dv.getUint32(at + 20, true), plain = dv.getUint32(at + 24, true);
        const nameLen = dv.getUint16(at + 28, true), extraLen = dv.getUint16(at + 30, true), commentLen = dv.getUint16(at + 32, true), local = dv.getUint32(at + 42, true);
        const name = text.decode(bytes.subarray(at + 46, at + 46 + nameLen));
        at += 46 + nameLen + extraLen + commentLen;
        if (name.endsWith("/")) continue;
        if (plain > MAX_ENTRY || (total += plain) > MAX_TOTAL) throw new Error("the package is too big");
        if (local + 30 > bytes.length || dv.getUint32(local, true) !== 0x04034b50) throw new Error("the zip is damaged");
        const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
        const data = bytes.subarray(start, start + comp);
        if (method === 0) files.set(name, data);
        else if (method === 8) files.set(name, await inflate(data, MAX_ENTRY));
        else throw new Error("the package uses a way of packing the grid does not know");
    }
    return files;
}

// ---- the XML ----------------------------------------------------------------------------------------------------------------------------------

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescapeXml = (s) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, e) => {
    if (e[0] === "#") { const n = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ""; }
    return ENTITIES[e] !== undefined ? ENTITIES[e] : m;
});
const local = (name) => { const i = name.indexOf(":"); return i < 0 ? name : name.slice(i + 1); };

/**
 * XML text -> a tree of { name, attrs, children, text } (names without their prefix; `text` is the text directly in the element, entities decoded, CDATA as it is).
 * Enough for what Excel writes: no DTD, no processing beyond skipping the declaration and the comments.
 */
export function parseXml(source) {
    const root = { name: "#root", attrs: {}, children: [], text: "" };
    const stack = [root];
    const token = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s\/>!?]+)((?:\s+[^\s=\/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
    const attr = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m;
    while ((m = token.exec(source))) {
        const top = stack[stack.length - 1];
        if (m[1] !== undefined) top.text += m[1];
        else if (m[2] !== undefined) { if (stack.length > 1) stack.pop(); }
        else if (m[3] !== undefined) {
            const node = { name: local(m[3]), attrs: {}, children: [], text: "" };
            let a;
            attr.lastIndex = 0;
            while ((a = attr.exec(m[4] || ""))) node.attrs[local(a[1])] = unescapeXml(a[2] !== undefined ? a[2] : a[3]);
            top.children.push(node);
            if (!m[5]) { if (stack.length > 200) throw new Error("the XML is nested too deep"); stack.push(node); }
        } else if (m[6] !== undefined) top.text += unescapeXml(m[6]);
    }
    return root;
}

const kid = (node, name) => (node ? node.children.find((c) => c.name === name) : undefined);
const kids = (node, name) => (node ? node.children.filter((c) => c.name === name) : []);

// ---- the pieces of a workbook ----------------------------------------------------------------------------------------------------------------

const BUILTIN_FORMATS = { 1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00", 9: "0%", 10: "0.00%", 14: "yyyy-mm-dd", 15: "d-mmm-yy", 16: "d-mmm", 17: "mmm-yy", 18: "h:mm AM/PM", 19: "h:mm:ss AM/PM", 20: "h:mm", 21: "h:mm:ss", 22: "yyyy-mm-dd h:mm", 37: "#,##0", 38: "#,##0", 39: "#,##0.00", 40: "#,##0.00", 45: "mm:ss", 46: "[h]:mm:ss", 47: "mm:ss.0", 49: "@" };

export { kid, kids, BUILTIN_FORMATS };
