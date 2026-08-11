// Ejecuta todas las comprobaciones que no necesitan navegador.
//
//   node pruebas/ejecutar.js
//
// La prueba en navegador va aparte porque necesita Playwright instalado:
//   node pruebas/prueba_navegador.js

const { execFileSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..');
let fallas = 0;

function paso(titulo, funcion) {
  try {
    funcion();
  } catch (error) {
    fallas += 1;
    console.error('\n' + titulo + ': FALLA');
    console.error(error.message);
  }
}

// 1. Las tres marcas de version -------------------------------------------

paso('Versiones', () => {
  const { verificar } = require(path.join(RAIZ, 'herramientas', 'verificar_versiones.js'));
  const resultado = verificar();
  if (resultado.problemas.length) throw new Error(resultado.problemas.join('\n'));
  console.log('\nVersiones');
  console.log('=========');
  console.log('  ok   las tres marcas de version coinciden (' + resultado.appVersion + ')');
});

// 2. La configuracion refleja la especificacion ----------------------------
//
// La aplicacion se rompio una vez por cambiar el generador y olvidar volver a
// ejecutarlo. Aca se regenera en una copia y se compara: si no coincide, alguien
// edito el archivo generado a mano o dejo el generador a medio aplicar.

paso('Configuracion generada', () => {
  console.log('\nConfiguracion generada desde la EDT');
  console.log('===================================');

  const generador = path.join(RAIZ, 'herramientas', 'generar_config.py');
  const archivo = path.join(RAIZ, 'js', 'config-actividades.js');
  const antes = fs.readFileSync(archivo, 'utf8');

  const python = spawnSync('python3', ['-c', 'import openpyxl'], { encoding: 'utf8' });
  if (python.status !== 0) {
    console.log('  aviso openpyxl no esta instalado; no se pudo comprobar si la configuracion esta al dia');
    return;
  }

  execFileSync('python3', [generador], { cwd: RAIZ, encoding: 'utf8' });
  const despues = fs.readFileSync(archivo, 'utf8');

  if (antes !== despues) {
    fs.writeFileSync(archivo, despues, 'utf8');
    throw new Error(
      'js/config-actividades.js no coincidia con lo que produce el generador. Se acaba de regenerar; ' +
      'revisa el cambio antes de seguir. Si editaste ese archivo a mano, el cambio hay que hacerlo en ' +
      'especificacion/EDT_Fundacion_Chile_Maria_Pinto_KPI.xlsx.'
    );
  }
  console.log('  ok   la configuracion coincide con la planilla de especificacion');
});

// 3. El service worker guarda todo lo que la aplicacion carga ---------------
//
// Un archivo que index.html carga y sw.js no guarda hace que la aplicacion se
// rompa justo cuando mas se necesita: sin senal, en terreno. Y al reves, un
// archivo listado que ya no existe hace fallar la instalacion completa del
// service worker, dejando todo sin cache.

paso('Archivos sin conexion', () => {
  console.log('\nArchivos que la aplicacion necesita sin conexion');
  console.log('===============================================');

  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');

  const enHtml = (html.match(/<script src="([^"]+)"/g) || [])
    .map((s) => s.replace(/.*src="/, '').replace(/".*/, ''));
  enHtml.push((html.match(/<link rel="stylesheet" href="([^"]+)"/) || [])[1]);

  const enSw = (sw.match(/'\.\/([^']+)'/g) || []).map((s) => s.replace(/^'\.\//, '').replace(/'$/, ''));

  const faltantes = enHtml.filter((a) => a && enSw.indexOf(a) === -1);
  if (faltantes.length) {
    throw new Error(
      'index.html carga archivos que sw.js no guarda: ' + faltantes.join(', ') +
      '. Sin señal, la aplicacion no los va a encontrar.'
    );
  }

  const inexistentes = enSw.filter((a) => a !== '' && !fs.existsSync(path.join(RAIZ, a)));
  if (inexistentes.length) {
    throw new Error(
      'sw.js lista archivos que no existen: ' + inexistentes.join(', ') +
      '. El service worker no se instala y la aplicacion queda sin funcionar sin señal.'
    );
  }

  console.log('  ok   los ' + enHtml.filter(Boolean).length + ' archivos que carga index.html estan en el cache');
  console.log('  ok   los ' + enSw.length + ' archivos listados en sw.js existen');
});

// 4. Calculos y 5. Apps Script ---------------------------------------------

['pruebas_calculos.js', 'pruebas_apps_script.js'].forEach((archivo) => {
  const resultado = spawnSync('node', [path.join(__dirname, archivo)], { encoding: 'utf8' });
  process.stdout.write(resultado.stdout || '');
  process.stderr.write(resultado.stderr || '');
  if (resultado.status !== 0) fallas += 1;
});

console.log('');
if (fallas) {
  console.error('Hay ' + fallas + ' grupo(s) de comprobaciones con fallas.');
  process.exit(1);
}
console.log('Todas las comprobaciones sin navegador pasaron.');
console.log('Falta la prueba en navegador: node pruebas/prueba_navegador.js');
