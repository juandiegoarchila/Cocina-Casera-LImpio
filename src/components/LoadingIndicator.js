//src/components/LoadingIndicator.js
import React from 'react';
import AnimatedLoader from './AnimatedLoader';

const LoadingIndicator = ({ message = "Cargando...", size = "small" }) => (
  <div className="flex justify-center p-2">
    <AnimatedLoader message={message} size={size} />
  </div>
);

export default LoadingIndicator;