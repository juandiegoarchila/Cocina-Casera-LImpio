import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const LicenseManager = () => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  // Contraseña maestra (puedes cambiarla aquí)
  const MASTER_KEY = "admin2026killswitch"; 

  useEffect(() => {
    // Escuchar el estado actual
    const unsubscribe = onSnapshot(doc(db, 'config', 'systemStatus'), (docSnap) => {
      if (docSnap.exists()) {
        setIsSuspended(docSnap.data().suspended || false);
      } else {
        // Crear documento por defecto si no existe
        setDoc(doc(db, 'config', 'systemStatus'), { suspended: false });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error escuchando estado:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === MASTER_KEY) {
      setIsAuthenticated(true);
      setMessage('');
    } else {
      setMessage('Clave incorrecta');
    }
  };

  const toggleSystemStatus = async () => {
    try {
      setLoading(true);
      const newState = !isSuspended;
      await setDoc(doc(db, 'config', 'systemStatus'), { 
        suspended: newState,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setMessage(newState ? 'SISTEMA SUSPENDIDO CORRECTAMENTE' : 'SISTEMA RESTAURADO CORRECTAMENTE');
    } catch (error) {
      console.error("Error updating status:", error);
      setMessage('Error al actualizar estado');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-500 mb-6 text-center">🔐 Acceso Restringido</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-gray-400 mb-2">Clave de Control</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-700 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Ingrese clave maestra"
              />
            </div>
            {message && <p className="text-red-400 text-sm text-center">{message}</p>}
            <button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition duration-200"
            >
              Acceder
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full border border-gray-700">
        <h2 className="text-3xl font-bold text-white mb-2 text-center">Panel de Control Global</h2>
        <div className="text-center mb-8">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${isSuspended ? 'bg-red-500/20 text-red-400 border border-red-500' : 'bg-green-500/20 text-green-400 border border-green-500'}`}>
            Estado actual: {isSuspended ? '🔴 SUSPENDIDO' : '🟢 ACTIVO'}
          </span>
        </div>

        <div className="space-y-6">
          <p className="text-gray-400 text-center text-sm">
            Al suspender el sistema, se bloqueará el acceso a TODAS las rutas para todos los usuarios (clientes, meseros, admin). Solo esta pantalla permanecerá accesible.
          </p>

          <button
            onClick={toggleSystemStatus}
            disabled={loading}
            className={`w-full py-4 px-6 rounded-lg font-bold text-lg shadow-lg transition duration-300 transform hover:scale-105 ${
              isSuspended
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
            }`}
          >
            {loading ? 'Procesando...' : (isSuspended ? '✅ RESTAURAR SISTEMA' : '⛔ SUSPENDER SISTEMA AQUÍ AHORA')}
          </button>

          {message && (
            <div className={`p-4 rounded text-center font-medium ${isSuspended ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'}`}>
              {message}
            </div>
          )}
          
          <button 
            onClick={() => navigate('/')}
            className="w-full mt-4 text-gray-500 hover:text-gray-300 text-sm underline"
          >
            Volver al inicio (si está activo)
          </button>
        </div>
      </div>
    </div>
  );
};

export default LicenseManager;
