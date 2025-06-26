import React, { useState } from 'react';

const TimeSelector = ({ times, selectedTime, setSelectedTime, onConfirm }) => {
  const [error, setError] = useState(''); // Estado para mostrar errores
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  // Validación de formato de hora completo (e.g., "1:00 PM", "12:30 AM")
  const isValidTimeFormat = (value) => {
    const timeRegex = /^([1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)?$/;
    return timeRegex.test(value);
  };

  const handleCustomTimeChange = (e) => {
    const value = e.target.value;
    // Permitimos cualquier entrada parcial o vacía, solo validamos al confirmar
    setSelectedTime({ id: 0, name: value });
    setError(''); // Limpiamos el error al escribir
  };

  const handleConfirm = () => {
    if (!selectedTime || (selectedTime.id === 0 && !isValidTimeFormat(selectedTime.name))) {
      setError('Por favor, ingresa una hora válida (e.g., 1:00 PM)');
    } else {
      onConfirm();
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
            onClick={() => {
              setSelectedTime(time);
              setError('');
            }}
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
          placeholder="Otra hora (e.g., 1:00 PM)"
          value={selectedTime?.id === 0 ? selectedTime.name : ''}
          onChange={handleCustomTimeChange}
          onKeyDown={handleKeyDown}
          className="col-span-2 mt-2 p-1 xs:p-2 text-[10px] xs:text-xs sm:text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 placeholder-gray-400 w-full"
          aria-label="Ingresar una hora personalizada"
        />
        {error && (
          <p className="text-[10px] xs:text-xs text-red-600 mt-1">{error}</p>
        )}
      </div>
      <button
        onClick={handleConfirm}
        disabled={!selectedTime}
        className={`mt-2 bg-green-500 hover:bg-green-600 text-white px-2 xs:px-3 py-0.5 xs:py-1 rounded-lg text-[10px] xs:text-xs sm:text-sm transition-colors ${
          !selectedTime ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        aria-label="Confirmar hora"
      >
        Confirmar hora
      </button>
    </div>
  );
};

export default TimeSelector;