// Pruebas del Apps Script contra una planilla simulada.
//
// Aca vive todo el calculo del proyecto, asi que estas comprobaciones son las que
// cuidan los numeros que se miran para tomar decisiones.
//
//   node pruebas/pruebas_apps_script.js

const fs = require('fs');
const path = require('path');
const { prueba, afirmar, igual, ejecutar } = require('./ayuda');
const { cargarScript, letraDeColumna } = require('./simular_planilla');

const config = require(path.join(__dirname, '..', 'js', 'config-actividades.js'));
const RUTA_SCRIPT = path.join(__dirname, '..', 'apps-script', 'Codigo.gs');

function registro(cambios) {
  return Object.assign(
    {
      record_id: 'aaaa-1111',
      proyecto_id: 'FCH_MARIA_PINTO',
      nombre_proyecto: 'Fundación Chile - María Pinto',
      codigo_edt: '2.1',
      actividad: 'Trazado y replanteo de zanjas',
      categoria: 'Conservación de suelos y aguas',
      unidad_medida: 'N° de zanjas marcadas',
      meta_vigente: 1800,
      fecha: '2026-08-12',
      persona_que_registra: 'Persona de prueba',
      sector: 'Las Mercedes',
      cantidad_trabajadores: 8,
      hora_inicio: '08:00',
      hora_termino: '16:00',
      minutos_colacion: 30,
      duracion_horas: 7.5,
      horas_hombre: 60,
      cantidad_ejecutada: 45,
      rendimiento_por_hh: 0.75,
      rendimiento_por_jornada: 5.625,
      observaciones: '',
      registro_activo: true,
      cantidad_zanjas_marcadas: 45,
    },
    cambios || {}
  );
}

function enviar(api, reg, tipo) {
  const respuesta = api.doPost({
    parameter: {
      data: JSON.stringify({
        tipo: tipo === undefined ? 'registro_fundacion_chile' : tipo,
        version_app: '0.1.0-beta',
        record_id: reg.record_id,
        registro: reg,
      }),
    },
  });
  return JSON.parse(respuesta.getContent());
}

function hojas(entorno) {
  const api = entorno.api;
  return {
    registros: entorno.planilla.getSheetByName(api.HOJA_REGISTROS),
    kpi: entorno.planilla.getSheetByName(api.HOJA_KPI),
    costos: entorno.planilla.getSheetByName(api.HOJA_COSTOS),
  };
}

// ---------------------------------------------------------------------------
// Escritura de registros
// ---------------------------------------------------------------------------

prueba('un registro nuevo deja exactamente una fila y crea las tres hojas', () => {
  const entorno = cargarScript();
  const resultado = enviar(entorno.api, registro());

  igual(resultado.estado, 'ok');
  afirmar(!resultado.error_indicadores, 'las hojas calculadas fallaron: ' + resultado.error_indicadores);

  const h = hojas(entorno);
  afirmar(!!h.registros && !!h.kpi && !!h.costos, 'falta alguna hoja');
  igual(h.registros.filasDeDatos().length, 1);
});

prueba('la hoja de registros NO nace con las columnas repetidas', () => {
  // Este es el error exacto del proyecto hermano: la hoja nacia con 48 columnas
  // en vez de 26, cada dato escrito dos veces, porque en la primera escritura el
  // encabezado se copiaba con repeticiones. Contar columnas no basta; lo que hay
  // que afirmar es que ninguna se repite.
  const entorno = cargarScript();
  enviar(entorno.api, registro());

  entorno.planilla.getSheets().forEach((hoja) => {
    const vistos = {};
    hoja.encabezado().filter((c) => c !== '').forEach((columna) => {
      afirmar(!vistos[columna], 'la hoja ' + hoja.getName() + ' repite la columna "' + columna + '"');
      vistos[columna] = true;
    });
  });
});

