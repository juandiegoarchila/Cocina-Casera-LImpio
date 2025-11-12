// Script para corregir pedidos anteriores usando Firebase Admin
const admin = require('firebase-admin');

// Configuración usando variables de entorno o credenciales directas
const serviceAccount = {
  "type": "service_account",
  "project_id": "cocina-casera-b33a7"
  // Necesitarías las credenciales completas aquí
};

// Inicializar sin credenciales por ahora (para mostrar la estructura)
console.log('Script para corregir pedidos anteriores');
console.log('');
console.log('Necesitas ejecutar este comando SQL-like en Firestore Console:');
console.log('');
console.log('1. Ve a Firebase Console → Firestore Database');
console.log('2. Busca la colección "breakfastOrders"');
console.log('3. Filtra por tableNumber == "llevar"');
console.log('4. Para cada documento encontrado:');
console.log('   - Cambiar serviceType a "llevar"');
console.log('   - Cambiar orderTypeNormalized a "desayuno_llevar"');
console.log('   - Agregar takeaway: true');
console.log('   - Quitar el campo tableNumber');
console.log('');
console.log('O ejecuta estas actualizaciones manualmente en Firebase Console:');

// Función para mostrar las actualizaciones necesarias
function showRequiredUpdates() {
  console.log('\n=== ACTUALIZACIONES REQUERIDAS ===\n');
  
  console.log('Para pedidos con tableNumber = "llevar":');
  console.log('{');
  console.log('  serviceType: "llevar",');
  console.log('  orderTypeNormalized: "desayuno_llevar",');
  console.log('  takeaway: true');
  console.log('  // Remover: tableNumber');
  console.log('}');
  
  console.log('\nEsto debería aplicarse a los pedidos #4 y #5 ($8,000 y $10,000)');
}

showRequiredUpdates();