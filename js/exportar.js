// Copia de respaldo de lo guardado en el telefono: Excel y JSON.
//
// No reemplaza a la sincronizacion. Los indicadores del proyecto salen de la
// planilla de Google, no de estos archivos; esto sirve para no depender de un
// solo telefono y para poder mirar los datos sin abrir la planilla.

(function (raiz) {
  'use strict';

  function descargar(blob, nombre) {
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(enlace.href);
  }

  /**
   * Arma la hoja de registros con las mismas columnas que viajan a la planilla,
   * mas las columnas propias de cada actividad que aparezcan en los datos. Se
   * usa el mismo armado que la sincronizacion para que el respaldo y la planilla
   * no puedan discrepar.
   */
  function filasDeRegistros(registros, config) {
    const filas = registros.map(function (r) {
      return raiz.Sincronizacion.fila(r, config);
    });

    const columnas = raiz.Sincronizacion.CAMPOS.slice();
    filas.forEach(function (f) {
      Object.keys(f).forEach(function (clave) {
        if (columnas.indexOf(clave) === -1) columnas.push(clave);
      });
    });

    const cuerpo = filas.map(function (f) {
      return columnas.map(function (c) {
        const v = f[c];
        if (typeof v === 'boolean') return v ? 'Sí' : 'No';
        return v === undefined || v === null ? '' : v;
      });
    });

    return [columnas].concat(cuerpo);
  }

  /**
   * Hoja de resumen. Es una ayuda para leer el respaldo, no un indicador del
   * proyecto: cuenta solo lo registrado en este telefono y lo dice.
   */
  function filasDeResumen(registros, config) {
    const activos = registros.filter(function (r) { return r.registro_activo !== false; });
    const filas = [
      ['Respaldo de ' + config.PROYECTO.nombre],
      ['Cuenta solo lo registrado en este teléfono. Los indicadores del proyecto están en la planilla.'],
      [],
      ['Generado', new Date().toISOString().slice(0, 16).replace('T', ' ')],
      ['Versión de la aplicación', raiz.APP_VERSION],
      ['Registros vigentes', activos.length],
      ['Registros dados de baja', registros.length - activos.length],
      ['Pendientes de sincronizar', registros.filter(function (r) {
        return r.estado_sync !== 'sincronizado';
      }).length],
      [],
      ['Actividad', 'Unidad', 'Registros', 'Ejecutado', 'Horas-hombre'],
    ];

    config.ACTIVIDADES.forEach(function (a) {
      const propios = activos.filter(function (r) { return r.codigo_edt === a.codigo; });
      if (!propios.length) return;
      const suma = function (campo) {
        return propios.reduce(function (t, r) {
          const n = Number(r[campo]);
          return t + (Number.isFinite(n) ? n : 0);
        }, 0);
      };
      filas.push([
        a.codigo + ' — ' + a.nombre,
        a.unidad_medida,
        propios.length,
        suma('cantidad_ejecutada'),
        Math.round(suma('horas_hombre') * 100) / 100,
      ]);
    });

    return filas;
  }

  function nombreArchivo(extension) {
    return 'registro_fundacion_chile_' +
      new Date().toISOString().slice(0, 10) + '.' + extension;
  }

  function aExcel(registros, config) {
    const blob = raiz.XlsxMinimo.construirExcel([
      { nombre: 'Resumen', filas: filasDeResumen(registros, config) },
      { nombre: 'Registros', filas: filasDeRegistros(registros, config) },
    ]);
    descargar(blob, nombreArchivo('xlsx'));
  }

  function aJson(datos) {
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    descargar(blob, nombreArchivo('json'));
  }

  const api = {
    filasDeRegistros: filasDeRegistros,
    filasDeResumen: filasDeResumen,
    aExcel: aExcel,
    aJson: aJson,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Exportar = api;
})(typeof self !== 'undefined' ? self : this);
