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
    | { kind: 'scale'; min: ScalePoint; mid?: ScalePoint | null; max: ScalePoint }
    /** A data bar: a bar under the cell's text as long as its number, from the smallest (0 when all are positive) to the largest of the range. */
    | { kind: 'bar'; color?: string; min?: Omit<ScalePoint, 'color'> | null; max?: Omit<ScalePoint, 'color'> | null };
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

// ---- charts -----------------------------------------------------------------------------------------------------------------------------------

export type ChartType = 'column' | 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'combo' | 'scatter' | 'bullet' | 'waterfall';
/** How a value axis is written and how far it goes. */
export interface ChartAxis { min?: number; max?: number; prefix?: string; suffix?: string; decimals?: number; percent?: boolean }
/** One series' own settings, by its place in the data (first series first). */
export interface ChartSeriesSpec {
    name?: string; color?: string;
    /** How it is drawn: in a combo, line or column (or area) chart a line, columns or an area; in a scatter 'points' leaves the line out. */
    type?: 'line' | 'column' | 'area' | 'points';
    axis?: 'left' | 'right'; dash?: boolean; hidden?: boolean; labels?: boolean;
    smooth?: boolean; markers?: boolean; width?: number;
    /** A scatter's point size, in pixels. */
    size?: number;
    /** Its own values (y), as a range: a series of its own ranges, after the block's series (or with no block at all). */
    values?: string;
    /** A scatter series' own x values, as a range (numbers or dates, at their real distances). */
    x?: string;
    /** The cell that holds its name, as a range of one cell (when `name` is not given). */
    nameFrom?: string;
    /** A label after the last point: true for "name value", a text for "text value" (an S-curve's "Realisasi 49,5%"). */
    endLabel?: boolean | string;
}
/** What a chart is: where it stands, what it reads, how it looks. `at` and `data` are range text when given ("F3:L18", "Data!A1:D7", a named range). */
export interface ChartSpec {
    at?: string; data?: string; type?: ChartType;
    /** The series run down the columns or along the rows; 'auto' (the default) as Excel: down the columns when the range is at least as tall as wide. */
    seriesIn?: 'auto' | 'cols' | 'rows';
    /** The block's first column holds the categories (found from its text when left out); or a range of its own that every series shares. */
    categories?: boolean | string;
    /** scatter: a line through each series' points (a series of type 'points' has none). */
    lines?: boolean;
    /** scatter: the x axis. */
    x?: ChartAxis;
    title?: string; subtitle?: string; legend?: 'top' | 'right' | 'bottom' | 'none'; labels?: boolean; stacked?: boolean; grid?: boolean;
    smooth?: boolean; markers?: boolean;
    /** 'none': transparent, laid over its cells (the mouse goes through to them; the chart is picked by its edge). */
    background?: 'white' | 'none';
    /** 'cells': the plot is the block of cells itself and category i stands in the middle of column i (an S-curve over the weeks of a schedule). */
    align?: 'fit' | 'cells';
    xAxis?: boolean; yAxis?: boolean; y?: ChartAxis; y2?: ChartAxis; colors?: string[]; series?: ChartSeriesSpec[];
    /** bullet: amber when the actual is below the target by more than `warn`, red by more than `bad` (percentage points on a percent axis). */
    warn?: number; bad?: number;
    /** waterfall: the categories (from 0) that are totals; the last one is a total when its cell is empty. */
    totals?: number[];
    /** donut: the text in the middle (the total by default) and under it (the series' name). */
    centerText?: string; centerLabel?: string;
    upColor?: string; downColor?: string; totalColor?: string;
    [key: string]: unknown;
}
/** A chart as wb.charts() gives it: its settings, and where its cells and data are now. */
export interface ChartInfo extends Omit<ChartSpec, 'at' | 'data' | 'x'> { id: string; type: ChartType; at: Rect | null; atText: string | null; dataText: string | null; dataAt: (Rect & { s: string }) | null }
/** A group of sparklines: where they stand, what they read, how they look. */
export interface SparklineSpec {
    at?: string; data?: string; type?: 'line' | 'column' | 'winloss'; color?: string; negColor?: string;
    /** line: a dot on the last value (the default), on every value, or none. */
    markers?: 'last' | 'all' | 'none';
    min?: number; max?: number;
}
export interface SparklineInfo extends Omit<SparklineSpec, 'at' | 'data'> {
    id: string; at: Rect | null; atText: string | null; dataText: string | null; dataAt: (Rect & { s: string }) | null;
    cells: Array<{ r: number; c: number; values: Array<number | null> }>;
}
/** What a chart draws, read from its data now. */
export interface ChartModel {
    categories: string[];
    series: Array<Omit<ChartSeriesSpec, 'values' | 'x'> & { name: string; values: Array<number | null>; x?: Array<number | null>; index: number; format: object | null; xFormat?: object | null }>;
    /** How many of the series came from the block (the rest are series of their own ranges). */
    fromBlock?: number;
    seriesIn: 'cols' | 'rows';
    /** How the range was read: series down the columns or along the rows, its first column the categories, its first row the names. */
    layout?: { by: 'cols' | 'rows'; catCol: boolean; headerRow: boolean };
}
export interface PivotResult {
    cells: CellResult[][];
    header: number;
    rowKeys: CellValue[][];
    colKeys: CellValue[][];
    rows: Array<{ cells: CellResult[]; kind: 'row' | 'subtotal' | 'total'; key: CellValue[] }>;
    value(rowKey: CellValue[], colKey: CellValue[], i: number): CellResult;
}

