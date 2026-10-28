// The public types of @kufayeka/sheet/core, written by hand so TypeScript checks what a host writes (the declarations made from the JSDoc of the
// sources lose most of them). The build copies this file to dist/types/core/index.d.ts. test/types.test.js compiles a host's code against it,
// and test/reference.test.js checks that every export and every function of a workbook and of a sheet handle is declared here.

// ---- values and places ------------------------------------------------------------------------------------------------------------------------------

/** What a cell holds or a formula gives: a number (a date is a day number), a text, TRUE or FALSE, or nothing. */
export type CellValue = string | number | boolean | null;
/** A formula that could not be worked out: #DIV/0!, #N/A, #VALUE!, #REF!, #NAME?, #NUM!, #CYCLE!. Check with isError(). */
export interface CellError { readonly code: string }
/** What value() gives: the value, or an error. */
export type CellResult = CellValue | CellError;
/** A formula as it is kept: its text with the references taken out, the references by ids, and the result it had when saved. */
export interface StoredFormula { f: string; refs: object[]; v?: CellResult }
/** What a cell keeps (raw()). */
export type CellContent = CellValue | StoredFormula;

/** A sheet by its name ("Produk") or its id. */
export type SheetRef = string;
/** A cell by its address ("B2"), or its row number counted from 0 (with the column number as the next argument). */
export type CellAt = string | number;
/** A rectangle by numbers counted from 0. */
export interface Rect { r1: number; c1: number; r2: number; c2: number }
/** A range: "A1:C9", "2:5" (rows), "B:D" (columns), "A1:E1, A3:E3" (several), a rectangle, or a list of them. */
export type RangeAt = string | Rect | Array<string | Rect>;
/** Rows: "2", "2:5", or a row number counted from 0. */
export type RowsAt = string | number;
/** Columns: "C", "B:D", or a column number counted from 0. */
export type ColsAt = string | number;

/** Who makes a change. 'user' is checked by validation, types and access as typing is; 'remote' is neither checked nor undone. */
export type Source = 'user' | 'code' | 'undo' | 'redo' | 'remote';
/** The last argument of every function that changes something. */
export interface How { source?: Source }

// ---- style and format ------------------------------------------------------------------------------------------------------------------------------

export interface BorderSide { style?: 'solid' | 'dashed' | 'dotted' | 'double'; width?: number; color?: string }
export interface Borders { top?: BorderSide | null; right?: BorderSide | null; bottom?: BorderSide | null; left?: BorderSide | null }

export interface Format {
    type: 'general' | 'number' | 'money' | 'percent' | 'scientific' | 'date' | 'time' | 'datetime' | 'duration' | 'text' | 'custom';
    decimals?: number;
    /** number: group the thousands (default true). */
    thousands?: boolean;
    /** money: the currency (default: the workbook's). */
    currency?: string;
    /** money: a symbol of your own. */
    symbol?: string;
    symbolSpace?: boolean;
    negative?: 'minus' | 'parens' | 'red';
    /** date, time, custom: "dddd, d MMMM yyyy", "#,##0;[Red](#,##0)". */
    pattern?: string;
    prefix?: string;
    suffix?: string;
    /** The id of a column whose text in the same row is the suffix ("420 zak"). */
    suffixFrom?: string;
}

/** The style of a cell. In setStyle every key is merged; null takes one away. */
export interface Style {
    bold?: boolean | null;
    italic?: boolean | null;
    underline?: boolean | null;
    strike?: boolean | null;
    color?: string | null;
    fill?: string | null;
    fontSize?: number | null;
    font?: string | null;
    align?: 'left' | 'center' | 'right' | null;
    valign?: 'top' | 'middle' | 'bottom' | null;
    wrap?: 'wrap' | 'clip' | 'overflow' | null;
    rotate?: number | 'vertical' | null;
    borders?: Borders | null;
    format?: Format | null;
    link?: string | null;
}

/** What a cell shows on the screen. */
export interface Display { text: string; align: 'left' | 'center' | 'right'; kind: string; color?: string }

export interface RowProps { height?: number | null; hidden?: boolean | null; level?: number | null }
export interface ColProps { width?: number | null; hidden?: boolean | null; level?: number | null; format?: Format | null }
export interface SheetProps {
    name?: string;
    hidden?: boolean | null;
    freezeRows?: number | null;
    freezeCols?: number | null;
    hideGridlines?: boolean | null;
    [key: string]: unknown;
}
export interface Settings { locale?: string; currency?: string; names?: object[] | null; [key: string]: unknown }

