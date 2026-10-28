// Types of the shared helpers of chapter 13 (stok-akses.js), for the TypeScript examples.
import type { Workbook, AccessRow, Who } from '@kufayeka/sheet/core';
export function buatStok(): Workbook;
export function peta(wb: Workbook, rows: AccessRow[], who: Who, judul: string): void;
