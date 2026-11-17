'use client';
// 9.8 Halaman anggaran yang sama dengan 9.7, tetapi tombolnya ada di menu File milik sheet: Save (Ctrl+S), Save as new version, Save as a copy.
// Satu fungsi onSave menerima mode tombol yang dipilih dan memanggil modul File service.
import { useEffect, useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import type { SheetSave } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { open, saveChecked, saveNew } from './09-05-file-service';
import type { OpenedFile, Server } from './09-05-file-service';

export default function HalamanAnggaran({ server, fileId, folderId }: { server: Server; fileId: string; folderId: string }) {
    const [file, setFile] = useState<OpenedFile | null>(null);
    const [catatan, setCatatan] = useState('');

    useEffect(() => {
        open(server, fileId).then(setFile);
    }, [server, fileId]);

    // Dipanggil oleh ketiga tombol. Melempar error = sheet menampilkan "The file was not saved: <pesan>";
    // selesai tanpa error = sheet menampilkan "Saved". Selama fungsi ini berjalan, ketiga tombol abu-abu.
    async function simpan({ mode }: SheetSave) {
        if (!file) return;

        if (mode === 'saveAsACopy') {
            // file baru di folder yang sama; halaman ini lalu bekerja pada salinannya
            const baru = await saveNew(server, file.workbook, folderId, file.name.replace(/\.spreadshid$/, '') + ' (salinan).spreadshid');
            setFile({ workbook: file.workbook, fileId: baru.id, name: baru.name, version: baru.version });
            return;
        }

        // File service tidak pernah menimpa: setiap simpan adalah versi baru. Save = versi biasa, Save as new version = versi dengan catatan.
        const hasil = await saveChecked(server, file, mode === 'saveAsNewVersion' ? catatan || undefined : undefined);
        if ('conflict' in hasil) throw new Error('versi ' + hasil.conflict + ' sudah disimpan orang lain, muat ulang dulu');
        if (mode === 'saveAsNewVersion') setCatatan('');
    }

    return (
        <div>
            <p>
                <input placeholder="Catatan untuk Save as new version" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
            </p>
            <div style={{ height: 480 }}>
                <Sheet workbook={file ? file.workbook : null} onSave={simpan} fileName={file ? file.name.replace(/\.spreadshid$/, '') : undefined} />
            </div>
        </div>
    );
}
