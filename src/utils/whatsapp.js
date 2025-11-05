// src/utils/whatsapp.js
// Utilidades para construir enlaces de WhatsApp y normalizar teléfonos (Colombia)
import { isMobile } from './Helpers';

// Normaliza un número colombiano:
// - Elimina caracteres no numéricos
// - Si tiene 10 dígitos, antepone 57
// - Si ya empieza por 57 y tiene 12 dígitos, lo deja igual
// - Si empieza por 0 o 60 (fijo), intenta anteponer 57 igualmente
export const normalizeColombiaPhone = (raw) => {
  if (!raw) return null;
  let digits = String(raw).replace(/\D+/g, '');
  if (!digits) return null;

  // Quitar ceros líderes innecesarios
  digits = digits.replace(/^0+/, '');

  if (digits.length === 10) {
    // Ej: 320XXXXXXX
    return `57${digits}`;
  }
  if (digits.startsWith('57') && (digits.length === 11 || digits.length === 12)) {
    // Algunos números podrían venir con 57 + 9 o 10 por errores; aceptamos 57 + 10 como válido (12)
    // Si tiene 11, probablemente perdió un dígito; en ese caso, no es confiable
    return digits.length === 12 ? digits : null;
  }
  if ((digits.startsWith('60') || digits.startsWith('1')) && digits.length >= 7) {
    // Fijos con indicativos (Bogotá 601...), intentamos enviar igualmente con 57 delante
    return `57${digits}`;
  }

  // Como fallback, si tiene entre 7 y 15 dígitos, intentar con 57
  if (digits.length >= 7 && digits.length <= 15) {
    return digits.startsWith('57') ? digits : `57${digits}`;
  }

  return null;
};

export const buildWhatsAppUrl = (phone, message) => {
  const normalized = normalizeColombiaPhone(phone);
  if (!normalized) return null;
  const text = encodeURIComponent(message || '');

  // Prioridad por plataforma:
  // - Móvil: esquema nativo whatsapp:// (con fallback a wa.me)
  // - Escritorio: web.whatsapp.com (con fallback a wa.me)
  if (typeof window !== 'undefined') {
    if (isMobile && isMobile()) {
      return `whatsapp://send?phone=${normalized}${text ? `&text=${text}` : ''}`;
    }
    return `https://web.whatsapp.com/send?phone=${normalized}${text ? `&text=${text}` : ''}`;
  }
  // Fallback genérico
  return `https://wa.me/${normalized}${text ? `?text=${text}` : ''}`;
};

export const openWhatsApp = (phone, message) => {
  const normalized = normalizeColombiaPhone(phone);
  if (!normalized) return false;
  const text = encodeURIComponent(message || '');

  const urls = [];
  if (typeof window !== 'undefined') {
    if (isMobile && isMobile()) {
      urls.push(`whatsapp://send?phone=${normalized}${text ? `&text=${text}` : ''}`);
      urls.push(`https://wa.me/${normalized}${text ? `?text=${text}` : ''}`);
    } else {
      urls.push(`https://web.whatsapp.com/send?phone=${normalized}${text ? `&text=${text}` : ''}`);
      urls.push(`https://wa.me/${normalized}${text ? `?text=${text}` : ''}`);
    }
  } else {
    urls.push(`https://wa.me/${normalized}${text ? `?text=${text}` : ''}`);
  }

  for (const url of urls) {
    try {
      const w = window.open(url, '_blank', 'noopener,noreferrer');
      if (w) return true;
    } catch (_) {
      // intentar siguiente
    }
  }
  return false;
};
