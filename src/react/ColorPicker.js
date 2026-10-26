import { useId } from 'react';
import * as popover from '@zag-js/popover';
import { useMachine, normalizeProps, Portal } from '@zag-js/react';

// The palette of Google Sheets: a row of greys, a row of bright colours, then six rows from light to dark.
export const PALETTE = [
    ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff'],
    ['#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff'],
    ['#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc'],
    ['#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd'],
    ['#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0'],
    ['#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79'],
    ['#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47'],
    ['#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130']
];

/**
 * A toolbar button that opens the palette (made with zag.js: Escape closes it, the focus comes back to the button). A swatch sets the colour, "Reset"
 * takes it away, and a colour of one's own can be typed (#rrggbb).
 *
 * @param {object} props
 * @param {string} props.label  What the button does ("Text color").
 * @param {import('react').ReactNode} props.icon
 * @param {string|null} props.value  The colour now (of the active cell).
 * @param {(color: string|null) => void} props.onPick
 * @param {import('react').RefObject<HTMLElement>} props.container
 */
export function ColorPicker({ label, icon, value, onPick, container }) {
    const service = useMachine(popover.machine, { id: useId(), positioning: { placement: 'bottom-start', gutter: 4, strategy: 'fixed' } });
    const api = popover.connect(service, normalizeProps);
    const pick = (color) => { onPick(color); api.setOpen(false); };
    return (
        <>
            <button type="button" {...api.getTriggerProps()} className="ks-tool" aria-label={label} title={label} onMouseDown={(e) => e.preventDefault()}>
                {icon}
            </button>
            {api.open ? (
                <Portal container={container}>
                    <div {...api.getPositionerProps()} className="ks-pop-positioner">
                        <div {...api.getContentProps()} className="ks-palette" aria-label={label}>
                            <button type="button" className="ks-palette-reset" onClick={() => pick(null)}>Reset</button>
                            {PALETTE.map((row, i) => (
                                <div key={i} className={'ks-palette-row' + (i === 2 ? ' ks-gap' : '')}>
                                    {row.map((color) => (
                                        <button key={color} type="button" className={'ks-swatch' + (value && value.toLowerCase() === color ? ' ks-picked' : '')} style={{ background: color }}
                                            aria-label={color} title={color} onClick={() => pick(color)} />
                                    ))}
                                </div>
                            ))}
                            <label className="ks-palette-custom">Custom
                                <input type="text" placeholder="#1a73e8" defaultValue={value || ''} aria-label="Custom colour"
                                    onKeyDown={(e) => { if (e.key === 'Enter' && /^#[0-9a-f]{6}$/i.test(e.currentTarget.value.trim())) pick(e.currentTarget.value.trim().toLowerCase()); }} />
                            </label>
                        </div>
                    </div>
                </Portal>
            ) : null}
        </>
    );
}
