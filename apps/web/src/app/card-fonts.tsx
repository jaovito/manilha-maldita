import { createRoot } from 'react-dom/client';
import { CardFonts } from '../pages/CardFonts';
import './styles/index.css';
import '../pages/CardFonts/styles.css';

const root = document.getElementById('card-font-root');
export const comparison = root ? createRoot(root) : null;
comparison?.render(<CardFonts />);
