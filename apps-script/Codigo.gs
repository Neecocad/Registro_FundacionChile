/**
 * Fundación Chile — María Pinto · Web App de sincronización.
 *
 * Recibe los registros que envía la aplicación de terreno y los escribe en la
 * planilla del proyecto. Además mantiene dos hojas que se calculan solas:
 *
 *   · KPI_MariaPinto     avance, horas-hombre, rendimiento, plazo y costo
 *   · Costos_MariaPinto  los valores económicos que se llenan a mano
 *
 * La aplicación NO calcula indicadores: solo captura. Todo lo que se mira para
 * tomar decisiones vive acá, en fórmulas que se recalculan solas cada vez que
 * llega un registro nuevo. No hay que volver a ejecutar el script.
 *
 * --- Instalación ---
 * 1. Pega abajo, en ID_PLANILLA, el identificador de la planilla: lo que va
 *    entre  /d/  y  /edit  en su dirección.
 * 2. script.google.com/home → Nuevo proyecto → pega este archivo → Ctrl+S.
 *    (Proyecto independiente, NO desde Extensiones → Apps Script de la planilla:
 *     una planilla admite un solo script incrustado y ese lugar puede quedar
 *     ocupado por otra aplicación que escriba en otras hojas de la misma planilla.)
 * 3. Implementar → Nueva implementación → Aplicación web:
 *      Ejecutar como: Yo · Quién tiene acceso: Cualquier persona
 *    Copia la dirección que termina en /exec y pégala en js/sincronizacion.js
 *    (DIRECCION_POR_DEFECTO).
 * 4. Para actualizar después hay dos caminos y NO dan lo mismo:
 *    · Administrar implementaciones → editar (lápiz) → Nueva versión: la
 *      dirección no cambia y no hay que tocar la aplicación. Es el camino corto.
 *    · Nueva implementación: crea OTRA dirección. La anterior queda viva
 *      sirviendo el código viejo, así que hay que pegar la nueva en
 *      js/sincronizacion.js y subir el sufijo de CLAVE_URL, o los teléfonos que
 *      tenían la anterior guardada le seguirán escribiendo.
 */

// ⚠️ ÚNICO valor que hay que cambiar para apuntar a otra planilla.
// Planilla "BD_FundacionChile". El identificador es lo que va entre /d/ y /edit
// en su dirección.
var ID_PLANILLA = '1v-BkUtDlt0qpXI6W09fueU8brj7Jpn9Sz2RHus9BZjs';

var PROYECTO_ID = 'FCH_MARIA_PINTO';
var NOMBRE_PROYECTO = 'Fundación Chile - María Pinto';

var HOJA_REGISTROS = 'Registros_MariaPinto';
var HOJA_KPI = 'KPI_MariaPinto';
var HOJA_COSTOS = 'Costos_MariaPinto';

/**
 * Versión del diseño de las hojas calculadas.
 *
 * Sube cuando cambia el DISEÑO DE LAS HOJAS: una sección nueva del KPI, una
 * fórmula distinta, una columna más. No tiene nada que ver con la versión de la
 * aplicación: un cambio de pantalla en el teléfono no necesita volver a
 * implementar este script, y atarlas obligaría a hacerlo cada vez.
 *
 * Si no sube cuando el diseño sí cambió, la planilla conserva el diseño viejo
 * para siempre: el script corta apenas ve la misma versión guardada, sin dar
 * ningún error.
 */
var KPI_VERSION = '1';

// Jornada del proyecto: 08:00 a 16:00 con 30 minutos de colación.
var HORAS_JORNADA = 7.5;

// Calendario del proyecto, según la EDT.
var FECHA_INICIO = '2026-08-11';
var FECHA_TERMINO = '2026-10-01';
var DIAS_HABILES_PLAN = 36;
var FERIADOS = ['2026-09-17', '2026-09-18'];

// Días con registro mínimos antes de dar por confiable un ritmo medido. Con uno
// o dos días el número es anecdótico: un día de lluvia o un terreno duro lo
// mueven entero.
var DIAS_MIN_CONFIABLE = 3;

// Umbral de alerta sobre el cumplimiento del ritmo. 0.9 avisa bajo el 90%.
var UMBRAL_ALERTA = 0.9;

