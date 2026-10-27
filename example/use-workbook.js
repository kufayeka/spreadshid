// A page for test/grid-react.test.js: how often useWorkbook draws a component. One component reads a cell the test does not touch, one reads the cell
// it types in, one reads the workbook itself; each counts its renders in window.__renders.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Sheet, useWorkbook } from '../src/index.js';
import { createWorkbook } from '../src/core/index.js';
import '../src/sheet.css';

window.__renders = { still: 0, moving: 0, all: 0 };
function Still({ wb }) { const v = useWorkbook(wb, (w) => w.value('Sheet1', 'D1')); window.__renders.still++; return <span id="still">{v}</span>; }
function Moving({ wb }) { const v = useWorkbook(wb, (w) => w.value('Sheet1', 'A1')); window.__renders.moving++; return <span id="moving">{v}</span>; }
function All({ wb }) { useWorkbook(wb); window.__renders.all++; return null; }

function Page() {
    const [wb] = useState(() => { const w = createWorkbook(); w.setValues('Sheet1', 'D1', 'tetap'); window.__workbook = w; return w; });
    return (
        <div style={{ height: 500 }}>
            <Still wb={wb} /> <Moving wb={wb} /> <All wb={wb} />
            <Sheet workbook={wb} style={{ height: 460 }} />
        </div>
    );
}
createRoot(document.getElementById('root')).render(<Page />);
