// Prueba de la aplicacion en un navegador de verdad (Chromium con Playwright).
//
// Leer el codigo no basta: en el proyecto hermano habia una funcion que nadie
// llamaba y una clase CSS que no existia, y las dos parecian completas al leer.
// Aca se ejecuta la rama concreta y se mira el resultado en pantalla.
//
//   node pruebas/prueba_navegador.js
//   node pruebas/prueba_navegador.js --capturas    (deja imagenes en pruebas/capturas)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RAIZ = path.join(__dirname, '..');
const CAPTURAS = process.argv.indexOf('--capturas') !== -1;
const CARPETA_CAPTURAS = path.join(__dirname, 'capturas');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
};

function servir() {
  return new Promise((resolve) => {
    const servidor = http.createServer((peticion, respuesta) => {
      const ruta = peticion.url.split('?')[0];
      const archivo = path.join(RAIZ, ruta === '/' ? 'index.html' : decodeURIComponent(ruta));
      if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
        respuesta.writeHead(404);
        respuesta.end('no existe');
        return;
      }
      respuesta.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'text/plain' });
      respuesta.end(fs.readFileSync(archivo));
    });
    servidor.listen(0, '127.0.0.1', () => resolve({ servidor, puerto: servidor.address().port }));
  });
}

const resultados = [];

/** Los <option> no son "visibles" para Playwright; se espera por su cantidad. */
function esperarActividades(pagina) {
  return pagina.waitForFunction(
    () => document.querySelectorAll('#codigo_edt option').length > 1
  );
}

function revisar(nombre, condicion, detalle) {
  resultados.push({ nombre, ok: !!condicion, detalle });
  console.log((condicion ? '  ok   ' : '  FALLA ') + nombre + (condicion || !detalle ? '' : '\n        ' + detalle));
}