/** Sizes and places of the rows (or columns) in pixels: a hidden one is 0 wide. */
export interface Axis { count: number; total: number; start(i: number): number; size(i: number): number; indexAt(px: number): number }

// ---- data tools ---------------------------------------------------------------------------------------------------------------------------------------

export type ConditionOp = 'empty' | 'notEmpty' | 'textContains' | 'textNotContains' | 'textStarts' | 'textEnds' | 'textIs' | 'dateIs' | 'dateBefore'
    | 'dateAfter' | 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne' | 'between' | 'notBetween' | 'formula';
export interface ScalePoint { type: 'min' | 'max' | 'number' | 'percent' | 'percentile'; value?: number; color: string }
export type ConditionalSpec =
    | { kind?: 'single'; op: ConditionOp; a?: CellValue; b?: CellValue; formula?: string; style: Pick<Style, 'bold' | 'italic' | 'underline' | 'strike' | 'color' | 'fill'> }
    | { kind: 'scale'; min: ScalePoint; mid?: ScalePoint | null; max: ScalePoint };
export type ConditionalRule = ConditionalSpec & { id: string; ranges: object[] };

export interface ValidationSpec {
    kind: 'list' | 'listFrom' | 'checkbox' | 'number' | 'date' | 'textLength' | 'text';
    values?: CellValue[];
    source?: string;
    op?: 'between' | 'notBetween' | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'notContains' | 'email' | 'url';
    a?: CellValue | 'today';
    b?: CellValue | 'today';
    /** true (default): what breaks it is refused; false: kept and marked. */
    reject?: boolean;
    help?: string;
    /** The refusal in your app's language; {cell} is the address. */
    message?: string;
}
export type ValidationRule = ValidationSpec & { id: string; r1: string; c1: string; r2: string; c2: string };

export type FilterCriterion = { hidden: CellValue[] } | { op: ConditionOp; a?: CellValue; b?: CellValue; formula?: string } | null;
export interface Filter { r1: string; c1: string; r2: string; c2: string; columns: Record<string, FilterCriterion> }

export interface Group { level: number; from: number; to: number; folded: boolean }
export interface Groups { groups: Group[]; maxLevel: number }

export type PivotFunction = 'SUM' | 'COUNT' | 'COUNTA' | 'COUNTUNIQUE' | 'AVERAGE' | 'MAX' | 'MIN' | 'MEDIAN' | 'PRODUCT';
export interface PivotSpec {
    rows?: string[];
    columns?: string[];
    values: Array<{ field: string; fn?: PivotFunction; as?: string }>;
    filters?: Record<string, { hidden: CellValue[] }>;
    sort?: Record<string, 'asc' | 'desc' | { by: string; dir?: 'asc' | 'desc' }>;
    group?: Record<string, 'year' | 'quarter' | 'month' | 'week'>;
    totals?: boolean;
}
export interface PivotInfo { id: string; source: string; spec: PivotSpec; area: Rect | null }
export interface PivotResult {
    cells: CellResult[][];
    header: number;
    rowKeys: CellValue[][];
    colKeys: CellValue[][];
    rows: Array<{ cells: CellResult[]; kind: 'row' | 'subtotal' | 'total'; key: CellValue[] }>;
    value(rowKey: CellValue[], colKey: CellValue[], i: number): CellResult;
}

export interface CommentItem { id: string; by: { id: string | null; name: string }; text: string; at: string; edited?: string }
export interface CommentThread { id: string; row: string; col: string; resolved: boolean; items: CommentItem[]; at: { r: number; c: number } | null }

export interface NamedRange { id: string; name: string; sheetId: string; range: Rect | null; ref: string | null }

export interface ColumnType { kind: 'string' | 'int' | 'number' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'json'; scale?: number; enum?: string[]; field?: string }
export type TypesSpec = { headerRow: number; fields: Record<string, ColumnType> } | { columns: Record<string, ColumnType> };

// ---- access -------------------------------------------------------------------------------------------------------------------------------------------