prueba('el ancho de la hoja de registros es el esperado, sin columnas de mas', () => {
  const entorno = cargarScript();
  enviar(entorno.api, registro());

  const encabezado = hojas(entorno).registros.encabezado();
  // Las columnas base mas el unico campo propio de esta actividad.
  igual(encabezado.length, entorno.api.COLUMNAS.length + 1);
  igual(encabezado[encabezado.length - 1], 'cantidad_zanjas_marcadas');
});

prueba('reenviar el mismo record_id actualiza la fila y no agrega otra', () => {
  const entorno = cargarScript();
  enviar(entorno.api, registro());
  enviar(entorno.api, registro({ cantidad_ejecutada: 70 }));

  const filas = hojas(entorno).registros.filasDeDatos();
  igual(filas.length, 1, 'no puede haber dos filas para el mismo registro');
  igual(filas[0][entorno.api.COLUMNAS.indexOf('cantidad_ejecutada')], 70, 'debe quedar el valor nuevo');
});

prueba('dos registros distintos conviven sin pisarse', () => {
  const entorno = cargarScript();
  enviar(entorno.api, registro());
  enviar(entorno.api, registro({ record_id: 'bbbb-2222', cantidad_ejecutada: 12 }));

  igual(hojas(entorno).registros.filasDeDatos().length, 2);
});

prueba('una actividad con un campo propio nuevo agrega su columna al final', () => {
  const entorno = cargarScript();
  enviar(entorno.api, registro());
  enviar(entorno.api, registro({
    record_id: 'cccc-3333',
    codigo_edt: '10.1',
    cantidad_asistentes: 25,
    tipo_publico: 'Escuela básica',
  }));

  const h = hojas(entorno);
  const encabezado = h.registros.encabezado();
  afirmar(encabezado.indexOf('cantidad_asistentes') !== -1, 'falta la columna nueva');
  afirmar(encabezado.indexOf('tipo_publico') !== -1, 'falta la columna nueva');

  // La fila que ya estaba escrita no se descuadra.
  const filas = h.registros.filasDeDatos();
  const primera = filas.filter((f) => f[entorno.api.COLUMNAS.indexOf('record_id')] === 'aaaa-1111')[0];
  igual(primera[entorno.api.COLUMNAS.indexOf('cantidad_ejecutada')], 45);
});

prueba('una baja queda marcada como no vigente y se informa', () => {
  const entorno = cargarScript();
  enviar(entorno.api, registro());
  const resultado = enviar(entorno.api, registro({ registro_activo: false }));

  igual(resultado.dado_de_baja, true);
  const filas = hojas(entorno).registros.filasDeDatos();
  igual(filas.length, 1);
  igual(filas[0][entorno.api.COLUMNAS.indexOf('registro_activo')], false);
  igual(filas[0][entorno.api.COLUMNAS.indexOf('estado_sincronizacion')], 'Dado de baja');
});

prueba('la fecha se escribe como fecha y no como texto', () => {
  // Guardada como texto, ordenar y agrupar por fecha en la planilla no funciona.
  const entorno = cargarScript();
  enviar(entorno.api, registro());
  const valor = hojas(entorno).registros.filasDeDatos()[0][entorno.api.COLUMNAS.indexOf('fecha')];
  // `instanceof Date` no sirve: el script corre en un contexto aislado y su Date
  // no es el mismo objeto que el de estas pruebas.
  afirmar(
    Object.prototype.toString.call(valor) === '[object Date]',
    'la fecha quedo como ' + Object.prototype.toString.call(valor)
  );
});

prueba('un envio de otro tipo se rechaza sin escribir nada', () => {
  const entorno = cargarScript();
  const resultado = enviar(entorno.api, registro(), 'replante');

  igual(resultado.estado, 'error');
  afirmar(/replante/.test(resultado.mensaje), 'el mensaje debe decir que tipo llego');
  afirmar(!entorno.planilla.getSheetByName(entorno.api.HOJA_REGISTROS), 'no debio crear la hoja');
});

