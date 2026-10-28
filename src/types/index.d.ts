// The public types of @kufayeka/sheet (the React part), written by hand: see core.d.ts. The build copies this file to dist/types/index.d.ts.
import type { ForwardRefExoticComponent, RefAttributes, CSSProperties } from 'react';
import type { Workbook, Op, Source, Policy, Who } from './core/index.js';

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
    onCellError?: (event: { address: string; field?: string; value: unknown; expected: string }) => void;
    onSelectionChange?: (selection: SheetSelection) => void;
    /** The name a download gets, without its extension. */
    fileName?: string;
    access?: { policy: Policy | null; who: Who };
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
