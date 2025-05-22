// src/components/Footer.js
import React from 'react';

const Footer = () => {
  return (
    // Fondo verde (bg-green-500) que coincide con el color de tu encabezado
    // Texto blanco (text-white) para contraste
    // Padding estándar (p-4), texto centrado, y margen superior para empujar el footer hacia abajo
    <footer className="bg-green-500 text-white p-4 text-center mt-auto shadow-inner">
      <div className="container mx-auto">
        {/* Párrafo con el copyright y el año actual */}
        <p className="text-sm">© {new Date().getFullYear()} Cocina Casera. Todos los derechos reservados.</p>
        {/* Párrafo que indica el diseño con el icono del corazón */}
        <p className="text-xs mt-1">Diseñado con <span role="img" aria-label="corazón">❤️</span> por Cocina Casera</p>
      </div>
    </footer>
  );
};

export default Footer;