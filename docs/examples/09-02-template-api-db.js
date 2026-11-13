import { createWorkbook, viewFor, checkPatch, mergePatch } from '@kufayeka/sheet/core';

// Simulasi lengkap: Template (styling + pre-rumus + ACL/rules/types terpisah) -> Instantiate -> Load -> Edit -> Save
// 1. MASTER TEMPLATE DI DATABASE (disimpan sebagai paket: doc + access + types)
function buatPaketTemplate() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const sh = wb.sheet('Sheet1');
    sh.setSheetProps({ name: 'RAB', freezeRows: 1 });
    sh.setValues('A1', [
        ['Kode', 'Uraian', 'Qty', 'Harga Satuan', 'Total', 'HPP Rahasia'],
        ['P01', 'Pekerjaan Pondasi', 10, 500000, '=C2*D2', 400000],
        ['', 'Grand Total', '', '', '=SUM(E2:E2)', ''],
    ]);
    sh.setStyle('A1:F1', { bold: true, fill: '#1a73e8', color: '#ffffff' });
    sh.setStyle('D2:F3', { format: { type: 'money', decimals: 0 } });

    return {
        templateId: 'tpl-rab-v1',
        doc: wb.toJSON(),
        // access, rules, dan types TIDAK masuk ke wb.toJSON() -> disimpan di kolom/tabel terpisah
        access: [
            { who: 'role:estimator', effect: 'allow', action: 'read', where: 'RAB!A1:F3' },
            { who: 'role:estimator', effect: 'allow', action: 'edit', where: 'RAB!C2:D2' },
            { who: 'role:estimator', effect: 'deny', action: 'read', where: 'RAB!col:HPP Rahasia' },
        ],
        types: { RAB: { headerRow: 1, fields: { Qty: { kind: 'int' } } } },
    };
}

// 2. INSTANTIATE DOKUMEN BARU DARI TEMPLATE (di backend saat proyek baru dibuat)
const paket = buatPaketTemplate();
let dbRow = {
    id: 'rab-proyek-42',
    version: 1,
    doc: { ...structuredClone(paket.doc), id: 'rab-proyek-42', version: 1 },
    access: paket.access,
    types: paket.types,
};

// 3. LOAD DARI API (GET /api/workbooks/rab-proyek-42) -> sensor kolom rahasia via viewFor()
const user = { user: 'andi', roles: ['estimator'] };
const payloadUntukClient = viewFor(dbRow.doc, { access: dbRow.access, who: user });

// Client membuka workbook + memasang access & types yang dikirim API
const clientWb = createWorkbook(payloadUntukClient);
clientWb.setAccess(dbRow.access, user);
clientWb.setTypes('RAB', dbRow.types.RAB);
console.log('Client melihat HPP Rahasia (F2):', JSON.stringify(clientWb.value('RAB', 'F2')));

// 4. EDIT DI CLIENT & KIRIM PATCH (PATCH /api/workbooks/rab-proyek-42)
clientWb.sheet('RAB').setValues('C2', 12, { source: 'user' });
const patch = clientWb.pendingPatch();

// 5. VALIDASI & SIMPAN DI SERVER (Optimistic Locking dengan version)
if (patch.workbook.version !== dbRow.version) throw new Error('Conflict: versi usang');
const cek = checkPatch(dbRow.doc, patch, { access: dbRow.access, who: user, types: dbRow.types });
if (!cek.ok) throw new Error('Ditolak server: ' + cek.problems.map((p) => p.reason).join('; '));

dbRow.doc = { ...mergePatch(dbRow.doc, patch, { access: dbRow.access, who: user }), version: dbRow.version + 1 };
dbRow.version = dbRow.doc.version;
clientWb.saved(patch, { version: dbRow.version });

console.log('Total baru di DB (E2):', createWorkbook(dbRow.doc).value('RAB', 'E2'), '| versi:', dbRow.version);
console.log('HPP Rahasia di DB tetap aman (F2):', createWorkbook(dbRow.doc).value('RAB', 'F2'));