export type RangeMode = 'edit' | 'readonly' | 'hidden' | 'invisible';
/** A rule for some cells (setRules, and a role's ranges in a policy). */
export interface Rule {
    sheet?: string;
    range?: string;
    columns?: string[];
    headerRow?: number;
    when?: string;
    mode: RangeMode;
    message?: string;
}
export interface RoleUi {
    menubar?: boolean; toolbar?: boolean; formulaBar?: boolean; headers?: boolean; gridlines?: boolean; tabs?: boolean;
    hide?: string[];
    disallowed?: 'grey' | 'hide';
    sheets?: string[];
    area?: string | Record<string, string>;
}
export interface Role { can?: string[]; ui?: RoleUi; ranges?: Rule[] }
/** Who may do what in a workbook: plain JSON your app keeps with the workbook. */
export interface Policy {
    owners?: string[];
    members?: Record<string, string | string[]>;
    default?: string;
    message?: string;
    roles: Record<string, Role>;
}
/** The person who opens: "user:rina", or { user: 'joko', groups: ['gudang'] }. */
export type Who = string | { user?: string; groups?: string[] };
export interface AccessInfo { owner: boolean; roles: string[]; ui: Required<Omit<RoleUi, 'area' | 'sheets'>> & { area: string | Record<string, string> | null; sheets: string[] | null }; message: string | null }
export interface CellMode { mode: RangeMode; message?: string }

// ---- changes ------------------------------------------------------------------------------------------------------------------------------------------

export interface OpBase { sheet?: string; user?: { id: string | null; name: string } | string | null; at?: string }
export type Op = OpBase & (
    | { t: 'cells' | 'styles'; changes: Array<{ row: string; col: string; before: unknown; after: unknown }> }
    | { t: 'insertRows' | 'deleteRows'; rows: Array<{ id: string; key: string; cells?: object; style?: object; props?: object }> }
    | { t: 'insertCols' | 'deleteCols'; cols: Array<{ id: string; key: string; props?: object }> }
    | { t: 'moveRows' | 'moveCols'; moves: Array<{ id: string; before: string; after: string }> }
    | { t: 'rowProps' | 'colProps'; changes: Array<{ id: string; before: object; after: object }> }
    | { t: 'sheetProps' | 'settings'; before: object; after: object }
    | { t: 'addSheet' | 'removeSheet'; sheet: object }
    | { t: 'moveSheet'; before: string; after: string }
);

export interface WorkbookEvents {
    op: { ops: Op[]; source: Source };
    reject: { op: Op; reason: string; source: Source };
    cellError: { address: string; field?: string; value: unknown; expected: string };
    saved: { version: number };
    access: AccessInfo;
    layout: { sheet?: string };
}

export interface OpContext { source: Source; user: unknown; workbook: Workbook }
export interface WorkbookOptions {
    /** The person working: written in every op and on comments. */
    user?: { id: string; name: string } | string;
    /** Sees every op before it is applied: return it, a changed copy, null to drop it, or { reject: 'why' } to refuse the whole change. */
    beforeOp?: (op: Op, ctx: OpContext) => Op | null | false | { reject: string };
    /** The workbook's clock (TODAY(), NOW(), the time of ops and comments). */
    now?: () => Date;
    /** How many changes undo remembers (default 200). */
    undoLimit?: number;
}

/** A workbook as it is saved: what toJSON() gives and createWorkbook() takes. */
export interface WorkbookDoc {
    id?: string;
    version?: number;
    settings?: Settings;
    sheets: Array<{ id: string; key: string; props: SheetProps; rowCount?: number; columns: object[]; rows: object[] }>;
}
/** What changed since the last save. */
export interface Patch {
    workbook: { id: string; version: number; settings?: Settings };
    upTo: number;
    sheets: { upsert: object[]; delete: string[] };
    columns: { upsert: object[]; delete: string[] };
    rows: { upsert: object[]; delete: string[] };
    isEmpty: boolean;
}

// ---- the functions of a sheet ------------------------------------------------------------------------------------------------------------------------

