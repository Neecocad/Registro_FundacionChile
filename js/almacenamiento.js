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
  const CLAVE_COSTOS = 'fch_costos_v1';
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

  /** Solo los registros vigentes; es lo que alimenta todos los indicadores. */
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

  // --- Parametros economicos -------------------------------------------------

  function leerCostos() {
    const base = raiz.Calculos ? raiz.Calculos.costosVacios() : {};
    return Object.assign(base, leerJSON(CLAVE_COSTOS, {}));
  }

  function guardarCostos(costos) {
    const copia = Object.assign({}, costos, { actualizado: ahora(), estado_sync: 'pendiente' });
    escribirJSON(CLAVE_COSTOS, copia);
    return copia;
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
      costos: leerCostos(),
      preferencias: leerPreferencias(),
      exportado: ahora(),
    };
  }

  const api = {
    CLAVE_REGISTROS: CLAVE_REGISTROS,
    CLAVE_COSTOS: CLAVE_COSTOS,
    nuevoId: nuevoId,
    listar: listar,
    listarActivos: listarActivos,
    obtener: obtener,
    guardar: guardar,
    eliminar: eliminar,
    pendientes: pendientes,
    marcarSincronizados: marcarSincronizados,
    leerCostos: leerCostos,
    guardarCostos: guardarCostos,
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
