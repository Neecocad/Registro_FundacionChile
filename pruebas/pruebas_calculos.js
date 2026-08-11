// Pruebas de lo que hace la aplicacion: calcular la jornada, avisar cuando algo
// se ve raro y armar la fila que viaja a la planilla.
//
// Los indicadores no se prueban aca porque la aplicacion no los calcula: viven
// en la planilla y se prueban en pruebas/pruebas_apps_script.js.
//
//   node pruebas/pruebas_calculos.js

const path = require('path');
const { prueba, afirmar, igual, cercano, esNulo, ejecutar } = require('./ayuda');

const Calculos = require(path.join(__dirname, '..', 'js', 'calculos.js'));
const Sincronizacion = require(path.join(__dirname, '..', 'js', 'sincronizacion.js'));
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
  // Caso real del proyecto hermano: 15:00 a 07:30 daba 16,5 horas y reportaba la
  // mitad del rendimiento, sin advertir nada.
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

prueba('el rendimiento del registro se guarda en sus dos bases', () => {
  const r = Calculos.rendimientos(45, 60, JORNADA);
  cercano(r.porHoraHombre, 0.75);
  cercano(r.porJornada, 0.75 * 7.5, 0.0001);
});

prueba('sin horas-hombre no hay rendimiento, y no se rellena con cero', () => {
  const r = Calculos.rendimientos(45, 0, JORNADA);
  esNulo(r.porHoraHombre);
  esNulo(r.porJornada);
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
  const avisos = Calculos.revisarRegistro(registroNormal(), actividadConMeta, PROYECTO, JORNADA, 0);
  igual(avisos.length, 0, 'avisos inesperados: ' + JSON.stringify(avisos.map((a) => a.mensaje)));
});

prueba('CASO DE CONTROL: con acumulado a medio camino tampoco hay avisos', () => {
  const avisos = Calculos.revisarRegistro(registroNormal(), actividadConMeta, PROYECTO, JORNADA, 900);
  igual(avisos.length, 0, 'avisos inesperados: ' + JSON.stringify(avisos.map((a) => a.mensaje)));
});

prueba('las horas invertidas producen un error', () => {
  const avisos = Calculos.revisarRegistro(
    registroNormal({ hora_inicio: '15:00', hora_termino: '07:30' }),
    actividadConMeta, PROYECTO, JORNADA, 0
  );
  afirmar(avisos.some((a) => a.nivel === 'error'), 'debe haber al menos un error');
});

prueba('una cantidad muy superior a la referencia avisa sin bloquear', () => {
  const avisos = Calculos.revisarRegistro(
    registroNormal({ cantidad_ejecutada: 500 }),
    actividadConMeta, PROYECTO, JORNADA, 0
  );
  afirmar(avisos.some((a) => a.campo === 'cantidad_ejecutada'), 'debe avisar por la cantidad');
  afirmar(!avisos.some((a) => a.nivel === 'error'), 'no debe bloquear el guardado');
});

prueba('superar la meta con el acumulado avisa', () => {
  // En el proyecto hermano existia una funcion que calculaba este acumulado —lo
  // decia su propio comentario— pero no se llamaba desde ninguna parte, asi que
  // el aviso nunca aparecio. Aca se comprueba que el aviso existe de verdad.
  const avisos = Calculos.revisarRegistro(
    registroNormal({ cantidad_ejecutada: 45 }),
    actividadConMeta, PROYECTO, JORNADA, 1790
  );
  const acumulado = avisos.filter((a) => /acumulado/.test(a.mensaje));
  igual(acumulado.length, 1, 'debe avisar que el acumulado pasa la meta');
  afirmar(/1.835/.test(acumulado[0].mensaje), 'debe mostrar el acumulado que queda: ' + acumulado[0].mensaje);
  afirmar(!avisos.some((a) => a.nivel === 'error'), 'no bloquea');
});

prueba('una actividad sin meta no genera aviso por cantidad ni por acumulado', () => {
  // Sin valor de referencia no hay nada contra que comparar; inventar un numero
  // seria peor que no decir nada.
  const avisos = Calculos.revisarRegistro(
    registroNormal({ cantidad_ejecutada: 99999 }),
    actividadSinMeta, PROYECTO, JORNADA, 500000
  );
  igual(avisos.filter((a) => a.campo === 'cantidad_ejecutada').length, 0);
});

prueba('registrar un sabado avisa', () => {
  const avisos = Calculos.revisarRegistro(
    registroNormal({ fecha: '2026-08-15' }), actividadConMeta, PROYECTO, JORNADA, 0
  );
  afirmar(avisos.some((a) => a.campo === 'fecha'));
});

