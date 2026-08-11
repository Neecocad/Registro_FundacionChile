// Envio de los registros al Web App de Apps Script.
//
// Un POST por registro, con record_id, para que reintentar un envio interrumpido
// no duplique filas. Es siempre un paso posterior al guardado local y puede
// fallar sin consecuencias: lo que no se envia queda pendiente y se reintenta.

(function (raiz) {
  'use strict';

  // La direccion escrita a mano en Exportar queda guardada en el navegador y
  // tiene prioridad sobre DIRECCION_POR_DEFECTO. El sufijo de version permite
  // que, al cambiar de implementacion, lo guardado antes deje de leerse y todos
  // los equipos vuelvan a la direccion que trae la aplicacion, sin tener que
  // tocar telefono por telefono.
  const CLAVE_URL = 'fch-sync-url-v1';

  // Direccion del Web App de Apps Script, implementado sobre la planilla
  // BD_FundacionChile. Viene puesta para que ningun telefono tenga que
  // escribirla. Si algun dia queda vacia, la aplicacion registra igual y avisa
  // que falta configurarla.
  const DIRECCION_POR_DEFECTO =
    'https://script.google.com/macros/s/AKfycbz47v6QQgZuv5lRS2veZpJFBPi3gNp5CY5pw2jJJQHpo5zNQYbxWikpBttRQUfE6AG4/exec';

  function leerUrl() {
    try {
      return raiz.localStorage.getItem(CLAVE_URL) || DIRECCION_POR_DEFECTO;
    } catch (e) {
      return DIRECCION_POR_DEFECTO;
    }
  }

  function guardarUrl(url) {
    raiz.localStorage.setItem(CLAVE_URL, (url || '').trim());
  }

  function restablecerUrl() {
    raiz.localStorage.removeItem(CLAVE_URL);
    return DIRECCION_POR_DEFECTO;
  }

  function hayConexion() {
    return typeof navigator === 'undefined' || navigator.onLine !== false;
  }

  // Columnas que viajan a la hoja de registros. Los campos propios de cada
  // actividad se aplanan: cada uno va en su propia columna, asi una actividad
  // nueva agrega columnas al final sin descuadrar las filas ya escritas.
  const CAMPOS = [
    'record_id', 'proyecto_id', 'nombre_proyecto', 'codigo_edt', 'actividad', 'categoria',
    'unidad_medida', 'meta_vigente', 'fecha', 'persona_que_registra', 'sector',
    'cantidad_trabajadores', 'hora_inicio', 'hora_termino', 'minutos_colacion',
    'duracion_horas', 'horas_hombre', 'cantidad_ejecutada', 'rendimiento_por_hh',
    'rendimiento_por_jornada', 'observaciones', 'registro_activo',
    'fecha_creacion', 'fecha_modificacion',
  ];

  /**
   * Nombre visible de un valor de catalogo.
   *
   * A la planilla viaja la etiqueta y no el codigo interno: en las tablas de la
   * hoja KPI se agrupa por sector y por persona, y ahi tiene que leerse
   * "Las Mercedes" y no "LAS_MERCEDES".
   */
  function etiquetaDeCatalogo(codigo, nombreCatalogo, config) {
    const catalogo = (config.CATALOGOS && config.CATALOGOS[nombreCatalogo]) || [];
    const encontrado = catalogo.filter(function (v) { return v.codigo === codigo; })[0];
    return encontrado ? encontrado.etiqueta : codigo || '';
  }

  /** Los parametros de tipo lista, con el catalogo del que salen sus valores. */
  function camposDeLista(actividad, config) {
    return config.PARAMETROS_COMUNES
      .concat((actividad && actividad.parametros) || [])
      .filter(function (p) { return p.tipo === 'lista' && p.catalogo; });
  }

  function fila(registro, config) {
    const actividad = config.ACTIVIDADES.filter(function (a) {
      return a.codigo === registro.codigo_edt;
    })[0];

    const f = {};
    CAMPOS.forEach(function (campo) {
      const valor = registro[campo];
      f[campo] = valor === undefined || valor === null ? '' : valor;
    });

    f.proyecto_id = config.PROYECTO.proyecto_id;
    f.nombre_proyecto = config.PROYECTO.nombre;
    f.meta_vigente = actividad && actividad.meta ? actividad.meta : '';
    f.registro_activo = registro.registro_activo === false ? false : true;

    // Los campos propios de la actividad, cada uno en su columna. Si alguno se
    // llamara igual que una columna base, se respeta la base y no se pisa.
    Object.keys(registro.detalle || {}).forEach(function (clave) {
      const valor = registro.detalle[clave];
      if (!(clave in f)) f[clave] = valor === undefined || valor === null ? '' : valor;
    });

    // Todo lo que salga de un catalogo viaja con su nombre visible. Se resuelve
    // desde la configuracion y no campo por campo: asi un catalogo nuevo no
    // obliga a acordarse de agregar la traduccion aca.
    camposDeLista(actividad, config).forEach(function (p) {
      if (f[p.codigo]) f[p.codigo] = etiquetaDeCatalogo(f[p.codigo], p.catalogo, config);
    });

    return f;
  }

  /**
   * Envia un registro.
   *
   * Se manda como formulario y no como JSON a proposito: con
   * `application/json` el navegador hace una consulta previa de permisos
   * (preflight) que el Apps Script no responde, y el envio falla sin explicacion
   * util.
   */
  function enviarUno(url, registro, config) {
    const cuerpo = {
      tipo: 'registro_fundacion_chile',
      version_app: raiz.APP_VERSION,
      record_id: registro.record_id,
      registro: fila(registro, config),
    };

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: 'data=' + encodeURIComponent(JSON.stringify(cuerpo)),
      redirect: 'follow',
    })
      .then(function (respuesta) { return respuesta.text(); })
      .then(function (texto) {
        let datos;
        try {
          datos = JSON.parse(texto);
        } catch (e) {
          // Sintoma tipico: la implementacion no esta publicada para "cualquier
          // persona" y Google devuelve una pagina de inicio de sesion.
          throw new Error(
            'La respuesta no vino en el formato esperado. Revisa que el Apps Script esté implementado con acceso «Cualquier persona».'
          );
        }
        if (datos.estado !== 'ok') throw new Error(datos.mensaje || 'El Apps Script rechazó el envío.');
        return datos;
      });
  }

  /**
   * Envia todos los pendientes, uno por uno.
   *
   * Si uno falla se detiene ahi: los ya enviados quedan marcados y los que faltan
   * siguen pendientes. Nunca se marca como sincronizado algo que no se confirmo.
   */
  function sincronizar(pendientes, config, alAvanzar) {
    const url = leerUrl();

    if (!url) {
      return Promise.resolve({
        ok: false,
        motivo: 'sin_url',
        enviados: [],
        mensaje: 'Falta la dirección del Apps Script. Se configura en la pestaña Exportar.',
      });
    }
    if (!hayConexion()) {
      return Promise.resolve({
        ok: false,
        motivo: 'sin_conexion',
        enviados: [],
        mensaje: 'No hay conexión. Los registros quedan guardados y se envían cuando vuelva la señal.',
      });
    }
    if (!pendientes.length) {
      return Promise.resolve({ ok: true, enviados: [], mensaje: 'No había nada pendiente por enviar.' });
    }

    const enviados = [];
    let cadena = Promise.resolve();

    pendientes.forEach(function (registro) {
      cadena = cadena.then(function () {
        return enviarUno(url, registro, config).then(function () {
          enviados.push(registro.record_id);
          if (alAvanzar) alAvanzar(enviados.length, pendientes.length);
        });
      });
    });

    return cadena
      .then(function () {
        return { ok: true, enviados: enviados, mensaje: resumen(enviados.length, pendientes.length) };
      })
      .catch(function (error) {
        return {
          ok: false,
          motivo: 'error_envio',
          enviados: enviados,
          mensaje:
            'No se pudo completar la sincronización: ' + error.message +
            ' Se enviaron ' + enviados.length + ' de ' + pendientes.length +
            '. El resto sigue guardado en el teléfono.',
        };
      });
  }

  function resumen(enviados, total) {
    if (!enviados) return 'No se envió ningún registro.';
    if (enviados === total) return enviados + ' registro(s) sincronizado(s).';
    return enviados + ' de ' + total + ' registro(s) sincronizado(s).';
  }

  const api = {
    CLAVE_URL: CLAVE_URL,
    DIRECCION_POR_DEFECTO: DIRECCION_POR_DEFECTO,
    CAMPOS: CAMPOS,
    leerUrl: leerUrl,
    guardarUrl: guardarUrl,
    restablecerUrl: restablecerUrl,
    hayConexion: hayConexion,
    etiquetaDeCatalogo: etiquetaDeCatalogo,
    fila: fila,
    sincronizar: sincronizar,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Sincronizacion = api;
})(typeof self !== 'undefined' ? self : this);