prueba('sin identificador de planilla configurado, el script se niega y lo dice', () => {
  const entorno = cargarScript({ idPlanilla: null });
  const resultado = enviar(entorno.api, registro());

  igual(resultado.estado, 'error');
  afirmar(/ID_PLANILLA/.test(resultado.mensaje), resultado.mensaje);
});

prueba('el bloqueo se suelta siempre, incluso cuando el envio se rechaza', () => {
  // Si el bloqueo no se soltara, la siguiente sincronizacion esperaria 30
  // segundos y terminaria fallando, sin ninguna pista de por que.
  const entorno = cargarScript();
  enviar(entorno.api, registro());
  enviar(entorno.api, registro(), 'otro_tipo');
  entorno.api.doPost({ parameter: { data: 'esto no es json' } });

  igual(entorno.bloqueos.tomados, 3);
  igual(entorno.bloqueos.soltados, 3, 'se tomo el bloqueo mas veces de las que se solto');
});

prueba('si las hojas calculadas fallan, el registro igual queda escrito', () => {
  // El KPI es accesorio. Si un fallo suyo diera el envio por fallido, el telefono
  // reintentaria y el equipo creeria que perdio datos.
  const entorno = cargarScript();
  entorno.contexto._asegurarKPI = function () { throw new Error('falla simulada'); };

  const resultado = enviar(entorno.api, registro());
  igual(resultado.estado, 'ok');
  afirmar(/falla simulada/.test(resultado.error_indicadores || ''), 'debe informar el problema del KPI');
  igual(hojas(entorno).registros.filasDeDatos().length, 1, 'el registro tenia que quedar escrito');
});

// ---------------------------------------------------------------------------
// Hoja de costos
// ---------------------------------------------------------------------------

prueba('la hoja de costos nace con los parametros por llenar y filas para extras', () => {
  const entorno = cargarScript();
  enviar(entorno.api, registro());

  const filas = hojas(entorno).costos.filasDeDatos();
  const claves = filas.map((f) => f[0]);
  ['costo_hh', 'camioneta', 'banos'].forEach((clave) => {
    afirmar(claves.indexOf(clave) !== -1, 'falta el parametro ' + clave);
  });
  afirmar(claves.filter((c) => /^extra_/.test(c)).length >= 5, 'faltan filas para costos extras');

  // Nacen vacias: el script ofrece dónde escribir, no inventa montos.
  const costoHH = filas.filter((f) => f[0] === 'costo_hh')[0];
  igual(costoHH[3], '', 'el valor tiene que nacer vacio');
});

prueba('sincronizar de nuevo NO borra los costos escritos a mano', () => {
  // Esta es la comprobacion que hace posible que los costos se llenen en la
  // planilla. Si el script reescribiera la hoja en cada sincronizacion, el equipo
  // perderia lo cargado y no habria forma de notarlo hasta mirar un indicador raro.
  const entorno = cargarScript();
  enviar(entorno.api, registro());

  const costos = hojas(entorno).costos;
  const filaCostoHH = costos.filasDeDatos().findIndex((f) => f[0] === 'costo_hh') + 2;
  costos.getRange(filaCostoHH, 4).setValue(4000);
  costos.getRange(filaCostoHH, 7).setValue('Anotado por el administrador');

  enviar(entorno.api, registro({ record_id: 'bbbb-2222' }));
  enviar(entorno.api, registro({ record_id: 'cccc-3333' }));

  igual(costos.getRange(filaCostoHH, 4).getValue(), 4000, 'se perdio el valor cargado a mano');
  igual(costos.getRange(filaCostoHH, 7).getValue(), 'Anotado por el administrador');
});

