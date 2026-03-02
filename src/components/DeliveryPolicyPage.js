import React, { useState } from 'react';
import Header from './Header';
import Footer from './Footer';

/**
 * Página pública que muestra las condiciones de entrega completas.
 * Accesible desde /politicas sin necesidad de autenticación.
 */
const DeliveryPolicyPage = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-gray-200 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto max-w-3xl px-4 py-6">
        <div className="bg-white rounded-xl shadow-md p-6 md:p-8 space-y-5">
          <h2 className="text-xl md:text-2xl font-bold text-green-700 flex items-center gap-2">
            🤝 Acuerdo de Entrega
          </h2>

          <p className="text-sm md:text-base text-gray-700">
            Queremos que recibas tu comida caliente, bien preparada y lo más rápido posible. Para eso, te pedimos tener en cuenta lo siguiente:
          </p>

          <div className="space-y-4 text-sm md:text-base text-gray-700 leading-relaxed">
            {/* Siempre visibles: los 3 puntos más importantes */}
            <div className="flex items-start gap-3 bg-green-50 rounded-lg p-3 md:p-4">
              <span className="text-xl md:text-2xl mt-0.5">⏱️</span>
              <p>
                <strong>Tiempo estimado:</strong> La entrega toma entre <strong>25 a 30 minutos</strong>, contados desde que el domiciliario confirma que salió hacia tu dirección.
              </p>
            </div>

            <div className="flex items-start gap-3 bg-yellow-50 rounded-lg p-3 md:p-4">
              <span className="text-xl md:text-2xl mt-0.5">🧾</span>
              <p>
                <strong>Pago por transferencia:</strong> Si pagas con transferencia, tu pedido se empieza a preparar <strong>solo cuando envíes el comprobante de pago</strong>. Entre más rápido lo envíes, más pronto sale tu pedido.
              </p>
            </div>

            <div className="flex items-start gap-3 bg-blue-50 rounded-lg p-3 md:p-4">
              <span className="text-xl md:text-2xl mt-0.5">🏢</span>
              <p>
                <strong>Conjuntos y edificios:</strong> Los pedidos se entregan en <strong>portería o entrada principal</strong>.
              </p>
            </div>

            {/* Contenido expandible */}
            <div className={`space-y-4 overflow-hidden transition-all duration-300 ${expanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="flex items-start gap-3 p-3 md:p-4">
                <span className="text-xl md:text-2xl mt-0.5">⏱️</span>
                <p className="text-xs md:text-sm text-gray-500">
                  El tiempo puede variar según: preparación del almuerzo (se cocina al momento), número de pedidos en cola, atención simultánea en el restaurante, y tráfico o condiciones externas.
                </p>
              </div>

              <div className="flex items-start gap-3 p-3 md:p-4">
                <span className="text-xl md:text-2xl mt-0.5">👩‍🍳</span>
                <p>
                  <strong>Preparación al momento:</strong> Cada almuerzo se prepara fresco. Si haces tu pedido con anticipación (<strong>30 min a 1 hora antes</strong>), es mucho más probable que llegue justo cuando lo necesitas.
                </p>
              </div>

              <div className="flex items-start gap-3 p-3 md:p-4">
                <span className="text-xl md:text-2xl mt-0.5">📲</span>
                <p>
                  <strong>Confirmación de salida:</strong> El tiempo empieza a contar cuando el domiciliario te envía el mensaje indicando que ya salió hacia tu dirección.
                </p>
              </div>

              <div className="flex items-start gap-3 p-3 md:p-4">
                <span className="text-xl md:text-2xl mt-0.5">⚖️</span>
                <p>
                  <strong>Compromiso con todos:</strong> Trabajamos para ser justos y cumplirle a todos los clientes por igual. No podemos garantizar una hora exacta, pero hacemos todo lo posible para cumplir en el menor tiempo.
                </p>
              </div>

              <div className="flex items-start gap-3 p-3 md:p-4">
                <span className="text-xl md:text-2xl mt-0.5">🌧️</span>
                <p>
                  Retrasos por causas externas (lluvia fuerte, el cliente no recibe a tiempo el pedido, hacen esperar al domiciliario) están fuera de nuestro control.
                </p>
              </div>

              <p className="text-xs md:text-sm text-gray-500 italic px-3 md:px-4">
                Si tienes una urgencia específica, indícalo en las notas y haremos lo posible por ayudarte. 🙏
              </p>
            </div>

            {/* Botón Ver más / Ver menos */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full text-center text-sm md:text-base font-semibold text-green-600 hover:text-green-700 py-2 flex items-center justify-center gap-1 transition-colors border-t border-gray-100 mt-2"
            >
              {expanded ? (
                <>Ver menos <span className="text-xs">▲</span></>
              ) : (
                <>Ver más detalles <span className="text-xs">▼</span></>
              )}
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DeliveryPolicyPage;
