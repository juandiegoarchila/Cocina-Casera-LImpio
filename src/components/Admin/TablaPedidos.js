import React, { useRef, useEffect } from 'react'; // Import useRef and useEffect
import { classNames } from '../../utils/classNames.js';
import { cleanText, getAddressDisplay } from './utils';
import { ArrowDownTrayIcon, ChevronLeftIcon, ChevronRightIcon, InformationCircleIcon, PencilIcon, TrashIcon, EllipsisVerticalIcon, PlusIcon } from '@heroicons/react/24/outline';

const TablaPedidos = ({
  theme,
  orders,
  searchTerm,
  setSearchTerm,
  totals,
  isLoading,
  paginatedOrders,
  currentPage,
  totalPages,
  setCurrentPage,
  itemsPerPage,
  setItemsPerPage,
  deliveryPersons,
  handleEditOrder,
  handleDeleteOrder,
  handleStatusChange,
  handleSort,
  getSortIcon,
  setShowMealDetails,
  editingDeliveryId,
  setEditingDeliveryId,
  editForm,
  setEditForm,
  handleDeliveryChange,
  sortOrder,
  showProteinModal,
  setShowProteinModal,
  isMenuOpen,
  setIsMenuOpen,
  handleOpenPreview,
  handleOpenExcelPreview,
  handleExport,
  handleDeleteAllOrders,
  setShowConfirmDeleteAll,
  exportToExcel,
  exportToPDF,
  exportToCSV,
}) => {
  const currentDate = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Create a ref for the menu container
  const menuRef = useRef(null);

  // Effect to handle clicks outside the menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false); // Close the menu if clicked outside
      }
    }

    // Bind the event listener
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    // Unbind the event listener on cleanup
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen, setIsMenuOpen]); // Re-run effect when isMenuOpen changes

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Gestión de Pedidos</h2>

        {/* Totals Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-sm text-gray-700 dark:text-gray-300">
          <div className={classNames("p-3 sm:p-4 rounded-lg shadow-sm", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
            <p className="font-semibold text-sm sm:text-base">Total Efectivo</p>
            <p className="text-lg sm:text-xl font-bold">${totals.cash.toLocaleString('es-CO')}</p>
          </div>
          <div className={classNames("p-3 sm:p-4 rounded-lg shadow-sm", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
            <p className="font-semibold text-sm sm:text-base">Total Daviplata</p>
            <p className="text-lg sm:text-xl font-bold">${totals.daviplata.toLocaleString('es-CO')}</p>
          </div>
          <div className={classNames("p-3 sm:p-4 rounded-lg shadow-sm", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
            <p className="font-semibold text-sm sm:text-base">Total Nequi</p>
            <p className="text-lg sm:text-xl font-bold">${totals.nequi.toLocaleString('es-CO')}</p>
          </div>
          <div className={classNames("p-3 sm:p-4 rounded-lg shadow-sm", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
            <p className="font-semibold text-sm sm:text-base">Total General</p>
            <p className="text-lg sm:text-xl font-bold">${(totals.cash + totals.daviplata + totals.nequi).toLocaleString('es-CO')}</p>
          </div>
        </div>

        {/* Search, Proteins, Date, and Menu */}
        <div className="flex flex-wrap justify-center sm:justify-between items-center mb-6 gap-3 sm:gap-4">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar pedidos..."
            className={classNames(
              "p-2 sm:p-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:max-w-xs shadow-sm text-sm sm:text-base transition-all duration-200",
              theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'
            )}
          />
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
            <button
              onClick={() => setShowProteinModal(true)}
              className={classNames(
                "flex items-center justify-center gap-2 px-3 py-2 sm:px-5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-shrink-0",
                theme === 'dark'
                  ? 'bg-gray-600 hover:bg-gray-500 text-white border border-gray-500'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900 border border-gray-400'
              )}
            >
              <PlusIcon className="w-4 h-4" />
              <span className="hidden md:inline">Proteínas del Día</span>
            </button>
            <div
              className={classNames(
                "flex items-center justify-center gap-2 px-3 py-2 sm:px-5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold shadow-sm border transition-colors duration-200 flex-shrink-0",
                theme === 'dark'
                  ? 'bg-gray-700 text-white border-gray-500'
                  : 'bg-gray-200 text-gray-900 border-gray-400'
              )}
            >
              {currentDate}
            </div>
            {/* Added ref to the menu container */}
            <div className="relative z-50 flex-shrink-0" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={classNames(
                  "flex items-center justify-center p-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200",
                  // Removed background and hover background classes to make it transparent
                  // Removed text color classes to inherit from parent, or set explicitly if needed
                  // Added focus ring for accessibility
                  'focus:outline-none focus:ring-2 focus:ring-blue-500'
                )}
                aria-label="Opciones de menú"
              >
                <EllipsisVerticalIcon
                  className={classNames(
                    "w-6 h-6",
                    theme === 'dark' ? 'text-gray-200 hover:text-white' : 'text-gray-700 hover:text-gray-900' // Ensure icon color is visible
                  )}
                />
              </button>
              {isMenuOpen && (
                <div className={classNames(
                  "absolute right-0 mt-2 w-48 rounded-lg shadow-xl z-50",
                  theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-white text-gray-900'
                )}>
                  <div className="py-1">
                    <button
                      onClick={() => { handleOpenPreview(); setIsMenuOpen(false); }}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200"
                    >
                      Vista Previa PDF
                    </button>
                    <button
                      onClick={() => { handleOpenExcelPreview(); setIsMenuOpen(false); }}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200"
                    >
                      Vista Previa Excel
                    </button>
                    <button
                      onClick={() => { handleExport(exportToExcel, 'Excel'); setIsMenuOpen(false); }}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 flex items-center"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                      Exportar Excel
                    </button>
                    <button
                      onClick={() => { handleExport(exportToPDF, 'PDF'); setIsMenuOpen(false); }}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 flex items-center"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                      Exportar PDF
                    </button>
                    <button
                      onClick={() => { handleExport(exportToCSV, 'CSV'); setIsMenuOpen(false); }}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 flex items-center"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                      Exportar CSV
                    </button>
                    <button
                      onClick={() => { setShowConfirmDeleteAll(true); setIsMenuOpen(false); }}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 text-red-500"
                    >
                      Eliminar Todos
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className={classNames(
          "p-3 sm:p-4 rounded-2xl shadow-xl max-h-[70vh] overflow-y-auto custom-scrollbar transition-all duration-300",
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        )}>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className={classNames(
                      "font-semibold sticky top-0 z-10 shadow-sm",
                      theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'
                    )}>
                      <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('orderNumber')}>
                        Nº {getSortIcon('orderNumber')}
                      </th>
                      <th className="p-2 sm:p-3 border-b whitespace-nowrap">Detalles</th>
                      <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('meals.0.address.address')}>
                        Dirección {getSortIcon('meals.0.address.address')}
                      </th>
                      <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('meals.0.address.phoneNumber')}>
                        Teléfono {getSortIcon('meals.0.address.phoneNumber')}
                      </th>
                      <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('meals.0.time.name')}>
                        Hora {getSortIcon('meals.0.time.name')}
                      </th>
                      <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('payment')}>
                        Pago {getSortIcon('payment')}
                      </th>
                      <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('total')}>
                        Total {getSortIcon('total')}
                      </th>
                      <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('deliveryPerson')}>
                        Domiciliario {getSortIcon('deliveryPerson')}
                      </th>
                      <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('status')}>
                        Estado {getSortIcon('status')}
                      </th>
                      <th className="p-2 sm:p-3 border-b whitespace-nowrap">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="p-6 text-center text-gray-500 dark:text-gray-400">
                          No se encontraron pedidos. Intenta ajustar tu búsqueda o filtros.
                        </td>
                      </tr>
                    ) : (
                      paginatedOrders.map((order, index) => {
                        const displayNumber = sortOrder === 'asc'
                          ? (currentPage - 1) * itemsPerPage + index + 1
                          : paginatedOrders.length - ((currentPage - 1) * itemsPerPage + index);
                        const addressDisplay = getAddressDisplay(order.meals?.[0]?.address);
                        const paymentDisplay = cleanText(order.payment || order.meals?.[0]?.payment?.name || order.meals?.[0]?.payment || 'Sin pago');
                        const statusClass = order.status === 'Pendiente' ? 'bg-yellow-500 text-black' : order.status === 'Entregado' ? 'bg-green-500 text-white' : order.status === 'Cancelado' ? 'bg-red-500 text-white' : '';

                        return (
                          <tr
                            key={order.id}
                            className={classNames(
                              "border-b transition-colors duration-150",
                              theme === 'dark' ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50',
                              index % 2 === 0 ? (theme === 'dark' ? 'bg-gray-750' : 'bg-gray-50') : ''
                            )}
                          >
                            <td className="p-2 sm:p-3 text-gray-900 dark:text-gray-300 font-semibold whitespace-nowrap">{displayNumber}</td>
                            <td className="p-2 sm:p-3 text-gray-900 dark:text-gray-300">
                              <div className="flex items-center justify-center h-full">
                                <button
                                  onClick={() => setShowMealDetails(order)}
                                  className="text-blue-500 hover:text-blue-400 transition-colors duration-150 p-1 rounded-md"
                                  title="Ver detalles de la bandeja"
                                  aria-label={`Ver detalles del pedido ${order.id}`}
                                >
                                  <InformationCircleIcon className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                            <td className="p-2 sm:p-3 text-gray-900 dark:text-gray-300 max-w-[150px] sm:max-w-[200px] truncate" title={addressDisplay}>{addressDisplay}</td>
                            <td className="p-2 sm:p-3 text-gray-900 dark:text-gray-300 whitespace-nowrap">{cleanText(order.meals?.[0]?.address?.phoneNumber)}</td>
                            <td className="p-2 sm:p-3 text-gray-900 dark:text-gray-300 whitespace-nowrap">{cleanText(order.meals?.[0]?.time?.name || order.meals?.[0]?.time)}</td>
                            <td className="p-2 sm:p-3 text-gray-900 dark:text-gray-300 whitespace-nowrap">{paymentDisplay}</td>
                            <td className="p-2 sm:p-3 text-gray-900 dark:text-gray-300 font-medium whitespace-nowrap">${order.total?.toLocaleString('es-CO') || '0'}</td>
                            <td className="p-2 sm:p-3 text-gray-900 dark:text-gray-300 whitespace-nowrap">
                              {editingDeliveryId === order.id ? (
                                <input
                                  type="text"
                                  value={editForm.deliveryPerson || ''}
                                  onChange={(e) => setEditForm({ ...editForm, deliveryPerson: e.target.value })}
                                  onBlur={(e) => handleDeliveryChange(order.id, e.target.value)}
                                  onKeyPress={(e) => e.key === 'Enter' && handleDeliveryChange(order.id, e.target.value)}
                                  className={classNames(
                                    "w-full p-1 sm:p-2 rounded-lg border text-xs sm:text-sm",
                                    theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-200 text-gray-900',
                                    "focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  )}
                                  autoFocus
                                  aria-label={`Editar domiciliario para pedido ${order.id}`}
                                />
                              ) : (
                                <span
                                  onClick={() => { setEditingDeliveryId(order.id); setEditForm(prev => ({ ...prev, deliveryPerson: order.deliveryPerson || '' })); }}
                                  className="cursor-pointer hover:underline"
                                  title="Click para editar"
                                >
                                  {order.deliveryPerson || 'Sin asignar'}
                                </span>
                              )}
                            </td>
                            <td className="p-2 sm:p-3 text-gray-900 dark:text-gray-300 whitespace-nowrap">
                              <select
                                value={order.status || 'Pendiente'}
                                onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                className={classNames(
                                  "p-1 sm:p-2 rounded-lg text-xs font-medium border focus:outline-none focus:ring-2 focus:ring-blue-500",
                                  statusClass,
                                  theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'
                                )}
                                aria-label={`Cambiar estado del pedido ${order.id}`}
                              >
                                <option value="Pendiente">Pendiente</option>
                                <option value="En Preparación">En Preparación</option>
                                <option value="En Camino">En Camino</option>
                                <option value="Entregado">Entregado</option>
                                <option value="Cancelado">Cancelado</option>
                              </select>
                            </td>
                            <td className="p-2 sm:p-3 flex space-x-1 sm:space-x-2 items-center">
                              <button
                                onClick={() => handleEditOrder(order)}
                                className="text-blue-500 hover:text-blue-400 transition-colors duration-150 p-1 rounded-md"
                                title="Editar pedido"
                                aria-label={`Editar pedido ${order.id}`}
                              >
                                <PencilIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteOrder(order.id)}
                                className="text-red-500 hover:text-red-400 transition-colors duration-150 p-1 rounded-md"
                                title="Eliminar pedido"
                                aria-label={`Eliminar pedido ${order.id}`}
                              >
                                <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Pedidos por página:</span>
                  <select
                    value={itemsPerPage}
                    onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className={classNames(
                      "p-1 sm:p-2 rounded-lg border text-sm",
                      theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'
                    )}
                    aria-label="Seleccionar número de pedidos por página"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={30}>30</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={classNames(
                      "p-2 rounded-lg transition-all duration-200",
                      currentPage === 1 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
                    )}
                    aria-label="Página anterior"
                  >
                    <ChevronLeftIcon className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={classNames(
                      "p-2 rounded-lg transition-all duration-200",
                      currentPage === totalPages ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
                    )}
                    aria-label="Página siguiente"
                  >
                    <ChevronRightIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Summary by Delivery Persons */}
        <div className="mt-8">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Resumen por Domiciliarios</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Object.keys(deliveryPersons).length === 0 ? (
              <p className="col-span-full text-center text-gray-500 dark:text-gray-400 p-4">No hay datos de domiciliarios disponibles.</p>
            ) : (
              Object.entries(deliveryPersons).map(([name, totals]) => (
                <div key={name} className={classNames(
                  "p-4 sm:p-5 rounded-lg shadow-md",
                  theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'
                )}>
                  <p className="font-semibold text-lg mb-2">{name}</p>
                  <p className="text-sm sm:text-base">Efectivo: <span className="font-medium">${totals.cash.toLocaleString('es-CO')}</span></p>
                  <p className="text-sm sm:text-base">Daviplata: <span className="font-medium">${totals.daviplata.toLocaleString('es-CO')}</span></p>
                  <p className="text-sm sm:text-base">Nequi: <span className="font-medium">${totals.nequi.toLocaleString('es-CO')}</span></p>
                  <p className="text-base font-bold mt-2">Total: <span className="text-blue-500">${totals.total.toLocaleString('es-CO')}</span></p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default TablaPedidos;