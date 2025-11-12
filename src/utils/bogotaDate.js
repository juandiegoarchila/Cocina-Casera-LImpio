// Devuelve la fecha local de Colombia (Bogotá) en formato YYYY-MM-DD
export function getColombiaLocalDateString(date = new Date()) {
  // Usar Intl.DateTimeFormat con zona horaria de Bogotá para obtener la fecha correcta
  const fmt = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'America/Bogota', 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  });
  return fmt.format(date); // Retorna 'YYYY-MM-DD' directamente
}