// <<< ACTIVIDADES GENERADAS — no editar a mano.
// Se generan con `python3 herramientas/generar_config.py` desde
// especificacion/EDT_Fundacion_Chile_Maria_Pinto_KPI.xlsx. Son las mismas que
// ofrece la aplicación, así que la hoja KPI no puede quedar desalineada con el
// formulario.
var ACTIVIDADES = [
  { edt: '1.1', nombre: 'Informe de diseño de obras', unidad: 'Informe de diseño de obras', meta: null },
  { edt: '2.1', nombre: 'Trazado y replanteo de zanjas', unidad: 'N° de zanjas marcadas', meta: 1800 },
  { edt: '2.2', nombre: 'Trazado y replanteo de microterrazas', unidad: 'Metros de microterraza marcados', meta: 1500 },
  { edt: '2.3', nombre: 'Trazado y replanteo de sacos de tierra', unidad: 'Metros de sacos de tierra marcados', meta: 1500 },
  { edt: '2.4', nombre: 'Relleno de sacos de tierra', unidad: 'N° de sacos de tierra llenos', meta: null },
  { edt: '2.5', nombre: 'Confección de zanjas de infiltración', unidad: 'N° de zanjas confeccionadas, con todas sus componentes', meta: 1800 },
  { edt: '2.6', nombre: 'Confección de microterrazas', unidad: 'Metros construidos', meta: 1500 },
  { edt: '2.7', nombre: 'Confección de sacos de tierra', unidad: 'Metros construidos', meta: 1500 },
  { edt: '2.8', nombre: 'Trazado del sendero', unidad: 'Metros de sendero marcados', meta: 500 },
  { edt: '2.9', nombre: 'Construcción de sendero', unidad: 'Metros construidos', meta: 500 },
  { edt: '10.1', nombre: 'Ejecución de jornada de educación', unidad: 'Cantidad de asistentes', meta: null }
];
// >>> FIN ACTIVIDADES GENERADAS

// Columnas base de la hoja de registros. Los campos propios de cada actividad se
// agregan solos al final del encabezado la primera vez que aparecen.
var COLUMNAS = [
  'timestamp_sync', 'record_id', 'proyecto_id', 'nombre_proyecto', 'codigo_edt',
  'actividad', 'categoria', 'unidad_medida', 'meta_vigente', 'fecha',
  'persona_que_registra', 'sector', 'cantidad_trabajadores', 'hora_inicio', 'hora_termino',
  'minutos_colacion', 'duracion_horas', 'horas_hombre', 'cantidad_ejecutada',
  'rendimiento_por_hh', 'rendimiento_por_jornada', 'observaciones', 'registro_activo',
  'fecha_creacion', 'fecha_modificacion', 'estado_sincronizacion', 'fecha_sincronizacion',
  'version_app'
];

var COLUMNAS_COSTOS = ['clave', 'concepto', 'tipo', 'valor', 'periodicidad', 'total_del_proyecto', 'notas'];

var PERIODICIDADES = ['Por día hábil', 'Por mes', 'Total del proyecto'];

// Parámetros económicos que la planilla ofrece para llenar. Los valores los
// escribe a mano quien administra el proyecto: el script crea las filas, pero
// NUNCA sobreescribe lo que ya esté escrito en la columna valor.
var PARAMETROS_COSTOS = [
  ['costo_hh', 'Costo de una hora-hombre', 'Hora-hombre', '',
    'Es una tarifa por hora, no un total: si conoces el costo diario por trabajador, divídelo por 7,5.'],
  ['camioneta', 'Arriendo de camioneta', 'Indirecto', 'Por mes', 'Elige la periodicidad del contrato.'],
  ['banos', 'Arriendo de baños', 'Indirecto', 'Por mes', 'Elige la periodicidad del contrato.']
];

// Filas en blanco para costos extras (combustible, herramientas, fletes). Vienen
// con la fórmula puesta: basta escribir el concepto y el monto.
var FILAS_EXTRAS = 10;

