// A zip of stored (not compressed) files, the way an .xlsx package can be: enough for Excel, Google Sheets and LibreOffice to open it, and no library.
// Made from the Nexa chart's export; it gives bytes (a Uint8Array) so the same code runs in a browser and on a server.

let CRC_TABLE = null;

/** The CRC-32 of some bytes, as a zip needs it for every file. */
export function crc32(bytes) {
    if (!CRC_TABLE) {
        CRC_TABLE = new Uint32Array(256);
        for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; }
    }
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

/**
 * The bytes of a zip of the files given ({ name, text }), each stored as it is, its name in UTF-8.
 * @param {{ name: string, text: string }[]} files
 * @returns {Uint8Array}
 */
export function zipStore(files) {
    const enc = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;
    const u16 = (v) => [v & 255, (v >>> 8) & 255];
    const u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    for (const f of files) {
        const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
        // the local header: version 2.0, flag 0x0800 (the name is UTF-8), stored, a fixed date
        const head = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
        chunks.push(new Uint8Array(head), name, data);
        central.push({ name, crc, size: data.length, offset });
        offset += head.length + name.length + data.length;
    }
    let cdSize = 0;
    for (const c of central) {
        const rec = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c.crc), u32(c.size), u32(c.size), u16(c.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.offset));
        chunks.push(new Uint8Array(rec), c.name);
        cdSize += rec.length + c.name.length;
    }
    chunks.push(new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(cdSize), u32(offset), u16(0))));
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) { out.set(c, at); at += c.length; }
    return out;
}
