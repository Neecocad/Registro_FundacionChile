// Guardado local de los registros. Todo vive en el dispositivo primero: registrar
// nunca depende de que haya red. La sincronizacion es un paso posterior y
// opcional (ver js/sincronizacion.js).
//
// Se usa localStorage y no IndexedDB porque el volumen esperado es chico (36 dias
// habiles de registros) y porque localStorage es sincrono: no hay estados a
// medio guardar si el telefono se bloquea. Si algun dia el volumen crece, este
// es el unico archivo que habria que cambiar.

(function (raiz) {
  'use strict';

  const CLAVE_REGISTROS = 'fch_registros_v1';
  const CLAVE_PREFERENCIAS = 'fch_preferencias_v1';

  function almacen() {
    try {
      return raiz.localStorage;
    } catch (e) {
      return null;
    }
  }

  function leerJSON(clave, porDefecto) {
    const a = almacen();
    if (!a) return porDefecto;
    try {
      const bruto = a.getItem(clave);
      return bruto ? JSON.parse(bruto) : porDefecto;
    } catch (e) {
      // Un JSON corrupto no puede dejar la aplicacion inutilizable en terreno.
      console.error('No se pudo leer ' + clave + ', se parte de cero:', e);
      return porDefecto;
    }
  }

  function escribirJSON(clave, valor) {
    const a = almacen();
    if (!a) throw new Error('El navegador no permite guardar datos localmente.');
    a.setItem(clave, JSON.stringify(valor));
  }

  /** Identificador estable del registro; no depende del numero de fila. */
  function nuevoId() {
    if (raiz.crypto && typeof raiz.crypto.randomUUID === 'function') {
      return raiz.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function ahora() {
    return new Date().toISOString();
  }

  function listar() {
    return leerJSON(CLAVE_REGISTROS, []);
  }

  /** Solo los registros vigentes; los dados de baja quedan guardados pero aparte. */
  function listarActivos() {
    return listar().filter(function (r) { return r.registro_activo !== false; });
  }

  function obtener(recordId) {
    return listar().filter(function (r) { return r.record_id === recordId; })[0] || null;
  }

  /**
   * Inserta o actualiza por record_id. Nunca por posicion en la lista: si dos
   * ediciones se cruzan, la posicion no identifica nada.
   */
  function guardar(registro) {
    const registros = listar();
    const copia = Object.assign({}, registro);

    if (!copia.record_id) {
      copia.record_id = nuevoId();
      copia.fecha_creacion = ahora();
    }
    copia.fecha_modificacion = ahora();
    if (copia.registro_activo === undefined) copia.registro_activo = true;
    copia.estado_sync = 'pendiente';

    const indice = registros.findIndex(function (r) { return r.record_id === copia.record_id; });
    if (indice >= 0) {
      registros[indice] = Object.assign({}, registros[indice], copia);
    } else {
      registros.push(copia);
    }
    escribirJSON(CLAVE_REGISTROS, registros);
    return copia;
  }

  /**
   * Baja logica del registro.
   *
   * Si el registro ya se sincronizo, no se borra del dispositivo: se marca como
   * no vigente y queda pendiente de enviar, para que la planilla reciba la baja.
   * Eliminarlo de aca dejaria su fila viva en la planilla sin que nadie se entere.
   * El valor devuelto dice cual de los dos caminos se tomo, para poder decirlo
   * en pantalla.
   */
  function eliminar(recordId) {
    const registros = listar();
    const registro = registros.filter(function (r) { return r.record_id === recordId; })[0];
    if (!registro) return { resultado: 'no_encontrado' };

    if (registro.estado_sync === 'sincronizado') {
      registro.registro_activo = false;
      registro.estado_sync = 'pendiente';
      registro.fecha_modificacion = ahora();
      escribirJSON(CLAVE_REGISTROS, registros);
      return { resultado: 'marcado_para_baja', registro: registro };
    }

    escribirJSON(
      CLAVE_REGISTROS,
      registros.filter(function (r) { return r.record_id !== recordId; })
    );
    return { resultado: 'eliminado_local', registro: registro };
  }

  function pendientes() {
    return listar().filter(function (r) { return r.estado_sync !== 'sincronizado'; });
  }

  /** Marca como sincronizados los record_id que la planilla confirmo recibir. */
  function marcarSincronizados(recordIds, sello) {
    const set = {};
    recordIds.forEach(function (id) { set[id] = true; });
    const registros = listar().map(function (r) {
      if (set[r.record_id]) {
        return Object.assign({}, r, { estado_sync: 'sincronizado', fecha_sync: sello || ahora() });
      }
      return r;
    });
    escribirJSON(CLAVE_REGISTROS, registros);
    return registros;
  }

  /**
   * Suma lo ya ejecutado de una actividad en este dispositivo.
   *
   * Sirve para avisar cuando un registro nuevo hace que el acumulado pase la
   * meta. Es lo registrado en ESTE telefono: si el equipo usa varios, cada uno
   * ve solo lo suyo, y el aviso lo dice.
   */
  function acumuladoPorActividad(codigoEdt, excluirRecordId) {
    return listarActivos()
      .filter(function (r) {
        return r.codigo_edt === codigoEdt && r.record_id !== excluirRecordId;
      })
      .reduce(function (total, r) {
        const n = Number(r.cantidad_ejecutada);
        return total + (Number.isFinite(n) ? n : 0);
      }, 0);
  }

  // --- Preferencias del dispositivo -----------------------------------------
  // Se recuerda quien registra y en que sector para no reescribirlo cada vez.

  function leerPreferencias() {
    return leerJSON(CLAVE_PREFERENCIAS, {});
  }

  function guardarPreferencias(cambios) {
    const actual = leerPreferencias();
    const nuevas = Object.assign(actual, cambios);
    escribirJSON(CLAVE_PREFERENCIAS, nuevas);
    return nuevas;
  }

  function exportarTodo() {
    return {
      registros: listar(),
      preferencias: leerPreferencias(),
      exportado: ahora(),
    };
  }

  const api = {
    CLAVE_REGISTROS: CLAVE_REGISTROS,
    nuevoId: nuevoId,
    listar: listar,
    listarActivos: listarActivos,
    obtener: obtener,
    guardar: guardar,
    eliminar: eliminar,
    pendientes: pendientes,
    marcarSincronizados: marcarSincronizados,
    acumuladoPorActividad: acumuladoPorActividad,
    leerPreferencias: leerPreferencias,
    guardarPreferencias: guardarPreferencias,
    exportarTodo: exportarTodo,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    raiz.Almacenamiento = api;
  }
})(typeof self !== 'undefined' ? self : this);