// ---------------------------------------------------------------------------
// Punto de entrada
// ---------------------------------------------------------------------------

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (ID_PLANILLA === 'PEGA_AQUI_EL_ID_DE_LA_PLANILLA') {
      return _json({ estado: 'error', mensaje: 'Falta configurar ID_PLANILLA en el script.' });
    }

    var payload = (e.parameter && e.parameter.data)
      ? JSON.parse(e.parameter.data)
      : JSON.parse(e.postData.contents);

    if (payload.tipo !== 'registro_fundacion_chile') {
      return _json({
        estado: 'error',
        mensaje: 'Este Web App solo recibe tipo: registro_fundacion_chile. Recibido: ' + payload.tipo
      });
    }

    var planilla = SpreadsheetApp.openById(ID_PLANILLA);
    var resultado = _registrar(planilla, payload);

    // Las hojas calculadas son accesorias: si fallan, el registro ya quedó
    // escrito y la sincronización no debe darse por fallida. Si el teléfono
    // creyera que perdió el dato, lo reintentaría y el equipo pensaría que se
    // perdieron registros.
    try {
      _asegurarCostos(planilla);
      _asegurarKPI(planilla);
    } catch (err) {
      resultado.error_indicadores = String(err && err.message ? err.message : err);
    }
    return _json(resultado);
  } catch (err) {
    return _json({ estado: 'error', mensaje: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Diagnóstico. Abrir la dirección en el navegador dice en qué planilla escribe
 * de verdad esta implementación, sin depender de lo que diga el repositorio.
 * La aplicación lo usa para mostrar el enlace a la planilla en Exportar.
 */
function doGet() {
  var base = {
    estado: 'ok',
    mensaje: 'Fundación Chile — María Pinto · servicio activo',
    kpi_version: KPI_VERSION,
    planilla_configurada: ID_PLANILLA !== 'PEGA_AQUI_EL_ID_DE_LA_PLANILLA',
    hojas_destino: [HOJA_REGISTROS, HOJA_KPI, HOJA_COSTOS]
  };
  if (!base.planilla_configurada) {
    base.estado = 'error';
    base.mensaje = 'Falta configurar ID_PLANILLA en el script.';
    return _json(base);
  }
  try {
    var planilla = SpreadsheetApp.openById(ID_PLANILLA);
    base.planilla_nombre = planilla.getName();
    base.planilla_url = planilla.getUrl();
    base.hojas_existentes = planilla.getSheets().map(function (h) { return h.getName(); });
  } catch (err) {
    base.estado = 'error';
    base.mensaje = 'No se pudo abrir la planilla: ' + (err && err.message ? err.message : err);
  }
  return _json(base);
}

function _json(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// Escritura de registros
// ---------------------------------------------------------------------------

function _registrar(planilla, payload) {
  var recordId = payload.record_id;
  var registro = payload.registro || {};
  var hoja = _hoja(planilla, HOJA_REGISTROS);

  // El encabezado real de la hoja manda: los campos propios de una actividad
  // nueva se agregan al final sin descuadrar las filas ya escritas.
  var columnas = _asegurarEncabezado(hoja, COLUMNAS.concat(Object.keys(registro)));

  // Upsert por record_id: reintentar un envío interrumpido no duplica, y editar
  // un registro no deja conviviendo la versión vieja con la nueva.
  _eliminarPorRecordId(hoja, columnas, recordId);

  var sello = Utilities.formatDate(new Date(), 'America/Santiago', 'yyyy-MM-dd HH:mm:ss');

  hoja.appendRow(columnas.map(function (columna) {
    if (columna === 'timestamp_sync') return sello;
    if (columna === 'record_id') return recordId;
    if (columna === 'proyecto_id') return registro.proyecto_id || PROYECTO_ID;
    if (columna === 'nombre_proyecto') return registro.nombre_proyecto || NOMBRE_PROYECTO;
    if (columna === 'estado_sincronizacion') {
      return registro.registro_activo === false ? 'Dado de baja' : 'Sincronizado';
    }
    if (columna === 'fecha_sincronizacion') return sello;
    if (columna === 'version_app') return payload.version_app || '';
    if (columna === 'registro_activo') return registro.registro_activo !== false;
    // Fecha real y no texto, para que ordenar y agrupar por fecha funcione.
    if (columna === 'fecha' && registro.fecha) return new Date(registro.fecha + 'T00:00:00');
    return registro[columna] !== undefined && registro[columna] !== null ? registro[columna] : '';
  }));

  return {
    estado: 'ok',
    record_id: recordId,
    codigo_edt: registro.codigo_edt,
    dado_de_baja: registro.registro_activo === false
  };
}

/**
 * Devuelve el encabezado real de la hoja, creándolo o completándolo.
 *
 * La lista que llega trae repeticiones: _registrar la arma como COLUMNAS más las
 * claves del registro, y el registro incluye campos que ya están en COLUMNAS. En
 * el proyecto hermano eso hacía que la hoja naciera con 48 columnas en vez de 26
 * —cada dato escrito dos veces— porque en la PRIMERA escritura el encabezado se
 * copiaba tal cual. Se quitan acá las repeticiones.
 */
function _asegurarEncabezado(hoja, columnas) {
  var pedidas = columnas.filter(function (c, i) { return columnas.indexOf(c) === i; });

  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, pedidas.length).setValues([pedidas]);
    hoja.getRange(1, 1, 1, pedidas.length).setFontWeight('bold');
    hoja.setFrozenRows(1);
    return pedidas.slice();
  }

  // Acá NO se quitan repeticiones: `actual` describe la hoja tal como está y las
  // filas se escriben por posición. Si una hoja quedó con columnas repetidas de
  // antes, se respeta su forma para no descuadrar lo ya escrito.
  var ancho = Math.max(hoja.getLastColumn(), 1);
  var actual = hoja.getRange(1, 1, 1, ancho).getValues()[0]
    .map(function (v) { return String(v).trim(); })
    .filter(function (v) { return v !== ''; });

  var faltantes = pedidas.filter(function (c) { return actual.indexOf(c) === -1; });
  if (faltantes.length) {
    hoja.getRange(1, actual.length + 1, 1, faltantes.length).setValues([faltantes]);
    hoja.getRange(1, actual.length + 1, 1, faltantes.length).setFontWeight('bold');
  }
  return actual.concat(faltantes);
}

function _eliminarPorRecordId(hoja, columnas, recordId) {
  var ultima = hoja.getLastRow();
  if (ultima <= 1) return;
  var columna = columnas.indexOf('record_id') + 1;
  if (columna <= 0) return;

  var valores = hoja.getRange(2, columna, ultima - 1, 1).getValues();
  // De abajo hacia arriba: borrar de arriba hacia abajo mueve las filas que
  // todavía faltan por revisar.
  for (var i = valores.length - 1; i >= 0; i--) {
    if (String(valores[i][0]) === String(recordId)) hoja.deleteRow(i + 2);
  }
}

function _hoja(planilla, nombre) {
  var hoja = planilla.getSheetByName(nombre);
  if (!hoja) hoja = planilla.insertSheet(nombre);
  return hoja;
}

// ---------------------------------------------------------------------------
// Referencias a columnas
// ---------------------------------------------------------------------------

function _colLetra(n) {
  var s = '';
  var x = n;
  while (x > 0) {
    var m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/**
 * Referencia a una columna abierta de la hoja de registros, calculada desde el
 * esquema y no escrita a mano: reordenar COLUMNAS no rompe las fórmulas.
 */
function _ref(campo) {
  var letra = _colLetra(COLUMNAS.indexOf(campo) + 1);
  return "'" + HOJA_REGISTROS + "'!" + letra + '2:' + letra;
}

/** Condición que deja fuera los registros dados de baja. */
function _soloVigentes() {
  return _ref('registro_activo') + ',TRUE';
}

// ---------------------------------------------------------------------------
// Hoja de costos
// ---------------------------------------------------------------------------

/**
 * Crea la hoja de parámetros económicos si falta y agrega las filas que no
 * estén, sin tocar jamás un valor ya escrito.
 *
 * Esto es lo que permite que los costos se llenen a mano: si el script
 * reescribiera la hoja en cada sincronización, el equipo perdería lo cargado y
 * no habría manera de darse cuenta.
 */
function _asegurarCostos(planilla) {
  var hoja = planilla.getSheetByName(HOJA_COSTOS);
  var nueva = !hoja;
  if (nueva) hoja = planilla.insertSheet(HOJA_COSTOS);

  _asegurarEncabezado(hoja, COLUMNAS_COSTOS);

  var claves = {};
  var ultima = hoja.getLastRow();
  if (ultima > 1) {
    hoja.getRange(2, 1, ultima - 1, 1).getValues().forEach(function (f) {
      if (f[0] !== '' && f[0] !== null) claves[String(f[0])] = true;
    });
  }

  var faltantes = PARAMETROS_COSTOS.filter(function (p) { return !claves[p[0]]; });
  faltantes.forEach(function (p) {
    var fila = hoja.getLastRow() + 1;
    // La tarifa por hora-hombre no se convierte a total del proyecto: no es un
    // monto del proyecto, es un precio unitario. Poner ahí una cifra igual al
    // valor invitaría a sumarla con los arriendos.
    var total = p[2] === 'Hora-hombre' ? '—' : _formulaTotalProyecto(fila);
    hoja.getRange(fila, 1, 1, COLUMNAS_COSTOS.length).setValues([[
      p[0], p[1], p[2], '', p[3], total, p[4]
    ]]);
  });

  if (nueva) {
    for (var i = 0; i < FILAS_EXTRAS; i++) {
      var fila = hoja.getLastRow() + 1;
      hoja.getRange(fila, 1, 1, COLUMNAS_COSTOS.length).setValues([[
        'extra_' + (i + 1), '', 'Extra', '', 'Total del proyecto', _formulaTotalProyecto(fila),
        'Escribe el concepto y el monto. Combustible, herramientas, fletes, imprevistos.'
      ]]);
    }
    hoja.getRange('A1').setNote(
      'Los valores de la columna «valor» se escriben a mano. El script crea las filas que falten, ' +
      'pero nunca sobreescribe un valor ya cargado.\n\n' +
      'Los indicadores económicos que salen de esta hoja están en prueba: conviene contrastarlos ' +
      'con los costos reales del proyecto antes de usarlos para decidir.'
    );
    hoja.setColumnWidth(2, 260);
    hoja.setColumnWidth(7, 380);
  }

  // Lista cerrada de periodicidades: escribir "mensual" en vez de "Por mes"
  // haría que la conversión devuelva cero sin avisar.
  var filasConDatos = Math.max(hoja.getLastRow() - 1, 1);
  var validacion = SpreadsheetApp.newDataValidation()
    .requireValueInList(PERIODICIDADES, true)
    .setAllowInvalid(false)
    .build();
  hoja.getRange(2, 5, filasConDatos, 1).setDataValidation(validacion);

  return hoja;
}

/**
 * Lleva el monto de una fila a total del proyecto según su periodicidad.
 * La conversión queda a la vista en la planilla, en vez de esconderse en un
 * indicador más abajo.
 */
function _formulaTotalProyecto(fila) {
  var meses = _mesesDelProyecto();
  return '=IF(D' + fila + '="","",' +
    'IF(E' + fila + '="Por día hábil",D' + fila + '*' + DIAS_HABILES_PLAN + ',' +
    'IF(E' + fila + '="Por mes",D' + fila + '*' + meses.toFixed(4) + ',D' + fila + ')))';
}

function _mesesDelProyecto() {
  var inicio = new Date(FECHA_INICIO + 'T00:00:00');
  var termino = new Date(FECHA_TERMINO + 'T00:00:00');
  var dias = Math.round((termino - inicio) / 86400000) + 1;
  return dias / 30.4375;
}

// ---------------------------------------------------------------------------
// Hoja KPI
// ---------------------------------------------------------------------------

function _asegurarKPI(planilla) {
  var hoja = _hoja(planilla, HOJA_KPI);
  // La versión vive en una celda escondida de la propia hoja: si alguien
  // duplica la planilla, la copia se lleva su versión y no se rehace de más.
  if (hoja.getLastRow() > 0 && hoja.getRange('N1').getValue() === KPI_VERSION) return false;

  _asegurarEncabezado(_hoja(planilla, HOJA_REGISTROS), COLUMNAS);
  hoja.clear();
  // clear() borra el contenido pero no los formatos: sin esto, al cambiar el
  // diseño entre versiones una celda hereda el formato de lo que había antes.
  hoja.clearFormats();
  _construirKPI(hoja);
  hoja.getRange('N1').setValue(KPI_VERSION);
  hoja.hideColumns(14);
  return true;
}

function _construirKPI(hoja) {
  // OJO CON EL IDIOMA DE LAS FÓRMULAS. Al escribirlas desde Apps Script hay que
  // usar la notación en inglés: separador coma, TRUE en vez de VERDADERO,
  // TODAY() en vez de HOY(). Google las traduce sola al mostrarlas en una
  // planilla en español. Escritas en español, la celda queda en #ERROR! y el
  // indicador simplemente no aparece.

  var NUM = '#,##0.0';
  var PCT = '0.0%';
  var ENT = '#,##0';
  var PESOS = '$#,##0';

  var filas = [];
  var formatos = [];
  var titulos = [];
  var cabeceras = [];

  var fila = function (v) { filas.push(v || []); return filas.length; };
  var seccion = function (t) { var r = fila([t]); titulos.push(r); return r; };
  var cabecera = function (v) { var r = fila(v); cabeceras.push(r); return r; };
  var fmt = function (r, c, f) { formatos.push({ r: r, c: c, f: f }); };

  var edtRef = _ref('codigo_edt');
  var activoRef = _ref('registro_activo');

  fila(['KPI · ' + NOMBRE_PROYECTO]);
  fila(['Se recalcula solo con cada registro que llega. No hace falta volver a correr el script.']);
  fila([]);

  // ---------- Calendario ----------
  seccion('PLAZO DEL PROYECTO');
  var cInicio = fila(['Inicio', FECHA_INICIO, '', 'Feriados']);
  fila(['Término', FECHA_TERMINO]);
  var cPlan = fila(['Días hábiles del plan', DIAS_HABILES_PLAN]);
  var cTranscurridos = fila(['Días hábiles transcurridos', '']);
  var cRestantes = fila(['Días hábiles restantes', '=MAX(0,B' + cPlan + '-B' + cTranscurridos + ')']);
  fila(['Avance esperado del plazo', '=IFERROR(B' + cTranscurridos + '/B' + cPlan + ',0)']);
  fmt(filas.length, 2, PCT);

  // Los feriados van en celdas y no dentro de la fórmula, para poder corregirlos
  // desde la planilla sin tocar el script.
  var filaFeriado = cInicio;
  FERIADOS.forEach(function (f, i) {
    filas[filaFeriado - 1 + i] = filas[filaFeriado - 1 + i] || [];
    while (filas[filaFeriado - 1 + i].length < 5) filas[filaFeriado - 1 + i].push('');
    filas[filaFeriado - 1 + i][4] = f;
  });
  var rangoFeriados = FERIADOS.length
    ? ',E' + filaFeriado + ':E' + (filaFeriado + FERIADOS.length - 1)
    : '';
  filas[cTranscurridos - 1][1] =
    '=IFERROR(NETWORKDAYS(DATEVALUE("' + FECHA_INICIO + '"),' +
    'MIN(TODAY(),DATEVALUE("' + FECHA_TERMINO + '"))' + rangoFeriados + '),0)';
  fila([]);

  // ---------- Avance ----------
  seccion('AVANCE POR ACTIVIDAD');
  cabecera(['EDT', 'Actividad', 'Unidad', 'Meta', 'Ejecutado', '% avance', 'Falta',
    'Registros', 'Días con registro', 'Último registro']);
  var a0 = filas.length + 1;
  ACTIVIDADES.forEach(function (a) {
    var r = filas.length + 1;
    var codigo = '"' + a.edt + '"';
    fila([
      a.edt, a.nombre, a.unidad,
      a.meta === null ? '' : a.meta,
      '=IFERROR(SUMIFS(' + _ref('cantidad_ejecutada') + ',' + edtRef + ',' + codigo + ',' + _soloVigentes() + '),0)',
      // Sin meta en la EDT no hay contra qué comparar: la celda queda vacía en
      // vez de mostrar un porcentaje inventado.
      a.meta === null ? '' : '=IFERROR(E' + r + '/D' + r + ',"")',
      a.meta === null ? '' : '=D' + r + '-E' + r,
      '=IFERROR(COUNTIFS(' + edtRef + ',' + codigo + ',' + _soloVigentes() + '),0)',
      // El caso "sin registros" se resuelve antes de contar: FILTER sobre un
      // rango sin coincidencias no siempre da error, y COUNTUNIQUE llega a
      // contar la celda vacia como un valor. Asi daba 1 dia con cero registros.
      '=IF(COUNTIFS(' + edtRef + ',' + codigo + ',' + _soloVigentes() + ')=0,0,' +
        'IFERROR(COUNTUNIQUE(FILTER(' + _ref('fecha') + ',' + edtRef + '=' + codigo + ',' +
        activoRef + '=TRUE)),0))',
      '=IF(COUNTIFS(' + edtRef + ',' + codigo + ',' + _soloVigentes() + ')=0,"—",' +
        'TEXT(MAXIFS(' + _ref('fecha') + ',' + edtRef + ',' + codigo + ',' + _soloVigentes() + '),"yyyy-mm-dd"))'
    ]);
    fmt(r, 4, ENT); fmt(r, 5, ENT); fmt(r, 6, PCT); fmt(r, 7, ENT); fmt(r, 8, ENT); fmt(r, 9, ENT);
  });
  var a1 = filas.length;
  fila(['', 'Las unidades no se suman entre actividades: zanjas, metros y asistentes se leen por separado.']);
  fila([]);

  // ---------- Horas-hombre ----------
  seccion('HORAS-HOMBRE Y ESFUERZO');
  cabecera(['EDT', 'Actividad', 'Horas-hombre', 'Duración total (h)', 'Unidades por HH',
    'HH por unidad', 'Dotación promedio', 'Jornada promedio (h)', 'HH estimadas para terminar']);
  var h0 = filas.length + 1;
  ACTIVIDADES.forEach(function (a, i) {
    var r = filas.length + 1;
    var codigo = '"' + a.edt + '"';
    var fEjecutado = 'E' + (a0 + i);
    var fFalta = 'G' + (a0 + i);
    fila([
      a.edt, a.nombre,
      '=IFERROR(SUMIFS(' + _ref('horas_hombre') + ',' + edtRef + ',' + codigo + ',' + _soloVigentes() + '),0)',
      '=IFERROR(SUMIFS(' + _ref('duracion_horas') + ',' + edtRef + ',' + codigo + ',' + _soloVigentes() + '),0)',
      '=IFERROR(' + fEjecutado + '/C' + r + ',"")',
      '=IFERROR(C' + r + '/' + fEjecutado + ',"")',
      '=IFERROR(AVERAGEIFS(' + _ref('cantidad_trabajadores') + ',' + edtRef + ',' + codigo + ',' + _soloVigentes() + '),"")',
      '=IFERROR(AVERAGEIFS(' + _ref('duracion_horas') + ',' + edtRef + ',' + codigo + ',' + _soloVigentes() + '),"")',
      a.meta === null ? '' : '=IFERROR(F' + r + '*' + fFalta + ',"")'
    ]);
    [3, 4, 5, 6, 7, 8, 9].forEach(function (c) { fmt(r, c, NUM); });
  });
  var h1 = filas.length;
  var hTotal = fila(['TOTAL', '', '=SUM(C' + h0 + ':C' + h1 + ')', '=SUM(D' + h0 + ':D' + h1 + ')',
    '', '', '', '', '=SUM(I' + h0 + ':I' + h1 + ')']);
  [3, 4, 9].forEach(function (c) { fmt(hTotal, c, NUM); });
  fila([]);

  // ---------- Ritmo contra la meta diaria ----------
  // La EDT no entrega un rendimiento por persona, entrega una meta total y un
  // plazo. La comparación honesta es entre ritmos diarios: lo que se está
  // logrando por día hábil contra lo que habría que lograr. Comparar el
  // rendimiento por persona contra la meta diaria mezclaría dos cosas distintas.
  seccion('RITMO DIARIO CONTRA EL PLAZO');
  cabecera(['EDT', 'Actividad', 'Meta diaria teórica', 'Ritmo real por día con registro',
    'Confiabilidad', 'Esperado a hoy', 'Desviación', 'Ritmo requerido restante', 'Estado']);
  ACTIVIDADES.forEach(function (a, i) {
    var r = filas.length + 1;
    var fMeta = 'D' + (a0 + i);
    var fEjecutado = 'E' + (a0 + i);
    var fDias = 'I' + (a0 + i);

    // Sin meta no se inventa una referencia: se informa el ritmo medido y punto.
    var estado = a.meta === null
      ? '=IF(' + fDias + '=0,"Sin registros todavía",' +
        'IF(' + fDias + '<' + DIAS_MIN_CONFIABLE + ',"⏳ Midiendo ritmo base",' +
        '"Ritmo base: "&TEXT(D' + r + ',"#,##0.0")&" por día"))'
      : '=IF(' + fDias + '=0,"Sin registros todavía",' +
        'IF(G' + r + '>=0,"✔ Al día o adelantado",' +
        // Cumplimiento = lo ejecutado sobre lo esperado a hoy. Con ejecutado en
        // cero da cero, que es justamente "atrasado" y no "levemente atrasado".
        'IF(IFERROR(' + fEjecutado + '/F' + r + ',0)>=' + UMBRAL_ALERTA + ',"⚠ Levemente atrasado","✖ Atrasado")))';

    fila([
      a.edt, a.nombre,
      a.meta === null ? '—' : '=IFERROR(' + fMeta + '/$B$' + cPlan + ',"")',
      '=IFERROR(' + fEjecutado + '/' + fDias + ',"")',
      '=IF(' + fDias + '=0,"—",IF(' + fDias + '>=' + DIAS_MIN_CONFIABLE + ',"Suficiente","Preliminar"))',
      a.meta === null ? '' : '=IFERROR(' + fMeta + '*$B$' + cTranscurridos + '/$B$' + cPlan + ',"")',
      a.meta === null ? '' : '=IFERROR(' + fEjecutado + '-F' + r + ',"")',
      a.meta === null ? '' : '=IFERROR(MAX(0,' + fMeta + '-' + fEjecutado + ')/MAX(1,$B$' + cRestantes + '),"")',
      estado
    ]);
    fmt(r, 3, NUM); fmt(r, 4, NUM); fmt(r, 6, ENT); fmt(r, 7, ENT); fmt(r, 8, NUM);
  });
  fila(['', 'Con menos de ' + DIAS_MIN_CONFIABLE + ' días con registro el ritmo es preliminar: ' +
    'un día de lluvia o un terreno duro lo mueven entero.']);
  fila(['', 'Las actividades sin meta en la EDT no muestran desviación ni ritmo requerido: no hay contra qué compararlas.']);
  fila([]);

  // ---------- Económico ----------
  seccion('COSTOS · EN PRUEBA');
  fila(['Los valores se cargan a mano en la hoja ' + HOJA_COSTOS +
    '. Mientras uno esté vacío, lo que dependa de él queda en blanco.']);
  fila(['Esta sección está en prueba: hay que contrastar sus números con los costos reales del ' +
    'proyecto antes de usarlos para decidir. El registro y los indicadores de avance y ' +
    'rendimiento, en cambio, ya son definitivos.']);

  var eCostoHH = fila(['Costo de la hora-hombre',
    '=IFERROR(VLOOKUP("costo_hh",' + HOJA_COSTOS + "!A:D,4,FALSE),\"\")"]);
  fmt(eCostoHH, 2, PESOS);

  var eHH = fila(['Horas-hombre acumuladas', '=C' + hTotal]);
  fmt(eHH, 2, NUM);

  var eMO = fila(['Costo de mano de obra a la fecha',
    '=IF(B' + eCostoHH + '="","",B' + eCostoHH + '*B' + eHH + ')']);
  fmt(eMO, 2, PESOS);

  var eIndirectos = fila(['Camioneta y baños · total del proyecto',
    '=IF(COUNTIFS(' + HOJA_COSTOS + '!C:C,"Indirecto",' + HOJA_COSTOS + '!D:D,"<>")=0,"",' +
    'IFERROR(SUMIF(' + HOJA_COSTOS + '!C:C,"Indirecto",' + HOJA_COSTOS + '!F:F),""))']);
  fmt(eIndirectos, 2, PESOS);

  var eIndDia = fila(['Camioneta y baños · por día hábil',
    '=IF(B' + eIndirectos + '="","",B' + eIndirectos + '/$B$' + cPlan + ')']);
  fmt(eIndDia, 2, PESOS);

  var eIndFecha = fila(['Camioneta y baños · a la fecha',
    '=IF(B' + eIndDia + '="","",B' + eIndDia + '*$B$' + cTranscurridos + ')']);
  fmt(eIndFecha, 2, PESOS);

  var eExtras = fila(['Costos extras cargados',
    '=IF(COUNTIFS(' + HOJA_COSTOS + '!C:C,"Extra",' + HOJA_COSTOS + '!D:D,"<>")=0,"",' +
    'IFERROR(SUMIF(' + HOJA_COSTOS + '!C:C,"Extra",' + HOJA_COSTOS + '!F:F),""))']);
  fmt(eExtras, 2, PESOS);

  var eTotal = fila(['Costo total a la fecha',
    '=IF(OR(B' + eMO + '="",B' + eIndFecha + '=""),"Faltan valores por cargar",' +
    'B' + eMO + '+B' + eIndFecha + '+IF(B' + eExtras + '="",0,B' + eExtras + '))']);
  fmt(eTotal, 2, PESOS);

  // Proyección: mantiene el ritmo de horas-hombre por día hábil ya observado.
  var eProy = fila(['Costo proyectado al término (estimación)',
    '=IF(OR(B' + eCostoHH + '="",B' + eIndirectos + '="",$B$' + cTranscurridos + '=0),"Faltan valores por cargar",' +
    'B' + eCostoHH + '*B' + eHH + '/$B$' + cTranscurridos + '*$B$' + cPlan + '+B' + eIndirectos +
    '+IF(B' + eExtras + '="",0,B' + eExtras + '))']);
  fmt(eProy, 2, PESOS);

  fila(['', 'La proyección supone que se mantiene el ritmo de horas-hombre por día hábil observado hasta hoy. Es una estimación, no un compromiso.']);
  fila([]);

  // ---------- Costo por unidad ----------
  seccion('COSTO POR UNIDAD EJECUTADA · EN PRUEBA');
  cabecera(['EDT', 'Actividad', 'Unidad', 'Ejecutado', 'Costo de mano de obra',
    'Costo unitario de mano de obra', 'Indirectos asignados', 'Costo unitario con indirectos']);
  ACTIVIDADES.forEach(function (a, i) {
    var r = filas.length + 1;
    var fEjecutado = 'E' + (a0 + i);
    var fHH = 'C' + (h0 + i);
    fila([
      a.edt, a.nombre, a.unidad, '=' + fEjecutado,
      '=IF($B$' + eCostoHH + '="","",$B$' + eCostoHH + '*' + fHH + ')',
      '=IFERROR(E' + r + '/D' + r + ',"")',
      // Reparto de los indirectos según la participación de la actividad en las
      // horas-hombre del proyecto.
      '=IF($B$' + eIndFecha + '="","",IFERROR($B$' + eIndFecha + '*' + fHH + '/$C$' + hTotal + ',""))',
      '=IFERROR((E' + r + '+G' + r + ')/D' + r + ',"")'
    ]);
    fmt(r, 4, ENT); fmt(r, 5, PESOS); fmt(r, 6, PESOS); fmt(r, 7, PESOS); fmt(r, 8, PESOS);
  });
  fila(['', 'El costo unitario de mano de obra es un dato duro: sale de las horas-hombre registradas por el valor de la hora.']);
  fila(['', 'El costo con indirectos es una estimación: reparte camioneta y baños según la participación de cada actividad en las horas-hombre.']);
  fila([]);

  // ---------- Tablas que crecen solas ----------
  // Van al final y en columnas separadas: dos QUERY que se expandieran sobre las
  // mismas celdas harían que Sheets bloquee la segunda.
  seccion('DETALLE (tablas que crecen solas con los datos)');
  cabecera(['Por sector', '', '', 'Por persona', '', '', 'Día a día']);
  fila([
    _query([_ref('sector'), _ref('cantidad_ejecutada'), _ref('horas_hombre')],
      "select Col1, sum(Col2), sum(Col3) where Col1 is not null and Col1 <> '' " +
      "group by Col1 order by sum(Col2) desc label Col1 'Sector', sum(Col2) 'Ejecutado', sum(Col3) 'HH'"),
    '', '',
    _query([_ref('persona_que_registra'), _ref('horas_hombre'), _ref('cantidad_ejecutada')],
      "select Col1, sum(Col2), sum(Col3) where Col1 is not null and Col1 <> '' " +
      "group by Col1 order by sum(Col2) desc label Col1 'Persona', sum(Col2) 'HH', sum(Col3) 'Ejecutado'"),
    '', '',
    _query([_ref('fecha'), _ref('codigo_edt'), _ref('cantidad_ejecutada'), _ref('horas_hombre')],
      "select Col1, Col2, sum(Col3), sum(Col4) where Col1 is not null group by Col1, Col2 " +
      "order by Col1 desc label Col1 'Fecha', Col2 'EDT', sum(Col3) 'Ejecutado', sum(Col4) 'HH'")
  ]);
  var filaDetalle = filas.length;

  // ---- Escritura ----
  var ancho = Math.max(14, filas.reduce(function (m, f) { return Math.max(m, f.length); }, 0));
  hoja.getRange(1, 1, filas.length, ancho).setValues(filas.map(function (f) {
    var c = f.slice();
    while (c.length < ancho) c.push('');
    return c;
  }));

  hoja.getRange('A1').setFontSize(14).setFontWeight('bold');
  hoja.getRange('A2').setFontColor('#666666');
  titulos.forEach(function (r) {
    hoja.getRange(r, 1, 1, ancho).setFontWeight('bold').setBackground('#1f6f4a').setFontColor('#ffffff');
  });
  cabeceras.forEach(function (r) {
    hoja.getRange(r, 1, 1, ancho).setFontWeight('bold').setBackground('#e6f2ec');
  });
  formatos.forEach(function (f) { hoja.getRange(f.r, f.c).setNumberFormat(f.f); });

  // La salida de QUERY no hereda formato: sin esto la fecha sale como número de
  // serie (46237 en vez de 2026-08-03).
  hoja.getRange(filaDetalle + 1, 7, 400, 1).setNumberFormat('yyyy-mm-dd');
  hoja.setColumnWidth(1, 70);
  hoja.setColumnWidth(2, 300);
  hoja.setColumnWidth(3, 200);
  hoja.setFrozenRows(2);
}

/** Arma un QUERY sobre varias columnas de la hoja de registros. */
function _query(columnas, consulta) {
  return '=IFERROR(QUERY({' + columnas.join(',') + '},"' + consulta + '",0),"Sin registros todavía")';
}

// Se exporta para poder ejecutar el script contra una planilla simulada en Node
// (pruebas/pruebas_apps_script.js). En Apps Script esta línea no hace nada.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    KPI_VERSION: KPI_VERSION,
    COLUMNAS: COLUMNAS,
    COLUMNAS_COSTOS: COLUMNAS_COSTOS,
    ACTIVIDADES: ACTIVIDADES,
    PARAMETROS_COSTOS: PARAMETROS_COSTOS,
    PERIODICIDADES: PERIODICIDADES,
    HOJA_REGISTROS: HOJA_REGISTROS,
    HOJA_KPI: HOJA_KPI,
    HOJA_COSTOS: HOJA_COSTOS,
    doPost: doPost,
    doGet: doGet,
    _registrar: _registrar,
    _asegurarEncabezado: _asegurarEncabezado,
    _asegurarCostos: _asegurarCostos,
    _asegurarKPI: _asegurarKPI,
    _colLetra: _colLetra,
    _ref: _ref
  };
}
