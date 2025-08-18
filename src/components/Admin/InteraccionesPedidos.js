// src/components/Admin/InteraccionesPedidos.js
import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import { classNames } from '../../utils/classNames';
import OrderSummary from '../OrderSummary';
import BreakfastOrderSummary from '../BreakfastOrderSummary';
import { db } from '../../config/firebase';
import { deleteDoc, doc, updateDoc, onSnapshot, collection } from 'firebase/firestore';
import OptionSelector from '../OptionSelector';
import { calculateTotal } from '../../utils/MealCalculations';
import { calculateBreakfastPrice } from '../../utils/BreakfastCalculations';


// ===================== Helpers para hidratación =====================
const normalizeName = (s) => (s || '').replace(/\s*NUEVO\s*$/i, '').trim();

const byName = (list, value) => {
  if (!value) return null;
  const name = typeof value === 'string' ? value : value?.name;
  return list.find((o) => normalizeName(o.name) === normalizeName(name)) || null;
};

const manyByName = (list, arr) => (Array.isArray(arr) ? arr.map((v) => byName(list, v)).filter(Boolean) : []);

const ensureAddress = (addr = {}, fallback = {}) => ({
  address: addr.address ?? fallback.address ?? '',
  phoneNumber: addr.phoneNumber ?? fallback.phoneNumber ?? '',
  addressType: addr.addressType ?? fallback.addressType ?? '',
  localName: addr.localName ?? fallback.localName ?? '',
  unitDetails: addr.unitDetails ?? fallback.unitDetails ?? '',
  recipientName: addr.recipientName ?? fallback.recipientName ?? '',
});

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
  handleMealFormFieldChange,
  handleEditFormFieldChange,
  handleSaveEdit,
  showConfirmDeleteAll,
  setShowConfirmDeleteAll,
  confirmText,
  setConfirmText,
  handleDeleteAllOrders,
  setError,
  setSuccess,
  showAddOrderModal,
  setShowAddOrderModal,
  newOrderForm,
  handleNewOrderMealFormFieldChange,
  handleNewOrderFieldChange,
  handleAddOrderSubmit,
  uniqueDeliveryPersons,
}) => {
  const [soups, setSoups] = useState([]);
  const [soupReplacements, setSoupReplacements] = useState([]);
  const [principles, setPrinciples] = useState([]);
  const [menuProteins, setMenuProteins] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [sides, setSides] = useState([]);
  const [additions, setAdditions] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  const [breakfastEggs, setBreakfastEggs] = useState([]);
  const [breakfastBroths, setBreakfastBroths] = useState([]);
  const [breakfastRiceBread, setBreakfastRiceBread] = useState([]);
  const [breakfastDrinks, setBreakfastDrinks] = useState([]);
  const [breakfastAdditions, setBreakfastAdditions] = useState([]);
  const [breakfastTypes, setBreakfastTypes] = useState([]);
  const [breakfastProteins, setBreakfastProteins] = useState([]);

  // NUEVO: estado usado por el modal de proteínas
  const [editingProtein, setEditingProtein] = useState(null);

  // ===================== Carga de catálogos =====================
  useEffect(() => {
    const mapSetter = {
      soups: setSoups,
      soupReplacements: setSoupReplacements,
      principles: setPrinciples,
      proteins: setMenuProteins,
      drinks: setDrinks,
      sides: setSides,
      additions: setAdditions,
      paymentMethods: setPaymentMethods,
      breakfastEggs: setBreakfastEggs,
      breakfastBroths: setBreakfastBroths,
      breakfastRiceBread: setBreakfastRiceBread,
      breakfastDrinks: setBreakfastDrinks,
      breakfastAdditions: setBreakfastAdditions,
      breakfastTypes: setBreakfastTypes,
      breakfastProteins: setBreakfastProteins,
    };

    const listen = (name) =>
      onSnapshot(collection(db, name), (snap) => mapSetter[name](snap.docs.map((d) => ({ id: d.id, ...d.data() }))));

    const unsubs = [
      listen('soups'),
      listen('soupReplacements'),
      listen('principles'),
      listen('proteins'),
      listen('drinks'),
      listen('sides'),
      listen('additions'),
      listen('paymentMethods'),
      listen('breakfastEggs'),
      listen('breakfastBroths'),
      listen('breakfastRiceBread'),
      listen('breakfastDrinks'),
      listen('breakfastAdditions'),
      listen('breakfastTypes'),
      listen('breakfastProteins'),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, []);

  // ===================== Editar Breakfast (setter anidado) =====================
  const handleBreakfastFormFieldChange = (index, field, value) => {
    const list = Array.isArray(editForm.breakfasts) ? [...editForm.breakfasts] : [];
    if (!list[index]) list[index] = {};
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      list[index] = { ...list[index], [parent]: { ...(list[index][parent] || {}), [child]: value } };
    } else {
      list[index] = { ...list[index], [field]: value };
    }
    handleEditFormFieldChange('breakfasts', list);
  };

  // Passthrough inmediato para OptionSelector de desayuno
  const handleBreakfastImmediate = (idx, field, value) => {
    handleBreakfastFormFieldChange(idx, field, value);
  };

  // ===================== Hidratación segura del formulario =====================
  const hydratedOrderIdRef = React.useRef(null);

  // Reset de bandera cuando cierras/abres otra orden
  useEffect(() => {
    if (!editingOrder) hydratedOrderIdRef.current = null;
  }, [editingOrder]);

  useEffect(() => {
    if (!editingOrder) return;

    const catalogsLoaded =
      soups.length ||
      principles.length ||
      menuProteins.length ||
      drinks.length ||
      sides.length ||
      additions.length ||
      breakfastTypes.length ||
      breakfastBroths.length ||
      breakfastEggs.length ||
      breakfastRiceBread.length ||
      breakfastDrinks.length ||
      breakfastAdditions.length ||
      breakfastProteins.length;

    if (!catalogsLoaded) return;

    if (hydratedOrderIdRef.current === editingOrder.id) return; // evita rehidrataciones

    const fallbackAddress = editingOrder.address || {};

    // Total preferimos recalcular solo para almuerzos; para desayuno respetamos total existente
    const computedTotal =
      typeof editingOrder.total === 'number'
        ? editingOrder.total
        : editingOrder.type === 'breakfast'
        ? editingOrder.total || 0
        : Array.isArray(editingOrder.meals)
        ? Number(calculateTotal(editingOrder.meals) || 0)
        : 0;

    handleEditFormFieldChange('total', computedTotal);
    handleEditFormFieldChange('payment', editingOrder.payment || '');
    handleEditFormFieldChange('status', editingOrder.status || 'Pendiente');
    handleEditFormFieldChange('deliveryPerson', editingOrder.deliveryPerson || '');

    if (editingOrder.type === 'breakfast') {
      const breakfasts = (editingOrder.breakfasts || []).map((b) => ({
        type: byName(breakfastTypes, b.type),
        broth: byName(breakfastBroths, b.broth),
        eggs: byName(breakfastEggs, b.eggs),
        riceBread: byName(breakfastRiceBread, b.riceBread),
        drink: byName(breakfastDrinks, b.drink),
        protein: byName(breakfastProteins, b.protein),
        additions: Array.isArray(b.additions)
          ? b.additions
              .map((a) => {
                const full = byName(breakfastAdditions, a);
                return full ? { ...full, quantity: a.quantity || 1 } : null;
              })
              .filter(Boolean)
          : [],
        cutlery: !!b.cutlery,
        time: typeof b.time === 'string' ? b.time : b.time?.name || '',
        address: ensureAddress(b.address, fallbackAddress),
        notes: b.notes || '',
      }));
      handleEditFormFieldChange('breakfasts', breakfasts);
    } else {
      const meals = (editingOrder.meals || []).map((m) => ({
        soup: byName(soups, m.soup),
        soupReplacement:
          typeof m.soupReplacement === 'string' ? m.soupReplacement : m.soupReplacement?.replacement || '',
        principle: Array.isArray(m.principle) ? m.principle.map((p) => byName(principles, p)).filter(Boolean) : [],
        principleReplacement:
          typeof m.principleReplacement === 'string'
            ? m.principleReplacement
            : m.principleReplacement?.replacement || '',
        protein: byName(menuProteins, m.protein),
        drink: byName(drinks, m.drink),
        sides: manyByName(sides, m.sides),
        additions: Array.isArray(m.additions)
          ? m.additions
              .map((a) => {
                const full = byName(additions, a);
                return full ? { ...full, quantity: a.quantity || 1, price: a.price ?? full.price ?? 0 } : null;
              })
              .filter(Boolean)
          : [],
        cutlery: !!m.cutlery,
        time: typeof m.time === 'string' ? m.time : m.time?.name || '',
        address: ensureAddress(m.address, fallbackAddress),
        notes: m.notes || '',
      }));
      handleEditFormFieldChange('meals', meals);
    }

    hydratedOrderIdRef.current = editingOrder.id;
  }, [
    editingOrder,
    soups,
    principles,
    menuProteins,
    drinks,
    sides,
    additions,
    breakfastTypes,
    breakfastBroths,
    breakfastEggs,
    breakfastRiceBread,
    breakfastDrinks,
    breakfastAdditions,
    breakfastProteins,
    handleEditFormFieldChange,
  ]);

  // Recalcular total en edición cuando cambian meals (solo almuerzo)
  useEffect(() => {
    if (!editingOrder || editingOrder.type === 'breakfast') return;
    const computed = Number(calculateTotal(editForm.meals || [])) || 0;
    if (computed !== (editForm.total || 0)) {
      handleEditFormFieldChange('total', computed);
    }
  }, [editingOrder, editForm.meals, handleEditFormFieldChange, calculateTotal]);

  // Soporta lunch (meals) y breakfast (breakfasts)
  const mealsForDetails = Array.isArray(showMealDetails?.meals)
    ? showMealDetails.meals
    : Array.isArray(showMealDetails?.breakfasts)
    ? showMealDetails.breakfasts
    : [];

    // Recalcular total en edición cuando cambian breakfasts (solo desayunos)
useEffect(() => {
  if (!editingOrder || editingOrder.type !== 'breakfast') return;
  const list = editForm.breakfasts || [];
  const computed = list.reduce(
    (sum, b) => sum + Number(calculateBreakfastPrice(b, 3, breakfastTypes) || 0),
    0
  );
  if (computed !== (editForm.total || 0)) {
    handleEditFormFieldChange('total', computed);
  }
}, [editingOrder, editForm.breakfasts, breakfastTypes, handleEditFormFieldChange]);


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

  const handleCancelEditProtein = () => {
    setEditingProtein(null);
  };

  return (
    <div>
      {/* Diálogo para gestionar proteínas */}
      <Transition show={showProteinModal} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => { setShowProteinModal(false); setEditingProtein(null); }}>
          <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel
                className={
                  classNames(
                    'w-full max-w-md p-6 rounded-lg shadow-md',
                    theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-900'
                  )
                }
              >
                <div className="flex justify-between items-center mb-4">
                  <Dialog.Title className="text-lg font-medium">{editingProtein ? 'Editar Proteína' : 'Gestionar Proteínas'}</Dialog.Title>
                  <button onClick={() => { setShowProteinModal(false); setEditingProtein(null); }} className="text-gray-500 hover:text-gray-400" aria-label="Cerrar modal">
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
                          onChange={(e) => setEditingProtein({ ...editingProtein, name: e.target.value })}
                          className={classNames(
                            'w-full p-2 rounded-md border text-sm',
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            'focus:outline-none focus:ring-1 focus:ring-blue-500'
                          )}
                          placeholder="Ej: Pollo"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad</label>
                        <input
                          type="number"
                          value={editingProtein.quantity}
                          onChange={(e) => setEditingProtein({ ...editingProtein, quantity: e.target.value })}
                          className={classNames(
                            'w-full p-2 rounded-md border text-sm',
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            'focus:outline-none focus:ring-1 focus:ring-blue-500'
                          )}
                          placeholder="Ej: 50"
                          min="0"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={handleCancelEditProtein} className={classNames('px-4 py-2 rounded-md text-sm font-medium', theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900')}>Cancelar</button>
                        <button onClick={handleUpdateProtein} disabled={isLoading} className={classNames('px-4 py-2 rounded-md text-sm font-medium', isLoading ? 'bg-gray-400 cursor-not-allowed' : theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white')}>
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
                          onChange={(e) => setNewProtein({ ...newProtein, name: e.target.value })}
                          className={classNames(
                            'w-full p-2 rounded-md border text-sm',
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            'focus:outline-none focus:ring-1 focus:ring-blue-500'
                          )}
                          placeholder="Ej: Pollo"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad</label>
                        <input
                          type="number"
                          value={newProtein.quantity}
                          onChange={(e) => setNewProtein({ ...newProtein, quantity: e.target.value })}
                          className={classNames(
                            'w-full p-2 rounded-md border text-sm',
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            'focus:outline-none focus:ring-1 focus:ring-blue-500'
                          )}
                          placeholder="Ej: 50"
                          min="0"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setShowProteinModal(false)} className={classNames('px-4 py-2 rounded-md text-sm font-medium', theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900')}>Cancelar</button>
                        <button onClick={handleAddProtein} disabled={isLoading} className={classNames('px-4 py-2 rounded-md text-sm font-medium', isLoading ? 'bg-gray-400 cursor-not-allowed' : theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white')}>
                          {isLoading ? 'Guardando...' : 'Agregar'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Proteínas Registradas (Total: {totalProteinUnits} unidades)
                  </h3>
                  {proteins.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No hay proteínas registradas.</p>
                  ) : (
                    <ul className="space-y-2">
                      {proteins.map((protein) => (
                        <li key={protein.id} className={classNames('flex justify-between items-center p-2 rounded-md', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
                          <span className="text-sm">
                            {protein.name}: {protein.quantity} unidades
                          </span>
                          <div className="flex gap-2">
                            <button onClick={() => handleEditProtein(protein)} className="text-blue-500 hover:text-blue-400 transition-colors duration-150 p-1 rounded-md" title="Editar proteína" aria-label={`Editar ${protein.name}`}>
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteProtein(protein.id)} className="text-red-500 hover:text-red-400 transition-colors duration-150 p-1 rounded-md" title="Eliminar proteína" aria-label={`Eliminar ${protein.name}`}>
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
          <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className={classNames('w-full max-w-2xl p-6 rounded-lg shadow-xl max-h-[80vh] overflow-y-auto', theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-900')}>
                <Dialog.Title className="text-lg font-medium mb-4 flex justify-between items-center">
                  Detalles del Pedido
                  <button onClick={() => setShowMealDetails(null)} className="text-gray-500 hover:text-gray-400" aria-label="Cerrar detalles">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </Dialog.Title>
                {showMealDetails && (
                  <>
                    {showMealDetails?.type === 'breakfast' ? (
                      <BreakfastOrderSummary items={showMealDetails.breakfasts || mealsForDetails} user={{ role: 3 }} statusClass="bg-white" showSaveButton={false} />
                    ) : (
                      <OrderSummary meals={mealsForDetails} isTableOrder={false} isWaiterView={true} statusClass="bg-white" />
                    )}
                    <div className="mt-3 text-xs sm:text-sm">
                      <p className="font-medium">Estado: {showMealDetails.status || 'Pendiente'}</p>
                      <p className="font-medium">Domiciliario: {showMealDetails.deliveryPerson || 'Sin asignar'}</p>
                 {showMealDetails?.type === 'breakfast' ? (
  <p className="font-medium">
    Total del pedido: ${
      ((showMealDetails.breakfasts || []).reduce(
        (sum, b) => sum + Number(calculateBreakfastPrice(b, 3, breakfastTypes) || 0),
        0
      )).toLocaleString('es-CO')
    }
  </p>
) : (
  typeof showMealDetails.total === 'number' && (
 <p className="font-medium">
  Total del pedido: ${
    (
      Array.isArray(showMealDetails?.meals)
        ? Number(calculateTotal(showMealDetails.meals) || 0)
        : Number(showMealDetails?.total || 0)
    ).toLocaleString('es-CO')
  }
</p>

  )
)}

                    </div>
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Diálogo para editar pedido */}
      <Transition show={editingOrder !== null} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setEditingOrder(null)}>
          <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className={classNames('w-full max-w-2xl p-6 rounded-lg shadow-xl max-h-[80vh] overflow-y-auto', theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-900')}>
                <Dialog.Title className="text-lg font-medium mb-4 flex justify-between items-center">
                  Editar Pedido
                  <button onClick={() => setEditingOrder(null)} className="text-gray-500 hover:text-gray-400" aria-label="Cerrar edición">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </Dialog.Title>
                {(() => {
                  const editItems = editingOrder?.type === 'breakfast' ? editForm.breakfasts || [] : editForm.meals || [];

                  return editItems.map((row, idx) => (
                    <div key={idx} className="mb-6 p-4 border rounded-md border-gray-200 dark:border-gray-600">
                      <h3 className="font-medium mb-2">{editingOrder?.type === 'breakfast' ? `Desayuno ${idx + 1}` : `Bandeja ${idx + 1}`}</h3>

                      {editingOrder?.type === 'breakfast' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Tipo</label>
                            <OptionSelector title="Tipo" emoji="🥞" options={breakfastTypes} selected={row.type || null} multiple={false} onImmediateSelect={(v) => handleBreakfastImmediate(idx, 'type', v)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Caldo</label>
                            <OptionSelector title="Caldo" emoji="🥣" options={breakfastBroths} selected={row.broth || null} multiple={false} onImmediateSelect={(v) => handleBreakfastImmediate(idx, 'broth', v)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Huevos</label>
                            <OptionSelector title="Huevos" emoji="🥚" options={breakfastEggs} selected={row.eggs || null} multiple={false} onImmediateSelect={(v) => handleBreakfastImmediate(idx, 'eggs', v)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Arroz/Pan</label>
                            <OptionSelector title="Arroz/Pan" emoji="🍞" options={breakfastRiceBread} selected={row.riceBread || null} multiple={false} onImmediateSelect={(v) => handleBreakfastImmediate(idx, 'riceBread', v)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Bebida</label>
                            <OptionSelector title="Bebida" emoji="🥤" options={breakfastDrinks} selected={row.drink || null} multiple={false} onImmediateSelect={(v) => handleBreakfastImmediate(idx, 'drink', v)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Proteína</label>
                            <OptionSelector title="Proteína" emoji="🍖" options={breakfastProteins} selected={row.protein || null} multiple={false} onImmediateSelect={(v) => handleBreakfastImmediate(idx, 'protein', v)} />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">Adiciones</label>
                            <OptionSelector
                              title="Adiciones"
                              emoji="➕"
                              options={breakfastAdditions}
                              selected={row.additions || []}
                              multiple={true}
                              onImmediateSelect={(sel) => handleBreakfastImmediate(idx, 'additions', sel.map((a) => ({ name: a.name, quantity: a.quantity || 1 })))}
                            />
                          </div>

                          {/* Operativos desayuno */}
                          <div>
                            <label className="block text-sm font-medium mb-1">Cubiertos</label>
                            <input type="checkbox" checked={!!row.cutlery} onChange={(e) => handleBreakfastFormFieldChange(idx, 'cutlery', e.target.checked)} className="h-4 w-4" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Hora de Entrega</label>
                            <input
                              type="text"
                              value={typeof row.time === 'string' ? row.time : row.time?.name || ''}
                              onChange={(e) => handleBreakfastFormFieldChange(idx, 'time', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">Dirección</label>
                            <input
                              type="text"
                              value={row.address?.address || ''}
                              onChange={(e) => handleBreakfastFormFieldChange(idx, 'address.address', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Teléfono</label>
                            <input
                              type="text"
                              value={row.address?.phoneNumber || ''}
                              onChange={(e) => handleBreakfastFormFieldChange(idx, 'address.phoneNumber', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Tipo de Dirección</label>
                            <select
                              value={row.address?.addressType || ''}
                              onChange={(e) => handleBreakfastFormFieldChange(idx, 'address.addressType', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            >
                              <option value="">Seleccione</option>
                              <option value="house">Casa/Apto</option>
                              <option value="school">Colegio/Oficina</option>
                              <option value="complex">Conjunto</option>
                              <option value="shop">Tienda/Local</option>
                            </select>
                          </div>
                          {row.address?.addressType === 'shop' && (
                            <div>
                              <label className="block text-sm font-medium mb-1">Nombre del Local</label>
                              <input
                                type="text"
                                value={row.address?.localName || ''}
                                onChange={(e) => handleBreakfastFormFieldChange(idx, 'address.localName', e.target.value)}
                                className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                              />
                            </div>
                          )}
                          {row.address?.addressType === 'school' && (
                            <div>
                              <label className="block text-sm font-medium mb-1">Nombre del destinatario</label>
                              <input
                                type="text"
                                value={row.address?.recipientName || ''}
                                onChange={(e) => handleBreakfastFormFieldChange(idx, 'address.recipientName', e.target.value)}
                                className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                              />
                            </div>
                          )}
                          {row.address?.addressType === 'complex' && (
                            <div>
                              <label className="block text-sm font-medium mb-1">Detalles (Torre/Apto)</label>
                              <input
                                type="text"
                                value={row.address?.unitDetails || ''}
                                onChange={(e) => handleBreakfastFormFieldChange(idx, 'address.unitDetails', e.target.value)}
                                className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                              />
                            </div>
                          )}
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">Notas</label>
                            <input
                              type="text"
                              value={row.notes || ''}
                              onChange={(e) => handleBreakfastFormFieldChange(idx, 'notes', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Sopa o reemplazo</label>
                            <OptionSelector title="Sopa" emoji="🥣" options={soups} selected={row.soup || null} multiple={false} onImmediateSelect={(v) => handleMealFormFieldChange(idx, 'soup', v)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Principio</label>
                            <OptionSelector
                              title="Principio"
                              emoji="🍚"
                              options={principles}
                              selected={row.principle || []}
                              multiple={true}
                              showConfirmButton={true}
                              onImmediateSelect={(selection) => handleMealFormFieldChange(idx, 'principle', selection)}
                              onConfirm={({ selection }) => handleMealFormFieldChange(idx, 'principle', selection)}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Proteína</label>
                            <OptionSelector title="Proteína" emoji="🍖" options={menuProteins} selected={row.protein || null} multiple={false} onImmediateSelect={(v) => handleMealFormFieldChange(idx, 'protein', v)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Bebida</label>
                            <OptionSelector title="Bebida" emoji="🥤" options={drinks} selected={row.drink || null} multiple={false} onImmediateSelect={(v) => handleMealFormFieldChange(idx, 'drink', v)} />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">Acompañamientos</label>
                            <OptionSelector title="Acompañamientos" emoji="🥗" options={sides} selected={row.sides || []} multiple={true} onImmediateSelect={(selection) => handleMealFormFieldChange(idx, 'sides', selection)} />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">Adiciones</label>
                            <OptionSelector
                              title="Adiciones"
                              emoji="➕"
                              options={additions}
                              selected={row.additions || []}
                              multiple={true}
                              onImmediateSelect={(sel) =>
                                handleMealFormFieldChange(
                                  idx,
                                  'additions',
                                  sel.map((a) => ({
                                    id: a.id,
                                    name: a.name,
                                    price: a.price || 0,
                                    protein: a.protein || '',
                                    replacement: a.replacement || '',
                                    quantity: a.quantity || 1,
                                  }))
                                )
                              }
                            />
                          </div>

                          {/* Operativos almuerzo */}
                          <div>
                            <label className="block text-sm font-medium mb-1">Cubiertos</label>
                            <input type="checkbox" checked={!!row.cutlery} onChange={(e) => handleMealFormFieldChange(idx, 'cutlery', e.target.checked)} className="h-4 w-4" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Hora de Entrega</label>
                            <input
                              type="text"
                              value={typeof row.time === 'string' ? row.time : row.time?.name || ''}
                              onChange={(e) => handleMealFormFieldChange(idx, 'time', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">Dirección</label>
                            <input
                              type="text"
                              value={row.address?.address || ''}
                              onChange={(e) => handleMealFormFieldChange(idx, 'address.address', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Teléfono</label>
                            <input
                              type="text"
                              value={row.address?.phoneNumber || ''}
                              onChange={(e) => handleMealFormFieldChange(idx, 'address.phoneNumber', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Tipo de Dirección</label>
                            <select
                              value={row.address?.addressType || ''}
                              onChange={(e) => handleMealFormFieldChange(idx, 'address.addressType', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            >
                              <option value="">Seleccione</option>
                              <option value="house">Casa/Apto</option>
                              <option value="school">Colegio/Oficina</option>
                              <option value="complex">Conjunto</option>
                              <option value="shop">Tienda/Local</option>
                            </select>
                          </div>
                          {row.address?.addressType === 'shop' && (
                            <div>
                              <label className="block text-sm font-medium mb-1">Nombre del Local</label>
                              <input
                                type="text"
                                value={row.address?.localName || ''}
                                onChange={(e) => handleMealFormFieldChange(idx, 'address.localName', e.target.value)}
                                className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                              />
                            </div>
                          )}
                          {row.address?.addressType === 'school' && (
                            <div>
                              <label className="block text-sm font-medium mb-1">Nombre del destinatario</label>
                              <input
                                type="text"
                                value={row.address?.recipientName || ''}
                                onChange={(e) => handleMealFormFieldChange(idx, 'address.recipientName', e.target.value)}
                                className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                              />
                            </div>
                          )}
                          {row.address?.addressType === 'complex' && (
                            <div>
                              <label className="block text-sm font-medium mb-1">Detalles (Torre/Apto)</label>
                              <input
                                type="text"
                                value={row.address?.unitDetails || ''}
                                onChange={(e) => handleMealFormFieldChange(idx, 'address.unitDetails', e.target.value)}
                                className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                              />
                            </div>
                          )}
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">Notas</label>
                            <input
                              type="text"
                              value={row.notes || ''}
                              onChange={(e) => handleMealFormFieldChange(idx, 'notes', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ));
                })()}

                {/* Campos de la orden principal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total</label>
                    <input
                      type="number"
                      value={editForm.total || 0}
                      onChange={(e) => handleEditFormFieldChange('total', Number(e.target.value))}
                      className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado</label>
                    <select
                      value={editForm.status || 'Pendiente'}
                      onChange={(e) => handleEditFormFieldChange('status', e.target.value)}
                      className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
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
                    <OptionSelector
                      title="Método de Pago"
                      emoji="💳"
                      options={paymentMethods}
                      selected={paymentMethods.find((m) => m.name === editForm.payment) || null}
                      multiple={false}
                      onImmediateSelect={(v) => handleEditFormFieldChange('payment', v?.name || '')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Domiciliario</label>
                    <input
                      type="text"
                      value={editForm.deliveryPerson || 'Sin asignar'}
                      onChange={(e) => handleEditFormFieldChange('deliveryPerson', e.target.value)}
                      className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button onClick={() => setEditingOrder(null)} className={classNames('px-4 py-2 rounded-md text-sm font-medium', theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900')}>
                    Cancelar
                  </button>
                  <button onClick={handleSaveEdit} disabled={isLoading} className={classNames('px-4 py-2 rounded-md text-sm font-medium', isLoading ? 'bg-gray-400 cursor-not-allowed' : theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white')}>
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

      {/* Diálogo para generar nueva orden */}
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
                {newOrderForm.meals.map((meal, mealIndex) => (
                  <div key={mealIndex} className="mb-6 p-4 border rounded-md border-gray-200 dark:border-gray-600">
                    <h3 className="font-medium mb-2">Bandeja {mealIndex + 1}</h3>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div>
    <label className="block text-sm font-medium mb-1">Sopa o reemplazo</label>
    <OptionSelector
      title="Sopa"
      emoji="🥣"
      options={soups}
      selected={typeof meal.soup === 'string' ? soups.find(s => s.name === meal.soup) : meal.soup}
      multiple={false}
      onImmediateSelect={(v) => handleNewOrderMealFormFieldChange(mealIndex, 'soup', v)}
    />
  </div>

  <div>
    <label className="block text-sm font-medium mb-1">Principio</label>
    <OptionSelector
      title="Principio"
      emoji="🍚"
      options={principles}
      selected={Array.isArray(meal.principle) ? meal.principle : []}
      multiple={true}
      showConfirmButton={true}
      onImmediateSelect={(selection) => handleNewOrderMealFormFieldChange(mealIndex, 'principle', selection)}
      onConfirm={({ selection }) => handleNewOrderMealFormFieldChange(mealIndex, 'principle', selection)}
    />
  </div>

  <div>
    <label className="block text-sm font-medium mb-1">Proteína</label>
    <OptionSelector
      title="Proteína"
      emoji="🍖"
      options={menuProteins}
      selected={typeof meal.protein === 'string' ? menuProteins.find(p => p.name === meal.protein) : meal.protein}
      multiple={false}
      onImmediateSelect={(v) => handleNewOrderMealFormFieldChange(mealIndex, 'protein', v)}
    />
  </div>

  <div>
    <label className="block text-sm font-medium mb-1">Bebida</label>
    <OptionSelector
      title="Bebida"
      emoji="🥤"
      options={drinks}
      selected={typeof meal.drink === 'string' ? drinks.find(d => d.name === meal.drink) : meal.drink}
      multiple={false}
      onImmediateSelect={(v) => handleNewOrderMealFormFieldChange(mealIndex, 'drink', v)}
    />
  </div>

  <div className="sm:col-span-2">
    <label className="block text-sm font-medium mb-1">Acompañamientos</label>
    <OptionSelector
      title="Acompañamientos"
      emoji="🥗"
      options={sides}
      selected={Array.isArray(meal.sides) ? meal.sides : []}
      multiple={true}
      onImmediateSelect={(selection) => handleNewOrderMealFormFieldChange(mealIndex, 'sides', selection)}
    />
  </div>

  <div className="sm:col-span-2">
    <label className="block text-sm font-medium mb-1">Adiciones</label>
    <OptionSelector
      title="Adiciones"
      emoji="➕"
      options={additions}
      selected={Array.isArray(meal.additions) ? meal.additions : []}
      multiple={true}
onImmediateSelect={(sel) =>
  handleNewOrderMealFormFieldChange(
    mealIndex,
    'additions',
    sel.map(a => ({
      id: a.id,
      name: a.name,
      price: a.price || 0,
      protein: a.protein || '',
      replacement: a.replacement || '',
      quantity: a.quantity || 1
    }))
  )
}

    />
  </div>

  {/* Campos operativos */}
  <div>
    <label className="block text-sm font-medium mb-1">Cubiertos</label>
    <input
      type="checkbox"
      checked={!!meal.cutlery}
      onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'cutlery', e.target.checked)}
      className="h-4 w-4"
    />
  </div>

  <div>
    <label className="block text-sm font-medium mb-1">Hora de Entrega</label>
    <input
      type="text"
      value={typeof meal.time === 'string' ? meal.time : (meal.time?.name || '')}
      onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'time', e.target.value)}
      className={classNames(
        "w-full p-2 rounded-md border text-sm",
        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
        "focus:outline-none focus:ring-1 focus:ring-blue-500"
      )}
    />
  </div>

  <div className="sm:col-span-2">
    <label className="block text-sm font-medium mb-1">Dirección</label>
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
    <label className="block text-sm font-medium mb-1">Teléfono</label>
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
    <label className="block text-sm font-medium mb-1">Tipo de Dirección</label>
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
      <label className="block text-sm font-medium mb-1">Nombre del Local</label>
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
      <label className="block text-sm font-medium mb-1">Nombre del destinatario</label>
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

  {meal.address?.addressType === 'complex' && (
    <div>
      <label className="block text-sm font-medium mb-1">Detalles (Torre/Apto)</label>
      <input
        type="text"
        value={meal.address?.unitDetails || ''}
        onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'address.unitDetails', e.target.value)}
        className={classNames(
          "w-full p-2 rounded-md border text-sm",
          theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
          "focus:outline-none focus:ring-1 focus:ring-blue-500"
        )}
      />
    </div>
  )}

  <div className="sm:col-span-2">
    <label className="block text-sm font-medium mb-1">Notas</label>
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
</div>


                  </div>
                ))}
                {/* Campos de la orden principal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total</label>
                    <input
                      type="number"
                      value={newOrderForm.total || 0}
                      onChange={e => handleNewOrderFieldChange('total', Number(e.target.value))}
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
                      value={newOrderForm.status || 'Pendiente'}
                      onChange={e => handleNewOrderFieldChange('status', e.target.value)}
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
                      value={newOrderForm.payment || 'Efectivo'}
                      onChange={e => handleNewOrderFieldChange('payment', e.target.value)}
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
                      value={newOrderForm.deliveryPerson || 'Sin asignar'}
                      onChange={e => handleNewOrderFieldChange('deliveryPerson', e.target.value)}
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
                    {isLoading ? 'Guardando...' : 'Crear Orden'}
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