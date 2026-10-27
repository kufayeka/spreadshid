// Satu workbook proyek yang saling terhubung, dipakai contoh-contoh di dokumentasi:
//
//   Harga ──► AHSP ──► RAB ──► Kurva S ◄── Opname M8 ──► Termin 2
//                       │                                   ▲
//                       └──────────────► CCO ───────────────┘ (nilai kontrak)
//   Harian 27-10, Cash Flow, NCR
//
// Ubah satu harga di sheet Harga: analisa, RAB, bobot, kurva S, termin dan CCO ikut berubah.
import { createWorkbook } from '@kufayeka/sheet/core';
import { buatHarga, buatAhsp } from './harga-ahsp.js';
import { buatRab } from './rab.js';
import { buatKurvaS } from './kurva-s.js';
import { buatOpname } from './opname.js';
import { buatTermin } from './termin.js';
import { buatHarian, buatCco, buatCashFlow, buatNcr } from './lapangan.js';

/**
 * Workbook "Proyek Gedung A".
 * @param {object} [options]  Diteruskan ke createWorkbook (user, beforeOp, now ...).
 */
export function buatProyek(options) {
    // jam dipatok supaya TODAY() (umur NCR, hari ke-) selalu sama di contoh dan gambarnya
    const wb = createWorkbook(null, { now: () => new Date(2026, 9, 27, 9, 0), ...options });
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    buatHarga(wb);
    buatAhsp(wb);
    const rab = buatRab(wb);
    buatKurvaS(wb, rab.items);
    buatOpname(wb, rab.items);
    buatTermin(wb);
    buatCco(wb);
    buatHarian(wb);
    buatCashFlow(wb);
    buatNcr(wb);
    // sheet kosong bawaan createWorkbook tidak dipakai; RAB di depan
    wb.removeSheet('Sheet1');
    wb.moveSheet('RAB', 0);
    wb.saved(wb.pendingPatch());
    return wb;
}
