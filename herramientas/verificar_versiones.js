// Comprueba las marcas de version que hacen que un cambio llegue a destino.
//
// Existe porque ninguna avisa cuando se queda atras: el codigo queda correcto,
// la aplicacion no da ningun error y el cambio simplemente no llega. Es el tipo
// de falla que solo se nota semanas despues, cuando alguien pregunta por que su
// telefono muestra otra cosa.
//
// Son dos caminos distintos, y por eso se comprueban distinto:
//
//   APP_VERSION + CACHE   son la misma cosa vista desde dos lados: los archivos
//                         que se le sirven al telefono. Tienen que ir juntas, y
//                         eso si se puede comprobar solo.
//
//   KPI_VERSION           manda el diseno de las hojas de la planilla, que viaja
//                         por otro camino: pegar el script en el editor de
//                         Google. Cuando hay que subirla es una decision ("¿cambio
//                         el diseno de las hojas?"), asi que aca solo se
//                         comprueba que exista y se muestra su valor para que se
//                         mire a proposito.
//
//   node herramientas/verificar_versiones.js

const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');

function verificar() {
  const problemas = [];

  const appVersion = require(path.join(raiz, 'js', 'version.js')).APP_VERSION;

  const sw = fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8');
  const cache = (sw.match(/const CACHE = '([^']+)'/) || [])[1];

  const gs = fs.readFileSync(path.join(raiz, 'apps-script', 'Codigo.gs'), 'utf8');
  const kpi = (gs.match(/var KPI_VERSION = '([^']+)'/) || [])[1];

  if (!appVersion) problemas.push('No se encontro APP_VERSION en js/version.js.');
  if (!cache) problemas.push('No se encontro la constante CACHE en sw.js.');
  if (!kpi) problemas.push('No se encontro la constante KPI_VERSION en apps-script/Codigo.gs.');

  if (cache && appVersion && cache.indexOf(appVersion) === -1) {
    problemas.push(
      'CACHE en sw.js es "' + cache + '" y no contiene la version de la aplicacion "' + appVersion +
      '". Un telefono que ya abrio la aplicacion seguira sirviendo los archivos viejos, y no hay forma ' +
      'de saber desde afuera que version tiene cada equipo.'
    );
  }

  return { appVersion, cache, kpi, problemas };
}

if (require.main === module) {
  const resultado = verificar();
  console.log('APP_VERSION (js/version.js):   ' + resultado.appVersion);
  console.log('CACHE (sw.js):                 ' + resultado.cache);
  console.log('KPI_VERSION (apps-script):     ' + resultado.kpi + '   (sube solo si cambia el diseno de las hojas)');

  if (resultado.problemas.length) {
    console.error('\nProblemas:');
    resultado.problemas.forEach((p) => console.error('  - ' + p));
    process.exit(1);
  }
  console.log('\nLa version de la aplicacion y la del cache coinciden.');
}

module.exports = { verificar };
