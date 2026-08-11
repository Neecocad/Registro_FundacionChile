// Envio de los registros pendientes a la planilla de Google, a traves del Apps
// Script.
//
// Este paso es siempre posterior al guardado local y puede fallar sin
// consecuencias: lo que no se envia queda marcado como pendiente y se reintenta
// despues. Registrar en terreno nunca depende de que esto funcione.

(function (raiz) {
  'use strict';

  const CLAVE_URL = 'fch_url_apps_script';

  function leerUrl() {
    try {
      return raiz.localStorage.getItem(CLAVE_URL) || '';
    } catch (e) {
      return '';
    }
  }

  function guardarUrl(url) {
    raiz.localStorage.setItem(CLAVE_URL, (url || '').trim());
  }

  function hayConexion() {
    return typeof navigator === 'undefined' || navigator.onLine !== false;
  }

  /**
   * Envia registros y parametros economicos.
   *
   * Se manda el contenido como texto plano a proposito: con `application/json`
   * el navegador hace una consulta previa de permisos (preflight) que el Apps
   * Script no responde, y el envio falla sin explicacion util.
   */
  function enviar(registros, costos, config) {
    const url = leerUrl();

    if (!url) {
      return Promise.resolve({
        ok: false,
        motivo: 'sin_url',
        mensaje: 'Falta la dirección del Apps Script. Se configura en la pestaña Ajustes.',
      });
    }
    if (!hayConexion()) {
      return Promise.resolve({
        ok: false,
        motivo: 'sin_conexion',
        mensaje: 'No hay conexión. Los registros quedan guardados y se envían cuando vuelva la señal.',
      });
    }
    if (!registros.length && !costos) {
      return Promise.resolve({ ok: true, recibidos: [], mensaje: 'No había nada pendiente por enviar.' });
    }

    const cuerpo = {
      version_app: raiz.APP_VERSION,
      proyecto_id: config.PROYECTO.proyecto_id,
      enviado: new Date().toISOString(),
      registros: registros,
      costos: costos || null,
      // La EDT y los catalogos viajan para que la planilla pueda armar sus hojas
      // de referencia sin que nadie las copie a mano.
      edt: config.ACTIVIDADES.map(function (a) {
        return {
          codigo: a.codigo,
          categoria: a.categoria,
          nombre: a.nombre,
          unidad_medida: a.unidad_medida,
          meta: a.meta,
          meta_texto: a.meta_texto,
          campo_cantidad_ejecutada: a.campo_cantidad_ejecutada,
          en_app: true,
        };
      }).concat(
        config.ACTIVIDADES_FUERA_DE_APP.map(function (a) {
          return { codigo: a.codigo, categoria: a.categoria, nombre: a.nombre, en_app: false, motivo: a.motivo };
        })
      ),
      jornada: config.JORNADA,
      proyecto: config.PROYECTO,
    };

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(cuerpo),
      redirect: 'follow',
    })
      .then(function (respuesta) {
        if (!respuesta.ok) throw new Error('El servidor respondió ' + respuesta.status + '.');
        return respuesta.text();
      })
      .then(function (texto) {
        let datos;
        try {
          datos = JSON.parse(texto);
        } catch (e) {
          // Sintoma tipico: la implementacion no esta publicada para "cualquier
          // persona" y Google devuelve una pagina de inicio de sesion.
          throw new Error(
            'La respuesta no vino en el formato esperado. Revisa que el Apps Script esté implementado con acceso "Cualquier persona".'
          );
        }
        if (!datos.ok) throw new Error(datos.mensaje || 'El Apps Script rechazó el envío.');

        return {
          ok: true,
          recibidos: datos.recibidos || [],
          bajas: datos.bajas || [],
          kpi_version: datos.kpi_version,
          mensaje: resumenEnvio(datos),
        };
      })
      .catch(function (error) {
        return {
          ok: false,
          motivo: 'error_envio',
          mensaje: 'No se pudo sincronizar: ' + error.message + ' Los registros siguen guardados en el teléfono.',
        };
      });
  }

  function resumenEnvio(datos) {
    const partes = [];
    const recibidos = (datos.recibidos || []).length;
    const bajas = (datos.bajas || []).length;

    if (recibidos) partes.push(recibidos + ' registro(s) sincronizado(s)');
    if (bajas) partes.push(bajas + ' baja(s) aplicada(s) en la planilla');
    if (datos.costos_actualizados) partes.push('parámetros económicos actualizados');
    if (!partes.length) partes.push('no había nada pendiente');

    return partes.join(', ') + '.';
  }

  const api = {
    CLAVE_URL: CLAVE_URL,
    leerUrl: leerUrl,
    guardarUrl: guardarUrl,
    hayConexion: hayConexion,
    enviar: enviar,
    resumenEnvio: resumenEnvio,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Sincronizacion = api;
})(typeof self !== 'undefined' ? self : this);
