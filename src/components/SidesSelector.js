import React, { useState } from 'react';

const SidesSelector = ({ sides, selectedSides, setSelectedSides, notes, setNotes }) => {
  const [customSide, setCustomSide] = useState('');

  const handleSideToggle = (side) => {
    if (selectedSides.some(s => s.id === side.id)) {
      setSelectedSides(selectedSides.filter(s => s.id !== side.id));
    } else {
      setSelectedSides([...selectedSides, side]);
    }
  };

  const addCustomSide = () => {
    if (customSide.trim()) {
      const newSide = { id: `custom-${customSide}`, name: customSide };
      setSelectedSides([...selectedSides, newSide]);
      setCustomSide('');
    }
  };

  return (
    <div className="bg-gradient-to-r from-green-50 to-green-100 p-1 xs:p-2 sm:p-3 rounded-lg shadow-sm">
      <h2 className="text-[10px] xs:text-xs sm:text-sm font-semibold mb-1 xs:mb-2 flex items-center text-green-700">
        <span className="mr-1">🥗</span> Acompañamientos
      </h2>
      <div className="flex flex-col space-y-1 xs:space-y-2">
        {sides.map(side => (
          <label key={side.id} className="flex items-center space-x-1 xs:space-x-2 text-[10px] xs:text-xs sm:text-sm">
            <input
              type="checkbox"
              checked={selectedSides.some(s => s.id === side.id)}
              onChange={() => handleSideToggle(side)}
              className="h-3 xs:h-4 w-3 xs:w-4 text-green-600 border-gray-300 rounded focus:ring-green-400"
            />
            <span>{side.name}</span>
          </label>
        ))}
        <div className="flex flex-col space-y-1 xs:space-y-2 mt-1 xs:mt-2">
          <input
            type="text"
            value={customSide}
            onChange={(e) => setCustomSide(e.target.value)}
            placeholder="Otro acompañamiento"
            className="p-1 xs:p-2 text-[10px] xs:text-xs sm:text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 placeholder-gray-400"
            aria-label="Ingresar un acompañamiento personalizado"
          />
          <button
            onClick={addCustomSide}
            className="bg-green-500 hover:bg-green-600 text-white px-2 xs:px-3 py-0.5 xs:py-1 rounded-lg text-[10px] xs:text-xs sm:text-sm transition-colors"
            aria-label="Agregar acompañamiento personalizado"
          >
            Agregar
          </button>
        </div>
        <div className="mt-1 xs:mt-2">
          <h3 className="text-[10px] xs:text-xs sm:text-sm font-semibold mb-0.5 xs:mb-1 text-green-700">Notas adicionales</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ejemplo: Sin cebolla, por favor"
            className="w-full p-1 xs:p-2 text-[10px] xs:text-xs sm:text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 placeholder-gray-400"
            rows="2"
            aria-label="Notas adicionales para el pedido"
          />
        </div>
      </div>
    </div>
  );
};

export default SidesSelector;