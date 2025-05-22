// src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client'; // Importar createRoot

// IMPORTANTE: SOLO DEJA LA LÍNEA DE TU ARCHIVO CSS REAL, QUE ES 'styles.css'
// import './index.css'; // <--- ELIMINA ESTA LÍNEA (o coméntala)
import './styles.css'; // <--- ESTA ES LA CORRECTA

import App from './App';
import { AuthProvider } from './components/Auth/AuthProvider'; // ¡NO OLVIDES RE-AGREGAR AuthProvider!

// Obtener el elemento raíz
const container = document.getElementById('root');
// Crear una raíz de React 18
const root = createRoot(container);

// Renderizar la aplicación con la nueva API
root.render(
  <React.StrictMode>
    {/* ¡ENVUELVE App CON AuthProvider AQUÍ! */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

// Si estás usando reportWebVitals, actívalo
// reportWebVitals();