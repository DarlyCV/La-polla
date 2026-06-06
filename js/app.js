// js/app.js

let idJugadorActual = null;
let grupoSeleccionadoTemporal = null;
let paisesSeleccionadosTemporales = [];

// Bandera para rastrear si el usuario tiene cambios pendientes sin guardar
let haHabidoCambios = false;

// Inicialización del sistema al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
    actualizarSelectorJugadores();
    actualizarRankingUI();
    inicializarResultadosRealesAdmin();
    configurarRastreoCambiosManual();
});

// 1. MANEJO DE PESTAÑAS (TABS) CON VALIDACIÓN DE GUARDADO
function switchTab(tabName) {
    if (haHabidoCambios) {
        const seguroDeSalir = confirm("⚠️ Tienes cambios pendientes sin guardar en este módulo. ¿Seguro que quieres cambiar de pestaña y perder los cambios?");
        if (!seguroDeSalir) {
            return; 
        }
    }

    haHabidoCambios = false;

    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active-content'));

    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    document.getElementById(`tab-${tabName}`).classList.add('active-content');
    event.currentTarget.classList.add('active');

    if (tabName === 'ranking') {
        actualizarRankingUI();
    } else if (tabName === 'registro') {
        cargarPrediccionesJugador(); 
    } else if (tabName === 'admin-reales') {
        inicializarResultadosRealesAdmin(); 
    }
}

// Activa la bandera de cambios si el usuario interactúa con checkboxes de juego
function configurarRastreoCambiosManual() {
    document.addEventListener("change", (e) => {
        if (e.target.matches('#lista-grupos input[type="checkbox"]') || e.target.matches('#lista-grupos-reales input[type="checkbox"]')) {
            haHabidoCambios = true;
        }
    });
}

// 2. GESTIÓN DE JUGADORES (CREAR Y ELIMINAR)
function registrarJugador() {
    const inputNombre = document.getElementById("player-name-input");
    const nombre = inputNombre.value.trim();

    if (nombre === "") {
        alert("⚠️ Ingresa un nombre válido.");
        return;
    }

    let estado = obtenerEstadoGlobal();
    const existe = estado.jugadores.find(j => j.nombre.toLowerCase() === nombre.toLowerCase());
    
    if (existe) {
        alert("❌ Este jugador ya existe.");
        return;
    }

    const nuevoJugador = {
        id: Date.now(),
        nombre: nombre,
        puntaje_total: 0,
        predicciones: {}
    };

    estado.jugadores.push(nuevoJugador);
    guardarEstadoGlobal(estado);

    inputNombre.value = "";
    actualizarSelectorJugadores();
    actualizarRankingUI();
    alert(`✅ ¡Jugador "${nombre}" registrado!`);
}

function eliminarJugadorActual() {
    if (!idJugadorActual) return;

    let estado = obtenerEstadoGlobal();
    const jugador = estado.jugadores.find(j => j.id == idJugadorActual);

    if (!jugador) return;

    const confirmarEliminacion = confirm(`🚨 ¿ESTÁS SEGURO? Estás a punto de eliminar por completo a "${jugador.nombre}". Se borrarán todas sus apuestas guardadas y sus puntos en el ranking. Esta acción no se puede deshacer.`);
    
    if (confirmarEliminacion) {
        estado.jugadores = estado.jugadores.filter(j => j.id != idJugadorActual);
        guardarEstadoGlobal(estado);

        idJugadorActual = null;
        haHabidoCambios = false;

        actualizarSelectorJugadores();
        actualizarRankingUI();
        document.getElementById("grupos-container").classList.add("hidden");
        document.getElementById("delete-player-zone").style.display = "none";

        alert("🗑️ El jugador y su cartilla han sido eliminados correctamente.");
    }
}

function actualizarSelectorJugadores() {
    const select = document.getElementById("select-player");
    if (!select) return;
    const estado = obtenerEstadoGlobal();

    select.innerHTML = '<option value="">-- Selecciona un participante --</option>';
    estado.jugadores.forEach(j => {
        const option = document.createElement("option");
        option.value = j.id;
        option.textContent = j.nombre;
        select.appendChild(option);
    });
}

