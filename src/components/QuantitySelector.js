//src/components/QuantitySelector.js
import React from 'react';

const QuantitySelector = ({ quantity, setQuantity }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-2">🍽️ ¿Cuántos almuerzos quieres?</h2>
      <div className="flex items-center space-x-2">
        <button 
          onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
          className="bg-gray-200 px-2 py-1 rounded hover:bg-gray-300 transition-colors"
        >
          -
        </button>
        <span className="text-lg">{quantity}</span>
        <button 
          onClick={() => setQuantity(prev => prev + 1)}
          className="bg-gray-200 px-2 py-1 rounded hover:bg-gray-300 transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default QuantitySelector;