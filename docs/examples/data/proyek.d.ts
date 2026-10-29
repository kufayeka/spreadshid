// Types of the project data of chapter 12 (proyek.js), for the TypeScript examples.
import type { Workbook } from '@kufayeka/sheet/core';
/** [pekerjaan, biaya, minggu mulai, minggu selesai] */
export const PEKERJAAN: Array<[string, number, number, number]>;
/** kumulatif realisasi per minggu, dalam persen */
export const REALISASI: number[];
/** [proyek, minggu ke, aktual, rencana] (aktual dan rencana sebagai pecahan: 0.5147 = 51,47%) */
export const PROGRES: Array<[string, number, number, number]>;
/** [bulan, tagihan dalam juta, progres kumulatif] */
export const TERMIN: Array<[string, number, number]>;
/** [pekerjaan, status, nilai, terbayar] */
export const PEKTAM: Array<[string, string, number, number]>;
export function buatJadwal(wb?: Workbook): Workbook;
export function buatDashboard(): Workbook;
