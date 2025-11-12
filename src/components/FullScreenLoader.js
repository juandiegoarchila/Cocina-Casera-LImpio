//src/components/FullScreenLoader.js
import React from 'react';
import AnimatedLoader from './AnimatedLoader';
import './AnimatedLoader.css';

const FullScreenLoader = ({ message = "Cargando aplicación..." }) => {
  return (
    <div className="fullscreen-loader fade-in">
      <div className="text-center">
        <AnimatedLoader message={message} size="large" />
        <div className="mt-4 text-sm text-gray-500 max-w-xs mx-auto">
          Preparando la mejor experiencia culinaria para ti
        </div>
      </div>
    </div>
  );
};

export default FullScreenLoader;