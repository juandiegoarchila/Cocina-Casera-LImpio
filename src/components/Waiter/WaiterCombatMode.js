import React, { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../Auth/AuthProvider';
import { calculateTotal } from '../../utils/MealCalculations';
import { calculateBreakfastPrice } from '../../utils/BreakfastLogic';
import MealList from '../MealList';
import BreakfastList from '../BreakfastList';
import { 
  PlusCircleIcon, XCircleIcon, EyeIcon, 
  TrashIcon, ArrowPathIcon 
} from '@heroicons/react/24/outline';

const WaiterCombatMode = () => {
  const { user } = useAuth();
  
  /* --- 1. DATA FETCHING --- */
  const [data, setData] = useState({
    soups: [], principles: [], proteins: [], drinks: [], sides: [], additions: [],
    eggs: [], broths: [], riceBread: [], breakfastTypes: [], breakfastProteins: [], times: [], paymentMethods: [],
    tables: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'soups'), s => setData(p => ({...p, soups: s.docs.map(d=>({id:d.id, ...d.data()}))}))),
      onSnapshot(collection(db, 'principles'), s => setData(p => ({...p, principles: s.docs.map(d=>({id:d.id, ...d.data()}))}))),
      onSnapshot(collection(db, 'proteins'), s => setData(p => ({...p, proteins: s.docs.map(d=>({id:d.id, ...d.data()}))}))),
      onSnapshot(collection(db, 'drinks'), s => setData(p => ({...p, drinks: s.docs.map(d=>({id:d.id, ...d.data()}))}))),
      onSnapshot(collection(db, 'sides'), s => setData(p => ({...p, sides: s.docs.map(d=>({id:d.id, ...d.data()}))}))),
      onSnapshot(collection(db, 'aditions'), s => setData(p => ({...p, additions: s.docs.map(d=>({id:d.id, ...d.data()}))})), () => {}),
      
      /* Breakfast specific */
      onSnapshot(collection(db, 'eggs'), s => setData(p => ({...p, eggs: s.docs.map(d=>({id:d.id, ...d.data()}))}))),
      onSnapshot(collection(db, 'broths'), s => setData(p => ({...p, broths: s.docs.map(d=>({id:d.id, ...d.data()}))}))),
      onSnapshot(collection(db, 'riceBread'), s => setData(p => ({...p, riceBread: s.docs.map(d=>({id:d.id, ...d.data()}))}))),
      onSnapshot(collection(db, 'breakfastTypes'), s => setData(p => ({...p, breakfastTypes: s.docs.map(d=>({id:d.id, ...d.data()}))}))),
      onSnapshot(collection(db, 'breakfastProteins'), s => setData(p => ({...p, breakfastProteins: s.docs.map(d=>({id:d.id, ...d.data()}))}))),
      
      /* Tables & Common */
      onSnapshot(query(collection(db, 'tables'), orderBy('name', 'asc')), s => {
        setData(p => ({...p, tables: s.docs.map(d=>({id:d.id, ...d.data()}))}));
        setLoading(false);
      }),
      onSnapshot(collection(db, 'paymentMethods'), s => setData(p => ({...p, paymentMethods: s.docs.map(d=>({id:d.id, ...d.data()}))})))
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  /* --- 2. LOCAL STATE (Drafts) --- */
  const [slotsData, setSlotsData] = useState({});
  const [activeSlotId, setActiveSlotId] = useState(null);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [recentOrders, setRecentOrders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  /* LocalStorage Sync */
  useEffect(() => {
    const saved = localStorage.getItem('combatModeDrafts_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSlotsData(parsed);
        if (Object.keys(parsed).length > 0) setActiveSlotId(Number(Object.keys(parsed)[0]));
        else createNewSlot('lunch');
      } catch(e) { createNewSlot('lunch'); }
    } else {
      createNewSlot('lunch');
    }
  }, []);

  useEffect(() => {
    if (Object.keys(slotsData).length > 0) {
      localStorage.setItem('combatModeDrafts_v3', JSON.stringify(slotsData));
    }
  }, [slotsData]);

  /* Recent Orders Sync (Orders that are not yet paid) */
  useEffect(() => {
    if (!user) return;
    const activeStatuses = ['Pendiente', 'Preparando', 'Completada'];
    const q = query(
        collection(db, 'tableOrders'), 
        where('status', 'in', activeStatuses)
    );
    const unsub = onSnapshot(q, snap => {
        const misOrdenes = snap.docs
            .map(d => ({id:d.id, ...d.data()}))
            .filter(o => !o.isPaid) // Solo mostrar las que no han sido pagadas
            .filter(o => o.userId === user.uid || o.deliveryPerson === user.uid || o.waiterName === user.displayName || user.role === 'admin')
            .sort((a,b) => {
                const tsA = a.createdAt?.seconds || 0;
                const tsB = b.createdAt?.seconds || 0;
                return tsB - tsA;
            });
        setRecentOrders(misOrdenes);
    });
    return () => unsub();
  }, [user]);

  /* --- 3. HELPERS --- */
  
  const createNewSlot = (type = 'lunch') => {
    const newId = Date.now();
    const newSlot = {
      id: newId,
      type: type, /* 'lunch' | 'breakfast' */
      table: null,
      items: [], /* Will hold meals or breakfasts */
      notes: ''
    };
    
    /* Add 1 initial item */
    if (type === 'lunch') {
        newSlot.items.push({ 
            id: Date.now() + 1, 
            soup: null, principle: null, protein: null, drink: null, sides: [], additions: [], notes: '' 
        });
    } else {
        newSlot.items.push({
            id: Date.now() + 1,
            type: null, broth: null, eggs: null, riceBread: null, drink: null, cutlery: null
        });
    }

    setSlotsData(prev => {
        const next = { ...prev, [newId]: newSlot };
        setActiveSlotId(newId);
        return next;
    });
  };

  const removeSlot = (id) => {
    setSlotsData(prev => {
        const next = { ...prev };
        delete next[id];
        if (Number(activeSlotId) === Number(id)) {
            const keys = Object.keys(next);
            if (keys.length > 0) setActiveSlotId(Number(keys[0]));
            else createNewSlot('lunch');
        }
        if (Object.keys(next).length === 0) createNewSlot('lunch');
        return next;
    });
  };

  const updateSlot = (id, changes) => {
      setSlotsData(prev => ({ ...prev, [id]: { ...prev[id], ...changes } }));
  };

  /* --- 4. HANDLERS FOR LIST COMPONENTS --- */

  const handleItemChange = (itemId, field, value) => {
      const slot = slotsData[activeSlotId];
      const newItems = slot.items.map(item => {
          if (item.id === itemId) return { ...item, [field]: value };
          return item;
      });
      updateSlot(activeSlotId, { items: newItems });
  };

  const handleAddItem = () => {
        const slot = slotsData[activeSlotId];
        const newItem = slot.type === 'lunch' 
        ? { id: Date.now(), soup: null, principle: null, protein: null, drink: null, sides: [], additions: [], notes: '' }
        : { id: Date.now(), type: null, broth: null, eggs: null, riceBread: null, drink: null };
        updateSlot(activeSlotId, { items: [...slot.items, newItem] });
    };

    const handleRemoveMeal = (index) => {
        const slot = slotsData[activeSlotId];
        const newItems = slot.items.filter((_, i) => i !== index);
        updateSlot(activeSlotId, { items: newItems });
    };

    const handleRemoveBreakfast = (id) => {
        const slot = slotsData[activeSlotId];
        const newItems = slot.items.filter(item => item.id !== id);
        updateSlot(activeSlotId, { items: newItems });
    };

    const handleDuplicateItem = (item) => {
        const slot = slotsData[activeSlotId];
        const newItem = { ...item, id: Date.now() };
        updateSlot(activeSlotId, { items: [...slot.items, newItem] });
    };

  /* --- 5. SUBMIT --- */
  const handleSubmit = async () => {
    const slot = slotsData[activeSlotId];
    if (!slot.table) { alert('⚠️ Selecciona una MESA'); return; }
    if (slot.items.length === 0) return;

    /* Validación básica */
    if (slot.type === 'lunch') {
         if (slot.items.some(m => !m.protein && !m.soup)) {
             alert('⚠️ Algunos almuerzos están vacíos (sin proteína ni sopa).'); 
             return; 
         }
    } else {
        if (slot.items.some(b => !b.type)) {
            alert('⚠️ Selecciona el tipo de desayuno.');
            return;
        }
    }

    setSaving(true);
    try {
        const finalItems = slot.items.map(i => ({
            ...i,
            tableNumber: slot.table.name,
            orderType: (slot.table?.name === 'Llevar' || slot.table?.name === 'Domicilio') ? 'llevar' : 'mesa',
            payment: { name: 'Efectivo' } /* Default */
        }));

        const total = slot.type === 'lunch' 
            ? calculateTotal(finalItems, 3) 
            : finalItems.reduce((acc, curr) => acc + calculateBreakfastPrice(curr, 3), 0);

        const orderPayload = {
            userId: user.uid,
            userEmail: user.email || '',
            waiterName: user.displayName || 'Ventas',
            meals: slot.type === 'lunch' ? finalItems : [],
            breakfasts: slot.type === 'breakfast' ? finalItems : [],
            total: total,
            status: 'Pendiente',
            tableNumber: slot.table.name,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            origin: 'CombatMode',
            isCombatMode: true,
            isBreakfast: slot.type === 'breakfast'
        };

        await addDoc(collection(db, 'tableOrders'), orderPayload);
        removeSlot(activeSlotId);
    } catch (e) {
        setErrorMsg('Error: ' + e.message);
    } finally {
        setSaving(false);
    }
  };

  /* --- RENDER --- */
  const currentSlot = slotsData[activeSlotId];

  if (!currentSlot || loading) return <div className="p-10 text-center font-bold text-gray-500">Cargando Modo Guerra...</div>;

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      
      {/* HEADER TABS (Slots) */}
      <div className="flex items-center gap-2 p-2 bg-white border-b shadow-sm overflow-x-auto">
        <div className="flex gap-2">
            {Object.values(slotsData).map(slot => (
                <div 
                    key={slot.id}
                    onClick={() => setActiveSlotId(slot.id)}
                    className={`relative cursor-pointer px-4 py-2 rounded-lg border-2 min-w-[120px] transition-all
                        ${activeSlotId === slot.id 
                            ? (slot.type === 'lunch' ? 'bg-blue-50 border-blue-500 text-blue-800' : 'bg-orange-50 border-orange-500 text-orange-800') 
                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}
                    `}
                >
                    <div className="text-xs font-bold uppercase tracking-wider mb-1">
                        {slot.table?.name || (slot.type === 'lunch' ? '🥗 Almuerzo' : '🍳 Desayuno')}
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-sm">
                            {slot.items.length} {slot.type === 'lunch' ? 'Platos' : 'Desayunos'}
                        </span>
                        {Object.keys(slotsData).length > 1 && (
                            <button onClick={(e) => { e.stopPropagation(); removeSlot(slot.id); }} className="text-red-400 hover:text-red-600">
                                <XCircleIcon className="w-5 h-5"/>
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
        
        {/* New Slot Buttons */}
        <div className="flex gap-1 ml-2 border-l pl-2">
            <button onClick={() => createNewSlot('lunch')} className="flex flex-col items-center justify-center w-12 h-12 rounded bg-blue-100 hover:bg-blue-200 text-blue-700">
                <PlusCircleIcon className="w-6 h-6"/>
                <span className="text-[9px] font-bold">ALMU</span>
            </button>
            <button onClick={() => createNewSlot('breakfast')} className="flex flex-col items-center justify-center w-12 h-12 rounded bg-orange-100 hover:bg-orange-200 text-orange-700">
                 <PlusCircleIcon className="w-6 h-6"/>
                <span className="text-[9px] font-bold">DESA</span>
            </button>
        </div>

        <div className="ml-auto">
             <button onClick={() => setShowOrdersModal(true)} className="flex items-center gap-1 bg-gray-800 text-white px-3 py-2 rounded-lg font-bold shadow hover:bg-gray-700 text-sm">
                <EyeIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Ver Pedidos</span>
             </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4 pb-24">
        
        {/* Table Selector (Top of page in standard UI) */}
        <div className="bg-white p-3 rounded-lg shadow-sm mb-4 border border-gray-200">
             <h3 className="text-gray-500 text-xs font-bold uppercase mb-2">🍽️ Asignar Mesa (Requerido)</h3>
             <div className="flex flex-wrap gap-2">
                 {[...data.tables, {id:'llevar', name: 'Llevar'}].map(t => (
                     <button
                        key={t.id}
                        onClick={() => updateSlot(activeSlotId, { table: t })}
                        className={`px-3 py-1.5 rounded text-sm font-bold border transition-colors
                            ${currentSlot.table?.name === t.name 
                                ? 'bg-green-600 text-white border-green-600 shadow-md' 
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}
                        `}
                     >
                         {t.name.replace('Mesa ', '')}
                     </button>
                 ))}
             </div>
        </div>

        {/* Existing Lists Reuse */}
        {currentSlot.type === 'lunch' ? (
            <MealList 
                meals={currentSlot.items}
                soups={data.soups}
                principles={data.principles}
                proteins={data.proteins}
                drinks={data.drinks}
                sides={data.sides}
                additions={data.additions}
                paymentMethods={data.paymentMethods} /* Not used for Waiter but req by prop */
                isTableOrder={true}
                userRole={3} /* Waiter */
                onMealChange={(id, field, val) => handleItemChange(id, field, val)}
                onAddMeal={handleAddItem}
                onRemoveMeal={handleRemoveMeal}
                onDuplicateMeal={handleDuplicateItem}
                isOrderingDisabled={false}
            />
        ) : (
             <BreakfastList 
                breakfasts={currentSlot.items}
                eggs={data.eggs}
                broths={data.broths}
                riceBread={data.riceBread}
                drinks={data.drinks}
                breakfastTypes={data.breakfastTypes}
                breakfastProteins={data.breakfastProteins}
                additions={data.additions}
                times={data.times} /* Not used */
                paymentMethods={data.paymentMethods}
                isTableOrder={true}
                userRole={3}
                onBreakfastChange={(id, field, val) => handleItemChange(id, field, val)}
                onAddBreakfast={handleAddItem}
                onRemoveBreakfast={handleRemoveBreakfast} /* Assuming index based */
                onDuplicateBreakfast={handleDuplicateItem}
                isOrderingDisabled={false}
            />
        )}
      </div>

      {/* FOOTER ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20 flex justify-between items-center">
          <div>
              <div className="text-xs text-gray-500 uppercase font-bold">Total (Aprox)</div>
              <div className="text-xl font-bold text-green-700">
                  ${(currentSlot.type === 'lunch' 
                     ? calculateTotal(currentSlot.items, 3) 
                     : currentSlot.items.reduce((acc, curr) => acc + calculateBreakfastPrice(curr, 3), 0)
                    ).toLocaleString()}
              </div>
          </div>
          <button 
             onClick={handleSubmit} 
             disabled={saving}
             className={`px-8 py-3 rounded-lg font-bold text-white shadow-lg transition-transform active:scale-95
                 ${saving ? 'bg-gray-400 cursor-wait' : 'bg-gray-900 hover:bg-gray-800'}
             `}
          >
              {saving ? 'Enviando...' : 'GUARDAR PEDIDO'}
          </button>
      </div>

      {/* MODAL VIEW ORDERS */}
      {showOrdersModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
              <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slideInRight">
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                      <h2 className="font-bold text-lg">Pedidos Recientes</h2>
                      <button onClick={()=>setShowOrdersModal(false)}><XCircleIcon className="w-6 h-6 text-gray-500"/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-100">
                      {recentOrders.map(o => (
                          <div key={o.id} className="bg-white p-3 rounded shadow-sm border border-gray-200">
                              <div className="flex justify-between mb-2">
                                  <span className="font-bold text-gray-800">{o.tableNumber}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${o.status==='Pendiente'?'bg-yellow-100 text-yellow-800':'bg-gray-200'}`}>{o.status}</span>
                              </div>
                              <div className="text-xs text-gray-500 space-y-1">
                                  {(o.meals || o.breakfasts || []).map((m, i) => (
                                      <div key={i} className="pl-2 border-l-2 border-gray-300">
                                          {m.protein?.name || m.productName || m.type || 'Item'}
                                          {m.notes && <div className="text-orange-600 italic">"{m.notes}"</div>}
                                      </div>
                                  ))}
                              </div>
                              <div className="mt-2 pt-2 border-t text-right">
                                  <span className="font-bold text-gray-900">${(o.total || 0).toLocaleString()}</span>
                              </div>
                          </div>
                      ))}
                      {recentOrders.length === 0 && <div className="text-center text-gray-500">No hay pedidos pendientes.</div>}
                  </div>
              </div>
          </div>
      )}
      
      {errorMsg && (
        <div className="fixed top-20 right-4 bg-red-100 text-red-800 px-4 py-2 rounded shadow border border-red-200 z-50">
            {errorMsg} <button onClick={()=>setErrorMsg('')} className="ml-2 font-bold">X</button>
        </div>
      )}
    </div>
  );
};

export default WaiterCombatMode;
