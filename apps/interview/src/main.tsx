import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { isRevealed } from './app/reveal';
import './index.css';

const root = createRoot(document.getElementById('root')!);

if (isRevealed()) {
  // Imported dynamically so a visitor without the flag never downloads the app itself — only this shell.
  void import('./app/app').then(({ App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
} else {
  root.render(<p className="not-found">Not found.</p>);
}
