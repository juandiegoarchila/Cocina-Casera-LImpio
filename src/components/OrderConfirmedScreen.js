// src/components/OrderConfirmedScreen.js
import React, { useState } from 'react';
import { encodeMessage } from '../utils/Helpers';
import { isMobile } from '../utils/Helpers';

const PHONE = '573016476916';

const openWhatsAppWithMessage = (plainTextMessage) => {
  const encoded = encodeMessage(plainTextMessage);
  if (isMobile && isMobile()) {
    const nativeUrl = `whatsapp://send?phone=${PHONE}&text=${encoded}`;
    const webUrl = `https://wa.me/${PHONE}?text=${encoded}`;
    const startTime = Date.now();
    window.location = nativeUrl;
    setTimeout(() => {
      if (Date.now() - startTime < 2000) window.open(webUrl, '_blank');
    }, 2000);
  } else {
    window.open(`https://web.whatsapp.com/send?phone=${PHONE}&text=${encoded}`, '_blank');
  }
};

const OrderConfirmedScreen = ({ message, onNewOrder }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback para navegadores sin clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = message;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch (err) {
        console.error('No se pudo copiar:', err);
      }
      document.body.removeChild(textarea);
    }
  };

  const handleRetryWhatsApp = () => {
    openWhatsAppWithMessage(message);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Encabezado verde */}
        <div className="bg-green-500 px-6 py-7 text-center">
          <div className="flex items-center justify-center mb-3">
            <span className="text-5xl">🎉</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white leading-tight">
            ¡Pedido Generado!
          </h1>
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-6 space-y-5">
          <p className="text-gray-700 text-sm text-center leading-relaxed">
            Se ha abierto WhatsApp para enviar tu pedido. Si por alguna razón{' '}
            <span className="font-semibold text-gray-900">no se abrió</span> o{' '}
            <span className="font-semibold text-gray-900">cerraste la ventana por error</span>,
            puedes volver a intentarlo o copiar el mensaje y enviarlo manualmente.
          </p>

          {/* Botón Reintentar WhatsApp */}
          <button
            onClick={handleRetryWhatsApp}
            className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M2.004 22l1.352-4.968A9.954 9.954 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10a9.954 9.954 0 01-5.03-1.355L2.004 22zM8.391 7.308a.961.961 0 00-.371.1 1.293 1.293 0 00-.294.228c-.12.113-.188.211-.261.306A2.729 2.729 0 007 9.5c.002.47.13.94.33 1.388.451.998 1.351 2.03 2.456 2.783.267.188.534.374.808.557-.726 1.077-1.722 1.947-2.829 2.497a7.963 7.963 0 01-1.025.376 3.98 3.98 0 01-1.165.201c-.31 0-.621-.03-.92-.105-.44-.109-.832-.274-1.247-.498a3.54 3.54 0 01-.51-.423 2.034 2.034 0 01-.393-.611c-.113-.3-.17-.62-.17-.94 0-.306.058-.614.17-.906.11-.291.228-.512.38-.702.139-.177.291-.334.463-.47.173-.134.357-.254.553-.353z"/>
            </svg>
            Reintentar WhatsApp
          </button>

          {/* Botón Copiar Mensaje */}
          <button
            onClick={handleCopy}
            className={`w-full flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-xl transition-colors shadow-md border-2 ${
              copied
                ? 'bg-blue-50 border-blue-400 text-blue-700'
                : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-50 active:bg-gray-100'
            }`}
          >
            {copied ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-500">
                  <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                </svg>
                ¡Copiado!
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M7.5 3.375c0-1.036.84-1.875 1.875-1.875h.375a3.75 3.75 0 013.75 3.75v1.875C13.5 8.161 14.34 9 15.375 9h1.875A3.75 3.75 0 0121 12.75v3.375C21 17.16 20.16 18 19.125 18h-9.75A1.875 1.875 0 017.5 16.125V3.375z" />
                  <path d="M15 5.25a5.23 5.23 0 00-1.279-3.434 9.768 9.768 0 016.963 6.963A5.23 5.23 0 0017.25 7.5h-1.875A.375.375 0 0115 7.125V5.25zM4.875 6H6v10.125A3.375 3.375 0 009.375 19.5H16.5v1.125c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V7.875C3 6.839 3.84 6 4.875 6z" />
                </svg>
                Copiar Mensaje
              </>
            )}
          </button>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500 text-center mb-4">
              ¿Quieres hacer otro pedido o corregir algo?
            </p>
            <button
              onClick={onNewOrder}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 9a.75.75 0 00-1.5 0v2.25H9a.75.75 0 000 1.5h2.25V15a.75.75 0 001.5 0v-2.25H15a.75.75 0 000-1.5h-2.25V9z" clipRule="evenodd" />
              </svg>
              Hacer nuevo pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmedScreen;
