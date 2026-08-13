// Service worker: deja la aplicacion disponible sin conexion.
//
// CUIDADO CON ESTA LINEA. El nombre del cache tiene que cambiar cada vez que se
// modifica cualquier archivo de la lista. Si no cambia, un telefono que ya abrio
// la aplicacion sigue sirviendo los archivos viejos indefinidamente, y no hay
// forma de saber desde afuera que version tiene cada equipo en terreno.
//
// La version va junto con APP_VERSION en js/version.js.
// `node herramientas/verificar_versiones.js` comprueba que coincidan.
const CACHE = 'fch-registro-v1.0.4';

const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/estilos.css',
  './js/version.js',
  './js/config-actividades.js',
  './js/calculos.js',
  './js/almacenamiento.js',
  './js/formulario.js',
  './js/xlsx-minimo.js',
  './js/exportar.js',
  './js/sincronizacion.js',
  './js/app.js',
  './iconos/logo-biocys.png',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
];

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ARCHIVOS);
    }).then(function () {
      // Se activa de inmediato: en terreno nadie va a cerrar todas las pestanas
      // para que entre una version nueva.
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys().then(function (nombres) {
      return Promise.all(
        nombres.filter(function (n) { return n !== CACHE; })
               .map(function (n) { return caches.delete(n); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (evento) {
  const peticion = evento.request;

  // La sincronizacion nunca se sirve desde el cache: una respuesta guardada
  // haria creer que los datos llegaron a la planilla cuando no llegaron.
  if (peticion.method !== 'GET' || peticion.url.indexOf('script.google.com') !== -1) {
    return;
  }

  // Primero la red, y si no hay, lo guardado. Asi un equipo con senal recibe la
  // version nueva apenas se publica, y uno sin senal sigue funcionando.
  evento.respondWith(
    fetch(peticion)
      .then(function (respuesta) {
        if (respuesta && respuesta.status === 200 && respuesta.type === 'basic') {
          const copia = respuesta.clone();
          caches.open(CACHE).then(function (cache) { cache.put(peticion, copia); });
        }
        return respuesta;
      })
      .catch(function () {
        return caches.match(peticion).then(function (guardada) {
          return guardada || caches.match('./index.html');
        });
      })
  );
});
