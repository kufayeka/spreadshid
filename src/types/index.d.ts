// The public types of @kufayeka/sheet (the React part), written by hand: see core.d.ts. The build copies this file to dist/types/index.d.ts.
import type { ForwardRefExoticComponent, RefAttributes, CSSProperties } from 'react';
import type { Workbook, Op, Source, AccessRow, Who, WorkbookDoc } from './core/index.js';

/** The marks of the cells a person may not change (Sheet marks). */
export interface CellMarks {
    /** A lock in the top right corner of a cell that can be read, not changed. Default true. */
    lock?: boolean;
    /** An eye, crossed out, in the corner of a hidden cell (•••). Default true. */
    hidden?: boolean;
    /** A light grey background, and the text of a read-only cell a little paler. */
    tint?: boolean;
    /** Thin diagonal stripes. */
    stripes?: boolean;
}

/** The access of a Sheet: the rows, the person, and the rules editor. */
export interface SheetAccess {
    rows: AccessRow[] | null;
    who: Who;
    /** 'live' (default): the sheet as this person works in it. 'setup': the rules editor, each cell showing a coloured square per who with a rule there. */
    view?: 'live' | 'setup';
    /** setup: the index of the selected row, outlined in the sheet in its who's colour. */
    selected?: number | null;
    /** setup: a square was clicked; the index of the row it stands for (the first of that who's rows in the cell). */
    onSelect?: (index: number) => void;
    /** setup: a colour of your own for some whos (the others get one from accessColor). */
    colors?: Record<string, string>;
}

/** What onSave gets: which item was chosen, and the document to keep (wb.toJSON()). */
export interface SheetSave {
    /** save: overwrite this file; saveAsNewVersion: a new version of this file; saveAsACopy: a new file. Also the action: 'file.' + mode. */
    mode: 'save' | 'saveAsNewVersion' | 'saveAsACopy';
    doc: WorkbookDoc;
    workbook: Workbook;
}

/** A message of the sheet (onNotice). */
export interface SheetNotice {
    /**
     * refused: a change was not let through (access, rules, validation, types, beforeOp); error: something went wrong; info: just so you know;
     * warning: a mistake of the developer (an access row that can never match). A warning never pops up in the sheet: it goes to the console
     * unless onNotice returns null.
     */
    kind: 'refused' | 'error' | 'info' | 'warning';
    /** The sheet's own text: the rule's message when it has one. */
    reason: string;
    /** The cell it is about, when there is one ('B4'). */
    address?: string;
    /** The action that was refused ('edit', 'copy', 'paste', 'comment.reply' ...), when it is known. */
    action?: string;
    /** Who made the change (a refused op). */
    source?: Source;
    /** The refused op, when the refusal came from the workbook. */
    op?: Op;
    /** warning about an access row: its place in access.rows (counted from 0). */
    index?: number;
    /** warning about an access row: the row itself. */
    row?: AccessRow;
    /** warning about an access row: every problem it has, one sentence each ('who is a user ("rina" or "user:rina"), a role ("role:kasir") or everyone ("*")'). */
    problems?: string[];
}

/** What is selected, as the host gets it (onSelectionChange, ref.getSelection()). */
export interface SheetSelection {
    sheet: { id: string; name: string };
    /** The active cell; r and c counted from 0. */
    active: { r: number; c: number; address: string };
    /** Every rectangle selected (several with Ctrl). */
    ranges: Array<{ r1: number; c1: number; r2: number; c2: number; address: string }>;
    /** All of them as one text, "B2:D10, F2": what a rule's range takes. */
    address: string;
}

/** What the host's code can ask of the sheet, through a ref. */
export interface SheetHandle {
    readonly workbook: Workbook;
    /** Select "B7", "A1:C3" or a rectangle, and show it. */
    select(target: string | { r1: number; c1: number; r2?: number; c2?: number }): void;
    scrollTo(address: string): void;
    startEdit(text?: string): void;
    focus(): void;
    showSheet(sheetId: string): void;
    getSelection(): SheetSelection;
}

