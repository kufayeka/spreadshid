import { createWorkbook } from '@kufayeka/sheet/core';

// Bahan bersama bab 2 sampai 4: daftar produk toko bangunan dari bab 1, dengan rumus nilai stok dan total.
//
//       A        B                      C        D      E
//   1   Kode     Produk                 Harga    Stok   Nilai stok
//   2   SMN-01   Semen Portland 50 kg   72000    420    =C2*D2
//   3   BSI-10   Besi beton 10 mm       79500    260    =C3*D3
//   4   CAT-05   Cat tembok 5 kg        145000   64     =C4*D4
//   5            Total                           =SUM   =SUM

export function buatProduk() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const s = wb.sheet('Sheet1');
    s.setSheetProps({ name: 'Produk', freezeRows: 1 });
    s.setValues('A1', [
        ['Kode', 'Produk', 'Harga', 'Stok', 'Nilai stok'],
        ['SMN-01', 'Semen Portland 50 kg', 72000, 420, '=C2*D2'],
        ['BSI-10', 'Besi beton 10 mm', 79500, 260, '=C3*D3'],
        ['CAT-05', 'Cat tembok 5 kg', 145000, 64, '=C4*D4'],
        ['', 'Total', '', '=SUM(D2:D4)', '=SUM(E2:E4)']
    ]);
    s.setStyle('A1:E1', { bold: true, fill: '#eef2f7' });
    s.setStyle('A5:E5', { bold: true });
    s.setColProps('C', { format: { type: 'money', decimals: 0 } });
    s.setColProps('E', { format: { type: 'money', decimals: 0 }, width: 140 });
    s.setColProps('B', { width: 180 });
    return wb;
}
