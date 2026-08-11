// Pruebas del Apps Script contra una planilla simulada.
//
//   node pruebas/pruebas_apps_script.js

const path = require('path');
const { prueba, afirmar, igual, ejecutar } = require('./ayuda');
const { cargarScript, letraDeColumna } = require('./simular_planilla');

const config = require(path.join(__dirname, '..', 'js', 'config-actividades.js'));

const HOJA_REGISTRO = '07_Registro_Actividad';
const HOJA_DETALLE = '08_Registro_Detalle';
const HOJA_COSTOS = '09_Costos_Parametros';
const HOJA_EDT = '01_EDT_Actividades';
const HOJA_INDICADORES = '10_Indicadores';

function envio(cambios) {
  return Object.assign(
    {
      version_app: '0.1.0-beta',
      proyecto_id: config.PROYECTO.proyecto_id,
      proyecto: config.PROYECTO,
      jornada: config.JORNADA,
      edt: config.ACTIVIDADES.map((a) => ({
        codigo: a.codigo,
        categoria: a.categoria,
        nombre: a.nombre,
        unidad_medida: a.unidad_medida,
        meta: a.meta,
        meta_texto: a.meta_texto,
        campo_cantidad_ejecutada: a.campo_cantidad_ejecutada,
        en_app: true,
      })).concat(
        config.ACTIVIDADES_FUERA_DE_APP.map((a) => ({
          codigo: a.codigo, categoria: a.categoria, nombre: a.nombre, en_app: false, motivo: a.motivo,
        }))
      ),
      registros: [],
      costos: null,
    },
    cambios || {}
  );
}

function registro(cambios) {
  return Object.assign(
    {
      record_id: 'aaaa-1111',
      fecha: '2026-08-12',
      persona_que_registra: 'Persona de prueba',
      sector: 'LAS_MERCEDES',
      codigo_edt: '2.1',
      actividad: 'Trazado y replanteo de zanjas',
      categoria: 'Conservación de suelos y aguas',
      cantidad_trabajadores: 8,
      hora_inicio: '08:00',
      hora_termino: '16:00',
      minutos_colacion: 30,
      duracion_horas: 7.5,
      horas_hombre: 60,
      cantidad_ejecutada: 45,
      unidad_medida: 'N° de zanjas marcadas',
      rendimiento_por_hh: 0.75,
      hh_por_unidad: 1.3333,
      observaciones: '',
      registro_activo: true,
      detalle: { cantidad_zanjas_marcadas: 45 },
    },
    cambios || {}
  );
}

// ---------------------------------------------------------------------------

prueba('ninguna hoja nace con columnas repetidas', () => {
  // La comprobacion afirma la propiedad que importa. Contar columnas no sirve:
  // una hoja con todo duplicado tambien "tiene columnas".
  const { api, planilla } = cargarScript();
  api.procesar(envio({ registros: [registro()] }));

  planilla.getSheets().forEach((hoja) => {
    const encabezado = hoja.encabezado().filter((c) => c !== '');
    const vistos = {};
    encabezado.forEach((columna) => {
      afirmar(
        !vistos[columna],
        'la hoja ' + hoja.getName() + ' repite la columna "' + columna + '"'
      );
      vistos[columna] = true;
    });
  });
});

prueba('se crean las hojas del modelo de datos', () => {
  const { api, planilla } = cargarScript();
  api.procesar(envio({ registros: [registro()] }));

  [HOJA_REGISTRO, HOJA_DETALLE, HOJA_COSTOS, HOJA_EDT, HOJA_INDICADORES].forEach((nombre) => {
    afirmar(!!planilla.getSheetByName(nombre), 'falta la hoja ' + nombre);
  });
});

prueba('un registro nuevo deja exactamente una fila', () => {
  const { api, planilla } = cargarScript();
  const resultado = api.procesar(envio({ registros: [registro()] }));

  igual(resultado.recibidos.length, 1);
  igual(planilla.getSheetByName(HOJA_REGISTRO).filasDeDatos().length, 1);
});

