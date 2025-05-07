//src/components/Footer.js
import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-gray-200 p-4 text-center text-gray-600">
      <p>Gracias por elegir Cocina Casera 💛</p>
      <a 
        href="https://wa.me/573023931292?text=Hola" 
        className="text-green-500 hover:text-green-600 transition-colors"
      >
        ¿Problemas? Escribe 'Hola' en WhatsApp para ayuda.
      </a>
    </footer>
  );
};

export default Footer;