//component/AddressInput.js

import React from 'react';

const AddressInput = ({ address, setAddress }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-2">📍 ¿A dónde lo enviamos?</h2>
      <input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Escribe tu dirección"
        className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
        aria-label="Dirección de entrega para el almuerzo"
      />
    </div>
  );
};

export default AddressInput;