import { useEffect, useRef, useState } from 'react';
import { useWorkbook } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import { ambilWorkbook, simpanPatch } from './data/api.js';

/**
 * Workbook dari API: { wb, error, cobaLagi }. wb null selama memuat.
 * @param {string} id  id workbook di API-mu. Berganti id = workbook lain dimuat.
 */
export function useWorkbookDariApi(id, opsi) {
    const [keadaan, setKeadaan] = useState({ wb: null, error: null });
    const [percobaan, setPercobaan] = useState(0);
    useEffect(() => {
        // AbortController: kalau komponen dilepas atau id berganti sebelum jawaban datang, permintaan lama dibatalkan dan jawabannya diabaikan.
        // Ini juga yang membuat StrictMode (yang menjalankan effect dua kali saat development) aman
        const batal = new AbortController();
        setKeadaan({ wb: null, error: null });
        ambilWorkbook(id, batal.signal)
            // createWorkbook di sini, sekali per isi yang dimuat. Opsinya (user, beforeOp) ikut dari pemanggil
            .then((doc) => setKeadaan({ wb: createWorkbook(doc, opsi), error: null }))
            .catch((err) => { if (err.name !== 'AbortError') setKeadaan({ wb: null, error: err.message }); });
        return () => batal.abort();
        // opsi sengaja tidak ikut: objek opsi yang ditulis langsung di pemanggil berubah setiap render
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, percobaan]);
    return { ...keadaan, cobaLagi: () => setPercobaan((n) => n + 1) };
}

/**
 * Simpan otomatis `jeda` milidetik setelah orang berhenti mengubah. Hanya yang berubah yang dikirim (patch), bukan seluruh workbook.
 * Mengembalikan 'tersimpan' | 'menunggu' | 'menyimpan' | 'gagal'.
 */
export function useAutosave(wb, id, jeda = 1000) {
    const [status, setStatus] = useState('tersimpan');
    const sibuk = useRef(false);
    const belum = useWorkbook(wb, (w) => w.unsaved());

    useEffect(() => {
        if (!wb) return undefined;
        let timer = null;
        const simpan = async () => {
            // satu penyimpanan pada satu waktu: perubahan yang datang selama menyimpan dikirim berikutnya
            if (sibuk.current) { timer = setTimeout(simpan, jeda); return; }
            if (!wb.unsaved()) { setStatus('tersimpan'); return; }
            const patch = wb.pendingPatch();
            sibuk.current = true;
            setStatus('menyimpan');
            try {
                const jawaban = await simpanPatch(id, patch);
                // saved() hanya melupakan yang ikut di patch ini: yang diubah selama menunggu jawaban tetap tercatat belum tersimpan
                wb.saved(patch, jawaban);
                if (wb.unsaved()) { setStatus('menunggu'); timer = setTimeout(simpan, jeda); } else setStatus('tersimpan');
            } catch {
                // patch tidak hilang: penyimpanan berikutnya mengirimnya lagi bersama perubahan yang lebih baru
                setStatus('gagal');
                timer = setTimeout(simpan, jeda * 5);
            } finally {
                sibuk.current = false;
            }
        };
        // setiap perubahan menunda penyimpanan (debounce): mengetik 20 sel berturut-turut = satu kali simpan
        const off = wb.on('op', () => { setStatus('menunggu'); clearTimeout(timer); timer = setTimeout(simpan, jeda); });
        return () => { off(); clearTimeout(timer); };
    }, [wb, id, jeda]);

    // menutup tab saat masih ada yang belum tersimpan: browser bertanya dulu
    useEffect(() => {
        if (!belum) return undefined;
        const tahan = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', tahan);
        return () => window.removeEventListener('beforeunload', tahan);
    }, [belum]);

    return status;
}
