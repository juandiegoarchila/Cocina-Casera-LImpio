// src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client'; // Importar createRoot

import './styles.css'; 

import App from './App';
import { AuthProvider } from './components/Auth/AuthProvider'; 

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
