// Script para corregir pedidos existentes que tienen "llevar" en tableNumber
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, query, where } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAQdm6s0LSGJXlyv4MKjHaFH7F1R3Jp3Lo",
  authDomain: "cocina-casera-b33a7.firebaseapp.com",
  projectId: "cocina-casera-b33a7",
  storageBucket: "cocina-casera-b33a7.appspot.com",
  messagingSenderId: "742507826180",
  appId: "1:742507826180:web:88230f774f0c1e6e4ba8b1",
  measurementId: "G-P7C8MJP7M6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixLlevarOrders() {
  console.log('🔍 Buscando pedidos con tableNumber = "llevar"...');
  
  try {
    // Buscar en breakfastOrders (pedidos del POS van aquí)
    const breakfastOrdersRef = collection(db, 'breakfastOrders');
    const breakfastSnapshot = await getDocs(breakfastOrdersRef);
    
    let fixed = 0;
    let found = 0;
    
    console.log(`📊 Total documentos en breakfastOrders: ${breakfastSnapshot.size}`);
    
    for (const docSnap of breakfastSnapshot.docs) {
      const data = docSnap.data();
      const id = docSnap.id;
      
      // Mostrar información de cada pedido
      console.log(`\n📋 Pedido ${id}:`, {
        tableNumber: data.tableNumber,
        serviceType: data.serviceType,
        orderTypeNormalized: data.orderTypeNormalized,
        total: data.total,
        takeaway: data.takeaway
      });
      
      // Verificar si tiene tableNumber = "llevar"
      if (data.tableNumber === 'llevar') {
        found++;
        console.log(`🎯 ENCONTRADO: Pedido ${id} con tableNumber="llevar"`);
        
        // Preparar actualización
        const updates = {
          serviceType: 'llevar',
          orderTypeNormalized: 'desayuno_llevar',
          takeaway: true
        };
        
        // Remover tableNumber y agregar takeaway
        await updateDoc(doc(db, 'breakfastOrders', id), {
          ...updates,
          tableNumber: null // O podríamos usar deleteField()
        });
        
        console.log(`✅ CORREGIDO: Pedido ${id} actualizado a llevar`);
        fixed++;
      }
    }
    
    console.log(`\n📈 RESUMEN:`);
    console.log(`   Pedidos encontrados con "llevar": ${found}`);
    console.log(`   Pedidos corregidos: ${fixed}`);
    
    if (fixed > 0) {
      console.log(`\n🎉 Se corrigieron ${fixed} pedidos. Recarga el dashboard para ver los cambios.`);
    } else {
      console.log(`\n🤔 No se encontraron pedidos para corregir.`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar el script
fixLlevarOrders().then(() => {
  console.log('\n✨ Script completado');
  process.exit(0);
}).catch(console.error);