prueba('reenviar el mismo record_id actualiza la fila y no agrega otra', () => {
  // Regla 6 del modelo de datos: nunca se actualiza por posicion de fila.
  const { api, planilla } = cargarScript();
  api.procesar(envio({ registros: [registro()] }));
  api.procesar(envio({ registros: [registro({ cantidad_ejecutada: 70 })] }));

  const hoja = planilla.getSheetByName(HOJA_REGISTRO);
  const filas = hoja.filasDeDatos();
  igual(filas.length, 1, 'no puede haber dos filas para el mismo registro');

  const columna = api.COLUMNAS_REGISTRO.indexOf('cantidad_ejecutada');
  igual(filas[0][columna], 70, 'debe quedar el valor nuevo');
});

prueba('dos registros distintos conviven sin pisarse', () => {
  const { api, planilla } = cargarScript();
  api.procesar(envio({
    registros: [registro(), registro({ record_id: 'bbbb-2222', cantidad_ejecutada: 12 })],
  }));

  igual(planilla.getSheetByName(HOJA_REGISTRO).filasDeDatos().length, 2);
});

prueba('el detalle se reemplaza y no se acumula al reenviar', () => {
  const { api, planilla } = cargarScript();
  api.procesar(envio({ registros: [registro()] }));
  api.procesar(envio({ registros: [registro({ detalle: { cantidad_zanjas_marcadas: 70 } })] }));

  const filas = planilla.getSheetByName(HOJA_DETALLE).filasDeDatos();
  igual(filas.length, 1, 'el valor viejo y el nuevo no pueden convivir');

  const columnaValor = api.COLUMNAS_DETALLE.indexOf('valor_numero');
  igual(filas[0][columnaValor], 70);
});

prueba('el detalle de un registro no borra el de otro', () => {
  const { api, planilla } = cargarScript();
  api.procesar(envio({
    registros: [registro(), registro({ record_id: 'bbbb-2222', detalle: { cantidad_zanjas_marcadas: 12 } })],
  }));
  api.procesar(envio({ registros: [registro({ detalle: { cantidad_zanjas_marcadas: 99 } })] }));

  const filas = planilla.getSheetByName(HOJA_DETALLE).filasDeDatos();
  igual(filas.length, 2, 'el detalle del otro registro debe seguir ahi');
});

prueba('los parametros de texto van a valor_texto y los numeros a valor_numero', () => {
  const { api, planilla } = cargarScript();
  api.procesar(envio({
    registros: [registro({
      codigo_edt: '10.1',
      detalle: { cantidad_asistentes: 25, tipo_publico: 'Escuela básica' },
    })],
  }));

  const filas = planilla.getSheetByName(HOJA_DETALLE).filasDeDatos();
  const iCodigo = api.COLUMNAS_DETALLE.indexOf('codigo_parametro');
  const iNumero = api.COLUMNAS_DETALLE.indexOf('valor_numero');
  const iTexto = api.COLUMNAS_DETALLE.indexOf('valor_texto');

  const asistentes = filas.filter((f) => f[iCodigo] === 'cantidad_asistentes')[0];
  const publico = filas.filter((f) => f[iCodigo] === 'tipo_publico')[0];

  igual(asistentes[iNumero], 25);
  igual(asistentes[iTexto], '');
  igual(publico[iTexto], 'Escuela básica');
  igual(publico[iNumero], '');
});

prueba('los parametros vacios no generan filas de detalle', () => {
  const { api, planilla } = cargarScript();
  api.procesar(envio({
    registros: [registro({ detalle: { cantidad_zanjas_marcadas: 45, observacion_extra: '' } })],
  }));
  igual(planilla.getSheetByName(HOJA_DETALLE).filasDeDatos().length, 1);
});

prueba('una baja marca la fila como no vigente y se informa como baja', () => {
  const { api, planilla } = cargarScript();
  api.procesar(envio({ registros: [registro()] }));
  const resultado = api.procesar(envio({ registros: [registro({ registro_activo: false })] }));

  igual(resultado.bajas.length, 1, 'la baja tiene que informarse aparte');
  igual(resultado.recibidos.length, 0);

  const columna = api.COLUMNAS_REGISTRO.indexOf('registro_activo');
  igual(planilla.getSheetByName(HOJA_REGISTRO).filasDeDatos()[0][columna], false);
});

