// Pruebas de los calculos y de la configuracion generada desde la EDT.
//
//   node pruebas/pruebas_calculos.js

const path = require('path');
const { prueba, afirmar, igual, cercano, esNulo, ejecutar } = require('./ayuda');

const Calculos = require(path.join(__dirname, '..', 'js', 'calculos.js'));
const config = require(path.join(__dirname, '..', 'js', 'config-actividades.js'));

const JORNADA = config.JORNADA;
const PROYECTO = config.PROYECTO;

// ---------------------------------------------------------------------------
// Duracion y colacion
// ---------------------------------------------------------------------------

prueba('la jornada completa 08:00 a 16:00 descuenta la colacion y da 7,5 horas', () => {
  const d = Calculos.calcularDuracion('08:00', '16:00', JORNADA);
  igual(d.horasBrutas, 8, 'duracion bruta');
  igual(d.minutosColacion, 30, 'minutos de colacion');
  igual(d.horas, 7.5, 'duracion trabajada');
  esNulo(d.error);
});

prueba('un tramo de manana no descuenta colacion', () => {
  const d = Calculos.calcularDuracion('08:00', '12:00', JORNADA);
  igual(d.minutosColacion, 0);
  igual(d.horas, 4);
});

prueba('manana y tarde por separado no descuentan la colacion dos veces', () => {
  const manana = Calculos.calcularDuracion('08:00', '13:00', JORNADA);
  const tarde = Calculos.calcularDuracion('13:30', '16:00', JORNADA);
  igual(manana.minutosColacion, 0, 'la manana termina justo al empezar la colacion');
  igual(tarde.minutosColacion, 0, 'la tarde empieza justo al terminar la colacion');
  igual(manana.horas + tarde.horas, 7.5, 'las dos partes suman la jornada efectiva');
});

prueba('un tramo que cubre parte de la ventana descuenta solo esa parte', () => {
  const d = Calculos.calcularDuracion('13:10', '16:00', JORNADA);
  igual(d.minutosColacion, 20);
  cercano(d.horas, 2.5, 0.0001);
});

prueba('las horas invertidas no producen una jornada valida', () => {
  // Este es el caso real del proyecto hermano: 15:00 a 07:30 daba 16,5 horas y
  // reportaba la mitad del rendimiento, sin advertir nada.
  const d = Calculos.calcularDuracion('15:00', '07:30', JORNADA);
  esNulo(d.horas, 'no debe entregar una duracion');
  afirmar(d.error && d.error.indexOf('anterior') !== -1, 'debe explicar que la hora de termino es anterior');
});

prueba('la hora de termino igual a la de inicio se rechaza', () => {
  const d = Calculos.calcularDuracion('09:00', '09:00', JORNADA);
  esNulo(d.horas);
  afirmar(!!d.error);
});

prueba('las horas-hombre son la duracion por la cantidad de trabajadores', () => {
  igual(Calculos.horasHombre(7.5, 8), 60);
  esNulo(Calculos.horasHombre(7.5, 0), 'cero trabajadores no da cero horas-hombre, da falta de dato');
  esNulo(Calculos.horasHombre(null, 8));
});

prueba('la jornada estandar del proyecto es de 7,5 horas', () => {
  igual(Calculos.horasJornadaEstandar(JORNADA), 7.5);
});

// ---------------------------------------------------------------------------
// Calendario
// ---------------------------------------------------------------------------

prueba('el calendario da los 36 dias habiles que declara la especificacion', () => {
  const dias = Calculos.diasHabilesEntre(PROYECTO.fecha_inicio, PROYECTO.fecha_termino, PROYECTO);
  igual(dias, PROYECTO.dias_habiles_plan);
  igual(dias, 36);
});

prueba('los feriados de Fiestas Patrias no son dias habiles', () => {
  igual(Calculos.esDiaHabil('2026-09-17', PROYECTO), false);
  igual(Calculos.esDiaHabil('2026-09-18', PROYECTO), false);
  igual(Calculos.esDiaHabil('2026-09-16', PROYECTO), true);
});

prueba('los fines de semana no son dias habiles', () => {
  igual(Calculos.esDiaHabil('2026-08-15', PROYECTO), false, 'sabado');
  igual(Calculos.esDiaHabil('2026-08-16', PROYECTO), false, 'domingo');
});

