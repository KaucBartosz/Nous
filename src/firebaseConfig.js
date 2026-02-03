// src/firebaseConfig.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";


// --- FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyADmEMWQsGMLnXDhWu9S_70mfhqY4YSTi8",

  authDomain: "bbtp-9d8ae.firebaseapp.com",

  projectId: "bbtp-9d8ae",

  storageBucket: "bbtp-9d8ae.firebasestorage.app",

  messagingSenderId: "331433186287",

  appId: "1:331433186287:web:e302b2ffafed2faae15c1a",

  measurementId: "G-78D846SZX4"
};
// ----------------------------------------------

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log("Firebase (wersja webowa) załadowany!");

export { auth, db };