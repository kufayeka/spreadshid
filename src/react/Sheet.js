import { VERSION } from '../core/index.js';

/**
 * The spreadsheet.
 *
 * @param {object} props
 * @param {string} [props.className] An extra class on the outer element, for the host's layout.
 * @param {import('react').CSSProperties} [props.style] Inline style of the outer element (its height above all: the grid fills it).
 */
export function Sheet(props) {
    // Nothing here may touch window or document while rendering: Next.js renders this on the server first, where neither exists.
    return (
        <div className={'ks-sheet' + (props.className ? ' ' + props.className : '')} style={props.style} data-sheet-version={VERSION} role="grid" aria-label="Spreadsheet">
            <div className="ks-empty">Sheet {VERSION}</div>
        </div>
    );
}