/** What a sheet handle (wb.sheet('Produk')) has. Every one is also on the workbook, with the sheet as the first argument. */
export interface SheetFns {
    // writing
    setValues(at: CellAt, value: CellValue | CellValue[] | CellValue[][] | ((r: number, c: number, before: CellContent | undefined) => CellValue | undefined), how?: How): Op[] | null;
    setValues(r: number, c: number, value: CellValue | CellValue[] | CellValue[][], how?: How): Op[] | null;
    setBlock(entries: Array<{ at?: string; r?: number; c?: number; value?: CellValue; style?: Style }>, how?: How): Op[] | null;
    clear(range: RangeAt, how?: How): Op[] | null;
    // reading
    value(at: CellAt, c?: number): CellResult;
    input(at: CellAt, c?: number): string;
    display(at: CellAt, c?: number): Display;
    raw(at: CellAt, c?: number): CellContent | undefined;
    cellFormat(at: CellAt, c?: number): Format | null;
    style(at: CellAt, c?: number): Style | undefined;
    shownStyle(at: CellAt, c?: number): Style | undefined;
    size(): { rows: number; cols: number };
    lastFilled(): { r: number; c: number };
    dataRegion(r: number, c: number): Rect;
    forEachFilledRow(fn: (r: number, cells: Record<string, CellContent>, styles: Record<string, Style>) => void): void;
    rowContent(r: number): { cells: Record<string, CellContent>; style: Record<string, Style> } | undefined;
    rowId(r: number): string;
    colId(c: number): string;
    rowIndex(id: string): number;
    colIndex(id: string): number;
    // style and merge
    setStyle(range: RangeAt, style: Style | ((r: number, c: number, before: Style) => Style | null | undefined), how?: How): Op[] | null;
    mergeCells(range: RangeAt, how?: How): Op[] | null;
    unmergeCells(at: CellAt, how?: How): Op[] | null;
    merges(): Rect[];
    // rows and columns
    insertRows(at: RowsAt, count?: number, how?: How): Op[] | null;
    deleteRows(at: RowsAt, count?: number | How, how?: How): Op[] | null;
    moveRows(from: number, count: number, to: number, how?: How): Op[] | null;
    insertCols(at: ColsAt, count?: number, how?: How): Op[] | null;
    deleteCols(at: ColsAt, count?: number | How, how?: How): Op[] | null;
    moveCols(from: number, count: number, to: number, how?: How): Op[] | null;
    setRowProps(rows: RowsAt, props: RowProps, how?: How): Op[] | null;
    setColProps(cols: ColsAt, props: ColProps, how?: How): Op[] | null;
    rowProps(r: number): RowProps | undefined;
    colProps(c: number): ColProps | undefined;
    rowAxis(): Axis;
    colAxis(): Axis;
    // the sheet
    sheetProps(): SheetProps;
    setSheetProps(props: SheetProps, how?: How): Op[] | null;
    duplicateSheet(how?: How): string;
    removeSheet(how?: How): Op[] | null;
    hideSheet(hidden: boolean, how?: How): Op[] | null;
    moveSheet(to: number, how?: How): Op[] | null;
    sheetShown(): boolean;
    // groups
    groupRows(rows: RowsAt, how?: How): Op[] | null;
    ungroupRows(rows: RowsAt, how?: How): Op[] | null;
    groupCols(cols: ColsAt, how?: How): Op[] | null;
    ungroupCols(cols: ColsAt, how?: How): Op[] | null;
    foldRowGroup(from: number, level: number, folded: boolean, how?: How): Op[] | null;
    foldColGroup(from: number, level: number, folded: boolean, how?: How): Op[] | null;
    showRowLevel(level: number, how?: How): Op[] | null;
    showColLevel(level: number, how?: How): Op[] | null;
    rowGroups(): Groups;
    colGroups(): Groups;
    // filter
    createFilter(range: RangeAt, how?: How): Op[] | null;
    setFilterColumn(col: ColsAt, criterion: FilterCriterion, how?: How): Op[] | null;
    removeFilter(how?: How): Op[] | null;
    filterOf(): Filter | null;
    filterValues(col: ColsAt): Array<{ text: string; count: number }>;
    filteredOut(r: number): boolean;
    // conditional formatting
    addConditional(range: RangeAt, rule: ConditionalSpec, how?: How): string;
    setConditional(id: string, range: RangeAt, rule: ConditionalSpec, how?: How): Op[] | null;
    moveConditional(id: string, to: number, how?: How): Op[] | null;
    removeConditional(id: string, how?: How): Op[] | null;
    conditionals(): ConditionalRule[];
    conditionalStyleAt(at: CellAt, c?: number): Style | null;
    // validation
    addValidation(range: RangeAt, rule: ValidationSpec, how?: How): string;
    setValidation(range: RangeAt, rule: ValidationSpec, how?: How): string;
    removeValidation(range: RangeAt, how?: How): Op[] | null;
    validationAt(at: CellAt, c?: number): ValidationRule | null;
    choicesAt(at: CellAt, c?: number): CellValue[];
    invalidAt(at: CellAt, c?: number): string | null;
    // rules and types
    modeAt(at: CellAt, c?: number): CellMode | null;
    setTypes(spec: TypesSpec | null): void;
    typeAt(at: CellAt, c?: number): ColumnType | null;
    // pivot tables
    addPivot(at: string, source: string, spec: PivotSpec, how?: How): string;
    setPivot(id: string, patch: { source?: string; spec?: PivotSpec; at?: string }, how?: How): Op[] | null;
    removePivot(id: string, how?: How): Op[] | null;
    pivots(): PivotInfo[];
    pivotAt(at: CellAt, c?: number): PivotInfo | null;
    // comments
    addComment(at: CellAt, text: string, how?: How): { thread: string; item: string };
    replyComment(thread: string, text: string, how?: How): string;
    editComment(thread: string, item: string, text: string, how?: How): Op[] | null;
    deleteComment(thread: string, item: string, how?: How): Op[] | null;
    resolveComment(thread: string, resolved: boolean, how?: How): Op[] | null;
    comments(): CommentThread[];
    commentAt(at: CellAt, c?: number): CommentThread | null;
    hasComment(at: CellAt, c?: number): boolean;
}