prueba('transcurridos mas restantes cubren el plan completo', () => {
  const estado = Calculos.estadoCalendario('2026-09-07', PROYECTO);
  igual(estado.transcurridos + estado.restantes, PROYECTO.dias_habiles_plan);
});

prueba('el ultimo dia del proyecto deja cero dias restantes', () => {
  const estado = Calculos.estadoCalendario(PROYECTO.fecha_termino, PROYECTO);
  igual(estado.restantes, 0);
  igual(estado.transcurridos, 36);
});

// ---------------------------------------------------------------------------
// Avisos sobre el registro
// ---------------------------------------------------------------------------

const actividadConMeta = config.ACTIVIDADES.filter((a) => a.codigo === '2.1')[0];
const actividadSinMeta = config.ACTIVIDADES.filter((a) => a.codigo === '2.4')[0];

function registroNormal(cambios) {
  return Object.assign(
    {
      fecha: '2026-08-12',
      persona_que_registra: 'Persona de prueba',
      sector: 'LAS_MERCEDES',
      cantidad_trabajadores: 8,
      hora_inicio: '08:00',
      hora_termino: '16:00',
      cantidad_ejecutada: 45,
    },
    cambios || {}
  );
}

prueba('CASO DE CONTROL: una jornada normal no produce ningun aviso', () => {
  // Si esta comprobacion falla, el sistema molesta en el uso habitual y los
  // avisos se aprenden a cerrar sin leer. Vale mas que cualquier otra de aca.
  const avisos = Calculos.revisarRegistro(registroNormal(), actividadConMeta, PROYECTO, JORNADA);
  igual(avisos.length, 0, 'avisos inesperados: ' + JSON.stringify(avisos.map((a) => a.mensaje)));
});

prueba('las horas invertidas producen un error', () => {
  const avisos = Calculos.revisarRegistro(
    registroNormal({ hora_inicio: '15:00', hora_termino: '07:30' }),
    actividadConMeta, PROYECTO, JORNADA
  );
  afirmar(avisos.some((a) => a.nivel === 'error'), 'debe haber al menos un error');
});

prueba('una cantidad muy superior a la referencia avisa sin bloquear', () => {
  const avisos = Calculos.revisarRegistro(
    registroNormal({ cantidad_ejecutada: 500 }),
    actividadConMeta, PROYECTO, JORNADA
  );
  afirmar(avisos.some((a) => a.campo === 'cantidad_ejecutada'), 'debe avisar por la cantidad');
  afirmar(!avisos.some((a) => a.nivel === 'error'), 'no debe bloquear el guardado');
});

prueba('una actividad sin meta no genera aviso por cantidad', () => {
  // Sin valor de referencia no hay nada contra que comparar; inventar un numero
  // seria peor que no decir nada.
  const avisos = Calculos.revisarRegistro(
    registroNormal({ cantidad_ejecutada: 99999 }),
    actividadSinMeta, PROYECTO, JORNADA
  );
  igual(avisos.filter((a) => a.campo === 'cantidad_ejecutada').length, 0);
});

prueba('registrar un sabado avisa', () => {
  const avisos = Calculos.revisarRegistro(
    registroNormal({ fecha: '2026-08-15' }),
    actividadConMeta, PROYECTO, JORNADA
  );
  afirmar(avisos.some((a) => a.campo === 'fecha'));
});

prueba('una fecha fuera del periodo del proyecto avisa', () => {
  const avisos = Calculos.revisarRegistro(
    registroNormal({ fecha: '2026-11-20' }),
    actividadConMeta, PROYECTO, JORNADA
  );
  afirmar(avisos.some((a) => a.campo === 'fecha'));
});

prueba('una jornada mas larga que la estandar avisa', () => {
  const avisos = Calculos.revisarRegistro(
    registroNormal({ hora_termino: '19:00' }),
    actividadConMeta, PROYECTO, JORNADA
  );
  afirmar(avisos.some((a) => a.campo === 'hora_termino' || a.campo === 'hora_inicio'));
});

prueba('cero trabajadores es un error', () => {
  const avisos = Calculos.revisarRegistro(
    registroNormal({ cantidad_trabajadores: 0 }),
    actividadConMeta, PROYECTO, JORNADA
  );
  afirmar(avisos.some((a) => a.nivel === 'error' && a.campo === 'cantidad_trabajadores'));
});

