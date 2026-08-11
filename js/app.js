// Conexion entre la pantalla y el resto de los modulos.
//
// Orden de lectura sugerido: iniciar() al final del archivo arma todo; el resto
// son las piezas que usa.

(function (raiz) {
  'use strict';

  const config = raiz.CONFIG;
  const Calculos = raiz.Calculos;
  const Almacenamiento = raiz.Almacenamiento;
  const Formulario = raiz.Formulario;
  const Indicadores = raiz.Indicadores;
  const PantallaCostos = raiz.Costos;
  const Sincronizacion = raiz.Sincronizacion;
  const el = Formulario.elemento;

  const $ = function (selector) { return document.querySelector(selector); };

  // Registro pendiente de confirmacion: cuando hay avisos, se guarda aca hasta
  // que la persona confirme. Nunca se guarda a espaldas de esa confirmacion.
  let porConfirmar = null;
  let extras = [];

  function actividadElegida() {
    const codigo = $('#codigo_edt').value;
    return config.ACTIVIDADES.filter(function (a) { return a.codigo === codigo; })[0] || null;
  }

  function hoyTexto() {
    return Calculos.textoDeFecha(new Date());
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
        'Se descontaron ' + duracion.minutosColacion + ' minutos de colación porque el horario registrado cubre la ventana de ' +
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
          el('span', { clase: 'aviso-titulo', texto: a.nivel === 'error' ? 'Hay que corregir' : 'Revisa antes de guardar' }),
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
    const avisos = Calculos.revisarRegistro(registro, actividad, config.PROYECTO, config.JORNADA);

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
        texto:
          registro.fecha + ' · ' + Indicadores.nombreSector(registro.sector) +
          ' · ' + registro.persona_que_registra,
      }),
      el('div', { clase: 'tarjeta-datos' }, [
        el('div', { clase: 'dato' }, [
          el('span', { clase: 'dato-etiqueta', texto: 'Ejecutado' }),
          el('span', {
            clase: 'dato-valor',
            texto: Calculos.formatearNumero(registro.cantidad_ejecutada) + ' ' + (registro.unidad_medida || ''),
          }),
        ]),
        el('div', { clase: 'dato' }, [
          el('span', { clase: 'dato-etiqueta', texto: 'Horario' }),
          el('span', {
            clase: 'dato-valor',
            texto: registro.hora_inicio + ' a ' + registro.hora_termino,
          }),
        ]),
        el('div', { clase: 'dato' }, [
          el('span', { clase: 'dato-etiqueta', texto: 'Horas-hombre' }),
          el('span', {
            clase: 'dato-valor',
            texto: Calculos.formatearNumero(registro.horas_hombre, 2) + ' HH (' + registro.cantidad_trabajadores + ' personas)',
          }),
        ]),
        el('div', { clase: 'dato' }, [
          el('span', { clase: 'dato-etiqueta', texto: 'Rendimiento' }),
          el('span', {
            clase: 'dato-valor' + (registro.rendimiento_por_hh === null ? ' sin-dato' : ''),
            texto: registro.rendimiento_por_hh === null ? '—' : Calculos.formatearNumero(registro.rendimiento_por_hh, 2) + ' por HH',
          }),
        ]),
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
      '#mensaje-sync',
      resultado.resultado === 'marcado_para_baja'
        ? 'Registro marcado como baja. Queda pendiente de sincronizar: hasta entonces, su fila sigue viva en la planilla.'
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

    $('#resumen-registros').textContent =
      activos.length + ' registro(s) vigente(s), ' + pendientes.length + ' pendiente(s) de sincronizar.';

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
    const costos = Almacenamiento.leerCostos();

    boton.disabled = true;
    boton.textContent = 'Sincronizando…';
    ocultarMensaje('#mensaje-sync');

    Sincronizacion.enviar(pendientes, costos, config)
      .then(function (resultado) {
        if (resultado.ok) {
          Almacenamiento.marcarSincronizados(resultado.recibidos.concat(resultado.bajas || []));
          const noRecibidos = pendientes.length - (resultado.recibidos.length + (resultado.bajas || []).length);
          mostrarMensaje(
            '#mensaje-sync',
            resultado.mensaje + (noRecibidos > 0 ? ' Quedaron ' + noRecibidos + ' sin confirmar; se reintentan en la próxima sincronización.' : ''),
            noRecibidos > 0 ? 'alerta' : null
          );
        } else {
          mostrarMensaje('#mensaje-sync', resultado.mensaje, 'error');
        }
        refrescarTodo();
      })
      .finally(function () {
        boton.disabled = false;
        boton.textContent = 'Sincronizar ahora';
      });
  }

  function descargarCopia() {
    const datos = Almacenamiento.exportarTodo();
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = 'registro_fundacion_chile_' + hoyTexto() + '.json';
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(enlace.href);
  }

  // ---------------------------------------------------------------------------
  // Costos
  // ---------------------------------------------------------------------------

  function prepararCostos() {
    const formulario = $('#formulario-costos');
    PantallaCostos.llenarPeriodicidades($('#camioneta_periodicidad'));
    PantallaCostos.llenarPeriodicidades($('#banos_periodicidad'));

    const costos = Almacenamiento.leerCostos();
    extras = (costos.extras || []).slice();
    PantallaCostos.escribir(formulario, costos);
    PantallaCostos.dibujarExtras($('#lista-extras'), extras, function () {});
    actualizarAyudaCostoHH();

    $('#costo_hh').addEventListener('input', actualizarAyudaCostoHH);

    $('#boton-agregar-extra').addEventListener('click', function () {
      extras.push({ concepto: '', monto: null, fecha: hoyTexto() });
      PantallaCostos.dibujarExtras($('#lista-extras'), extras, function () {});
    });

    formulario.addEventListener('submit', function (evento) {
      evento.preventDefault();
      const costosNuevos = PantallaCostos.leer(formulario, extras);
      Almacenamiento.guardarCostos(costosNuevos);
      extras = costosNuevos.extras.slice();
      PantallaCostos.dibujarExtras($('#lista-extras'), extras, function () {});
      mostrarMensaje('#mensaje-costos', 'Parámetros económicos guardados. Los indicadores se recalcularon.', null);
      refrescarTodo();
    });
  }

  function actualizarAyudaCostoHH() {
    $('#ayuda-costo-hh').textContent = PantallaCostos.ayudaCostoHH($('#costo_hh').value, config);
  }

  // ---------------------------------------------------------------------------
  // Ajustes
  // ---------------------------------------------------------------------------

  function prepararAjustes() {
    $('#url_apps_script').value = Sincronizacion.leerUrl();
    $('#boton-guardar-url').addEventListener('click', function () {
      Sincronizacion.guardarUrl($('#url_apps_script').value);
      mostrarMensaje('#mensaje-sync', 'Dirección guardada.', null);
    });

    const horasDia = Calculos.horasJornadaEstandar(config.JORNADA);
    $('#texto-jornada').textContent =
      'De ' + config.JORNADA.hora_inicio + ' a ' + config.JORNADA.hora_termino +
      ' con ' + config.JORNADA.colacion_minutos + ' minutos de colación entre ' +
      config.JORNADA.colacion_inicio + ' y ' + config.JORNADA.colacion_termino + ': ' +
      Calculos.formatearNumero(horasDia, 1) + ' horas efectivas por persona y día hábil. ' +
      'La colación se descuenta solo cuando el horario registrado cubre esa ventana, ' +
      'para que registrar la mañana y la tarde por separado no la descuente dos veces.';

    const calendario = Calculos.estadoCalendario(hoyTexto(), config.PROYECTO);
    $('#texto-calendario').textContent =
      'Del ' + config.PROYECTO.fecha_inicio + ' al ' + config.PROYECTO.fecha_termino + '. ' +
      config.PROYECTO.dias_habiles_plan + ' días hábiles (lunes a viernes, sin el ' +
      config.PROYECTO.feriados.join(' ni el ') + '). ' +
      'Transcurridos: ' + calendario.transcurridos + '. Restantes: ' + calendario.restantes + '.';

    const lista = $('#lista-fuera-app');
    lista.innerHTML = '';
    config.ACTIVIDADES_FUERA_DE_APP.forEach(function (a) {
      lista.appendChild(el('li', { texto: a.codigo + ' — ' + a.nombre + ' (' + a.categoria + ')' }));
    });

    $('#texto-version').textContent =
      'Aplicación ' + raiz.APP_VERSION + '. ' +
      config.ACTIVIDADES.length + ' actividades registrables de las ' +
      (config.ACTIVIDADES.length + config.ACTIVIDADES_FUERA_DE_APP.length) + ' de la EDT.';
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
    const registros = Almacenamiento.listar();
    const costos = Almacenamiento.leerCostos();
    const hoy = hoyTexto();

    actualizarChips();
    dibujarRegistros();
    Indicadores.tarjetasProyecto($('#tarjetas-proyecto'), registros, config, hoy);
    Indicadores.dibujarActividades($('#indicadores-actividades'), registros, config, hoy);
    Indicadores.dibujarEconomicos($('#indicadores-economicos'), registros, costos, config, hoy);
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

    $('#boton-sincronizar').addEventListener('click', sincronizar);
    $('#boton-exportar').addEventListener('click', descargarCopia);

    document.querySelectorAll('.nav-boton').forEach(function (boton) {
      boton.addEventListener('click', function () { irA(boton.dataset.pantalla); });
    });

    raiz.addEventListener('online', actualizarChips);
    raiz.addEventListener('offline', actualizarChips);

    prepararCostos();
    prepararAjustes();
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
