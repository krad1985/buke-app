import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initAppCheck } from './lib/firebase';
import './styles.css';

void initAppCheck().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