prueba('las formulas de indicadores apuntan a las columnas correctas', () => {
  // Esta es la comprobacion que evita el error silencioso mas caro de la hoja:
  // una formula que suma la columna equivocada entrega un numero creible.
  const { api, planilla } = cargarScript();
  api.procesar(envio({ registros: [registro()] }));

  const hoja = planilla.getSheetByName(HOJA_INDICADORES);
  const letraCantidad = letraDeColumna(api.COLUMNAS_REGISTRO.indexOf('cantidad_ejecutada') + 1);
  const letraHH = letraDeColumna(api.COLUMNAS_REGISTRO.indexOf('horas_hombre') + 1);
  const letraCodigo = letraDeColumna(api.COLUMNAS_REGISTRO.indexOf('codigo_edt') + 1);
  const letraActivo = letraDeColumna(api.COLUMNAS_REGISTRO.indexOf('registro_activo') + 1);

  const filas = hoja.filasDeDatos();
  const conFormula = filas.filter((f) => typeof f[4] === 'string' && f[4].indexOf('SUMIFS') !== -1);
  afirmar(conFormula.length > 0, 'no se escribio ninguna formula de suma');

  conFormula.forEach((fila) => {
    afirmar(
      fila[4].indexOf(HOJA_REGISTRO + '!' + letraCantidad + ':' + letraCantidad) !== -1,
      'la suma de lo ejecutado no apunta a la columna cantidad_ejecutada (' + letraCantidad + '): ' + fila[4]
    );
    afirmar(
      fila[5].indexOf(HOJA_REGISTRO + '!' + letraHH + ':' + letraHH) !== -1,
      'la suma de horas-hombre no apunta a la columna horas_hombre (' + letraHH + '): ' + fila[5]
    );
    afirmar(
      fila[4].indexOf(HOJA_REGISTRO + '!' + letraCodigo + ':' + letraCodigo) !== -1,
      'el filtro por actividad no apunta a codigo_edt (' + letraCodigo + ')'
    );
    afirmar(
      fila[4].indexOf(HOJA_REGISTRO + '!' + letraActivo + ':' + letraActivo + ',TRUE') !== -1,
      'la suma no excluye los registros dados de baja'
    );
  });
});

prueba('las formulas se escriben en notacion inglesa', () => {
  // Escritas en español quedan como #ERROR! en la celda y el indicador
  // simplemente no aparece, sin que nada lo advierta.
  const { api, planilla } = cargarScript();
  api.procesar(envio({ registros: [registro()] }));

  const hoja = planilla.getSheetByName(HOJA_INDICADORES);
  const formulas = [];
  hoja.datos.forEach((fila) => (fila || []).forEach((celda) => {
    if (typeof celda === 'string' && celda.charAt(0) === '=') formulas.push(celda);
  }));

  afirmar(formulas.length > 0, 'la hoja de indicadores no tiene formulas');
  formulas.forEach((f) => {
    afirmar(f.indexOf('VERDADERO') === -1, 'formula en español: ' + f);
    afirmar(f.indexOf('HOY(') === -1, 'formula en español: ' + f);
    afirmar(f.indexOf('SI.ERROR') === -1, 'formula en español: ' + f);
    afirmar(f.indexOf(';') === -1, 'separador de argumentos en español: ' + f);
  });
});

prueba('la hoja de indicadores solo lista actividades que se registran en la aplicacion', () => {
  const { api, planilla } = cargarScript();
  api.procesar(envio({ registros: [registro()] }));

  const filas = planilla.getSheetByName(HOJA_INDICADORES).filasDeDatos();
  const codigos = filas.map((f) => f[0]).filter((c) => /^\d+\.\d+$/.test(String(c)));

  igual(codigos.length, config.ACTIVIDADES.length);
  config.ACTIVIDADES_FUERA_DE_APP.forEach((a) => {
    afirmar(codigos.indexOf(a.codigo) === -1, 'la actividad ' + a.codigo + ' no debia aparecer');
  });
});