async function main() {
  const { servidor, puerto } = await servir();
  const base = 'http://127.0.0.1:' + puerto + '/index.html';

  // Si el entorno ya trae un Chromium instalado, se usa ese en vez de descargar
  // otro. CHROMIUM_BIN permite apuntar a uno distinto sin tocar el codigo.
  const navegador = await chromium.launch(
    process.env.CHROMIUM_BIN ? { executablePath: process.env.CHROMIUM_BIN } : {}
  );
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-CL' });
  const pagina = await contexto.newPage();

  const erroresConsola = [];
  pagina.on('pageerror', (e) => erroresConsola.push(String(e)));
  pagina.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(m.text()); });

  if (CAPTURAS && !fs.existsSync(CARPETA_CAPTURAS)) fs.mkdirSync(CARPETA_CAPTURAS);

  console.log('\nAplicacion en Chromium');
  console.log('======================');

  await pagina.goto(base);
  await esperarActividades(pagina);

  // --- Actividades ofrecidas ------------------------------------------------

  const opciones = await pagina.$$eval('#codigo_edt option', (nodos) =>
    nodos.map((n) => n.value).filter((v) => v)
  );
  revisar('el selector ofrece las 11 actividades registrables', opciones.length === 11,
    'ofrece ' + opciones.length + ': ' + opciones.join(', '));

  const excluidas = ['3.1', '4.1', '4.4', '5.1', '7.1', '8.1', '9.1', '11.1', '11.3'];
  const coladas = excluidas.filter((c) => opciones.indexOf(c) !== -1);
  revisar('ninguna actividad "sin registro en APP" aparece en el selector', coladas.length === 0,
    'aparecen: ' + coladas.join(', '));

  // --- Valores por defecto de la jornada ------------------------------------

  await pagina.selectOption('#codigo_edt', '2.1');
  await pagina.waitForSelector('#campo_cantidad_zanjas_marcadas');

  revisar('el campo especifico de la actividad aparece al elegirla',
    await pagina.isVisible('#campo_cantidad_zanjas_marcadas'));

  const horaInicio = await pagina.inputValue('#campo_hora_inicio');
  const horaTermino = await pagina.inputValue('#campo_hora_termino');
  revisar('el horario viene con la jornada del proyecto', horaInicio === '08:00' && horaTermino === '16:00',
    'vino ' + horaInicio + ' a ' + horaTermino);

  // --- Panel de calculados --------------------------------------------------

  await pagina.fill('#campo_persona_que_registra', 'Persona de prueba');
  await pagina.click('.opciones-boton label:has-text("Las Mercedes")');
  await pagina.fill('#campo_cantidad_trabajadores', '8');
  await pagina.fill('#campo_fecha', '2026-08-12');

  const neta = await pagina.textContent('#calc-neta');
  const colacion = await pagina.textContent('#calc-colacion');
  const hh = await pagina.textContent('#calc-hh');
  revisar('la duracion descuenta la colacion y muestra 7,50 h', /7,50/.test(neta), 'muestra ' + neta);
  revisar('el descuento de colacion se muestra explicito', /30 min/.test(colacion), 'muestra ' + colacion);
  revisar('las horas-hombre se calculan solas (7,5 x 8 = 60)', /60,00/.test(hh), 'muestra ' + hh);

  const ayudaColacion = await pagina.textContent('#ayuda-colacion');
  revisar('se explica por que se descuento la colacion', /colación/i.test(ayudaColacion), ayudaColacion);

  // --- Caso de control: guardar una jornada normal --------------------------

  await pagina.fill('#campo_cantidad_zanjas_marcadas', '45');
  if (CAPTURAS) await pagina.screenshot({ path: path.join(CARPETA_CAPTURAS, '1-formulario.png'), fullPage: true });
  await pagina.click('#boton-guardar');
  await pagina.waitForSelector('#mensaje-guardado:not([hidden])');

  const avisosVisibles = await pagina.isVisible('#avisos');
  revisar('CASO DE CONTROL: una jornada normal se guarda sin ninguna advertencia', !avisosVisibles);

  const mensaje = await pagina.textContent('#mensaje-guardado');
  revisar('al guardar se dice que queda pendiente de sincronizar', /pendiente de sincronizar/.test(mensaje), mensaje);

  const guardados = await pagina.evaluate(() => JSON.parse(localStorage.getItem('fch_registros_v1') || '[]'));
  revisar('el registro queda guardado en el dispositivo', guardados.length === 1);
  revisar('la duracion guardada descuenta la colacion', guardados[0] && guardados[0].duracion_horas === 7.5,
    'quedo ' + (guardados[0] || {}).duracion_horas);
  revisar('las horas-hombre guardadas son 60', guardados[0] && guardados[0].horas_hombre === 60);
  revisar('la cantidad ejecutada copia el campo que declara la EDT',
    guardados[0] && guardados[0].cantidad_ejecutada === 45);

  // --- Horas invertidas: tiene que bloquear ---------------------------------

  await pagina.fill('#campo_hora_inicio', '15:00');
  await pagina.fill('#campo_hora_termino', '07:30');
  await pagina.fill('#campo_cantidad_zanjas_marcadas', '20');
  await pagina.click('#boton-guardar');
  await pagina.waitForSelector('#avisos:not([hidden])');

  const textoError = await pagina.textContent('#avisos');
  revisar('las horas invertidas se detienen antes de guardar', /anterior/.test(textoError), textoError.slice(0, 120));

  const trasError = await pagina.evaluate(() => JSON.parse(localStorage.getItem('fch_registros_v1') || '[]'));
  revisar('un dato imposible no llega a guardarse', trasError.length === 1);

  // --- Cantidad fuera de rango: avisa pero deja guardar ----------------------

  await pagina.fill('#campo_hora_inicio', '08:00');
  await pagina.fill('#campo_hora_termino', '16:00');
  await pagina.fill('#campo_cantidad_zanjas_marcadas', '900');
  await pagina.click('#boton-guardar');
  await pagina.waitForSelector('#avisos:not([hidden])');

  const textoAviso = await pagina.textContent('#avisos');
  revisar('una cantidad muy superior a la referencia muestra el numero y pide confirmar',
    /900/.test(textoAviso) && /Confirmar y guardar/.test(textoAviso), textoAviso.slice(0, 160));

  if (CAPTURAS) await pagina.screenshot({ path: path.join(CARPETA_CAPTURAS, '2-aviso.png'), fullPage: true });

  await pagina.click('button:has-text("Confirmar y guardar")');
  await pagina.waitForSelector('#mensaje-guardado:not([hidden])');
  const trasConfirmar = await pagina.evaluate(() => JSON.parse(localStorage.getItem('fch_registros_v1') || '[]'));
  revisar('el aviso no bloquea: al confirmar, el registro se guarda', trasConfirmar.length === 2);

  // --- Indicadores ----------------------------------------------------------

  await pagina.click('.nav-boton[data-pantalla="indicadores"]');
  await pagina.waitForSelector('#indicadores-actividades .tarjeta');

  const textoIndicadores = await pagina.textContent('#indicadores-actividades');
  revisar('el avance acumulado suma los dos registros (45 + 900 = 945)', /945/.test(textoIndicadores));
  revisar('se muestra el rendimiento por hora-hombre', /por HH/.test(textoIndicadores));
  revisar('se muestra el porcentaje de avance contra la meta de la EDT', /%/.test(textoIndicadores));
  revisar('se muestra el ritmo requerido para el plazo restante', /Ritmo requerido/.test(textoIndicadores));

  const economicosSinDatos = await pagina.textContent('#indicadores-economicos');
  revisar('sin costos cargados se dice que faltan valores y no se inventa ninguno',
    /Faltan valores/.test(economicosSinDatos) && /—/.test(economicosSinDatos));

  if (CAPTURAS) await pagina.screenshot({ path: path.join(CARPETA_CAPTURAS, '3-indicadores.png'), fullPage: true });

  // --- Costos ---------------------------------------------------------------

  await pagina.click('.nav-boton[data-pantalla="costos"]');
  await pagina.fill('#costo_hh', '4000');

  const ayudaHH = await pagina.textContent('#ayuda-costo-hh');
  revisar('el costo por hora se traduce a costo por dia para poder revisarlo', /30\.000/.test(ayudaHH), ayudaHH);

  await pagina.fill('#camioneta_monto', '600000');
  await pagina.selectOption('#camioneta_periodicidad', 'mes');
  await pagina.fill('#banos_monto', '200000');
  await pagina.selectOption('#banos_periodicidad', 'mes');

  await pagina.click('#boton-agregar-extra');
  await pagina.fill('.fila-extra input[type="text"]', 'Combustible');
  await pagina.fill('.fila-extra input[type="number"]', '150000');
  await pagina.click('#formulario-costos button[type="submit"]');
  await pagina.waitForSelector('#mensaje-costos:not([hidden])');

  if (CAPTURAS) await pagina.screenshot({ path: path.join(CARPETA_CAPTURAS, '4-costos.png'), fullPage: true });

  await pagina.click('.nav-boton[data-pantalla="indicadores"]');
  const economicos = await pagina.textContent('#indicadores-economicos');
  revisar('con el costo de la hora-hombre cargado aparece el costo de mano de obra',
    /\$/.test(economicos) && !/Faltan valores/.test(economicos), economicos.slice(0, 200));
  revisar('aparece el costo por unidad ejecutada', /Costo por unidad ejecutada/.test(economicos));
  revisar('se distingue el dato duro de la estimacion con indirectos',
    /estimación/i.test(economicos) && /dato duro/i.test(economicos));

  // --- Sincronizacion sin configurar ----------------------------------------

  await pagina.click('.nav-boton[data-pantalla="registros"]');
  await pagina.click('#boton-sincronizar');
  await pagina.waitForSelector('#mensaje-sync:not([hidden])');
  const mensajeSync = await pagina.textContent('#mensaje-sync');
  revisar('sin direccion configurada, sincronizar explica que falta y no pierde nada',
    /Ajustes/.test(mensajeSync), mensajeSync);

  // --- Borrado --------------------------------------------------------------

  pagina.on('dialog', (d) => d.accept());
  await pagina.click('.tarjeta button:has-text("Eliminar")');
  const trasBorrar = await pagina.evaluate(() => JSON.parse(localStorage.getItem('fch_registros_v1') || '[]'));
  revisar('un registro no sincronizado se borra del dispositivo', trasBorrar.length === 1);

  // Un registro ya sincronizado no se puede borrar sin dejar rastro.
  await pagina.evaluate(() => {
    const registros = JSON.parse(localStorage.getItem('fch_registros_v1'));
    registros[0].estado_sync = 'sincronizado';
    localStorage.setItem('fch_registros_v1', JSON.stringify(registros));
  });
  await pagina.reload();
  await pagina.click('.nav-boton[data-pantalla="registros"]');
  await pagina.click('.tarjeta button:has-text("Eliminar")');
  await pagina.waitForSelector('#mensaje-sync:not([hidden])');

  const trasBorrarSincronizado = await pagina.evaluate(() =>
    JSON.parse(localStorage.getItem('fch_registros_v1'))
  );
  revisar('borrar un registro ya sincronizado lo marca como baja en vez de hacerlo desaparecer',
    trasBorrarSincronizado.length === 1 && trasBorrarSincronizado[0].registro_activo === false);

  const mensajeBaja = await pagina.textContent('#mensaje-sync');
  revisar('se advierte que la planilla sigue con la fila hasta sincronizar',
    /planilla/.test(mensajeBaja), mensajeBaja);

  const textoIndicadoresTrasBaja = await pagina.textContent('#indicadores-actividades');
  revisar('un registro dado de baja deja de sumar en los indicadores',
    !/945/.test(textoIndicadoresTrasBaja));

  // --- Ajustes --------------------------------------------------------------

  await pagina.click('.nav-boton[data-pantalla="ajustes"]');
  const textoFuera = await pagina.textContent('#lista-fuera-app');
  revisar('las actividades fuera de la aplicacion quedan listadas en Ajustes, no escondidas',
    /3\.1/.test(textoFuera) && /11\.3/.test(textoFuera));

  const textoJornada = await pagina.textContent('#texto-jornada');
  revisar('se explica la jornada y el criterio de la colacion',
    /08:00/.test(textoJornada) && /7,5/.test(textoJornada), textoJornada);

  // --- Sin conexion ---------------------------------------------------------

  await contexto.setOffline(true);
  await pagina.reload();
  await esperarActividades(pagina);
  const opcionesSinRed = await pagina.$$eval('#codigo_edt option', (n) => n.filter((o) => o.value).length);
  revisar('la aplicacion carga y permite registrar sin conexion', opcionesSinRed === 11);

  const chip = await pagina.textContent('#estado-conexion');
  revisar('se avisa que no hay conexion y que igual se puede registrar', /Sin conexión/.test(chip), chip);
  await contexto.setOffline(false);

  // --- Errores de consola ---------------------------------------------------

  const erroresReales = erroresConsola.filter((e) => !/favicon/i.test(e));
  revisar('la aplicacion no arroja errores en la consola', erroresReales.length === 0,
    erroresReales.join(' | '));

  await navegador.close();
  servidor.close();

  const fallas = resultados.filter((r) => !r.ok).length;
  console.log('\n' + (resultados.length - fallas) + ' de ' + resultados.length + ' comprobaciones pasaron.');
  if (CAPTURAS) console.log('Capturas en ' + CARPETA_CAPTURAS);
  process.exit(fallas > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
