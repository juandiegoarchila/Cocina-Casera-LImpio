import React from 'react';
import useLocalStorage from '../hooks/useLocalStorage';

const InputField = ({ id, label, value, onChange, placeholder, icon, type = 'text', autoComplete, ariaRequired = false, error = '' }) => (
  <div className="mb-4">
    <label htmlFor={id} className="block font-medium text-gray-800 mb-1">
      <span role="img" aria-label="icon">{icon}</span> {label}
    </label>
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full p-2 border rounded-md focus:outline-none focus:ring-2 ${error ? 'border-red-500 focus:ring-red-500' : 'focus:ring-green-500'}`}
      autoComplete={autoComplete}
      aria-required={ariaRequired}
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

const AddressInput = ({ onConfirm }) => {
  const [address, setAddress] = useLocalStorage('userAddress', '');
  const [phoneNumber, setPhoneNumber] = useLocalStorage('userPhoneNumber', '');
  const [addressType, setAddressType] = useLocalStorage('userAddressType', 'complex');
  const [recipientName, setRecipientName] = useLocalStorage('userRecipientName', '');
  const [unitDetails, setUnitDetails] = useLocalStorage('userUnitDetails', '');
  const [localName, setLocalName] = useLocalStorage('userLocalName', ''); // New state for local name
  const [isEditing, setIsEditing] = React.useState(false);

  const isValidPhone = (phone) => /^3\d{9}$/.test(phone);
  const phoneNumberError = phoneNumber && !isValidPhone(phoneNumber) ? 'Formato de teléfono no válido (Ej: 3001234567)' : '';

  const isFormValid =
    address &&
    isValidPhone(phoneNumber) &&
    (addressType !== 'school' || recipientName) &&
    (addressType !== 'complex' || unitDetails) &&
    (addressType !== 'shop' || localName); // Add validation for localName when addressType is 'shop'

  const handleConfirm = () => {
    if (isFormValid) {
      const confirmedDetails = {
        address,
        phoneNumber,
        addressType,
        recipientName: addressType === 'school' ? recipientName : '',
        unitDetails: addressType === 'complex' ? unitDetails : '',
        localName: addressType === 'shop' ? localName : '', // Include localName in confirmed details
      };
      onConfirm(confirmedDetails);
      setIsEditing(false);
    } else {
      alert('Por favor, completa todos los campos requeridos correctamente.');
    }
  };

  // If data is complete and user isn't editing, show saved data
  if (isFormValid && !isEditing) {
    return (
      <div className="bg-white p-4 rounded-lg shadow space-y-4 text-sm sm:text-base">
        <h4 className="text-sm font-semibold text-gray-800">Datos Guardados</h4>
        <p className="text-gray-600">
          📍 Dirección: {address}
        </p>
        <p className="text-gray-600">
          🏢 Tipo de lugar: {addressType === 'house' ? 'Casa/Apartamento Individual' : addressType === 'school' ? 'Colegio/Oficina' : addressType === 'complex' ? 'Conjunto Residencial' : 'Tienda/Local'}
        </p>
        {addressType === 'school' && recipientName && (
          <p className="text-gray-600">
            👤 Recibe: {recipientName}
          </p>
        )}
        {addressType === 'complex' && unitDetails && (
          <p className="text-gray-600">
            🏢 Detalles: {unitDetails}
          </p>
        )}
        {addressType === 'shop' && localName && (
          <p className="text-gray-600">
            🏬 Nombre del local: {localName}
          </p>
        )}
        <p className="text-gray-600">
          📞 Teléfono: {phoneNumber}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full">
          <button
            onClick={handleConfirm}
            className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-3 py-2 rounded-md transition-colors"
          >
            Usar datos guardados
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className="w-full sm:w-auto bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium px-3 py-2 rounded-md transition-colors"
          >
            Editar datos
          </button>
        </div>
      </div>
    );
  }

  // Show input form if data is incomplete or user is editing
  return (
    <div className="bg-white p-4 rounded-lg shadow space-y-4 text-sm sm:text-base">
      <div className="mb-4">
        <label htmlFor="address-type" className="block font-medium text-gray-800 mb-1">
          ¿Qué tipo de dirección es?
        </label>
        <select
          id="address-type"
          value={addressType}
          onChange={(e) => {
            setAddressType(e.target.value);
            setRecipientName('');
            setUnitDetails('');
            setLocalName(''); // Reset localName when address type changes
          }}
          className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="house">Casa/Apartamento Individual</option>
          <option value="school">Colegio/Oficina</option>
          <option value="complex">Conjunto Residencial</option>
          <option value="shop">Tienda/Local</option> {/* New option */}
        </select>
      </div>

      <InputField
        id="address-input"
        label="Dirección de entrega"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder={addressType === 'house' ? "Ej: CL 123 #45-67" : "Ej: Calle Principal #123 (Nombre del lugar)"}
        icon="📍"
        autoComplete="street-address"
        ariaRequired={true}
      />

      {addressType === 'school' && (
        <InputField
          id="recipient-name-input"
          label="Nombre completo de quien recibe"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="Ej: Juan Pérez (Estudiante/Profesor/Empleado)"
          icon="👤"
          ariaRequired={true}
        />
      )}

      {addressType === 'complex' && (
        <InputField
          id="unit-details-input"
          label="Torre, Apartamento, Bloque, etc."
          value={unitDetails}
          onChange={(e) => setUnitDetails(e.target.value)}
          placeholder="Ej: Torre 5, Apto 302 / Bloque C, Casa 15"
          icon="🏢"
          ariaRequired={true}
        />
      )}

      {addressType === 'shop' && (
        <InputField
          id="local-name-input"
          label="Nombre completo del local"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          placeholder="Ej: Tienda El Progreso"
          icon="🏬"
          ariaRequired={true}
        />
      )}

      <InputField
        id="phone-number-input"
        label="Número de teléfono"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        placeholder="Ej: 3001234567"
        icon="📞"
        type="tel"
        autoComplete="tel"
        ariaRequired={true}
        error={phoneNumberError}
      />

      <button
        onClick={handleConfirm}
        disabled={!isFormValid}
        className={`w-full mt-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-md transition-colors ${
          !isFormValid ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        Confirmar dirección y número
      </button>
    </div>
  );
};

export default AddressInput;