prueba('las actividades sin meta no muestran porcentaje de avance', () => {
  const { api, planilla } = cargarScript();
  api.procesar(envio({ registros: [registro()] }));

  const filas = planilla.getSheetByName(HOJA_INDICADORES).filasDeDatos();
  const sinMeta = filas.filter((f) => /^\d+\.\d+$/.test(String(f[0])) && f[3] === '');
  afirmar(sinMeta.length > 0, 'la EDT tiene actividades sin meta y deberian aparecer');
  sinMeta.forEach((f) => {
    igual(f[8], '', 'la actividad ' + f[0] + ' no puede tener porcentaje de avance');
  });
});

prueba('la EDT completa llega a la planilla, marcando cuales se registran en la aplicacion', () => {
  const { api, planilla } = cargarScript();
  api.procesar(envio({ registros: [registro()] }));

  const filas = planilla.getSheetByName(HOJA_EDT).filasDeDatos();
  igual(filas.length, 32, 'la EDT completa son 32 actividades');

  const columna = api.COLUMNAS_EDT.indexOf('se_registra_en_app');
  igual(filas.filter((f) => f[columna] === 'Sí').length, 11);
  igual(filas.filter((f) => f[columna] === 'No').length, 21);
});

prueba('los parametros economicos se guardan y no dejan restos de una carga anterior', () => {
  const { api, planilla } = cargarScript();
  api.procesar(envio({
    registros: [],
    costos: {
      costo_hh: 4000,
      camioneta_monto: 600000,
      camioneta_periodicidad: 'mes',
      banos_monto: 200000,
      banos_periodicidad: 'mes',
      extras: [{ concepto: 'Combustible', monto: 150000 }, { concepto: 'Fletes', monto: 90000 }],
    },
  }));
  igual(planilla.getSheetByName(HOJA_COSTOS).filasDeDatos().length, 5, 'tres fijos mas dos extras');

  api.procesar(envio({
    registros: [],
    costos: { costo_hh: 4500, camioneta_monto: null, banos_monto: null, extras: [] },
  }));

  const filas = planilla.getSheetByName(HOJA_COSTOS).filasDeDatos();
  igual(filas.length, 3, 'los extras eliminados en el telefono no pueden quedar vivos en la planilla');
  igual(filas[0][2], 4500);
});

prueba('el diseno de la planilla se rehace solo cuando cambia KPI_VERSION', () => {
  const { api, planilla, propiedades } = cargarScript();

  igual(api.asegurarEstructura(planilla, envio()), true, 'la primera vez arma todo');
  igual(propiedades.KPI_VERSION, api.KPI_VERSION);
  igual(api.asegurarEstructura(planilla, envio()), false, 'la segunda vez no rehace nada');

  propiedades.KPI_VERSION = '0.0.1-anterior';
  igual(api.asegurarEstructura(planilla, envio()), true, 'con otra version vuelve a armar');
});

prueba('una hoja con columnas duplicadas se rechaza al crearla', () => {
  const { api, planilla } = cargarScript();
  let fallo = false;
  try {
    api.asegurarHoja(planilla, 'hoja_de_prueba', ['a', 'b', 'a']);
  } catch (error) {
    fallo = true;
    afirmar(error.message.indexOf('dos veces') !== -1, 'el mensaje debe decir cual columna se repite');
  }
  afirmar(fallo, 'tenia que rechazar el encabezado duplicado');
});

prueba('las columnas de la planilla coinciden con lo que declara el modelo de datos', () => {
  const { api } = cargarScript();
  ['record_id', 'fecha', 'sector', 'codigo_edt', 'cantidad_ejecutada', 'horas_hombre',
   'duracion_horas', 'registro_activo'].forEach((columna) => {
    afirmar(api.COLUMNAS_REGISTRO.indexOf(columna) !== -1, 'falta la columna ' + columna);
  });
  ['detalle_id', 'record_id', 'codigo_parametro', 'valor_numero', 'valor_texto']
    .forEach((columna) => {
      afirmar(api.COLUMNAS_DETALLE.indexOf(columna) !== -1, 'falta la columna ' + columna);
    });
});

if (require.main === module) {
  process.exit(ejecutar('Apps Script sobre planilla simulada') > 0 ? 1 : 0);
}
