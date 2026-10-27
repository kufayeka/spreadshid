import { createWorkbook } from '@kufayeka/sheet/core';

// Patch diterjemahkan ke perintah untuk empat tabel (lihat skema di 9.3). Bentuk perintahnya terserah database-mu;
// di sini cuma dicetak supaya kelihatan apa yang dikirim.
function keTabel(wb, patch) {
    // id diganti alamat supaya enak dibaca di sini; di database yang disimpan tetap id-nya
    const kolom = (cid) => wb.address(0, wb.colIndex('Sheet1', cid)).replace(/\d+$/, '');
    const sel = (obj) => JSON.stringify(Object.fromEntries(Object.entries(obj).map(([cid, v]) => [kolom(cid), v])));
    const baris = (rid) => 'baris ' + (wb.rowIndex('Sheet1', rid) + 1);
    const perintah = [];
    if (patch.workbook.settings) perintah.push(['UPDATE workbooks SET settings']);
    for (const s of patch.sheets.upsert) perintah.push(['UPSERT sheets', s.props.name, 'key=' + s.key]);
    for (const id of patch.sheets.delete) perintah.push(['DELETE sheets']);
    for (const c of patch.columns.upsert) perintah.push(['UPSERT columns', 'kolom ' + kolom(c.id), 'key=' + c.key, 'props=' + JSON.stringify(c.props)]);
    for (const id of patch.columns.delete) perintah.push(['DELETE columns']);
    for (const r of patch.rows.upsert) perintah.push(['UPSERT rows', baris(r.id), 'key=' + r.key, 'cells=' + sel(r.cells), 'style=' + sel(r.style)]);
    for (const id of patch.rows.delete) perintah.push(['DELETE rows']);
    return perintah;
}

const wb = createWorkbook();
wb.saved(wb.pendingPatch());           // anggap workbook kosong ini sudah tersimpan
wb.setValues('Sheet1', 'A1', [['Galian', 120]]);
wb.setStyle('Sheet1', 'A1', { bold: true });
wb.insertRows('Sheet1', '2');
wb.setColProps('Sheet1', 'B', { width: 140 });
for (const p of keTabel(wb, wb.pendingPatch())) console.log(p.join('  '));
