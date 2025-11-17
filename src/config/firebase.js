// src/config/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
const firebaseConfig = {
  apiKey: "AIzaSyCqKu4l9cXM3oX0VxmGKOHQpwxakBV2UzI",
  authDomain: "prubeas-b510c.firebaseapp.com",
  projectId: "prubeas-b510c",
  storageBucket: "prubeas-b510c.firebasestorage.app",
  messagingSenderId: "120258334668",
  appId: "1:120258334668:web:4470273ea328836f0c9769",
  measurementId: "G-P2ZX4GGMX0"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, app, storage }; 