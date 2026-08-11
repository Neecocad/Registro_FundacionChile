// Planilla de Google simulada, suficiente para ejecutar apps-script/Codigo.gs en
// Node.
//
// Existe porque el Apps Script no se puede ejecutar localmente y probarlo "a
// ojo" contra la planilla real significa ensuciar datos de verdad. Aca se
// reproduce solo lo que el script usa: hojas, rangos, propiedades del documento.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function celdaVacia(valor) {
  return valor === '' || valor === null || valor === undefined;
}

/** Letra de columna a numero: 'A' -> 1, 'N' -> 14. */
function numeroDeColumna(letras) {
  let n = 0;
  for (let i = 0; i < letras.length; i++) {
    n = n * 26 + (letras.charCodeAt(i) - 64);
  }
  return n;
}

/** 'N1' o 'A1:C4' a los cuatro numeros que usa getRange. */
function rangoDeA1(texto) {
  const partes = String(texto).toUpperCase().split(':');
  const inicio = partes[0].match(/^([A-Z]+)(\d+)$/);
  if (!inicio) throw new Error('Referencia no reconocida: ' + texto);

  const columna = numeroDeColumna(inicio[1]);
  const fila = Number(inicio[2]);
  if (partes.length === 1) return [fila, columna, 1, 1];

  const fin = partes[1].match(/^([A-Z]+)(\d+)$/);
  if (!fin) throw new Error('Referencia no reconocida: ' + texto);
  return [fila, columna, Number(fin[2]) - fila + 1, numeroDeColumna(fin[1]) - columna + 1];
}

class Rango {
  constructor(hoja, fila, columna, numFilas, numColumnas) {
    this.hoja = hoja;
    this.fila = fila;
    this.columna = columna;
    this.numFilas = numFilas;
    this.numColumnas = numColumnas;
  }

  getValues() {
    const salida = [];
    for (let f = 0; f < this.numFilas; f++) {
      const fila = [];
      for (let c = 0; c < this.numColumnas; c++) {
        fila.push(this.hoja.leerCelda(this.fila + f, this.columna + c));
      }
      salida.push(fila);
    }
    return salida;
  }

  setValues(valores) {
    if (valores.length !== this.numFilas) {
      throw new Error(
        'setValues recibio ' + valores.length + ' filas y el rango tiene ' + this.numFilas + '.'
      );
    }
    valores.forEach((fila, f) => {
      if (fila.length !== this.numColumnas) {
        throw new Error(
          'setValues recibio ' + fila.length + ' columnas y el rango tiene ' + this.numColumnas + '.'
        );
      }
      fila.forEach((valor, c) => this.hoja.escribirCelda(this.fila + f, this.columna + c, valor));
    });
    return this;
  }

  setValue(valor) {
    this.hoja.escribirCelda(this.fila, this.columna, valor);
    return this;
  }

  getValue() {
    return this.hoja.leerCelda(this.fila, this.columna);
  }

  clearContent() {
    for (let f = 0; f < this.numFilas; f++) {
      for (let c = 0; c < this.numColumnas; c++) {
        this.hoja.escribirCelda(this.fila + f, this.columna + c, '');
      }
    }
    return this;
  }

  // Los metodos de formato no hacen nada: lo que se comprueba es el contenido y
  // las formulas, no como se ven. Devuelven `this` para poder encadenarlos igual
  // que en Apps Script.
  setFontWeight() { return this; }
  setNumberFormat() { return this; }
  setFontSize() { return this; }
  setFontColor() { return this; }
  setBackground() { return this; }
  setNote(nota) { this.hoja.notas.push(nota); return this; }
  setDataValidation(v) {
    this.hoja.validaciones.push({ fila: this.fila, columna: this.columna, filas: this.numFilas, regla: v });
    return this;
  }
}

class Hoja {
  constructor(nombre) {
    this.nombre = nombre;
    this.datos = []; // filas de arreglos, base 0
    this.filasCongeladas = 0;
    this.notas = [];
    this.validaciones = [];
    this.columnasOcultas = [];
  }

  getName() { return this.nombre; }

  leerCelda(fila, columna) {
    const f = this.datos[fila - 1];
    if (!f) return '';
    const v = f[columna - 1];
    return v === undefined ? '' : v;
  }

  escribirCelda(fila, columna, valor) {
    while (this.datos.length < fila) this.datos.push([]);
    const f = this.datos[fila - 1];
    while (f.length < columna) f.push('');
    f[columna - 1] = valor;
  }

  getLastRow() {
    for (let i = this.datos.length - 1; i >= 0; i--) {
      if ((this.datos[i] || []).some((v) => !celdaVacia(v))) return i + 1;
    }
    return 0;
  }

  getLastColumn() {
    let maximo = 0;
    this.datos.forEach((fila) => {
      for (let c = (fila || []).length - 1; c >= 0; c--) {
        if (!celdaVacia(fila[c])) { maximo = Math.max(maximo, c + 1); break; }
      }
    });
    return maximo;
  }

