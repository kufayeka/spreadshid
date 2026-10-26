import { useState } from 'react';
import { Icon } from './icons.js';
import { Menu } from './Menu.js';
import { ColorPicker } from './ColorPicker.js';
import { activeStyle, toggle, setPart, setFormat, stepDecimals, setBorders, merge, clearFormatting, functionText } from './toolbarActions.js';
import { currencySymbol, localeInfo, formatValue, FORMAT_PRESETS } from '../core/format.js';

export const FONTS = ['Arial', 'Calibri', 'Cambria', 'Courier New', 'Georgia', 'IBM Plex Sans', 'Roboto', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
export const SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 18, 24, 36];
export const ZOOMS = [0.5, 0.75, 0.9, 1, 1.25, 1.5, 2];
const LINES = { thin: { width: 1, style: 'solid' }, medium: { width: 2, style: 'solid' }, thick: { width: 3, style: 'solid' }, dashed: { width: 1, style: 'dashed' }, dotted: { width: 1, style: 'dotted' }, double: { width: 3, style: 'double' } };

/**
 * The toolbar, as in Google Sheets. Every button acts on the selection and is one change (one undo); the buttons keep the keyboard with the grid, so typing
 * goes on in the cell after a click. What a button shows (bold pressed, the font, the colours) is the active cell's.
 *
 * @param {object} props
 * @param {any} props.workbook @param {string} props.sheetId @param {any} props.sel @param {number} props.revision
 * @param {number} props.zoom @param {(z: number) => void} props.onZoom
 * @param {boolean} props.painting @param {() => void} props.onPaint  The paint format button.
 * @param {(text: string) => void} props.onStartEdit  A Σ function starts an edit of the active cell with this text.
 * @param {() => void} props.onLink  The insert link button.
 * @param {() => void} props.onDone  A select was used: the keyboard goes back to the grid.
 * @param {import('react').RefObject<HTMLElement>} props.container
 */
