//src/components/ProductCard.js
import React from 'react';

const ProductCard = ({ product, onAddToOrder }) => {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="p-4">
        <div className="h-40 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
          <img 
            src={`/images/${product.image}`} 
            alt={product.name}
            className="h-24 object-contain"
          />
        </div>
        <h3 className="font-bold text-lg text-gray-800">{product.name}</h3>
        <p className="text-gray-600 mt-1">${product.price.toFixed(2)}</p>
        <button
          onClick={() => onAddToOrder(product)}
          className="mt-3 w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          Agregar
        </button>
      </div>
    </div>
  );
};

export default ProductCard;