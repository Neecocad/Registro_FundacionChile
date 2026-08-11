/**
 * Apps Script del proyecto Fundación Chile / María Pinto.
 *
 * Recibe los registros que envía la aplicación y los deja en la planilla, en el
 * modelo normalizado que define la EDT: una cabecera por ejecución
 * (07_Registro_Actividad) y los parámetros variables en formato largo
 * (08_Registro_Detalle), unidos por record_id.
 *
 * PASO MANUAL QUE HAY QUE RECORDAR CADA VEZ
 * -----------------------------------------
 * Cambiar este archivo en el repositorio no cambia nada en Google. Hay que:
 *   1. Copiar este contenido en el editor de Apps Script de la planilla.
 *   2. Implementar > Administrar implementaciones > editar la implementación
 *      existente > Versión: "Nueva versión".
 *
 * "Nueva versión" conserva la dirección web. "Nueva implementación" entrega otra
 * dirección y deja la anterior viva sirviendo el código antiguo: si algunos
 * equipos quedan apuntando a una y otros a la otra, los datos se parten en dos.
 */

/**
 * Versión del diseño de la planilla.
 *
 * Si no sube cuando cambia la estructura de las hojas, `asegurarEstructura` corta
 * apenas ve la misma versión guardada y la planilla conserva el diseño viejo para
 * siempre, sin dar ningún error.
 *
 * Tiene que coincidir con APP_VERSION (js/version.js) y con CACHE (sw.js).
 */
var KPI_VERSION = '0.1.0-beta';

var HOJA_EDT = '01_EDT_Actividades';
var HOJA_REGISTRO = '07_Registro_Actividad';
var HOJA_DETALLE = '08_Registro_Detalle';
var HOJA_COSTOS = '09_Costos_Parametros';
var HOJA_INDICADORES = '10_Indicadores';

var COLUMNAS_REGISTRO = [
  'record_id',
  'fecha',
  'persona_que_registra',
  'sector',
  'codigo_edt',
  'actividad',
  'categoria',
  'cantidad_trabajadores',
  'hora_inicio',
  'hora_termino',
  'minutos_colacion',
  'duracion_horas',
  'horas_hombre',
  'cantidad_ejecutada',
  'unidad_medida',
  'rendimiento_por_hh',
  'hh_por_unidad',
  'observaciones',
  'registro_activo',
  'fecha_creacion',
  'fecha_modificacion',
  'fecha_sincronizacion',
  'version_app'
];

var COLUMNAS_DETALLE = [
  'detalle_id',
  'record_id',
  'codigo_edt',
  'codigo_parametro',
  'valor_numero',
  'valor_texto',
  'valor_fecha',
  'valor_hora',
  'valor_booleano',
  'unidad',
  'fecha_creacion'
];

var COLUMNAS_EDT = [
  'codigo_edt',
  'categoria',
  'actividad',
  'unidad_medida',
  'meta_numero',
  'meta_texto',
  'campo_cantidad_ejecutada',
  'se_registra_en_app',
  'motivo_exclusion'
];

var COLUMNAS_COSTOS = ['clave', 'descripcion', 'valor', 'periodicidad', 'actualizado'];

// ---------------------------------------------------------------------------
// Punto de entrada
// ---------------------------------------------------------------------------

function doPost(e) {
  try {
    var datos = JSON.parse(e.postData.contents);
    var resultado = procesar(datos);
    return responder(resultado);
  } catch (error) {
    return responder({ ok: false, mensaje: String(error && error.message ? error.message : error) });
  }
}

function doGet() {
  return responder({ ok: true, mensaje: 'Servicio activo', kpi_version: KPI_VERSION });
}

function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function procesar(datos) {
  var planilla = SpreadsheetApp.getActive();

  asegurarEstructura(planilla, datos);

  var recibidos = [];
  var bajas = [];
  var registros = datos.registros || [];

  for (var i = 0; i < registros.length; i++) {
    var registro = registros[i];
    if (!registro.record_id) continue;

    guardarRegistro(planilla, registro, datos.version_app);
    guardarDetalle(planilla, registro);

    if (registro.registro_activo === false) {
      bajas.push(registro.record_id);
    } else {
      recibidos.push(registro.record_id);
    }
  }

  var costosActualizados = false;
  if (datos.costos) {
    guardarCostos(planilla, datos.costos);
    costosActualizados = true;
  }

  return {
    ok: true,
    recibidos: recibidos,
    bajas: bajas,
    costos_actualizados: costosActualizados,
    kpi_version: KPI_VERSION
  };
}