// 3. RENDERIZADO DINÁMICO DE ACORDEONES POR JUGADOR
function cargarPrediccionesJugador() {
    const select = document.getElementById("select-player");
    const contenedorGlobal = document.getElementById("grupos-container");
    const listaGruposDiv = document.getElementById("lista-grupos");
    const nombreTrabajoSpan = document.getElementById("current-working-player");
    const zonaEliminar = document.getElementById("delete-player-zone");

    if (!select) return;
    idJugadorActual = select.value;

    if (!idJugadorActual) {
        contenedorGlobal.classList.add("hidden");
        if (zonaEliminar) zonaEliminar.style.display = "none";
        return;
    }

    if (zonaEliminar) zonaEliminar.style.display = "flex";

    const estado = obtenerEstadoGlobal();
    const jugador = estado.jugadores.find(j => j.id == idJugadorActual);

    nombreTrabajoSpan.textContent = jugador.nombre;
    contenedorGlobal.classList.remove("hidden");
    listaGruposDiv.innerHTML = "";

    Object.keys(MUNDIAL_2026).forEach(nombreGrupo => {
        const paises = MUNDIAL_2026[nombreGrupo];
        const prediccionExistente = jugador.predicciones[nombreGrupo] || [];
        const yaEstaGuardado = prediccionExistente.length === 2;

        const details = document.createElement("details");
        details.className = "grupo-accordion";
        if (yaEstaGuardado) details.classList.add("grupo-congelado");

        const summary = document.createElement("summary");
        summary.innerHTML = `<strong>${nombreGrupo}</strong> ${yaEstaGuardado ? "✅ (Fijado)" : "⏳ (Pendiente)"}`;
        details.appendChild(summary);

        const contentDiv = document.createElement("div");
        contentDiv.className = "grupo-content";

        let paisesHTML = `<ul class="lista-paises-voto" id="voto-${nombreGrupo.replace(" ", "")}">`;
        paises.forEach(pais => {
            const estaCheckeado = prediccionExistente.includes(pais.id) ? "checked" : "";
            const estaDeshabilitado = yaEstaGuardado ? "disabled" : "";
            paisesHTML += `
                <li>
                    <label class="pais-label">
                        <input type="checkbox" value="${pais.id}" ${estaCheckeado} ${estaDeshabilitado} onchange="validarMaximoDosCheckboxes(this, 'voto-${nombreGrupo.replace(" ", "")}')">
                        <img src="${pais.bandera}" class="banderita">
                        <span>${pais.nombre}</span>
                    </label>
                </li>`;
        });
        paisesHTML += `</ul>`;
        contentDiv.innerHTML = paisesHTML;

        const botonesDiv = document.createElement("div");
        botonesDiv.className = "grupo-actions-zone";

        if (!yaEstaGuardado) {
            botonesDiv.innerHTML = `
                <button class="btn-cancelar" onclick="cerrarAcordeon(this)">Cancelar</button>
                <button class="btn-guardar" onclick="prepararGuardado('${nombreGrupo}')">Guardar</button>
            `;
        } else {
            botonesDiv.innerHTML = `
                <span class="msg-fijado">Selección fijada.</span>
                <button class="btn-modificar" onclick="habilitarModificacion(this, '${nombreGrupo}')">Modificar Selección</button>
            `;
        }

        contentDiv.appendChild(botonesDiv);
        details.appendChild(contentDiv);
        listaGruposDiv.appendChild(details);
    });
}

// CONTROL DE SELECCIÓN MÁXIMA (EXACTAMENTE 2 PAÍSES)
function validarMaximoDosCheckboxes(checkboxActual, contenedorId) {
    const contenedor = document.getElementById(contenedorId);
    const marcados = contenedor.querySelectorAll('input[type="checkbox"]:checked');

    if (marcados.length > 2) {
        checkboxActual.checked = false; 
        alert("⚠️ Solo puedes seleccionar exactamente 2 países por grupo.");
    }
}

function cerrarAcordeon(boton) {
    boton.closest("details").removeAttribute("open");
}

// 4. POPUP DE CONFIRMACIÓN DINÁMICO
function prepararGuardado(nombreGrupo) {
    const grupoId = nombreGrupo.replace(" ", "");
    const checkboxes = document.querySelectorAll(`#voto-${grupoId} input[type="checkbox"]:checked`);
    
    if (checkboxes.length !== 2) {
        alert(`⚠️ Debes elegir exactamente 2 países para el ${nombreGrupo}.`);
        return;
    }

    grupoSeleccionadoTemporal = nombreGrupo;
    paisesSeleccionadosTemporales = Array.from(checkboxes).map(cb => cb.value);

    const estado = obtenerEstadoGlobal();
    const jugador = estado.jugadores.find(j => j.id == idJugadorActual);
    const nombresPaises = paisesSeleccionadosTemporales.map(id => MUNDIAL_2026[nombreGrupo].find(p => p.id === id).nombre);

    const mensajeModal = document.getElementById("confirm-modal-message");
    mensajeModal.innerHTML = `¿Seguro que quieres guardar a <strong>${nombresPaises[0]}</strong> y <strong>${nombresPaises[1]}</strong> para las predicciones de <span class="highlight">${jugador.nombre}</span>?`;
    
    document.getElementById("btn-modal-confirmar").onclick = ejecutarGuardadoReal;
    document.getElementById("confirm-modal").style.display = "flex";
}

