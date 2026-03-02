import React, { useState, useEffect } from 'react';

/**
 * Componente que muestra un acuerdo de entrega amigable.
 * El cliente debe aceptar las condiciones antes de continuar con el pedido.
 */
const DeliveryAgreement = ({ accepted, onAccept }) => {
  const [checked, setChecked] = useState(!!accepted);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setChecked(!!accepted);
  }, [accepted]);

  const handleToggle = () => {
    const newValue = !checked;
    setChecked(newValue);
    if (onAccept) onAccept(newValue);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-green-700 flex items-center gap-1">
        🤝 Acuerdo de Entrega
      </h4>

      <div className="bg-white rounded-lg border border-green-200 p-3 space-y-2 text-xs text-gray-700 leading-relaxed">
        <p className="font-medium text-gray-800">
          Queremos que recibas tu comida caliente, bien preparada y lo más rápido posible. Para eso, te pedimos tener en cuenta lo siguiente:
        </p>

        <div className="space-y-2">
          {/* Siempre visibles: los 2 puntos más importantes */}
          <div className="flex items-start gap-2">
            <span className="text-base mt-0.5">⏱️</span>
            <div>
              <p>
                <strong>Tiempo estimado:</strong> La entrega toma entre <strong>25 a 30 minutos</strong>, contados desde que el domiciliario confirma que salió hacia tu dirección.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-base mt-0.5">🧾</span>
            <p>
              <strong>Pago por transferencia:</strong> Si pagas con transferencia, tu pedido se empieza a preparar <strong>solo cuando envíes el comprobante de pago</strong>. Entre más rápido lo envíes, más pronto sale tu pedido.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-base mt-0.5">🏢</span>
            <p>
              <strong>Conjuntos y edificios:</strong> Los pedidos se entregan en <strong>portería o entrada principal</strong>.
            </p>
          </div>

          {/* Contenido expandible */}
          <div className={`space-y-2 overflow-hidden transition-all duration-300 ${expanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="flex items-start gap-2">
              <span className="text-base mt-0.5">⏱️</span>
              <p className="text-[10px] text-gray-500">
                El tiempo puede variar según: preparación del almuerzo (se cocina al momento), número de pedidos en cola, atención simultánea en el restaurante, y tráfico o condiciones externas.
              </p>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-base mt-0.5">👩‍🍳</span>
              <p>
                <strong>Preparación al momento:</strong> Cada almuerzo se prepara fresco. Si haces tu pedido con anticipación (<strong>30 min a 1 hora antes</strong>), es mucho más probable que llegue justo cuando lo necesitas.
              </p>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-base mt-0.5">📲</span>
              <p>
                <strong>Confirmación de salida:</strong> El tiempo empieza a contar cuando el domiciliario te envía el mensaje indicando que ya salió hacia tu dirección.
              </p>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-base mt-0.5">⚖️</span>
              <p>
                <strong>Compromiso con todos:</strong> Trabajamos para ser justos y cumplirle a todos los clientes por igual. No podemos garantizar una hora exacta, pero hacemos todo lo posible para cumplir en el menor tiempo.
              </p>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-base mt-0.5">🌧️</span>
              <p>
                Retrasos por causas externas (lluvia fuerte, el cliente no recibe a tiempo el pedido, hacen esperar al domiciliario) están fuera de nuestro control.
              </p>
            </div>

            <p className="text-[10px] text-gray-500 italic mt-1">
              Si tienes una urgencia específica, indícalo en las notas y haremos lo posible por ayudarte. 🙏
            </p>
          </div>

          {/* Botón Ver más / Ver menos */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-center text-[11px] font-semibold text-green-600 hover:text-green-700 py-1 flex items-center justify-center gap-1 transition-colors"
          >
            {expanded ? (
              <>Ver menos <span className="text-xs">▲</span></>
            ) : (
              <>Ver más detalles <span className="text-xs">▼</span></>
            )}
          </button>
        </div>
      </div>

      <button
        onClick={handleToggle}
        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
          checked
            ? 'bg-green-600 text-white shadow-md hover:bg-green-700'
            : 'bg-gray-100 text-gray-700 border-2 border-dashed border-green-400 hover:bg-green-50'
        }`}
      >
        {checked ? (
          <>
            <span className="text-lg">✅</span>
            ¡Acepto! Entiendo las condiciones de entrega
          </>
        ) : (
          <>
            <span className="text-lg">👆</span>
            Acepto las condiciones de entrega
          </>
        )}
      </button>

      {!checked && (
        <p className="text-[10px] text-red-600 bg-red-50 p-1.5 rounded text-center">
          Por favor, acepta las condiciones de entrega para continuar con tu pedido
        </p>
      )}
    </div>
  );
};

export default DeliveryAgreement;
