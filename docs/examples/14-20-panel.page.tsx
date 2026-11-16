import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import type { Workbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// 14.20 Panel editor dengan pengaturan lanjutan: data penjualan toko ponsel (bagian 4.11), pivot dengan calculated field Margin,
// Omzet ditampilkan juga sebagai % dari grand total, dan filter Top 2 merek menurut Omzet. Semuanya bisa diubah lagi di panel.
function buatToko(): Workbook {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const jual = wb.sheet('Sheet1');
    jual.setSheetProps({ name: 'Penjualan' });
    jual.setValues('A1', [
        ['Merek',   'Tipe',          'Harga jual', 'Harga modal'],
        ['Samsung', 'Galaxy A16',     2600000,      2250000],
        ['Samsung', 'Galaxy A36',     4900000,      4300000],
        ['Xiaomi',  'Redmi 14C',      1500000,      1320000],
        ['Xiaomi',  'Redmi Note 14',  3100000,      2700000],
        ['Oppo',    'A60',            2400000,      2150000],
        ['Oppo',    'Reno 13',        6200000,      5300000]
    ]);
    const laba = wb.sheet(wb.addSheet('Laba'));
    laba.addPivot('A1', 'Penjualan!A1:D7', {
        rows: ['Merek'],
        calculated: [{ name: 'Margin', formula: '([Harga jual] - [Harga modal]) / [Harga jual]' }],
        values: [
            { field: 'Harga jual', as: 'Omzet' },
            { field: 'Harga jual', as: 'Porsi', show: 'percentOfTotal' },
            { field: 'Margin' }
        ],
        filters: { Merek: { top: { n: 2, by: 'Omzet' } } },
        sort: { Merek: { by: 'Omzet', dir: 'desc' } }
    });
    laba.setColProps('B', { format: { type: 'money', decimals: 0 }, width: 130 });
    laba.setColProps('D', { format: { type: 'percent', decimals: 1 } });
    wb.moveSheet('Laba', 0);
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buatToko);
    return (
        <div style={{ height: 760 }}>
            <Sheet workbook={wb} />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
