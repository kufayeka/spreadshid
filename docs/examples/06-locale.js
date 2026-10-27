import { createWorkbook } from '@kufayeka/sheet/core';

// angka, uang dan tanggal yang sama di tiga locale; ketikan juga dibaca sesuai locale
const coba = [
    { locale: 'id-ID', currency: 'IDR', angka: '1.250,5', tanggal: '26/10/2026' },
    { locale: 'en-US', currency: 'USD', angka: '1,250.5', tanggal: '10/26/2026' },
    { locale: 'de-DE', currency: 'EUR', angka: '1.250,5', tanggal: '26.10.2026' }
];
for (const { locale, currency, angka, tanggal } of coba) {
    const wb = createWorkbook();
    wb.setSettings({ locale, currency });
    const sh = wb.sheet('Sheet1');
    sh.setValues('A1', [[angka, 1250000, tanggal]]);
    sh.setStyle('B1', { format: { type: 'money', decimals: 2 } });
    console.log(locale, '| ketik', angka.padEnd(7), '->', String(sh.value('A1')).padEnd(6), '| uang:', sh.display('B1').text.padEnd(16),
        '| ketik', tanggal, '->', sh.value('C1'), '->', sh.display('C1').text);
}
