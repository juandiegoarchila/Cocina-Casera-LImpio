//src/components/AdminPage.js
import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';

const AdminPage = () => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState('soups');
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemIsNew, setNewItemIsNew] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemIsNew, setEditItemIsNew] = useState(false);

  const correctPassword = 'admin123';

  const collections = [
    'soups', 'soupReplacements', 'principles', 'proteins', 
    'drinks', 'sides', 'times', 'paymentMethods'
  ];

  // Escuchar cambios en la colección seleccionada en tiempo real
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = onSnapshot(collection(db, selectedCollection), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setItems(data);
      console.log(`Datos actualizados para ${selectedCollection}:`, data);
    }, (error) => {
      console.error(`Error al escuchar ${selectedCollection}:`, error);
    });

    // Limpiar el listener cuando cambie la colección o el componente se desmonte
    return () => unsubscribe();
  }, [selectedCollection, isAuthenticated]);

  // Agregar un nuevo ítem
  const handleAddItem = async () => {
    if (!isAuthenticated || !newItemName.trim()) return;

    const newItem = { name: newItemName.trim() };
    if (selectedCollection !== 'times') newItem.isNew = newItemIsNew;

    await addDoc(collection(db, selectedCollection), newItem);
    setNewItemName('');
    setNewItemIsNew(false);
  };

  // Eliminar un ítem
  const handleDeleteItem = async (itemId) => {
    if (!isAuthenticated) return;
    await deleteDoc(doc(db, selectedCollection, itemId));
  };

  // Iniciar edición de un ítem
  const handleEditItem = (item) => {
    setEditingItem(item);
    setEditItemName(item.name);
    setEditItemIsNew(item.isNew || false);
  };

  // Guardar cambios al editar un ítem
  const handleSaveEdit = async () => {
    if (!isAuthenticated || !editItemName.trim()) return;

    const updatedItem = { name: editItemName.trim() };
    if (selectedCollection !== 'times') updatedItem.isNew = editItemIsNew;

    await updateDoc(doc(db, selectedCollection, editingItem.id), updatedItem);
    setEditingItem(null);
    setEditItemName('');
    setEditItemIsNew(false);
  };

  // Cancelar edición
  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditItemName('');
    setEditItemIsNew(false);
  };

  const handleLogin = () => {
    if (password === correctPassword) {
      setIsAuthenticated(true);
    } else {
      alert('Contraseña incorrecta');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="p-4 bg-gray-900 text-white min-h-screen flex items-center justify-center">
        <div>
          <h1 className="text-2xl font-bold mb-4">Iniciar Sesión</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="w-full p-2 mb-4 bg-gray-800 border border-gray-700 rounded text-white"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-green-500 hover:bg-green-600 p-2 rounded text-white font-semibold"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Panel de Administración</h1>

      {/* Selección de Categoría */}
      <div className="mb-4">
        <label className="block mb-2">Categoría:</label>
        <select
          value={selectedCollection}
          onChange={(e) => setSelectedCollection(e.target.value)}
          className="p-2 bg-gray-800 border border-gray-700 rounded"
        >
          {collections.map(col => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </div>

      {/* Agregar Nuevo Elemento */}
      <div className="mb-6 p-4 bg-gray-800 rounded">
        <h2 className="text-xl font-semibold mb-2">Agregar Nuevo Elemento</h2>
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder="Nombre"
          className="w-full p-2 mb-2 bg-gray-700 border border-gray-600 rounded text-white"
        />
        {selectedCollection !== 'times' && (
          <div className="mb-2">
            <label>
              <input
                type="checkbox"
                checked={newItemIsNew}
                onChange={(e) => setNewItemIsNew(e.target.checked)}
                className="mr-2"
              />
              ¿Es nuevo?
            </label>
          </div>
        )}
        <button
          onClick={handleAddItem}
          className="w-full bg-green-500 hover:bg-green-600 p-2 rounded text-white font-semibold"
        >
          Agregar
        </button>
      </div>

      {/* Editar Elemento */}
      {editingItem && (
        <div className="mb-6 p-4 bg-gray-800 rounded">
          <h2 className="text-xl font-semibold mb-2">Editar Elemento</h2>
          <input
            type="text"
            value={editItemName}
            onChange={(e) => setEditItemName(e.target.value)}
            placeholder="Nombre"
            className="w-full p-2 mb-2 bg-gray-700 border border-gray-600 rounded text-white"
          />
          {selectedCollection !== 'times' && (
            <div className="mb-2">
              <label>
                <input
                  type="checkbox"
                  checked={editItemIsNew}
                  onChange={(e) => setEditItemIsNew(e.target.checked)}
                  className="mr-2"
                />
                ¿Es nuevo?
              </label>
            </div>
          )}
          <div className="flex space-x-2">
            <button
              onClick={handleSaveEdit}
              className="w-full bg-blue-500 hover:bg-blue-600 p-2 rounded text-white font-semibold"
            >
              Guardar
            </button>
            <button
              onClick={handleCancelEdit}
              className="w-full bg-gray-500 hover:bg-gray-600 p-2 rounded text-white font-semibold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Elementos Actuales */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Elementos Actuales</h2>
        <ul className="space-y-2">
          {items.map(item => (
            <li key={item.id} className="flex justify-between items-center p-2 bg-gray-800 rounded">
              <span>
                {item.name} {item.isNew && '(Nuevo)'}
              </span>
              <div className="space-x-2">
                <button
                  onClick={() => handleEditItem(item)}
                  className="bg-blue-500 hover:bg-blue-600 p-1 rounded text-white"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="bg-red-500 hover:bg-red-600 p-1 rounded text-white"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AdminPage;