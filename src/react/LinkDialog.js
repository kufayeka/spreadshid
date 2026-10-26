import { useId, useRef, useState } from 'react';
import * as dialog from '@zag-js/dialog';
import { useMachine, normalizeProps, Portal } from '@zag-js/react';

/**
 * Insert link (Ctrl+K): the text the cell shows and the address it opens (Ctrl+click on the cell). An empty address takes the link away. Made with zag.js.
 *
 * @param {object} props
 * @param {string} props.text  What the cell holds now.
 * @param {string} props.link  Its link now ("" when none).
 * @param {(text: string, link: string) => void} props.onApply
 * @param {() => void} props.onClose
 * @param {import('react').RefObject<HTMLElement>} props.container
 */
export function LinkDialog({ text, link, onApply, onClose, container }) {
    // the address is what a person comes to type: the dialog opens with the keyboard there (zag would give it to the first field, the text)
    const linkField = useRef(null);
    const service = useMachine(dialog.machine, { id: useId(), open: true, initialFocusEl: () => linkField.current, onOpenChange: (d) => { if (!d.open) onClose(); } });
    const api = dialog.connect(service, normalizeProps);
    const [t, setT] = useState(text);
    const [l, setL] = useState(link);
    // an address without a scheme is a web address
    const normal = (x) => (x && !/^[a-z][a-z0-9+.-]*:/i.test(x) ? 'https://' + x : x);
    const apply = () => { onApply(t, normal(l.trim())); onClose(); };
    return (
        <Portal container={container}>
            <div {...api.getBackdropProps()} className="ks-backdrop" />
            <div {...api.getPositionerProps()} className="ks-dialog-positioner">
                <div {...api.getContentProps()} className="ks-dialog ks-dialog-small">
                    <h2 {...api.getTitleProps()} className="ks-dialog-title">Insert link</h2>
                    <div className="ks-form" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}>
                        <label className="ks-field"><span>Text</span><input value={t} onChange={(e) => setT(e.target.value)} /></label>
                        <label className="ks-field"><span>Link</span><input ref={linkField} value={l} onChange={(e) => setL(e.target.value)} placeholder="https://" /></label>
                    </div>
                    <div className="ks-dialog-actions">
                        <button type="button" className="ks-button" {...api.getCloseTriggerProps()}>Cancel</button>
                        <button type="button" className="ks-button ks-primary" onClick={apply}>Apply</button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
