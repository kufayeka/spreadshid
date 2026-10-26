import { useId, useState } from 'react';
import * as dialog from '@zag-js/dialog';
import { useMachine, normalizeProps, Portal } from '@zag-js/react';
import { formatValue } from '../core/format.js';

export const LOCALES = [
    ['id-ID', 'Indonesia'], ['en-US', 'United States'], ['en-GB', 'United Kingdom'], ['en-AU', 'Australia'], ['en-SG', 'Singapore'], ['ms-MY', 'Malaysia'],
    ['de-DE', 'Germany'], ['fr-FR', 'France'], ['nl-NL', 'Netherlands'], ['es-ES', 'Spain'], ['ja-JP', 'Japan'], ['zh-CN', 'China'], ['ar-SA', 'Saudi Arabia']
];
export const CURRENCIES = ['IDR', 'USD', 'EUR', 'GBP', 'SGD', 'MYR', 'AUD', 'JPY', 'CNY', 'SAR'];

/**
 * Spreadsheet settings (File menu): the locale (how numbers, dates and money are written and read) and the currency of money formats, with an example of
 * what they give. Made with zag.js.
 */
export function SettingsDialog({ settings, onApply, onClose, container }) {
    const service = useMachine(dialog.machine, { id: useId(), open: true, onOpenChange: (d) => { if (!d.open) onClose(); } });
    const api = dialog.connect(service, normalizeProps);
    const [locale, setLocale] = useState(settings.locale || 'en-US');
    const [currency, setCurrency] = useState(settings.currency || 'USD');
    const example = [
        formatValue(1234567.89, { type: 'number', decimals: 2 }, { locale }).text,
        formatValue(1234567.89, { type: 'money', decimals: 2 }, { locale, currency }).text,
        formatValue(46321.5625, { type: 'datetime' }, { locale }).text
    ].join('   ');
    return (
        <Portal container={container}>
            <div {...api.getBackdropProps()} className="ks-backdrop" />
            <div {...api.getPositionerProps()} className="ks-dialog-positioner">
                <div {...api.getContentProps()} className="ks-dialog">
                    <h2 {...api.getTitleProps()} className="ks-dialog-title">Settings for this spreadsheet</h2>
                    <div className="ks-form">
                        <label className="ks-field"><span>Locale</span>
                            <select value={locale} onChange={(e) => setLocale(e.target.value)}>{LOCALES.map(([v, l]) => <option key={v} value={v}>{l} ({v})</option>)}</select>
                        </label>
                        <label className="ks-field"><span>Currency</span>
                            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                        </label>
                        <p className="ks-dialog-status">{example}</p>
                    </div>
                    <div className="ks-dialog-actions">
                        <button type="button" className="ks-button" {...api.getCloseTriggerProps()}>Cancel</button>
                        <button type="button" className="ks-button ks-primary" onClick={() => { onApply({ locale, currency }); onClose(); }}>Save settings</button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
