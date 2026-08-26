// Construccion del formulario a partir de la configuracion generada desde la EDT.
//
// Nada de lo que aparece en pantalla esta escrito a mano en este archivo: las
// etiquetas, los tipos de campo y cuales son obligatorios salen de
// js/config-actividades.js. Si hay que agregar un campo, se agrega en la
// planilla de especificacion y se regenera la configuracion.

(function (raiz) {
  'use strict';

  const Calculos = raiz.Calculos;

  function elemento(etiqueta, atributos, hijos) {
    const el = document.createElement(etiqueta);
    Object.keys(atributos || {}).forEach(function (k) {
      if (k === 'texto') el.textContent = atributos[k];
      else if (k === 'clase') el.className = atributos[k];
      else if (atributos[k] === true) el.setAttribute(k, '');
      else if (atributos[k] !== null && atributos[k] !== undefined && atributos[k] !== false) {
        el.setAttribute(k, atributos[k]);
      }
    });
    (hijos || []).forEach(function (h) { if (h) el.appendChild(h); });
    return el;
  }

  function etiquetaCampo(parametro) {
    const label = elemento('label', { for: 'campo_' + parametro.codigo });
    label.appendChild(document.createTextNode(parametro.etiqueta));
    if (parametro.obligatorio) {
      label.appendChild(elemento('span', { clase: 'obligatorio', texto: ' *' }));
    }
    return label;
  }

  /** Devuelve el control de entrada que corresponde al tipo declarado en la EDT. */
  function control(parametro, catalogos) {
    const id = 'campo_' + parametro.codigo;
    const comun = { id: id, name: parametro.codigo, 'data-parametro': parametro.codigo };
    if (parametro.obligatorio) comun.required = true;

    switch (parametro.tipo) {
      case 'fecha':
        return elemento('input', Object.assign({ type: 'date' }, comun));

      case 'hora':
        return elemento('input', Object.assign({ type: 'time' }, comun));

      case 'entero':
        return elemento('input', Object.assign(
          { type: 'number', step: '1', min: '0', inputmode: 'numeric' }, comun));

      case 'decimal':
        return elemento('input', Object.assign(
          { type: 'number', step: 'any', min: '0', inputmode: 'decimal' }, comun));

      case 'texto_largo':
        return elemento('textarea', Object.assign({ rows: '3' }, comun));

      case 'lista': {
        const opciones = (catalogos[parametro.catalogo] || []).map(function (o) {
          return elemento('option', { value: o.codigo, texto: o.etiqueta });
        });
        const vacia = elemento('option', { value: '', texto: 'Selecciona…' });
        return elemento('select', comun, [vacia].concat(opciones));
      }

      default:
        return elemento('input', Object.assign({ type: 'text' }, comun));
    }
  }

  function bloqueCampo(parametro, catalogos) {
    const fragmento = document.createDocumentFragment();
    fragmento.appendChild(etiquetaCampo(parametro));
    fragmento.appendChild(control(parametro, catalogos));
    if (parametro.validacion && parametro.tipo !== 'fecha') {
      // La validacion declarada en la EDT se muestra como ayuda para que la
      // persona sepa que se espera, no como texto oculto en el codigo.
      const pista = pistaLegible(parametro);
      if (pista) fragmento.appendChild(elemento('p', { clase: 'ayuda', texto: pista }));
    }
    return fragmento;
  }

  function pistaLegible(parametro) {
    const v = parametro.validacion || '';
    if (/^>\s*0$/.test(v)) return 'Debe ser mayor que cero.';
    if (/^(>=|≥)\s*0$/.test(v)) return 'Cero o más.';
    if (/Posterior a hora_inicio/i.test(v)) return null;
    if (/mm >= 0/i.test(v)) return 'Milímetros medidos, cero o más.';
    if (/Las Mercedes o Ibacache/i.test(v)) return null;
    if (/persona[s]? del catálogo/i.test(v)) return null;
    return null;
  }

  /** Dibuja los campos comunes a toda actividad. */
  function dibujarComunes(contenedorComunes, contenedorObservaciones, config) {
    contenedorComunes.innerHTML = '';
    contenedorObservaciones.innerHTML = '';

    config.PARAMETROS_COMUNES.forEach(function (p) {
      if (p.origen === 'Calculado') return; // Duración y horas-hombre viven en el panel calculado.
      const destino = p.codigo === 'observaciones' ? contenedorObservaciones : contenedorComunes;
      destino.appendChild(bloqueCampo(p, config.CATALOGOS));
    });
  }

  /** Dibuja los campos propios de la actividad elegida. */
  function dibujarEspecificos(contenedor, actividad, config) {
    contenedor.innerHTML = '';
    if (!actividad) return;

    actividad.parametros.forEach(function (p) {
      const fragmento = bloqueCampo(p, config.CATALOGOS);
      contenedor.appendChild(fragmento);

      if (p.codigo === actividad.campo_cantidad_ejecutada) {
        // Este es el campo que alimenta todos los indicadores de rendimiento.
        // Conviene que se note cual es y en que unidad se mide.
        contenedor.appendChild(
          elemento('p', {
            clase: 'ayuda',
            texto: 'Se mide en: ' + actividad.unidad_medida + '. De este número salen los indicadores de rendimiento.',
          })
        );
      }
    });
  }

  /** Llena el selector de actividades, agrupado por categoría. */
  function dibujarSelectorActividades(select, actividades) {
    const categorias = {};
    actividades.forEach(function (a) {
      categorias[a.categoria] = categorias[a.categoria] || [];
      categorias[a.categoria].push(a);
    });

    select.innerHTML = '';
    select.appendChild(elemento('option', { value: '', texto: 'Selecciona una actividad…' }));
    Object.keys(categorias).forEach(function (categoria) {
      const grupo = elemento('optgroup', { label: categoria });
      categorias[categoria].forEach(function (a) {
        grupo.appendChild(
          elemento('option', {
            value: a.codigo,
            texto: a.codigo + ' — ' + a.nombre + (a.por_confirmar ? ' (por confirmar)' : ''),
          })
        );
      });
      select.appendChild(grupo);
    });
  }

  /**
   * Aviso que acompana a la actividad elegida. Hoy solo queda uno: cuando la EDT
   * deja el registro de esa actividad «por confirmar».
   *
   * Antes esta linea mostraba tambien la unidad, la meta del proyecto y el ritmo
   * de referencia. Se sacaron a proposito:
   *
   * - La meta y el ritmo son numeros del proyecto completo, y la pantalla donde
   *   aparecian es la de un telefono que solo ve lo suyo. Puestos al lado del
   *   campo donde se escribe la cantidad del dia, invitan a leerlos como si
   *   fueran una vara para la jornada, que no es lo que miden. El avance contra
   *   la meta vive en la planilla, que es la que tiene todos los registros.
   * - La unidad ya la dice la etiqueta del campo: «Cantidad de zanjas
   *   confeccionadas completas». Repetirla abajo no agregaba nada.
   *
   * El aviso al escribir una cantidad muy fuera de lo esperado sigue existiendo
   * y sigue nombrando el ritmo de referencia (js/calculos.js). Ese aparece solo
   * cuando hay algo que revisar, y sin el numero no se entenderia por que salta.
   */
  function textoDetalleActividad(actividad) {
    if (!actividad || !actividad.por_confirmar) return '';
    return 'El registro de esta actividad en la aplicación está por confirmar.';
  }

  /** Lee los valores del formulario y arma el registro tal como se va a guardar. */
  function leerFormulario(formulario, actividad, config) {
    const registro = { detalle: {} };

    config.PARAMETROS_COMUNES.forEach(function (p) {
      if (p.origen === 'Calculado') return;
      registro[p.codigo] = valorDeCampo(formulario, p);
    });

    if (actividad) {
      actividad.parametros.forEach(function (p) {
        registro.detalle[p.codigo] = valorDeCampo(formulario, p);
      });

      registro.codigo_edt = actividad.codigo;
      registro.actividad = actividad.nombre;
      registro.categoria = actividad.categoria;
      registro.unidad_medida = actividad.unidad_medida;

      // Regla 4 del modelo de datos: cantidad_ejecutada copia el valor del
      // parametro que la actividad declara como su cantidad.
      const bruto = registro.detalle[actividad.campo_cantidad_ejecutada];
      const numero = Number(bruto);
      registro.cantidad_ejecutada = bruto === '' || bruto === null || !Number.isFinite(numero) ? null : numero;
    }

    const trabajadores = Number(registro.cantidad_trabajadores);
    registro.cantidad_trabajadores = Number.isFinite(trabajadores) ? trabajadores : null;

    const duracion = Calculos.calcularDuracion(registro.hora_inicio, registro.hora_termino, config.JORNADA);
    registro.duracion_horas = duracion.horas;
    registro.minutos_colacion = duracion.minutosColacion;
    registro.horas_hombre = Calculos.horasHombre(duracion.horas, registro.cantidad_trabajadores);

    // El rendimiento del registro suelto se guarda por comodidad al mirar una
    // fila. Los indicadores de la planilla no lo usan: se recalculan sobre los
    // acumulados, porque promediar rendimientos hace pesar igual una jornada
    // corta que una completa.
    const rendimiento = Calculos.rendimientos(
      registro.cantidad_ejecutada, registro.horas_hombre, config.JORNADA
    );
    registro.rendimiento_por_hh = rendimiento.porHoraHombre;
    registro.rendimiento_por_jornada = rendimiento.porJornada;

    return registro;
  }

  function valorDeCampo(formulario, parametro) {
    const campo = formulario.querySelector('[data-parametro="' + parametro.codigo + '"]');
    if (!campo) return '';
    if (parametro.tipo === 'entero' || parametro.tipo === 'decimal') {
      return campo.value === '' ? null : Number(campo.value);
    }
    return campo.value;
  }

  /** Marca los campos obligatorios vacios y devuelve sus etiquetas. */
  function faltantes(formulario, actividad, config) {
    const pendientes = [];

    function revisar(p) {
      const valor = valorDeCampo(formulario, p);
      const vacio = valor === '' || valor === null || valor === undefined;
      const campo = formulario.querySelector('[data-parametro="' + p.codigo + '"]');
      if (campo && campo.classList) campo.classList.toggle('campo-invalido', p.obligatorio && vacio);
      if (p.obligatorio && vacio) pendientes.push(p.etiqueta);
    }

    config.PARAMETROS_COMUNES.forEach(function (p) {
      if (p.origen !== 'Calculado') revisar(p);
    });
    if (actividad) actividad.parametros.forEach(revisar);

    return pendientes;
  }

  const api = {
    elemento: elemento,
    dibujarComunes: dibujarComunes,
    dibujarEspecificos: dibujarEspecificos,
    dibujarSelectorActividades: dibujarSelectorActividades,
    textoDetalleActividad: textoDetalleActividad,
    leerFormulario: leerFormulario,
    valorDeCampo: valorDeCampo,
    faltantes: faltantes,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Formulario = api;
})(typeof self !== 'undefined' ? self : this);
