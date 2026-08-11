// Conexion entre la pantalla y el resto de los modulos.
//
// La aplicacion tiene tres pantallas y ninguna calcula indicadores: Registrar,
// Registros y Exportar. El avance, el rendimiento y el costo se calculan en la
// planilla de Google.
//
// Orden de lectura sugerido: iniciar(), al final del archivo, arma todo; el
// resto son las piezas que usa.

(function (raiz) {
  'use strict';

  const config = raiz.CONFIG;
  const Calculos = raiz.Calculos;
  const Almacenamiento = raiz.Almacenamiento;
  const Formulario = raiz.Formulario;
  const Sincronizacion = raiz.Sincronizacion;
  const Exportar = raiz.Exportar;
  const el = Formulario.elemento;

  const $ = function (selector) { return document.querySelector(selector); };

  // Registro pendiente de confirmacion: cuando hay avisos, se guarda aca hasta
  // que la persona confirme. Nunca se guarda a espaldas de esa confirmacion.
  let porConfirmar = null;

  function actividadElegida() {
    const codigo = $('#codigo_edt').value;
    return config.ACTIVIDADES.filter(function (a) { return a.codigo === codigo; })[0] || null;
  }

  function hoyTexto() {
    return Calculos.textoDeFecha(new Date());
  }

  function nombreSector(codigo) {
    const catalogo = config.CATALOGOS.SECTORES_FCH || [];
    const encontrado = catalogo.filter(function (s) { return s.codigo === codigo; })[0];
    return encontrado ? encontrado.etiqueta : codigo || 'Sin sector';
  }

  // ---------------------------------------------------------------------------
  // Panel de valores calculados
  // ---------------------------------------------------------------------------

  function actualizarCalculados() {
    const formulario = $('#formulario');
    const inicio = formulario.querySelector('[data-parametro="hora_inicio"]');
    const termino = formulario.querySelector('[data-parametro="hora_termino"]');
    const trabajadores = formulario.querySelector('[data-parametro="cantidad_trabajadores"]');
    if (!inicio || !termino) return;

    const duracion = Calculos.calcularDuracion(inicio.value, termino.value, config.JORNADA);
    const hh = Calculos.horasHombre(duracion.horas, trabajadores ? trabajadores.value : null);

    $('#calc-bruta').textContent =
      duracion.horasBrutas === null ? '—' : Calculos.formatearNumero(duracion.horasBrutas, 2) + ' h';
    $('#calc-colacion').textContent =
      duracion.minutosColacion ? '− ' + duracion.minutosColacion + ' min' : '0 min';
    $('#calc-neta').textContent =
      duracion.horas === null ? '—' : Calculos.formatearNumero(duracion.horas, 2) + ' h';
    $('#calc-hh').textContent = hh === null ? '—' : Calculos.formatearNumero(hh, 2) + ' HH';

    $('#calc-neta').parentNode.classList.add('destacado');
    $('#calc-hh').parentNode.classList.add('destacado');

    const ayuda = $('#ayuda-colacion');
    if (duracion.error) {
      ayuda.textContent = duracion.error;
    } else if (duracion.minutosColacion) {
      ayuda.textContent =
        'Se descontaron ' + duracion.minutosColacion +
        ' minutos de colación porque el horario registrado cubre la ventana de ' +
        config.JORNADA.colacion_inicio + ' a ' + config.JORNADA.colacion_termino + '.';
    } else {
      ayuda.textContent =
        'No se descuenta colación: el horario registrado no cubre la ventana de ' +
        config.JORNADA.colacion_inicio + ' a ' + config.JORNADA.colacion_termino + '.';
    }
  }

  // ---------------------------------------------------------------------------
  // Guardado
  // ---------------------------------------------------------------------------

  function mostrarMensaje(selector, texto, tipo) {
    const nodo = $(selector);
    nodo.textContent = texto;
    nodo.className = 'mensaje' + (tipo ? ' mensaje-' + tipo : '');
    nodo.hidden = false;
  }

  function ocultarMensaje(selector) {
    $(selector).hidden = true;
  }

  function limpiarAvisos() {
    const nodo = $('#avisos');
    nodo.innerHTML = '';
    nodo.hidden = true;
    porConfirmar = null;
  }

  function dibujarAvisos(avisos, registro) {
    const nodo = $('#avisos');
    nodo.innerHTML = '';
    nodo.hidden = false;

    const hayErrores = avisos.some(function (a) { return a.nivel === 'error'; });

    avisos.forEach(function (a) {
      nodo.appendChild(
        el('div', { clase: 'aviso aviso-' + a.nivel }, [
          el('span', {
            clase: 'aviso-titulo',
            texto: a.nivel === 'error' ? 'Hay que corregir' : 'Revisa antes de guardar',
          }),
          el('span', { texto: a.mensaje }),
        ])
      );
    });

    if (hayErrores) {
      porConfirmar = null;
      nodo.scrollIntoView({ block: 'nearest' });
      return;
    }

    // Los avisos no bloquean: muestran el numero que va a quedar guardado y
    // piden confirmacion. Bloquear seria peor, porque en terreno el registro se
    // perderia.
    porConfirmar = registro;
    const confirmar = el('button', { type: 'button', clase: 'boton boton-primario', texto: 'Confirmar y guardar' });
    const corregir = el('button', { type: 'button', clase: 'boton boton-secundario', texto: 'Volver a revisar' });
    confirmar.addEventListener('click', function () { guardarRegistro(porConfirmar); });
    corregir.addEventListener('click', limpiarAvisos);
    nodo.appendChild(el('div', { clase: 'avisos-acciones' }, [confirmar, corregir]));
    nodo.scrollIntoView({ block: 'nearest' });
  }

  function guardarRegistro(registro) {
    const guardado = Almacenamiento.guardar(registro);
    Almacenamiento.guardarPreferencias({
      persona_que_registra: guardado.persona_que_registra,
      sector: guardado.sector,
      cantidad_trabajadores: guardado.cantidad_trabajadores,
    });

    limpiarAvisos();
    mostrarMensaje(
      '#mensaje-guardado',
      'Registro guardado en el teléfono: ' +
        Calculos.formatearNumero(guardado.cantidad_ejecutada) + ' ' + guardado.unidad_medida +
        ' con ' + Calculos.formatearNumero(guardado.horas_hombre, 2) + ' horas-hombre. ' +
        'Queda pendiente de sincronizar.',
      null
    );

    prepararFormulario({ conservarActividad: true });
    refrescarTodo();
  }

  function alEnviarFormulario(evento) {
    evento.preventDefault();
    ocultarMensaje('#mensaje-guardado');
    limpiarAvisos();

    const formulario = $('#formulario');
    const actividad = actividadElegida();

    if (!actividad) {
      dibujarAvisos([{ nivel: 'error', mensaje: 'Falta elegir la actividad.' }], null);
      return;
    }

    const pendientes = Formulario.faltantes(formulario, actividad, config);
    if (pendientes.length) {
      dibujarAvisos(
        [{ nivel: 'error', mensaje: 'Faltan campos obligatorios: ' + pendientes.join(', ') + '.' }],
        null
      );
      return;
    }

    const registro = Formulario.leerFormulario(formulario, actividad, config);

    // El acumulado de la actividad se consulta aca y se pasa a la revision. En el
    // proyecto hermano esta funcion existia pero no se llamaba desde ninguna
    // parte, asi que el aviso por superar la meta nunca aparecio.
    const acumuladoPrevio = Almacenamiento.acumuladoPorActividad(actividad.codigo, registro.record_id);
    const avisos = Calculos.revisarRegistro(registro, actividad, config.PROYECTO, config.JORNADA, acumuladoPrevio);

    if (!avisos.length) {
      guardarRegistro(registro);
      return;
    }
    dibujarAvisos(avisos, registro);
  }

  // ---------------------------------------------------------------------------
  // Formulario
  // ---------------------------------------------------------------------------

  function prepararFormulario(opciones) {
    const conservar = opciones && opciones.conservarActividad;
    const codigo = conservar ? $('#codigo_edt').value : '';
    const formulario = $('#formulario');

    formulario.reset();
    $('#codigo_edt').value = codigo;
    limpiarAvisos();

    const preferencias = Almacenamiento.leerPreferencias();

    function poner(parametro, valor) {
      const campo = formulario.querySelector('[data-parametro="' + parametro + '"]');
      if (campo && valor !== null && valor !== undefined && valor !== '') campo.value = valor;
    }

    poner('fecha', hoyTexto());
    poner('hora_inicio', config.JORNADA.hora_inicio);
    poner('hora_termino', config.JORNADA.hora_termino);
    poner('persona_que_registra', preferencias.persona_que_registra);
    poner('cantidad_trabajadores', preferencias.cantidad_trabajadores);

    if (preferencias.sector) {
      const radio = formulario.querySelector('input[name="sector"][value="' + preferencias.sector + '"]');
      if (radio) radio.checked = true;
    }

    alCambiarActividad();
    actualizarCalculados();
  }

  function alCambiarActividad() {
    const actividad = actividadElegida();
    Formulario.dibujarEspecificos($('#campos-especificos'), actividad, config);
    $('#bloque-especificos').hidden = !actividad;
    $('#detalle-actividad').textContent = Formulario.textoDetalleActividad(actividad);
  }

  // ---------------------------------------------------------------------------
  // Lista de registros
  // ---------------------------------------------------------------------------

  function dato(etiqueta, valor, sinDato) {
    return el('div', { clase: 'dato' }, [
      el('span', { clase: 'dato-etiqueta', texto: etiqueta }),
      el('span', { clase: 'dato-valor' + (sinDato ? ' sin-dato' : ''), texto: valor }),
    ]);
  }

  function tarjetaRegistro(registro) {
    const baja = registro.registro_activo === false;
    const marca = baja
      ? el('span', { clase: 'marca marca-baja', texto: 'baja pendiente de enviar' })
      : registro.estado_sync === 'sincronizado'
        ? el('span', { clase: 'marca marca-sincronizado', texto: 'sincronizado' })
        : el('span', { clase: 'marca marca-pendiente', texto: 'pendiente' });

    const tarjeta = el('div', { clase: 'tarjeta' }, [
      el('div', { clase: 'tarjeta-cabecera' }, [
        el('span', { clase: 'tarjeta-titulo', texto: registro.codigo_edt + ' — ' + registro.actividad }),
        marca,
      ]),
      el('div', {
        clase: 'tarjeta-sub',
        texto: registro.fecha + ' · ' + nombreSector(registro.sector) + ' · ' + registro.persona_que_registra,
      }),
      el('div', { clase: 'tarjeta-datos' }, [
        dato('Ejecutado',
          Calculos.formatearNumero(registro.cantidad_ejecutada) + ' ' + (registro.unidad_medida || '')),
        dato('Horario', registro.hora_inicio + ' a ' + registro.hora_termino),
        dato('Horas-hombre',
          Calculos.formatearNumero(registro.horas_hombre, 2) + ' HH (' + registro.cantidad_trabajadores + ' personas)'),
        dato('Rendimiento',
          registro.rendimiento_por_hh === null || registro.rendimiento_por_hh === undefined
            ? '—'
            : Calculos.formatearNumero(registro.rendimiento_por_hh, 2) + ' por HH',
          registro.rendimiento_por_hh === null || registro.rendimiento_por_hh === undefined),
      ]),
    ]);

    if (registro.observaciones) {
      tarjeta.appendChild(el('p', { clase: 'ayuda', texto: registro.observaciones }));
    }

    if (!baja) {
      const borrar = el('button', { type: 'button', clase: 'boton boton-peligro boton-chico', texto: 'Eliminar' });
      borrar.addEventListener('click', function () { pedirEliminacion(registro); });
      tarjeta.appendChild(el('div', { clase: 'acciones' }, [borrar]));
    }

    return tarjeta;
  }

  /**
   * Eliminar tiene dos caminos y se dicen los dos, porque no son equivalentes:
   * un registro que ya viajo a la planilla no desaparece de ella al borrarlo del
   * telefono; hay que sincronizar para que la baja llegue.
   */
  function pedirEliminacion(registro) {
    const yaViajo = registro.estado_sync === 'sincronizado';
    const texto = yaViajo
      ? 'Este registro ya está en la planilla. Al eliminarlo queda marcado como baja y la planilla se corrige recién al sincronizar. ¿Continuar?'
      : 'Este registro todavía no se ha enviado a la planilla. Se borra del teléfono y no queda rastro. ¿Continuar?';

    if (!raiz.confirm(texto)) return;

    const resultado = Almacenamiento.eliminar(registro.record_id);
    mostrarMensaje(
      '#mensaje-registros',
      resultado.resultado === 'marcado_para_baja'
        ? 'Registro marcado como baja. Queda pendiente de sincronizar: hasta entonces, su fila sigue vigente en la planilla.'
        : 'Registro eliminado del teléfono.',
      resultado.resultado === 'marcado_para_baja' ? 'alerta' : null
    );
    refrescarTodo();
  }

  function dibujarRegistros() {
    const contenedor = $('#lista-registros');
    const registros = Almacenamiento.listar().slice().sort(function (a, b) {
      return String(b.fecha_creacion).localeCompare(String(a.fecha_creacion));
    });

    contenedor.innerHTML = '';
    const activos = registros.filter(function (r) { return r.registro_activo !== false; });
    const pendientes = Almacenamiento.pendientes();

    const insignia = $('#conteo-registros');
    insignia.textContent = String(activos.length);
    insignia.hidden = activos.length === 0;

    $('#resumen-registros').textContent = registros.length
      ? activos.length + ' registro(s) en este teléfono · ' + pendientes.length + ' pendiente(s) de enviar.'
      : 'Todavía no hay registros que enviar.';

    if (!registros.length) {
      contenedor.appendChild(
        el('div', { clase: 'vacio', texto: 'Todavía no hay registros guardados en este teléfono.' })
      );
      return;
    }
    registros.forEach(function (r) { contenedor.appendChild(tarjetaRegistro(r)); });
  }

  // ---------------------------------------------------------------------------
  // Sincronizacion
  // ---------------------------------------------------------------------------

  function sincronizar() {
    const boton = $('#boton-sincronizar');
    const pendientes = Almacenamiento.pendientes();

    boton.disabled = true;
    boton.textContent = 'Sincronizando…';
    ocultarMensaje('#mensaje-sync');

    Sincronizacion.sincronizar(pendientes, config, function (enviados, total) {
      boton.textContent = 'Enviando ' + enviados + ' de ' + total + '…';
    })
      .then(function (resultado) {
        // Solo se marca lo que la planilla confirmo recibir. Lo demas sigue
        // pendiente y se reintenta.
        if (resultado.enviados.length) Almacenamiento.marcarSincronizados(resultado.enviados);
        mostrarMensaje('#mensaje-sync', resultado.mensaje, resultado.ok ? null : 'error');
        refrescarTodo();
      })
      .finally(function () {
        boton.disabled = false;
        boton.textContent = 'Sincronizar ahora';
      });
  }

  // ---------------------------------------------------------------------------
  // Exportar y ajustes
  // ---------------------------------------------------------------------------

  function prepararExportar() {
    $('#boton-exportar-excel').addEventListener('click', function () {
      Exportar.aExcel(Almacenamiento.listar(), config);
    });
    $('#boton-exportar-json').addEventListener('click', function () {
      Exportar.aJson(Almacenamiento.exportarTodo());
    });

    $('#boton-sincronizar').addEventListener('click', sincronizar);

    $('#url_apps_script').value = Sincronizacion.leerUrl();
    $('#boton-guardar-url').addEventListener('click', function () {
      Sincronizacion.guardarUrl($('#url_apps_script').value);
      mostrarMensaje('#mensaje-url', 'Dirección guardada en este teléfono.', null);
    });
    $('#boton-restablecer-url').addEventListener('click', function () {
      $('#url_apps_script').value = Sincronizacion.restablecerUrl();
      mostrarMensaje('#mensaje-url', 'Se volvió a la dirección que trae la aplicación.', null);
    });

    $('#texto-version').textContent =
      'Aplicación ' + raiz.APP_VERSION + ' · ' + config.ACTIVIDADES.length +
      ' actividades registrables de las ' +
      (config.ACTIVIDADES.length + config.ACTIVIDADES_FUERA_DE_APP.length) + ' de la EDT';
  }

  // ---------------------------------------------------------------------------
  // Navegacion y estado
  // ---------------------------------------------------------------------------

  function irA(nombre) {
    document.querySelectorAll('.pantalla').forEach(function (p) {
      p.classList.toggle('activa', p.id === 'pantalla-' + nombre);
    });
    document.querySelectorAll('.nav-boton').forEach(function (b) {
      b.classList.toggle('activo', b.dataset.pantalla === nombre);
    });
    raiz.scrollTo(0, 0);
    refrescarTodo();
  }

  function actualizarChips() {
    const conexion = $('#estado-conexion');
    const enLinea = Sincronizacion.hayConexion();
    conexion.textContent = enLinea ? 'Con conexión' : 'Sin conexión — se guarda igual';
    conexion.className = 'chip ' + (enLinea ? 'chip-exito' : 'chip-alerta');

    const pendientes = Almacenamiento.pendientes().length;
    const chip = $('#estado-pendientes');
    chip.textContent = pendientes ? pendientes + ' pendiente(s) de sincronizar' : 'Todo sincronizado';
    chip.className = 'chip ' + (pendientes ? 'chip-alerta' : 'chip-exito');
  }

  function refrescarTodo() {
    actualizarChips();
    dibujarRegistros();
  }

  // ---------------------------------------------------------------------------

  function iniciar() {
    $('#nombre-proyecto').textContent = config.PROYECTO.nombre;

    Formulario.dibujarSelectorActividades($('#codigo_edt'), config.ACTIVIDADES);
    Formulario.dibujarComunes($('#campos-comunes'), $('#campos-observaciones'), config);

    $('#codigo_edt').addEventListener('change', alCambiarActividad);
    $('#formulario').addEventListener('submit', alEnviarFormulario);
    $('#formulario').addEventListener('input', function (evento) {
      const parametro = evento.target.dataset ? evento.target.dataset.parametro : null;
      if (parametro === 'hora_inicio' || parametro === 'hora_termino' || parametro === 'cantidad_trabajadores') {
        actualizarCalculados();
      }
    });
    $('#boton-limpiar').addEventListener('click', function () {
      prepararFormulario({ conservarActividad: false });
      ocultarMensaje('#mensaje-guardado');
    });

    document.querySelectorAll('.nav-boton').forEach(function (boton) {
      boton.addEventListener('click', function () { irA(boton.dataset.pantalla); });
    });

    raiz.addEventListener('online', actualizarChips);
    raiz.addEventListener('offline', actualizarChips);

    prepararExportar();
    prepararFormulario({ conservarActividad: false });
    refrescarTodo();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function (e) {
        console.warn('No se pudo registrar el service worker:', e);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  raiz.App = { irA: irA, refrescarTodo: refrescarTodo };
})(typeof self !== 'undefined' ? self : this);
