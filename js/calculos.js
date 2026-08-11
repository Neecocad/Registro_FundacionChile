// Calculos que necesita el formulario: duracion de la jornada, horas-hombre y
// las advertencias que se muestran antes de guardar.
//
// Lo que NO esta aca, a proposito: los indicadores. El avance, el rendimiento
// acumulado, el porcentaje contra la meta y todo lo economico se calculan en la
// planilla de Google, con formulas que se recalculan solas cuando llegan
// registros nuevos. La aplicacion solo captura.
//
// Este archivo no toca la pantalla ni el almacenamiento, asi que se puede
// ejecutar tal cual en Node para probarlo (ver pruebas/).

(function (raiz) {
  'use strict';

  const MINUTOS_DIA = 24 * 60;

  // ---------------------------------------------------------------------------
  // Horas
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
    return calcularDuracion(jornada.hora_inicio, jornada.hora_termino, jornada).horas;
  }

  function horasHombre(horas, cantidadTrabajadores) {
    if (horas === null || horas === undefined) return null;
    const n = Number(cantidadTrabajadores);
    if (!Number.isFinite(n) || n <= 0) return null;
    return redondear(horas * n, 4);
  }

  /**
   * Rendimiento del registro, en las dos bases que se usan.
   *
   * Se guardan en la fila por comodidad al mirar un registro suelto. Los
   * indicadores de la planilla NO los usan: se recalculan sobre los acumulados,
   * porque promediar rendimientos de registros hace pesar igual una jornada
   * corta que una completa.
   */
  function rendimientos(cantidadEjecutada, horasHombreTotales, jornada) {
    const cantidad = Number(cantidadEjecutada);
    const hh = Number(horasHombreTotales);
    if (!Number.isFinite(cantidad) || !Number.isFinite(hh) || hh <= 0) {
      return { porHoraHombre: null, porJornada: null };
    }
    const porHoraHombre = cantidad / hh;
    return {
      porHoraHombre: redondear(porHoraHombre, 4),
      porJornada: redondear(porHoraHombre * horasJornadaEstandar(jornada), 4),
    };
  }

  // ---------------------------------------------------------------------------
  // Calendario
  // ---------------------------------------------------------------------------

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
    return (proyecto.feriados || []).indexOf(String(textoFecha).slice(0, 10)) === -1;
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

  /** Estado del calendario del proyecto a una fecha dada. */
  function estadoCalendario(hoy, proyecto) {
    const fechaHoy = hoy || textoDeFecha(new Date());
    const plan = proyecto.dias_habiles_plan ||
      diasHabilesEntre(proyecto.fecha_inicio, proyecto.fecha_termino, proyecto);

    let transcurridos = 0;
    if (fechaDeTexto(fechaHoy) >= fechaDeTexto(proyecto.fecha_inicio)) {
      const tope = fechaDeTexto(fechaHoy) > fechaDeTexto(proyecto.fecha_termino)
        ? proyecto.fecha_termino
        : fechaHoy;
      transcurridos = diasHabilesEntre(proyecto.fecha_inicio, tope, proyecto);
    }

    const manana = fechaDeTexto(fechaHoy);
    let restantes = 0;
    if (manana) {
      manana.setDate(manana.getDate() + 1);
      restantes = diasHabilesEntre(textoDeFecha(manana), proyecto.fecha_termino, proyecto);
    }

    return {
      fecha: fechaHoy,
      plan: plan,
      transcurridos: transcurridos,
      restantes: restantes,
      dentroDelPeriodo:
        fechaDeTexto(fechaHoy) >= fechaDeTexto(proyecto.fecha_inicio) &&
        fechaDeTexto(fechaHoy) <= fechaDeTexto(proyecto.fecha_termino),
    };
  }

  // ---------------------------------------------------------------------------
  // Avisos sobre un registro
  // ---------------------------------------------------------------------------

  /**
   * Revisa un registro antes de guardarlo y devuelve una lista de avisos.
   *
   * `acumuladoPrevio` es lo ya registrado para esa actividad en este dispositivo.
   * Sirve para avisar cuando el registro nuevo hace que el acumulado pase la meta.
   * Es un dato del dispositivo y no del proyecto completo: si el equipo registra
   * desde varios telefonos, cada uno ve solo lo suyo, y eso se dice en el aviso.
   *
   * Ningun aviso bloquea el guardado, salvo los de nivel 'error'. Cuando el
   * sistema mide algo que todavia no se conoce, no hay contra que contrastar y un
   * dato malo no se delata despues: lo unico que se puede hacer es mostrar el
   * numero que va a quedar guardado y pedir confirmacion. Por la misma razon la
   * lista tiene que quedar vacia en el caso normal: un aviso que aparece siempre
   * se aprende a cerrar sin leer.
   */
  function revisarRegistro(registro, actividad, proyecto, jornada, acumuladoPrevio) {
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
            'La jornada registrada es de ' + formatearNumero(duracion.horas) +
            ' h y la jornada estandar del proyecto es de ' + formatearNumero(estandar) +
            ' h (' + jornada.hora_inicio + ' a ' + jornada.hora_termino + ' con ' +
            jornada.colacion_minutos + ' min de colacion).',
        });
      }
      const inicio = minutosDeHora(registro.hora_inicio);
      const termino = minutosDeHora(registro.hora_termino);
      if (inicio < minutosDeHora(jornada.hora_inicio) || termino > minutosDeHora(jornada.hora_termino)) {
        avisos.push({
          nivel: 'aviso',
          campo: 'hora_inicio',
          mensaje:
            'El horario registrado (' + registro.hora_inicio + ' a ' + registro.hora_termino +
            ') queda fuera de la jornada del proyecto (' + jornada.hora_inicio + ' a ' +
            jornada.hora_termino + ').',
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
      const fuera =
        fechaDeTexto(registro.fecha) < fechaDeTexto(proyecto.fecha_inicio) ||
        fechaDeTexto(registro.fecha) > fechaDeTexto(proyecto.fecha_termino);
      if (fuera) {
        avisos.push({
          nivel: 'aviso',
          campo: 'fecha',
          mensaje:
            'La fecha ' + registro.fecha + ' queda fuera del periodo del proyecto (' +
            proyecto.fecha_inicio + ' a ' + proyecto.fecha_termino + ').',
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
            'Vas a guardar ' + formatearNumero(cantidad) + ' ' +
            (actividad.unidad_medida || 'unidades') + ' en una jornada. La meta diaria teorica de ' +
            'esta actividad es ' + formatearNumero(referencia) + '. Revisa que el numero sea el correcto.',
        });
      }

      // Aviso por acumulado. En el proyecto hermano existia una funcion que
      // calculaba esto —lo decia su propio comentario— pero no se llamaba desde
      // ninguna parte, asi que el aviso nunca aparecio. Aca se llama, y hay una
      // comprobacion que verifica que efectivamente aparece.
      const previo = Number(acumuladoPrevio);
      if (actividad.meta && Number.isFinite(previo)) {
        const acumulado = previo + cantidad;
        if (acumulado > actividad.meta) {
          avisos.push({
            nivel: 'aviso',
            campo: 'cantidad_ejecutada',
            mensaje:
              'Con este registro el acumulado de la actividad llega a ' + formatearNumero(acumulado) +
              ' y la meta es ' + formatearNumero(actividad.meta) +
              '. (Se cuenta solo lo registrado en este telefono.)',
          });
        }
      }
    }

    return avisos;
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

  const api = {
    MINUTOS_DIA: MINUTOS_DIA,
    minutosDeHora: minutosDeHora,
    horaDeMinutos: horaDeMinutos,
    calcularDuracion: calcularDuracion,
    horasJornadaEstandar: horasJornadaEstandar,
    horasHombre: horasHombre,
    rendimientos: rendimientos,
    fechaDeTexto: fechaDeTexto,
    textoDeFecha: textoDeFecha,
    esDiaHabil: esDiaHabil,
    diasHabilesEntre: diasHabilesEntre,
    estadoCalendario: estadoCalendario,
    revisarRegistro: revisarRegistro,
    redondear: redondear,
    formatearNumero: formatearNumero,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    raiz.Calculos = api;
  }
})(typeof self !== 'undefined' ? self : this);
