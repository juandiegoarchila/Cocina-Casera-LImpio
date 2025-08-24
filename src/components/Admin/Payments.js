//src/components/Admin/Payments.js
import { useState, useEffect, useMemo } from 'react'; // Agregamos useMemo
import { db } from '../../config/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { Edit2, Trash2, PlusCircle, XCircle, ChevronLeft, TrashIcon } from 'lucide-react'; // Agregamos TrashIcon para el botón de eliminar todos

// Colombian Peso formatter
const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
});

const Payments = ({ setError, setSuccess, theme }) => {
  const [payments, setPayments] = useState([]);
  const [formFields, setFormFields] = useState([{ name: '', units: '', amount: '', store: '' }]);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [initialStore, setInitialStore] = useState('');

  // --- Nuevos estados para la funcionalidad de ver pagos por tienda ---
  const [selectedStore, setSelectedStore] = useState(null); // Guarda el nombre de la tienda seleccionada
  const [showStoreDetails, setShowStoreDetails] = useState(false); // Controla si se muestran los detalles de la tienda

  // Load payments from Firebase, ordered by timestamp in descending order (newest first for the displayed list)
  useEffect(() => {
    const paymentsQuery = query(collection(db, 'payments'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(paymentsQuery, (snapshot) => {
      setPayments(
        snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
      );
    }, (error) => setError(`Error al cargar pagos: ${error.message}`));
    return () => unsubscribe();
  }, [setError]);

  // Maneja los cambios en los inputs de CUALQUIER formulario dinámico
  const handleFormInputChange = (index, e) => {
    const { name, value } = e.target;
    // Limpia el valor si es 'amount' para asegurar solo números
    const cleanValue = name === 'amount' ? value.replace(/[^0-9]/g, '') : value;
    const updatedFormFields = [...formFields];
    updatedFormFields[index] = { ...updatedFormFields[index], [name]: cleanValue };
    setFormFields(updatedFormFields);
  };

  // Agrega un nuevo set de campos de formulario
  const handleAddAnotherForm = () => {
    const lastStore = formFields[formFields.length - 1]?.store || '';
    setInitialStore(lastStore);
    setFormFields([...formFields, { name: '', units: '', amount: '', store: lastStore }]);
  };

  // Remueve un set de campos de formulario por índice
  const handleRemoveForm = (index) => {
    const updatedFormFields = formFields.filter((_, i) => i !== index);
    setFormFields(updatedFormFields);
    if (updatedFormFields.length === 0) {
      setShowForm(false);
    }
  };

  // Función para guardar TODOS los pagos de los formularios dinámicos en Firebase
  const handleSaveAllForms = async () => {
    try {
      const paymentsToSave = [];
      const errors = [];

      formFields.forEach((payment, index) => {
        if (!payment.name || !payment.amount || !payment.store) {
          errors.push(`El pago ${index + 1} requiere Producto/Gasto, Monto y Tienda.`);
          return;
        }
        const amount = parseInt(payment.amount);
        if (isNaN(amount) || amount <= 0) {
          errors.push(`El monto del pago ${index + 1} debe ser un número válido mayor que 0.`);
          return;
        }
paymentsToSave.push({
  name: payment.name,
  units: parseInt(payment.units) || 0,
  amount: amount,
  store: payment.store,
  // Alias para dashboards que agrupan "por proveedor"
  provider: payment.store,
  // Timestamp consistente del lado del servidor (evita problemas de "hoy")
  timestamp: serverTimestamp()
});

      });

      if (errors.length > 0) {
        setError(errors.join('\n'));
        return;
      }

      if (editingPaymentId) {
        const paymentToUpdate = paymentsToSave[0];
        await updateDoc(doc(db, 'payments', editingPaymentId), paymentToUpdate);
        setSuccess('Pago actualizado exitosamente.');
      } else {
        const promises = paymentsToSave.map(payment =>
          addDoc(collection(db, 'payments'), payment)
        );
        await Promise.all(promises);
        setSuccess('Pagos registrados exitosamente.');
      }

      setFormFields([{ name: '', units: '', amount: '', store: '' }]);
      setEditingPaymentId(null);
      setShowForm(false);
    } catch (error) {
      setError(`Error al guardar pagos: ${error.message}`);
    }
  };

  // Eliminar pago de Firebase
  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este pago?')) {
      try {
        await deleteDoc(doc(db, 'payments', id));
        setSuccess('Pago eliminado exitosamente.');
      } catch (error) {
        setError(`Error al eliminar pago: ${error.message}`);
      }
    }
  };

  // Preparar el formulario para editar un pago existente
  const handleEdit = (payment) => {
    setEditingPaymentId(payment.id);
    setFormFields([{ ...payment, amount: payment.amount.toString() }]);
    setShowForm(true);
    setInitialStore(payment.store);
    setShowStoreDetails(false); // Asegúrate de ocultar los detalles si se estaba viendo alguno
  };

  // --- Lógica para agrupar pagos por tienda y fecha ---
  const groupedPaymentsByStoreAndDate = useMemo(() => {
    return payments.reduce((acc, payment) => {
      const date = payment.timestamp ?
        new Date(payment.timestamp.toDate()).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'Fecha Desconocida';

      if (!acc[payment.store]) acc[payment.store] = {};
      if (!acc[payment.store][date]) acc[payment.store][date] = [];
      acc[payment.store][date].push(payment);
      return acc;
    }, {});
  }, [payments]);

  // --- Calcular el total de gastos por tienda para el dashboard ---
  const totalExpensesByStore = useMemo(() => {
    const totals = {};
    payments.forEach(payment => {
      totals[payment.store] = (totals[payment.store] || 0) + payment.amount;
    });
    return totals;
  }, [payments]);

  // Calcular el gasto total general
  const totalOverallExpenses = useMemo(() => {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  }, [payments]);

  // Función para manejar el clic en "Ver todos los pagos" de una tienda
  const handleViewStoreDetails = (storeName) => {
    setSelectedStore(storeName);
    setShowStoreDetails(true);
  };

  // Función para volver a la vista principal del dashboard de tiendas
  const handleBackToDashboard = () => {
    setSelectedStore(null);
    setShowStoreDetails(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
      {/* Encabezado y Total General */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-4 sm:mb-8 p-3 sm:p-4 rounded-xl shadow-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
        <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight mb-1 sm:mb-0 text-center sm:text-left">Gestión de Pagos 💸</h2>
        <div className="text-lg sm:text-xl font-semibold">
          <p>Total Gastado: {copFormatter.format(totalOverallExpenses)}</p>
        </div>
      </div>

      {/* Botón para mostrar/ocultar formulario */}
      <button
        onClick={() => {
          setShowForm(!showForm);
          setEditingPaymentId(null);
          setFormFields([{ name: '', units: '', amount: '', store: '' }]);
          setInitialStore('');
          setShowStoreDetails(false); // Oculta detalles de tienda si abres el formulario
        }}
        className={`mb-4 sm:mb-6 px-4 py-2 sm:px-6 sm:py-3 rounded-full flex items-center justify-center space-x-2 transition-all duration-300 ease-in-out w-full sm:w-auto mx-auto
          ${showForm ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white shadow-lg
          transform hover:scale-105 text-sm sm:text-base`}
      >
        {showForm ? <XCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
        <span>{showForm ? 'Cerrar Formulario' : 'Registrar Nuevo Pago'}</span>
      </button>

      {/* Sección de Formularios Dinámicos */}
      {showForm && (
        <div className={`p-4 sm:p-6 rounded-xl shadow-xl transform transition-all duration-500 ease-in-out ${
          theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
        } ${showForm ? 'scale-100 opacity-100' : 'scale-95 opacity-0'} mb-6`}>
          <h3 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {editingPaymentId ? 'Editar Pago' : 'Registrar Nuevos Pagos'}
          </h3>
          <form onSubmit={(e) => { e.preventDefault(); handleSaveAllForms(); }}>
            {formFields.map((field, index) => (
              <div key={index} className={`p-3 sm:p-4 rounded-lg border mb-4 ${theme === 'dark' ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  <div>
                    <label htmlFor={`name-${index}`} className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Producto/Gasto
                    </label>
                    <input
                      type="text"
                      name="name"
                      id={`name-${index}`}
                      value={field.name}
                      onChange={(e) => handleFormInputChange(index, e)}
                      className={`mt-1 p-2 sm:p-3 w-full rounded-lg border focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base
                        ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-900'} shadow-sm`}
                      placeholder="Ej: Leche, Almuerzo"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor={`units-${index}`} className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Unidades (Opcional)
                    </label>
                    <input
                      type="number"
                      name="units"
                      id={`units-${index}`}
                      value={field.units}
                      onChange={(e) => handleFormInputChange(index, e)}
                      className={`mt-1 p-2 sm:p-3 w-full rounded-lg border focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base
                        ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-900'} shadow-sm`}
                      placeholder="Ej: 2"
                    />
                  </div>
                  <div>
                    <label htmlFor={`amount-${index}`} className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Monto Total (COP)
                    </label>
                    <input
                      type="text"
                      name="amount"
                      id={`amount-${index}`}
                      value={field.amount}
                      onChange={(e) => handleFormInputChange(index, e)}
                      placeholder="Ej: 4700"
                      className={`mt-1 p-2 sm:p-3 w-full rounded-lg border focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base
                        ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-900'} shadow-sm`}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor={`store-${index}`} className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tienda/Lugar
                    </label>
                    <input
                      type="text"
                      name="store"
                      id={`store-${index}`}
                      value={field.store}
                      onChange={(e) => handleFormInputChange(index, e)}
                      className={`mt-1 p-2 sm:p-3 w-full rounded-lg border focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base
                        ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-900'} shadow-sm`}
                      placeholder="Ej: Éxito, Cafetería"
                      required
                      onBlur={(e) => setInitialStore(e.target.value)}
                    />
                  </div>
                </div>
                {!editingPaymentId && formFields.length > 1 && (
                  <div className="flex justify-end mt-3">
                    <button
                      type="button"
                      onClick={() => handleRemoveForm(index)}
                      className="text-red-500 hover:text-red-600 transition-colors flex items-center text-sm"
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Eliminar este pago
                    </button>
                  </div>
                )}
              </div>
            ))}

            <div className="mt-4 sm:mt-6 flex flex-wrap justify-center sm:justify-start gap-3 sm:gap-4">
              {!editingPaymentId && (
                <button
                  type="button"
                  onClick={handleAddAnotherForm}
                  className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg flex items-center justify-center space-x-1 sm:space-x-2 transition-colors duration-200 text-xs sm:text-sm
                    ${theme === 'dark' ? 'bg-blue-700 hover:bg-blue-800' : 'bg-blue-600 hover:bg-blue-700'} text-white shadow-md`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Agregar Otro Pago</span>
                </button>
              )}
              <button
                type="submit"
                className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg flex items-center justify-center space-x-1 sm:space-x-2 transition-colors duration-200 text-xs sm:text-sm
                  ${theme === 'dark' ? 'bg-purple-700 hover:bg-purple-800' : 'bg-purple-600 hover:bg-purple-700'} text-white shadow-md`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>{editingPaymentId ? 'Actualizar Pago' : 'Guardar Pagos'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vista de Dashboard de Tiendas o Detalles de Tienda */}
      {!showForm && ( // Solo muestra esta sección si el formulario no está abierto
        <div className={`p-4 sm:p-6 rounded-xl shadow-xl max-h-[70vh] overflow-y-auto custom-scrollbar ${
          theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
        } mb-6`}>
          {showStoreDetails ? (
            // --- Vista de Pagos Detallados por Tienda ---
            <div>
              <button
                onClick={handleBackToDashboard}
                className={`mb-4 px-3 py-1.5 rounded-full flex items-center space-x-2 transition-colors duration-200 text-sm
                  ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'} shadow-md`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Volver al Dashboard de Tiendas</span>
              </button>
              <h3 className={`text-xl sm:text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Pagos en {selectedStore}
                <span className="ml-2 text-blue-500">
                    ({copFormatter.format(totalExpensesByStore[selectedStore] || 0)})
                </span>
              </h3>
              {Object.keys(groupedPaymentsByStoreAndDate[selectedStore] || {}).length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4 sm:py-8 text-sm sm:text-base">
                  No hay pagos registrados para {selectedStore}.
                </p>
              ) : (
                Object.entries(groupedPaymentsByStoreAndDate[selectedStore]).map(([date, dailyPayments]) => (
                  <div key={date} className="mb-6">
                    <h4 className={`text-lg font-semibold mb-3 px-3 py-2 rounded-lg ${
                        theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'
                    }`}>
                        📅 {date}
                    </h4>
                    <div className="space-y-2">
                      {dailyPayments.map(payment => (
                        <div
                          key={payment.id}
                          className={`p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center transition-colors duration-200
                            ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-100' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'} shadow-sm`}
                        >
                          <div className="flex-grow mb-1 sm:mb-0">
                            <p className="text-sm sm:text-base font-medium">
                              <span className="text-blue-400">{payment.name}</span> {payment.units ? `(${payment.units} unidades)` : ''} - <strong>{copFormatter.format(payment.amount)}</strong>
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
Fecha de Registro: {(
  payment?.timestamp?.toDate
    ? payment.timestamp.toDate()
    : (payment?.timestamp ? new Date(payment.timestamp) : null)
)?.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) || '—'}
                            </p>
                          </div>
                          <div className="flex space-x-2 mt-2 sm:mt-0">
                            <button
                              onClick={() => handleEdit(payment)}
                              className="text-yellow-500 hover:text-yellow-400 p-1.5 sm:p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                              title="Editar pago"
                            >
                              <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(payment.id)}
                              className="text-red-500 hover:text-red-400 p-1.5 sm:p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                              title="Eliminar pago"
                            >
                              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            // --- Vista de Dashboard con Totales por Tienda ---
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Gastos por Tienda 📊
                </h3>
                <button
                  onClick={() => {
                    if (window.confirm('¿Estás seguro de que deseas eliminar todos los pagos de hoy? Esta acción no se puede deshacer.')) {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const tomorrow = new Date(today);
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      
                      const todayPayments = payments.filter(payment => {
                        if (!payment.timestamp) return false;
                        
                        const paymentDate = payment.timestamp.toDate ? 
                          payment.timestamp.toDate() : 
                          new Date(payment.timestamp);
                          
                        return paymentDate >= today && paymentDate < tomorrow;
                      });

                      console.log('Pagos encontrados hoy:', todayPayments.length);

                      if (todayPayments.length === 0) {
                        setError('No hay pagos registrados hoy para eliminar.');
                        return;
                      }

                      // Mostrar detalles de los pagos que se van a eliminar
                      console.log('Pagos a eliminar:', todayPayments.map(p => ({
                        id: p.id,
                        fecha: p.timestamp.toDate().toLocaleString(),
                        monto: p.amount
                      })));

                      Promise.all(
                        todayPayments.map(payment => {
                          console.log('Eliminando pago:', payment.id);
                          return deleteDoc(doc(db, 'payments', payment.id));
                        })
                      )
                        .then(() => {
                          setSuccess(`${todayPayments.length} pagos de hoy han sido eliminados exitosamente.`);
                        })
                        .catch(error => {
                          console.error('Error al eliminar pagos:', error);
                          setError(`Error al eliminar los pagos: ${error.message}`);
                        });
                    }
                  }}
                  className={`p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900 transition-colors duration-200
                    ${theme === 'dark' ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-600'}`}
                  title="Eliminar todos los pagos de hoy"
                >
                  <TrashIcon className="w-6 h-6" />
                </button>
              </div>
              {Object.keys(totalExpensesByStore).length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4 sm:py-8 text-sm sm:text-base">
                  No hay tiendas con gastos registrados.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(totalExpensesByStore).map(([store, total]) => (
                    <div
                      key={store}
                      onClick={() => handleViewStoreDetails(store)}
                      className={`p-4 sm:p-5 rounded-lg shadow-md cursor-pointer transition-transform duration-200 hover:scale-[1.02]
                        ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-100' : 'bg-blue-50 hover:bg-blue-100 text-gray-900'} border border-transparent hover:border-blue-400`}
                    >
                      <h4 className="text-lg font-semibold mb-1 flex items-center">
                        <span className="text-blue-500 mr-2">🛍️</span> {store}
                      </h4>
                      <p className="text-xl font-bold text-red-400">
                        {copFormatter.format(total)}
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleViewStoreDetails(store); }} // Evita que el click en el botón active el div
                        className="mt-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
                      >
                        Ver todos los pagos
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Payments;