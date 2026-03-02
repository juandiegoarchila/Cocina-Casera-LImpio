import React from 'react';
import Header from './Header';
import Footer from './Footer';

/**
 * Página pública que muestra las condiciones de entrega completas.
 * Accesible desde /politicas sin necesidad de autenticación.
 */
const DeliveryPolicyPage = () => {
  return (
    <div className="min-h-screen bg-gray-200 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto max-w-lg px-4 py-6">
        <div className="bg-white rounded-xl shadow-md p-5 space-y-4">
          <h2 className="text-lg font-bold text-green-700 flex items-center gap-2">
            🤝 Acuerdo de Entrega
          </h2>

          <p className="text-sm text-gray-700">
            Queremos que recibas tu comida caliente, bien preparada y lo más rápido posible. Para eso, te pedimos tener en cuenta lo siguiente:
          </p>

          <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">⏱️</span>
              <div>
                <p>
                  <strong>Tiempo estimado:</strong> La entrega toma entre <strong>25 a 30 minutos</strong>, contados desde que el domiciliario confirma que salió hacia tu dirección.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">🧾</span>
              <p>
                <strong>Pago por transferencia:</strong> Si pagas con transferencia, tu pedido se empieza a preparar <strong>solo cuando envíes el comprobante de pago</strong>. Entre más rápido lo envíes, más pronto sale tu pedido.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">🏢</span>
              <p>
                <strong>Conjuntos y edificios:</strong> Los pedidos se entregan en <strong>portería o entrada principal</strong>.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">⏱️</span>
              <p className="text-xs text-gray-500">
                El tiempo puede variar según: preparación del almuerzo (se cocina al momento), número de pedidos en cola, atención simultánea en el restaurante, y tráfico o condiciones externas.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">👩‍🍳</span>
              <p>
                <strong>Preparación al momento:</strong> Cada almuerzo se prepara fresco. Si haces tu pedido con anticipación (<strong>30 min a 1 hora antes</strong>), es mucho más probable que llegue justo cuando lo necesitas.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">📲</span>
              <p>
                <strong>Confirmación de salida:</strong> El tiempo empieza a contar cuando el domiciliario te envía el mensaje indicando que ya salió hacia tu dirección.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">⚖️</span>
              <p>
                <strong>Compromiso con todos:</strong> Trabajamos para ser justos y cumplirle a todos los clientes por igual. No podemos garantizar una hora exacta, pero hacemos todo lo posible para cumplir en el menor tiempo.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">🌧️</span>
              <p>
                Retrasos por causas externas (lluvia fuerte, el cliente no recibe a tiempo el pedido, hacen esperar al domiciliario) están fuera de nuestro control.
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-500 italic">
            Si tienes una urgencia específica, indícalo en las notas y haremos lo posible por ayudarte. 🙏
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DeliveryPolicyPage;
