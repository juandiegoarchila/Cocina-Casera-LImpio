import React from 'react';

const PaymentSelector = ({ paymentMethods, selectedPayment, setSelectedPayment }) => {
  const getColorClass = (methodName) => {
    switch (methodName) {
      case 'Efectivo':
        return 'green';
      case 'DaviPlata':
        return 'red';
      case 'Nequi':
        return 'blue-300'; // Azul claro al seleccionar
      default:
        return 'gray';
    }
  };

  return (
    <div className="bg-gradient-to-r from-green-50 to-green-100 p-1 sm:p-2 rounded-lg shadow-sm">
      <h2 className="text-xs sm:text-sm font-semibold mb-1 sm:mb-2 flex items-center text-green-700">
        <span className="mr-1">💰</span> ¿Cómo vas a pagar?
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2">
        {paymentMethods.map(method => {
          const color = getColorClass(method.name);
          return (
            <button
              key={method.id}
              onClick={() => setSelectedPayment(method)}
              className={`payment-btn p-1 sm:p-2 rounded text-xs sm:text-sm font-medium transition-all duration-200 flex items-center justify-center text-center min-h-[30px] sm:min-h-[40px] shadow-sm ${
                selectedPayment?.id === method.id
                  ? `bg-${color}-200 text-${color}-800 border border-${color}-300`
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
              aria-label={`Seleccionar método de pago ${method.name}`}
            >
              {method.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PaymentSelector;