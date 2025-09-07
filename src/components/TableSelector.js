//src/components/TableSelector.js
import React from 'react';

const TableSelector = ({ 
  selectedTable, 
  onTableSelect, 
  availableTables = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Mesa ${i + 1}` })),
  isButtonStyle = false
}) => {
  return (
    <div className="w-full">
      <h2 className="text-sm sm:text-base font-medium mb-2 text-gray-700">
        <span className="mr-1">🍽️</span> Selecciona una mesa
      </h2>
      <div className={`grid ${isButtonStyle ? 'grid-cols-3 sm:grid-cols-5 gap-1' : 'grid-cols-1 gap-2'}`}>
        {availableTables.map((table) => {
          const isActive = selectedTable?.id === table.id;
          return (
            <button
              key={table.id}
              type="button"
              onClick={() => onTableSelect(table)}
              className={`p-2 rounded text-xs sm:text-sm font-medium transition-all duration-200
                ${isButtonStyle
                  ? `flex items-center justify-center ${
                      isActive
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`
                  : `text-left px-3 py-2 ${
                      isActive
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`
                }`}
              aria-label={`Seleccionar ${table.name}`}
            >
              {table.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TableSelector;
