// src/index.js
import React from 'react';
// Desactivar logs innecesarios en producción para evitar fugas de información
// y uso indebido desde la consola del navegador. Solo permitimos logs en desarrollo.
if (process.env.NODE_ENV !== 'development') {
  try {
    console.log = () => {};
    console.debug = () => {};
    console.info = () => {};
  } catch (_) {}
}
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';
import App from './App';
import { AuthProvider } from './components/Auth/AuthProvider';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);