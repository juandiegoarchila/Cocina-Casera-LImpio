// src/config/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Configuración de Firebase (usa tus valores reales)
const firebaseConfig = {
  apiKey: "AIzaSyACWaSG3IXNYgt-wXMyy6mMZ8p3T10NyrQ",
  authDomain: "servi-96624.firebaseapp.com",
  projectId: "servi-96624",
  storageBucket: "servi-96624.appspot.com",
  messagingSenderId: "246886505105",
  appId: "1:246886505105:web:7d6a0518610c9f384dbd30",
  measurementId: "G-VMMDCXP518"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, app }; // Exporta app también por si acaso