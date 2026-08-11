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

  setFontWeight() { return this; }
  setNumberFormat() { return this; }
}

class Hoja {
  constructor(nombre) {
    this.nombre = nombre;
    this.datos = []; // filas de arreglos, base 0
    this.filasCongeladas = 0;
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

  setFrozenRows(n) { this.filasCongeladas = n; return this; }

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
  constructor() { this.hojas = []; }

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
function cargarScript() {
  const planilla = new Planilla();
  const propiedades = {};

  const contexto = {
    module: { exports: {} },
    console,
    SpreadsheetApp: {
      getActive: () => planilla,
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

  return { api: contexto.module.exports, planilla, propiedades, contexto };
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
