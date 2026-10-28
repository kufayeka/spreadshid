// A host's code in TypeScript, compiled with strict by test/types.test.js against the package's own declarations. Each @ts-expect-error is a
// mistake the types must catch: if one compiles, the types are too loose and the test fails.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet, useWorkbook } from '@kufayeka/sheet';
import type { SheetHandle, SheetSelection, Workbook, Policy } from '@kufayeka/sheet';
import { createWorkbook, isError, populate, pivot, tableOf, checkPatch, mergePatch, exportXlsx } from '@kufayeka/sheet/core';
import type { CellResult, Op, WorkbookDoc } from '@kufayeka/sheet/core';

export function Lembar({ id }: { id: string }) {
    const [wb, setWb] = useState<Workbook | null>(null);
    const [range, setRange] = useState('');
    const ref = useRef<SheetHandle>(null);

    useEffect(() => {
        fetch('/api/spreadsheet/' + id).then((r) => (r.ok ? r.json() : null)).then((content: WorkbookDoc | null) => setWb(createWorkbook(content)));
    }, [id]);

    const onSelect = useCallback((sel: SheetSelection) => {
        setRange(sel.address);
        const name: string = sel.sheet.name;
        const r: number = sel.active.r;
        const first: string = sel.ranges[0].address;
        void name; void r; void first;
        // @ts-expect-error a typo in the selection
        void sel.addres;
    }, []);

    const unsaved: boolean | undefined = useWorkbook(wb, (w) => w.unsaved());
    const total = useWorkbook(wb, (w) => w.value('Sheet1', 'D7'));
    if (total !== undefined && !isError(total)) { const n: string | number | boolean | null = total; void n; }

    function tulis() {
        if (!wb) return;
        const stok = wb.sheet('Sheet1');
        stok.setValues('B2', ['Hello World', 'Ini baris kedua']);
        stok.setValues('A1', [['Produk', 'Harga'], ['Semen', 72000]]);
        stok.setValues(1, 1, 5, { source: 'user' });
        wb.setValues('Sheet1', 'C1', '=A1*2');
        stok.setStyle('A1:B1', { bold: true, fill: '#e8f0fe', format: { type: 'money', decimals: 0 } });
        stok.setColProps('B', { width: 120 });
        stok.insertRows('3', 2);
        const v: CellResult = stok.value('B2');
        const text: string = stok.display('B2').text;
        void v; void text;
        // @ts-expect-error a style key that does not exist
        stok.setStyle('A1', { boldd: true });
        // @ts-expect-error a value that is not a cell value
        stok.setValues('A1', { nama: 'objek' });
        // @ts-expect-error a source that does not exist
        stok.setValues('A1', 1, { source: 'orang' });
        // @ts-expect-error an event that does not exist
        wb.on('changed', () => {});
    }

    useEffect(() => {
        if (!wb) return;
        const off = wb.on('reject', (e) => console.log(e.reason, e.source));
        const off2 = wb.on('op', (e) => { const ops: Op[] = e.ops; void ops; });
        return () => { off(); off2(); };
    }, [wb]);

    async function simpan() {
        if (!wb) return;
        await fetch('/api/spreadsheet/' + id, { method: 'PUT', body: JSON.stringify(wb.toJSON()) });
        wb.saved();
        ref.current?.select('A1');
    }

    if (!wb) return <p>Memuat…</p>;
    return (
        <div>
            <button onClick={simpan} disabled={!unsaved}>Simpan {range}</button>
            <button onClick={tulis}>tulis</button>
            <Sheet ref={ref} workbook={wb} fileName={id} style={{ flex: 1 }} onSelectionChange={onSelect}
                onReject={(e) => console.log(e.reason)} access={{ policy: null, who: 'user:rina' }} />
            {/* @ts-expect-error a prop that does not exist */}
            <Sheet workbok={wb} />
        </div>
    );
}

// the core without React: server code
export function server(doc: WorkbookDoc) {
    const wb = createWorkbook(doc, { user: { id: 'u', name: 'U' }, beforeOp: (op, ctx) => (ctx.source === 'user' && op.t === 'deleteRows' ? { reject: 'tidak boleh' } : op) });
    populate(wb, 'Sheet1', { at: 'A1', header: ['No', 'Nama'], fields: ['no', 'nama'] }, [{ no: 1, nama: 'a' }]);
    const { records } = tableOf(wb, 'Sheet1', 'A1:B2');
    const p = pivot(records, { rows: ['Nama'], values: [{ field: 'No', fn: 'SUM' }] });
    void p.cells;
    // @ts-expect-error a pivot function that does not exist
    pivot(records, { values: [{ field: 'No', fn: 'TOTAL' }] });
    const policy: Policy = { roles: { kasir: { can: ['sort'], ranges: [{ sheet: 'Produk', range: 'C2:C5', mode: 'hidden' }] } } };
    // @ts-expect-error a mode that does not exist
    const bad: Policy = { roles: { kasir: { ranges: [{ range: 'A1', mode: 'secret' }] } } };
    void bad;
    const result = checkPatch(doc, wb.pendingPatch(), { policy, who: 'user:rina' });
    if (result.ok) return mergePatch(doc, wb.pendingPatch());
    const bytes: Uint8Array = exportXlsx(wb);
    void bytes;
    return doc;
}
