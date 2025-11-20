import React, { useState, useEffect, useRef } from 'react';

// Este modal solo se muestra cuando el admin dispara `force-update`.
const UpdateAvailable = () => {
  const [visible, setVisible] = useState(false);
  const reopenTimeoutRef = useRef(null);
  const ignoreShowRef = useRef(false);
  const currentForcedNonceRef = useRef(null);

  // Escuchar eventos forzados desde el admin (force-update)
  useEffect(() => {
    const handler = (e) => {
      try {
        const nonce = e?.detail?.nonce;
        const lastSeen = localStorage.getItem('last_forced_nonce');
        if (nonce && String(lastSeen) === String(nonce)) return; // ya lo vio
        currentForcedNonceRef.current = nonce || null;
        ignoreShowRef.current = false;
        setVisible(true);
      } catch (_) {}
    };
    window.addEventListener('force-update', handler);
    return () => window.removeEventListener('force-update', handler);
  }, []);

  const handleUpdate = () => {
    try {
      if (currentForcedNonceRef.current) {
        try { localStorage.setItem('last_forced_nonce', String(currentForcedNonceRef.current)); } catch (_) {}
        currentForcedNonceRef.current = null;
      }
    } catch (_) {}

    try { if (reopenTimeoutRef.current) { clearTimeout(reopenTimeoutRef.current); reopenTimeoutRef.current = null; } } catch (_) {}
    try { ignoreShowRef.current = true; } catch (_) {}
    try { setVisible(false); } catch (_) {}

    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch (_) {}

    try { window.location.reload(); } catch (_) { /* noop */ }
  };

  const handleRemindLater = () => {
    setVisible(false);
    try {
      if (reopenTimeoutRef.current) clearTimeout(reopenTimeoutRef.current);
      reopenTimeoutRef.current = setTimeout(() => {
        try { if (!ignoreShowRef.current) setVisible(true); } catch (_) {}
      }, 30000);
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
