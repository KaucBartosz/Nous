// src/firebaseConfig.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app-check.js";


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

// Inicjalizacja App Check
// Używamy zmiennej globalnej lub lokalnej dla debugowania (localhost wymaga trybu debug lub dodania localhost do dozwolonych domen w konsoli)
window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LcGbmAsAAAAANONNS0csIA_MB5ePSLplsbuob6R'),
  isTokenAutoRefreshEnabled: true
});

const auth = getAuth(app);
const db = getFirestore(app);

console.log("Firebase (wersja webowa) załadowany!");

export { auth, db };