prueba('un parametro de costos que falte se agrega sin tocar los que ya estan', () => {
  const entorno = cargarScript();
  enviar(entorno.api, registro());

  const costos = hojas(entorno).costos;
  const antes = costos.filasDeDatos().length;

  // Se simula una planilla creada con una version anterior, a la que le falta un
  // parametro nuevo.
  const filaBanos = costos.filasDeDatos().findIndex((f) => f[0] === 'banos') + 2;
  costos.deleteRow(filaBanos);
  entorno.api._asegurarCostos(entorno.planilla);

  const claves = costos.filasDeDatos().map((f) => f[0]);
  afirmar(claves.indexOf('banos') !== -1, 'el parametro que faltaba tenia que volver');
  igual(costos.filasDeDatos().length, antes, 'no debe duplicar filas');
});

prueba('la periodicidad es una lista cerrada', () => {
  // Escribir "mensual" en vez de "Por mes" haria que la conversion devuelva el
  // monto sin convertir, sin avisar de nada.
  const entorno = cargarScript();
  enviar(entorno.api, registro());

  const validaciones = hojas(entorno).costos.validaciones;
  afirmar(validaciones.length > 0, 'no se puso validacion en la columna periodicidad');
  const regla = validaciones[validaciones.length - 1].regla;
  igual(regla.permiteInvalido, false);
  entorno.api.PERIODICIDADES.forEach((p) => {
    afirmar(regla.valores.indexOf(p) !== -1, 'falta la periodicidad ' + p);
  });
});

prueba('la conversion a total del proyecto cubre las tres periodicidades', () => {
  const entorno = cargarScript();
  enviar(entorno.api, registro());

  const camioneta = hojas(entorno).costos.filasDeDatos().filter((f) => f[0] === 'camioneta')[0];
  const formula = String(camioneta[5]);
  afirmar(/Por día hábil/.test(formula), 'falta el caso por dia habil');
  afirmar(/Por mes/.test(formula), 'falta el caso por mes');
  afirmar(/\*36/.test(formula), 'el caso por dia habil debe multiplicar por los dias del plan');

  // La tarifa por hora-hombre no es un monto del proyecto y no se convierte.
  const costoHH = hojas(entorno).costos.filasDeDatos().filter((f) => f[0] === 'costo_hh')[0];
  igual(costoHH[5], '—', 'la tarifa por hora no puede mostrar un total del proyecto');
});

// ---------------------------------------------------------------------------
// Hoja KPI
// ---------------------------------------------------------------------------

prueba('las formulas del KPI apuntan a las columnas correctas', () => {
  // Es la comprobacion que evita el error silencioso mas caro de la planilla: una
  // formula que suma la columna equivocada entrega un numero perfectamente creible.
  const entorno = cargarScript();
  enviar(entorno.api, registro());

  const COLUMNAS = entorno.api.COLUMNAS;
  const letra = (campo) => letraDeColumna(COLUMNAS.indexOf(campo) + 1);
  const hoja = entorno.api.HOJA_REGISTROS;

  const formulas = hojas(entorno).kpi.formulas();
  afirmar(formulas.length > 0, 'la hoja KPI no tiene formulas');

  // Las referencias son abiertas: de la fila 2 hacia abajo, para que crezcan solas.
  const referencia = (campo) => "'" + hoja + "'!" + letra(campo) + '2:' + letra(campo);

  const conCantidad = formulas.filter((f) => f.indexOf(referencia('cantidad_ejecutada')) !== -1);
  const conHH = formulas.filter((f) => f.indexOf(referencia('horas_hombre')) !== -1);
  const conCodigo = formulas.filter((f) => f.indexOf(referencia('codigo_edt')) !== -1);

  afirmar(conCantidad.length >= 11,
    'las sumas de lo ejecutado no apuntan a cantidad_ejecutada (' + letra('cantidad_ejecutada') + ')');
  afirmar(conHH.length >= 11,
    'las sumas de horas-hombre no apuntan a horas_hombre (' + letra('horas_hombre') + ')');
  afirmar(conCodigo.length >= 11,
    'el filtro por actividad no apunta a codigo_edt (' + letra('codigo_edt') + ')');
});

