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

const { APP_VERSION } = require('../js/version.js');

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

function registros(pagina) {
  return pagina.evaluate(() => JSON.parse(localStorage.getItem('fch_registros_v1') || '[]'));
}

async function llenarJornada(pagina, cantidad) {
  await pagina.fill('#campo_persona_que_registra', 'Persona de prueba');
  await pagina.click('.opciones-boton label:has-text("Las Mercedes")');
  await pagina.fill('#campo_cantidad_trabajadores', '8');
  await pagina.fill('#campo_fecha', '2026-08-12');
  await pagina.fill('#campo_cantidad_zanjas_marcadas', String(cantidad));
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

  // --- La aplicacion es solo de registro ------------------------------------

  const pantallas = await pagina.$$eval('.nav-boton', (n) => n.map((b) => b.dataset.pantalla));
  revisar('la aplicacion tiene solo las pantallas de registro, no de indicadores',
    JSON.stringify(pantallas) === JSON.stringify(['registrar', 'registros', 'exportar']),
    'tiene ' + JSON.stringify(pantallas));

  // --- Barra superior -------------------------------------------------------

  const barra = await pagina.evaluate(() => {
    const nav = document.querySelector('.navegacion');
    const principal = document.querySelector('main');
    const logo = document.querySelector('.logo');
    return {
      navSobreContenido: nav.getBoundingClientRect().top < principal.getBoundingClientRect().top,
      navArriba: nav.getBoundingClientRect().top < window.innerHeight / 2,
      logoCargado: !!logo && logo.complete && logo.naturalWidth > 0,
      logoAlto: logo ? Math.round(logo.getBoundingClientRect().height) : 0,
      logoAlt: logo ? logo.alt : null,
    };
  });
  revisar('las pestañas quedan arriba, sobre el contenido', barra.navSobreContenido && barra.navArriba,
    JSON.stringify(barra));
  // `complete` sola no basta: una imagen que no existe tambien queda "completa".
  revisar('el logo de Biocys se carga de verdad', barra.logoCargado && barra.logoAlto > 20,
    'alto ' + barra.logoAlto + 'px, alt "' + barra.logoAlt + '"');

  // La barra tiene que seguir a la vista al bajar por un formulario largo: si se
  // fuera con el scroll, cambiar de pestaña obligaria a subir hasta arriba.
  await pagina.evaluate(() => window.scrollTo(0, 600));
  const navTrasBajar = await pagina.evaluate(() => {
    const r = document.querySelector('.navegacion').getBoundingClientRect();
    return { top: Math.round(r.top), visible: r.top >= 0 && r.bottom <= window.innerHeight };
  });
  revisar('las pestañas siguen visibles al bajar por la pantalla', navTrasBajar.visible,
    JSON.stringify(navTrasBajar));
  await pagina.evaluate(() => window.scrollTo(0, 0));

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

  await llenarJornada(pagina, 45);

  const neta = await pagina.textContent('#calc-neta');
  const colacion = await pagina.textContent('#calc-colacion');
  const hh = await pagina.textContent('#calc-hh');
  revisar('la duracion descuenta la colacion y muestra 7,50 h', /7,50/.test(neta), 'muestra ' + neta);
  revisar('el descuento de colacion se muestra explicito', /30 min/.test(colacion), 'muestra ' + colacion);
  revisar('las horas-hombre se calculan solas (7,5 x 8 = 60)', /60,00/.test(hh), 'muestra ' + hh);

  const ayudaColacion = await pagina.textContent('#ayuda-colacion');
  revisar('se explica por que se descuento la colacion', /colación/i.test(ayudaColacion), ayudaColacion);

  // --- Caso de control: guardar una jornada normal --------------------------

  if (CAPTURAS) await pagina.screenshot({ path: path.join(CARPETA_CAPTURAS, '1-formulario.png'), fullPage: true });
  await pagina.click('#boton-guardar');
  await pagina.waitForSelector('#mensaje-guardado:not([hidden])');

  revisar('CASO DE CONTROL: una jornada normal se guarda sin ninguna advertencia',
    !(await pagina.isVisible('#avisos')));

  const mensaje = await pagina.textContent('#mensaje-guardado');
  revisar('al guardar se dice que queda pendiente de sincronizar', /pendiente de sincronizar/.test(mensaje), mensaje);

  const guardados = await registros(pagina);
  revisar('el registro queda guardado en el dispositivo', guardados.length === 1);
  revisar('la duracion guardada descuenta la colacion', guardados[0] && guardados[0].duracion_horas === 7.5,
    'quedo ' + (guardados[0] || {}).duracion_horas);
  revisar('las horas-hombre guardadas son 60', guardados[0] && guardados[0].horas_hombre === 60);
  revisar('la cantidad ejecutada copia el campo que declara la EDT',
    guardados[0] && guardados[0].cantidad_ejecutada === 45);
  revisar('el rendimiento del registro queda calculado',
    guardados[0] && guardados[0].rendimiento_por_hh === 0.75,
    'quedo ' + (guardados[0] || {}).rendimiento_por_hh);

  // --- Horas invertidas: tiene que bloquear ---------------------------------

  await pagina.fill('#campo_hora_inicio', '15:00');
  await pagina.fill('#campo_hora_termino', '07:30');
  await pagina.fill('#campo_cantidad_zanjas_marcadas', '20');
  await pagina.click('#boton-guardar');
  await pagina.waitForSelector('#avisos:not([hidden])');

  const textoError = await pagina.textContent('#avisos');
  revisar('las horas invertidas se detienen antes de guardar', /anterior/.test(textoError), textoError.slice(0, 120));
  revisar('un dato imposible no llega a guardarse', (await registros(pagina)).length === 1);

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
  revisar('el aviso no bloquea: al confirmar, el registro se guarda',
    (await registros(pagina)).length === 2);

  // --- Aviso por acumulado --------------------------------------------------
  // En el proyecto hermano este calculo existia pero no se llamaba desde ninguna
  // parte, asi que el aviso nunca aparecio. Aca se comprueba en pantalla.

  await pagina.fill('#campo_cantidad_zanjas_marcadas', '1000');
  await pagina.click('#boton-guardar');
  await pagina.waitForSelector('#avisos:not([hidden])');

  const textoAcumulado = await pagina.textContent('#avisos');
  revisar('el aviso por superar la meta con el acumulado aparece de verdad',
    /acumulado/.test(textoAcumulado) && /1\.800/.test(textoAcumulado), textoAcumulado.slice(0, 220));

  await pagina.click('button:has-text("Volver a revisar")');
  revisar('«Volver a revisar» cierra los avisos sin guardar',
    !(await pagina.isVisible('#avisos')) && (await registros(pagina)).length === 2);

  // --- Sincronizacion cuando el servidor no responde ------------------------
  // La aplicacion trae la direccion del Apps Script puesta, asi que el caso que
  // hay que cubrir no es "falta configurarla" sino "no se pudo llegar": un
  // teléfono con señal débil, una implementación caída o mal publicada.

  await pagina.route('**/macros/s/**', (ruta) => ruta.abort());
  await pagina.click('.nav-boton[data-pantalla="exportar"]');
  await pagina.click('#boton-sincronizar');
  await pagina.waitForSelector('#mensaje-sync:not([hidden])');

  const mensajeSync = await pagina.textContent('#mensaje-sync');
  revisar('si no se puede sincronizar, se dice que los registros siguen en el telefono',
    /sigue guardado en el teléfono/.test(mensajeSync), mensajeSync);
  revisar('los registros siguen ahi despues de un intento fallido de sincronizar',
    (await registros(pagina)).length === 2);
  revisar('nada queda marcado como sincronizado si la planilla no lo confirmo',
    (await registros(pagina)).every((r) => r.estado_sync === 'pendiente'));
  await pagina.unroute('**/macros/s/**');

  if (CAPTURAS) {
    await pagina.click('.nav-boton[data-pantalla="registros"]');
    await pagina.screenshot({ path: path.join(CARPETA_CAPTURAS, '3-registros.png'), fullPage: true });
  }

  // --- Estructura de Registros y Exportar -----------------------------------
  // En Registros manda la lista; todo lo que sale del telefono (Excel, JSON y
  // sincronizar) vive junto en Exportar.

  const dondeEstan = await pagina.evaluate(() => {
    const en = (id, pantalla) => {
      const nodo = document.querySelector(id);
      return !!nodo && !!nodo.closest('#pantalla-' + pantalla);
    };
    return {
      sincronizarEnExportar: en('#boton-sincronizar', 'exportar'),
      excelEnExportar: en('#boton-exportar-excel', 'exportar'),
      jsonEnExportar: en('#boton-exportar-json', 'exportar'),
      listaEnRegistros: en('#lista-registros', 'registros'),
      // Los botones de cada tarjeta (eliminar) si corresponden; lo que no debe
      // haber son botones de pantalla, como sincronizar o descargar.
      botonesDePantalla: Array.from(document.querySelectorAll('#pantalla-registros .boton'))
        .filter((b) => !b.closest('.tarjeta')).length,
    };
  });
  revisar('sincronizar y las descargas viven en Exportar',
    dondeEstan.sincronizarEnExportar && dondeEstan.excelEnExportar && dondeEstan.jsonEnExportar,
    JSON.stringify(dondeEstan));
  revisar('en Registros manda la lista: ninguna accion de pantalla compite con ella',
    dondeEstan.listaEnRegistros && dondeEstan.botonesDePantalla === 0,
    JSON.stringify(dondeEstan));

  const insignia = await pagina.evaluate(() => {
    const n = document.querySelector('#conteo-registros');
    return { texto: n.textContent.trim(), oculta: n.hidden };
  });
  revisar('la pestaña Registros muestra cuantos hay guardados',
    insignia.texto === '2' && !insignia.oculta, JSON.stringify(insignia));

  // --- Exportar -------------------------------------------------------------

  await pagina.click('.nav-boton[data-pantalla="exportar"]');

  const textoExportar = await pagina.textContent('#pantalla-exportar');
  revisar('la pantalla Exportar dice donde se ven los indicadores',
    /planilla de Google/.test(textoExportar) && /KPI/.test(textoExportar));
  // \s+ y no un espacio: el texto viene del HTML y puede traer un salto de linea
  // en medio de la frase.
  revisar('se explica que las formulas se recalculan solas',
    /recalculan\s+solas/.test(textoExportar));

  const descargaExcel = pagina.waitForEvent('download');
  await pagina.click('#boton-exportar-excel');
  const excel = await descargaExcel;
  const rutaExcel = await excel.path();
  const bytes = fs.readFileSync(rutaExcel);
  revisar('el respaldo en Excel se descarga y es un archivo real',
    /\.xlsx$/.test(excel.suggestedFilename()) && bytes.length > 500 &&
      bytes[0] === 0x50 && bytes[1] === 0x4b,
    excel.suggestedFilename() + ', ' + bytes.length + ' bytes');

  const descargaJson = pagina.waitForEvent('download');
  await pagina.click('#boton-exportar-json');
  const json = await descargaJson;
  const contenido = JSON.parse(fs.readFileSync(await json.path(), 'utf8'));
  revisar('el respaldo en JSON trae los registros',
    Array.isArray(contenido.registros) && contenido.registros.length === 2,
    json.suggestedFilename());

  const textoJornada = await pagina.textContent('#texto-jornada');
  revisar('se explica la jornada y el criterio de la colacion',
    /08:00/.test(textoJornada) && /7,5/.test(textoJornada), textoJornada);

  const textoFuera = await pagina.textContent('#lista-fuera-app');
  revisar('las actividades fuera de la aplicacion quedan listadas, no escondidas',
    /3\.1/.test(textoFuera) && /11\.3/.test(textoFuera));

  const textoVersion = await pagina.textContent('#texto-version');
  revisar('la pantalla muestra la version y no un "undefined"',
    textoVersion.indexOf(APP_VERSION) !== -1 && !/undefined/.test(textoVersion), textoVersion);

  if (CAPTURAS) await pagina.screenshot({ path: path.join(CARPETA_CAPTURAS, '4-exportar.png'), fullPage: true });

  // --- Borrado --------------------------------------------------------------

  pagina.on('dialog', (d) => d.accept());
  await pagina.click('.nav-boton[data-pantalla="registros"]');
  await pagina.click('.tarjeta button:has-text("Eliminar")');
  revisar('un registro no sincronizado se borra del dispositivo',
    (await registros(pagina)).length === 1);

  // Un registro ya sincronizado no se puede borrar sin dejar rastro.
  await pagina.evaluate(() => {
    const guardados = JSON.parse(localStorage.getItem('fch_registros_v1'));
    guardados[0].estado_sync = 'sincronizado';
    localStorage.setItem('fch_registros_v1', JSON.stringify(guardados));
  });
  await pagina.reload();
  await esperarActividades(pagina);
  await pagina.click('.nav-boton[data-pantalla="registros"]');
  await pagina.click('.tarjeta button:has-text("Eliminar")');
  await pagina.waitForSelector('#mensaje-registros:not([hidden])');

  const trasBaja = await registros(pagina);
  revisar('borrar un registro ya sincronizado lo marca como baja en vez de hacerlo desaparecer',
    trasBaja.length === 1 && trasBaja[0].registro_activo === false);
  revisar('la baja vuelve a quedar pendiente, para que la planilla se entere',
    trasBaja[0] && trasBaja[0].estado_sync === 'pendiente');

  const mensajeBaja = await pagina.textContent('#mensaje-registros');
  revisar('se advierte que la planilla sigue con la fila hasta sincronizar',
    /planilla/.test(mensajeBaja), mensajeBaja);

  // --- Sin conexion ---------------------------------------------------------

  await contexto.setOffline(true);
  await pagina.reload();
  await esperarActividades(pagina);
  const opcionesSinRed = await pagina.$$eval('#codigo_edt option', (n) => n.filter((o) => o.value).length);
  revisar('la aplicacion carga y permite registrar sin conexion', opcionesSinRed === 11);

  await pagina.selectOption('#codigo_edt', '2.2');
  await pagina.waitForSelector('#campo_metros_microterraza_marcados');
  await pagina.fill('#campo_persona_que_registra', 'Persona de prueba');
  await pagina.click('.opciones-boton label:has-text("Ibacache")');
  await pagina.fill('#campo_cantidad_trabajadores', '5');
  await pagina.fill('#campo_fecha', '2026-08-13');
  await pagina.fill('#campo_metros_microterraza_marcados', '40');
  await pagina.click('#boton-guardar');
  await pagina.waitForSelector('#mensaje-guardado:not([hidden])');
  revisar('sin conexion se puede guardar un registro nuevo', (await registros(pagina)).length === 2);

  const chip = await pagina.textContent('#estado-conexion');
  revisar('se avisa que no hay conexion y que igual se puede registrar', /Sin conexión/.test(chip), chip);
  await contexto.setOffline(false);

  // --- Sincronizacion contra un servidor de mentira --------------------------
  // Se intercepta el envio para mirar exactamente que sale del telefono. Es la
  // unica forma de comprobar el formato sin escribir en la planilla de verdad.

  const enviados = [];
  const consultas = [];
  await pagina.route('**/macros/s/**', async (ruta) => {
    const peticion = ruta.request();
    // La aplicacion hace dos cosas distintas contra la misma direccion: consulta
    // (GET) en que planilla escribe, y envia (POST) los registros.
    if (peticion.method() === 'POST') {
      enviados.push({ tipoContenido: peticion.headers()['content-type'], cuerpo: peticion.postData() });
    } else {
      consultas.push(peticion.method());
    }
    await ruta.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        estado: 'ok',
        record_id: 'confirmado',
        planilla_nombre: 'Planilla de prueba',
        planilla_url: 'https://docs.google.com/spreadsheets/d/prueba/edit',
        hojas_destino: ['Registros_MariaPinto', 'KPI_MariaPinto', 'Costos_MariaPinto'],
      }),
    });
  });

  await pagina.click('.nav-boton[data-pantalla="exportar"]');
  // La direccion vive dentro de un desplegable: en el uso normal nadie la toca.
  await pagina.click('.detalle-avanzado summary');
  await pagina.fill('#url_apps_script', 'https://script.google.com/macros/s/prueba/exec');
  await pagina.click('#boton-guardar-url');
  await pagina.click('#boton-sincronizar');
  await pagina.waitForFunction(() => !document.querySelector('#boton-sincronizar').disabled);

  revisar('se envia un registro por peticion', enviados.length === 2, 'se enviaron ' + enviados.length);
  revisar('la aplicacion pregunta a la planilla en cual escribe',
    consultas.length >= 1, 'consultas: ' + consultas.length);

  const primero = enviados[0] || {};
  revisar('el envio va como formulario, para no gatillar la consulta previa de permisos',
    /application\/x-www-form-urlencoded/.test(primero.tipoContenido || ''), primero.tipoContenido);

  let cuerpo = {};
  try {
    cuerpo = JSON.parse(decodeURIComponent((primero.cuerpo || '').replace(/^data=/, '')));
  } catch (e) { /* queda vacio y la comprobacion falla */ }

  revisar('el envio declara su tipo, para que el script no confunda proyectos',
    cuerpo.tipo === 'registro_fundacion_chile', JSON.stringify(cuerpo.tipo));
  revisar('el envio lleva la version de la aplicacion que lo generó',
    cuerpo.version_app === APP_VERSION, JSON.stringify(cuerpo.version_app));
  revisar('el envio lleva el sector con su nombre visible, no el codigo interno',
    cuerpo.registro && cuerpo.registro.sector === 'Las Mercedes',
    JSON.stringify(cuerpo.registro && cuerpo.registro.sector));
  revisar('el campo propio de la actividad viaja en su propia columna',
    cuerpo.registro && cuerpo.registro.cantidad_zanjas_marcadas !== undefined &&
      cuerpo.registro.detalle === undefined,
    JSON.stringify(cuerpo.registro && cuerpo.registro.cantidad_zanjas_marcadas));

  const trasSync = await registros(pagina);
  revisar('lo confirmado por la planilla queda marcado como sincronizado',
    trasSync.every((r) => r.estado_sync === 'sincronizado'),
    JSON.stringify(trasSync.map((r) => r.estado_sync)));

  const chipPendientes = await pagina.textContent('#estado-pendientes');
  revisar('el aviso de pendientes desaparece al quedar todo sincronizado',
    /Todo sincronizado/.test(chipPendientes), chipPendientes);

  await pagina.unroute('**/macros/s/**');
  await pagina.click('.nav-boton[data-pantalla="exportar"]');
  await pagina.click('#boton-restablecer-url');


  // --- Errores de consola ---------------------------------------------------

  const erroresReales = erroresConsola.filter((e) => !/favicon|Failed to load resource/i.test(e));
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
