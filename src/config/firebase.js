// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Importa Firestore

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyACWaSG3IXNYgt-wXMyy6mMZ8p3T10NyrQ",
  authDomain: "servi-96624.firebaseapp.com",
  projectId: "servi-96624",
  storageBucket: "servi-96624.firebasestorage.app",
  messagingSenderId: "246886505105",
  appId: "1:246886505105:web:7d6a0518610c9f384dbd30",
  measurementId: "G-VMMDCXP518"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Export db for use in other parts of the app
export { db };