// ---------------------------------------------------------------------------
// Estructura de la planilla
// ---------------------------------------------------------------------------

/**
 * Crea o actualiza las hojas. Solo rehace el diseño cuando cambia KPI_VERSION,
 * para no reescribir encabezados en cada sincronización.
 *
 * Ninguna hoja se elimina: en Google Sheets, las fórmulas que apuntan a una hoja
 * borrada quedan en #REF! y no se recuperan al crear otra con el mismo nombre.
 */
function asegurarEstructura(planilla, datos) {
  var propiedades = PropertiesService.getDocumentProperties();
  var versionEnPlanilla = propiedades.getProperty('KPI_VERSION');

  // Las hojas de datos se aseguran siempre: si falta una, no hay dónde escribir.
  asegurarHoja(planilla, HOJA_REGISTRO, COLUMNAS_REGISTRO);
  asegurarHoja(planilla, HOJA_DETALLE, COLUMNAS_DETALLE);
  asegurarHoja(planilla, HOJA_COSTOS, COLUMNAS_COSTOS);
  asegurarHoja(planilla, HOJA_EDT, COLUMNAS_EDT);

  if (versionEnPlanilla === KPI_VERSION) return false;

  if (datos && datos.edt) escribirEdt(planilla, datos.edt);
  construirIndicadores(planilla, datos);

  propiedades.setProperty('KPI_VERSION', KPI_VERSION);
  return true;
}

/**
 * Devuelve la hoja con el encabezado pedido, creándola si no existe.
 *
 * Verifica que los nombres de columna no se repitan. Una hoja con columnas
 * duplicadas se ve perfectamente normal y arruina toda búsqueda por nombre: se
 * encuentra siempre la primera y la segunda queda muerta.
 */
function asegurarHoja(planilla, nombre, columnas) {
  var vistas = {};
  for (var i = 0; i < columnas.length; i++) {
    if (vistas[columnas[i]]) {
      throw new Error('La hoja ' + nombre + ' define dos veces la columna "' + columnas[i] + '".');
    }
    vistas[columnas[i]] = true;
  }

  var hoja = planilla.getSheetByName(nombre);
  if (!hoja) {
    hoja = planilla.insertSheet(nombre);
  }

  var encabezadoActual =
    hoja.getLastColumn() > 0 ? hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0] : [];

  if (encabezadoActual.join('|') !== columnas.join('|')) {
    hoja.getRange(1, 1, 1, columnas.length).setValues([columnas]);
    hoja.getRange(1, 1, 1, columnas.length).setFontWeight('bold');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

/** Índice fila por record_id. Nunca se ubica un registro por su posición. */
function indicePorClave(hoja, columnaClave) {
  var indice = {};
  var ultima = hoja.getLastRow();
  if (ultima < 2) return indice;

  var valores = hoja.getRange(2, columnaClave, ultima - 1, 1).getValues();
  for (var i = 0; i < valores.length; i++) {
    var clave = valores[i][0];
    if (clave !== '' && clave !== null) indice[String(clave)] = i + 2;
  }
  return indice;
}

// ---------------------------------------------------------------------------
// Escritura de registros
// ---------------------------------------------------------------------------

function guardarRegistro(planilla, registro, versionApp) {
  var hoja = asegurarHoja(planilla, HOJA_REGISTRO, COLUMNAS_REGISTRO);
  var indice = indicePorClave(hoja, 1);
  var ahora = new Date();

  var fila = COLUMNAS_REGISTRO.map(function (columna) {
    if (columna === 'fecha_sincronizacion') return ahora;
    if (columna === 'version_app') return versionApp || '';
    if (columna === 'registro_activo') return registro.registro_activo === false ? false : true;
    var valor = registro[columna];
    return valor === undefined || valor === null ? '' : valor;
  });

  var numeroFila = indice[String(registro.record_id)];
  if (numeroFila) {
    hoja.getRange(numeroFila, 1, 1, COLUMNAS_REGISTRO.length).setValues([fila]);
  } else {
    hoja.appendRow(fila);
  }
}

/**
 * Reemplaza el detalle del registro.
 *
 * Se borran las filas anteriores del mismo record_id antes de escribir: si no,
 * editar un registro dejaría conviviendo el valor viejo y el nuevo, y cualquier
 * suma contaría los dos.
 */
function guardarDetalle(planilla, registro) {
  var hoja = asegurarHoja(planilla, HOJA_DETALLE, COLUMNAS_DETALLE);
  borrarDetalle(hoja, registro.record_id);

  var detalle = registro.detalle || {};
  var claves = Object.keys(detalle);
  if (!claves.length) return;

  var ahora = new Date();
  var filas = [];

  for (var i = 0; i < claves.length; i++) {
    var codigo = claves[i];
    var valor = detalle[codigo];
    if (valor === '' || valor === null || valor === undefined) continue;

    var esNumero = typeof valor === 'number' && isFinite(valor);
    filas.push([
      registro.record_id + ':' + codigo,
      registro.record_id,
      registro.codigo_edt || '',
      codigo,
      esNumero ? valor : '',
      esNumero ? '' : String(valor),
      '',
      '',
      '',
      registro.unidad_medida || '',
      ahora
    ]);
  }

  if (filas.length) {
    hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, COLUMNAS_DETALLE.length).setValues(filas);
  }
}

