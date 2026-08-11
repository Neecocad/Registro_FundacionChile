// Comprueba que las tres marcas de version coincidan.
//
// Existe porque ninguna de las tres avisa cuando se queda atras: el codigo queda
// correcto, la aplicacion no da ningun error y el cambio simplemente no llega a
// terreno. Es el tipo de falla que solo se nota semanas despues, cuando alguien
// pregunta por que su telefono muestra otra cosa.
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

  if (!cache) problemas.push('No se encontro la constante CACHE en sw.js.');
  if (!kpi) problemas.push('No se encontro la constante KPI_VERSION en apps-script/Codigo.gs.');

  if (cache && cache.indexOf(appVersion) === -1) {
    problemas.push(
      'CACHE en sw.js es "' + cache + '" y no contiene la version de la aplicacion "' + appVersion +
      '". Un telefono que ya abrio la aplicacion seguira sirviendo los archivos viejos.'
    );
  }
  if (kpi && kpi !== appVersion) {
    problemas.push(
      'KPI_VERSION en Codigo.gs es "' + kpi + '" y APP_VERSION es "' + appVersion +
      '". La planilla conservara el diseno anterior, porque el script corta apenas ve la misma version guardada.'
    );
  }

  return { appVersion, cache, kpi, problemas };
}

if (require.main === module) {
  const resultado = verificar();
  console.log('APP_VERSION (js/version.js):      ' + resultado.appVersion);
  console.log('CACHE (sw.js):                    ' + resultado.cache);
  console.log('KPI_VERSION (apps-script):        ' + resultado.kpi);

  if (resultado.problemas.length) {
    console.error('\nProblemas:');
    resultado.problemas.forEach((p) => console.error('  - ' + p));
    process.exit(1);
  }
  console.log('\nLas tres marcas de version coinciden.');
}

module.exports = { verificar };
