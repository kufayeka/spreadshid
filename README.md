# @kufayeka/sheet

A spreadsheet for React, like Google Sheets: the people who use it make and format their own sheets with a toolbar and menus, and the code that hosts it keeps control of every change (it can allow, change or refuse each one).

It is written in JavaScript with JSDoc comments; the type declarations for TypeScript are made from them at build time.

## Two entries

| Import | What it is | Where it runs |
|---|---|---|
| `@kufayeka/sheet` | the `<Sheet>` component, its toolbar and menus | the browser (marked `"use client"` for Next.js) |
| `@kufayeka/sheet/core` | the workbook, its changes and its calculation, with no React and no DOM | the browser and a server: Nexa AM checks a save with the same rules |
| `@kufayeka/sheet/style.css` | the look, every colour and size a custom property | |

```jsx
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';

export default function Page() {
    return <div style={{ height: 600 }}><Sheet /></div>;
}
```

React 18 or newer is needed (it is a peer dependency: the host's React is used).

## The host keeps control

The host makes the workbook, gives it to the sheet, and decides about every change. A short tour; every function and prop is described in its JSDoc.

```jsx
import { useRef } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook, fromApiMakerType } from '@kufayeka/sheet/core';

// what is stored (from Nexa AM), and who is working
const wb = createWorkbook(storedDoc, {
    user: 'budi',
    // every change passes here first: return the op, a changed copy, null to drop it, or { reject: 'why' }
    beforeOp(op, ctx) { return op; }
});
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

// what this person may do, from the backend: read-only and hidden cells, by range, by column header, by a condition per row
wb.setRules([
    { sheet: 'BOQ', columns: ['Rate'], headerRow: 1, mode: 'readonly', message: 'The rates are set by the estimator' },
    { sheet: 'BOQ', range: 'A2:H100000', when: '=$G2="Approved"', mode: 'readonly', message: 'An approved line is locked' },
    { sheet: 'BOQ', columns: ['Cost'], mode: 'hidden' }
]);
// the types of the columns, from an API Maker Type: a value of the wrong type is refused and said with onCellError
wb.setTypes(wb.sheetIdByName('BOQ'), { headerRow: 1, fields: fromApiMakerType(boqLineType, enumTypes).fields });

function Page() {
    const sheet = useRef(null);
    return (
        <Sheet ref={sheet} workbook={wb} showProtected style={{ height: '100%' }}
            onOp={(e) => { /* every change, as ops: history, working together */ }}
            onReject={(e) => { /* e.reason */ }}
            onCellError={(e) => { /* e.address, e.field, e.expected */ }}
            onSelectionChange={(sel) => {}} />
    );
    // sheet.current.select('E4'), .scrollTo('B2000'), .startEdit('text'), .focus(), .showSheet(id), .getSelection()
}
```

Writing data from code, as the Nexa data grid's populate does (data stays data: a text never becomes a formula):

```js
import { populate } from '@kufayeka/sheet/core';
populate(wb, sheetId, { at: 'A2', header: true }, [{ item: 'Pile', qty: 10 }, { item: 'Beam', qty: 4 }]);
```

Saving: only what changed, as whole rows by id, and the server checks it again with the same rules:

```js
const patch = wb.pendingPatch();                 // { sheets, columns, rows: { upsert, delete }, upTo }
await api.save(patch);                           // the host's own call to Nexa AM
wb.saved(patch, { version: answer.version });     // a change made while saving stays for the next save

// on the server (Node), with @kufayeka/sheet/core:
const { ok, problems } = checkPatch(storedDoc, patch, { rules, types });   // refuse the save when !ok
const next = mergePatch(storedDoc, patch);                                  // what to keep
```

## Working on it

```
npm install
npm run build      the ES modules, the stylesheet and the type declarations, in dist/
npm test           every test: the core in Node, the server render, and the grid in Chrome with real mouse and keyboard
npm run example    the example page at http://127.0.0.1:5180/
```

The tests in Chrome use the CDP testkit of the Nexa dashboard, next to this package; without it they are skipped.

The plan, step by step, is in `.agents/SHEET_REACT_PLAN.md` of the workspace.
