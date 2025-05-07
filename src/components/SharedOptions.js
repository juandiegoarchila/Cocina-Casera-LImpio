//src/components/SharedOptions.js
import React from 'react';

const SidesSelector = ({ sides, selectedSides, setSelectedSides, notes, setNotes }) => {
  const toggleSide = (side) => {
    if (side.name === 'Ninguno') {
      setSelectedSides([]);
    } else {
      setSelectedSides(prev => 
        prev.some(s => s.id === side.id) 
          ? prev.filter(s => s.id !== side.id) 
          : [...prev, side]
      );
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-2">🥗 Acompañamientos</h2>
      <div className="grid grid-cols-2 gap-2">
        {sides.map(side => (
          <button
            key={side.id}
            onClick={() => toggleSide(side)}
            className={`side-btn p-2 rounded ${
              selectedSides.some(s => s.id === side.id) ? 'bg-green-200' : 'bg-gray-100 hover:bg-gray-200'
            } transition-colors`}
            aria-label={`Seleccionar acompañamiento ${side.name}`}
          >
            {side.name}
            {side.isNew && (
              <span className="bg-pink-100 text-red-600 rounded-full px-2 py-1 text-xs font-medium ml-1">
                NUEVO
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => toggleSide({ id: 0, name: 'Ninguno' })}
          className={`side-btn p-2 rounded col-span-2 ${
            selectedSides.length === 0 ? 'bg-green-200' : 'bg-gray-100 hover:bg-gray-200'
          } transition-colors`}
          aria-label="Seleccionar ningún acompañamiento"
        >
          Ninguno
        </button>
      </div>
      <div className="mt-2">
        <input
          type="text"
          value={notes || ''}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas adicionales (ej. sin cebolla)"
          className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
          aria-label="Notas adicionales para el almuerzo"
        />
      </div>
    </div>
  );
};

export default SidesSelector;