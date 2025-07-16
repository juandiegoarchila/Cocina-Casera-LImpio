import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import { classNames } from '../../utils/classNames';
import { getMealDetailsDisplay, areMealsIdentical } from './utils';
import { db } from '../../config/firebase';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';

const InteraccionesPedidos = ({
  theme,
  showProteinModal,
  setShowProteinModal,
  newProtein,
  setNewProtein,
  handleAddProtein,
  proteins,
  totalProteinUnits,
  isLoading,
  showMealDetails,
  setShowMealDetails,
  editingOrder,
  setEditingOrder,
  editForm,
  handleMealFormFieldChange, // Este es el handler de edición
  handleSaveEdit,
  showConfirmDeleteAll,
  setShowConfirmDeleteAll,
  confirmText,
  setConfirmText,
  handleDeleteAllOrders,
  setError,
  setSuccess,
  // NUEVAS PROPS PARA GENERAR ORDEN
  showAddOrderModal,
  setShowAddOrderModal,
  newOrderForm,
  handleNewOrderMealFormFieldChange, // Este es el handler para nueva orden
  handleAddOrderSubmit,
}) => {
  const [editingProtein, setEditingProtein] = useState(null);

  const handleDeleteProtein = async (proteinId) => {
    try {
      await deleteDoc(doc(db, 'dailyProteins', proteinId));
      setSuccess('Proteína eliminada correctamente.');
    } catch (error) {
      setError(`Error al eliminar proteína: ${error.message}`);
    }
  };

  const handleEditProtein = (protein) => {
    setEditingProtein(protein);
  };

  const handleUpdateProtein = async () => {
    if (!editingProtein.name || !editingProtein.quantity || isNaN(editingProtein.quantity) || Number(editingProtein.quantity) <= 0) {
      setError('Por favor, ingrese un nombre de proteína válido y una cantidad mayor a 0.');
      return;
    }
    try {
      await updateDoc(doc(db, 'dailyProteins', editingProtein.id), {
        name: editingProtein.name.trim(),
        quantity: Number(editingProtein.quantity),
      });
      setSuccess('Proteína actualizada correctamente.');
      setEditingProtein(null);
    } catch (error) {
      setError(`Error al actualizar proteína: ${error.message}`);
    }
  };

  const handleCancelEditProtein = () => { // Renombrado para claridad
    setEditingProtein(null);
  };

  return (
    <div>
      {/* Diálogo para gestionar proteínas */}
      <Transition show={showProteinModal} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => { setShowProteinModal(false); setEditingProtein(null); }}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={classNames(
                "w-full max-w-md p-6 rounded-lg shadow-md",
                theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-900'
              )}>
                <div className="flex justify-between items-center mb-4">
                  <Dialog.Title className="text-lg font-medium">
                    {editingProtein ? 'Editar Proteína' : 'Gestionar Proteínas'}
                  </Dialog.Title>
                  <button
                    onClick={() => { setShowProteinModal(false); setEditingProtein(null); }}
                    className="text-gray-500 hover:text-gray-400"
                    aria-label="Cerrar modal"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  {editingProtein ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                        <input
                          type="text"
                          value={editingProtein.name}
                          onChange={e => setEditingProtein({ ...editingProtein, name: e.target.value })}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                          placeholder="Ej: Pollo"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad</label>
                        <input
                          type="number"
                          value={editingProtein.quantity}
                          onChange={e => setEditingProtein({ ...editingProtein, quantity: e.target.value })}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                          placeholder="Ej: 50"
                          min="0"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleCancelEditProtein} // Renombrado
                          className={classNames(
                            "px-4 py-2 rounded-md text-sm font-medium",
                            theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                          )}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleUpdateProtein}
                          disabled={isLoading}
                          className={classNames(
                            "px-4 py-2 rounded-md text-sm font-medium",
                            isLoading ? 'bg-gray-400 cursor-not-allowed' : theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                          )}
                        >
                          {isLoading ? 'Guardando...' : 'Actualizar'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                        <input
                          type="text"
                          value={newProtein.name}
                          onChange={e => setNewProtein({ ...newProtein, name: e.target.value })}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                          placeholder="Ej: Pollo"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad</label>
                        <input
                          type="number"
                          value={newProtein.quantity}
                          onChange={e => setNewProtein({ ...newProtein, quantity: e.target.value })}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                          placeholder="Ej: 50"
                          min="0"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setShowProteinModal(false)}
                          className={classNames(
                            "px-4 py-2 rounded-md text-sm font-medium",
                            theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                          )}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleAddProtein}
                          disabled={isLoading}
                          className={classNames(
                            "px-4 py-2 rounded-md text-sm font-medium",
                            isLoading ? 'bg-gray-400 cursor-not-allowed' : theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                          )}
                        >
                          {isLoading ? 'Guardando...' : 'Agregar'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Proteínas Registradas (Total: {totalProteinUnits} unidades)</h3>
                  {proteins.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No hay proteínas registradas.</p>
                  ) : (
                    <ul className="space-y-2">
                      {proteins.map(protein => (
                        <li
                          key={protein.id}
                          className={classNames(
                            "flex justify-between items-center p-2 rounded-md",
                            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                          )}
                        >
                          <span className="text-sm">{protein.name}: {protein.quantity} unidades</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditProtein(protein)}
                              className="text-blue-500 hover:text-blue-400 transition-colors duration-150 p-1 rounded-md"
                              title="Editar proteína"
                              aria-label={`Editar ${protein.name}`}
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProtein(protein.id)}
                              className="text-red-500 hover:text-red-400 transition-colors duration-150 p-1 rounded-md"
                              title="Eliminar proteína"
                              aria-label={`Eliminar ${protein.name}`}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Diálogo para detalles del pedido */}
      <Transition show={showMealDetails !== null} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowMealDetails(null)}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={classNames(
                "w-full max-w-2xl p-6 rounded-lg shadow-xl max-h-[80vh] overflow-y-auto",
                theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-900'
              )}>
                <Dialog.Title className="text-lg font-medium mb-4 flex justify-between items-center">
                  Detalles del Pedido
                  <button
                    onClick={() => setShowMealDetails(null)}
                    className="text-gray-500 hover:text-gray-400"
                    aria-label="Cerrar detalles"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </Dialog.Title>
                {showMealDetails && (
                  <div className="space-y-4 text-sm">
                    {areMealsIdentical(showMealDetails.meals).areIdentical ? (
                      <div>
                        <h3 className="font-medium">Bandeja (x{areMealsIdentical(showMealDetails.meals).count})</h3>
                        <pre className="whitespace-pre-wrap">{getMealDetailsDisplay(showMealDetails.meals[0])}</pre>
                      </div>
                    ) : (
                      showMealDetails.meals.map((meal, index) => (
                        <div key={index}>
                          <h3 className="font-medium">Bandeja {index + 1}</h3>
                          <pre className="whitespace-pre-wrap">{getMealDetailsDisplay(meal)}</pre>
                        </div>
                      ))
                    )}
                    <p className="font-medium">Total: ${showMealDetails.total?.toLocaleString('es-CO') || '0'}</p>
                    <p className="font-medium">Estado: {showMealDetails.status || 'Pendiente'}</p>
                    <p className="font-medium">Domiciliario: {showMealDetails.deliveryPerson || 'Sin asignar'}</p>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Diálogo para editar pedido */}
      <Transition show={editingOrder !== null} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setEditingOrder(null)}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={classNames(
                "w-full max-w-2xl p-6 rounded-lg shadow-xl max-h-[80vh] overflow-y-auto",
                theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-900'
              )}>
                <Dialog.Title className="text-lg font-medium mb-4 flex justify-between items-center">
                  Editar Pedido
                  <button
                    onClick={() => setEditingOrder(null)}
                    className="text-gray-500 hover:text-gray-400"
                    aria-label="Cerrar edición"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </Dialog.Title>
                {editForm.meals.map((meal, mealIndex) => (
                  <div key={mealIndex} className="mb-6 p-4 border rounded-md border-gray-200 dark:border-gray-600">
                    <h3 className="font-medium mb-2">Bandeja {mealIndex + 1}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sopa</label>
                        <input
                          type="text"
                          value={meal.soup?.name || meal.soup || ''}
                          onChange={e => handleMealFormFieldChange(mealIndex, 'soup', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reemplazo de Sopa</label>
                        <input
                          type="text"
                          value={meal.soupReplacement?.name || meal.soupReplacement || ''}
                          onChange={e => handleMealFormFieldChange(mealIndex, 'soupReplacement', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Principio</label>
                        <input
                          type="text"
                          value={Array.isArray(meal.principle) ? meal.principle.map(p => p.name || p).join(', ') : meal.principle?.name || meal.principle || ''}
                          onChange={e => handleMealFormFieldChange(mealIndex, 'principle', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reemplazo de Principio</label>
                        <input
                          type="text"
                          value={meal.principleReplacement?.name || meal.principleReplacement || ''}
                          onChange={e => handleMealFormFieldChange(mealIndex, 'principleReplacement', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proteína</label>
                        <input
                          type="text"
                          value={meal.protein?.name || meal.protein || ''}
                          onChange={e => handleMealFormFieldChange(mealIndex, 'protein', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bebida</label>
                        <input
                          type="text"
                          value={meal.drink?.name || meal.drink || ''}
                          onChange={e => handleMealFormFieldChange(mealIndex, 'drink', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cubiertos</label>
                        <input
                          type="text"
                          value={meal.cutlery?.name || meal.cutlery || ''}
                          onChange={e => handleMealFormFieldChange(mealIndex, 'cutlery', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Acompañamientos</label>
                        <input
                          type="text"
                          value={meal.sides?.map(s => s.name || s).join(', ') || ''}
                          onChange={e => handleMealFormFieldChange(mealIndex, 'sides', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adiciones</label>
                        <input
                          type="text"
                          value={meal.additions?.map(a => `${a.name}${a.protein || a.replacement ? `,${a.protein || a.replacement}` : ''}${a.quantity ? `,${a.quantity}` : ''}`).join('; ') || ''}
                          onChange={e => handleMealFormFieldChange(mealIndex, 'additions', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas</label>
                        <input
                          type="text"
                          value={meal.notes || ''}
                          onChange={e => handleMealFormFieldChange(mealIndex, 'notes', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hora de Entrega</label>
                        <input
                          type="text"
                          value={meal.time?.name || meal.time || ''}
                          onChange={e => handleMealFormFieldChange(mealIndex, 'time', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dirección</label>
                        <input
                          type="text"
                          value={meal.address?.address || ''}
                          onChange={e => handleMealFormFieldChange(mealIndex, 'address.address', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
                        <input
                          type="text"
                          value={meal.address?.phoneNumber || ''}
                          onChange={e => handleMealFormFieldChange(mealIndex, 'address.phoneNumber', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Dirección</label>
                        <select
                          value={meal.address?.addressType || ''}
                          onChange={e => handleMealFormFieldChange(mealIndex, 'address.addressType', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        >
                          <option value="">Seleccione</option>
                          <option value="house">Casa/Apto</option>
                          <option value="school">Colegio/Oficina</option>
                          <option value="complex">Conjunto</option>
                          <option value="shop">Tienda/Local</option>
                        </select>
                      </div>
                      {meal.address?.addressType === 'shop' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Local</label>
                          <input
                            type="text"
                            value={meal.address?.localName || ''}
                            onChange={e => handleMealFormFieldChange(mealIndex, 'address.localName', e.target.value)}
                            className={classNames(
                              "w-full p-2 rounded-md border text-sm",
                              theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                              "focus:outline-none focus:ring-1 focus:ring-blue-500"
                            )}
                          />
                        </div>
                      )}
                      {meal.address?.addressType === 'school' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Recipiente</label>
                          <input
                            type="text"
                            value={meal.address?.recipientName || ''}
                            onChange={e => handleMealFormFieldChange(mealIndex, 'address.recipientName', e.target.value)}
                            className={classNames(
                              "w-full p-2 rounded-md border text-sm",
                              theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                              "focus:outline-none focus:ring-1 focus:ring-blue-500"
                            )}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {/* Campos de la orden principal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total</label>
                    <input
                      type="number"
                      value={editForm.total}
                      onChange={e => setEditForm(prev => ({ ...prev, total: Number(e.target.value) }))}
                      className={classNames(
                        "w-full p-2 rounded-md border text-sm",
                        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                        "focus:outline-none focus:ring-1 focus:ring-blue-500"
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado</label>
                    <select
                      value={editForm.status}
                      onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                      className={classNames(
                        "w-full p-2 rounded-md border text-sm",
                        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                        "focus:outline-none focus:ring-1 focus:ring-blue-500"
                      )}
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="En Preparación">En Preparación</option>
                      <option value="En Camino">En Camino</option>
                      <option value="Entregado">Entregado</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Método de Pago</label>
                    <select
                      value={editForm.payment}
                      onChange={e => setEditForm(prev => ({ ...prev, payment: e.target.value }))}
                      className={classNames(
                        "w-full p-2 rounded-md border text-sm",
                        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                        "focus:outline-none focus:ring-1 focus:ring-blue-500"
                      )}
                    >
                      <option value="Efectivo">Efectivo</option>
                      <option value="Daviplata">Daviplata</option>
                      <option value="Nequi">Nequi</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Domiciliario</label>
                    <input
                      type="text"
                      value={editForm.deliveryPerson}
                      onChange={e => setEditForm(prev => ({ ...prev, deliveryPerson: e.target.value }))}
                      className={classNames(
                        "w-full p-2 rounded-md border text-sm",
                        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                        "focus:outline-none focus:ring-1 focus:ring-blue-500"
                      )}
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => setEditingOrder(null)}
                    className={classNames(
                      "px-4 py-2 rounded-md text-sm font-medium",
                      theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    )}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isLoading}
                    className={classNames(
                      "px-4 py-2 rounded-md text-sm font-medium",
                      isLoading ? 'bg-gray-400 cursor-not-allowed' : theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                    )}
                  >
                    {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Diálogo para confirmar eliminación de todos los pedidos */}
      <Transition show={showConfirmDeleteAll} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowConfirmDeleteAll(false)}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={classNames(
                "w-full max-w-sm p-6 rounded-lg shadow-md text-center",
                theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-900'
              )}>
                <Dialog.Title className="text-lg font-medium mb-4">Confirmar Eliminación Masiva</Dialog.Title>
                <p className="mb-4">
                  Estás a punto de eliminar <span className="font-bold text-red-500">TODOS</span> los pedidos.
                  Esta acción es irreversible. Para confirmar, escribe "confirmar" a continuación:
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  className={classNames(
                    "w-full p-2 rounded-md border text-center text-sm",
                    theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                    "focus:outline-none focus:ring-1 focus:ring-red-500"
                  )}
                  placeholder="escribe 'confirmar'"
                />
                <div className="mt-6 flex justify-center gap-2">
                  <button
                    onClick={() => { setShowConfirmDeleteAll(false); setConfirmText(''); }}
                    className={classNames(
                      "px-4 py-2 rounded-md text-sm font-medium",
                      theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    )}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteAllOrders}
                    disabled={isLoading || confirmText.toLowerCase() !== 'confirmar'}
                    className={classNames(
                      "px-4 py-2 rounded-md text-sm font-medium",
                      isLoading || confirmText.toLowerCase() !== 'confirmar' ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'
                    )}
                  >
                    {isLoading ? 'Eliminando...' : 'Eliminar Todos'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* NUEVO: Diálogo para Generar Nueva Orden */}
      <Transition show={showAddOrderModal} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowAddOrderModal(false)}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={classNames(
                "w-full max-w-2xl p-6 rounded-lg shadow-xl max-h-[80vh] overflow-y-auto",
                theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-900'
              )}>
                <Dialog.Title className="text-lg font-medium mb-4 flex justify-between items-center">
                  Generar Nueva Orden
                  <button
                    onClick={() => setShowAddOrderModal(false)}
                    className="text-gray-500 hover:text-gray-400"
                    aria-label="Cerrar formulario de nueva orden"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </Dialog.Title>
                {/* Formulario de una sola bandeja para simplificar */}
                {newOrderForm.meals.map((meal, mealIndex) => (
                  <div key={mealIndex} className="mb-6 p-4 border rounded-md border-gray-200 dark:border-gray-600">
                    <h3 className="font-medium mb-2">Detalles de la Bandeja {mealIndex + 1}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sopa</label>
                        <input
                          type="text"
                          value={meal.soup || ''}
                          onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'soup', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reemplazo Sopa</label>
                        <input
                          type="text"
                          value={meal.soupReplacement || ''}
                          onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'soupReplacement', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Principio</label>
                        <input
                          type="text"
                          value={Array.isArray(meal.principle) ? meal.principle.map(p => p.name || p).join(', ') : meal.principle || ''}
                          onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'principle', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reemplazo Principio</label>
                        <input
                          type="text"
                          value={meal.principleReplacement || ''}
                          onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'principleReplacement', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proteína</label>
                        <input
                          type="text"
                          value={meal.protein || ''}
                          onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'protein', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bebida</label>
                        <input
                          type="text"
                          value={meal.drink || ''}
                          onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'drink', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cubiertos</label>
                        <input
                          type="text"
                          value={meal.cutlery || ''}
                          onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'cutlery', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Acompañamientos (separados por coma)</label>
                        <input
                          type="text"
                          value={meal.sides?.map(s => s.name || s).join(', ') || ''}
                          onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'sides', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adiciones (Nombre,Tipo,Cantidad;...)</label>
                        <input
                          type="text"
                          value={meal.additions?.map(a => `${a.name}${a.protein || a.replacement ? `,${a.protein || a.replacement}` : ''}${a.quantity ? `,${a.quantity}` : ''}`).join('; ') || ''}
                          onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'additions', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas</label>
                        <input
                          type="text"
                          value={meal.notes || ''}
                          onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'notes', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hora de Entrega</label>
                        <input
                          type="text"
                          value={meal.time || ''}
                          onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'time', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dirección</label>
                        <input
                          type="text"
                          value={meal.address?.address || ''}
                          onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'address.address', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
                        <input
                          type="text"
                          value={meal.address?.phoneNumber || ''}
                          onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'address.phoneNumber', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Dirección</label>
                        <select
                          value={meal.address?.addressType || ''}
                          onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'address.addressType', e.target.value)}
                          className={classNames(
                            "w-full p-2 rounded-md border text-sm",
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            "focus:outline-none focus:ring-1 focus:ring-blue-500"
                          )}
                        >
                          <option value="">Seleccione</option>
                          <option value="house">Casa/Apto</option>
                          <option value="school">Colegio/Oficina</option>
                          <option value="complex">Conjunto</option>
                          <option value="shop">Tienda/Local</option>
                        </select>
                      </div>
                      {meal.address?.addressType === 'shop' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Local</label>
                          <input
                            type="text"
                            value={meal.address?.localName || ''}
                            onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'address.localName', e.target.value)}
                            className={classNames(
                              "w-full p-2 rounded-md border text-sm",
                              theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                              "focus:outline-none focus:ring-1 focus:ring-blue-500"
                            )}
                          />
                        </div>
                      )}
                      {meal.address?.addressType === 'school' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Recipiente</label>
                          <input
                            type="text"
                            value={meal.address?.recipientName || ''}
                            onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'address.recipientName', e.target.value)}
                            className={classNames(
                              "w-full p-2 rounded-md border text-sm",
                              theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                              "focus:outline-none focus:ring-1 focus:ring-blue-500"
                            )}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {/* Campos de la orden principal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total</label>
                    <input
                      type="number"
                      value={newOrderForm.total}
                      onChange={e => setNewOrderForm(prev => ({ ...prev, total: Number(e.target.value) }))}
                      className={classNames(
                        "w-full p-2 rounded-md border text-sm",
                        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                        "focus:outline-none focus:ring-1 focus:ring-blue-500"
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado</label>
                    <select
                      value={newOrderForm.status}
                      onChange={e => setNewOrderForm(prev => ({ ...prev, status: e.target.value }))}
                      className={classNames(
                        "w-full p-2 rounded-md border text-sm",
                        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                        "focus:outline-none focus:ring-1 focus:ring-blue-500"
                      )}
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="En Preparación">En Preparación</option>
                      <option value="En Camino">En Camino</option>
                      <option value="Entregado">Entregado</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Método de Pago</label>
                    <select
                      value={newOrderForm.payment}
                      onChange={e => setNewOrderForm(prev => ({ ...prev, payment: e.target.value }))}
                      className={classNames(
                        "w-full p-2 rounded-md border text-sm",
                        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                        "focus:outline-none focus:ring-1 focus:ring-blue-500"
                      )}
                    >
                      <option value="Efectivo">Efectivo</option>
                      <option value="Daviplata">Daviplata</option>
                      <option value="Nequi">Nequi</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Domiciliario</label>
                    <input
                      type="text"
                      value={newOrderForm.deliveryPerson}
                      onChange={e => setNewOrderForm(prev => ({ ...prev, deliveryPerson: e.target.value }))}
                      className={classNames(
                        "w-full p-2 rounded-md border text-sm",
                        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                        "focus:outline-none focus:ring-1 focus:ring-blue-500"
                      )}
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddOrderModal(false)}
                    className={classNames(
                      "px-4 py-2 rounded-md text-sm font-medium",
                      theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    )}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddOrderSubmit}
                    disabled={isLoading}
                    className={classNames(
                      "px-4 py-2 rounded-md text-sm font-medium",
                      isLoading ? 'bg-gray-400 cursor-not-allowed' : theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                    )}
                  >
                    {isLoading ? 'Guardando...' : 'Generar Orden'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default InteraccionesPedidos;
