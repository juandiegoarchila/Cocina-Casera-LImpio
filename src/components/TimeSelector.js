//src/components/TimeSelector.js
import React from 'react';

const TimeSelector = ({ times, selectedTime, setSelectedTime }) => {
  return (
    <div className="bg-gradient-to-r from-green-50 to-green-100 p-2 rounded-lg shadow-sm">
      <h2 className="text-sm font-semibold text-green-700 mb-2 flex items-center">
        <span className="mr-1">🕒</span> ¿Para qué hora?
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {times.map(time => (
          <button
            key={time.id}
            onClick={() => setSelectedTime(time)}
            className={`relative p-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center text-center min-h-[40px] shadow-sm ${
              selectedTime?.id === time.id
                ? 'bg-green-200 text-green-800 border border-green-300'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
            aria-label={`Seleccionar hora ${time.name}`}
          >
            {time.name}
          </button>
        ))}
        <input
          type="text"
          placeholder="Otra hora"
          value={selectedTime?.id === 0 ? selectedTime.name : ''}
          onChange={(e) => setSelectedTime({ id: 0, name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setSelectedTime({ id: 0, name: e.target.value });
            }
          }}
          className="col-span-1 sm:col-span-2 p-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 placeholder-gray-400"
          aria-label="Ingresar una hora personalizada"
        />
      </div>
    </div>
  );
};

export default TimeSelector;