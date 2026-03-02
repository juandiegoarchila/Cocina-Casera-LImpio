// src/components/Footer.js
import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-green-500 text-white p-4 text-center mt-auto shadow-inner">
      <div className="container mx-auto">
        <p className="text-xs xs:text-sm sm:text-base">
          © 2025 Cocina Casera. Todos los derechos reservados.
        </p>
        <p className="text-[10px] xs:text-xs sm:text-sm mt-1">
          Diseñado con <span role="img" aria-label="corazón">❤️</span> por Cocina Casera
        </p>
        <p className="text-base font-bold mt-1">
          Contáctame: <a href="https://wa.me/573142749518" className="underline hover:text-white">314 274 9518</a>
        </p>
        <p className="text-sm text-yellow-200 font-semibold mt-2 animate-pulse">
          🚀 ¡Construye el software a tu medida y lleva tu negocio al siguiente nivel!
        </p>
      </div>
    </footer>
  );
};

export default Footer;
