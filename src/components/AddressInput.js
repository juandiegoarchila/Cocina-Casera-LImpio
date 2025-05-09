import React, { useState, useEffect } from 'react';

const AddressInput = ({ address, setAddress, previousAddress, onAdvance }) => {
  const [usePrevious, setUsePrevious] = useState(!!previousAddress && !address);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newAddress, setNewAddress] = useState(address || previousAddress || '');

  useEffect(() => {
    if (newAddress && !address) {
      setAddress(newAddress);
    }
  }, [newAddress, address, setAddress]);

  useEffect(() => {
    if (address && address !== previousAddress) {
      setShowConfirm(true);
    } else {
      setShowConfirm(false);
    }
  }, [address, previousAddress]);

  const handleConfirmChange = (change) => {
    if (change) {
      setShowConfirm(false);
    } else {
      setShowConfirm(false);
      onAdvance && onAdvance();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && showConfirm) {
      e.preventDefault();
      handleConfirmChange(true);
    }
  };

  return (
    <div className="bg-gradient-to-r from-green-50 to-green-100 p-1 xs:p-2 sm:p-3 rounded-lg shadow-sm">
      <h2 className="text-[10px] xs:text-xs sm:text-sm font-semibold mb-1 xs:mb-2 flex items-center text-green-700">
        <span className="mr-1">📍</span> ¿A dónde lo enviamos?
      </h2>
      {previousAddress && !address && (
        <div className="mb-1 xs:mb-2 text-[10px] xs:text-xs sm:text-sm text-gray-600">
          ¿Quieres usar la misma dirección ({previousAddress})?
          <div className="flex space-x-1 xs:space-x-2 mt-1">
            <button
              onClick={() => {
                setAddress(previousAddress);
                setNewAddress(previousAddress);
                onAdvance && onAdvance();
              }}
              className="px-1 xs:px-2 py-0.5 xs:py-1 rounded text-[10px] xs:text-xs sm:text-sm bg-green-500 text-white"
            >
              Sí
            </button>
            <button
              onClick={() => {
                setUsePrevious(false);
                setNewAddress('');
              }}
              className="px-1 xs:px-2 py-0.5 xs:py-1 rounded text-[10px] xs:text-xs sm:text-sm bg-red-500 text-white"
            >
              No
            </button>
          </div>
        </div>
      )}
      {!usePrevious && (
        <input
          id="address-input"
          type="text"
          value={newAddress}
          onChange={(e) => setNewAddress(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Escribe tu dirección"
          className="w-full p-1 xs:p-2 text-[10px] xs:text-xs sm:text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 placeholder-gray-400"
          aria-label="Dirección de entrega para el almuerzo"
        />
      )}
      {showConfirm && (
        <div className="mt-1 xs:mt-2 p-1 xs:p-2 bg-yellow-100 text-[10px] xs:text-xs sm:text-sm rounded-lg">
          <p>Dirección guardada: {address}</p>
          <p>¿Quieres cambiar la dirección?</p>
          <div className="flex space-x-1 xs:space-x-2 mt-1">
            <button
              onClick={() => handleConfirmChange(true)}
              className="px-1 xs:px-2 py-0.5 xs:py-1 rounded text-[10px] xs:text-xs sm:text-sm bg-green-500 text-white"
            >
              Sí
            </button>
            <button
              onClick={() => handleConfirmChange(false)}
              className="px-1 xs:px-2 py-0.5 xs:py-1 rounded text-[10px] xs:text-xs sm:text-sm bg-red-500 text-white"
            >
              No
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressInput;