// Marca de version de la aplicacion.
//
// Esta version y CACHE en sw.js son la misma cosa vista desde dos lados: los
// archivos que se le sirven al telefono. Tienen que subir juntas. Si CACHE no
// sube, un equipo que ya abrio la aplicacion sigue sirviendo los archivos viejos
// para siempre, y no hay forma de saber desde afuera que version tiene cada uno.
//
// KPI_VERSION (apps-script/Codigo.gs) es otra cosa y va por su cuenta: manda el
// diseno de las hojas de la planilla, que se propaga por un camino distinto
// (pegar el script en el editor de Google). Un cambio de color en la aplicacion
// no tiene por que obligar a volver a implementar el Apps Script.
//
// `node herramientas/verificar_versiones.js` comprueba que APP_VERSION y CACHE
// coincidan. Esa comprobacion tambien corre dentro de `node pruebas/ejecutar.js`.

const APP_VERSION = '1.0.1';

// Se publica como variable global a proposito: un `const` de nivel superior no
// queda colgando de `window`, y los demas archivos la leen desde ahi. Sin esta
// linea la version viaja como `undefined` a la planilla y la pantalla muestra
// "Aplicacion undefined", las dos cosas sin dar ningun error.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APP_VERSION };
} else if (typeof self !== 'undefined') {
  self.APP_VERSION = APP_VERSION;
}
