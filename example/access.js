// A page for the tests of access control: a BOQ with a policy of roles, opened by its owner; the policy the owner changes in Data > Access and roles is
// written down where the tests read it (as a host would keep it in its database).
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Sheet } from '../src/index.js';
import { createWorkbook } from '../src/core/index.js';

const wb = createWorkbook();
const [s] = wb.sheetIds();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
wb.setSheetProps(s, { name: 'BOQ' });
wb.setValues(s, 0, 0, [
    ['Item', 'Qty', 'Rate', 'Done', 'Status', 'Cost'],
    ['Pile', 10, 500, 2, 'Draft', 400],
    ['Beam', 4, 900, 1, 'Approved', 700],
    ['Slab', 2, 1200, 0, 'Draft', 1000]
]);
wb.saved(wb.pendingPatch());

const POLICY = {
    owners: ['user:yeka'],
    members: { 'group:mandor': 'site' },
    default: 'viewer',
    roles: {
        site: { can: ['format.bold'], ui: { menubar: false, toolbar: false }, ranges: [{ sheet: 'BOQ', range: 'D2:D20', mode: 'edit' }, { sheet: 'BOQ', columns: ['Cost'], mode: 'invisible' }] },
        viewer: { can: ['copy'], ranges: [{ sheet: 'BOQ', columns: ['Cost'], mode: 'hidden' }] }
    }
};

window.__workbook = wb;
window.__policies = [];

function Page() {
    const [policy, setPolicy] = useState(POLICY);
    return <Sheet workbook={wb} style={{ height: '100%' }} access={{ policy, who: 'user:yeka' }}
        onAccessChange={(next) => { window.__policies.push(next); setPolicy(next); }} />;
}
createRoot(document.getElementById('root')).render(<Page />);