function borrarDetalle(hoja, recordId) {
  var ultima = hoja.getLastRow();
  if (ultima < 2) return;

  var valores = hoja.getRange(2, 2, ultima - 1, 1).getValues();
  // De abajo hacia arriba: borrar de arriba hacia abajo mueve las filas que
  // todavía faltan por revisar.
  for (var i = valores.length - 1; i >= 0; i--) {
    if (String(valores[i][0]) === String(recordId)) {
      hoja.deleteRow(i + 2);
    }
  }
}

function guardarCostos(planilla, costos) {
  var hoja = asegurarHoja(planilla, HOJA_COSTOS, COLUMNAS_COSTOS);
  var ahora = new Date();

  var filas = [
    ['costo_hh', 'Costo de una hora-hombre', valorOVacio(costos.costo_hh), 'Por hora-hombre', ahora],
    ['camioneta', 'Arriendo de camioneta', valorOVacio(costos.camioneta_monto), costos.camioneta_periodicidad || '', ahora],
    ['banos', 'Arriendo de baños', valorOVacio(costos.banos_monto), costos.banos_periodicidad || '', ahora]
  ];

  var extras = costos.extras || [];
  for (var i = 0; i < extras.length; i++) {
    filas.push([
      'extra_' + (i + 1),
      extras[i].concepto || 'Costo extra',
      valorOVacio(extras[i].monto),
      'Total del proyecto',
      ahora
    ]);
  }

  // La hoja de parámetros se reescribe completa: son pocos valores y así no
  // quedan extras de una carga anterior que ya se eliminaron en el teléfono.
  if (hoja.getLastRow() > 1) {
    hoja.getRange(2, 1, hoja.getLastRow() - 1, COLUMNAS_COSTOS.length).clearContent();
  }
  hoja.getRange(2, 1, filas.length, COLUMNAS_COSTOS.length).setValues(filas);
}

function valorOVacio(valor) {
  return valor === null || valor === undefined || valor === '' ? '' : valor;
}

function escribirEdt(planilla, edt) {
  var hoja = asegurarHoja(planilla, HOJA_EDT, COLUMNAS_EDT);
  if (hoja.getLastRow() > 1) {
    hoja.getRange(2, 1, hoja.getLastRow() - 1, COLUMNAS_EDT.length).clearContent();
  }

  var filas = edt.map(function (a) {
    return [
      a.codigo,
      a.categoria || '',
      a.nombre || '',
      a.unidad_medida || '',
      a.meta === null || a.meta === undefined ? '' : a.meta,
      a.meta_texto || '',
      a.campo_cantidad_ejecutada || '',
      a.en_app ? 'Sí' : 'No',
      a.motivo || ''
    ];
  });

  if (filas.length) {
    hoja.getRange(2, 1, filas.length, COLUMNAS_EDT.length).setValues(filas);
  }
}

// ---------------------------------------------------------------------------
// Hoja de indicadores
// ---------------------------------------------------------------------------

