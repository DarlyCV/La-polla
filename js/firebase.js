// js/firebase.js

// Importar las funciones necesarias desde las librerías web de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, child, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Configuración de Firebase de tu aplicación (Tomada de tu consola oficial)
const firebaseConfig = {
  apiKey: "AIzaSyB0-be4DDthP-MZxdmFNK_6GTZiiF5XgnA",
  authDomain: "la-polla-mundialista-ec497.firebaseapp.com",
  databaseURL: "https://la-polla-mundialista-ec497-default-rtdb.firebaseio.com",
  projectId: "la-polla-mundialista-ec497",
  storageBucket: "la-polla-mundialista-ec497.firebasestorage.app",
  messagingSenderId: "301962769543",
  appId: "1:301962769543:web:2bbc488e59077dcfc6f422",
  measurementId: "G-MEWPXJ6HG"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Realtime Database
const db = getDatabase(app);

// Exponer la base de datos y herramientas de referencia de forma global 
// para que tus otros scripts antiguos (storage.js, app.js) puedan interactuar con ella sin romper su lógica.
window.db = db;
window.dbRef = ref;
window.dbSet = set;
window.dbGet = get;
window.dbChild = child;
window.dbUpdate = update;

console.log("🔥 Firebase Realtime Database vinculada correctamente de forma global.");