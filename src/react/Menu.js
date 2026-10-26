import { useId } from 'react';
import * as menu from '@zag-js/menu';
import { useMachine, normalizeProps, Portal } from '@zag-js/react';

/**
 * @typedef {object} MenuItem
 * @property {string} [value]  What onSelect gets.
 * @property {string} [label]
 * @property {string} [hint]  A key that does the same (shown on the right, "Ctrl+C").
 * @property {boolean} [disabled]
 * @property {boolean} [separator]  A line between groups (no value, no label).
 */

/**
 * A menu that opens at a point (a right click) or under a button, with the keyboard of a menu (arrows, Enter, Escape, typing a letter), made with zag.js.
 * It is drawn inside the sheet (so it takes the sheet's colours) but placed against the window, so the sheet's edges do not cut it.
 *
 * @param {object} props
 * @param {{ x: number, y: number }|null} props.at  Where it opens (window pixels); null: closed.
 * @param {MenuItem[]} props.items
 * @param {(value: string) => void} props.onSelect
 * @param {() => void} props.onClose
 * @param {import('react').RefObject<HTMLElement>} props.container  The sheet's root.
 * @param {string} [props.label]  What the menu is, for screen readers.
 */
export function Menu({ at, items, onSelect, onClose, container, label }) {
    const service = useMachine(menu.machine, {
        id: useId(),
        open: !!at,
        anchorPoint: at,
        'aria-label': label,
        // the menu is opened by the sheet, not by a trigger of its own: its place is given as a box of no size at the point it opens at
        positioning: { placement: 'bottom-start', gutter: 2, strategy: 'fixed', getAnchorRect: () => (at ? { x: at.x, y: at.y, width: 0, height: 0 } : null) },
        onSelect: (details) => onSelect(details.value),
        onOpenChange: (details) => { if (!details.open) onClose(); }
    });
    const api = menu.connect(service, normalizeProps);
    if (!at) return null;
    return (
        <Portal container={container}>
            <div {...api.getPositionerProps()} className="ks-menu-positioner">
                <ul {...api.getContentProps()} className="ks-menu">
                    {items.map((item, i) => (item.separator
                        ? <li key={'sep' + i} {...api.getSeparatorProps()} className="ks-menu-sep" />
                        : (
                            <li key={item.value} {...api.getItemProps({ value: item.value, disabled: item.disabled })} className="ks-menu-item">
                                <span>{item.label}</span>
                                {item.hint ? <span className="ks-menu-hint">{item.hint}</span> : null}
                            </li>
                        )))}
                </ul>
            </div>
        </Portal>
    );
}
