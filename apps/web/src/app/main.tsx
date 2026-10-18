import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/index.css';

const root = document.getElementById('root');
export const application = root ? createRoot(root) : null;
application?.render(<App />);
