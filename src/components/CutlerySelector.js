//src/components/CutlerySelector.js
import React from 'react';

const CutlerySelector = ({ cutlery, setCutlery }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-2">🍴 ¿Necesitas cubiertos?</h2>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setCutlery('Sí')}
          className={`p-2 rounded ${cutlery === 'Sí' ? 'bg-green-200' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}
          style={{ minHeight: '44px', minWidth: '44px' }}
          aria-label="Seleccionar que sí necesito cubiertos"
        >
          Sí
        </button>
        <button
          onClick={() => setCutlery('No')}
          className={`p-2 rounded ${cutlery === 'No' ? 'bg-red-200' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}
          style={{ minHeight: '44px', minWidth: '44px' }}
          aria-label="Seleccionar que no necesito cubiertos"
        >
          No
        </button>
      </div>
    </div>
  );
};

export default CutlerySelector;