import { useEffect, useRef, useState } from 'react';
import { Sheet, useWorkbook } from '@kufayeka/sheet';
import type { SheetHandle, SheetSelection } from '@kufayeka/sheet';
import { createWorkbook, isError } from '@kufayeka/sheet/core';
import type { Workbook, WorkbookDoc, CellResult, Style, WorkbookEvents } from '@kufayeka/sheet/core';

// Pelajaran 14: pola TypeScript yang dipakai di aplikasi React. Setiap baris di sini dicek tsc dengan strict.

// 1. workbook di state: null selama memuat
export function Lembar({ id }: { id: string }) {
    const [wb, setWb] = useState<Workbook | null>(null);
    const ref = useRef<SheetHandle>(null);
    const [range, setRange] = useState<string>('');

    useEffect(() => {
        fetch('/api/spreadsheet/' + id)
            .then((r) => (r.ok ? (r.json() as Promise<WorkbookDoc>) : null))
            .then((doc) => setWb(createWorkbook(doc)));
    }, [id]);

    // 2. useWorkbook: tipe hasilnya mengikuti fungsi baca, ditambah undefined selama wb masih null
    const belum: boolean | undefined = useWorkbook(wb, (w) => w.unsaved());
    const total: CellResult | undefined = useWorkbook(wb, (w) => w.value('Sheet1', 'D7'));

    // 3. hasil sel bisa berupa error: persempit dengan isError, baru dipakai sebagai angka
    const totalTeks = total === undefined ? '-' : isError(total) ? total.code : typeof total === 'number' ? total.toLocaleString('id-ID') : String(total);

    // 4. event dengan tipe isi datanya
    useEffect(() => {
        if (!wb) return;
        const padaReject = (e: WorkbookEvents['reject']) => alert(e.reason);
        return wb.on('reject', padaReject);
    }, [wb]);

    // 5. seleksi dan handle
    const pilih = (sel: SheetSelection) => setRange(sel.address);
    const keTotal = () => ref.current?.select('D7');

    // 6. objek gaya dengan tipe: salah ketik nama atau nilai langsung ketahuan
    const judul: Style = { bold: true, fill: '#e8f0fe', align: 'center' };

    if (!wb) return <p>Memuat…</p>;
    return (
        <div style={{ height: 500, display: 'flex', flexDirection: 'column' }}>
            <p>
                Total {totalTeks} · pilihan {range || '-'} · {belum ? 'belum tersimpan' : 'tersimpan'}{' '}
                <button onClick={keTotal}>ke total</button>{' '}
                <button onClick={() => wb.sheet('Sheet1').setStyle('A1:D1', judul)}>tebalkan judul</button>
            </p>
            <Sheet ref={ref} workbook={wb} onSelectionChange={pilih} style={{ flex: 1 }} />
        </div>
    );
}
