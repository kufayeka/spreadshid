// app/penjualan/[id]/LembarPenjualan.js  (client component)
'use client';
import { useState } from 'react';
import { Sheet, useWorkbook } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { useAutosave } from './useAutosave';            // hook dari 11.4

export function LembarPenjualan({ id, doc }) {
    // doc dari server dipakai sekali untuk membuat workbook. Render berikutnya memakai workbook yang sama
    const [wb] = useState(() => createWorkbook(doc));
    const status = useAutosave(wb, id);
    const omzet = useWorkbook(wb, (w) => w.display('Penjualan', 'N1').text);
    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <header>Omzet {omzet} · {status}</header>
            <Sheet workbook={wb} fileName={'Penjualan ' + id} style={{ flex: 1 }} />
        </div>
    );
}
