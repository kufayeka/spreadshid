// app/boq/page.js  (Next.js App Router)
// <Sheet> sudah bertanda "use client", jadi boleh langsung dipakai di halaman ini.
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';

export default function Page() {
    return (
        <main style={{ height: '100vh' }}>
            <Sheet fileName="BOQ" />
        </main>
    );
}
