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

    // 2. Guardar en la nube (Firebase Realtime Database) de forma DIRECTA
    if (window.firebaseDb) {
        try {
            window.firebaseDb.ref("polla_datos").set(estado)
                .then(() => console.log("☁️ Sincronizado con Firebase con éxito."))
                .catch(error => console.error("❌ Error al sincronizar con Firebase:", error));
        } catch (error) {
            console.error("❌ Error en guardarEstadoGlobal:", error);
        }
    } else {
        console.warn("⚠️ Firebase no está disponible aún");
    }
}

// Carga datos de Firebase al iniciar
function cargarDatosDeFirebase() {
    return new Promise((resolve) => {
        // Esperamos a que Firebase esté disponible (max 10 segundos)
        let intentos = 0;
        const intervalo = setInterval(() => {
            intentos++;
            if (window.firebaseDb) {
                clearInterval(intervalo);
                
                try {
                    window.firebaseDb.ref("polla_datos").once('value')
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
                } catch (error) {
                    console.error("❌ Error en cargarDatosDeFirebase:", error);
                    resolve();
                }
            } else if (intentos > 100) { // 100 * 100ms = 10 segundos
                clearInterval(intervalo);
                console.warn("⚠️ Firebase no disponible después de 10 segundos, iniciando sin datos en la nube");
                resolve();
            }
        }, 100);
    });
}