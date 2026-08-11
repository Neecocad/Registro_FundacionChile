// Pantalla de parametros economicos.
//
// Estos valores no salen de la EDT ni se estiman solos: los llena la persona que
// administra el proyecto. Mientras un valor este vacio, el indicador que depende
// de el queda en blanco. Es preferible una raya a un numero inventado, porque un
// numero inventado despues se cita como si fuera medido.

(function (raiz) {
  'use strict';

  const Calculos = raiz.Calculos;
  const el = raiz.Formulario ? raiz.Formulario.elemento : null;

  function llenarPeriodicidades(select) {
    select.innerHTML = '';
    Object.keys(Calculos.PERIODICIDADES).forEach(function (clave) {
      select.appendChild(el('option', { value: clave, texto: Calculos.PERIODICIDADES[clave] }));
    });
  }

  function dibujarExtras(contenedor, extras, alCambiar) {
    contenedor.innerHTML = '';

    if (!extras.length) {
      contenedor.appendChild(el('p', { clase: 'ayuda', texto: 'Todavía no hay costos extras cargados.' }));
      return;
    }

    extras.forEach(function (extra, indice) {
      const concepto = el('input', { type: 'text', value: extra.concepto || '', placeholder: 'Concepto' });
      const monto = el('input', {
        type: 'number', min: '0', step: '1', inputmode: 'numeric',
        value: extra.monto === null || extra.monto === undefined ? '' : extra.monto,
        placeholder: 'Monto',
      });
      const quitar = el('button', { type: 'button', clase: 'boton boton-peligro boton-chico', texto: 'Quitar' });

      concepto.addEventListener('input', function () {
        extras[indice].concepto = concepto.value;
        alCambiar();
      });
      monto.addEventListener('input', function () {
        extras[indice].monto = monto.value === '' ? null : Number(monto.value);
        alCambiar();
      });
      quitar.addEventListener('click', function () {
        extras.splice(indice, 1);
        dibujarExtras(contenedor, extras, alCambiar);
        alCambiar();
      });

      contenedor.appendChild(
        el('div', { clase: 'fila-extra' }, [
          el('div', {}, [el('label', { texto: 'Concepto' }), concepto]),
          el('div', {}, [el('label', { texto: 'Monto' }), monto]),
          quitar,
        ])
      );
    });
  }

  /**
   * Texto de apoyo bajo el costo de la hora-hombre.
   *
   * Sirve para que el numero no se escriba a ciegas: con la jornada del proyecto
   * (08:00 a 16:00 con 30 minutos de colacion) una persona aporta 7,5 horas por
   * dia habil, y eso permite ver de inmediato a cuanto equivale el valor escrito.
   */
  function ayudaCostoHH(costoHH, config) {
    const horasDia = Calculos.horasJornadaEstandar(config.JORNADA);
    if (!Number.isFinite(Number(costoHH)) || Number(costoHH) <= 0) {
      return (
        'Con la jornada del proyecto, una persona aporta ' +
        Calculos.formatearNumero(horasDia, 1) +
        ' horas-hombre por día hábil. Si conoces el costo diario por trabajador, divídelo por ' +
        Calculos.formatearNumero(horasDia, 1) + '.'
      );
    }
    const porDia = Number(costoHH) * horasDia;
    const porProyecto = porDia * config.PROYECTO.dias_habiles_plan;
    return (
      'Equivale a ' + Calculos.formatearPesos(porDia) + ' por trabajador y día hábil, y a ' +
      Calculos.formatearPesos(porProyecto) + ' por trabajador en los ' +
      config.PROYECTO.dias_habiles_plan + ' días hábiles del proyecto.'
    );
  }

  /** Lee la pantalla y devuelve el objeto de costos tal como se guarda. */
  function leer(formulario, extras) {
    function numero(id) {
      const campo = formulario.querySelector('#' + id);
      if (!campo || campo.value === '') return null;
      const n = Number(campo.value);
      return Number.isFinite(n) ? n : null;
    }
    function texto(id) {
      const campo = formulario.querySelector('#' + id);
      return campo ? campo.value : null;
    }

    return {
      costo_hh: numero('costo_hh'),
      camioneta_monto: numero('camioneta_monto'),
      camioneta_periodicidad: texto('camioneta_periodicidad'),
      banos_monto: numero('banos_monto'),
      banos_periodicidad: texto('banos_periodicidad'),
      extras: extras.filter(function (e) {
        return (e.concepto && e.concepto.trim()) || Number.isFinite(Number(e.monto));
      }),
      moneda: 'CLP',
    };
  }

  function escribir(formulario, costos) {
    function poner(id, valor) {
      const campo = formulario.querySelector('#' + id);
      if (campo) campo.value = valor === null || valor === undefined ? '' : valor;
    }
    poner('costo_hh', costos.costo_hh);
    poner('camioneta_monto', costos.camioneta_monto);
    poner('camioneta_periodicidad', costos.camioneta_periodicidad || 'mes');
    poner('banos_monto', costos.banos_monto);
    poner('banos_periodicidad', costos.banos_periodicidad || 'mes');
  }

  const api = {
    llenarPeriodicidades: llenarPeriodicidades,
    dibujarExtras: dibujarExtras,
    ayudaCostoHH: ayudaCostoHH,
    leer: leer,
    escribir: escribir,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Costos = api;
})(typeof self !== 'undefined' ? self : this);
