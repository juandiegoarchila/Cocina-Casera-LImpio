//src/components/Admin/MenuManagement.js
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { XMarkIcon } from '@heroicons/react/24/outline';

const MenuManagement = ({ setError, setSuccess, theme }) => {
  const [selectedCollection, setSelectedCollection] = useState('soups');
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', description: '', emoji: '', price: '', isNew: false });
  const [editingItem, setEditingItem] = useState(null);
  const [editItem, setEditItem] = useState({ name: '', description: '', emoji: '', price: '', isNew: false, isFinished: false });

  const collectionNames = {
    soups: 'Sopas',
    soupReplacements: 'Reemplazos de Sopa',
    principles: 'Principios',
    proteins: 'Proteínas',
    drinks: 'Bebidas',
    sides: 'Acompañamientos',
    additions: 'Adiciones',
    times: 'Horarios',
    paymentMethods: 'Métodos de Pago'
  };
  const collections = Object.keys(collectionNames);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, selectedCollection), (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => setError(`Error cargando datos: ${error.message}`));
    return () => unsubscribe();
  }, [selectedCollection, setError]);

  const handleAddItem = async () => {
    if (!newItem.name.trim()) {
      setError('El nombre no puede estar vacío');
      return;
    }
    if (selectedCollection === 'additions' && (!newItem.price || isNaN(parseFloat(newItem.price)) || parseFloat(newItem.price) <= 0)) {
      setError('El precio debe ser un número válido mayor a 0 para Adiciones');
      return;
    }
    try {
      const itemData = {
        name: newItem.name,
        description: newItem.description,
        emoji: newItem.emoji,
        isNew: newItem.isNew,
        createdAt: new Date()
      };
      if (selectedCollection === 'additions') {
        itemData.price = parseFloat(newItem.price);
      }
      await addDoc(collection(db, selectedCollection), itemData);
      setNewItem({ name: '', description: '', emoji: '', price: '', isNew: false });
      window.dispatchEvent(new Event('optionsUpdated'));
      setSuccess(`"${newItem.name}" agregado`);
    } catch (error) {
      setError(`Error al agregar: ${error.message}`);
    }
  };

  const handleDeleteItem = async (itemId, itemName) => {
    try {
      await deleteDoc(doc(db, selectedCollection, itemId));
      setSuccess(`"${itemName}" eliminado`);
    } catch (error) {
      setError(`Error al eliminar: ${error.message}`);
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setEditItem({ 
      ...item, 
      price: item.price !== undefined ? item.price.toString() : '',
      isFinished: item.isFinished || false
    });
  };

  const handleSaveEdit = async () => {
    if (!editItem.name.trim()) {
      setError('El nombre no puede estar vacío');
      return;
    }
    if (selectedCollection === 'additions' && (!editItem.price || isNaN(parseFloat(editItem.price)) || parseFloat(editItem.price) <= 0)) {
      setError('El precio debe ser un número válido mayor a 0 para Adiciones');
      return;
    }
    try {
      const itemData = {
        name: editItem.name,
        description: editItem.description,
        emoji: editItem.emoji,
        isNew: editItem.isNew,
        isFinished: editItem.isFinished || false
      };
      if (selectedCollection === 'additions') {
        itemData.price = parseFloat(editItem.price);
      }
      await updateDoc(doc(db, selectedCollection, editingItem.id), itemData);
      setEditingItem(null);
      setSuccess(`"${editItem.name}" actualizado`);
    } catch (error) {
      setError(`Error al actualizar: ${error.message}`);
    }
  };

  const handleToggleFinished = async (item) => {
    try {
      await updateDoc(doc(db, selectedCollection, item.id), { isFinished: !item.isFinished });
      setSuccess(`"${item.name}" ${!item.isFinished ? 'agotado' : 'disponible'}`);
    } catch (error) {
      setError(`Error al actualizar: ${error.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4">
      <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-100">Gestión de Menú</h2>
      <div className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-4 sm:p-6 rounded-xl shadow-lg`}>
        <select value={selectedCollection} onChange={e => setSelectedCollection(e.target.value)} className={`bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-${theme === 'dark' ? 'white' : 'gray-900'} p-2 rounded-lg w-full mb-4 text-sm`}>
          {collections.map(col => <option key={col} value={col}>{collectionNames[col]}</option>)}
        </select>
        <div className={`bg-${theme === 'dark' ? 'gray-700' : 'gray-300'} p-4 sm:p-6 rounded-lg mb-4`}>
          <h3 className="text-base sm:text-lg font-semibold mb-3">Agregar {collectionNames[selectedCollection]}</h3>
          <input value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} placeholder={`Nombre de ${collectionNames[selectedCollection]}`} className={`bg-${theme === 'dark' ? 'gray-600' : 'gray-400'} text-white p-2 rounded-lg w-full mb-3 text-sm`} />
          <textarea value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} placeholder="Descripción" className={`bg-${theme === 'dark' ? 'gray-600' : 'gray-400'} text-white p-2 rounded-lg w-full mb-3 text-sm`} rows="3" />
          <input value={newItem.emoji} onChange={e => setNewItem({ ...newItem, emoji: e.target.value })} placeholder="Emoji" className={`bg-${theme === 'dark' ? 'gray-600' : 'gray-400'} text-white p-2 rounded-lg w-full mb-3 text-sm`} />
          {selectedCollection === 'additions' && (
            <input
              value={newItem.price}
              onChange={e => setNewItem({ ...newItem, price: e.target.value })}
              placeholder="Precio (COP)"
              type="number"
              min="0"
              step="1"
              className={`bg-${theme === 'dark' ? 'gray-600' : 'gray-400'} text-white p-2 rounded-lg w-full mb-3 text-sm`}
            />
          )}
          {selectedCollection !== 'times' && <label className="flex items-center mb-3"><input type="checkbox" checked={newItem.isNew} onChange={e => setNewItem({ ...newItem, isNew: e.target.checked })} className="mr-2" /><span className="text-sm">¿Es nuevo?</span></label>}
          <button onClick={handleAddItem} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg w-full transition-colors text-sm">Agregar</button>
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-semibold mb-3">Lista de {collectionNames[selectedCollection]}</h3>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {items.map(item => (
              <div key={item.id} className={`p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center ${item.isFinished ? 'bg-gray-700' : 'bg-gray-600'} transition-colors shadow-sm hover:shadow-md`}>
                <div className="flex flex-col">
                  <span className={`text-sm ${item.isFinished ? 'line-through text-gray-400' : ''}`}>
                    {item.emoji && <span className="mr-1">{item.emoji}</span>}{item.name}
                  </span>
                  {item.description && <span className="text-xs text-gray-300">{item.description}</span>}
                  {item.price !== undefined && <span className="text-xs text-gray-300">Precio: ${item.price.toLocaleString('es-CO')}</span>}
                  {item.isNew && <span className="text-green-400 text-xs">(Nuevo)</span>}
                  {item.isFinished && <span className="text-red-400 text-xs">🚫 Agotado</span>}
                </div>
                <div className="flex gap-2 mt-2 sm:mt-0">
                  <button onClick={() => handleEditItem(item)} className="bg-blue-600 hover:bg-blue-700 p-2 rounded-lg transition-colors" title="Editar">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDeleteItem(item.id, item.name)} className="bg-red-600 hover:bg-red-700 p-2 rounded-lg transition-colors" title="Eliminar">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4M7 7h10" />
                    </svg>
                  </button>
                  <button onClick={() => handleToggleFinished(item)} className={`p-2 rounded-lg transition-colors ${item.isFinished ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gray-500 hover:bg-gray-600'}`} title={item.isFinished ? 'Disponible' : 'Agotado'}>
                    <span className="text-lg">🚫</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-4 sm:p-6 rounded-lg w-11/12 max-w-md overflow-y-auto max-h-[80vh] shadow-lg`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg">Editar Elemento</h2>
              <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-200">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <input value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} className={`bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-${theme === 'dark' ? 'white' : 'gray-900'} p-2 rounded-lg w-full mb-4 text-sm`} placeholder="Nombre" />
            <textarea value={editItem.description} onChange={e => setEditItem({ ...editItem, description: e.target.value })} placeholder="Descripción" className={`bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-${theme === 'dark' ? 'white' : 'gray-900'} p-2 rounded-lg w-full mb-4 text-sm`} rows="3" />
            <input value={editItem.emoji} onChange={e => setEditItem({ ...editItem, emoji: e.target.value })} placeholder="Emoji" className={`bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-${theme === 'dark' ? 'white' : 'gray-900'} p-2 rounded-lg w-full mb-4 text-sm`} />
            {selectedCollection === 'additions' && (
              <input
                value={editItem.price}
                onChange={e => setEditItem({ ...editItem, price: e.target.value })}
                placeholder="Precio (COP)"
                type="number"
                min="0"
                step="1"
                className={`bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-${theme === 'dark' ? 'white' : 'gray-900'} p-2 rounded-lg w-full mb-4 text-sm`}
              />
            )}
            {selectedCollection !== 'times' && (
              <div className="space-y-2 mb-4">
                <label className="flex items-center">
                  <input type="checkbox" checked={editItem.isNew} onChange={e => setEditItem({ ...editItem, isNew: e.target.checked })} className="mr-2" />
                  <span className="text-sm">¿Es nuevo?</span>
                </label>
                <label className="flex items-center">
                  <input type="checkbox" checked={editItem.isFinished} onChange={e => setEditItem({ ...editItem, isFinished: e.target.checked })} className="mr-2" />
                  <span className="text-sm">¿Agotado?</span>
                </label>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex-1 transition-colors text-sm">Guardar</button>
              <button onClick={() => setEditingItem(null)} className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg flex-1 transition-colors text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuManagement;