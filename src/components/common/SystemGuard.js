import React, { useEffect, useState } from 'react';
import { db } from '../../config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useLocation } from 'react-router-dom';

const SystemGuard = ({ children }) => {
  const [isSuspended, setIsSuspended] = useState(false);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Escuchar cambios en tiempo real del estado del sistema
    const unsubscribe = onSnapshot(doc(db, 'config', 'systemStatus'), (docSnap) => {
      if (docSnap.exists()) {
        setIsSuspended(docSnap.data().suspended || false);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error verificando licencia:", error);
      setLoading(false); // Asumir activo en caso de error de conexión para no bloquear por error técnico
    });

    return () => unsubscribe();
  }, []);

  // La ruta del manager siempre debe ser accesible para poder desbloquear si es necesario
  if (location.pathname === '/license-control') {
    return children;
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (isSuspended) {
    return (
      <div className="fixed inset-0 bg-gray-100 z-[9999] flex flex-col items-center justify-center p-4 text-center font-sans">
        <div className="bg-white p-10 rounded-2xl shadow-2xl max-w-lg w-full">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-4">Servicio Suspendido</h1>
          <p className="text-gray-600 text-lg mb-8">
            Esta plataforma se encuentra temporalmente inactiva por motivos administrativos o mantenimiento pendiente.
          </p>
          <div className="border-t border-gray-200 pt-6">
            <p className="text-sm text-gray-500">
              Por favor contacte al administrador del sistema para restablecer el servicio.
            </p>
            <p className="text-xs text-gray-400 mt-2">Código de error: LIC_Payment_Pending_0x01</p>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default SystemGuard;