/**
 * Arma la hoja de indicadores con fórmulas vivas: se recalculan solas cuando
 * llegan registros nuevos, sin volver a ejecutar el script.
 */
function construirIndicadores(planilla, datos) {
  var hoja = asegurarHoja(planilla, HOJA_INDICADORES, ['Indicadores']);
  hoja.clear();

  // OJO CON EL IDIOMA DE LAS FÓRMULAS. Al escribirlas desde Apps Script hay que
  // usar la notación en inglés: separador coma, TRUE en vez de VERDADERO,
  // TODAY() en vez de HOY(). Google las traduce sola al mostrarlas en una
  // planilla en español. Si se escriben en español, la celda queda con #ERROR!
  // y el indicador simplemente no aparece.

  var proyecto = (datos && datos.proyecto) || {};
  var jornada = (datos && datos.jornada) || {};
  var diasPlan = proyecto.dias_habiles_plan || 36;

  var actividadesEnApp = ((datos && datos.edt) || []).filter(function (a) {
    return a.en_app;
  });

  var encabezado = [
    'codigo_edt',
    'actividad',
    'unidad',
    'meta',
    'ejecutado',
    'horas_hombre',
    'rendimiento_por_hh',
    'hh_por_unidad',
    'porcentaje_avance',
    'meta_diaria_teorica',
    'esperado_a_hoy',
    'desviacion',
    'ritmo_requerido_restante'
  ];

  hoja.getRange(1, 1, 1, 2).setValues([['Indicadores del proyecto', proyecto.nombre || '']]);
  hoja.getRange(2, 1, 1, 2).setValues([
    ['Jornada', (jornada.hora_inicio || '') + ' a ' + (jornada.hora_termino || '') +
      ' con ' + (jornada.colacion_minutos || 0) + ' min de colación']
  ]);
  hoja.getRange(3, 1, 1, 2).setValues([['Días hábiles del plan', diasPlan]]);

  // Los feriados quedan en celdas y no dentro de la fórmula, para que se puedan
  // corregir desde la planilla sin tocar el script.
  var feriados = proyecto.feriados || [];
  hoja.getRange(3, 3).setValue('Feriados');
  var rangoFeriados = '';
  if (feriados.length) {
    var celdas = feriados.map(function (f) { return [f]; });
    hoja.getRange(4, 3, celdas.length, 1).setValues(celdas);
    rangoFeriados = ',C4:C' + (3 + celdas.length);
  }

  hoja.getRange(4, 1, 1, 2).setValues([
    ['Días hábiles transcurridos', formulaDiasTranscurridos(proyecto, rangoFeriados)]
  ]);
  hoja.getRange(5, 1, 1, 2).setValues([['Días hábiles restantes', '=MAX(0,' + diasPlan + '-B4)']]);
  hoja.getRange(6, 1, 1, 2).setValues([['Diseño de la planilla', KPI_VERSION]]);

  var filaEncabezado = 8;
  hoja.getRange(filaEncabezado, 1, 1, encabezado.length).setValues([encabezado]);
  hoja.getRange(filaEncabezado, 1, 1, encabezado.length).setFontWeight('bold');

  var filas = [];
  for (var i = 0; i < actividadesEnApp.length; i++) {
    var a = actividadesEnApp[i];
    var f = filaEncabezado + 1 + i;
    var codigo = '"' + a.codigo + '"';
    var meta = a.meta === null || a.meta === undefined || a.meta === '' ? '' : a.meta;

    // El filtro exige registro_activo = VERDADERO: una baja no puede seguir
    // sumando en los indicadores.
    var sumaEjecutado =
      '=SUMIFS(' + HOJA_REGISTRO + '!N:N,' + HOJA_REGISTRO + '!E:E,' + codigo + ',' +
      HOJA_REGISTRO + '!S:S,TRUE)';
    var sumaHH =
      '=SUMIFS(' + HOJA_REGISTRO + '!M:M,' + HOJA_REGISTRO + '!E:E,' + codigo + ',' +
      HOJA_REGISTRO + '!S:S,TRUE)';

    filas.push([
      a.codigo,
      a.nombre,
      a.unidad_medida || '',
      meta,
      sumaEjecutado,
      sumaHH,
      '=IFERROR(E' + f + '/F' + f + ',"")',
      '=IFERROR(F' + f + '/E' + f + ',"")',
      meta === '' ? '' : '=IFERROR(E' + f + '/D' + f + ',"")',
      meta === '' ? '' : '=IFERROR(D' + f + '/$B$3,"")',
      meta === '' ? '' : '=IFERROR(D' + f + '*$B$4/$B$3,"")',
      meta === '' ? '' : '=IFERROR(E' + f + '-K' + f + ',"")',
      meta === '' ? '' : '=IFERROR(MAX(0,D' + f + '-E' + f + ')/$B$5,"")'
    ]);
  }

  if (filas.length) {
    hoja.getRange(filaEncabezado + 1, 1, filas.length, encabezado.length).setValues(filas);
  }

  var filaNota = filaEncabezado + filas.length + 2;
  hoja.getRange(filaNota, 1).setValue(
    'Las actividades sin meta en la EDT no muestran porcentaje de avance: no hay contra qué compararlas.'
  );
  hoja.getRange(filaNota + 1, 1).setValue(
    'Las unidades no se suman entre actividades: zanjas, metros y asistentes se leen por separado.'
  );

  construirIndicadoresEconomicos(hoja, filaNota + 3, actividadesEnApp, filaEncabezado, diasPlan);
}