// ---------------------------------------------------------------------------
// Indicadores de rendimiento
// ---------------------------------------------------------------------------

function registroGuardado(cambios) {
  return Object.assign(
    {
      record_id: 'r-' + Math.random().toString(16).slice(2),
      codigo_edt: '2.1',
      fecha: '2026-08-12',
      sector: 'LAS_MERCEDES',
      cantidad_trabajadores: 8,
      duracion_horas: 7.5,
      horas_hombre: 60,
      cantidad_ejecutada: 45,
      registro_activo: true,
    },
    cambios || {}
  );
}

prueba('el rendimiento por hora-hombre sale de lo ejecutado sobre las horas-hombre', () => {
  const i = Calculos.indicadoresActividad([registroGuardado()], actividadConMeta, PROYECTO, '2026-08-12');
  cercano(i.rendimientoPorHH, 45 / 60);
  cercano(i.hhPorUnidad, 60 / 45);
  cercano(i.rendimientoCuadrilla, 45 / 7.5);
  cercano(i.tamanoMedioCuadrilla, 8);
});

prueba('los registros dados de baja no suman en los indicadores', () => {
  const registros = [registroGuardado(), registroGuardado({ registro_activo: false })];
  const i = Calculos.indicadoresActividad(registros, actividadConMeta, PROYECTO, '2026-08-12');
  igual(i.registros, 1);
  igual(i.avanceAcumulado, 45);
});

prueba('el porcentaje de avance usa la meta de la EDT', () => {
  const registros = [registroGuardado({ cantidad_ejecutada: 900 })];
  const i = Calculos.indicadoresActividad(registros, actividadConMeta, PROYECTO, '2026-08-12');
  cercano(i.porcentajeAvance, 0.5, 0.0001);
  igual(i.meta, 1800);
});

prueba('una actividad sin meta no entrega porcentaje ni desviacion', () => {
  const registros = [registroGuardado({ codigo_edt: '2.4', cantidad_ejecutada: 120 })];
  const i = Calculos.indicadoresActividad(registros, actividadSinMeta, PROYECTO, '2026-08-12');
  igual(i.avanceAcumulado, 120, 'lo medido si se muestra');
  esNulo(i.porcentajeAvance, 'no hay porcentaje');
  esNulo(i.desviacionAvance, 'no hay desviacion');
  esNulo(i.ritmoRequeridoRestante, 'no hay ritmo requerido');
});

prueba('la desviacion negativa indica atraso frente al ritmo lineal', () => {
  // Al 2026-09-07 van 20 dias habiles de 36: lo esperado son 1000 zanjas.
  const registros = [registroGuardado({ cantidad_ejecutada: 400 })];
  const i = Calculos.indicadoresActividad(registros, actividadConMeta, PROYECTO, '2026-09-07');
  igual(i.diasHabilesTranscurridos, 20);
  cercano(i.avanceEsperado, 1800 * 20 / 36, 0.001);
  afirmar(i.desviacionAvance < 0, 'debe salir negativa');
});

prueba('el ritmo requerido reparte lo que falta entre los dias habiles restantes', () => {
  const registros = [registroGuardado({ cantidad_ejecutada: 800 })];
  const i = Calculos.indicadoresActividad(registros, actividadConMeta, PROYECTO, '2026-09-07');
  cercano(i.ritmoRequeridoRestante, (1800 - 800) / i.diasHabilesRestantes, 0.001);
});

prueba('sin registros los indicadores quedan en blanco y no en cero', () => {
  const i = Calculos.indicadoresActividad([], actividadConMeta, PROYECTO, '2026-08-12');
  esNulo(i.avanceAcumulado, 'cero se leeria como "se midio cero"');
  esNulo(i.rendimientoPorHH);
  esNulo(i.horasHombre);
});

prueba('el desglose por sector no reparte la meta del proyecto', () => {
  const registros = [
    registroGuardado({ sector: 'LAS_MERCEDES', cantidad_ejecutada: 100 }),
    registroGuardado({ sector: 'IBACACHE', cantidad_ejecutada: 60 }),
  ];
  const porSector = Calculos.indicadoresPorSector(registros, actividadConMeta, PROYECTO, '2026-08-12');
  igual(porSector.length, 2);
  porSector.forEach((s) => esNulo(s.porcentajeAvance, 'la meta es del proyecto, no de cada sector'));
});

