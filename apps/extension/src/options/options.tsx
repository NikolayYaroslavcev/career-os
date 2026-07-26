import { createRoot } from 'react-dom/client';
import { OptionsApp } from './components/options-app';

const root = createRoot(document.getElementById('options-root')!);
root.render(<OptionsApp />);
