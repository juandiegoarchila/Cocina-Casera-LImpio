// src/config/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
const firebaseConfig = {
  apiKey: "AIzaSyCNeAkQJYhR8i1yYxaKwvBzE9okr00Pq_Q",
  authDomain: "cocina-casera-bca8d.firebaseapp.com",
  projectId: "cocina-casera-bca8d",
  storageBucket: "cocina-casera-bca8d.firebasestorage.app",
  messagingSenderId: "741265643266",
  appId: "1:741265643266:web:c51cd02ced73671f80141b",
  measurementId: "G-9PNKWZL0JP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, app, storage }; 