//src/components/Admin/MenuManagement.js
import { useState, useEffect, useRef } from 'react';
import { db } from '../../config/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { XMarkIcon, PencilIcon, TrashIcon, CheckCircleIcon, MinusCircleIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline'; // New icons

// Componente para una checkbox personalizada
const CustomCheckbox = ({ id, label, checked, onChange, theme }) => (
  <div className="flex items-center cursor-pointer">
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={onChange}
      className="hidden" // Oculta la checkbox nativa
    />
    <label htmlFor={id} className="flex items-center cursor-pointer">
      <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-all duration-200
        ${checked
          ? 'bg-blue-600 border-blue-600'
          : `bg-transparent ${theme === 'dark' ? 'border-gray-500' : 'border-gray-400'}`
        }`}>
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={`ml-2 text-sm ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>{label}</span>
    </label>
  </div>
);

const MenuManagement = ({ setError, setSuccess, theme }) => {
  const [selectedCollection, setSelectedCollection] = useState('soups');
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', description: '', emoji: '', price: '', isNew: false });
  const [editingItem, setEditingItem] = useState(null);
  const [editItem, setEditItem] = useState({ name: '', description: '', emoji: '', price: '', isNew: false, isFinished: false });
  const [showAddItemForm, setShowAddItemForm] = useState(false); // State to toggle add form
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  // Ref for auto-scrolling
  const itemsListRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, selectedCollection), orderBy('createdAt', 'asc')); // Order by creation date
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      // Scroll to bottom when new items are added if the list is already near bottom
      if (itemsListRef.current) {
        const { scrollHeight, clientHeight, scrollTop } = itemsListRef.current;
        if (scrollHeight - scrollTop < clientHeight + 100) { // If near bottom
          itemsListRef.current.scrollTop = scrollHeight;
        }
      }
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
        name: newItem.name.trim(),
        description: newItem.description.trim(),
        emoji: newItem.emoji.trim(),
        isNew: newItem.isNew,
        createdAt: new Date()
      };
      if (selectedCollection === 'additions') {
        itemData.price = parseFloat(newItem.price);
      }
      await addDoc(collection(db, selectedCollection), itemData);
      setNewItem({ name: '', description: '', emoji: '', price: '', isNew: false });
      setShowAddItemForm(false); // Hide form after adding
      window.dispatchEvent(new Event('optionsUpdated')); // Trigger update event
      setSuccess(`"${itemData.name}" agregado exitosamente.`);
    } catch (error) {
      setError(`Error al agregar: ${error.message}`);
    }
  };

  const confirmDeleteItem = (itemId, itemName) => {
    setItemToDelete({ id: itemId, name: itemName });
    setShowConfirmDeleteModal(true);
  };

  const handleDeleteConfirmed = async () => {
    try {
      await deleteDoc(doc(db, selectedCollection, itemToDelete.id));
      setSuccess(`"${itemToDelete.name}" eliminado exitosamente.`);
      setShowConfirmDeleteModal(false);
      setItemToDelete(null);
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
        name: editItem.name.trim(),
        description: editItem.description.trim(),
        emoji: editItem.emoji.trim(),
        isNew: editItem.isNew,
        isFinished: editItem.isFinished || false,
        updatedAt: new Date() // Add updatedAt field
      };
      if (selectedCollection === 'additions') {
        itemData.price = parseFloat(editItem.price);
      }
      await updateDoc(doc(db, selectedCollection, editingItem.id), itemData);
      setEditingItem(null);
      setSuccess(`"${itemData.name}" actualizado exitosamente.`);
    } catch (error) {
      setError(`Error al actualizar: ${error.message}`);
    }
  };

  const handleToggleFinished = async (item) => {
    try {
      await updateDoc(doc(db, selectedCollection, item.id), { isFinished: !item.isFinished });
      setSuccess(`"${item.name}" ${!item.isFinished ? 'marcado como agotado' : 'marcado como disponible'}.`);
    } catch (error) {
      setError(`Error al actualizar: ${error.message}`);
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getInputFieldClasses = (isAddForm = true) => {
    const baseClasses = `p-3 rounded-lg w-full transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none`;
    const darkTheme = `${isAddForm ? 'bg-gray-700' : 'bg-gray-700'} text-gray-100 placeholder-gray-400`;
    const lightTheme = `${isAddForm ? 'bg-gray-200' : 'bg-white'} text-gray-800 placeholder-gray-500 border border-gray-300`;
    return `${baseClasses} ${theme === 'dark' ? darkTheme : lightTheme}`;
  };

  const getContainerBgClasses = (isMain = false) => {
    if (theme === 'dark') return isMain ? 'bg-gray-800' : 'bg-gray-900';
    return isMain ? 'bg-white' : 'bg-gray-50';
  };

  return (
    // Contenedor principal con flexbox para layout de columnas en desktop, apilado en móvil
    <div className={`min-h-screen ${getContainerBgClasses(true)} text-gray-100 p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-6`}>
      {/* Sidebar de Navegación (Colecciones) - Se convierte en un scroll horizontal en móviles */}
      <aside className={`w-full md:w-64 flex-shrink-0 ${getContainerBgClasses()} p-4 sm:p-6 rounded-xl shadow-lg border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} `}>
        <h2 className="text-xl font-bold mb-4 md:mb-6 text-gray-200 dark:text-white">Categorías</h2>
        <nav className="flex md:flex-col gap-2 md:gap-3 overflow-x-auto whitespace-nowrap md:whitespace-normal custom-scrollbar-horizontal pb-2 md:pb-0"> {/* Añadido flex, overflow-x-auto para scroll horizontal en móvil */}
          {collections.map(col => (
            <button
              key={col}
              onClick={() => setSelectedCollection(col)}
              className={`flex-shrink-0 md:flex-shrink w-auto md:w-full text-left px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-all duration-200 text-sm font-medium
                ${selectedCollection === col
                  ? 'bg-blue-600 text-white shadow-md'
                  : `${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`
                }`
              }
            >
              {collectionNames[col]}
            </button>
          ))}
        </nav>
      </aside>

      {/* Contenido Principal de Gestión */}
      <main className={`flex-1 ${getContainerBgClasses()} p-4 sm:p-6 rounded-xl shadow-lg border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} `}>
        <h2 className="text-xl sm:text-2xl font-extrabold mb-4 sm:mb-6 text-gray-200 dark:text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0"> {/* Ajuste para título en móvil */}
          <span>Gestión de {collectionNames[selectedCollection]}</span>
          <button
            onClick={() => setShowAddItemForm(!showAddItemForm)}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 shadow-md text-sm sm:text-base w-full sm:w-auto justify-center" // Botón de añadir responsive
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            {showAddItemForm ? 'Ocultar Formulario' : `Añadir ${collectionNames[selectedCollection]}`}
          </button>
        </h2>

        {/* Formulario para Agregar Nuevo Elemento */}
        <div className={`transition-all duration-500 ease-in-out overflow-hidden ${showAddItemForm ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className={`${getContainerBgClasses()} p-4 sm:p-6 rounded-lg mb-6 shadow-inner`}> {/* Padding ajustado */}
            <h3 className="text-lg font-semibold mb-4 text-gray-200 dark:text-white flex items-center">
              <PlusIcon className="h-5 w-5 mr-2 text-green-400" /> Agregar Nuevo {collectionNames[selectedCollection]}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                value={newItem.name}
                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                placeholder={`Nombre de ${collectionNames[selectedCollection]}`}
                className={getInputFieldClasses()}
              />
              <input
                value={newItem.emoji}
                onChange={e => setNewItem({ ...newItem, emoji: e.target.value })}
                placeholder="Emoji (ej. 🍜)"
                className={getInputFieldClasses()}
              />
            </div>
            <textarea
              value={newItem.description}
              onChange={e => setNewItem({ ...newItem, description: e.target.value })}
              placeholder="Descripción (opcional)"
              className={`${getInputFieldClasses()} mt-4`}
              rows="2"
            />
            {selectedCollection === 'additions' && (
              <input
                value={newItem.price}
                onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                placeholder="Precio (COP)"
                type="number"
                min="0"
                step="any"
                className={`${getInputFieldClasses()} mt-4`}
              />
            )}
            {selectedCollection !== 'times' && selectedCollection !== 'paymentMethods' && (
              <div className="mt-4">
                <CustomCheckbox
                  id="isNew"
                  label="Marcar como 'Nuevo'"
                  checked={newItem.isNew}
                  onChange={e => setNewItem({ ...newItem, isNew: e.target.checked })}
                  theme={theme}
                />
              </div>
            )}
            <button
              onClick={handleAddItem}
              className="mt-6 w-full py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-lg shadow-md transition-all duration-300 transform hover:scale-105"
            >
              Agregar {collectionNames[selectedCollection]}
            </button>
          </div>
        </div>

        {/* Lista de Elementos */}
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-4 text-gray-200 dark:text-white flex items-center">
            <MagnifyingGlassIcon className="h-5 w-5 mr-2 text-blue-400" /> Lista de {collectionNames[selectedCollection]}
          </h3>
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${getInputFieldClasses(false)} pl-10`}
            />
            <MagnifyingGlassIcon className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
          </div>

          {filteredItems.length === 0 && searchTerm !== '' ? (
            <p className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>No se encontraron resultados para "{searchTerm}".</p>
          ) : filteredItems.length === 0 ? (
            <p className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Aún no hay elementos en esta categoría. ¡Agrega uno!</p>
          ) : (
            <div ref={itemsListRef} className="space-y-4 max-h-[calc(100vh-300px)] md:max-h-[calc(100vh-350px)] overflow-y-auto pr-2 custom-scrollbar"> {/* Altura ajustada dinámicamente */}
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center transition-all duration-300 shadow-md transform hover:-translate-y-1 hover:shadow-lg
                    ${item.isFinished
                      ? 'bg-red-800/20 text-red-200 border border-red-700/50'
                      : (theme === 'dark' ? 'bg-gray-700/50 text-gray-100 border border-gray-600' : 'bg-blue-50/50 text-gray-900 border border-blue-100')
                    }`
                  }
                >
                  <div className="flex flex-col flex-grow mb-3 sm:mb-0">
                    <div className="flex items-center flex-wrap"> {/* Flex-wrap para nombres largos */}
                      {item.emoji && <span className="mr-2 text-xl">{item.emoji}</span>}
                      <span className={`text-lg font-semibold ${item.isFinished ? 'line-through text-gray-400' : ''}`}>
                        {item.name}
                      </span>
                      {item.isNew && (
                        <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-300 text-xs font-bold rounded-full mt-1 sm:mt-0">NUEVO</span>
                      )}
                      {item.isFinished && (
                        <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-300 text-xs font-bold rounded-full mt-1 sm:mt-0">AGOTADO</span>
                      )}
                    </div>
                    {item.description && <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{item.description}</p>}
                    {item.price !== undefined && (
                      <p className={`text-sm mt-1 font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                        Precio: ${item.price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    )}
                  </div>
                  {/* Botones de acción - Aseguramos que se envuelvan bien en pantallas pequeñas */}
                  <div className="flex gap-2 flex-wrap justify-end w-full sm:w-auto">
                    {selectedCollection !== 'times' && selectedCollection !== 'paymentMethods' && (
                        <button
                          onClick={() => handleToggleFinished(item)}
                          className={`p-2 rounded-full transition-all duration-300 transform hover:scale-110
                            ${item.isFinished
                              ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                              : (theme === 'dark' ? 'bg-gray-600 hover:bg-gray-500 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700')
                            }`
                          }
                          title={item.isFinished ? 'Marcar como Disponible' : 'Marcar como Agotado'}
                        >
                          {item.isFinished ? <CheckCircleIcon className="w-5 h-5" /> : <MinusCircleIcon className="w-5 h-5" />}
                        </button>
                    )}
                    <button
                      onClick={() => handleEditItem(item)}
                      className={`p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 transform hover:scale-110`}
                      title="Editar"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => confirmDeleteItem(item.id, item.name)}
                      className={`p-2 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all duration-300 transform hover:scale-110`}
                      title="Eliminar"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal de Edición (sin cambios significativos en responsividad, ya bien manejado) */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className={`relative ${getContainerBgClasses()} p-6 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl transform scale-95 animate-scale-in`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-200 dark:text-white">Editar {editingItem.name}</h2>
              <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-200 p-1 rounded-full hover:bg-gray-700 transition-colors">
                <XMarkIcon className="h-7 w-7" />
              </button>
            </div>
            <div className="space-y-4">
              <input value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} className={getInputFieldClasses(false)} placeholder="Nombre" />
              <textarea value={editItem.description} onChange={e => setEditItem({ ...editItem, description: e.target.value })} placeholder="Descripción" className={getInputFieldClasses(false)} rows="3" />
              <input value={editItem.emoji} onChange={e => setEditItem({ ...editItem, emoji: e.target.value })} placeholder="Emoji" className={getInputFieldClasses(false)} />
              {selectedCollection === 'additions' && (
                <input
                  value={editItem.price}
                  onChange={e => setEditItem({ ...editItem, price: e.target.value })}
                  placeholder="Precio (COP)"
                  type="number"
                  min="0"
                  step="any"
                  className={getInputFieldClasses(false)}
                />
              )}
              {selectedCollection !== 'times' && selectedCollection !== 'paymentMethods' && (
                <div className="space-y-3">
                  <CustomCheckbox
                    id="editIsNew"
                    label="Marcar como 'Nuevo'"
                    checked={editItem.isNew}
                    onChange={e => setEditItem({ ...editItem, isNew: e.target.checked })}
                    theme={theme}
                  />
                  <CustomCheckbox
                    id="editIsFinished"
                    label="Marcar como 'Agotado'"
                    checked={editItem.isFinished}
                    onChange={e => setEditItem({ ...editItem, isFinished: e.target.checked })}
                    theme={theme}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-4 mt-6">
              <button onClick={handleSaveEdit} className="flex-1 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-lg shadow-md transition-all duration-300 transform hover:scale-105">Guardar Cambios</button>
              <button onClick={() => setEditingItem(null)} className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-gray-200 font-semibold rounded-lg shadow-md transition-all duration-300 transform hover:scale-105">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar (sin cambios significativos en responsividad) */}
      {showConfirmDeleteModal && itemToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className={`relative ${getContainerBgClasses()} p-6 rounded-xl w-full max-w-sm shadow-2xl transform scale-95 animate-scale-in text-center`}>
            <XMarkIcon className="absolute top-4 right-4 h-6 w-6 text-gray-400 cursor-pointer hover:text-gray-200" onClick={() => setShowConfirmDeleteModal(false)} />
            <h3 className="text-xl font-bold mb-4 text-red-400">Confirmar Eliminación</h3>
            <p className="text-gray-200 mb-6">¿Estás seguro de que quieres eliminar "<span className="font-semibold">{itemToDelete.name}</span>"? Esta acción no se puede deshacer.</p>
            <div className="flex gap-4">
              <button
                onClick={handleDeleteConfirmed}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md transition-all duration-300 transform hover:scale-105"
              >
                Sí, Eliminar
              </button>
              <button
                onClick={() => setShowConfirmDeleteModal(false)}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-gray-200 font-semibold rounded-lg shadow-md transition-all duration-300 transform hover:scale-105"
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

export default MenuManagement;