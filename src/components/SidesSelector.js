//src/components/SidesSelector.js
import React from 'react';

const SidesSelector = ({ sides, selectedSides, setSelectedSides, notes, setNotes }) => {
  const toggleSide = (side) => {
    const safeSelectedSides = Array.isArray(selectedSides) ? selectedSides : [];
    
    if (side.name === 'Ninguno') {
      setSelectedSides([]);
    } else {
      setSelectedSides(
        safeSelectedSides.some(s => s.id === side.id)
          ? safeSelectedSides.filter(s => s.id !== side.id)
          : [...safeSelectedSides, side]
      );
    }
  };

  return (
    <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 rounded-lg shadow-sm">
      <h2 className="text-sm font-semibold text-green-700 mb-2 flex items-center">
        <span className="mr-1">🥗</span> Acompañamientos
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {sides.map(side => (
          <button
            key={side.id}
            onClick={() => toggleSide(side)}
            className={`relative p-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center text-center min-h-[40px] shadow-sm ${
              Array.isArray(selectedSides) && selectedSides.some(s => s.id === side.id)
                ? 'bg-green-200 text-green-800 border border-green-300'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
            aria-label={`Seleccionar acompañamiento ${side.name}`}
          >
            <span className="truncate">{side.name}</span>
            {side.isNew && (
              <span className="absolute top-0 right-7 transform translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] font-semibold rounded-full px-2 py-0.5">
                NUEVO
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => toggleSide({ id: 0, name: 'Ninguno' })}
          className={`relative p-2 rounded-lg text-sm font-medium col-span-2 transition-all duration-200 flex items-center justify-center text-center min-h-[40px] shadow-sm ${
            !Array.isArray(selectedSides) || selectedSides.length === 0
              ? 'bg-green-200 text-green-800 border border-green-300'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
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
          placeholder="Notas (ej. sin cebolla)"
          className="w-full p-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 placeholder-gray-400"
          aria-label="Notas adicionales para el almuerzo"
        />
      </div>
    </div>
  );
};

export default SidesSelector;