export interface CommentItem { id: string; by: { id: string | null; name: string }; text: string; at: string; edited?: string }
export interface CommentThread { id: string; row: string; col: string; items: CommentItem[]; at: { r: number; c: number } | null }

export interface NamedRange { id: string; name: string; sheetId: string; range: Rect | null; ref: string | null }

export interface ColumnType { kind: 'string' | 'int' | 'number' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'json'; scale?: number; enum?: string[]; field?: string }
export type TypesSpec = { headerRow: number; fields: Record<string, ColumnType> } | { columns: Record<string, ColumnType> };

// ---- access -------------------------------------------------------------------------------------------------------------------------------------------

export type RangeMode = 'edit' | 'readonly' | 'hidden' | 'invisible';
/** A rule for some cells that the host sets with setRules (access per person is AccessRow). */
export interface Rule {
    sheet?: string;
    range?: string;
    columns?: string[];
    headerRow?: number;
    when?: string;
    mode: RangeMode;
    message?: string;
}
/** The parts of the screen a person sees (AccessInfo.ui). */
export interface AccessUi {
    menubar: boolean; toolbar: boolean; formulaBar: boolean; headers: boolean; gridlines: boolean; tabs: boolean;
    hide: string[];
    disallowed: 'grey' | 'hide';
    sheets: string[] | null;
    area: string | Record<string, string> | null;
}
/**
 * One rule of access: one row of a table in your database. "who may (not) do what, where, when".
 * The most specific row wins (user: over role: over *), deny wins within a level, and what no row allows is not given.
 * @example
 * { who: 'role:kasir', effect: 'allow', action: 'edit', where: 'Stok!col:Qty', when: '=$G2<>"Approved"', message: 'Already approved' }
 */