prueba('ninguna suma del KPI incluye los registros dados de baja', () => {
  const entorno = cargarScript();
  enviar(entorno.api, registro());

  const letraActivo = letraDeColumna(entorno.api.COLUMNAS.indexOf('registro_activo') + 1);
  const marca = "'" + entorno.api.HOJA_REGISTROS + "'!" + letraActivo + '2:' + letraActivo;

  const sumas = hojas(entorno).kpi.formulas().filter((f) => /SUMIFS|COUNTIFS|AVERAGEIFS|MAXIFS/.test(f));
  afirmar(sumas.length > 0, 'no hay sumas en el KPI');
  sumas.forEach((f) => {
    afirmar(f.indexOf(marca + ',TRUE') !== -1, 'esta formula sumaria registros dados de baja: ' + f);
  });
});

prueba('las formulas se escriben en notacion inglesa', () => {
  // Escritas en español quedan como #ERROR! en la celda y el indicador
  // simplemente no aparece, sin que nada lo advierta.
  const entorno = cargarScript();
  enviar(entorno.api, registro());

  const formulas = hojas(entorno).kpi.formulas().concat(hojas(entorno).costos.formulas());
  afirmar(formulas.length > 0, 'no hay formulas que revisar');
  formulas.forEach((f) => {
    ['VERDADERO', 'FALSO', 'HOY(', 'SI.ERROR', 'SUMAR.SI', 'CONTAR.SI', 'PROMEDIO.SI'].forEach((palabra) => {
      afirmar(f.indexOf(palabra) === -1, 'formula en español (' + palabra + '): ' + f);
    });
  });
});

prueba('el KPI lista las 11 actividades de la aplicacion y ninguna otra', () => {
  const entorno = cargarScript();
  enviar(entorno.api, registro());

  const codigos = {};
  hojas(entorno).kpi.datos.forEach((fila) => {
    if (fila && /^\d+\.\d+$/.test(String(fila[0]))) codigos[String(fila[0])] = true;
  });

  igual(Object.keys(codigos).length, config.ACTIVIDADES.length);
  config.ACTIVIDADES_FUERA_DE_APP.forEach((a) => {
    afirmar(!codigos[a.codigo], 'la actividad ' + a.codigo + ' no debia aparecer en el KPI');
  });
});

prueba('las actividades sin meta no muestran porcentaje ni desviacion', () => {
  const entorno = cargarScript();
  enviar(entorno.api, registro());

  // En la seccion de avance: columna D meta, F % avance, G falta.
  const filas = hojas(entorno).kpi.datos.filter((f) => f && /^\d+\.\d+$/.test(String(f[0])));
  const sinMeta = filas.filter((f) => f[2] && f[3] === '');
  afirmar(sinMeta.length > 0, 'la EDT tiene actividades sin meta y deberian aparecer');
  sinMeta.forEach((f) => {
    igual(f[5], '', 'la actividad ' + f[0] + ' no puede tener porcentaje de avance');
  });
});

prueba('el KPI solo se rehace cuando cambia KPI_VERSION', () => {
  const entorno = cargarScript();
  enviar(entorno.api, registro());

  igual(entorno.api._asegurarKPI(entorno.planilla), false, 'no debe rehacerse en cada sincronizacion');

  hojas(entorno).kpi.getRange('N1').setValue('0.0.1-anterior');
  igual(entorno.api._asegurarKPI(entorno.planilla), true, 'con otra version tiene que rehacerse');
  igual(hojas(entorno).kpi.getRange('N1').getValue(), entorno.api.KPI_VERSION);
});

prueba('el calendario del KPI usa el plazo y los feriados del proyecto', () => {
  const entorno = cargarScript();
  enviar(entorno.api, registro());

  const kpi = hojas(entorno).kpi;
  const texto = kpi.datos.map((f) => (f || []).join(' ')).join('\n');
  afirmar(texto.indexOf('2026-08-11') !== -1, 'falta la fecha de inicio');
  afirmar(texto.indexOf('2026-10-01') !== -1, 'falta la fecha de termino');
  afirmar(texto.indexOf('2026-09-17') !== -1, 'faltan los feriados en celdas');

  const habiles = kpi.formulas().filter((f) => f.indexOf('NETWORKDAYS') !== -1);
  igual(habiles.length, 1, 'debe haber una formula de dias habiles transcurridos');
  afirmar(/E\d+:E\d+/.test(habiles[0]), 'los feriados deben ir por referencia a celdas, no dentro de la formula');
});

