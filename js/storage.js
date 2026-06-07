// js/storage.js

const KEY_POLLA = "POLLA_MUNDIALISTA_2026";

// Obtiene el estado actual (primero intenta de LocalStorage por velocidad)
function obtenerEstadoGlobal() {
    let datos = localStorage.getItem(KEY_POLLA);
    if (!datos) {
        const estadoInicial = {
            resultados_reales: {}, 
            jugadores: []          
        };
        guardarEstadoGlobal(estadoInicial);
        return estadoInicial;
    }
    return JSON.parse(datos);
}

// Guarda en LocalStorage Y ADEMÁS lo sube a Firebase en tiempo real
function guardarEstadoGlobal(estado) {
    // 1. Guardar localmente como antes
    localStorage.setItem(KEY_POLLA, JSON.stringify(estado));

    // 2. Guardar en la nube (Firebase Realtime Database) usando el puente global
    if (window.db && window.dbRef && window.dbSet) {
        const rutaBase = window.dbRef(window.db, "polla_datos");
        window.dbSet(rutaBase, estado)
            .then(() => console.log("☁️ Sincronizado con Firebase con éxito."))
            .catch(error => console.error("❌ Error al sincronizar con Firebase:", error));
    }
}

// Carga datos de Firebase al iniciar
function cargarDatosDeFirebase() {
    return new Promise((resolve) => {
        // Esperamos a que Firebase esté disponible
        if (!window.db || !window.dbRef || !window.dbGet || !window.dbChild) {
            console.warn("⚠️ Firebase no está disponible aún");
            resolve();
            return;
        }

        const rutaBase = window.dbRef(window.db, "polla_datos");
        window.dbGet(window.dbChild(rutaBase))
            .then((snapshot) => {
                if (snapshot.exists()) {
                    const datosFirebase = snapshot.val();
                    console.log("📥 Datos cargados desde Firebase:", datosFirebase);
                    // Guardar en localStorage para acceso rápido
                    localStorage.setItem(KEY_POLLA, JSON.stringify(datosFirebase));
                    resolve(datosFirebase);
                } else {
                    console.log("📭 No hay datos en Firebase aún");
                    resolve();
                }
            })
            .catch((error) => {
                console.error("❌ Error al cargar de Firebase:", error);
                resolve(); // Continúa incluso si hay error
            });
    });
}