// ---------------------------------------------------------------------------
// Indicadores economicos
// ---------------------------------------------------------------------------

prueba('sin valores cargados no hay ningun numero economico', () => {
  const eco = Calculos.indicadoresEconomicos([registroGuardado()], Calculos.costosVacios(), PROYECTO, '2026-08-12');
  esNulo(eco.manoObra);
  esNulo(eco.indirectosALaFecha);
  esNulo(eco.costoALaFecha);
  igual(eco.faltantes.length, 3, 'debe nombrar los tres valores que faltan');
});

prueba('el costo de mano de obra sale de las horas-hombre por el valor de la hora', () => {
  const costos = Object.assign(Calculos.costosVacios(), { costo_hh: 4000 });
  const eco = Calculos.indicadoresEconomicos([registroGuardado()], costos, PROYECTO, '2026-08-12');
  igual(eco.horasHombreTotales, 60);
  igual(eco.manoObra, 240000);
  igual(eco.costoALaFechaCompleto, false, 'todavia faltan los indirectos');
});

prueba('un arriendo mensual se lleva al total del proyecto', () => {
  const meses = Calculos.mesesDelProyecto(PROYECTO);
  afirmar(meses > 1.6 && meses < 1.8, 'el proyecto dura poco menos de dos meses, dio ' + meses);
  const total = Calculos.montoTotalProyecto(600000, 'mes', PROYECTO);
  cercano(total, 600000 * meses, 1);
});

prueba('un monto por dia habil se multiplica por los dias del plan', () => {
  igual(Calculos.montoTotalProyecto(30000, 'dia_habil', PROYECTO), 30000 * 36);
});

prueba('un monto declarado como total del proyecto no se multiplica', () => {
  igual(Calculos.montoTotalProyecto(1000000, 'proyecto', PROYECTO), 1000000);
});

prueba('con todos los valores cargados el costo a la fecha se declara completo', () => {
  const costos = Object.assign(Calculos.costosVacios(), {
    costo_hh: 4000,
    camioneta_monto: 600000,
    camioneta_periodicidad: 'mes',
    banos_monto: 200000,
    banos_periodicidad: 'mes',
    extras: [{ concepto: 'Combustible', monto: 150000 }],
  });
  const eco = Calculos.indicadoresEconomicos([registroGuardado()], costos, PROYECTO, '2026-09-07');
  igual(eco.costoALaFechaCompleto, true);
  afirmar(eco.costoALaFecha > eco.manoObra, 'debe sumar los indirectos y los extras');
  igual(eco.faltantes.length, 0);
});

prueba('el costo unitario de mano de obra es lo ejecutado sobre el gasto en personas', () => {
  const costos = Object.assign(Calculos.costosVacios(), { costo_hh: 4000 });
  const economia = Calculos.economiaActividad([registroGuardado()], actividadConMeta, costos, PROYECTO, '2026-08-12');
  igual(economia.costoManoObra, 240000);
  cercano(economia.costoUnitarioManoObra, 240000 / 45, 0.001);
  esNulo(economia.indirectosAsignados, 'sin arriendos cargados no se reparte nada');
});

prueba('los indirectos se reparten entre actividades segun sus horas-hombre', () => {
  const costos = Object.assign(Calculos.costosVacios(), {
    costo_hh: 4000,
    camioneta_monto: 100000,
    camioneta_periodicidad: 'proyecto',
  });
  const registros = [
    registroGuardado({ codigo_edt: '2.1', horas_hombre: 60 }),
    registroGuardado({ codigo_edt: '2.4', horas_hombre: 20, cantidad_ejecutada: 30 }),
  ];
  const a = Calculos.economiaActividad(registros, actividadConMeta, costos, PROYECTO, '2026-09-07');
  const b = Calculos.economiaActividad(registros, actividadSinMeta, costos, PROYECTO, '2026-09-07');
  cercano(a.indirectosAsignados / b.indirectosAsignados, 3, 0.001, '60 HH contra 20 HH');
});

// ---------------------------------------------------------------------------
// Configuracion generada desde la EDT
// ---------------------------------------------------------------------------

