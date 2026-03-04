// src/components/Chat/ChatWidget.js
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { buildDynamicFlows, findSmartResponse, TYPING_DELAY, buildOrderSummary, buildWhatsAppMessage, checkSoldOutItems } from './chatFlows';
import { openWhatsApp } from '../../utils/whatsapp';
import { initializeMealData } from '../../utils/MealLogic';
import useMenuData from './useMenuData';
import { useAIChat } from './useAIChat';
import './ChatWidget.css';

const RESTAURANT_PHONE = '3016476916';

// ─── Icons ────────────────────────────────────────────────
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
  </svg>
);

const AIIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M21 10.5h-1.5V9h-2v1.5H16V9h-2v1.5h-1.5V9h-2v1.5H9V9H7v1.5H5.5V9h-2v1.5H2c0 5.52 4.48 10 10 10s10-4.48 10-10zM12 17.5c-3.87 0-7-3.13-7-7h14c0 3.87-3.13 7-7 7z" />
    <circle cx="8.5" cy="14" r="1.5" />
    <circle cx="15.5" cy="14" r="1.5" />
    <path d="M12 2C6.48 2 2 6.48 2 12h2a8 8 0 0116 0h2c0-5.52-4.48-10-10-10z" opacity=".3"/>
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────
function getTimeString() {
  const now = new Date();
  return now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ─── Component ────────────────────────────────────────────
// ⚡ FEATURE FLAG: cambiar a true cuando el chat esté listo para producción
export const CHAT_ENABLED = process.env.REACT_APP_CHAT_ENABLED === 'true' || process.env.NODE_ENV === 'development';

const ChatWidget = ({ meals: propMeals = [], setMeals: propSetMeals, breakfasts: propBreakfasts = [], setBreakfasts: propSetBreakfasts, savedAddress: propSavedAddress = {}, onOrderConfirmed, saveOrder }) => {
  // Data real de Firestore en tiempo real
  const menuData = useMenuData();

  // Construir flujos dinámicos cada vez que cambian los datos del menú
  const flows = useMemo(() => buildDynamicFlows(menuData), [menuData]);
  // Ref para tener siempre la versión más reciente de flows sin recrear callbacks
  const flowsRef = useRef(flows);
  useEffect(() => { flowsRef.current = flows; }, [flows]);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);       // { id, type: 'bot'|'user', text, time }
  const [optionSets, setOptionSets] = useState([]);    // { id, options[], selectedIdx, flowId }
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [currentFlow, setCurrentFlow] = useState(null);
  const [unread, setUnread] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [expectsInput, setExpectsInput] = useState(false);
  const [pendingNextFlow, setPendingNextFlow] = useState(null);
  const [orderSelections, setOrderSelections] = useState({});
  const [editingMealIndex, setEditingMealIndex] = useState(0);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const msgIdCounter = useRef(0);
  const orderSelectionsRef = useRef(orderSelections);
  const editingMealIndexRef = useRef(0);
  useEffect(() => { orderSelectionsRef.current = orderSelections; }, [orderSelections]);
  useEffect(() => { editingMealIndexRef.current = editingMealIndex; }, [editingMealIndex]);

  // ─── AI Chat Integration ──────────────────────────────
  const handleAIOrderComplete = useCallback((orderData) => {
    // Construir mensaje de WhatsApp desde los datos de la IA
    const isBreakfast = !!orderData.type;
    const mealObj = { ...orderData };
    // Adaptar formato para buildWhatsAppMessage
    const sel = {
      ...orderData,
      soup: orderData.soup ? { name: orderData.soup } : null,
      protein: orderData.protein ? { name: orderData.protein } : null,
      drink: orderData.drink ? { name: orderData.drink } : null,
      payment: orderData.payment ? { name: orderData.payment } : null,
      time: orderData.time ? { name: orderData.time } : null,
      principle: orderData.principles ? orderData.principles.map(p => ({ name: p })) : [],
      sides: orderData.sides ? orderData.sides.map(s => ({ name: s })) : [],
      additions: orderData.additions ? orderData.additions.map(a => ({ name: a, quantity: 1 })) : [],
      cutlery: orderData.cutlery || false,
      address: orderData.address || '',
      phone: orderData.phone || '',
      notes: orderData.notes || '',
    };
    if (isBreakfast) {
      sel.type = { name: orderData.type };
      sel.broth = orderData.broth ? { name: orderData.broth } : null;
      sel.eggs = orderData.eggs ? { name: orderData.eggs } : null;
      sel.riceBread = orderData.riceBread ? { name: orderData.riceBread } : null;
    }
    const mealForWA = { ...sel };
    const msg = buildWhatsAppMessage(sel, mealForWA, [mealForWA]);
    openWhatsApp(RESTAURANT_PHONE, msg);
    if (onOrderConfirmed) onOrderConfirmed(msg);
  }, [onOrderConfirmed]);

  const {
    isAIMode, isAILoading, isListening, aiAvailable, aiOrderData,
    hasSpeechSupport, sendToAI, startListening, stopListening,
    resetAIChat, toggleAIMode, setIsAIMode,
  } = useAIChat(menuData, handleAIOrderComplete);

  // ─── Sync AI order data → main form ────────────────
  useEffect(() => {
    if (!aiOrderData) return;
    
    // Identificar si es desayuno (por la presencia de type, broth, eggs etc.)
    const isBreakfast = !!aiOrderData.type || !!aiOrderData.broth || !!aiOrderData.eggs || !!aiOrderData.riceBread;

    if (isBreakfast && propSetBreakfasts) {
      propSetBreakfasts(prevBreakfasts => {
        let updated = [...prevBreakfasts];
        if (updated.length === 0) {
          updated = [{ id: Date.now(), type: null, eggs: null, broth: null, riceBread: null, drink: null, protein: null, cutlery: null, address: propSavedAddress || {}, payment: null, additions: [], notes: '', time: null }];
        }
        const idx = Math.min(editingMealIndexRef.current, updated.length - 1);
        const bf = { ...updated[idx] };

        if (aiOrderData.type) {
          // Match type name to actual breakfastType object with id and steps
          const matchedType = (menuData.breakfastTypes || []).find(
            bt => bt.name.toLowerCase() === aiOrderData.type.toLowerCase()
          );
          bf.type = matchedType || { name: aiOrderData.type };
        }
        if (aiOrderData.broth) {
          const matchedBroth = (menuData.breakfastBroths || []).find(
            b => b.name.toLowerCase() === aiOrderData.broth.toLowerCase()
          );
          bf.broth = matchedBroth || { name: aiOrderData.broth };
        }
        if (aiOrderData.eggs) {
          const matchedEggs = (menuData.breakfastEggs || []).find(
            e => e.name.toLowerCase() === aiOrderData.eggs.toLowerCase()
          );
          bf.eggs = matchedEggs || { name: aiOrderData.eggs };
        }
        if (aiOrderData.riceBread) {
          const matchedRB = (menuData.breakfastRiceBread || []).find(
            r => r.name.toLowerCase() === aiOrderData.riceBread.toLowerCase()
          );
          bf.riceBread = matchedRB || { name: aiOrderData.riceBread };
        }
        if (aiOrderData.protein) {
          const matchedProtein = (menuData.breakfastProteins || []).find(
            p => p.name.toLowerCase() === aiOrderData.protein.toLowerCase()
          );
          bf.protein = matchedProtein || { name: aiOrderData.protein };
        }
        if (aiOrderData.drink) {
          const matchedDrink = (menuData.breakfastDrinks || []).find(
            d => d.name.toLowerCase() === aiOrderData.drink.toLowerCase()
          );
          bf.drink = matchedDrink || { name: aiOrderData.drink };
        }

        if (aiOrderData.sides) bf.sides = aiOrderData.sides.map(s => ({ name: s }));
        if (aiOrderData.additions) bf.additions = aiOrderData.additions.map(a => ({ name: a, quantity: 1 }));
        
        if (aiOrderData.cutlery !== undefined) bf.cutlery = aiOrderData.cutlery;
        if (aiOrderData.notes) bf.notes = aiOrderData.notes;
        if (aiOrderData.time) bf.time = { name: aiOrderData.time };
        if (aiOrderData.payment) bf.paymentMethod = { name: aiOrderData.payment };

        updated[idx] = bf;
        return updated;
      });
    } else if (!isBreakfast && propSetMeals) {
      propSetMeals(prevMeals => {
        let updated = [...prevMeals];
        if (updated.length === 0) {
          updated = [initializeMealData(propSavedAddress || {})];
        }
        const idx = Math.min(editingMealIndexRef.current, updated.length - 1);
        const meal = { ...updated[idx] };

        // Mapear campos de almuerzo
        if (aiOrderData.soup) {
          meal.soup = { name: aiOrderData.soup };
          if (aiOrderData.soup !== 'Remplazo por Sopa') meal.soupReplacement = null;
        }
        if (aiOrderData.soupReplacement) meal.soupReplacement = { name: aiOrderData.soupReplacement };

        if (aiOrderData.principles && Array.isArray(aiOrderData.principles) && aiOrderData.principles.length > 0) {
          meal.principle = [{ name: aiOrderData.principles[0] }];
          if (aiOrderData.principles.length > 1) {
            meal.principleReplacement = { name: aiOrderData.principles[1] };
          } else {
            meal.principleReplacement = null;
          }
        }

        if (aiOrderData.protein) meal.protein = { name: aiOrderData.protein };
        if (aiOrderData.drink) meal.drink = { name: aiOrderData.drink };
        
        if (aiOrderData.sides && Array.isArray(aiOrderData.sides)) {
          meal.sides = aiOrderData.sides.map(s => ({ name: s }));
        } else if (!meal.sides || meal.sides.length === 0) {
          // Fallback: si la IA no envió sides, usar "Todo incluido" (todos los disponibles)
          const availableSides = (menuData.sides || []).filter(s => !s.isFinished && s.name !== 'Ninguno' && !s.name.toLowerCase().includes('todo inclu'));
          if (availableSides.length > 0) {
            meal.sides = availableSides.map(s => ({ name: s.name }));
          }
        }
        if (aiOrderData.additions && Array.isArray(aiOrderData.additions)) meal.additions = aiOrderData.additions.map(a => ({ name: a, quantity: 1 }));

        if (aiOrderData.cutlery !== undefined) meal.cutlery = aiOrderData.cutlery;
        if (aiOrderData.notes !== undefined) meal.notes = aiOrderData.notes || '';
        if (aiOrderData.time) meal.time = { name: aiOrderData.time };
        if (aiOrderData.payment) meal.payment = { name: aiOrderData.payment };

        // Marcar acuerdo de entrega como aceptado (la IA maneja el flujo de dirección/confirmación)
        meal.deliveryAgreement = true;

        updated[idx] = meal;
        return updated;
      });
    }
  }, [aiOrderData, propSetMeals, propSetBreakfasts, propSavedAddress, menuData]);

  // ─── Sync breakfast chat → main form ────────────────
  const syncBreakfastChatToMainForm = useCallback((selectionField, value, option) => {
    if (!propSetBreakfasts) return;
    propSetBreakfasts(prevBreakfasts => {
      let updated = [...prevBreakfasts];
      if (updated.length === 0) {
        updated = [{ id: Date.now(), type: null, eggs: null, broth: null, riceBread: null, drink: null, protein: null, cutlery: null, address: propSavedAddress || {}, payment: null, additions: [], notes: '', time: null }];
      }
      const idx = Math.min(editingMealIndexRef.current, updated.length - 1);
      const bf = { ...updated[idx] };
      switch (selectionField) {
        case 'type': {
          const obj = option?.itemData || { name: value };
          bf.type = obj;
          break;
        }
        case 'broth': {
          const obj = option?.itemData || { name: value };
          bf.broth = obj;
          break;
        }
        case 'eggs': {
          const obj = option?.itemData || { name: value };
          bf.eggs = obj;
          break;
        }
        case 'riceBread': {
          const obj = option?.itemData || { name: value };
          bf.riceBread = obj;
          break;
        }
        case 'protein': {
          const obj = option?.itemData || { name: value };
          bf.protein = obj;
          break;
        }
        case 'drink': {
          const obj = option?.itemData || { name: value };
          bf.drink = obj;
          break;
        }
        case 'cutlery': {
          bf.cutlery = value === 'Sí, por favor' || value === 'Si, por favor';
          break;
        }
        case 'time': {
          const timeObj = { name: value };
          bf.time = timeObj;
          break;
        }
        case 'address': {
          bf.address = { ...(bf.address || {}), address: value || '' };
          break;
        }
        case 'phone': {
          bf.address = { ...(bf.address || {}), phoneNumber: value || '' };
          break;
        }
        case 'agreement': {
          bf.deliveryAgreement = true;
          break;
        }
        case 'payment': {
          const obj = option?.itemData || { name: value };
          bf.payment = obj;
          bf.paymentMethod = obj;
          break;
        }
        case 'notes': {
          bf.notes = value || '';
          break;
        }
        case 'additions': {
          if (option?.itemData) {
            const addItem = { ...option.itemData, quantity: 1 };
            bf.additions = [...(bf.additions || []), addItem];
          }
          break;
        }
        default: break;
      }
      updated[idx] = bf;
      return updated;
    });

    // Auto-advance the breakfast slider in the main form
    const BF_FIELD_TO_NEXT = {
      type: 'broth',       // After selecting type, next is broth (or eggs, depending on type)
      broth: 'eggs',
      eggs: 'riceBread',
      riceBread: 'drink',
      drink: 'protein',
      protein: 'cutlery',
      cutlery: 'time',
      time: 'address',
      address: 'deliveryAgreement',
      agreement: 'payment',
      payment: 'notes',
    };
    const nextField = BF_FIELD_TO_NEXT[selectionField];
    if (nextField) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('chatSyncAdvanceBreakfastSlide', { detail: { field: nextField } }));
      }, 150);
    }
  }, [propSetBreakfasts, propSavedAddress]);

  // ─── Sync chat → main form ──────────────────────────
  const syncChatToMainForm = useCallback((selectionField, value, option, selectedItems, flowId) => {
    // Route breakfast flows to breakfast sync
    if (flowId && (flowId.startsWith('bf') || flowId.startsWith('orderBreakfast'))) {
      syncBreakfastChatToMainForm(selectionField, value, option);
      return;
    }
    if (!propSetMeals) return;
    // Only sync lunch-related flows to meals
    if (flowId && !flowId.startsWith('lunch') && flowId !== 'orderLunch') return;
    propSetMeals(prevMeals => {
      let updatedMeals = [...prevMeals];
      if (updatedMeals.length === 0) {
        updatedMeals = [initializeMealData(propSavedAddress || {})];
      }
      const idx = Math.min(editingMealIndexRef.current, updatedMeals.length - 1);
      const meal = { ...updatedMeals[idx] };
      switch (selectionField) {
        case 'soup': {
          const obj = option?.itemData || menuData.soups?.find(s => s.name === value);
          if (obj) {
            meal.soup = obj;
            // Clear soupReplacement if not selecting a replacement
            if (value !== 'Remplazo por Sopa') {
              meal.soupReplacement = null;
            }
          }
          break;
        }
        case 'principle': {
          if (Array.isArray(selectedItems)) {
            meal.principle = selectedItems;
            // Clear principleReplacement if none of the selected items is a replacement
            const hasReplacement = selectedItems.some(p => p.name === 'Remplazo por Principio');
            if (!hasReplacement) {
              meal.principleReplacement = null;
            }
          } else if (value) {
            // Single principle selection from edit flow
            const obj = option?.itemData || menuData.principles?.find(p => p.name === value);
            if (obj) {
              meal.principle = [obj];
              if (value !== 'Remplazo por Principio') {
                meal.principleReplacement = null;
              }
            }
          }
          break;
        }
        case 'protein': {
          const obj = option?.itemData || menuData.proteins?.find(p => p.name === value);
          if (obj) meal.protein = obj;
          break;
        }
        case 'drink': {
          const obj = option?.itemData || menuData.drinks?.find(d => d.name === value);
          if (obj) meal.drink = obj;
          break;
        }
        case 'cutlery': {
          meal.cutlery = value === 'Sí, por favor' || value === 'Si, por favor';
          break;
        }
        case 'time': {
          const timeObj = menuData.times?.find(t => t.name === value) || { id: 0, name: value };
          meal.time = timeObj;
          break;
        }
        case 'address': {
          meal.address = { ...(meal.address || {}), address: value || '' };
          break;
        }
        case 'phone': {
          meal.address = { ...(meal.address || {}), phoneNumber: value || '' };
          break;
        }
        case 'agreement': {
          meal.deliveryAgreement = true;
          break;
        }
        case 'payment': {
          const obj = option?.itemData || menuData.paymentMethods?.find(p => p.name === value);
          if (obj) meal.payment = obj;
          break;
        }
        case 'sides': {
          if (Array.isArray(selectedItems)) meal.sides = selectedItems;
          break;
        }
        case 'notes': {
          meal.notes = value || '';
          break;
        }
        case 'additions': {
          if (Array.isArray(selectedItems)) {
            meal.additions = selectedItems;
          } else if (option?.itemData) {
            // Single addition from chat (may need a replacement sub-flow)
            const addItem = { ...option.itemData, quantity: 1, protein: '', replacement: '' };
            meal.additions = [...(meal.additions || []), addItem];
          }
          break;
        }
        case 'soupReplacement': {
          const obj = option?.itemData || menuData.soupReplacements?.find(r => r.name === value);
          if (obj) {
            meal.soupReplacement = obj;
            // Also set soup to 'Remplazo por Sopa' if not already
            const soupReplacementOption = menuData.soups?.find(s => s.name === 'Remplazo por Sopa');
            if (soupReplacementOption) meal.soup = soupReplacementOption;
          }
          break;
        }
        case 'principleReplacement': {
          const obj = option?.itemData || menuData.soupReplacements?.find(r => r.name === value);
          if (obj) {
            meal.principleReplacement = obj;
            // Also set principle to include 'Remplazo por Principio'
            const principleReplacementOption = menuData.principles?.find(p => p.name === 'Remplazo por Principio');
            if (principleReplacementOption) meal.principle = [principleReplacementOption];
          }
          break;
        }
        default: {
          // Handle addition replacement fields: addition_Sopa_adicional_replacement, etc.
          const addReplacementMatch = selectionField.match(/^addition_(.+)_replacement$/);
          if (addReplacementMatch) {
            const additionName = addReplacementMatch[1].replace(/_/g, ' ');
            const replacementName = option?.itemData?.name || value;
            meal.additions = (meal.additions || []).map(add => {
              if (add.name === additionName) {
                if (add.name === 'Proteína adicional') {
                  return { ...add, protein: replacementName };
                } else {
                  return { ...add, replacement: replacementName };
                }
              }
              return add;
            });
          }
          break;
        }
      }

      // Auto-advance the slider in the main form
      // Don't advance if user selected a replacement option that goes to a sub-menu
      const isGoingToReplacement = value === 'Remplazo por Sopa' || value === 'Remplazo por Principio';
      const FIELD_TO_NEXT_SLIDE = {
        soup: 1, soupReplacement: 1,
        principle: 2, principleReplacement: 2,
        protein: 3, drink: 4, cutlery: 5, time: 6,
        phone: 7, agreement: 8, payment: 9,
      };
      const nextSlide = FIELD_TO_NEXT_SLIDE[selectionField];
      if (nextSlide !== undefined && !isGoingToReplacement) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('chatSyncAdvanceSlide', { detail: { slideIndex: nextSlide } }));
        }, 100);
      }

      updatedMeals[idx] = meal;
      return updatedMeals;
    });
  }, [propSetMeals, menuData, propSavedAddress, syncBreakfastChatToMainForm]);

  // ─── Sync main form → chat (orderSelections) ────────
  const prevMealSyncRef = useRef(null);
  useEffect(() => {
    if (!propMeals?.length) return;
    const meal = propMeals[editingMealIndex];
    if (!meal) return;
    const currentKey = JSON.stringify({
      s: meal.soup?.name, sr: meal.soupReplacement?.name,
      pr: meal.principle?.map(p => p.name), prr: meal.principleReplacement?.name,
      pt: meal.protein?.name, d: meal.drink?.name,
      c: meal.cutlery, t: meal.time?.name,
      a: meal.address?.address, ph: meal.address?.phoneNumber,
      py: meal.payment?.name, si: meal.sides?.map(s => s.name),
      n: meal.notes, ag: meal.deliveryAgreement,
      ad: meal.additions?.map(a => a.name),
    });
    if (currentKey === prevMealSyncRef.current) return;
    prevMealSyncRef.current = currentKey;
    setOrderSelections(prev => {
      const upd = { ...prev };
      if (meal.soup) upd.soup = meal.soup.name === 'Solo bandeja' ? 'Solo bandeja (sin sopa)' : meal.soup.name;
      if (meal.soupReplacement) upd.soupReplacement = meal.soupReplacement.name;
      if (meal.principle?.length) upd.principle = meal.principle.map(p => p.name).join(', ');
      if (meal.principleReplacement) upd.principleReplacement = meal.principleReplacement.name;
      if (meal.protein) {
        upd.protein = meal.protein.name;
        if (meal.protein.price) upd.protein_price = meal.protein.price;
      }
      if (meal.drink) {
        upd.drink = meal.drink.name;
        if (meal.drink.price) upd.drink_price = meal.drink.price;
      }
      if (meal.cutlery !== null && meal.cutlery !== undefined) upd.cutlery = meal.cutlery ? 'Sí, por favor' : 'No, gracias';
      if (meal.time) upd.time = meal.time.name;
      if (meal.address?.address) upd.address = meal.address.address;
      if (meal.address?.phoneNumber) upd.phone = meal.address.phoneNumber;
      if (meal.payment) upd.payment = meal.payment.name;
      if (meal.sides?.length) upd.sides = meal.sides.map(s => s.name).join(', ');
      if (meal.notes) upd.notes = meal.notes;
      if (meal.deliveryAgreement) upd.agreement = '¡Acepto!';
      if (meal.additions?.length) upd.additions = meal.additions.map(a => a.name).join(', ');
      return upd;
    });
  }, [propMeals, editingMealIndex]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  // Generate unique ID
  const nextId = useCallback(() => {
    msgIdCounter.current += 1;
    return msgIdCounter.current;
  }, []);

  // ─── Send bot messages sequentially ──────────────────
  const sendBotMessages = useCallback(async (flow) => {
    if (!flow) return;
    setIsTyping(true);
    scrollToBottom();

    for (let i = 0; i < flow.messages.length; i++) {
      // Variable delay: first message fast, then slower
      const delay = i === 0 ? 400 : Math.min(TYPING_DELAY + flow.messages[i].length * 8, 1800);
      await new Promise(r => setTimeout(r, delay));

      setMessages(prev => [
        ...prev,
        { id: nextId(), type: 'bot', text: flow.messages[i], time: getTimeString() }
      ]);
      scrollToBottom();
    }

    setIsTyping(false);

    // Show options if any
    if (flow.options && flow.options.length > 0) {
      await new Promise(r => setTimeout(r, 200));
      setOptionSets(prev => [
        ...prev,
        {
          id: nextId(),
          options: flow.options,
          selectedIdx: null,
          flowId: flow.id,
          multiSelect: flow.multiSelect || false,
          maxSelections: flow.maxSelections || Infinity,
          selectedIndices: flow.multiSelect ? new Set() : null,
          confirmed: false,
        }
      ]);
      scrollToBottom();
    }

    // Handle expecting text input
    if (flow.expectsInput) {
      setExpectsInput(true);
      setPendingNextFlow(flow.nextFlowAfterInput || null);
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      setExpectsInput(false);
      setPendingNextFlow(null);
    }

    setCurrentFlow(flow);
    scrollToBottom();
  }, [nextId, scrollToBottom]);

  // ─── Start chat on first open ─────────────────────────
  useEffect(() => {
    if (isOpen && !hasStarted) {
      setHasStarted(true);
      sendBotMessages(flowsRef.current.welcome);
    }
  }, [isOpen, hasStarted, sendBotMessages]);

  // ─── Helper: verificar agotados y mostrar resumen o advertencia ───
  const handleBuildSummaryOrSoldOut = useCallback((nextFlowData, selections, allMeals) => {
    const isBreakfast = !!selections.type;
    const soldOut = checkSoldOutItems(allMeals, menuData, isBreakfast);

    if (soldOut.length > 0) {
      // Build warning message listing sold-out items
      let warning = '⚠️ ¡Atención! Algunas opciones se agotaron mientras hacías tu pedido:\n\n';
      soldOut.forEach(item => {
        warning += `${item.icon} ${item.fieldLabel}: ${item.itemName} — AGOTADO\n`;
        if (allMeals.length > 1) {
          warning += `   (${isBreakfast ? 'Desayuno' : 'Almuerzo'} #${item.mealIndex + 1})\n`;
        }
      });
      warning += '\nDebes cambiar estas opciones para poder confirmar.';

      // Show the modify flow options so user can fix
      const modifyFlowId = isBreakfast ? 'bfModify' : 'lunchModify';
      const modifyFlow = flowsRef.current[modifyFlowId];

      sendBotMessages({
        id: 'soldOutWarning',
        messages: [warning],
        options: modifyFlow ? modifyFlow.options : [
          { label: 'Modificar pedido', icon: '✏️', nextFlow: modifyFlowId },
          { label: 'Cancelar', icon: '❌', nextFlow: 'welcome' },
        ],
      });
    } else {
      // No sold-out items — show normal summary
      const summaryText = buildOrderSummary(selections, allMeals?.[allMeals?.length - 1], allMeals);
      sendBotMessages({ ...nextFlowData, messages: [summaryText] });
    }
  }, [menuData, sendBotMessages]);

  // ─── GUARDIA de cierre: flujos que requieren restaurante abierto ──
  const ORDER_FLOWS = new Set(['orderLunch', 'orderBreakfast']);
  const isClosedRightNow = useCallback(() => {
    const mt = menuData.getCurrentMenuType ? menuData.getCurrentMenuType() : 'closed';
    return mt === 'closed';
  }, [menuData]);

  const showClosedMessage = useCallback(() => {
    const schedules = menuData.schedules || { breakfastStart: 420, breakfastEnd: 631, lunchStart: 632, lunchEnd: 950 };
    const fmtT = (m) => { const h = Math.floor(m / 60); const mm = m % 60; const ap = h >= 12 ? 'PM' : 'AM'; return `${((h % 12) || 12)}:${String(mm).padStart(2, '0')} ${ap}`; };
    const msgs = [
      '🚫 En este momento estamos cerrados.',
      `⏰ Nuestros horarios de atención:\n🥐 Desayunos: ${fmtT(schedules.breakfastStart)} - ${fmtT(schedules.breakfastEnd)}\n🍲 Almuerzos: ${fmtT(schedules.lunchStart)} - ${fmtT(schedules.lunchEnd)}`,
      '¡Te esperamos mañana! 🙌'
    ];
    msgs.forEach((msg, i) => {
      setTimeout(() => {
        setMessages(prev => [...prev, { id: nextId(), type: 'bot', text: msg, time: getTimeString() }]);
        scrollToBottom();
      }, (i + 1) * 400);
    });
  }, [menuData, nextId, scrollToBottom]);

  // Ref para romper dependencia circular entre handleOptionClick y handleAIQuickReply
  const handleAIQuickReplyRef = useRef(null);

  // ─── Handle option click ─────────────────────────────
  const handleOptionClick = useCallback((optSetId, optionIdx, option) => {
    // ── AI Quick Reply: enviar como texto a la IA ──
    if (option.isAIQuickReply) {
      // Lock the option set
      setOptionSets(prev =>
        prev.map(os => os.id === optSetId ? { ...os, selectedIdx: optionIdx } : os)
      );
      if (handleAIQuickReplyRef.current) handleAIQuickReplyRef.current(option.label);
      return;
    }

    // Find the option set to get its flow info for selection tracking
    const optSet = optionSets.find(os => os.id === optSetId);
    const flow = optSet?.flowId ? flowsRef.current[optSet.flowId] : null;

    // Sold-out items cannot be selected
    if (option.isSoldOut) return;

    // ── MULTI-SELECT MODE ──
    if (optSet?.multiSelect && !option.isBack) {
      // "Ninguno" button: skip with no selection
      if (option.isNone) {
        setOptionSets(prev =>
          prev.map(os => os.id === optSetId ? { ...os, confirmed: true, selectedIdx: optionIdx } : os)
        );
        setMessages(prev => [...prev, { id: nextId(), type: 'user', text: `${option.icon} ${option.label}`, time: getTimeString() }]);
        scrollToBottom();
        // Sync: clear the multi-select field in main form
        if (flow?.selectionField) syncChatToMainForm(flow.selectionField, '', null, [], flow?.id);
        if (option.nextFlow && flowsRef.current[option.nextFlow]) {
          setTimeout(() => sendBotMessages(flowsRef.current[option.nextFlow]), 300);
        }
        return;
      }

      // Confirm button: collect all selected items and proceed
      if (option.isConfirm) {
        const selected = optSet.selectedIndices;
        if (!selected || selected.size === 0) return; // need at least 1

        const selectedLabels = [];
        optSet.options.forEach((opt, idx) => {
          if (selected.has(idx)) {
            selectedLabels.push(opt.itemData?.name || opt.label);
          }
        });
        const joinedValue = selectedLabels.join(', ');

        // Track the multi-selection
        let updatedSelections = { ...orderSelectionsRef.current };
        if (flow?.selectionField) {
          updatedSelections[flow.selectionField] = joinedValue;
        }
        setOrderSelections(updatedSelections);

        // Sync multi-select to main form
        if (flow?.selectionField) {
          const selectedItemsForSync = [];
          optSet.options.forEach((opt, idx) => {
            if (selected.has(idx) && opt.itemData) selectedItemsForSync.push(opt.itemData);
          });
          syncChatToMainForm(flow.selectionField, joinedValue, option, selectedItemsForSync, flow?.id);
        }

        // Mark confirmed
        setOptionSets(prev =>
          prev.map(os => os.id === optSetId ? { ...os, confirmed: true, selectedIdx: optionIdx } : os)
        );

        setMessages(prev => [...prev, { id: nextId(), type: 'user', text: `✅ ${joinedValue}`, time: getTimeString() }]);
        scrollToBottom();

        if (option.nextFlow && flowsRef.current[option.nextFlow]) {
          const nextFlowData = flowsRef.current[option.nextFlow];
          setTimeout(() => {
            if (nextFlowData.buildSummary) {
              const allMeals = updatedSelections.type ? propBreakfasts : propMeals;
              handleBuildSummaryOrSoldOut(nextFlowData, updatedSelections, allMeals);
            } else {
              sendBotMessages(nextFlowData);
            }
          }, 300);
        }
        return;
      }

      // "Select All" button: toggle all items
      if (option.isSelectAll) {
        setOptionSets(prev => prev.map(os => {
          if (os.id !== optSetId) return os;
          const newSelected = new Set(os.selectedIndices);
          const itemIndices = os.options.reduce((acc, opt, idx) => {
            if (!opt.isConfirm && !opt.isNone && !opt.isBack && !opt.isSelectAll) acc.push(idx);
            return acc;
          }, []);
          const allSelected = itemIndices.every(i => newSelected.has(i));
          if (allSelected) {
            itemIndices.forEach(i => newSelected.delete(i));
          } else {
            itemIndices.forEach(i => newSelected.add(i));
          }
          return { ...os, selectedIndices: newSelected };
        }));
        scrollToBottom();
        return;
      }

      // Toggle regular item
      setOptionSets(prev => prev.map(os => {
        if (os.id !== optSetId) return os;
        const newSelected = new Set(os.selectedIndices);
        if (newSelected.has(optionIdx)) {
          newSelected.delete(optionIdx);
        } else {
          if (os.maxSelections && newSelected.size >= os.maxSelections) return os; // limit
          newSelected.add(optionIdx);
        }
        return { ...os, selectedIndices: newSelected };
      }));
      scrollToBottom();
      return;
    }

    // ── BACK NAVIGATION ──
    // When clicking a "← Volver" button, skip sync/advance and move slider back
    const isBackOption = option.isBack || option.label?.startsWith('←');
    if (isBackOption && option.nextFlow) {
      // Mark selected
      setOptionSets(prev =>
        prev.map(os => os.id === optSetId ? { ...os, selectedIdx: optionIdx } : os)
      );
      setMessages(prev => [
        ...prev,
        { id: nextId(), type: 'user', text: `${option.icon} ${option.label}`, time: getTimeString() }
      ]);
      scrollToBottom();

      const targetFlow = flowsRef.current[option.nextFlow];
      if (targetFlow) {
        // Reset if going back to welcome/start
        if (targetFlow.resetsOrder) {
          setOrderSelections({});
          setEditingMealIndex(0);
          editingMealIndexRef.current = 0;
          if (propSetMeals) {
            propSetMeals(prev => prev.length > 0 ? [initializeMealData(propSavedAddress || {})] : prev);
          }
          if (propSetBreakfasts) {
            propSetBreakfasts(prev => prev.length > 0 ? [{ id: Date.now(), type: null, eggs: null, broth: null, riceBread: null, drink: null, protein: null, cutlery: null, address: propSavedAddress || {}, payment: null, additions: [], notes: '', time: null }] : prev);
          }
        }

        // Move slider BACK to the target step
        if (targetFlow.selectionField) {
          const FIELD_TO_SLIDE = {
            soup: 0, soupReplacement: 0,
            principle: 1, principleReplacement: 1,
            protein: 2, drink: 3, cutlery: 4, time: 5,
            address: 6, phone: 6, agreement: 7, payment: 8,
            sides: 9, notes: 9, additions: 9,
          };
          const targetSlide = FIELD_TO_SLIDE[targetFlow.selectionField];
          if (targetSlide !== undefined) {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('chatSyncAdvanceSlide', { detail: { slideIndex: targetSlide } }));
            }, 100);
          }
        }

        setTimeout(() => {
          if (targetFlow.buildSummary) {
            const allMeals = orderSelectionsRef.current.type ? propBreakfasts : propMeals;
            handleBuildSummaryOrSoldOut(targetFlow, orderSelectionsRef.current, allMeals);
          } else {
            sendBotMessages(targetFlow);
          }
        }, 300);
      }
      return;
    }

    // ── SINGLE-SELECT MODE (original) ──
    // Track selection: build updated selections with the new choice
    let updatedSelections = { ...orderSelectionsRef.current };
    if (flow?.selectionField) {
      const value = option.selectionValue || option.itemData?.name || option.label;
      updatedSelections[flow.selectionField] = value;
      // Store price data for summary calculation
      if (option.itemData?.price) {
        updatedSelections[flow.selectionField + '_price'] = option.itemData.price;
      }
    }
    // Extra selections (e.g., phone from saved address)
    if (option.extraSelections) {
      Object.assign(updatedSelections, option.extraSelections);
    }
    setOrderSelections(updatedSelections);

    // Sync single-select to main form
    if (flow?.selectionField) {
      const syncValue = option.selectionValue || option.itemData?.name || option.label;
      syncChatToMainForm(flow.selectionField, syncValue, option, null, flow?.id);
      if (option.extraSelections?.phone) {
        syncChatToMainForm('phone', option.extraSelections.phone, null, null, flow?.id);
      }
    }

    // Mark selected option
    setOptionSets(prev =>
      prev.map(os =>
        os.id === optSetId ? { ...os, selectedIdx: optionIdx } : os
      )
    );

    // Add user message (their selection)
    setMessages(prev => [
      ...prev,
      { id: nextId(), type: 'user', text: `${option.icon} ${option.label}`, time: getTimeString() }
    ]);
    scrollToBottom();

    // ── DUPLICATE / ADD NEW MEAL ──
    if (option.isDuplicate && propSetMeals && propMeals?.length > 0) {
      // Duplicate current lunch in main form
      const mealToDuplicate = propMeals[propMeals.length - 1]; // duplicate the latest
      const newCount = propMeals.length + 1;
      propSetMeals(prev => {
        const newId = Math.max(...prev.map(m => m.id), 0) + 1;
        const dup = JSON.parse(JSON.stringify({ ...mealToDuplicate, id: newId, __startCollapsed: true }));
        return [...prev, dup].map((m, i) => ({ ...m, id: i }));
      });
      // Inject confirmation with count
      setMessages(prev => [
        ...prev,
        { id: nextId(), type: 'bot', text: `✅ ¡Almuerzo duplicado! Ahora tienes ${newCount} almuerzos.`, time: getTimeString() }
      ]);
    }
    if (option.isAddNew && propSetMeals) {
      // Add blank meal in main form, then restart lunch order flow for meal #2+
      const newMealIndex = propMeals?.length || 0;
      setEditingMealIndex(newMealIndex);
      editingMealIndexRef.current = newMealIndex;
      const newMeal = initializeMealData(propSavedAddress || {});
      if (propMeals?.length > 0) {
        const first = propMeals[0];
        if (first.time) newMeal.time = first.time;
        if (first.address) newMeal.address = first.address;
        if (first.payment) newMeal.payment = first.payment;
      }
      propSetMeals(prev => {
        const newId = Math.max(...prev.map(m => m.id), 0) + 1;
        return [...prev, { ...newMeal, id: newId }];
      });
      // Reset chat selections for new meal (keep address/phone/time/payment)
      const keepKeys = ['address', 'phone', 'time', 'payment', 'agreement', 'cutlery'];
      const preserved = {};
      keepKeys.forEach(k => { if (updatedSelections[k]) preserved[k] = updatedSelections[k]; });
      updatedSelections = { ...preserved };
      setOrderSelections(updatedSelections);
    }
    if (option.isDuplicateBreakfast && propSetBreakfasts && propBreakfasts?.length > 0) {
      const bfToDuplicate = propBreakfasts[propBreakfasts.length - 1];
      const newCount = propBreakfasts.length + 1;
      propSetBreakfasts(prev => {
        const newId = Math.max(...prev.map(b => b.id), 0) + 1;
        const dup = JSON.parse(JSON.stringify({ ...bfToDuplicate, id: newId }));
        return [...prev, dup].map((b, i) => ({ ...b, id: i }));
      });
      // Inject confirmation with count
      setMessages(prev => [
        ...prev,
        { id: nextId(), type: 'bot', text: `✅ ¡Desayuno duplicado! Ahora tienes ${newCount} desayunos.`, time: getTimeString() }
      ]);
    }
    if (option.isAddNewBreakfast && propSetBreakfasts) {
      const newBfIndex = propBreakfasts?.length || 0;
      setEditingMealIndex(newBfIndex);
      editingMealIndexRef.current = newBfIndex;
      const newBf = { id: Date.now(), type: null, eggs: null, broth: null, riceBread: null, drink: null, protein: null, cutlery: null, address: propSavedAddress || {}, payment: null, additions: [], notes: '', time: null };
      if (propBreakfasts?.length > 0) {
        const first = propBreakfasts[0];
        if (first.time) newBf.time = first.time;
        if (first.address) newBf.address = first.address;
        if (first.payment) newBf.payment = first.payment;
      }
      propSetBreakfasts(prev => {
        const newId = Math.max(...prev.map(b => b.id), 0) + 1;
        return [...prev, { ...newBf, id: newId }];
      });
      // Reset chat selections for new breakfast
      const keepKeys = ['address', 'phone', 'time', 'payment', 'agreement', 'cutlery'];
      const preserved = {};
      keepKeys.forEach(k => { if (updatedSelections[k]) preserved[k] = updatedSelections[k]; });
      updatedSelections = { ...preserved };
      setOrderSelections(updatedSelections);
    }

    // ── MEAL SELECTOR FOR MODIFY ──
    if (option.selectMealIndex !== undefined) {
      const selIdx = option.selectMealIndex;
      setEditingMealIndex(selIdx);
      editingMealIndexRef.current = selIdx;
    }
    if (option.selectBreakfastIndex !== undefined) {
      const selIdx = option.selectBreakfastIndex;
      setEditingMealIndex(selIdx);
      editingMealIndexRef.current = selIdx;
    }

    // Handle WhatsApp action – open WhatsApp with order message, then show success
    if (option.whatsappAction) {
      // ── GUARDIA: verificar en tiempo real si el restaurante está cerrado ──
      if (isClosedRightNow()) {
        showClosedMessage();
        return;
      }
      const isBreakfast = !!updatedSelections.type;
      const activeMeals = isBreakfast ? propBreakfasts : propMeals;
      const msg = buildWhatsAppMessage(updatedSelections, activeMeals?.[activeMeals.length - 1], activeMeals);

      // Save order to Firestore (same as main app) before opening WhatsApp
      if (saveOrder) {
        try {
          saveOrder(activeMeals, false, isBreakfast);
        } catch (e) {
          console.warn('Error al guardar pedido desde chat:', e);
        }
      }

      openWhatsApp(RESTAURANT_PHONE, msg);
      // Notify main app to show OrderConfirmedScreen
      if (onOrderConfirmed) {
        onOrderConfirmed(msg);
      }
      // Navigate to success flow after opening WhatsApp
      if (flowsRef.current.orderSuccess) {
        setTimeout(() => sendBotMessages(flowsRef.current.orderSuccess), 500);
      }
      return;
    }

    // Navigate to next flow
    if (option.nextFlow && flowsRef.current[option.nextFlow]) {
      // ── GUARDIA: bloquear acceso a flujos de pedido si el restaurante cerró ──
      if (ORDER_FLOWS.has(option.nextFlow) && isClosedRightNow()) {
        showClosedMessage();
        return;
      }
      const nextFlowData = flowsRef.current[option.nextFlow];

      // ── Intercept modify when multiple meals: show selector first ──
      if (option.nextFlow === 'lunchModify' && propMeals?.length > 1 && option.selectMealIndex === undefined) {
        const selectorFlow = {
          id: 'lunchMealSelector',
          messages: [`🍽️ Tienes ${propMeals.length} almuerzos. ¿Cuál quieres modificar?`],
          options: propMeals.map((m, i) => ({
            label: `Almuerzo #${i + 1} – ${m.protein?.name || 'Sin proteína'}`,
            icon: '🍽️',
            nextFlow: 'lunchModify',
            selectMealIndex: i,
          })),
        };
        setTimeout(() => sendBotMessages(selectorFlow), 300);
        return;
      }
      if (option.nextFlow === 'bfModify' && propBreakfasts?.length > 1 && option.selectBreakfastIndex === undefined) {
        const selectorFlow = {
          id: 'bfMealSelector',
          messages: [`🥐 Tienes ${propBreakfasts.length} desayunos. ¿Cuál quieres modificar?`],
          options: propBreakfasts.map((b, i) => ({
            label: `Desayuno #${i + 1} – ${b.type?.name || 'Sin tipo'}`,
            icon: '🥐',
            nextFlow: 'bfModify',
            selectBreakfastIndex: i,
          })),
        };
        setTimeout(() => sendBotMessages(selectorFlow), 300);
        return;
      }
      if (option.isModifyBreakfast && propBreakfasts?.length > 1 && option.selectBreakfastIndex === undefined) {
        const selectorFlow = {
          id: 'bfMealSelector',
          messages: [`🥐 Tienes ${propBreakfasts.length} desayunos. ¿Cuál quieres modificar?`],
          options: propBreakfasts.map((b, i) => ({
            label: `Desayuno #${i + 1} – ${b.type?.name || 'Sin tipo'}`,
            icon: '🥐',
            nextFlow: 'orderBreakfast',
            selectBreakfastIndex: i,
          })),
        };
        setTimeout(() => sendBotMessages(selectorFlow), 300);
        return;
      }

      // Reset selections if the flow resets order (like going back to welcome)
      if (nextFlowData.resetsOrder) {
        updatedSelections = {};
        setOrderSelections({});
        setEditingMealIndex(0);
        editingMealIndexRef.current = 0;
        // Reset main form meal too
        if (propSetMeals) {
          propSetMeals(prev => prev.length > 0 ? [initializeMealData(propSavedAddress || {})] : prev);
        }
        if (propSetBreakfasts) {
          propSetBreakfasts(prev => prev.length > 0 ? [{ id: Date.now(), type: null, eggs: null, broth: null, riceBread: null, drink: null, protein: null, cutlery: null, address: propSavedAddress || {}, payment: null, additions: [], notes: '', time: null }] : prev);
        }
      }

      setTimeout(() => {
        // If next flow has buildSummary, inject dynamic summary messages
        if (nextFlowData.buildSummary) {
          const allMeals = updatedSelections.type ? propBreakfasts : propMeals;
          handleBuildSummaryOrSoldOut(nextFlowData, updatedSelections, allMeals);
        } else {
          sendBotMessages(nextFlowData);
        }
      }, 300);
    }
  }, [optionSets, nextId, scrollToBottom, sendBotMessages, syncChatToMainForm, handleBuildSummaryOrSoldOut, propMeals, propBreakfasts, propSetMeals, propSetBreakfasts, propSavedAddress, isClosedRightNow, showClosedMessage]);

  // ─── Handle AI response display ──────────────────────
  const showAIResponse = useCallback((response) => {
    // Show AI text reply
    setMessages(prev => [
      ...prev,
      { id: nextId(), type: 'bot', text: response.reply, time: getTimeString() }
    ]);
    scrollToBottom();

    // Show quick replies as options
    if (response.quickReplies && response.quickReplies.length > 0) {
      setTimeout(() => {
        setOptionSets(prev => [
          ...prev,
          {
            id: nextId(),
            options: response.quickReplies.map(label => ({
              label,
              icon: '',
              isAIQuickReply: true,
            })),
            selectedIdx: null,
            flowId: '__ai__',
          }
        ]);
        scrollToBottom();
      }, 200);
    }
  }, [nextId, scrollToBottom]);

  // ─── Handle Voice Input ──────────────────────────────
  const handleVoiceInput = useCallback(async () => {
    if (isListening) {
      stopListening();
      return;
    }
    const transcript = await startListening();
    if (transcript) {
      setInputValue(transcript);
      // Auto-activate AI mode for voice input
      if (!isAIMode && aiAvailable) setIsAIMode(true);
    }
  }, [isListening, startListening, stopListening, isAIMode, aiAvailable, setIsAIMode]);

  // ─── Handle text input ───────────────────────────────
  const handleSendText = useCallback(async () => {
    const text = inputValue.trim();
    if (!text) return;

    // Add user message
    setMessages(prev => [
      ...prev,
      { id: nextId(), type: 'user', text, time: getTimeString() }
    ]);
    setInputValue('');
    scrollToBottom();

    // ── AI MODE: enviar a la IA ──
    if (isAIMode && aiAvailable) {
      setIsTyping(true);
      scrollToBottom();
      const response = await sendToAI(text);
      setIsTyping(false);
      if (response) {
        if (response.aiUnavailable) {
          // IA no disponible, fallback a flujos
          showAIResponse(response);
          return;
        }
        showAIResponse(response);
      }
      return;
    }

    // If expecting input for a flow (like address, phone, notes)
    if (expectsInput && pendingNextFlow) {
      // Track the text input under the current flow's selectionField
      const updatedSel = { ...orderSelectionsRef.current };
      if (currentFlow?.selectionField) {
        updatedSel[currentFlow.selectionField] = text;
        setOrderSelections(updatedSel);
        syncChatToMainForm(currentFlow.selectionField, text, null, null, currentFlow?.id);
      }
      setExpectsInput(false);
      setPendingNextFlow(null);
      setTimeout(() => {
        const nextFlowData = flowsRef.current[pendingNextFlow];
        if (nextFlowData?.buildSummary) {
          const allMeals = updatedSel.type ? propBreakfasts : propMeals;
          handleBuildSummaryOrSoldOut(nextFlowData, updatedSel, allMeals);
        } else {
          sendBotMessages(nextFlowData);
        }
      }, 500);
      return;
    }

    // Try smart response matching
    const smartMatch = findSmartResponse(text);
    if (smartMatch) {
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          { id: nextId(), type: 'bot', text: smartMatch.response, time: getTimeString() }
        ]);
        scrollToBottom();

        if (smartMatch.nextFlow && flowsRef.current[smartMatch.nextFlow]) {
          setTimeout(() => {
            sendBotMessages(flowsRef.current[smartMatch.nextFlow]);
          }, 600);
        }
      }, 800);
      return;
    }

    // If AI is available, try AI as fallback instead of "no entendí"
    if (aiAvailable) {
      setIsAIMode(true);
      setIsTyping(true);
      scrollToBottom();
      const response = await sendToAI(text);
      setIsTyping(false);
      if (response && !response.aiUnavailable) {
        showAIResponse(response);
        return;
      }
      // If AI failed, fall through to default fallback
      setIsAIMode(false);
    }

    // Default fallback response
    setTimeout(() => {
      const fallbackMessages = [
        'Hmm, no estoy seguro de entender. 🤔',
        'Déjame mostrarte las opciones disponibles:'
      ];
      fallbackMessages.forEach((msg, i) => {
        setTimeout(() => {
          setMessages(prev => [
            ...prev,
            { id: nextId(), type: 'bot', text: msg, time: getTimeString() }
          ]);
          scrollToBottom();
        }, (i + 1) * 600);
      });

      setTimeout(() => {
        sendBotMessages(flowsRef.current.welcome);
      }, fallbackMessages.length * 600 + 400);
    }, 800);
  }, [inputValue, expectsInput, pendingNextFlow, currentFlow, nextId, scrollToBottom, sendBotMessages, syncChatToMainForm, propMeals, propBreakfasts, isAIMode, aiAvailable, sendToAI, showAIResponse, setIsAIMode]);

  // ─── Handle AI quick reply click ─────────────────────
  const handleAIQuickReply = useCallback(async (label) => {
    // Add user message
    setMessages(prev => [
      ...prev,
      { id: nextId(), type: 'user', text: label, time: getTimeString() }
    ]);
    scrollToBottom();

    if (label === 'Ver menú' || label === 'Usar menú con botones') {
      setIsAIMode(false);
      setTimeout(() => sendBotMessages(flowsRef.current.welcome), 400);
      return;
    }
    if (label === 'Ir a WhatsApp' || label === 'Llamar por WhatsApp') {
      openWhatsApp(RESTAURANT_PHONE, '¡Hola! Quiero hacer un pedido');
      return;
    }

    setIsTyping(true);
    scrollToBottom();
    const response = await sendToAI(label);
    setIsTyping(false);
    if (response) showAIResponse(response);
  }, [nextId, scrollToBottom, sendToAI, showAIResponse, sendBotMessages, setIsAIMode]);
  // Keep ref in sync for handleOptionClick to use
  useEffect(() => { handleAIQuickReplyRef.current = handleAIQuickReply; }, [handleAIQuickReply]);

  // ─── Keyboard handler ────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  // ─── Toggle open ─────────────────────────────────────
  const toggleChat = () => {
    setIsOpen(prev => !prev);
    if (!isOpen) setUnread(0);
  };

  // ─── Notification on first load ──────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen && !hasStarted) setUnread(1);
    }, 3000);
    return () => clearTimeout(timer);
  }, [isOpen, hasStarted]);

  // ─── Render ────────────────────────────────────────
  return (
    <>
      {/* Chat Window */}
      <div className={`chat-window ${isOpen ? 'is-visible' : ''}`}>
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-avatar">🤖</div>
          <div className="chat-header-info">
            <div className="chat-header-name">Asistente Virtual</div>
            <div className="chat-header-status">
              <span className="status-dot" />
              En línea
            </div>
          </div>
          <button className="chat-header-close" onClick={() => setIsOpen(false)} aria-label="Cerrar chat">
            <CloseIcon />
          </button>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {/* Date separator */}
          <div className="chat-date-separator">
            <span>Hoy</span>
          </div>

          {/* Render messages and option sets interleaved by ID */}
          {(() => {
            // Merge messages and option sets, sort by id
            const allItems = [
              ...messages.map(m => ({ ...m, itemType: 'message' })),
              ...optionSets.map(os => ({ ...os, itemType: 'options' }))
            ].sort((a, b) => a.id - b.id);

            return allItems.map((item, idx) => {
              if (item.itemType === 'message') {
                const prevItem = allItems[idx - 1];
                const isGroupFirst = !prevItem || prevItem.itemType !== 'message' || prevItem.type !== item.type;

                return (
                  <div
                    key={`msg-${item.id}`}
                    className={`chat-msg ${item.type} ${isGroupFirst ? 'group-first' : ''}`}
                  >
                    <div>{item.text}</div>
                    <div className="chat-msg-time">{item.time}</div>
                  </div>
                );
              }

              if (item.itemType === 'options') {
                const isMulti = item.multiSelect;
                const isLocked = isMulti ? item.confirmed : item.selectedIdx !== null;

                return (
                  <div key={`opts-${item.id}`} className="chat-options">
                    {item.options.map((opt, oi) => {
                      // Multi-select: check if item is toggled in selectedIndices
                      const isMultiSelected = isMulti && item.selectedIndices?.has(oi);
                      // Single-select: check selectedIdx
                      const isSingleSelected = !isMulti && item.selectedIdx === oi;

                      // Hide confirm button when nothing selected (multi-select)
                      if (isMulti && opt.isConfirm && (!item.selectedIndices || item.selectedIndices.size === 0) && !isLocked) {
                        return null;
                      }

                      return (
                        <button
                          key={oi}
                          className={`chat-option-btn${
                            opt.whatsappAction ? ' whatsapp-action' : ''
                          }${
                            opt.isConfirm ? ' confirm-action' : ''
                          }${
                            opt.isSoldOut ? ' sold-out' : ''
                          }${
                            opt.isSelectAll ? ' select-all-action' : ''
                          }${
                            isMulti
                              ? (isLocked
                                  ? (isMultiSelected ? ' selected' : isSingleSelected ? ' selected' : ' not-selected')
                                  : (isMultiSelected ? ' multi-selected' : ''))
                              : (isLocked
                                  ? (isSingleSelected ? ' selected' : ' not-selected')
                                  : '')
                          }`}
                          onClick={() => handleOptionClick(item.id, oi, opt)}
                          disabled={(isLocked && !opt.whatsappAction) || opt.isSoldOut}
                        >
                          <span className="chat-option-icon">{isMultiSelected && !opt.isConfirm ? '✅' : opt.icon}</span>
                          <span className="chat-option-label">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              }

              return null;
            });
          })()}

          {/* Typing indicator */}
          {isTyping && (
            <div className="chat-typing">
              <div className="chat-typing-dot" />
              <div className="chat-typing-dot" />
              <div className="chat-typing-dot" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="chat-input-area">
          {/* AI mode toggle */}
          {aiAvailable && (
            <button
              className={`chat-ai-toggle ${isAIMode ? 'active' : ''}`}
              onClick={() => {
                toggleAIMode();
                if (!isAIMode) {
                  resetAIChat();
                  setMessages(prev => [
                    ...prev,
                    { id: nextId(), type: 'bot', text: '🤖 Modo IA activado. ¡Háblame o escríbeme lo que quieres pedir!', time: getTimeString() }
                  ]);
                } else {
                  setMessages(prev => [
                    ...prev,
                    { id: nextId(), type: 'bot', text: '📋 Modo botones activado.', time: getTimeString() }
                  ]);
                  setTimeout(() => sendBotMessages(flowsRef.current.welcome), 400);
                }
                scrollToBottom();
              }}
              title={isAIMode ? 'Cambiar a botones' : 'Activar asistente IA'}
              aria-label={isAIMode ? 'Cambiar a botones' : 'Activar asistente IA'}
            >
              <AIIcon />
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            className="chat-input"
            placeholder={
              isAILoading ? 'La IA está pensando...'
              : isListening ? '🎤 Escuchando...'
              : isAIMode ? 'Dime qué quieres pedir...'
              : expectsInput
                ? (currentFlow?.inputPlaceholder || 'Escribe aquí...')
                : 'Escribe un mensaje...'
            }
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isAILoading || isListening}
          />
          {/* Voice button */}
          {hasSpeechSupport && (
            <button
              className={`chat-voice-btn ${isListening ? 'listening' : ''}`}
              onClick={handleVoiceInput}
              disabled={isAILoading}
              title={isListening ? 'Detener' : 'Hablar'}
              aria-label={isListening ? 'Detener grabación' : 'Enviar mensaje de voz'}
            >
              <MicIcon />
            </button>
          )}
          <button
            className="chat-send-btn"
            onClick={handleSendText}
            disabled={!inputValue.trim() || isAILoading}
            aria-label="Enviar mensaje"
          >
            <SendIcon />
          </button>
        </div>
      </div>

      {/* Floating Button */}
      <button
        className={`chat-float-btn ${isOpen ? 'is-open' : ''}`}
        onClick={toggleChat}
        aria-label={isOpen ? 'Cerrar chat' : 'Abrir chat'}
      >
        {isOpen ? (
          <CloseIcon />
        ) : (
          <>
            <WhatsAppIcon />
            {unread > 0 && <span className="chat-unread-badge">{unread}</span>}
          </>
        )}
      </button>
    </>
  );
};

export default ChatWidget;
