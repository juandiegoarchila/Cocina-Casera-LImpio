//src/components/AnimatedLoader.js
import React from 'react';
import './AnimatedLoader.css';

const AnimatedLoader = ({ message = "Cargando...", size = "large" }) => {
  const sizeClasses = {
    small: "w-12 h-12",
    medium: "w-16 h-16", 
    large: "w-20 h-20"
  };

  const textSizeClasses = {
    small: "text-sm",
    medium: "text-base",
    large: "text-lg"
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      {/* Logo animado */}
      <div className={`${sizeClasses[size]} mb-4 animate-bounce-custom`}>
        <img 
          src="/logo.png" 
          alt="Cocina Casera Logo" 
          className="w-full h-full object-contain filter drop-shadow-lg"
        />
      </div>
      
      {/* Texto con animación de puntos */}
      <div className={`${textSizeClasses[size]} font-medium text-gray-700 flex items-center space-x-1`}>
        <span>{message}</span>
        <div className="flex space-x-1">
          <div className="w-1 h-1 bg-gray-500 rounded-full animate-pulse-dot delay-0"></div>
          <div className="w-1 h-1 bg-gray-500 rounded-full animate-pulse-dot delay-150"></div>
          <div className="w-1 h-1 bg-gray-500 rounded-full animate-pulse-dot delay-300"></div>
        </div>
      </div>
      
      {/* Barra de progreso opcional */}
      <div className="w-32 h-1 bg-gray-200 rounded-full mt-4 overflow-hidden">
        <div className="w-full h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full animate-progress-bar"></div>
      </div>
    </div>
  );
};

export default AnimatedLoader;