  getRange(fila, columna, numFilas, numColumnas) {
    // Apps Script admite las dos formas: getRange(2, 1, 10, 3) y getRange('A1').
    if (typeof fila === 'string') return this.getRange.apply(this, rangoDeA1(fila));
    return new Rango(this, fila, columna, numFilas === undefined ? 1 : numFilas,
      numColumnas === undefined ? 1 : numColumnas);
  }

  appendRow(fila) {
    const destino = this.getLastRow() + 1;
    fila.forEach((valor, c) => this.escribirCelda(destino, c + 1, valor));
    return this;
  }

  deleteRow(fila) {
    this.datos.splice(fila - 1, 1);
    return this;
  }

  clear() {
    this.datos = [];
    return this;
  }

  clearFormats() { return this; }
  hideColumns(n) { this.columnasOcultas.push(n); return this; }
  setColumnWidth() { return this; }
  setFrozenRows(n) { this.filasCongeladas = n; return this; }

  /** Todas las formulas escritas en la hoja, para poder revisarlas. */
  formulas() {
    const salida = [];
    this.datos.forEach((fila) => (fila || []).forEach((celda) => {
      if (typeof celda === 'string' && celda.charAt(0) === '=') salida.push(celda);
    }));
    return salida;
  }

  /** Filas con contenido, sin el encabezado. Solo para las comprobaciones. */
  filasDeDatos() {
    const ultima = this.getLastRow();
    if (ultima < 2) return [];
    return this.getRange(2, 1, ultima - 1, Math.max(this.getLastColumn(), 1)).getValues();
  }

  encabezado() {
    const columnas = this.getLastColumn();
    return columnas ? this.getRange(1, 1, 1, columnas).getValues()[0] : [];
  }
}

class Planilla {
  constructor(nombre) {
    this.hojas = [];
    this.nombre = nombre || 'Planilla simulada';
  }

  getName() { return this.nombre; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/simulada/edit'; }

  getSheetByName(nombre) {
    return this.hojas.filter((h) => h.nombre === nombre)[0] || null;
  }

  insertSheet(nombre) {
    if (this.getSheetByName(nombre)) throw new Error('La hoja ' + nombre + ' ya existe.');
    const hoja = new Hoja(nombre);
    this.hojas.push(hoja);
    return hoja;
  }

  getSheets() { return this.hojas.slice(); }
}

/**
 * Carga Codigo.gs en un contexto aislado con la planilla simulada.
 * Devuelve las funciones exportadas y la planilla, para revisarla despues.
 */
function cargarScript(opciones) {
  const config = opciones || {};
  const planilla = new Planilla(config.nombrePlanilla);
  const propiedades = {};
  const bloqueos = { tomados: 0, soltados: 0 };

  const contexto = {
    module: { exports: {} },
    console,
    SpreadsheetApp: {
      getActive: () => planilla,
      openById: () => planilla,
      newDataValidation: () => {
        const regla = { valores: null, permiteInvalido: true };
        const constructor = {
          requireValueInList: (valores) => { regla.valores = valores; return constructor; },
          setAllowInvalid: (v) => { regla.permiteInvalido = v; return constructor; },
          build: () => regla,
        };
        return constructor;
      },
    },
    // El bloqueo evita que dos telefonos que sincronizan a la vez se pisen. Aca
    // se cuenta cuantas veces se toma y se suelta, para comprobar que siempre se
    // suelta aunque el envio falle.
    LockService: {
      getScriptLock: () => ({
        waitLock: () => { bloqueos.tomados += 1; },
        releaseLock: () => { bloqueos.soltados += 1; },
      }),
    },
    // El registro de ejecucion del editor de Apps Script.
    Logger: { log: () => {} },
    Utilities: {
      formatDate: (fecha) => fecha.toISOString().slice(0, 19).replace('T', ' '),
    },
    PropertiesService: {
      getDocumentProperties: () => ({
        getProperty: (clave) => (clave in propiedades ? propiedades[clave] : null),
        setProperty: (clave, valor) => { propiedades[clave] = valor; },
      }),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (texto) => ({
        contenido: texto,
        setMimeType() { return this; },
        getContent() { return this.contenido; },
      }),
    },
  };

  vm.createContext(contexto);
  const codigo = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Codigo.gs'), 'utf8');
  vm.runInContext(codigo, contexto, { filename: 'Codigo.gs' });

  // El script trae el identificador de la planilla sin completar a proposito, y
  // se niega a escribir mientras siga asi. Para las pruebas se completa aca,
  // salvo que la prueba quiera justamente comprobar ese rechazo.
  if (config.idPlanilla !== null) {
    contexto.ID_PLANILLA = config.idPlanilla || 'planilla-simulada';
  }

  return { api: contexto.module.exports, planilla, propiedades, bloqueos, contexto };
}

/** Numero de columna (base 1) a letra de planilla: 1 -> A, 14 -> N. */
function letraDeColumna(numero) {
  let n = numero;
  let letra = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
}

module.exports = { Planilla, Hoja, cargarScript, letraDeColumna };
