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

## Working on it

```
npm install
npm run build      the ES modules, the stylesheet and the type declarations, in dist/
npm test           every test: the core in Node, the server render, and the grid in Chrome with real mouse and keyboard
npm run example    the example page at http://127.0.0.1:5180/
```

The tests in Chrome use the CDP testkit of the Nexa dashboard, next to this package; without it they are skipped.

The plan, step by step, is in `.agents/SHEET_REACT_PLAN.md` of the workspace.
