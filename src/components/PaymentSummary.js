// src/components/PaymentSummary.js
import React from 'react';

const PaymentSummary = ({ 
  paymentSummary, 
  total, 
  isWaiterView,
  titleClass = 'text-gray-800',
  contentClass = 'text-gray-600'
}) => {
  const allCashOrUnspecified = Object.keys(paymentSummary).every(method => method === 'Efectivo' || method === 'No especificado');

  return (
    <div className="pt-2 border-t">
      <p className={`text-sm sm:text-base font-bold text-right ${titleClass}`}>
        Total: <span className={titleClass || "text-green-600"}>${total.toLocaleString('es-CO')}</span>
      </p>
      {!isWaiterView && (
        <>
          {allCashOrUnspecified ? (
            <>
              <p className={`font-medium ${titleClass} text-xs sm:text-sm`}>Paga en efectivo al momento de la entrega.</p>
              <p className={`text-xs sm:text-sm ${contentClass}`}>💵 Efectivo: ${total.toLocaleString('es-CO')}</p>
              <p className={`text-xs sm:text-sm ${contentClass}`}>
                Si no tienes efectivo, puedes transferir por Nequi o DaviPlata al número: 313 850 5647.
              </p>
            </>
          ) : (
            <>
              <p className={`font-medium ${titleClass} text-xs sm:text-sm`}>💳 Instrucciones de pago:</p>
              <p className={`text-xs sm:text-sm ${contentClass}`}>Envía al número 313 850 5647 (Nequi o DaviPlata):</p>
              {Object.entries(paymentSummary).map(([method, amount]) => (
                method !== 'No especificado' && amount > 0 && (
                  <p key={method} className={`text-xs sm:text-sm ${contentClass}`}>
                    🔹 {method}: ${amount.toLocaleString('es-CO')}
                  </p>
                )
              ))}
            </>
          )}
          <p className={`font-medium ${titleClass} text-xs sm:text-sm`}>💰 Total: ${total.toLocaleString('es-CO')}</p>
        </>
      )}
    </div>
  );
};

export default PaymentSummary;
