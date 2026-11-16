'use client';
// 9.7 Halaman yang membuka sebuah file anggaran dari File service, menampilkannya di <Sheet>, dan menyimpannya sebagai versi baru dengan
// catatan. Kalau orang lain sudah menyimpan versi yang lebih baru, halaman ini tidak menimpanya dan memberi tahu.
import { useEffect, useState } from 'react';
import { Sheet, useWorkbook } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { open, saveChecked } from './09-05-file-service';
import type { OpenedFile, Server } from './09-05-file-service';

export default function HalamanAnggaran({ server, fileId }: { server: Server; fileId: string }) {
    const [file, setFile] = useState<OpenedFile | null>(null);
    const [pesan, setPesan] = useState('');
    const [catatan, setCatatan] = useState('');

    // dibuka sekali; selama file masih diambil, <Sheet workbook={null}> menampilkan kerangka loading
    useEffect(() => {
        open(server, fileId).then(setFile, (err: Error) => setPesan(err.message));
    }, [server, fileId]);

    const adaPerubahan = useWorkbook(file ? file.workbook : null, (w) => w.unsaved());

    async function simpan() {
        if (!file) return;
        setPesan('Menyimpan…');
        try {
            const hasil = await saveChecked(server, file, catatan || undefined);
            if ('conflict' in hasil) {
                setPesan('Versi ' + hasil.conflict + ' sudah disimpan orang lain. Muat ulang dulu, lalu ulangi perubahan Anda.');
                return;
            }
            setCatatan('');
            setPesan('Tersimpan sebagai versi ' + hasil.saved.version);
        } catch (err) {
            setPesan((err as Error).message);
        }
    }

    return (
        <div>
            <p style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input placeholder="Catatan versi (opsional)" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
                <button onClick={simpan} disabled={!adaPerubahan}>{adaPerubahan ? 'Simpan' : 'Tersimpan'}</button>
                <span>{pesan}</span>
            </p>
            <div style={{ height: 480 }}>
                <Sheet workbook={file ? file.workbook : null} fileName={file ? file.name.replace(/\.spreadshid$/, '') : undefined} />
            </div>
        </div>
    );
}