export function Toolbar({ workbook: wb, sheetId: s, sel, zoom, onZoom, painting, onPaint, onStartEdit, onLink, onDone, container }) {
    const [menu, setMenu] = useState(null); // { kind, x, y }
    const [borderLine, setBorderLine] = useState({ width: 1, style: 'solid', color: '#000000' });
    const style = activeStyle(wb, s, sel);
    const format = wb.cellFormat(s, sel.active.r, sel.active.c) || {};
    const settings = wb.settings();
    const symbol = currencySymbol(settings.currency || 'USD', localeInfo(settings.locale).locale);
    const keep = (e) => e.preventDefault(); // a click does not take the keyboard from the grid
    // what each format makes of an example, in the workbook's locale and currency
    const example = (name, v) => { const f = FORMAT_PRESETS[name]; return formatValue(v, f.type === 'money' ? { ...f, currency: settings.currency } : f, settings).text; };
    const someDay = 46321.5625; // 26 October 2026, 13:30

    const open = (kind) => (e) => { const b = e.currentTarget.getBoundingClientRect(); setMenu({ kind, x: b.left, y: b.bottom + 2 }); };
    const tool = (label, icon, onClick, pressed, extra) => (
        <button type="button" className={'ks-tool' + (pressed ? ' ks-pressed' : '')} aria-label={label} title={label} aria-pressed={pressed === undefined ? undefined : !!pressed}
            onMouseDown={keep} onClick={onClick} {...extra}>{icon}</button>
    );
    const dropTool = (label, icon, kind) => tool(label, <>{icon}<Icon name="drop" /></>, open(kind), undefined, { 'aria-haspopup': 'menu' });

    const MENUS = {
        formats: [
            { value: 'general', label: 'Automatic' }, { value: 'text', label: 'Plain text' }, { separator: true },
            { value: 'number', label: 'Number', hint: example('number', 1000.12) }, { value: 'percent', label: 'Percent', hint: example('percent', 0.1012) }, { value: 'scientific', label: 'Scientific', hint: example('scientific', 1012) },
            { separator: true },
            { value: 'money', label: 'Currency', hint: example('money', 1000.12) }, { value: 'moneyRounded', label: 'Currency rounded', hint: example('moneyRounded', 1000.12) },
            { separator: true },
            { value: 'date', label: 'Date', hint: example('date', someDay) }, { value: 'time', label: 'Time', hint: example('time', someDay) },
            { value: 'datetime', label: 'Date time', hint: example('datetime', someDay) }, { value: 'duration', label: 'Duration', hint: example('duration', 1.0007) }
        ],
        borders: [
            { value: 'all', label: 'All borders' }, { value: 'inner', label: 'Inner borders' }, { value: 'horizontal', label: 'Horizontal borders' },
            { value: 'vertical', label: 'Vertical borders' }, { value: 'outer', label: 'Outer borders' }, { separator: true },
            { value: 'left', label: 'Left border' }, { value: 'top', label: 'Top border' }, { value: 'right', label: 'Right border' }, { value: 'bottom', label: 'Bottom border' },
            { value: 'clear', label: 'Clear borders' }, { separator: true },
            ...Object.keys(LINES).map((k) => ({ value: 'line:' + k, label: (LINES[k].width === borderLine.width && LINES[k].style === borderLine.style ? '✓ ' : '') + 'Line: ' + k }))
        ],
        merge: [{ value: 'all', label: 'Merge all' }, { value: 'horizontal', label: 'Merge horizontally' }, { value: 'vertical', label: 'Merge vertically' }, { value: 'unmerge', label: 'Unmerge' }],
        align: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }],
        valign: [{ value: 'top', label: 'Top' }, { value: 'middle', label: 'Middle' }, { value: 'bottom', label: 'Bottom' }],
        wrap: [{ value: 'overflow', label: 'Overflow' }, { value: 'wrap', label: 'Wrap' }, { value: 'clip', label: 'Clip' }],
        rotate: [{ value: '0', label: 'None' }, { value: '45', label: 'Tilt up' }, { value: '-45', label: 'Tilt down' }, { value: 'vertical', label: 'Stack vertically' }, { value: '90', label: 'Rotate up' }, { value: '-90', label: 'Rotate down' }],
        sigma: ['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN'].map((f) => ({ value: f, label: f }))
    };

    function onMenu(value) {
        const kind = menu.kind;
        setMenu(null);
        if (kind === 'formats') setFormat(wb, s, sel, value);
        else if (kind === 'borders') {
            if (value.startsWith('line:')) setBorderLine({ ...borderLine, ...LINES[value.slice(5)] });
            else setBorders(wb, s, sel, value, borderLine);
        } else if (kind === 'merge') merge(wb, s, sel, value);
        else if (kind === 'align') setPart(wb, s, sel, 'align', value);
        else if (kind === 'valign') setPart(wb, s, sel, 'valign', value);
        else if (kind === 'wrap') setPart(wb, s, sel, 'wrap', value === 'overflow' ? null : value);
        else if (kind === 'rotate') setPart(wb, s, sel, 'rotate', value === '0' ? null : value === 'vertical' ? 'vertical' : Number(value));
        else if (kind === 'sigma') onStartEdit(functionText(wb, s, sel, value));
    }

    const alignIcon = style.align === 'center' ? 'alignCenter' : style.align === 'right' ? 'alignRight' : 'alignLeft';
    const valignIcon = style.valign === 'top' ? 'valignTop' : style.valign === 'middle' ? 'valignMiddle' : 'valignBottom';
    const wrapIcon = style.wrap === 'wrap' ? 'wrap' : style.wrap === 'clip' ? 'clip' : 'overflow';
    const sep = (k) => <span key={k} className="ks-tool-sep" aria-hidden="true" />;

    return (
        <div className="ks-toolbar" role="toolbar" aria-label="Formatting">
            {tool('Undo (Ctrl+Z)', <Icon name="undo" />, () => wb.undo(), undefined, { disabled: !wb.canUndo() })}
            {tool('Redo (Ctrl+Y)', <Icon name="redo" />, () => wb.redo(), undefined, { disabled: !wb.canRedo() })}
            {tool('Paint format', <Icon name="paint" />, onPaint, painting)}
            <select className="ks-tool-select ks-zoom" aria-label="Zoom" title="Zoom" value={zoom} onChange={(e) => { onZoom(Number(e.target.value)); onDone(); }}>
                {ZOOMS.map((z) => <option key={z} value={z}>{Math.round(z * 100)}%</option>)}
            </select>
            {sep('a')}
            {tool('Format as currency', <span className="ks-tool-text">{symbol}</span>, () => setFormat(wb, s, sel, 'money'), format.type === 'money')}
            {tool('Format as percent', <span className="ks-tool-text">%</span>, () => setFormat(wb, s, sel, 'percent'), format.type === 'percent')}
            {tool('Decrease decimal places', <span className="ks-tool-text">.0&#8592;</span>, () => stepDecimals(wb, s, sel, -1))}
            {tool('Increase decimal places', <span className="ks-tool-text">.00&#8594;</span>, () => stepDecimals(wb, s, sel, 1))}
            {dropTool('More formats', <span className="ks-tool-text">123</span>, 'formats')}
            {sep('b')}
            <select className="ks-tool-select ks-font" aria-label="Font" title="Font" value={style.font || 'Arial'} onChange={(e) => { setPart(wb, s, sel, 'font', e.target.value === 'Arial' ? null : e.target.value); onDone(); }}>
                {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
            </select>
            <select className="ks-tool-select ks-size" aria-label="Font size" title="Font size" value={style.fontSize || 10} onChange={(e) => { setPart(wb, s, sel, 'fontSize', Number(e.target.value) === 10 ? null : Number(e.target.value)); onDone(); }}>
                {SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            {sep('c')}
            {tool('Bold (Ctrl+B)', <Icon name="bold" />, () => toggle(wb, s, sel, 'bold'), style.bold)}
            {tool('Italic (Ctrl+I)', <Icon name="italic" />, () => toggle(wb, s, sel, 'italic'), style.italic)}
            {tool('Strikethrough (Alt+Shift+5)', <Icon name="strike" />, () => toggle(wb, s, sel, 'strike'), style.strike)}
            {tool('Underline (Ctrl+U)', <Icon name="underline" />, () => toggle(wb, s, sel, 'underline'), style.underline)}
            <ColorPicker label="Text color" icon={<Icon name="textColor" under={style.color || '#000000'} />} value={style.color || null} container={container}
                onPick={(c) => setPart(wb, s, sel, 'color', c)} />
            <ColorPicker label="Fill color" icon={<Icon name="fill" under={style.fill || '#ffffff'} />} value={style.fill || null} container={container}
                onPick={(c) => setPart(wb, s, sel, 'fill', c)} />
            {sep('d')}
            {dropTool('Borders', <Icon name="borders" />, 'borders')}
            <ColorPicker label="Border color" icon={<span className="ks-border-swatch" style={{ background: borderLine.color }} />} value={borderLine.color} container={container}
                onPick={(c) => setBorderLine({ ...borderLine, color: c || '#000000' })} />
            {dropTool('Merge cells', <Icon name="merge" />, 'merge')}
            {sep('e')}
            {dropTool('Horizontal align', <Icon name={alignIcon} />, 'align')}
            {dropTool('Vertical align', <Icon name={valignIcon} />, 'valign')}
            {dropTool('Text wrapping', <Icon name={wrapIcon} />, 'wrap')}
            {dropTool('Text rotation', <Icon name="rotate" />, 'rotate')}
            {sep('f')}
            {tool('Insert link (Ctrl+K)', <Icon name="link" />, onLink)}
            {dropTool('Functions', <Icon name="sigma" />, 'sigma')}
            {tool('Clear formatting (Ctrl+\\)', <span className="ks-tool-text">T&#8339;</span>, () => clearFormatting(wb, s, sel))}
            {menu ? <Menu at={{ x: menu.x, y: menu.y }} items={MENUS[menu.kind]} onSelect={onMenu} onClose={() => setMenu(null)} container={container} label={menu.kind} /> : null}
        </div>
    );
}
