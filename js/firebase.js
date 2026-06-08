// js/firebase.js
// Cargar Firebase SDK desde CDN con API compatible

// Cargar Firebase App
const appScript = document.createElement('script');
appScript.src = "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js";
document.head.appendChild(appScript);

// Cargar Firebase Database
const dbScript = document.createElement('script');
dbScript.src = "https://www.gstatic.com/firebasejs/10.8.0/firebase-database-compat.js";
dbScript.onload = () => {
    setTimeout(inicializarFirebase, 200); // Pequeño delay para asegurar que Firebase esté listo
};
document.head.appendChild(dbScript);

function inicializarFirebase() {
    // Esperar a que firebase esté disponible globalmente
    if (typeof firebase === 'undefined') {
        console.warn("⚠️ Firebase aún no disponible, reintentando...");
        setTimeout(inicializarFirebase, 500);
        return;
    }

    // Configuración de Firebase
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

    try {
        // Inicializar Firebase
        firebase.initializeApp(firebaseConfig);
        
        // Obtener referencia a la base de datos
        const database = firebase.database();
        
        // Exponer globalmente de forma MÁS SIMPLE y DIRECTA
        window.firebaseDb = database;
        
        console.log("🔥 Firebase Realtime Database inicializado correctamente.");
    } catch (error) {
        console.error("❌ Error inicializando Firebase:", error);
    }
}