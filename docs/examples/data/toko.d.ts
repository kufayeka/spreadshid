// Types of the example data (toko.js), for the TypeScript examples.
export type Produk = [kode: string, nama: string, kategori: string, satuan: string, hargaBeli: number, hargaJual: number, stok: number, stokMin: number];
export const PRODUK: Produk[];
export const KOLOM_PRODUK: string[];
export const CABANG: string[];
export const SALES: Record<string, string[]>;
export interface Penjualan { No: number; Tanggal: number; Cabang: string; Sales: string; Kode: string; Produk: string; Kategori: string; Qty: number; Harga: number; Diskon: number }
export function penjualan(n?: number): Penjualan[];
export const KOLOM_PENJUALAN: string[];
export function barisPenjualan(rows: Penjualan[], start?: number): Array<Array<string | number>>;
