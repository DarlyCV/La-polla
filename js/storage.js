// js/storage.js

const KEY_POLLA = "POLLA_MUNDIALISTA_2026";

// Obtiene el estado actual de la polla o inicializa la estructura si está vacía
function obtenerEstadoGlobal() {
    let datos = localStorage.getItem(KEY_POLLA);
    if (!datos) {
        const estadoInicial = {
            resultados_reales: {}, // Estructura: {"Grupo A": ["mx", "za"], ...}
            jugadores: []          // Estructura: [{id, nombre, puntaje_total, predicciones: {}}]
        };
        guardarEstadoGlobal(estadoInicial);
        return estadoInicial;
    }
    return JSON.parse(datos);
}

// Guarda los datos serializados en formato string JSON
function guardarEstadoGlobal(estado) {
    localStorage.setItem(KEY_POLLA, JSON.stringify(estado));
}