// SOLUCIÓN AQUÍ: Al guardar la predicción, se ejecuta el cálculo automático inmediatamente
function ejecutarGuardadoReal() {
    let estado = obtenerEstadoGlobal();
    const jugador = estado.jugadores.find(j => j.id == idJugadorActual);

    // Guardar la nueva predicción en el estado
    jugador.predicciones[grupoSeleccionadoTemporal] = paisesSeleccionadosTemporales;
    guardarEstadoGlobal(estado);

    // RECALCULO SILENCIOSO EN TIEMPO REAL: Procesa los puntos de este jugador contra los resultados reales que ya existan
    recalcularPuntajesSilencioso();

    haHabidoCambios = false; 
    cerrarModal('confirm-modal');
    cargarPrediccionesJugador();
    actualizarRankingUI(); // Refresca la tabla por detrás de inmediato
}

// 5. EDICIÓN FORZADA DEL ADMIN
function habilitarModificacion(button, nombreGrupo) {
    const details = button.closest("details");
    const grupoId = nombreGrupo.replace(" ", "");
    
    details.classList.remove("grupo-congelado");
    const checkboxes = document.querySelectorAll(`#voto-${grupoId} input[type="checkbox"]`);
    checkboxes.forEach(cb => cb.removeAttribute("disabled"));

    button.parentElement.innerHTML = `
        <button class="btn-cancelar" onclick="cargarPrediccionesJugador()">Cancelar</button>
        <button class="btn-guardar" onclick="prepararGuardado('${nombreGrupo}')">Actualizar</button>
    `;
}

// 6. RESULTADOS REALES (ADMIN) Y CÁLCULO DE PUNTOS
function inicializarResultadosRealesAdmin() {
    const contenedor = document.getElementById("lista-grupos-reales");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    const estado = obtenerEstadoGlobal();

    Object.keys(MUNDIAL_2026).forEach(nombreGrupo => {
        const paises = MUNDIAL_2026[nombreGrupo];
        const realesGuardados = estado.resultados_reales[nombreGrupo] || [];
        const grupoId = nombreGrupo.replace(" ", "");

        const div = document.createElement("div");
        div.className = "grupo-real-row";
        
        let html = `<h4 style="margin: 10px 0 5px 0; color: var(--primary-color);">${nombreGrupo}</h4><div id="real-container-${grupoId}" style="display:flex; gap:15px; flex-wrap:wrap;">`;
        paises.forEach(p => {
            const checked = realesGuardados.includes(p.id) ? "checked" : "";
            html += `
                <label class="pais-label" style="padding:5px 10px;">
                    <input type="checkbox" name="real-${grupoId}" value="${p.id}" ${checked} onchange="validarMaximoDosCheckboxes(this, 'real-container-${grupoId}')">
                    <img src="${p.bandera}" style="width:24px;">
                    <span>${p.nombre}</span>
                </label>`;
        });
        html += `</div>`;
        div.innerHTML = html;
        contenedor.appendChild(div);
    });
}

// Función ejecutada por el Administrador manualmente
function calcularPuntajesGlobales() {
    let estado = obtenerEstadoGlobal();
    let nuevosResultadosReales = {};
    let validacionCorrecta = true;

    Object.keys(MUNDIAL_2026).forEach(nombreGrupo => {
        const grupoId = nombreGrupo.replace(" ", "");
        const seleccionados = document.querySelectorAll(`input[name="real-${grupoId}"]:checked`);
        const cantidad = seleccionados.length;

        if (cantidad !== 0 && cantidad !== 2) {
            alert(`⚠️ El ${nombreGrupo} en el Panel de Resultados tiene ${cantidad} selección(es). Debe tener exactamente 2 seleccionados (o ninguno si no ha terminado).`);
            validacionCorrecta = false;
        }
        nuevosResultadosReales[nombreGrupo] = Array.from(seleccionados).map(cb => cb.value);
    });

    if (!validacionCorrecta) return; 

    estado.resultados_reales = nuevosResultadosReales;
    guardarEstadoGlobal(estado);

    // Corre el motor de puntuación común
    recalcularPuntajesSilencioso();

    haHabidoCambios = false; 
    alert("⚽ ¡Puntajes calculados con éxito! Tabla de posiciones actualizada.");
    actualizarRankingUI();
}

// MOTOR DE PUNTOS CENTRALIZADO: Compara predicciones contra resultados reales guardados
function recalcularPuntajesSilencioso() {
    let estado = obtenerEstadoGlobal();

    estado.jugadores.forEach(jugador => {
        let puntosTotales = 0;
        Object.keys(MUNDIAL_2026).forEach(grupo => {
            const prediccion = jugador.predicciones[grupo] || [];
            const reales = estado.resultados_reales[grupo] || [];
            
            // Filtrar cuántos de los países elegidos están en la lista real
            const aciertos = prediccion.filter(p => reales.includes(p)).length;

            if (aciertos === 2) puntosTotales += 4;
            else if (aciertos === 1) puntosTotales += 2;
        });
        jugador.puntaje_total = puntosTotales;
    });

    guardarEstadoGlobal(estado);
}

