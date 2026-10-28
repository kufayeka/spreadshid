// The core of the sheet: the workbook, its changes and its calculation, with no React and no DOM. The browser uses it under the grid, and a server (Nexa AM)
// uses the same code to check what a save brings, so a rule that the grid shows is also a rule that the server keeps.

/** The version of the package, so that a saved workbook can say which sheet made it. */
export const VERSION = '0.1.0';

import { FUNCTIONS as ALL_FUNCTIONS } from './formula/xlfuncs.js';
export { createWorkbook } from './workbook.js';
export { newId } from './ids.js';
export { keyBetween, keysBetween, compareKeys } from './order.js';
export { storeFormula, formulaText, resolveRef, isStoredFormula } from './refs.js';
export { parseInput } from './input.js';
export { roundTo } from './calc.js';
export { colName, colIndex } from './formula/address.js';
export { ERR, isError } from './formula/xlvalue.js';
export { formatValue, localeInfo, FORMAT_PRESETS, dateToSerial, serialToDate } from './format.js';
export { displayOf } from './display.js';
export { populate } from './populate.js';
export { fromApiMakerType, fieldType, checkValue } from './types.js';
export { mergePatch, checkPatch, viewFor } from './server.js';
export { copyBlock, pasteClip, pasteText, fillBlock } from './transfer.js';
export { findAll, replaceIn, sortRange } from './search.js';
export { tableOf, pivot, PIVOT_FUNCTIONS } from './pivot.js';
export { exportXlsx, importXlsx, importXlsxInto, importCsvInto, exportCsv, parseCsv, codeOfFormat } from './excel/index.js';
export { resolveAccess, ACTIONS, ACTION_INFO, UI_ITEMS, validateAccess, parseWhere } from './policy.js';

/** The names of every function a formula can use, in order (for a list of them, or a check). */
export const FUNCTION_NAMES = Object.keys(ALL_FUNCTIONS).sort();
