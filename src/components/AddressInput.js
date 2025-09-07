// src/components/AddressInput.js
import React, { useState, useEffect } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';

// Lista de barrios disponibles
const BARRIOS = [
  "Gaitana",
  "Lisboa",
  "Berlín",
  "Tibabuyes",
];

const InputField = ({ id, label, value, onChange, placeholder, type = "text", error }) => (
  <div className="mb-3">
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full p-2 border rounded-md focus:outline-none focus:ring-2 ${error ? 'border-red-500 focus:ring-red-500' : 'focus:ring-green-500'}`}
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

const AddressInput = ({ onConfirm, initialAddress = {} }) => {
  // Estado consolidado del formulario
  const [formData, setFormData] = useLocalStorage("addressForm", {
    streetType: "Calle",
    streetNumber: "",
    houseNumber: "",
    neighborhood: "",
    details: "",
    phoneNumber: ""
  });
  const [errors, setErrors] = useState({});
  const [isConfirmed, setIsConfirmed] = useState(false);

  const isValidPhone = (phone) => /^3\d{9}$/.test(phone);

  // Lógica de validación
  useEffect(() => {
    const newErrors = {};
    if (!formData.streetNumber) newErrors.streetNumber = "Campo requerido.";
    if (!formData.houseNumber) newErrors.houseNumber = "Campo requerido.";
    if (!formData.neighborhood) newErrors.neighborhood = "Selecciona un barrio.";
    if (!formData.phoneNumber) {
      newErrors.phoneNumber = "Campo requerido.";
    } else if (!isValidPhone(formData.phoneNumber)) {
      newErrors.phoneNumber = "Formato no válido (Ej: 3001234567).";
    }
    setErrors(newErrors);
  }, [formData]);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const isFormValid = Object.keys(errors).length === 0;

  const handleConfirm = () => {
    // Si hay errores, no se hace nada
    if (!isFormValid) {
      return;
    }
    setIsConfirmed(true);

    const addressFormatted = `${formData.streetType} ${formData.streetNumber} # ${formData.houseNumber}`;
    const confirmedDetails = {
      address: addressFormatted,
      neighborhood: formData.neighborhood,
      details: formData.details,
      phoneNumber: formData.phoneNumber,
    };

    onConfirm?.(confirmedDetails);
  };

  if (isConfirmed) {
    return (
      <div className="bg-white p-4 rounded-lg shadow space-y-3 text-sm sm:text-base">
        <h4 className="font-semibold text-gray-800">📋 Dirección guardada</h4>
        <p>
          <span className="font-medium text-blue-600">Dirección</span><br />
          {formData.streetType} {formData.streetNumber} # {formData.houseNumber}
        </p>
        <p>
          <span className="font-medium text-blue-600">Barrio</span><br />
          {formData.neighborhood}
        </p>
        {formData.details && (
          <p>
            <span className="font-medium text-blue-600">Instrucciones de entrega</span><br />
            {formData.details}
          </p>
        )}
        <p>
          <span className="font-medium text-blue-600">Teléfono</span><br />
          {formData.phoneNumber}
        </p>
        <button
          onClick={() => setIsConfirmed(false)}
          className="mt-3 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md"
        >
          Editar dirección
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow space-y-4 text-sm sm:text-base">
      {/* Tipo de vía */}
      <div>
        <label htmlFor="streetType" className="block font-medium text-gray-700 mb-1">
          Tipo de vía
        </label>
        <select
          id="streetType"
          value={formData.streetType}
          onChange={handleInputChange}
          className="w-full p-2 border rounded-md focus:ring-2 focus:ring-green-500"
        >
          <option value="Calle">Calle</option>
          <option value="Carrera">Carrera</option>
          <option value="Diagonal">Diagonal</option>
          <option value="Transversal">Transversal</option>
        </select>
      </div>

      {/* Números */}
      <div className="grid grid-cols-2 gap-4">
        <InputField
          id="streetNumber"
          label="Tipo de vía"
          value={formData.streetNumber}
          onChange={handleInputChange}
          placeholder="Ej: 137"
          error={errors.streetNumber}
        />
        <InputField
          id="houseNumber"
          label="Número"
          value={formData.houseNumber}
          onChange={handleInputChange}
          placeholder="Ej: 128b-01"
          error={errors.houseNumber}
        />
      </div>

      {/* Barrio */}
      <div>
        <label htmlFor="neighborhood" className="block font-medium text-gray-700 mb-1">
          Barrio
        </label>
        <select
          id="neighborhood"
          value={formData.neighborhood}
          onChange={handleInputChange}
          className={`w-full p-2 border rounded-md focus:ring-2 ${errors.neighborhood ? 'border-red-500 focus:ring-red-500' : 'focus:ring-green-500'}`}
        >
          <option value="">Selecciona un barrio</option>
          {BARRIOS.map((barrio, i) => (
            <option key={i} value={barrio}>
              {barrio}
            </option>
          ))}
        </select>
        {errors.neighborhood && <p className="text-red-500 text-xs mt-1">{errors.neighborhood}</p>}
      </div>

      {/* Instrucciones de entrega */}
      <InputField
        id="details"
        label="Instrucciones de entrega (opcional)"
        value={formData.details}
        onChange={handleInputChange}
        placeholder="Ej: Apto 302, pregunte por Juan, soy el profesor Pérez de la oficina 305."
      />

      {/* Teléfono */}
      <InputField
        id="phoneNumber"
        label="Número de teléfono"
        value={formData.phoneNumber}
        onChange={handleInputChange}
        placeholder="Ej: 3001234567"
        error={errors.phoneNumber}
      />

      <button
        onClick={handleConfirm}
        disabled={!isFormValid}
        className={`w-full mt-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-md transition-colors ${
          !isFormValid ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        Confirmar dirección
      </button>
    </div>
  );
};

export default AddressInput;