prueba('una fecha fuera del periodo del proyecto avisa', () => {
  const avisos = Calculos.revisarRegistro(
    registroNormal({ fecha: '2026-11-20' }), actividadConMeta, PROYECTO, JORNADA, 0
  );
  afirmar(avisos.some((a) => a.campo === 'fecha'));
});

prueba('una jornada mas larga que la estandar avisa', () => {
  const avisos = Calculos.revisarRegistro(
    registroNormal({ hora_termino: '19:00' }), actividadConMeta, PROYECTO, JORNADA, 0
  );
  afirmar(avisos.some((a) => a.campo === 'hora_termino' || a.campo === 'hora_inicio'));
});

prueba('cero trabajadores es un error', () => {
  const avisos = Calculos.revisarRegistro(
    registroNormal({ cantidad_trabajadores: 0 }), actividadConMeta, PROYECTO, JORNADA, 0
  );
  afirmar(avisos.some((a) => a.nivel === 'error' && a.campo === 'cantidad_trabajadores'));
});

// ---------------------------------------------------------------------------
// La fila que viaja a la planilla
// ---------------------------------------------------------------------------

function registroGuardado(cambios) {
  return Object.assign(
    {
      record_id: 'aaaa-1111',
      codigo_edt: '2.1',
      actividad: 'Trazado y replanteo de zanjas',
      categoria: 'Conservación de suelos y aguas',
      unidad_medida: 'N° de zanjas marcadas',
      fecha: '2026-08-12',
      persona_que_registra: 'Persona de prueba',
      sector: 'LAS_MERCEDES',
      cantidad_trabajadores: 8,
      hora_inicio: '08:00',
      hora_termino: '16:00',
      minutos_colacion: 30,
      duracion_horas: 7.5,
      horas_hombre: 60,
      cantidad_ejecutada: 45,
      rendimiento_por_hh: 0.75,
      rendimiento_por_jornada: 5.625,
      registro_activo: true,
      detalle: { cantidad_zanjas_marcadas: 45 },
    },
    cambios || {}
  );
}

prueba('a la planilla viaja el nombre visible del sector, no su codigo', () => {
  const fila = Sincronizacion.fila(registroGuardado(), config);
  igual(fila.sector, 'Las Mercedes');
});

prueba('la fila lleva la meta vigente de la actividad', () => {
  igual(Sincronizacion.fila(registroGuardado(), config).meta_vigente, 1800);
  igual(
    Sincronizacion.fila(registroGuardado({ codigo_edt: '2.4' }), config).meta_vigente,
    '',
    'una actividad sin meta no inventa una'
  );
});

prueba('los campos propios de la actividad viajan cada uno en su columna', () => {
  const fila = Sincronizacion.fila(registroGuardado(), config);
  igual(fila.cantidad_zanjas_marcadas, 45);
  afirmar(!('detalle' in fila), 'el detalle no viaja anidado');
});

prueba('un campo propio no puede pisar una columna base', () => {
  // Si una actividad definiera un parametro llamado igual que una columna base,
  // el valor base es el que manda: perderlo desalinearia toda la fila.
  const fila = Sincronizacion.fila(
    registroGuardado({ detalle: { cantidad_ejecutada: 999, cantidad_zanjas_marcadas: 45 } }),
    config
  );
  igual(fila.cantidad_ejecutada, 45, 'debe conservar el valor canonico');
});

prueba('la fila trae todas las columnas base, aunque el registro no las tenga', () => {
  const fila = Sincronizacion.fila({ record_id: 'x', codigo_edt: '2.1' }, config);
  Sincronizacion.CAMPOS.forEach((campo) => {
    afirmar(campo in fila, 'falta la columna ' + campo);
  });
});

prueba('la aplicacion trae la direccion del Apps Script puesta', () => {
  // Si viniera vacia, cada telefono tendria que escribirla a mano en Exportar, y
  // basta que uno se salte el paso para que sus registros se queden en el
  // dispositivo sin que nadie lo note.
  const url = Sincronizacion.DIRECCION_POR_DEFECTO;
  afirmar(!!url, 'DIRECCION_POR_DEFECTO esta vacia');
  afirmar(/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url),
    'no tiene forma de direccion de Apps Script implementada: ' + url);
});

prueba('un registro dado de baja viaja marcado como no vigente', () => {
  igual(Sincronizacion.fila(registroGuardado({ registro_activo: false }), config).registro_activo, false);
  igual(Sincronizacion.fila(registroGuardado(), config).registro_activo, true);
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
  process.exit(ejecutar('Aplicacion: jornada, avisos y fila de salida') > 0 ? 1 : 0);
}

module.exports = { ejecutar };
