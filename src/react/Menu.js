import { useEffect, useId } from 'react';
import * as menu from '@zag-js/menu';
import { useMachine, normalizeProps, Portal } from '@zag-js/react';

/**
 * @typedef {object} MenuItem
 * @property {string} [value]  What onSelect gets.
 * @property {string} [label]
 * @property {string} [hint]  A key that does the same (shown on the right, "Ctrl+C").
 * @property {boolean} [disabled]
 * @property {boolean} [checked]  A tick before the label (a setting that is on).
 * @property {boolean} [separator]  A line between groups (no value, no label).
 * @property {MenuItem[]} [children]  A submenu, opened from this item (by the mouse, or the right arrow).
 */

function itemsOf(items, api, service, onSelect, container) {
    return items.map((item, i) => {
        if (item.separator) return <li key={'sep' + i} {...api.getSeparatorProps()} className="ks-menu-sep" />;
        if (item.children) return <SubMenu key={'sub' + i} item={item} parentApi={api} parentService={service} onSelect={onSelect} container={container} />;
        return (
            <li key={item.value} {...api.getItemProps({ value: item.value, disabled: item.disabled })} className="ks-menu-item">
                <span><span className="ks-menu-check">{item.checked ? '✓' : ''}</span>{item.label}</span>
                {item.hint ? <span className="ks-menu-hint">{item.hint}</span> : null}
            </li>
        );
    });
}

// a submenu: its own zag machine, tied to its parent (zag closes and focuses them together)
function SubMenu({ item, parentApi, parentService, onSelect, container }) {
    const service = useMachine(menu.machine, { id: useId(), positioning: { placement: 'right-start', gutter: 2, strategy: 'fixed' }, onSelect: (d) => onSelect(d.value) });
    const api = menu.connect(service, normalizeProps);
    useEffect(() => {
        parentApi.setChild(service);
        api.setParent(parentService);
    }, []);
    return (
        <>
            <li {...parentApi.getTriggerItemProps(api)} className="ks-menu-item ks-menu-parent" aria-disabled={item.disabled || undefined}>
                <span><span className="ks-menu-check" />{item.label}</span>
                <span className="ks-menu-hint">&#9656;</span>
            </li>
            {api.open ? (
                <Portal container={container}>
                    <div {...api.getPositionerProps()} className="ks-menu-positioner">
                        <ul {...api.getContentProps()} className="ks-menu">{itemsOf(item.children, api, service, onSelect, container)}</ul>
                    </div>
                </Portal>
            ) : null}
        </>
    );
}

/**
 * A menu that opens at a point (a right click) or under a button, with the keyboard of a menu (arrows, Enter, Escape, typing a letter) and submenus,
 * made with zag.js. It is drawn inside the sheet (so it takes the sheet's colours) but placed against the window, so the sheet's edges do not cut it.
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
    // an item of a submenu chosen: the whole menu goes, as the root's own items do
    const choose = (value) => { onSelect(value); onClose(); };
    return (
        <Portal container={container}>
            <div {...api.getPositionerProps()} className="ks-menu-positioner">
                <ul {...api.getContentProps()} className="ks-menu">{itemsOf(items, api, service, choose, container)}</ul>
            </div>
        </Portal>
    );
}