export interface SheetProps {
    /** The workbook to show and change. Without one the sheet makes an empty workbook. */
    workbook?: Workbook | null;
    /** Shows the loading skeleton instead of the sheet. It is shown by itself while `workbook` is null (still being fetched). */
    loading?: boolean;
    /** The words under the skeleton's shimmer ('Loading…' by default). */
    loadingLabel?: string;
    /** The id of the sheet to show (the host controls it, with onSheetChange). */
    sheet?: string | null;
    onSheetChange?: (sheetId: string) => void;
    onOp?: (event: { ops: Op[]; source: Source }) => void;
    onReject?: (event: { op: Op; reason: string; source: Source }) => void;
    /**
     * Every message the sheet has for the person, before it shows: a change refused, an error, an information, and the developer's warnings.
     * Return a text to show that instead, null to show nothing (your app shows it its own way), or nothing to keep the sheet's own text.
     * @example
     * onNotice={(n) => (n.kind === 'refused' ? null : undefined)}   // refusals go to your own toast, the rest stays
     */
    onNotice?: (notice: SheetNotice) => string | null | undefined | void;
    /**
     * false: the sheet never shows its own popup. onNotice still hears every message, so your app shows them its own way.
     * True by default.
     */
    notices?: boolean;
    /**
     * Your app saves the file. With it the File menu has Save (also Ctrl+S), Save as new version and Save as a copy; without it they do not show.
     * Each is an action of the access rows: file.save, file.saveAsNewVersion, file.saveAsACopy ("file" or "file.*" names the three).
     * Return a promise: the items are greyed until it settles, a rejection shows as an error, a resolve as "Saved".
     *
     * onSave={async ({ mode, doc }) => { if (mode === 'saveAsACopy') await saveNew(folderId, doc); else ... }}
     */
    onSave?: (save: SheetSave) => unknown;
    /**
     * What a cell the person may not read (deny read) holds in File > Download (.xlsx and .csv): "-" by default, "" for an empty cell.
     * A cell they may not see (deny see) is always empty, and a formula that reads either goes out as its answer only, without the formula.
     */
    downloadMask?: string;
    onCellError?: (event: { address: string; field?: string; value: unknown; expected: string }) => void;
    /** Called when the selection changes. A mouse drag calls it once, when the mouse is let go; a click, the arrow keys and select() call it at once. */
    onSelectionChange?: (selection: SheetSelection) => void;
    /** The name a download gets, without its extension. */
    fileName?: string;
    /** The access rows and the person who opens (chapter 13). With view 'setup' the sheet is the rules editor. */
    access?: SheetAccess;
    user?: { id: string; name: string };
    /** How the card of a cell's comments opens: 'hover' (default) shows it while the mouse is on a marked cell, a click keeps it; 'click': on a click only. */
    comments?: { open?: 'hover' | 'click' };
    /**
     * How the cells this person may not change are marked (live view). Default { lock: true, hidden: true }; the marks mix freely; false: none.
     * @example
     * marks={{ tint: true, lock: true }}   // a grey tint and the lock
     */
    marks?: false | CellMarks;
    className?: string;
    style?: CSSProperties;
}

export const Sheet: ForwardRefExoticComponent<SheetProps & RefAttributes<SheetHandle>>;

/** Read a workbook in a component: it draws again when what `read` gives changes. A workbook still loading (null) gives undefined. */
/**
 * Reads something of a workbook in a component, and draws the component again when it changes.
 * With a workbook that is always there, the answer is T; with one that may still be loading (null), it is T | undefined.
 * @example
 * const total = useWorkbook(wb, (w) => w.display('Produk', 'E5').text);
 */
export function useWorkbook<T>(wb: Workbook, read: (wb: Workbook) => T): T;
export function useWorkbook<T>(wb: Workbook | null | undefined, read: (wb: Workbook) => T): T | undefined;
export function useWorkbook(wb: Workbook): Workbook;
export function useWorkbook(wb: Workbook | null | undefined): Workbook | undefined;

export const VERSION: string;

export type * from './core/index.js';
