// src/components/Admin/Settings.js
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

const Settings = ({ setError, setSuccess, theme, setTheme }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      setNotificationsEnabled(doc.exists() ? doc.data().notificationsEnabled || false : false);
    }, (error) => setError(`Error al cargar configuración: ${error.message}`));
    return () => unsubscribe();
  }, [setError]);

  const handleSaveSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'global'), { notificationsEnabled, updatedAt: new Date() }, { merge: true });
      setSuccess('Configuración guardada');
    } catch (error) { setError(`Error: ${error.message}`); }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4">
      <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-100">Configuración</h2>
      <div className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-4 sm:p-6 rounded-xl shadow-lg`}>
        <h3 className="text-base sm:text-lg font-semibold mb-4">Opciones Generales</h3>
        <label className="flex items-center mb-4">
          <input 
            type="checkbox" 
            checked={notificationsEnabled} 
            onChange={e => setNotificationsEnabled(e.target.checked)} 
            className="mr-2" 
          />
          <span className="text-sm">Notificaciones habilitadas</span>
        </label>
        <button 
          onClick={handleSaveSettings} 
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors text-sm"
        >
          Guardar
        </button>
      </div>
    </div>
  );
};

export default Settings;