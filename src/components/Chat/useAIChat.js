// src/components/Chat/useAIChat.js
// Hook para manejar el chat con IA y entrada de voz
import { useState, useCallback, useRef, useEffect } from 'react';
import { sendAIMessage } from '../../services/aiChat';

// ─── Web Speech API (voz a texto) ─────────────────────────
const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

/**
 * Hook que maneja el chat con IA y reconocimiento de voz
 * @param {object} menuData - Datos del menú desde useMenuData
 * @param {function} onOrderComplete - Callback cuando el pedido está confirmado
 */
export function useAIChat(menuData, onOrderComplete) {
  const [isAIMode, setIsAIMode] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [aiOrderData, setAiOrderData] = useState(null);
  const [aiAvailable, setAiAvailable] = useState(true); // Optimista
  const conversationHistory = useRef([]);
  const recognitionRef = useRef(null);

  // Verificar disponibilidad de la IA al montar (pero no bloquear)
  useEffect(() => {
    // No hacer ping innecesario, asumimos que está disponible
    // Si falla la primera llamada, se marca como no disponible
  }, []);

  // ─── Enviar mensaje a la IA ─────────────────────────────
  const sendToAI = useCallback(async (text) => {
    if (!text.trim()) return null;

    setIsAILoading(true);

    // Agregar al historial
    conversationHistory.current.push({ role: 'user', text });

    try {
      const response = await sendAIMessage(text, menuData, conversationHistory.current);

      // Si la IA no está disponible, desactivar modo IA
      if (response.aiUnavailable) {
        setAiAvailable(false);
        setIsAIMode(false);
        return response;
      }

      // Agregar respuesta al historial
      conversationHistory.current.push({ role: 'model', text: response.reply });

      // Actualizar datos del pedido
      if (response.orderData) {
        setAiOrderData(prev => ({
          ...(prev || {}),
          ...response.orderData,
        }));
      }

      // Si el pedido está completo y confirmado
      if (response.isOrderComplete && response.orderData && onOrderComplete) {
        onOrderComplete(response.orderData);
      }

      return response;
    } catch (error) {
      console.error('Error en sendToAI:', error);
      return {
        reply: '😅 Tuve un error. ¿Puedes intentar de nuevo?',
        orderData: null,
        isOrderComplete: false,
        quickReplies: ['Intentar de nuevo'],
        error: true,
      };
    } finally {
      setIsAILoading(false);
    }
  }, [menuData, onOrderComplete]);

  // ─── Reconocimiento de voz ──────────────────────────────
  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.');
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CO';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        alert('Permite el acceso al micrófono para usar comandos de voz.');
      }
    };

    recognitionRef.current = recognition;

    // Retornar una promesa que se resuelve con el texto reconocido
    return new Promise((resolve) => {
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        resolve(transcript);
      };
      recognition.onerror = (event) => {
        setIsListening(false);
        resolve(null);
      };
      recognition.onend = () => {
        setIsListening(false);
      };
      recognition.start();
    });
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // ─── Resetear conversación IA ───────────────────────────
  const resetAIChat = useCallback(() => {
    conversationHistory.current = [];
    setAiOrderData(null);
  }, []);

  // ─── Toggle modo IA ────────────────────────────────────
  const toggleAIMode = useCallback(() => {
    setIsAIMode(prev => !prev);
  }, []);

  // Limpiar recognition al desmontar
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return {
    // Estado
    isAIMode,
    isAILoading,
    isListening,
    aiOrderData,
    aiAvailable,
    hasSpeechSupport: !!SpeechRecognition,

    // Acciones
    sendToAI,
    startListening,
    stopListening,
    resetAIChat,
    toggleAIMode,
    setIsAIMode,
  };
}
