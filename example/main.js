// The example page: a sheet that fills the window. The tests in Chrome open this page.
import { createRoot } from 'react-dom/client';
import { Sheet } from '../src/index.js';

createRoot(document.getElementById('root')).render(<Sheet style={{ height: '100%' }} />);
