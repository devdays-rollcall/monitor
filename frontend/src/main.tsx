import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import App from './App';
import { GlobalStyle } from './styles';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalStyle />
    <App />
  </StrictMode>,
);
