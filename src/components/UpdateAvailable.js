import React, { useState, useEffect, useRef } from 'react';

const REMIND_KEY = 'update_remind_until';
const ACK_KEY = 'update_ack_version';

const UpdateAvailable = () => {
  const currentVersion = (
    (typeof window !== 'undefined' && (window.APP_VERSION || window.__APP_VERSION__)) ||
    (typeof process !== 'undefined' && process.env && process.env.REACT_APP_VERSION) ||
    null
  );

  const computeInitialVisible = () => {
    try {
      const ack = localStorage.getItem(ACK_KEY);
      if (ack) {
        if (currentVersion) {
          if (ack === currentVersion) return false;
        } else {
          return false;
        }
      }
      const until = parseInt(localStorage.getItem(REMIND_KEY) || '0', 10);
      if (until && Date.now() < until) return false;
    } catch (_) {}
    return true;
  };

  const [visible, setVisible] = useState(() => computeInitialVisible());

  useEffect(() => {
    const handler = () => {
      try {
        if (ignoreShowRef.current) return;
        setVisible(true);
      } catch (_) {}
    };
    window.addEventListener('show-update-available', handler);
    return () => window.removeEventListener('show-update-available', handler);
  }, []);

  // Escuchar eventos forzados desde el admin (force-update)
  const currentForcedNonceRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      try {
        const nonce = e?.detail?.nonce;
        if (nonce) {
          const lastSeen = localStorage.getItem('last_forced_nonce');
          if (String(lastSeen) === String(nonce)) return; // ya lo vio
          currentForcedNonceRef.current = nonce;
        }
        // mostrar modal aun si había ack
        ignoreShowRef.current = false;
        setVisible(true);
      } catch (_) {}
    };
    window.addEventListener('force-update', handler);
    return () => window.removeEventListener('force-update', handler);
  }, []);

  const reopenTimeoutRef = useRef(null);
  const ignoreShowRef = useRef(false);


  const handleUpdate = () => {
    try {
      // Guardar ack: si existe versión, guardarla para que no vuelva a aparecer hasta nueva versión
      if (currentVersion) {
        localStorage.setItem(ACK_KEY, String(currentVersion));
      } else {
        // Sin versión explícita, guardar un ack genérico para evitar reaparecer constantemente
        localStorage.setItem(ACK_KEY, String(Date.now()));
      }
    } catch (_) {}

    // Evitar que el modal se reabra antes de recargar
    try { if (reopenTimeoutRef.current) { clearTimeout(reopenTimeoutRef.current); reopenTimeoutRef.current = null; } } catch (_) {}
    try { ignoreShowRef.current = true; } catch (_) {}
    try { setVisible(false); } catch (_) {}

    try {
      if (currentForcedNonceRef.current) {
        try { localStorage.setItem('last_forced_nonce', String(currentForcedNonceRef.current)); } catch (_) {}
        currentForcedNonceRef.current = null;
      }
    } catch (_) {}

    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch (_) {}

    try { window.location.reload(); } catch (_) { /* noop */ }
  };

  // Si el modal fue abierto por un 'force-update' y el usuario acepta, guardamos que vio ese nonce
  useEffect(() => {
    if (!currentForcedNonceRef.current) return;
    // cuando el componente se monta, no hacemos nada; el guardado se hace en handleUpdate
    return () => {};
  }, []);


  const handleRemindLater = () => {
    // No guardamos un remind persistente: cerramos ahora y reabrimos automáticamente
    // cada 30 segundos hasta que el usuario acepte actualizar.
    setVisible(false);
    try {
      if (reopenTimeoutRef.current) clearTimeout(reopenTimeoutRef.current);
      reopenTimeoutRef.current = setTimeout(() => {
        try { setVisible(true); } catch (_) {}
      }, 30000); // 30s
    } catch (_) {}
  };

  useEffect(() => {
    return () => {
      try { if (reopenTimeoutRef.current) clearTimeout(reopenTimeoutRef.current); } catch (_) {}
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" aria-hidden />
      <div className="relative bg-gray-900 text-white rounded-lg shadow-xl max-w-md w-[94%] p-6 text-center mx-4">
        <h3 className="text-lg font-semibold mb-2">Nueva actualización disponible</h3>
        <p className="text-sm text-gray-300 mb-4">¿Actualizar ahora para ver los cambios?</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={handleRemindLater} className="px-4 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-sm text-gray-200">Recordarme después</button>
          <button onClick={handleUpdate} className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-sm font-semibold">Sí, actualizar</button>
        </div>
      </div>
    </div>
  );
};

export default UpdateAvailable;
