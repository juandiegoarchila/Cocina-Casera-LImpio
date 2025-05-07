//src/components/PaymentSelector.js
import React from 'react';

const PaymentSelector = ({ paymentMethods, selectedPayment, setSelectedPayment }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-2">💰 ¿Cómo vas a pagar?</h2>
      <div className="grid grid-cols-2 gap-2">
        {paymentMethods.map(method => (
          <button
            key={method.id}
            onClick={() => setSelectedPayment(method)}
            className={`payment-btn p-2 rounded ${
              selectedPayment?.id === method.id 
                ? `bg-${method.color}-200` 
                : 'bg-gray-100 hover:bg-gray-200'
            } transition-colors`}
            aria-label={`Seleccionar método de pago ${method.name}`}
          >
            {method.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PaymentSelector;