const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://servi-96624.firebaseio.com'
});

const db = admin.firestore();

const INGRESOS_COLLECTION = 'Ingresos';
const PEDIDOS_DIARIOS_GUARDADOS_COLLECTION = 'PedidosDiariosGuardados';

const deleteFakeData = async () => {
  const startDate = '2025-01-01';
  const endDate = '2025-07-16';
  
  for (const col of [INGRESOS_COLLECTION, PEDIDOS_DIARIOS_GUARDADOS_COLLECTION]) {
    const q = db.collection(col).where('date', '>=', startDate).where('date', '<=', endDate);
    const snapshot = await q.get();
    for (const doc of snapshot.docs) {
      await doc.ref.delete();
      console.log(`Eliminado documento ${doc.id} de ${col}`);
    }
  }
  
  console.log('Datos falsos eliminados.');
};

deleteFakeData().catch((error) => {
  console.error('Error al eliminar datos:', error);
});

// node scripts/deleteFakeData.js