// 7. RANKING E INSPECTOR DE HISTORIAL
function actualizarRankingUI() {
    const tbody = document.getElementById("ranking-body");
    if (!tbody) return;
    
    const estado = obtenerEstadoGlobal();
    const jugadoresOrdenados = [...estado.jugadores].sort((a, b) => b.puntaje_total - a.puntaje_total);
    
    tbody.innerHTML = "";

    if (jugadoresOrdenados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#9ca3af;">No hay participantes registrados todavía.</td></tr>`;
        return;
    }

    jugadoresOrdenados.forEach((jugador, indice) => {
        const puesto = indice + 1;
        let medacle = "";

        if (puesto === 1) medacle = "🥇 ";
        else if (puesto === 2) medacle = "🥈 ";
        else if (puesto === 3) medacle = "🥉 ";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${medacle}${puesto}º</strong></td>
            <td><span class="player-click-name" onclick="verHistorialJugador(${jugador.id})">👤 ${jugador.nombre}</span></td>
            <td><span class="badge-puntos">${jugador.puntaje_total} pts</span></td>
            <td><button class="btn-primary" style="padding:5px 10px; font-size:0.85rem;" onclick="verHistorialJugador(${jugador.id})">👁️ Ver Polla</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function verHistorialJugador(idJugador) {
    const estado = obtenerEstadoGlobal();
    const jugador = estado.jugadores.find(j => j.id == idJugador);
    
    document.getElementById("detail-player-name").textContent = jugador.nombre;
    const grid = document.getElementById("detail-groups-grid");
    grid.innerHTML = "";

    Object.keys(MUNDIAL_2026).forEach(grupo => {
        const prediccion = jugador.predicciones[grupo] || [];
        const divGrupo = document.createElement("div");
        divGrupo.style = "background:#f9fafb; padding:10px; border-radius:8px; border:1px solid #e5e7eb;";
        
        let paisesHTML = "";
        prediccion.forEach(paisId => {
            const datosPais = MUNDIAL_2026[grupo].find(p => p.id === paisId);
            if(datosPais) {
                paisesHTML += `
                    <div style="display:flex; align-items:center; gap:8px; margin-top:5px;">
                        <img src="${datosPais.bandera}" style="width:20px;">
                        <span style="font-size:0.9rem;">${datosPais.nombre}</span>
                    </div>`;
            }
        });

        divGrupo.innerHTML = `<h5 style="color:var(--primary-color); border-bottom:1px solid #e5e7eb; padding-bottom:3px;">${grupo}</h5>${paisesHTML || '<i style="font-size:0.85rem; color:#9ca3af;">Sin selección</i>'}`;
        grid.appendChild(divGrupo);
    });

    document.getElementById("detail-modal").style.display = "flex";
}

function cerrarModal(modalId) {
    document.getElementById(modalId).style.display = "none";
}

// 8. EXPORTACIÓN DE REPORTE DESCARGABLE ORDENADO (CSV EXCEL)
function descargarReporteExcel() {
    const estado = obtenerEstadoGlobal();
    
    if (!estado.jugadores || estado.jugadores.length === 0) {
        alert("⚠️ No hay participantes registrados para generar el reporte.");
        return;
    }

    const jugadoresOrdenados = [...estado.jugadores].sort((a, b) => b.puntaje_total - a.puntaje_total);

    let csvContent = "Puesto;Participante;Puntaje Total;";
    const listaGrupos = Object.keys(MUNDIAL_2026);
    
    listaGrupos.forEach(grupo => {
        csvContent += `${grupo};`;
    });
    csvContent += "\n"; 

    jugadoresOrdenados.forEach((jugador, indice) => {
        const puesto = indice + 1;
        csvContent += `${puesto}º;${jugador.nombre};${jugador.puntaje_total} pts;`;

        listaGrupos.forEach(grupo => {
            const prediccionIds = jugador.predicciones[grupo] || [];
            if (prediccionIds.length === 2) {
                const pais1 = MUNDIAL_2026[grupo].find(p => p.id === prediccionIds[0])?.nombre || prediccionIds[0];
                const pais2 = MUNDIAL_2026[grupo].find(p => p.id === prediccionIds[1])?.nombre || prediccionIds[1];
                csvContent += `"${pais1} y ${pais2}";`; 
            } else {
                csvContent += `"Sin selección completa";`;
            }
        });
        csvContent += "\n"; 
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Oficial_Polla_Mundialista_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click(); 
    document.body.removeChild(link); 
}