export interface AccessRow {
    /** 'user:rina', 'role:kasir' or '*' (everyone). */
    who: string;
    effect: 'allow' | 'deny';
    /** 'read', 'edit', 'see', an action of ACTIONS ('format.bold', 'sort' ...), a group ('format'), 'ui.toolbar', 'view.area', 'view.sheet' or '*'. */
    action: string;
    /** 'Stok!A1:F100', 'Stok!col:Qty', 'Stok' (a whole sheet), 'A1:F100'; empty: everywhere. */
    where?: string | null;
    /** A formula written for the first row of the range, true where the row holds ('=$G2="Approved"'). */
    when?: string | null;
    /** What the person is told when this refuses something. */
    message?: string | null;
}
/** The person who opens: 'rina' (a user), or { user: 'rina', roles: ['kasir'] }. */
export type Who = string | { user?: string; roles?: string[] };
export interface AccessInfo { owner: boolean; roles: string[]; ui: AccessUi; message: string | null }
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
    setValues(at: CellAt, value: CellValue | CellValue[] | CellValue[][], how?: How): Op[] | null;
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
    // charts
    addChart(spec: ChartSpec & { at: string }, how?: How): string;
    setChart(id: string, patch: ChartSpec, how?: How): Op[] | null;
    removeChart(id: string, how?: How): Op[] | null;
    charts(): ChartInfo[];
    chartData(id: string): ChartModel;
    // sparklines: a small chart in each cell of `at`, cell i drawing row i of `data` (column i when `at` is a row)
    addSparkline(spec: SparklineSpec & { at: string; data: string }, how?: How): string;
    setSparkline(id: string, patch: SparklineSpec, how?: How): Op[] | null;
    removeSparkline(id: string, how?: How): Op[] | null;
    sparklines(): SparklineInfo[];
    // comments
    addComment(at: CellAt, text: string, how?: How): { thread: string; item: string };
    replyComment(thread: string, text: string, how?: How): string;
    editComment(thread: string, item: string, text: string, how?: How): Op[] | null;
    deleteComment(thread: string, item: string, how?: How): Op[] | null;
    /** True when the person may edit (or delete) that comment: its writer, or a moderator, and the access rows allow it. */
    mayChangeComment(thread: string, item: string, action: 'edit' | 'delete'): boolean;
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
    setValues(sheet: SheetRef, at: CellAt, value: CellValue | CellValue[] | CellValue[][], how?: How): Op[] | null;
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
    /** The person the workbook is open for (createWorkbook's user, or setUser), as their comments are signed. */
    user(): { id: string | null; name: string };
    setRules(rules: Rule[]): void;
    setAccess(rows: AccessRow[] | null, who?: Who): void;
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

export function mergePatch(doc: WorkbookDoc, patch: Patch, what?: { rules?: Rule[]; access?: AccessRow[]; who?: Who }): WorkbookDoc;
export function checkPatch(doc: WorkbookDoc, patch: Patch, what: { rules?: Rule[]; types?: Record<string, TypesSpec>; access?: AccessRow[]; who?: Who }): { ok: boolean; problems: Array<{ sheet: string | null; address: string | null; reason: string }> };
export function viewFor(doc: WorkbookDoc, what: { rules?: Rule[]; access?: AccessRow[]; who?: Who }): WorkbookDoc;

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
/** The categories and series of a block of cells, read as Excel reads a selection for a chart. */
export function chartSeries(block: Array<Array<{ value: unknown; text: string; format?: object | null }>>, spec?: ChartSpec): ChartModel;
export const CHART_TYPES: ChartType[];
export const CHART_DEFAULTS: Readonly<ChartSpec>;

export function exportXlsx(wb: Workbook): Uint8Array;
export function importXlsx(bytes: Uint8Array, options?: WorkbookOptions & { settings?: Settings }): Promise<{ workbook: Workbook; warnings: string[]; active: string }>;
export function importXlsxInto(wb: Workbook, bytes: Uint8Array, how?: How): Promise<{ sheetIds: string[]; warnings: string[] }>;
export function importCsvInto(wb: Workbook, text: string, name?: string, how?: How): { sheetIds: string[]; warnings: string[] };
export function exportCsv(wb: Workbook, sheet: SheetRef, options?: { delimiter?: string }): string;
export function parseCsv(text: string, delimiter?: string): string[][];
export function codeOfFormat(format: Format, settings?: Settings): string;

export function resolveAccess(rows: AccessRow[] | null, who?: Who): AccessInfo & { can(action: string): boolean };
export const ACTIONS: string[];
export const ACTION_INFO: Array<{ id: string; label: string; group: string }>;
export const UI_ITEMS: Array<{ id: string; label: string; group: string }>;
export function validateAccess(rows: unknown): Array<{ row: number; problem: string }>;
/** The colour of a who, the same everywhere: for your own list of rules, so it matches the squares of the rules editor. */
export function accessColor(who: string, colors?: Record<string, string>): string;
/** Where each access row touches a workbook (what the rules editor draws). */
export function accessPlaces(wb: Workbook, rows: AccessRow[], colors?: Record<string, string>): {
    colorOf(index: number): string | null;
    at(sheet: string, r: number, c: number): Array<{ who: string; color: string; rows: number[] }>;
    rects(index: number, sheet: string): Array<{ r1: number; c1: number; r2: number; c2: number }>;
};
export function parseWhere(where: string | null | undefined): { sheet: string | null; range: string | null; columns: string[] | null };
