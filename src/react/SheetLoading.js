// The screen a sheet shows while its workbook is still on its way (a fetch from the server, a file being read). It has the shape of the real
// sheet, the menu bar, the toolbar, the formula bar, the headers, the grid and the tabs, so the page does not jump when the workbook arrives,
// and a soft shimmer tells that something is coming instead of an empty box.

const COLUMNS = 12;
const ROWS = 24;

/**
 * A skeleton of the sheet. <Sheet workbook={null}> shows it by itself; a host may also show it on its own.
 * @param {{ className?: string, style?: import('react').CSSProperties, label?: string }} props
 *   label: the words read out by a screen reader and shown under the shimmer ("Loading…" by default).
 */
export function SheetLoading(props) {
    const label = props.label || 'Loading…';
    const heads = [];
    for (let c = 0; c < COLUMNS; c++) heads.push(<span key={c} className="ks-load-colhead">{String.fromCharCode(65 + c)}</span>);
    const rows = [];
    for (let r = 0; r < ROWS; r++) rows.push(<span key={r} className="ks-load-rowhead">{r + 1}</span>);
    return (
        <div className={'ks-sheet ks-loading' + (props.className ? ' ' + props.className : '')} style={props.style} role="status" aria-busy="true" aria-label={label}>
            <div className="ks-load-bar ks-load-menubar"><i style={{ width: 34 }} /><i style={{ width: 30 }} /><i style={{ width: 34 }} /><i style={{ width: 42 }} /><i style={{ width: 40 }} /></div>
            <div className="ks-load-bar ks-load-toolbar"><i style={{ width: 70 }} /><i style={{ width: 110 }} /><i style={{ width: 90 }} /><i style={{ width: 130 }} /><i style={{ width: 80 }} /></div>
            <div className="ks-load-bar ks-load-formula"><i style={{ width: 80 }} /><i style={{ flex: 1 }} /></div>
            <div className="ks-load-body">
                <div className="ks-load-heads"><span className="ks-load-origin" />{heads}</div>
                <div className="ks-load-main">
                    <div className="ks-load-rows">{rows}</div>
                    <div className="ks-load-grid"><div className="ks-load-shine" /><span className="ks-load-label">{label}</span></div>
                </div>
            </div>
            <div className="ks-load-bar ks-load-tabs"><i style={{ width: 80 }} /></div>
        </div>
    );
}
