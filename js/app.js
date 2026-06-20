// js/app.js

let idJugadorActual = null;
let grupoSeleccionadoTemporal = null;
let paisesSeleccionadosTemporales = [];

// Bandera para rastrear si el usuario tiene cambios pendientes sin guardar
let haHabidoCambios = false;

// =============================================
// SISTEMA DE NOTIFICACIONES (reemplaza alert/confirm nativos)
// =============================================
function mostrarToast(mensaje, tipo = 'info', duracion = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const iconos = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `<span class="toast-icon">${iconos[tipo] || 'ℹ️'}</span><span class="toast-msg">${mensaje}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-hiding');
        setTimeout(() => toast.remove(), 350);
    }, duracion);
}

function mostrarConfirm(titulo, mensaje, callbackOk, textoOk = 'Sí, continuar', textoCancel = 'Cancelar') {
    const modal = document.getElementById('generic-confirm-modal');
    const titleEl = document.getElementById('generic-confirm-title');
    const msgEl = document.getElementById('generic-confirm-message');
    const okBtn = document.getElementById('generic-confirm-ok');
    const cancelBtn = modal.querySelector('.btn-cancelar');

    titleEl.textContent = titulo;
    msgEl.innerHTML = mensaje;
    okBtn.textContent = textoOk;
    cancelBtn.textContent = textoCancel;

    // Limpiar listener anterior y poner el nuevo
    const nuevoOk = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(nuevoOk, okBtn);
    nuevoOk.addEventListener('click', () => {
        cerrarModal('generic-confirm-modal');
        callbackOk();
    });

    modal.style.display = 'flex';
}

// Inicialización del sistema al cargar el DOM
document.addEventListener("DOMContentLoaded", async () => {
    console.log("⏳ Esperando carga de datos de Firebase...");

    // Cargar datos de Firebase primero
    await cargarDatosDeFirebase();

    console.log("✅ Datos cargados. Inicializando UI...");

    // Reparar estructura de datos si es necesario (para datos antiguos)
    let estado = obtenerEstadoGlobal();
    let necesitaReparar = false;

    if (!estado.resultados_reales) {
        estado.resultados_reales = {};
        necesitaReparar = true;
    }

    if (!estado.jugadores) {
        estado.jugadores = [];
        necesitaReparar = true;
    }

    estado.jugadores.forEach(jugador => {
        if (!jugador.predicciones) {
            jugador.predicciones = {};
            necesitaReparar = true;
        }
        Object.keys(MUNDIAL_2026).forEach(grupo => {
            if (!jugador.predicciones[grupo]) {
                jugador.predicciones[grupo] = [];
                necesitaReparar = true;
            }
        });
    });

    if (necesitaReparar) {
        console.log("🔧 Reparando estructura de datos...");
        guardarEstadoGlobal(estado);
    }

    actualizarSelectorJugadores();
    actualizarRankingUI();
    inicializarResultadosRealesAdmin();
    configurarRastreoCambiosManual();
    configurarLimpiezaGruposAdmin(); // <- Activamos la escucha para el botón de limpiar
});

// 1. MANEJO DE PESTAÑAS (TABS) CON VALIDACIÓN DE GUARDADO
function switchTab(tabName) {
    if (haHabidoCambios) {
        // Guardar referencia al evento antes de que se pierda en el callback
        const targetTab = tabName;
        const clickedBtn = event.currentTarget;
        mostrarConfirm(
            '⚠️ Cambios pendientes',
            'Tienes cambios pendientes sin guardar. ¿Seguro que quieres cambiar de pestaña y perder los cambios?',
            () => {
                haHabidoCambios = false;
                _ejecutarSwitchTab(targetTab, clickedBtn);
            },
            'Sí, salir',
            'Quedarse'
        );
        return;
    }

    haHabidoCambios = false;
    _ejecutarSwitchTab(tabName, event.currentTarget);
}

function _ejecutarSwitchTab(tabName, botonActivo) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active-content'));

    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    document.getElementById(`tab-${tabName}`).classList.add('active-content');
    if (botonActivo) botonActivo.classList.add('active');

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
        mostrarToast("Ingresa un nombre válido.", 'warning');
        return;
    }

    let estado = obtenerEstadoGlobal();
    const existe = estado.jugadores.find(j => j.nombre.toLowerCase() === nombre.toLowerCase());

    if (existe) {
        mostrarToast("Este jugador ya existe.", 'error');
        return;
    }

    // Inicializar predicciones con todos los grupos vacíos
    const predicciones = {};
    Object.keys(MUNDIAL_2026).forEach(grupo => {
        predicciones[grupo] = [];
    });

    const nuevoJugador = {
        id: Date.now(),
        nombre: nombre,
        puntaje_total: 0,
        predicciones: predicciones
    };

    estado.jugadores.push(nuevoJugador);
    guardarEstadoGlobal(estado);

    inputNombre.value = "";
    actualizarSelectorJugadores();
    actualizarRankingUI();
    mostrarToast(`¡Jugador "${nombre}" registrado!`, 'success');
}

function eliminarJugadorActual() {
    // Obtener el ID directamente del select en lugar de la variable
    const select = document.getElementById("select-player");
    const idSeleccionado = select ? select.value : "";

    if (!idSeleccionado) {
        mostrarToast("Selecciona un jugador primero.", 'warning');
        return;
    }

    let estado = obtenerEstadoGlobal();
    // Comparación robusta: convertir ambos a string
    const jugador = estado.jugadores.find(j => String(j.id) === String(idSeleccionado));

    if (!jugador) {
        mostrarToast("Jugador no encontrado.", 'error');
        return;
    }

    mostrarConfirm(
        '🚨 Eliminar Jugador',
        `¿Estás seguro de eliminar a <strong>${jugador.nombre}</strong>? Se borrarán todas sus apuestas y puntos. Esta acción no se puede deshacer.`,
        () => {
            let estadoActual = obtenerEstadoGlobal();
            estadoActual.jugadores = estadoActual.jugadores.filter(j => String(j.id) !== String(idSeleccionado));
            guardarEstadoGlobal(estadoActual);

            idJugadorActual = null;
            haHabidoCambios = false;

            actualizarSelectorJugadores();
            actualizarRankingUI();
            document.getElementById("grupos-container").classList.add("hidden");
            document.getElementById("delete-player-zone").style.display = "none";

            mostrarToast(`Jugador "${jugador.nombre}" eliminado correctamente.`, 'success');
        },
        'Sí, eliminar',
        'Cancelar'
    );
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

    if (!jugador) {
        console.error("❌ Jugador no encontrado");
        return;
    }

    // Asegurar que el jugador tiene predicciones para todos los grupos
    Object.keys(MUNDIAL_2026).forEach(grupo => {
        if (!jugador.predicciones[grupo]) {
            jugador.predicciones[grupo] = [];
        }
    });

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

        let paisesHTML = `<ul class="lista-paises-voto" id="voto-${nombreGrupo.replace(" ", "")}" data-selected='${JSON.stringify(prediccionExistente)}'>`;
        paises.forEach(pais => {
            const index = prediccionExistente.indexOf(pais.id);
            const estaCheckeado = index !== -1 ? "checked" : "";
            const estaDeshabilitado = yaEstaGuardado ? "disabled" : "";

            let badgeHTML = "";
            let classPosicion = "";
            if (index !== -1) {
                badgeHTML = `<span class="badge-orden" style="display: inline-block;">${index + 1}º</span>`;
                classPosicion = index === 0 ? "pais-seleccionado primer-lugar" : "pais-seleccionado segundo-lugar";
            } else {
                badgeHTML = `<span class="badge-orden" style="display: none;"></span>`;
            }

            paisesHTML += `
                <li>
                    <label class="pais-label ${classPosicion}">
                        <input type="checkbox" value="${pais.id}" ${estaCheckeado} ${estaDeshabilitado} onchange="manejarSeleccionOrdenada(this, 'voto-${nombreGrupo.replace(" ", "")}')">
                        <img src="${pais.bandera}" class="banderita">
                        <span>${pais.nombre}</span>
                        ${badgeHTML}
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
               <!-- <button class="btn-modificar" onclick="habilitarModificacion(this, '${nombreGrupo}')">Modificar Selección</button> -->
            `;
        }

        contentDiv.appendChild(botonesDiv);
        details.appendChild(contentDiv);
        listaGruposDiv.appendChild(details);
    });
}

// CONTROL DE SELECCIÓN ORDENADA (EXACTAMENTE 2 PAÍSES: 1º Y 2º LUGAR)
function manejarSeleccionOrdenada(checkboxActual, contenedorId) {
    const ul = document.getElementById(contenedorId);
    if (!ul) return;
    let seleccionados = JSON.parse(ul.dataset.selected || "[]");

    if (checkboxActual.checked) {
        if (seleccionados.length >= 2) {
            checkboxActual.checked = false;
            alert("⚠️ Solo puedes seleccionar exactamente 2 países por grupo.");
            return;
        }
        seleccionados.push(checkboxActual.value);
    } else {
        seleccionados = seleccionados.filter(id => id !== checkboxActual.value);
    }

    ul.dataset.selected = JSON.stringify(seleccionados);
    actualizarBadgesOrden(ul, seleccionados);
}

function actualizarBadgesOrden(ul, seleccionados) {
    const checkboxes = ul.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        const label = cb.closest('label');
        if (!label) return;

        let badge = label.querySelector('.badge-orden');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge-orden';
            label.appendChild(badge);
        }

        const index = seleccionados.indexOf(cb.value);
        if (index !== -1) {
            badge.textContent = `${index + 1}º`;
            badge.style.display = 'inline-block';
            label.classList.add('pais-seleccionado');
            if (index === 0) {
                label.classList.add('primer-lugar');
                label.classList.remove('segundo-lugar');
            } else {
                label.classList.add('segundo-lugar');
                label.classList.remove('primer-lugar');
            }
        } else {
            badge.textContent = '';
            badge.style.display = 'none';
            label.classList.remove('pais-seleccionado', 'primer-lugar', 'segundo-lugar');
        }
    });
}

function cerrarAcordeon(boton) {
    boton.closest("details").removeAttribute("open");
}

// 4. POPUP DE CONFIRMACIÓN DINÁMICO
function prepararGuardado(nombreGrupo) {
    const grupoId = nombreGrupo.replace(" ", "");
    const ul = document.getElementById(`voto-${grupoId}`);
    if (!ul) return;
    const seleccionados = JSON.parse(ul.dataset.selected || "[]");

    if (seleccionados.length !== 2) {
        mostrarToast(`Debes elegir exactamente 2 países para el ${nombreGrupo}.`, 'warning');
        return;
    }

    grupoSeleccionadoTemporal = nombreGrupo;
    paisesSeleccionadosTemporales = seleccionados;

    const estado = obtenerEstadoGlobal();
    const jugador = estado.jugadores.find(j => j.id == idJugadorActual);
    const nombresPaises = paisesSeleccionadosTemporales.map(id => MUNDIAL_2026[nombreGrupo].find(p => p.id === id).nombre);

    const mensajeModal = document.getElementById("confirm-modal-message");
    mensajeModal.innerHTML = `¿Seguro que quieres guardar a <strong>1º: ${nombresPaises[0]}</strong> y <strong>2º: ${nombresPaises[1]}</strong> para las predicciones de <span class="highlight">${jugador.nombre}</span>?`;

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
// MODIFICADO CON ÉXITO: Integra el título H4 alineado y el botón dinámico de Limpiar Grupo
function inicializarResultadosRealesAdmin() {
    const contenedor = document.getElementById("lista-grupos-reales");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    const estado = obtenerEstadoGlobal();

    Object.keys(MUNDIAL_2026).forEach(nombreGrupo => {
        const paises = MUNDIAL_2026[nombreGrupo];
        const realesGuardados = estado.resultados_reales[nombreGrupo] || [];
        const grupoId = nombreGrupo.replace(" ", "");

        // Extraemos solo la letra del grupo (ej: de "Grupo A" saca "A")
        const letraGrupo = nombreGrupo.split(" ")[1] || "";

        const div = document.createElement("div");
        div.className = "grupo-real-row";

        // Aquí inyectamos el título H4 configurado con flexbox y el botón de borrado
        let html = `
            <h4 style="margin: 10px 0 5px 0; color: var(--primary-color); display: flex; justify-content: space-between; align-items: center;">
                <span>${nombreGrupo}</span>
                <button type="button" class="btn-limpiar-grupo" data-grupo="${letraGrupo}">Limpiar Grupo</button>
            </h4>
            <div id="real-container-${grupoId}" class="lista-paises-voto" data-selected='${JSON.stringify(realesGuardados)}' style="display:flex; gap:15px; flex-wrap:wrap;">`;

        paises.forEach(p => {
            const index = realesGuardados.indexOf(p.id);
            const checked = index !== -1 ? "checked" : "";

            let badgeHTML = "";
            let classPosicion = "";
            if (index !== -1) {
                badgeHTML = `<span class="badge-orden" style="display: inline-block;">${index + 1}º</span>`;
                classPosicion = index === 0 ? "pais-seleccionado primer-lugar" : "pais-seleccionado segundo-lugar";
            } else {
                badgeHTML = `<span class="badge-orden" style="display: none;"></span>`;
            }

            html += `
                <label class="pais-label ${classPosicion}" style="padding:5px 10px;">
                    <input type="checkbox" name="real-${grupoId}" value="${p.id}" ${checked} onchange="manejarSeleccionOrdenada(this, 'real-container-${grupoId}')">
                    <img src="${p.bandera}" style="width:24px;">
                    <span>${p.nombre}</span>
                    ${badgeHTML}
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
        const container = document.getElementById(`real-container-${grupoId}`);
        const seleccionados = JSON.parse(container.dataset.selected || "[]");
        const cantidad = seleccionados.length;

        if (cantidad !== 0 && cantidad !== 2) {
            mostrarToast(`El ${nombreGrupo} tiene ${cantidad} selección(es). Debe tener 2 o ninguno.`, 'error');
            validacionCorrecta = false;
        }
        nuevosResultadosReales[nombreGrupo] = seleccionados;
    });

    if (!validacionCorrecta) return;

    estado.resultados_reales = nuevosResultadosReales;
    guardarEstadoGlobal(estado);

    // Corre el motor de puntuación común
    recalcularPuntajesSilencioso();

    haHabidoCambios = false;
    mostrarToast('¡Puntajes calculados con éxito! Tabla de posiciones actualizada.', 'success', 4000);
    actualizarRankingUI();
}

