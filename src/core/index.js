// The core of the sheet: the workbook, its changes and its calculation, with no React and no DOM. The browser uses it under the grid, and a server (Nexa AM)
// uses the same code to check what a save brings, so a rule that the grid shows is also a rule that the server keeps.

/** The version of the package, so that a saved workbook can say which sheet made it. */
export const VERSION = '0.1.0';
