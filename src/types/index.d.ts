// The public types of @kufayeka/sheet (the React part), written by hand: see core.d.ts. The build copies this file to dist/types/index.d.ts.
import type { ForwardRefExoticComponent, RefAttributes, CSSProperties } from 'react';
import type { Workbook, Op, Source, AccessRow, Who } from './core/index.js';

/** A message of the sheet (onNotice). */
export interface SheetNotice {
    /** refused: a change was not let through (access, rules, validation, types, beforeOp); error: something went wrong; info: just so you know. */
    kind: 'refused' | 'error' | 'info';
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
    /** The id of the sheet to show (the host controls it, with onSheetChange). */
    sheet?: string | null;
    onSheetChange?: (sheetId: string) => void;
    onOp?: (event: { ops: Op[]; source: Source }) => void;
    onReject?: (event: { op: Op; reason: string; source: Source }) => void;
    /**
     * Every message the sheet has for the person, before it shows: a change refused, an error, an information.
     * Return a text to show that instead, null to show nothing (your app shows it its own way), or nothing to keep the sheet's own text.
     * @example
     * onNotice={(n) => (n.kind === 'refused' ? null : undefined)}   // refusals go to your own toast, the rest stays
     */
    onNotice?: (notice: SheetNotice) => string | null | undefined | void;
    onCellError?: (event: { address: string; field?: string; value: unknown; expected: string }) => void;
    /** Called when the selection changes. A mouse drag calls it once, when the mouse is let go; a click, the arrow keys and select() call it at once. */
    onSelectionChange?: (selection: SheetSelection) => void;
    /** The name a download gets, without its extension. */
    fileName?: string;
    access?: { rows: AccessRow[] | null; who: Who };
    user?: { id: string; name: string };
    showProtected?: boolean;
    className?: string;
    style?: CSSProperties;
}

export const Sheet: ForwardRefExoticComponent<SheetProps & RefAttributes<SheetHandle>>;

/** Read a workbook in a component: it draws again when what `read` gives changes. A workbook still loading (null) gives undefined. */
export function useWorkbook<T>(wb: Workbook | null | undefined, read: (wb: Workbook) => T): T | undefined;
export function useWorkbook(wb: Workbook): Workbook;
export function useWorkbook(wb: Workbook | null | undefined): Workbook | undefined;

export const VERSION: string;

export type * from './core/index.js';