// MOTOR DE PUNTOS CENTRALIZADO: Compara predicciones contra resultados reales guardados con nueva puntuación
function recalcularPuntajesSilencioso() {
    let estado = obtenerEstadoGlobal();

    estado.jugadores.forEach(jugador => {
        let puntosTotales = 0;
        Object.keys(MUNDIAL_2026).forEach(grupo => {
            const prediccion = jugador.predicciones[grupo] || []; // [P1, P2]
            const reales = estado.resultados_reales[grupo] || []; // [R1, R2]

            if (prediccion.length === 2 && reales.length === 2) {
                const aciertos = prediccion.filter(p => reales.includes(p)).length;
                if (aciertos === 2) {
                    // Ambos países pasan. ¿Es en el mismo orden?
                    if (prediccion[0] === reales[0] && prediccion[1] === reales[1]) {
                        puntosTotales += 3; // En orden exacto
                    } else {
                        puntosTotales += 2; // En orden inverso
                    }
                } else if (aciertos === 1) {
                    puntosTotales += 1; // Al menos uno
                }
            }
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
        prediccion.forEach((paisId, index) => {
            const datosPais = MUNDIAL_2026[grupo].find(p => p.id === paisId);
            if (datosPais) {
                const labelPosicion = index === 0 ? "🥇 1º" : "🥈 2º";
                paisesHTML += `
                    <div style="display:flex; align-items:center; gap:8px; margin-top:5px;">
                        <span style="font-size:0.8rem; font-weight:bold; color:#4b5563;">${labelPosicion}:</span>
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
        mostrarToast('No hay participantes registrados para generar el reporte.', 'warning');
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
                csvContent += `"1º: ${pais1} - 2º: ${pais2}";`;
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

// ==========================================
// NUEVA FUNCIÓN AGREGADA DE FORMA SEGURA
// ==========================================
function configurarLimpiezaGruposAdmin() {
    document.addEventListener('click', function (e) {
        // Evalúa si el clic ocurrió en un botón de limpiar grupo
        if (e.target && e.target.classList.contains('btn-limpiar-grupo')) {
            const letraGrupo = e.target.getAttribute('data-grupo'); // Captura "A", "B", "C" o "D"

            if (letraGrupo) {
                // Sigue la nomenclatura exacta de ID creada en inicializarResultadosRealesAdmin
                const contenedorId = `real-container-Grupo${letraGrupo}`;
                const contenedorReal = document.getElementById(contenedorId);

                if (contenedorReal) {
                    // Desmarca los elementos sin alterar la estructura reactiva
                    const checkboxes = contenedorReal.querySelectorAll('input[type="checkbox"]');
                    checkboxes.forEach(chk => {
                        chk.checked = false;
                    });

                    // Resetear el dataset de seleccionados y quitar los badges de orden
                    contenedorReal.dataset.selected = "[]";
                    actualizarBadgesOrden(contenedorReal, []);

                    // Activamos la bandera de cambios pendientes para advertir al admin antes de salir
                    haHabidoCambios = true;
                    console.log(`🧹 Checks desmarcados quirúrgicamente para el Grupo ${letraGrupo}`);
                }
            }
        }
    });
}