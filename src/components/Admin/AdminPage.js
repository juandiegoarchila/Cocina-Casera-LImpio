import { useState, useEffect } from 'react';
import { db, auth } from '../../config/firebase';
import { 
  collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc,
  query, where, getDocs 
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Auth/AuthProvider';

const AdminPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState('soups');
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemStatus, setNewItemStatus] = useState({ isNew: false });
  const [editingItem, setEditingItem] = useState(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemStatus, setEditItemStatus] = useState({
    isNew: false,
    isFinished: false
  });

  const collectionNames = {
    soups: 'Sopas',
    soupReplacements: 'Reemplazos de Sopa',
    principles: 'Principios',
    proteins: 'Proteínas',
    drinks: 'Bebidas',
    sides: 'Acompañamientos',
    times: 'Horarios',
    paymentMethods: 'Métodos de Pago'
  };
  const collections = Object.keys(collectionNames);

  useEffect(() => {
    if (loading) return;

    const checkAdminStatus = async () => {
      try {
        if (!user) {
          navigate('/login');
          return;
        }

        const q = query(
          collection(db, 'users'),
          where('email', '==', user.email),
          where('role', '==', 2)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          setError('No tienes permisos de administrador');
          navigate('/login');
        } else {
          setIsAdmin(true);
        }
      } catch (err) {
        console.error('Error verificando admin:', err);
        setError('Error verificando permisos');
        navigate('/login');
      } finally {
        setAdminLoading(false);
      }
    };

    checkAdminStatus();
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;

    const unsubscribe = onSnapshot(
      collection(db, selectedCollection),
      (snapshot) => {
        setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => {
        setError(`Error cargando datos: ${error.message}`);
      }
    );

    return () => unsubscribe();
  }, [selectedCollection, isAdmin]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAdmin(false);
      navigate('/login');
    } catch (error) {
      setError(`Error al cerrar sesión: ${error.message}`);
    }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    
    try {
      const newItem = {
        name: newItemName.trim(),
        ...newItemStatus,
        createdAt: new Date()
      };
      
      await addDoc(collection(db, selectedCollection), newItem);
      setNewItemName('');
      setNewItemStatus({ isNew: false });
      // Dispatch optionsUpdated event
      window.dispatchEvent(new Event('optionsUpdated'));
    } catch (error) {
      setError(`Error al agregar: ${error.message}`);
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await deleteDoc(doc(db, selectedCollection, itemId));
      // Dispatch optionsUpdated event
      window.dispatchEvent(new Event('optionsUpdated'));
    } catch (error) {
      setError(`Error al eliminar: ${error.message}`);
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setEditItemName(item.name);
    setEditItemStatus({
      isNew: item.isNew || false,
      isFinished: item.isFinished || false
    });
  };

  const handleSaveEdit = async () => {
    try {
      await updateDoc(doc(db, selectedCollection, editingItem.id), {
        name: editItemName,
        ...editItemStatus
      });
      setEditingItem(null);
      // Dispatch optionsUpdated event
      window.dispatchEvent(new Event('optionsUpdated'));
    } catch (error) {
      setError(`Error al actualizar: ${error.message}`);
    }
  };

  if (loading || adminLoading) {
    return <div className="p-4 text-white bg-gray-900">Verificando permisos...</div>;
  }

  if (!isAdmin) {
    return null; // Redirect handled in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Panel de Administración</h1>
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
        >
          Cerrar Sesión
        </button>
      </div>

      <div className="mb-6">
        <select
          value={selectedCollection}
          onChange={(e) => setSelectedCollection(e.target.value)}
          className="bg-gray-800 text-white p-2 rounded"
        >
          {collections.map(col => (
            <option key={col} value={col}>{collectionNames[col]}</option>
          ))}
        </select>
      </div>

      <div className="bg-gray-800 p-4 rounded-lg mb-6">
        <h2 className="text-xl mb-4">Agregar {collectionNames[selectedCollection]}</h2>
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder={`Nombre de ${collectionNames[selectedCollection]}`}
          className="bg-gray-700 text-white p-2 rounded w-full mb-2"
        />
        
        {selectedCollection !== 'times' && (
          <div className="space-y-2 mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={newItemStatus.isNew}
                onChange={(e) => setNewItemStatus(prev => ({...prev, isNew: e.target.checked}))}
                className="mr-2"
              />
              ¿Es nuevo?
            </label>
          </div>
        )}
        
        <button
          onClick={handleAddItem}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded w-full"
        >
          Agregar
        </button>
      </div>

      <div>
        <h2 className="text-xl mb-4">Lista de {collectionNames[selectedCollection]}</h2>
        <div className="space-y-2">
          {items.map(item => (
            <div 
              key={item.id} 
              className={`p-3 rounded flex justify-between items-center ${
                item.isFinished ? 'bg-gray-700' : 'bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`${item.isFinished ? 'line-through text-gray-400' : ''}`}>
                  {item.name}
                </span>
                {item.isNew && <span className="text-green-400 text-sm">(Nuevo)</span>}
                {item.isFinished && (
                  <span className="text-red-400 text-sm">
                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg> Agotado
                  </span>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditItem(item)}
                  className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded"
                  title="Editar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded"
                  title="Eliminar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4M7 7h10" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <h2 className="text-xl mb-4">Editar elemento</h2>
            <input
              type="text"
              value={editItemName}
              onChange={(e) => setEditItemName(e.target.value)}
              className="bg-gray-700 text-white p-2 rounded w-full mb-4"
            />
            
            {selectedCollection !== 'times' && (
              <div className="space-y-2 mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editItemStatus.isNew}
                    onChange={(e) => setEditItemStatus(prev => ({...prev, isNew: e.target.checked}))}
                    className="mr-2"
                  />
                  ¿Es nuevo?
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editItemStatus.isFinished}
                    onChange={(e) => setEditItemStatus(prev => ({...prev, isFinished: e.target.checked}))}
                    className="mr-2"
                  />
                  ¿Agotado?
                </label>
              </div>
            )}
            
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded flex-1"
              >
                Guardar
              </button>
              <button
                onClick={() => setEditingItem(null)}
                className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded flex-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;