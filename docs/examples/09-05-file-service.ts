// 9.7 Menyimpan workbook sebagai file di File service API Maker, dan membukanya lagi.
// Satu modul kecil yang dipakai halaman mana pun: simpan pertama, simpan versi berikutnya, buka, dan periksa apakah orang lain sudah
// menyimpan versi yang lebih baru. Route-nya adalah route template File service (Studio > Settings > Files > pasang route).
import { createWorkbook } from '@kufayeka/sheet/core';
import type { Workbook, WorkbookDoc, AccessRow, Who } from '@kufayeka/sheet/core';

/** Alamat project API Maker dan token orang yang sedang masuk (dari halaman login aplikasi Anda). */
export interface Server {
    api: string;          // misalnya 'https://api.contoh.id'
    token: string;        // dikirim sebagai Authorization: Bearer <token>
}

/** Jawaban File service setelah upload atau versi baru (Type FsSaved). */
export interface FileSaved {
    id: string;
    name: string;
    size: number;
    type: string | null;
    version: number;               // nomor versi yang baru dibuat
    currentVersion?: number;       // versi yang ditampilkan file sekarang
    pinned?: boolean;              // true: seseorang memilih versi tampil secara manual, upload ini tidak menggantikannya
}

/** File yang dibuka: workbook-nya, dan versi yang dibuka (dipakai untuk memeriksa bentrokan saat menyimpan). */
export interface OpenedFile {
    workbook: Workbook;
    fileId: string;
    name: string;
    version: number;
}

const EXTENSION = '.spreadshid';

// Isi workbook sebagai sebuah file di dalam form multipart. Nama field-nya WAJIB "files": itulah yang dibaca route template.
function formOf(wb: Workbook, name: string, note?: string): FormData {
    const fileName = name.endsWith(EXTENSION) ? name : name + EXTENSION;
    const form = new FormData();
    form.append('files', new Blob([JSON.stringify(wb.toJSON())], { type: 'application/json' }), fileName);
    if (note) form.append('note', note);
    return form;
}

// Jawaban server sebagai JSON, atau error yang menyebut status dan alasannya (401 belum masuk, 403 tidak punya izin, 404 tidak ada,
// 415 jenis file tidak diizinkan di Settings > Files).
async function answerOf<T>(res: Response): Promise<T> {
    if (!res.ok) throw new Error('File service ' + res.status + ': ' + (await res.text()));
    return (await res.json()) as T;
}

const signedIn = (server: Server) => ({ Authorization: 'Bearer ' + server.token });

/** Simpan pertama kali: file baru di sebuah folder. Simpan `id` yang dikembalikan; itulah alamat file ini seterusnya. */
export async function saveNew(server: Server, wb: Workbook, folderId: string, name: string): Promise<FileSaved> {
    const res = await fetch(server.api + '/fs/' + folderId + '/upload', { method: 'POST', headers: signedIn(server), body: formOf(wb, name) });
    const saved = await answerOf<FileSaved>(res);
    wb.saved();                                                             // tombol Simpan kembali menjadi "Tersimpan"
    return saved;
}

/** Simpan berikutnya: versi baru dari file yang sama. Versi sebelumnya tetap ada di riwayat file. */
export async function saveVersion(server: Server, wb: Workbook, fileId: string, name: string, note?: string): Promise<FileSaved> {
    const res = await fetch(server.api + '/fs/file/' + fileId + '/versions', { method: 'POST', headers: signedIn(server), body: formOf(wb, name, note) });
    const saved = await answerOf<FileSaved>(res);
    wb.saved();
    return saved;
}

/** Info satu file (Type FsFile), hanya bagian yang dipakai di sini. */
interface FileInfo {
    id: string;
    name: string;
    currentVersion: number;
    latestVersion: number;
    viewUrl: string | null;
    versions: Array<{ version: number; note?: string | null; viewUrl?: string | null; createdAt: string }>;
}

/** Info file beserta semua versinya. Setiap versi punya viewUrl sendiri yang sudah ditandatangani. */
export async function fileInfo(server: Server, fileId: string): Promise<FileInfo> {
    return answerOf<FileInfo>(await fetch(server.api + '/fs/file/' + fileId, { headers: signedIn(server) }));
}

/**
 * Buka file: versi yang sedang ditampilkan file, atau satu versi tertentu. viewUrl dari server sudah membawa tanda tangan dan masa berlaku,
 * jadi diambil tanpa token dan dipakai apa adanya (mengubah v= di dalamnya membuat tanda tangannya tidak cocok).
 * `access`: aturan akses dan orang yang membuka, kalau workbook ini memakai hak akses (lihat batasannya di 9.7.6).
 */
export async function open(server: Server, fileId: string, options?: { version?: number; access?: { rows: AccessRow[]; who: Who } }): Promise<OpenedFile> {
    const info = await fileInfo(server, fileId);
    const wanted = options && options.version !== undefined ? info.versions.find((v) => v.version === options.version) : null;
    const url = wanted ? wanted.viewUrl : info.viewUrl;
    if (!url) throw new Error('File service: versi ini tidak bisa dibuka');
    const doc = await answerOf<WorkbookDoc>(await fetch(server.api + url));
    const workbook = createWorkbook(doc);                                   // bentuk toJSON() persis bentuk yang diterima createWorkbook()
    if (options && options.access) workbook.setAccess(options.access.rows, options.access.who);
    workbook.saved();
    return { workbook, fileId: info.id, name: info.name, version: wanted ? wanted.version : info.currentVersion };
}

/**
 * Simpan dengan aman: sebelum menimpa, periksa apakah sudah ada versi yang lebih baru dari versi yang dibuka (orang lain menyimpan lebih dulu).
 * Kalau ada, tidak ada yang disimpan dan jawabannya { conflict: versiTerbaru }; aplikasi memutuskan apa yang dilakukan.
 */
export async function saveChecked(server: Server, opened: OpenedFile, note?: string): Promise<{ saved: FileSaved } | { conflict: number }> {
    const info = await fileInfo(server, opened.fileId);
    if (info.latestVersion > opened.version) return { conflict: info.latestVersion };
    const saved = await saveVersion(server, opened.workbook, opened.fileId, opened.name, note);
    opened.version = saved.version;                                         // simpanan berikutnya dibandingkan dengan versi ini
    return { saved };
}
