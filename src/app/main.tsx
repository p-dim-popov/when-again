import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HomeScreen } from '../modules/home';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HomeScreen />
  </StrictMode>,
);
