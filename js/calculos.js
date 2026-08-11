// Calculos del registro: duracion, horas-hombre, indicadores de rendimiento y
// costos. Este archivo no toca la pantalla ni el almacenamiento a proposito: asi
// se puede ejecutar tal cual en Node para probarlo (ver pruebas/).
//
// Regla de fondo que se repite en todo el archivo: cuando falta un dato de
// entrada, el resultado es null y la pantalla muestra una raya. Nunca se
// inventa un numero de referencia ni se rellena con cero, porque un cero se lee
// como "medi cero" y no como "no lo se".

(function (raiz) {
  'use strict';

  const MINUTOS_DIA = 24 * 60;
  const DIAS_POR_MES = 30.4375; // Promedio anual; se usa para prorratear arriendos mensuales.

  // ---------------------------------------------------------------------------
  // Horas y fechas
  // ---------------------------------------------------------------------------

  /** '08:30' -> 510 minutos. Devuelve null si el texto no es una hora valida. */
  function minutosDeHora(hora) {
    if (typeof hora !== 'string') return null;
    const m = hora.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }

  function horaDeMinutos(minutos) {
    const m = ((minutos % MINUTOS_DIA) + MINUTOS_DIA) % MINUTOS_DIA;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  /** Minutos de solape entre dos tramos horarios. 0 si no se tocan. */
  function solapeMinutos(inicioA, terminoA, inicioB, terminoB) {
    return Math.max(0, Math.min(terminoA, terminoB) - Math.max(inicioA, inicioB));
  }

  /**
   * Duracion de un tramo de trabajo, descontando la colacion.
   *
   * La colacion se descuenta solo por el tiempo que el tramo registrado se
   * solapa con la ventana de colacion del proyecto (13:00 a 13:30). De esa
   * manera, si la jornada se registra en dos tramos (manana y tarde), la media
   * hora no se descuenta dos veces.
   *
   * Devuelve siempre un objeto; si hay un problema, `error` explica cual y las
   * duraciones quedan en null. No se corrige el dato en silencio.
   */
  function calcularDuracion(horaInicio, horaTermino, jornada) {
    const inicio = minutosDeHora(horaInicio);
    const termino = minutosDeHora(horaTermino);
    const vacio = { minutosBrutos: null, horasBrutas: null, minutosColacion: 0, horas: null, error: null };

    if (inicio === null || termino === null) {
      return Object.assign({}, vacio, { error: 'Faltan la hora de inicio o la de termino.' });
    }
    if (termino === inicio) {
      return Object.assign({}, vacio, { error: 'La hora de termino es igual a la de inicio.' });
    }
    if (termino < inicio) {
      // Caso real observado en el proyecto hermano: escribir 15:00 a 07:30 daba
      // una jornada de 16,5 horas y reportaba la mitad del rendimiento, sin avisar.
      return Object.assign({}, vacio, {
        error: 'La hora de termino (' + horaTermino + ') es anterior a la de inicio (' + horaInicio + ').',
      });
    }

    const minutosBrutos = termino - inicio;
    let minutosColacion = 0;
    const colacionInicio = minutosDeHora(jornada.colacion_inicio);
    const colacionTermino = minutosDeHora(jornada.colacion_termino);
    if (colacionInicio !== null && colacionTermino !== null && colacionTermino > colacionInicio) {
      minutosColacion = Math.min(
        solapeMinutos(inicio, termino, colacionInicio, colacionTermino),
        jornada.colacion_minutos || 0
      );
    }

    return {
      minutosBrutos: minutosBrutos,
      horasBrutas: redondear(minutosBrutos / 60, 4),
      minutosColacion: minutosColacion,
      horas: redondear((minutosBrutos - minutosColacion) / 60, 4),
      error: null,
    };
  }

  /** Horas efectivas de la jornada estandar del proyecto (08:00 a 16:00 menos colacion). */
  function horasJornadaEstandar(jornada) {
    const d = calcularDuracion(jornada.hora_inicio, jornada.hora_termino, jornada);
    return d.horas;
  }

  function horasHombre(horas, cantidadTrabajadores) {
    if (horas === null || horas === undefined) return null;
    const n = Number(cantidadTrabajadores);
    if (!Number.isFinite(n) || n <= 0) return null;
    return redondear(horas * n, 4);
  }

  function fechaDeTexto(texto) {
    if (!texto) return null;
    const m = String(texto).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    // Se construye en horario local a mediodia para que ningun cambio de huso
    // horario mueva la fecha al dia anterior.
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  }

  function textoDeFecha(fecha) {
    return (
      fecha.getFullYear() +
      '-' +
      String(fecha.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(fecha.getDate()).padStart(2, '0')
    );
  }

  function esDiaHabil(textoFecha, proyecto) {
    const f = fechaDeTexto(textoFecha);
    if (!f) return false;
    const dia = f.getDay(); // 0 domingo, 6 sabado
    if (dia === 0 || dia === 6) return false;
    return (proyecto.feriados || []).indexOf(textoFecha.slice(0, 10)) === -1;
  }

  /** Dias habiles entre dos fechas, ambas incluidas. */
  function diasHabilesEntre(desde, hasta, proyecto) {
    const inicio = fechaDeTexto(desde);
    const fin = fechaDeTexto(hasta);
    if (!inicio || !fin || fin < inicio) return 0;
    let cuenta = 0;
    const cursor = new Date(inicio.getTime());
    while (cursor <= fin) {
      if (esDiaHabil(textoDeFecha(cursor), proyecto)) cuenta += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    return cuenta;
  }

  /**
   * Estado del calendario del proyecto a una fecha dada.
   * `transcurridos` cuenta los dias habiles desde el inicio hasta hoy inclusive;
   * `restantes` cuenta desde manana hasta la fecha de termino.
   */
  function estadoCalendario(hoy, proyecto) {
    const fechaHoy = hoy || textoDeFecha(new Date());
    const inicio = proyecto.fecha_inicio;
    const termino = proyecto.fecha_termino;
    const plan = proyecto.dias_habiles_plan || diasHabilesEntre(inicio, termino, proyecto);

    let transcurridos = 0;
    if (fechaDeTexto(fechaHoy) >= fechaDeTexto(inicio)) {
      const tope = fechaDeTexto(fechaHoy) > fechaDeTexto(termino) ? termino : fechaHoy;
      transcurridos = diasHabilesEntre(inicio, tope, proyecto);
    }

    let restantes = 0;
    const manana = fechaDeTexto(fechaHoy);
    if (manana) {
      manana.setDate(manana.getDate() + 1);
      restantes = diasHabilesEntre(textoDeFecha(manana), termino, proyecto);
    }

    return {
      fecha: fechaHoy,
      plan: plan,
      transcurridos: transcurridos,
      restantes: restantes,
      dentroDelPeriodo:
        fechaDeTexto(fechaHoy) >= fechaDeTexto(inicio) && fechaDeTexto(fechaHoy) <= fechaDeTexto(termino),
    };
  }

  // ---------------------------------------------------------------------------
  // Avisos sobre un registro
  // ---------------------------------------------------------------------------

  /**
   * Revisa un registro antes de guardarlo y devuelve una lista de avisos.
   *
   * Ninguno bloquea el guardado: cuando el sistema mide algo que todavia no se
   * conoce, no hay contra que contrastar y un dato malo no se delata despues.
   * Lo unico que se puede hacer es mostrar el numero que va a quedar guardado y
   * pedir confirmacion. Por la misma razon la lista tiene que quedar vacia en el
   * caso normal: un aviso que aparece siempre se aprende a cerrar sin leer.
   */
  function revisarRegistro(registro, actividad, proyecto, jornada) {
    const avisos = [];
    const duracion = calcularDuracion(registro.hora_inicio, registro.hora_termino, jornada);

    if (duracion.error) {
      avisos.push({ nivel: 'error', campo: 'hora_termino', mensaje: duracion.error });
    } else {
      const estandar = horasJornadaEstandar(jornada);
      if (duracion.horas > estandar) {
        avisos.push({
          nivel: 'aviso',
          campo: 'hora_termino',
          mensaje:
            'La jornada registrada es de ' +
            formatearNumero(duracion.horas) +
            ' h y la jornada estandar del proyecto es de ' +
            formatearNumero(estandar) +
            ' h (' +
            jornada.hora_inicio +
            ' a ' +
            jornada.hora_termino +
            ' con ' +
            jornada.colacion_minutos +
            ' min de colacion).',
        });
      }
      const inicio = minutosDeHora(registro.hora_inicio);
      const termino = minutosDeHora(registro.hora_termino);
      const jornadaInicio = minutosDeHora(jornada.hora_inicio);
      const jornadaTermino = minutosDeHora(jornada.hora_termino);
      if (inicio < jornadaInicio || termino > jornadaTermino) {
        avisos.push({
          nivel: 'aviso',
          campo: 'hora_inicio',
          mensaje:
            'El horario registrado (' +
            registro.hora_inicio +
            ' a ' +
            registro.hora_termino +
            ') queda fuera de la jornada del proyecto (' +
            jornada.hora_inicio +
            ' a ' +
            jornada.hora_termino +
            ').',
        });
      }
    }

    const trabajadores = Number(registro.cantidad_trabajadores);
    if (!Number.isFinite(trabajadores) || trabajadores <= 0) {
      avisos.push({
        nivel: 'error',
        campo: 'cantidad_trabajadores',
        mensaje: 'La cantidad de trabajadores debe ser mayor que cero.',
      });
    }

    if (registro.fecha) {
      if (fechaDeTexto(registro.fecha) < fechaDeTexto(proyecto.fecha_inicio) ||
          fechaDeTexto(registro.fecha) > fechaDeTexto(proyecto.fecha_termino)) {
        avisos.push({
          nivel: 'aviso',
          campo: 'fecha',
          mensaje:
            'La fecha ' +
            registro.fecha +
            ' queda fuera del periodo del proyecto (' +
            proyecto.fecha_inicio +
            ' a ' +
            proyecto.fecha_termino +
            ').',
        });
      } else if (!esDiaHabil(registro.fecha, proyecto)) {
        avisos.push({
          nivel: 'aviso',
          campo: 'fecha',
          mensaje: 'La fecha ' + registro.fecha + ' no es un dia habil del calendario del proyecto.',
        });
      }
    }

    const cantidad = Number(registro.cantidad_ejecutada);
    if (Number.isFinite(cantidad) && actividad) {
      // Solo se compara cuando la EDT entrega una referencia. Una actividad sin
      // meta no genera alerta: se muestra lo medido y nada mas.
      const referencia = actividad.meta_diaria_teorica;
      if (referencia && cantidad > referencia * 3) {
        avisos.push({
          nivel: 'aviso',
          campo: 'cantidad_ejecutada',
          mensaje:
            'Vas a guardar ' +
            formatearNumero(cantidad) +
            ' ' +
            (actividad.unidad_medida || 'unidades') +
            ' en una jornada. La meta diaria teorica de esta actividad es ' +
            formatearNumero(referencia) +
            '. Revisa que el numero sea el correcto.',
        });
      }
      if (actividad.meta && cantidad > actividad.meta) {
        avisos.push({
          nivel: 'aviso',
          campo: 'cantidad_ejecutada',
          mensaje:
            'La cantidad de este solo registro (' +
            formatearNumero(cantidad) +
            ') supera la meta total de la actividad (' +
            formatearNumero(actividad.meta) +
            ').',
        });
      }
    }

    return avisos;
  }

  // ---------------------------------------------------------------------------
  // Indicadores de rendimiento
  // ---------------------------------------------------------------------------

  function suma(lista, obtener) {
    return lista.reduce(function (total, item) {
      const v = Number(obtener(item));
      return total + (Number.isFinite(v) ? v : 0);
    }, 0);
  }

  function dividir(numerador, denominador) {
    if (!Number.isFinite(numerador) || !Number.isFinite(denominador) || denominador === 0) return null;
    return numerador / denominador;
  }

  /**
   * Indicadores de una actividad a partir de sus registros activos.
   * Corresponde a los KPI_01 a KPI_11 de la hoja 04_KPI_Definiciones.
   */
  function indicadoresActividad(registros, actividad, proyecto, hoy) {
    const activos = registros.filter(function (r) {
      return r.registro_activo !== false && r.codigo_edt === actividad.codigo;
    });

    const cantidad = suma(activos, function (r) { return r.cantidad_ejecutada; });
    const hh = suma(activos, function (r) { return r.horas_hombre; });
    const duracion = suma(activos, function (r) { return r.duracion_horas; });
    const personasPorDuracion = suma(activos, function (r) {
      return Number(r.cantidad_trabajadores) * Number(r.duracion_horas);
    });

    const calendario = estadoCalendario(hoy, proyecto);
    const meta = actividad.meta;
    const avanceEsperado = meta ? (meta * calendario.transcurridos) / calendario.plan : null;

    return {
      codigo: actividad.codigo,
      nombre: actividad.nombre,
      unidad: actividad.unidad_medida,
      registros: activos.length,
      // KPI_04
      avanceAcumulado: activos.length ? cantidad : null,
      // KPI_10
      horasHombre: activos.length ? redondear(hh, 2) : null,
      duracionHoras: activos.length ? redondear(duracion, 2) : null,
      // KPI_01
      rendimientoPorHH: dividir(cantidad, hh),
      // KPI_02
      hhPorUnidad: dividir(hh, cantidad),
      // KPI_03
      rendimientoCuadrilla: dividir(cantidad, duracion),
      // KPI_11
      tamanoMedioCuadrilla: dividir(personasPorDuracion, duracion),
      // KPI_05: solo existe si la EDT define meta
      meta: meta || null,
      porcentajeAvance: meta ? dividir(cantidad, meta) : null,
      // KPI_06
      metaDiariaTeorica: meta ? dividir(meta, calendario.plan) : null,
      // KPI_07
      avanceEsperado: avanceEsperado,
      // KPI_08: negativo es atraso respecto del ritmo lineal
      desviacionAvance: meta ? cantidad - avanceEsperado : null,
      // KPI_09
      ritmoRequeridoRestante: meta ? dividir(Math.max(meta - cantidad, 0), calendario.restantes) : null,
      diasHabilesRestantes: calendario.restantes,
      diasHabilesTranscurridos: calendario.transcurridos,
    };
  }

  /** Los mismos indicadores agrupados por sector para una actividad. */
  function indicadoresPorSector(registros, actividad, proyecto, hoy) {
    const sectores = {};
    registros.forEach(function (r) {
      if (r.registro_activo === false || r.codigo_edt !== actividad.codigo) return;
      sectores[r.sector] = sectores[r.sector] || [];
      sectores[r.sector].push(r);
    });
    return Object.keys(sectores)
      .sort()
      .map(function (sector) {
        const parcial = indicadoresActividad(sectores[sector], actividad, proyecto, hoy);
        // El % de avance por sector se omite: la meta de la EDT es del proyecto
        // completo, no de cada sector, y repartirla seria inventar una referencia.
        parcial.porcentajeAvance = null;
        parcial.avanceEsperado = null;
        parcial.desviacionAvance = null;
        parcial.ritmoRequeridoRestante = null;
        parcial.sector = sector;
        return parcial;
      });
  }

  // ---------------------------------------------------------------------------
  // Indicadores economicos
  // ---------------------------------------------------------------------------

  // Los valores de costo no vienen de la EDT: los llena la persona que
  // administra el proyecto en la pantalla de Costos. Mientras esten vacios, todo
  // indicador economico devuelve null.

  const PERIODICIDADES = {
    dia_habil: 'Por dia habil',
    mes: 'Por mes',
    proyecto: 'Total del proyecto',
  };

  function costosVacios() {
    return {
      costo_hh: null,             // Costo de una hora-hombre, en pesos
      camioneta_monto: null,
      camioneta_periodicidad: 'mes',
      banos_monto: null,
      banos_periodicidad: 'mes',
      extras: [],                 // [{ concepto, monto, fecha }]
      moneda: 'CLP',
      actualizado: null,
    };
  }

  function mesesDelProyecto(proyecto) {
    const inicio = fechaDeTexto(proyecto.fecha_inicio);
    const fin = fechaDeTexto(proyecto.fecha_termino);
    if (!inicio || !fin) return null;
    const dias = Math.round((fin - inicio) / 86400000) + 1;
    return dias / DIAS_POR_MES;
  }

  /** Lleva un monto declarado en cualquier periodicidad al total del proyecto. */
  function montoTotalProyecto(monto, periodicidad, proyecto) {
    const n = Number(monto);
    if (!Number.isFinite(n) || n <= 0) return null;
    const plan = proyecto.dias_habiles_plan;
    if (periodicidad === 'dia_habil') return n * plan;
    if (periodicidad === 'mes') return n * mesesDelProyecto(proyecto);
    return n; // 'proyecto'
  }

  /**
   * Indicadores economicos del proyecto.
   *
   * Los indirectos (camioneta y banos) se reparten por dia habil porque se pagan
   * por calendario y no por produccion. El costo de mano de obra sale de las
   * horas-hombre efectivamente registradas.
   */
  function indicadoresEconomicos(registros, costos, proyecto, hoy) {
    const calendario = estadoCalendario(hoy, proyecto);
    const activos = registros.filter(function (r) { return r.registro_activo !== false; });
    const hhTotal = suma(activos, function (r) { return r.horas_hombre; });

    const camionetaProyecto = montoTotalProyecto(costos.camioneta_monto, costos.camioneta_periodicidad, proyecto);
    const banosProyecto = montoTotalProyecto(costos.banos_monto, costos.banos_periodicidad, proyecto);
    const extras = (costos.extras || []).reduce(function (total, e) {
      const n = Number(e.monto);
      return total + (Number.isFinite(n) ? n : 0);
    }, 0);
    const tieneExtras = (costos.extras || []).length > 0;

    const costoHH = Number(costos.costo_hh);
    const manoObra = Number.isFinite(costoHH) && costoHH > 0 ? hhTotal * costoHH : null;

    const indirectosProyecto =
      camionetaProyecto === null && banosProyecto === null
        ? null
        : (camionetaProyecto || 0) + (banosProyecto || 0);

    const indirectosPorDiaHabil = indirectosProyecto === null ? null : indirectosProyecto / calendario.plan;
    const indirectosALaFecha =
      indirectosPorDiaHabil === null ? null : indirectosPorDiaHabil * calendario.transcurridos;

    // El costo a la fecha suma solo los componentes que estan cargados. Si falta
    // el valor de la hora-hombre, se informa como parcial en vez de dar un total
    // que se leeria como si estuviera completo.
    const componentes = [manoObra, indirectosALaFecha, tieneExtras ? extras : null];
    const cargados = componentes.filter(function (c) { return c !== null; });
    const costoALaFecha = cargados.length ? cargados.reduce(function (a, b) { return a + b; }, 0) : null;
    const completo = manoObra !== null && indirectosALaFecha !== null;

    // Proyeccion a termino: la mano de obra se estima manteniendo el ritmo de
    // horas-hombre por dia habil ya observado.
    const hhPorDiaHabil = calendario.transcurridos > 0 ? hhTotal / calendario.transcurridos : null;
    const manoObraProyectada =
      manoObra !== null && hhPorDiaHabil !== null ? hhPorDiaHabil * calendario.plan * costoHH : null;
    const costoProyectado =
      manoObraProyectada !== null || indirectosProyecto !== null
        ? (manoObraProyectada || 0) + (indirectosProyecto || 0) + (tieneExtras ? extras : 0)
        : null;

    return {
      moneda: costos.moneda || 'CLP',
      horasHombreTotales: redondear(hhTotal, 2),
      costoHH: Number.isFinite(costoHH) && costoHH > 0 ? costoHH : null,
      manoObra: manoObra,
      camionetaProyecto: camionetaProyecto,
      banosProyecto: banosProyecto,
      extras: tieneExtras ? extras : null,
      indirectosProyecto: indirectosProyecto,
      indirectosPorDiaHabil: indirectosPorDiaHabil,
      indirectosALaFecha: indirectosALaFecha,
      costoALaFecha: costoALaFecha,
      costoALaFechaCompleto: completo,
      costoProyectado: costoProyectado,
      costoProyectadoCompleto: manoObraProyectada !== null && indirectosProyecto !== null,
      diasHabilesTranscurridos: calendario.transcurridos,
      diasHabilesRestantes: calendario.restantes,
      faltantes: [
        Number.isFinite(costoHH) && costoHH > 0 ? null : 'Costo de la hora-hombre',
        camionetaProyecto === null ? 'Arriendo de camioneta' : null,
        banosProyecto === null ? 'Arriendo de baños' : null,
      ].filter(Boolean),
    };
  }

  /**
   * Costo por unidad de una actividad.
   *
   * Se entregan dos numeros distintos y con ese nombre a proposito:
   *  - costoUnitarioManoObra: dato duro, sale de horas-hombre por costo de HH.
   *  - costoUnitarioConIndirectos: estimacion, reparte camioneta y banos entre
   *    las actividades segun su participacion en las horas-hombre del proyecto.
   *    Es un supuesto de reparto, no una medicion.
   */
  function economiaActividad(registros, actividad, costos, proyecto, hoy) {
    const indicadores = indicadoresActividad(registros, actividad, proyecto, hoy);
    const economia = indicadoresEconomicos(registros, costos, proyecto, hoy);

    const hh = indicadores.horasHombre;
    const cantidad = indicadores.avanceAcumulado;
    const costoManoObra = economia.costoHH !== null && hh !== null ? hh * economia.costoHH : null;

    let indirectosAsignados = null;
    if (economia.indirectosALaFecha !== null && hh !== null && economia.horasHombreTotales > 0) {
      indirectosAsignados = economia.indirectosALaFecha * (hh / economia.horasHombreTotales);
    }

    const costoTotal =
      costoManoObra === null && indirectosAsignados === null
        ? null
        : (costoManoObra || 0) + (indirectosAsignados || 0);

    return {
      codigo: actividad.codigo,
      nombre: actividad.nombre,
      unidad: actividad.unidad_medida,
      cantidad: cantidad,
      horasHombre: hh,
      costoManoObra: costoManoObra,
      indirectosAsignados: indirectosAsignados,
      costoTotal: costoTotal,
      costoUnitarioManoObra: dividir(costoManoObra, cantidad),
      costoUnitarioConIndirectos: dividir(costoTotal, cantidad),
      // Costo que faltaria gastar para llegar a la meta, al ritmo de costo actual.
      costoPendienteEstimado:
        actividad.meta && cantidad
          ? multiplicarSiHay(dividir(costoTotal, cantidad), Math.max(actividad.meta - cantidad, 0))
          : null,
    };
  }

  function multiplicarSiHay(a, b) {
    if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
    return a * b;
  }

  // ---------------------------------------------------------------------------
  // Formato
  // ---------------------------------------------------------------------------

  function redondear(n, decimales) {
    if (!Number.isFinite(n)) return null;
    const factor = Math.pow(10, decimales);
    return Math.round(n * factor) / factor;
  }

  /** Numero en formato chileno: coma decimal y punto de miles. */
  function formatearNumero(n, decimales) {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
    const d = decimales === undefined ? (Number.isInteger(Number(n)) ? 0 : 2) : decimales;
    return Number(n).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function formatearPesos(n) {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
    return '$' + Math.round(Number(n)).toLocaleString('es-CL');
  }

  function formatearPorcentaje(fraccion, decimales) {
    if (fraccion === null || fraccion === undefined || !Number.isFinite(Number(fraccion))) return '—';
    return formatearNumero(Number(fraccion) * 100, decimales === undefined ? 1 : decimales) + '%';
  }

  const api = {
    MINUTOS_DIA: MINUTOS_DIA,
    PERIODICIDADES: PERIODICIDADES,
    minutosDeHora: minutosDeHora,
    horaDeMinutos: horaDeMinutos,
    calcularDuracion: calcularDuracion,
    horasJornadaEstandar: horasJornadaEstandar,
    horasHombre: horasHombre,
    fechaDeTexto: fechaDeTexto,
    textoDeFecha: textoDeFecha,
    esDiaHabil: esDiaHabil,
    diasHabilesEntre: diasHabilesEntre,
    estadoCalendario: estadoCalendario,
    revisarRegistro: revisarRegistro,
    indicadoresActividad: indicadoresActividad,
    indicadoresPorSector: indicadoresPorSector,
    costosVacios: costosVacios,
    mesesDelProyecto: mesesDelProyecto,
    montoTotalProyecto: montoTotalProyecto,
    indicadoresEconomicos: indicadoresEconomicos,
    economiaActividad: economiaActividad,
    redondear: redondear,
    formatearNumero: formatearNumero,
    formatearPesos: formatearPesos,
    formatearPorcentaje: formatearPorcentaje,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    raiz.Calculos = api;
  }
})(typeof self !== 'undefined' ? self : this);
