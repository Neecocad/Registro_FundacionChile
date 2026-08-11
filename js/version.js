// Marca de version de la aplicacion.
//
// Cuidado: esta version tiene que ir junto con otras dos, y ninguna avisa si se
// queda atras.
//
//   1. APP_VERSION            (este archivo)
//   2. CACHE en sw.js         si no sube, un telefono sin senal sigue sirviendo
//                             los archivos viejos y no hay como saber que
//                             version tiene cada equipo
//   3. KPI_VERSION en         si no sube, la planilla conserva el diseno viejo,
//      apps-script/Codigo.gs  porque el script corta apenas ve la misma version
//
// Para no depender de la memoria, `node herramientas/verificar_versiones.js`
// comprueba que las tres coincidan. Esa comprobacion tambien corre dentro de
// `node pruebas/ejecutar.js`.

const APP_VERSION = '0.1.0-beta';

// Se publica como variable global a proposito: un `const` de nivel superior no
// queda colgando de `window`, y los demas archivos la leen desde ahi. Sin esta
// linea la version viaja como `undefined` a la planilla y la pantalla muestra
// "Aplicacion undefined", las dos cosas sin dar ningun error.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APP_VERSION };
} else if (typeof self !== 'undefined') {
  self.APP_VERSION = APP_VERSION;
}