/** A sheet handle: wb.sheet('Produk'). */
export interface SheetApi extends SheetFns {
    readonly id: string;
    readonly name: string;
}

/** The functions of a sheet, on the workbook: the sheet goes first. */
export type WithSheet<T> = { [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (sheet: SheetRef, ...args: A) => R : never };

/** A workbook: createWorkbook(). */
export interface Workbook extends WithSheet<Omit<SheetFns, 'setValues'>> {
    setValues(sheet: SheetRef, at: CellAt, value: CellValue | CellValue[] | CellValue[][] | ((r: number, c: number, before: CellContent | undefined) => CellValue | undefined), how?: How): Op[] | null;
    setValues(sheet: SheetRef, r: number, c: number, value: CellValue | CellValue[] | CellValue[][], how?: How): Op[] | null;
    readonly id: string;
    readonly version: number;
    readonly revision: number;
    sheet(sheet: SheetRef): SheetApi;
    sheetIds(): string[];
    sheetIdByName(name: string): string | null;
    addSheet(name?: string, how?: How): string;
    address(r: number, c: number): string;
    setAutoHeights(sheet: SheetRef, heights: Map<string, number>): void;
    settings(): Settings;
    setSettings(patch: Settings, how?: How): Op[] | null;
    // named ranges
    names(): NamedRange[];
    addName(name: string, sheet: SheetRef, range: RangeAt, how?: How): string;
    setName(id: string, patch: { name?: string; sheetId?: string; range?: RangeAt }, how?: How): Op[] | null;
    removeName(id: string, how?: How): Op[] | null;
    nameRange(name: string): { sheetId: string; range: Rect } | null;
    nameProblem(name: string, exceptId?: string): string;
    // changes
    apply(ops: Op[], how?: How): Op[] | null;
    on<K extends keyof WorkbookEvents>(type: K, fn: (event: WorkbookEvents[K]) => void): () => void;
    undo(): boolean;
    redo(): boolean;
    canUndo(): boolean;
    canRedo(): boolean;
    tick(): void;
    // saving
    toJSON(): WorkbookDoc;
    pendingPatch(): Patch;
    saved(patch?: Patch, answer?: { version?: number }): void;
    unsaved(): boolean;
    // the person and the rules
    setUser(user: { id: string; name: string } | string | null): void;
    setRules(rules: Rule[]): void;
    setAccess(policy: Policy | null, who?: Who): void;
    access(): AccessInfo;
    can(action: string): boolean;
    shows(id: string): boolean;
}

// ---- exports -----------------------------------------------------------------------------------------------------------------------------------------

export const VERSION: string;
export function createWorkbook(doc?: WorkbookDoc | null, options?: WorkbookOptions): Workbook;

export function isError(value: unknown): value is CellError;
export const ERR: Record<string, CellError>;
export const FUNCTION_NAMES: string[];
export function roundTo(n: number, decimals: number): number;

export function newId(): string;
export function keyBetween(a: string | null, b: string | null): string;
export function keysBetween(a: string | null, b: string | null, count: number): string[];
export function compareKeys(a: string, b: string): number;

export function storeFormula(text: string, sheetId: string, grid: object): StoredFormula;
export function formulaText(formula: StoredFormula, sheetId: string, grid: object): string;
export function resolveRef(ref: object, sheetId: string, grid: object): (Rect & { s: string }) | null;
export function isStoredFormula(value: unknown): value is StoredFormula;
export function parseInput(text: string, settings?: Settings, format?: Format): { value: CellValue; format?: Format };
export function colName(c: number): string;
export function colIndex(name: string): number;

export function formatValue(value: unknown, format?: Format | null, settings?: Settings, extra?: { suffixText?: string }): { text: string; color?: string };
export function localeInfo(locale?: string): { locale: string; decimal: string; group: string; order: string; datePattern: string };
export const FORMAT_PRESETS: Record<string, Format>;
export function dateToSerial(date: Date): number;
export function serialToDate(n: number): Date;
export function displayOf(value: unknown, format: Format | null, settings?: Settings, extra?: object): Display;

export function populate(wb: Workbook, sheet: SheetRef, spec: {
    at: string | { r: number; c: number };
    direction?: 'down' | 'right';
    header?: boolean | string[] | Record<string, string>;
    fields?: string[];
    limit?: number;
    shape?: string;
}, data: unknown, how?: How): Rect | null;

export function fromApiMakerType(type: object, library?: Record<string, object>): { fields: Record<string, ColumnType> };
export function fieldType(field: object, library?: Record<string, object>): ColumnType;
export function checkValue(type: ColumnType, value: unknown): string | null;

export function mergePatch(doc: WorkbookDoc, patch: Patch, what?: { rules?: Rule[]; policy?: Policy; who?: Who }): WorkbookDoc;
export function checkPatch(doc: WorkbookDoc, patch: Patch, what: { rules?: Rule[]; types?: Record<string, TypesSpec>; policy?: Policy; who?: Who }): { ok: boolean; problems: Array<{ sheet: string | null; address: string | null; reason: string }> };
export function viewFor(doc: WorkbookDoc, what: { rules?: Rule[]; policy?: Policy; who?: Who }): WorkbookDoc;

/** A copy of cells (copyBlock), to paste with pasteClip. */
export interface Clip { v: 1; h: number; w: number; origin: { sheet: string; r: number; c: number }; cells: object[][]; cut?: boolean }
export function copyBlock(wb: Workbook, sheet: SheetRef, range: string | Rect, cut?: boolean): Clip;
export function pasteClip(wb: Workbook, sheet: SheetRef, at: string | Rect, clip: Clip, only?: 'all' | 'values' | 'styles'): Rect;
export function pasteText(wb: Workbook, sheet: SheetRef, at: string | Rect, text: string): Rect;
export function fillBlock(wb: Workbook, sheet: SheetRef, source: string | Rect, target: string | Rect, dir: 'down' | 'up' | 'right' | 'left', copy?: boolean): Op[] | null;

export interface FindOptions { matchCase?: boolean; wholeCell?: boolean; inFormulas?: boolean; regex?: boolean }
export function findAll(wb: Workbook, sheet: SheetRef, query: string, options?: FindOptions): Array<{ r: number; c: number }>;
export function replaceIn(wb: Workbook, sheet: SheetRef, at: Array<{ r: number; c: number }>, query: string, replacement: string, options?: FindOptions): number;
export function sortRange(wb: Workbook, sheet: SheetRef, range: string | Rect, by: string | number, dir: 'asc' | 'desc'): Op[] | null;

export function tableOf(wb: Workbook, sheet: SheetRef | null, where: string | Rect): { fields: string[]; records: Array<Record<string, CellResult>> };
export function pivot(records: Array<Record<string, unknown>>, spec: PivotSpec): PivotResult;
export const PIVOT_FUNCTIONS: Record<PivotFunction, (values: unknown[]) => CellResult>;

export function exportXlsx(wb: Workbook): Uint8Array;
export function importXlsx(bytes: Uint8Array, options?: WorkbookOptions & { settings?: Settings }): Promise<{ workbook: Workbook; warnings: string[]; active: string }>;
export function importXlsxInto(wb: Workbook, bytes: Uint8Array, how?: How): Promise<{ sheetIds: string[]; warnings: string[] }>;
export function importCsvInto(wb: Workbook, text: string, name?: string, how?: How): { sheetIds: string[]; warnings: string[] };
export function exportCsv(wb: Workbook, sheet: SheetRef, options?: { delimiter?: string }): string;
export function parseCsv(text: string, delimiter?: string): string[][];
export function codeOfFormat(format: Format, settings?: Settings): string;

export function resolveAccess(policy: Policy | null, who?: Who): AccessInfo & { can(action: string): boolean };
export const ACTIONS: string[];
export const ACTION_INFO: Array<{ id: string; label: string; group: string }>;
export const UI_ITEMS: Array<{ id: string; label: string; group: string }>;
export function validatePolicy(policy: unknown): Array<{ path: string; problem: string }>;