function construirIndicadoresEconomicos(hoja, fila, actividades, filaEncabezado, diasPlan) {
  hoja.getRange(fila, 1).setValue('Indicadores económicos');
  hoja.getRange(fila, 1).setFontWeight('bold');

  var buscar = function (clave) {
    return 'IFERROR(VLOOKUP("' + clave + '",' + HOJA_COSTOS + '!A:C,3,FALSE),"")';
  };

  var primeraActividad = filaEncabezado + 1;
  var ultimaActividad = filaEncabezado + Math.max(actividades.length, 1);
  var rangoHH = 'F' + primeraActividad + ':F' + ultimaActividad;

  var filas = [
    ['Costo de la hora-hombre', '=' + buscar('costo_hh')],
    ['Horas-hombre acumuladas', '=SUM(' + rangoHH + ')'],
    ['Costo de mano de obra a la fecha', '=IFERROR(B' + (fila + 1) + '*B' + (fila + 2) + ',"")'],
    ['Arriendo de camioneta (según periodicidad cargada)', '=' + buscar('camioneta')],
    ['Arriendo de baños (según periodicidad cargada)', '=' + buscar('banos')],
    [
      'Costo por día hábil de camioneta y baños',
      '=IFERROR((B' + (fila + 4) + '+B' + (fila + 5) + ')/' + diasPlan + ',"")'
    ]
  ];

  hoja.getRange(fila + 1, 1, filas.length, 2).setValues(filas);

  hoja.getRange(fila + filas.length + 2, 1).setValue(
    'Los montos de camioneta y baños se cargan en ' + HOJA_COSTOS + ' con su periodicidad. ' +
    'Si la periodicidad es mensual, este cuadro los toma tal cual: conviene revisar la columna periodicidad antes de leer el total.'
  );
}

/** Días hábiles transcurridos: lunes a viernes descontando los feriados informados. */
function formulaDiasTranscurridos(proyecto, rangoFeriados) {
  var inicio = proyecto.fecha_inicio || '';
  var termino = proyecto.fecha_termino || '';
  if (!inicio || !termino) return 0;

  return (
    '=IFERROR(NETWORKDAYS(DATEVALUE("' + inicio + '"),MIN(TODAY(),DATEVALUE("' + termino + '"))' +
    (rangoFeriados || '') +
    '),0)'
  );
}

// Se exporta para poder ejecutar el script contra una planilla simulada en Node
// (pruebas/simular_apps_script.js). En Apps Script esta línea no hace nada.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    KPI_VERSION: KPI_VERSION,
    COLUMNAS_REGISTRO: COLUMNAS_REGISTRO,
    COLUMNAS_DETALLE: COLUMNAS_DETALLE,
    COLUMNAS_EDT: COLUMNAS_EDT,
    COLUMNAS_COSTOS: COLUMNAS_COSTOS,
    procesar: procesar,
    asegurarEstructura: asegurarEstructura,
    asegurarHoja: asegurarHoja,
    guardarRegistro: guardarRegistro,
    guardarDetalle: guardarDetalle,
    guardarCostos: guardarCostos,
    construirIndicadores: construirIndicadores
  };
}
