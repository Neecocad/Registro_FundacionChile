// Pantalla de indicadores: rendimiento por actividad y resultado economico.
//
// Todo lo que se muestra aca se calcula desde los registros guardados. No hay
// ningun acumulado ni porcentaje que la persona escriba a mano.

(function (raiz) {
  'use strict';

  const Calculos = raiz.Calculos;
  const el = raiz.Formulario ? raiz.Formulario.elemento : null;

  /** Un par etiqueta/valor. Cuando no hay dato, se muestra una raya apagada. */
  function dato(etiqueta, valor, sufijo) {
    const hayDato = valor !== '—' && valor !== null && valor !== undefined;
    return el('div', { clase: 'dato' }, [
      el('span', { clase: 'dato-etiqueta', texto: etiqueta }),
      el('span', {
        clase: 'dato-valor' + (hayDato ? '' : ' sin-dato'),
        texto: hayDato ? valor + (sufijo ? ' ' + sufijo : '') : '—',
      }),
    ]);
  }

  function tarjetasProyecto(contenedor, registros, config, hoy) {
    const activos = registros.filter(function (r) { return r.registro_activo !== false; });
    const calendario = Calculos.estadoCalendario(hoy, config.PROYECTO);
    const hh = activos.reduce(function (t, r) { return t + (Number(r.horas_hombre) || 0); }, 0);
    const actividadesConRegistro = {};
    activos.forEach(function (r) { actividadesConRegistro[r.codigo_edt] = true; });

    contenedor.innerHTML = '';
    [
      el('div', { clase: 'tarjeta' }, [
        dato('Días hábiles transcurridos', calendario.transcurridos + ' de ' + calendario.plan),
      ]),
      el('div', { clase: 'tarjeta' }, [
        dato('Días hábiles restantes', String(calendario.restantes)),
      ]),
      el('div', { clase: 'tarjeta' }, [dato('Registros vigentes', String(activos.length))]),
      el('div', { clase: 'tarjeta' }, [
        dato('Horas-hombre acumuladas', activos.length ? Calculos.formatearNumero(hh, 1) : '—', 'HH'),
      ]),
      el('div', { clase: 'tarjeta' }, [
        dato(
          'Actividades con registro',
          Object.keys(actividadesConRegistro).length + ' de ' + config.ACTIVIDADES.length
        ),
      ]),
    ].forEach(function (t) { contenedor.appendChild(t); });

    if (!calendario.dentroDelPeriodo) {
      contenedor.appendChild(
        el('p', {
          clase: 'ayuda',
          texto:
            'La fecha de hoy queda fuera del período del proyecto (' +
            config.PROYECTO.fecha_inicio + ' a ' + config.PROYECTO.fecha_termino + ').',
        })
      );
    }
  }

  function barraAvance(indicadores) {
    if (indicadores.porcentajeAvance === null) return null;
    const pct = Math.max(0, Math.min(1, indicadores.porcentajeAvance));
    const atrasado = indicadores.desviacionAvance !== null && indicadores.desviacionAvance < 0;
    const barra = el('div', { clase: 'barra' }, [
      el('div', { clase: 'barra-relleno' + (atrasado ? ' atrasado' : '') }),
    ]);
    barra.firstChild.style.width = (pct * 100).toFixed(1) + '%';
    return barra;
  }

  function tarjetaActividad(indicadores, porSector, actividad) {
    const cabecera = el('div', { clase: 'tarjeta-cabecera' }, [
      el('span', { clase: 'tarjeta-titulo', texto: actividad.codigo + ' — ' + actividad.nombre }),
      actividad.por_confirmar
        ? el('span', { clase: 'marca marca-confirmar', texto: 'por confirmar' })
        : null,
    ]);

    const datos = el('div', { clase: 'tarjeta-datos' }, [
      dato('Ejecutado', indicadores.avanceAcumulado === null ? '—' : Calculos.formatearNumero(indicadores.avanceAcumulado)),
      dato('Horas-hombre', indicadores.horasHombre === null ? '—' : Calculos.formatearNumero(indicadores.horasHombre, 1)),
      dato('Rendimiento', indicadores.rendimientoPorHH === null ? '—' : Calculos.formatearNumero(indicadores.rendimientoPorHH, 2), 'por HH'),
      dato('Esfuerzo unitario', indicadores.hhPorUnidad === null ? '—' : Calculos.formatearNumero(indicadores.hhPorUnidad, 2), 'HH/u'),
      dato('Ritmo de cuadrilla', indicadores.rendimientoCuadrilla === null ? '—' : Calculos.formatearNumero(indicadores.rendimientoCuadrilla, 2), 'por hora'),
      dato('Cuadrilla media', indicadores.tamanoMedioCuadrilla === null ? '—' : Calculos.formatearNumero(indicadores.tamanoMedioCuadrilla, 1), 'personas'),
    ]);

    const tarjeta = el('div', { clase: 'tarjeta' }, [
      cabecera,
      el('div', { clase: 'tarjeta-sub', texto: 'Unidad: ' + actividad.unidad_medida + ' · ' + indicadores.registros + ' registro(s)' }),
      datos,
    ]);

    if (indicadores.meta) {
      const barra = barraAvance(indicadores);
      if (barra) tarjeta.appendChild(barra);
      tarjeta.appendChild(
        el('div', { clase: 'tarjeta-datos' }, [
          dato('Avance', Calculos.formatearPorcentaje(indicadores.porcentajeAvance) + ' de ' + Calculos.formatearNumero(indicadores.meta)),
          dato('Esperado a hoy', Calculos.formatearNumero(indicadores.avanceEsperado, 0)),
          dato(
            'Desviación',
            (indicadores.desviacionAvance > 0 ? '+' : '') + Calculos.formatearNumero(indicadores.desviacionAvance, 0)
          ),
          dato(
            'Ritmo requerido',
            indicadores.ritmoRequeridoRestante === null
              ? '—'
              : Calculos.formatearNumero(indicadores.ritmoRequeridoRestante, 1),
            'por día hábil'
          ),
        ])
      );
      if (indicadores.diasHabilesRestantes === 0 && indicadores.porcentajeAvance < 1) {
        tarjeta.appendChild(
          el('p', { clase: 'ayuda', texto: 'No quedan días hábiles en el período del proyecto.' })
        );
      }
    } else {
      // Sin meta en la EDT no se inventa una referencia: se dice y punto.
      tarjeta.appendChild(
        el('p', {
          clase: 'ayuda',
          texto: 'Sin meta en la EDT' + (actividad.meta_texto ? ' (' + actividad.meta_texto + ')' : '') + ': se muestra lo medido, sin porcentaje de avance.',
        })
      );
    }

    if (porSector.length > 1) {
      const detalle = el('div', { clase: 'tarjeta-datos' }, porSector.map(function (s) {
        return dato(
          nombreSector(s.sector),
          Calculos.formatearNumero(s.avanceAcumulado) +
            ' · ' +
            (s.rendimientoPorHH === null ? '—' : Calculos.formatearNumero(s.rendimientoPorHH, 2) + ' por HH')
        );
      }));
      tarjeta.appendChild(el('h3', { texto: 'Por sector' }));
      tarjeta.appendChild(detalle);
    }

    return tarjeta;
  }

  function nombreSector(codigo) {
    const catalogo = (raiz.CONFIG && raiz.CONFIG.CATALOGOS.SECTORES_FCH) || [];
    const encontrado = catalogo.filter(function (s) { return s.codigo === codigo; })[0];
    return encontrado ? encontrado.etiqueta : codigo || 'Sin sector';
  }

  function dibujarActividades(contenedor, registros, config, hoy) {
    contenedor.innerHTML = '';
    const conRegistro = config.ACTIVIDADES.filter(function (a) {
      return registros.some(function (r) { return r.codigo_edt === a.codigo && r.registro_activo !== false; });
    });

    if (!conRegistro.length) {
      contenedor.appendChild(
        el('div', { clase: 'vacio', texto: 'Todavía no hay registros. Los indicadores aparecen apenas se guarde el primero.' })
      );
      return;
    }

    conRegistro.forEach(function (a) {
      const indicadores = Calculos.indicadoresActividad(registros, a, config.PROYECTO, hoy);
      const porSector = Calculos.indicadoresPorSector(registros, a, config.PROYECTO, hoy);
      contenedor.appendChild(tarjetaActividad(indicadores, porSector, a));
    });
  }

  function dibujarEconomicos(contenedor, registros, costos, config, hoy) {
    const eco = Calculos.indicadoresEconomicos(registros, costos, config.PROYECTO, hoy);
    contenedor.innerHTML = '';

    if (eco.faltantes.length) {
      contenedor.appendChild(
        el('div', { clase: 'aviso aviso-aviso' }, [
          el('span', { clase: 'aviso-titulo', texto: 'Faltan valores por llenar' }),
          el('span', {
            texto:
              'Sin ' + eco.faltantes.join(', ').toLowerCase() +
              ', los indicadores que dependen de esos valores quedan en blanco. Se llenan en la pestaña Costos.',
          }),
        ])
      );
    }

    contenedor.appendChild(
      el('div', { clase: 'tarjeta' }, [
        el('span', { clase: 'tarjeta-titulo', texto: 'Resumen económico del proyecto' }),
        el('div', { clase: 'tarjeta-datos' }, [
          dato('Mano de obra a la fecha', Calculos.formatearPesos(eco.manoObra)),
          dato('Camioneta y baños a la fecha', Calculos.formatearPesos(eco.indirectosALaFecha)),
          dato('Costos extras', Calculos.formatearPesos(eco.extras)),
          dato(
            eco.costoALaFechaCompleto ? 'Costo total a la fecha' : 'Costo a la fecha (parcial)',
            Calculos.formatearPesos(eco.costoALaFecha)
          ),
          dato('Costo por día hábil (camioneta y baños)', Calculos.formatearPesos(eco.indirectosPorDiaHabil)),
          dato(
            eco.costoProyectadoCompleto ? 'Proyección al término' : 'Proyección al término (parcial)',
            Calculos.formatearPesos(eco.costoProyectado)
          ),
        ]),
        eco.costoProyectado !== null
          ? el('p', {
              clase: 'nota-estimacion',
              texto:
                'La proyección al término supone que se mantiene el ritmo de horas-hombre por día hábil observado hasta hoy (' +
                eco.diasHabilesTranscurridos + ' de ' + config.PROYECTO.dias_habiles_plan + ' días hábiles). Es una estimación, no un compromiso.',
            })
          : null,
      ])
    );

    const conRegistro = config.ACTIVIDADES.filter(function (a) {
      return registros.some(function (r) { return r.codigo_edt === a.codigo && r.registro_activo !== false; });
    });

    if (!conRegistro.length || eco.costoHH === null) return;

    contenedor.appendChild(el('h3', { texto: 'Costo por unidad ejecutada' }));
    conRegistro.forEach(function (a) {
      const economia = Calculos.economiaActividad(registros, a, costos, config.PROYECTO, hoy);
      contenedor.appendChild(
        el('div', { clase: 'tarjeta' }, [
          el('span', { clase: 'tarjeta-titulo', texto: a.codigo + ' — ' + a.nombre }),
          el('div', { clase: 'tarjeta-sub', texto: 'Por cada ' + unidadSingular(a.unidad_medida) }),
          el('div', { clase: 'tarjeta-datos' }, [
            dato('Mano de obra', Calculos.formatearPesos(economia.costoManoObra)),
            dato('Costo unitario (mano de obra)', Calculos.formatearPesos(economia.costoUnitarioManoObra)),
            dato('Costo unitario con indirectos', Calculos.formatearPesos(economia.costoUnitarioConIndirectos)),
            dato('Falta para la meta', Calculos.formatearPesos(economia.costoPendienteEstimado)),
          ]),
        ])
      );
    });

    contenedor.appendChild(
      el('p', {
        clase: 'nota-estimacion',
        texto:
          'El costo unitario de mano de obra es un dato duro: sale de las horas-hombre registradas por el valor de la hora-hombre. ' +
          'El costo con indirectos es una estimación: reparte camioneta y baños entre las actividades según su participación en las horas-hombre.',
      })
    );
  }

  function unidadSingular(unidad) {
    return String(unidad || 'unidad').toLowerCase();
  }

  const api = {
    tarjetasProyecto: tarjetasProyecto,
    dibujarActividades: dibujarActividades,
    dibujarEconomicos: dibujarEconomicos,
    nombreSector: nombreSector,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Indicadores = api;
})(typeof self !== 'undefined' ? self : this);
