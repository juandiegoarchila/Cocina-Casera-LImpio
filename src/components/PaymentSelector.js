import React from 'react';
// Importa los logos SVG como componentes React
import { ReactComponent as NequiLogo } from '../assets/nequi-logo.svg';
import { ReactComponent as DaviplataLogo } from '../assets/daviplata-logo.svg';
// Importa la imagen PNG para Efectivo
// IMPORTANTE: REEMPLAZA './assets/efectivo.png' con la RUTA REAL a tu archivo PNG de efectivo.
// Por ejemplo: si tu archivo se llama 'dinero.png' y está en 'src/assets/', la ruta sería '../assets/dinero.png';
import EfectivoPNG from '../assets/efectivo.png';


const PaymentSelector = ({ paymentMethods, selectedPayment, setSelectedPayment }) => {
  const getColorClass = (methodName) => {
    switch (methodName) {
      case 'Efectivo':
        return 'bg-green-200 text-green-800 border-green-300';
      case 'Daviplata':
        return 'bg-red-200 text-red-800 border-red-300';
      case 'Nequi':
        return 'bg-blue-200 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-200 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="bg-gradient-to-r from-green-50 to-green-100 p-1 sm:p-2 rounded-lg shadow-sm">
      <h2 className="text-xs sm:text-sm font-semibold mb-1 sm:mb-2 flex items-center text-green-700">
        <span className="mr-1">💰</span> ¿Cómo vas a pagar?
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2">
        {paymentMethods.map(method => (
          <button
            key={method.id}
            onClick={() => setSelectedPayment(method)}
            className={`payment-btn p-1 sm:p-2 rounded text-xs sm:text-sm font-medium transition-all duration-200 flex flex-col items-center justify-center text-center min-h-[30px] sm:min-h-[40px] shadow-sm gap-y-1 ${
              selectedPayment?.id === method.id
                ? getColorClass(method.name)
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
            aria-label={`Seleccionar ${method.name}`}
          >
            {method.name}

            {method.name === 'Efectivo' && (
              // Usando una imagen PNG para Efectivo
              // Asegúrate de que el archivo PNG esté en la ruta especificada en el import.
              <img src={EfectivoPNG} alt="Efectivo" className="h-20 w-20" />
            )}
            {method.name === 'Daviplata' && (
              <DaviplataLogo className="h-20 w-20" />
            )}
            {method.name === 'Nequi' && (
              <NequiLogo className="h-20 w-20" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PaymentSelector;