prueba('el costo por unidad separa el dato duro de la estimacion', () => {
  const entorno = cargarScript();
  enviar(entorno.api, registro());

  const texto = hojas(entorno).kpi.datos.map((f) => (f || []).join(' ')).join('\n');
  afirmar(/dato duro/.test(texto), 'falta decir cual es el dato duro');
  afirmar(/estimación/.test(texto), 'falta decir cual es la estimacion');
  afirmar(/COSTO POR UNIDAD EJECUTADA/.test(texto), 'falta la seccion de costo por unidad');
});

prueba('el KPI no da un costo total cuando faltan valores por cargar', () => {
  const entorno = cargarScript();
  enviar(entorno.api, registro());

  const formulas = hojas(entorno).kpi.formulas();
  const totales = formulas.filter((f) => /Faltan valores por cargar/.test(f));
  afirmar(totales.length >= 2, 'el costo total y la proyeccion deben decir que faltan valores');
});

// ---------------------------------------------------------------------------
// El script y la EDT no pueden separarse
// ---------------------------------------------------------------------------

prueba('las actividades del Apps Script son exactamente las de la aplicacion', () => {
  // Si las dos listas se separan, la hoja KPI muestra actividades que el
  // formulario ya no ofrece, o deja fuera una que si se esta registrando.
  const entorno = cargarScript();
  const enScript = entorno.api.ACTIVIDADES;

  igual(enScript.length, config.ACTIVIDADES.length);
  config.ACTIVIDADES.forEach((a, i) => {
    igual(enScript[i].edt, a.codigo, 'orden o codigo distinto en la posicion ' + i);
    igual(enScript[i].nombre, a.nombre, 'nombre distinto para ' + a.codigo);
    igual(enScript[i].unidad, a.unidad_medida, 'unidad distinta para ' + a.codigo);
    igual(enScript[i].meta, a.meta === null ? null : a.meta, 'meta distinta para ' + a.codigo);
  });
});

prueba('el calendario y la jornada del Apps Script coinciden con la EDT', () => {
  const texto = fs.readFileSync(RUTA_SCRIPT, 'utf8');
  const valor = (nombre) => (texto.match(new RegExp('var ' + nombre + " = '?([^;']+)'?;")) || [])[1];

  igual(valor('FECHA_INICIO'), config.PROYECTO.fecha_inicio);
  igual(valor('FECHA_TERMINO'), config.PROYECTO.fecha_termino);
  igual(Number(valor('DIAS_HABILES_PLAN')), config.PROYECTO.dias_habiles_plan);
  igual(Number(valor('HORAS_JORNADA')), 7.5, 'la jornada efectiva del proyecto');

  config.PROYECTO.feriados.forEach((f) => {
    afirmar(texto.indexOf("'" + f + "'") !== -1, 'el script no conoce el feriado ' + f);
  });
});

prueba('las columnas que envia la aplicacion existen todas en la planilla', () => {
  // Un campo que la aplicacion envie y el script no conozca igual llegaria, pero
  // como columna agregada al final y fuera del orden previsto.
  const entorno = cargarScript();
  const Sincronizacion = require(path.join(__dirname, '..', 'js', 'sincronizacion.js'));

  Sincronizacion.CAMPOS.forEach((campo) => {
    afirmar(
      entorno.api.COLUMNAS.indexOf(campo) !== -1,
      'la aplicacion envia "' + campo + '" y el script no lo tiene entre sus columnas base'
    );
  });
});

if (require.main === module) {
  process.exit(ejecutar('Apps Script sobre planilla simulada') > 0 ? 1 : 0);
}
