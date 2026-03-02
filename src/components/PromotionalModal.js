import React from 'react';

const PromotionalModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[10005] flex items-center justify-center bg-black bg-opacity-75 p-4 cursor-pointer"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden relative flex flex-col max-h-[90vh] cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón de cierre - Ajustado */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-600 hover:text-red-600 z-50 bg-white hover:bg-gray-50 rounded-full p-1 border border-gray-200 shadow-sm transition-colors"
          aria-label="Cerrar modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Contenido del Modal */}
        <div className="p-4 overflow-y-auto">
          {/* Aviso de contexto */}
          <div className="text-center mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
             <p className="text-sm font-bold text-gray-800 mb-1 leading-snug">
               ¿Quieres pedir almuerzo y no te interesa esto?
               <br/>
               <span className="text-red-600 font-extrabold text-base">¡Dale a la X!</span>
             </p>
             <p className="text-xs text-gray-500 mt-1">
               Esto es información solamente sobre automatización de negocios.
             </p>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-4 text-green-700 drop-shadow-sm tracking-tight">¡Automatiza tu negocio hoy!</h2>
          {/* Video Promocional */}
          <div className="relative w-full h-[320px] sm:h-[400px] bg-black rounded-lg mb-4 overflow-hidden shadow-lg mx-auto flex items-center justify-center">
            <video
              src="/video-automatiza.mp4"
              title="Automatiza Tu Negocio - Cocina Casera"
              className="w-full h-full object-contain"
              controls
              playsInline
              poster="/111111111111.png"
            >
              Tu navegador no soporta la reproducción de videos.
            </video>
          </div>
          <div className="space-y-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
            <p>
              <span className="font-bold text-green-700">¿Por qué automatizar tu negocio?</span>
              <br />
              Con el aumento constante de salarios, costos y gastos, automatizar ya no es solo una opción tecnológica: es una decisión financiera inteligente.
            </p>
            <p>
              Muchos piensan que tener un sistema propio es costoso, pero la realidad es que es mucho más rentable que seguir trabajando de forma manual. La automatización reduce errores, ahorra tiempo y te permite enfocarte en lo que realmente importa: hacer crecer tu negocio.
            </p>
            <p>
              Tú pones la necesidad, nosotros construimos la solución. No importa la idea o el reto que tengas, juntos lo hacemos realidad.
            </p>
            <p>
              ¿Quieres un sistema a tu medida, accesible y sin complicaciones? Escríbeme y transforma tu negocio hoy.
            </p>
            <p>
              Prefieres leer con calma antes de escribir? Visita
              {' '}
              <a
                href="https://altenot.web.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-700 font-semibold underline"
              >
                altenot.web.app
              </a>
              {' '}para conocer mi enfoque completo y los proyectos que he entregado.
            </p>
          </div>
          <div className="mt-6 text-center flex flex-col items-center">
            <a 
              href="https://wa.me/573142749518" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block bg-green-600 text-white font-bold py-3 px-8 rounded-full hover:bg-green-700 transition-colors mb-3 shadow-lg transform hover:scale-105"
            >
              Comienza ahora
            </a>
            
            <button
              onClick={onClose}
              className="mb-4 text-gray-400 hover:text-gray-600 underline text-sm py-1 px-3"
            >
              Cerrar esta ventana
            </button>

            <p className="text-xs text-gray-500 mt-2">
              ¿Tienes una idea o problema? Pregunta con confianza, ¡te ayudamos a hacerlo realidad!
            </p>
            <p className="text-xs text-green-700 mt-1">
              También puedes dejarme un mensaje directo desde
              {' '}
              <a
                href="https://altenot.web.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline"
              >
                altenot.web.app
              </a>
              , donde encontrarás más formas de contacto.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionalModal;