prueba('la aplicacion ofrece 11 actividades y deja 21 fuera', () => {
  igual(config.ACTIVIDADES.length, 11);
  igual(config.ACTIVIDADES_FUERA_DE_APP.length, 21);
  igual(config.ACTIVIDADES.length + config.ACTIVIDADES_FUERA_DE_APP.length, 32, 'la EDT completa');
});

prueba('ninguna actividad excluida aparece entre las registrables', () => {
  const registrables = config.ACTIVIDADES.map((a) => a.codigo);
  config.ACTIVIDADES_FUERA_DE_APP.forEach((a) => {
    afirmar(registrables.indexOf(a.codigo) === -1, 'la actividad ' + a.codigo + ' no debia estar en la aplicacion');
  });
});

prueba('las actividades que la EDT marca sin registro en app quedan todas fuera', () => {
  const fuera = config.ACTIVIDADES_FUERA_DE_APP.map((a) => a.codigo);
  ['3.1', '4.1', '4.2', '4.3', '4.4', '5.1', '5.2', '5.3', '6.1', '7.1', '7.2', '7.3',
   '8.1', '8.2', '8.3', '9.1', '10.2', '10.3', '11.1', '11.2', '11.3'].forEach((codigo) => {
    afirmar(fuera.indexOf(codigo) !== -1, 'falta excluir ' + codigo);
  });
});

prueba('cada actividad declara un campo de cantidad que existe entre sus parametros', () => {
  config.ACTIVIDADES.forEach((a) => {
    const codigos = a.parametros.map((p) => p.codigo);
    afirmar(
      codigos.indexOf(a.campo_cantidad_ejecutada) !== -1,
      'la actividad ' + a.codigo + ' apunta a un parametro inexistente: ' + a.campo_cantidad_ejecutada
    );
  });
});

prueba('ningun parametro se repite dentro de una actividad', () => {
  // Dos campos con el mismo codigo se pisan al leer el formulario: se guarda uno
  // y el otro se pierde en silencio.
  const comunes = config.PARAMETROS_COMUNES.map((p) => p.codigo);
  config.ACTIVIDADES.forEach((a) => {
    const vistos = {};
    comunes.concat(a.parametros.map((p) => p.codigo)).forEach((codigo) => {
      afirmar(!vistos[codigo], 'la actividad ' + a.codigo + ' repite el parametro ' + codigo);
      vistos[codigo] = true;
    });
  });
});

prueba('todo parametro de lista apunta a un catalogo que existe y tiene valores', () => {
  const todos = config.PARAMETROS_COMUNES.concat(
    config.ACTIVIDADES.reduce((lista, a) => lista.concat(a.parametros), [])
  );
  todos.filter((p) => p.tipo === 'lista').forEach((p) => {
    afirmar(!!p.catalogo, 'el parametro ' + p.codigo + ' es lista y no declara catalogo');
    const valores = config.CATALOGOS[p.catalogo];
    afirmar(valores && valores.length > 0, 'el catalogo ' + p.catalogo + ' esta vacio o no existe');
  });
});

prueba('la duracion y las horas-hombre son campos calculados, no campos por llenar', () => {
  ['duracion_horas', 'horas_hombre'].forEach((codigo) => {
    const p = config.PARAMETROS_COMUNES.filter((x) => x.codigo === codigo)[0];
    afirmar(!!p, 'falta el parametro ' + codigo);
    igual(p.origen, 'Calculado', codigo + ' no puede ser un campo que la persona llene');
  });
});

prueba('la jornada configurada es la informada para el proyecto', () => {
  igual(JORNADA.hora_inicio, '08:00');
  igual(JORNADA.hora_termino, '16:00');
  igual(JORNADA.colacion_minutos, 30);
});

prueba('los dos sectores de la EDT estan en el catalogo', () => {
  const sectores = config.CATALOGOS.SECTORES_FCH.map((s) => s.etiqueta);
  afirmar(sectores.indexOf('Las Mercedes') !== -1);
  afirmar(sectores.indexOf('Ibacache') !== -1);
  igual(sectores.length, 2);
});

if (require.main === module) {
  process.exit(ejecutar('Calculos y configuracion') > 0 ? 1 : 0);
}

module.exports = { ejecutar };
