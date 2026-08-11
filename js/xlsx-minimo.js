// Generador de archivos Excel en JavaScript puro, sin dependencias, para que
// funcione sin conexion.
//
// Portado del proyecto hermano (santiago-solar-replante, js/xlsx-mini.js), donde
// ya esta probado en terreno. Arma un ZIP sin compresion con celdas de texto o
// numero; es suficiente para que Excel y LibreOffice lo abran.

(function (raiz) {
  'use strict';

  const TABLA_CRC = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  const codificador = new TextEncoder();

  function escaparXml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function nombreColumna(n) {
    let s = '';
    let x = n + 1;
    while (x > 0) {
      const m = (x - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      x = Math.floor((x - 1) / 26);
    }
    return s;
  }

  function hojaXml(filas) {
    let cuerpo = '';
    filas.forEach(function (fila, r) {
      let celdas = '';
      fila.forEach(function (valor, c) {
        if (valor === null || valor === undefined || valor === '') return;
        const ref = nombreColumna(c) + (r + 1);
        if (typeof valor === 'number' && Number.isFinite(valor)) {
          celdas += '<c r="' + ref + '"><v>' + valor + '</v></c>';
        } else {
          celdas += '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' +
            escaparXml(valor) + '</t></is></c>';
        }
      });
      cuerpo += '<row r="' + (r + 1) + '">' + celdas + '</row>';
    });
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetData>' + cuerpo + '</sheetData></worksheet>';
  }

  /** hojas: [{ nombre, filas: [[...]] }] -> Blob listo para descargar. */
  function construirExcel(hojas) {
    const archivos = [];

    archivos.push(['[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      hojas.map(function (_, i) {
        return '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
          '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      }).join('') +
      '</Types>']);

    archivos.push(['_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>']);

    archivos.push(['xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      hojas.map(function (h, i) {
        return '<sheet name="' + escaparXml(h.nombre) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
      }).join('') +
      '</sheets></workbook>']);

    archivos.push(['xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      hojas.map(function (_, i) {
        return '<Relationship Id="rId' + (i + 1) +
          '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' +
          (i + 1) + '.xml"/>';
      }).join('') +
      '</Relationships>']);

    hojas.forEach(function (h, i) {
      archivos.push(['xl/worksheets/sheet' + (i + 1) + '.xml', hojaXml(h.filas)]);
    });

    return empaquetarZip(archivos);
  }

  /** ZIP sin compresion: alcanza y evita arrastrar una biblioteca. */
  function empaquetarZip(archivos) {
    const trozos = [];
    const central = [];
    let desplazamiento = 0;

    const u16 = function (n) { return [n & 0xff, (n >>> 8) & 0xff]; };
    const u32 = function (n) {
      return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
    };

    archivos.forEach(function (par) {
      const nombre = par[0];
      const contenido = par[1];
      const bytesNombre = codificador.encode(nombre);
      const datos = typeof contenido === 'string' ? codificador.encode(contenido) : contenido;
      const crc = crc32(datos);

      const local = [].concat(
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(datos.length), u32(datos.length),
        u16(bytesNombre.length), u16(0)
      );
      trozos.push(new Uint8Array(local), bytesNombre, datos);

      central.push([].concat(
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(datos.length), u32(datos.length),
        u16(bytesNombre.length), u16(0), u16(0), u16(0), u16(0),
        u32(0), u32(desplazamiento)
      ));
      central.push(bytesNombre);

      desplazamiento += local.length + bytesNombre.length + datos.length;
    });

    const partesCentral = [];
    let tamanoCentral = 0;
    central.forEach(function (c) {
      const arr = c instanceof Uint8Array ? c : new Uint8Array(c);
      partesCentral.push(arr);
      tamanoCentral += arr.length;
    });

    const fin = new Uint8Array([].concat(
      u32(0x06054b50), u16(0), u16(0),
      u16(archivos.length), u16(archivos.length),
      u32(tamanoCentral), u32(desplazamiento), u16(0)
    ));

    return new Blob(trozos.concat(partesCentral, [fin]), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  const api = { construirExcel: construirExcel, nombreColumna: nombreColumna };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.XlsxMinimo = api;
})(typeof self !== 'undefined' ? self : this);
