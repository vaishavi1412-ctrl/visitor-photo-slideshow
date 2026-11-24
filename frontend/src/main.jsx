import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { VisitorProvider } from './VisitorContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <VisitorProvider>
        <App />
      </VisitorProvider>
    </BrowserRouter>
  </StrictMode>
);