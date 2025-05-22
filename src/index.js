import React from 'react';
import ReactDOM from 'react-dom';
import "./styles.css";

import App from './App';
import { AuthProvider } from './components/Auth/AuthProvider'; // Adjust the import path as needed

ReactDOM.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
  document.getElementById('root')
);