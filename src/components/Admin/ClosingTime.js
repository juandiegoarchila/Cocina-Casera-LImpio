import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

const ClosingTime = ({ setError, setSuccess, theme }) => {
  const [isOrderingDisabled, setIsOrderingDisabled] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      setIsOrderingDisabled(doc.exists() ? doc.data().isOrderingDisabled || false : false);
    }, (error) => setError(`Error al cargar configuración: ${error.message}`));
    return () => unsubscribe();
  }, [setError]);

  const handleToggleOrdering = async () => {
    try {
      await setDoc(doc(db, 'settings', 'global'), { isOrderingDisabled: !isOrderingDisabled, updatedAt: new Date() }, { merge: true });
      setSuccess(`Pedidos ${!isOrderingDisabled ? 'cerrados' : 'habilitados'}`);
    } catch (error) { setError(`Error al actualizar: ${error.message}`); }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4">
      <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-100">Activar Hora de Cierre</h2>
      <div className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-4 sm:p-6 rounded-xl shadow-lg`}>
        <h3 className="text-base sm:text-lg font-semibold mb-3">Estado de Pedidos</h3>
        <button onClick={handleToggleOrdering} className={`w-full py-2 rounded-lg transition-colors text-sm ${isOrderingDisabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
          {isOrderingDisabled ? 'Habilitar Pedidos' : 'Cerrar Pedidos'}
        </button>
        <p className="text-sm text-gray-400 mt-2">{isOrderingDisabled ? 'Cerrados' : 'Abiertos'}</p>
      </div>
    </div>
  );
};

export default ClosingTime;