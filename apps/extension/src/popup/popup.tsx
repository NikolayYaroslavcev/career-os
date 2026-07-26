import { createRoot } from 'react-dom/client';
import { PopupApp } from './components/popup-app';

const root = createRoot(document.getElementById('popup-root')!);
root.render(<PopupApp />);
