import React from 'react';

const TimeSelector = ({ times, selectedTime, setSelectedTime, onNext }) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onNext(); // Avanzar al siguiente paso
    }
  };

  return (
    <div className="bg-gradient-to-r from-green-50 to-green-100 p-1 xs:p-2 sm:p-3 rounded-lg shadow-sm">
      <h2 className="text-[10px] xs:text-xs sm:text-sm font-semibold mb-1 xs:mb-2 flex items-center text-green-700">
        <span className="mr-1">🕒</span> ¿Para qué hora?
      </h2>
      <div className="grid grid-cols-2 xs:grid-cols-2 gap-1 xs:gap-2">
        {times.map(time => (
          <button
            key={time.id}
            onClick={() => setSelectedTime(time)}
            className={`relative p-1 xs:p-2 rounded-lg text-[10px] xs:text-xs sm:text-sm font-medium transition-all duration-200 flex items-center justify-center text-center min-h-[30px] xs:min-h-[40px] shadow-sm ${
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
          onKeyDown={handleKeyDown}
          className="col-span-2 mt-2 p-1 xs:p-2 text-[10px] xs:text-xs sm:text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 placeholder-gray-400 w-full"
          aria-label="Ingresar una hora personalizada"
        />
      </div>
    </div>
  );
};

export default TimeSelector;