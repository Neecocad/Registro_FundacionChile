# Registro en terreno — Fundación Chile / María Pinto

Aplicación web para registrar en terreno las actividades del proyecto, calcular
indicadores de rendimiento y estimar el costo de lo ejecutado. Funciona sin
conexión y sincroniza después contra una planilla de Google.

> **Versión beta (0.1.0-beta).** La EDT todavía puede cambiar y hay dos
> actividades cuyo registro en la aplicación está por confirmar. Lo que ya
> funciona está probado; lo que falta está anotado al final de este archivo.

## Qué hace

- **Registra en terreno sin depender de la señal.** Todo se guarda primero en el
  teléfono. La sincronización es un paso posterior y, si falla, no se pierde nada.
- **Calcula sola la duración y las horas-hombre.** Nadie escribe esos números.
  La jornada del proyecto es de 08:00 a 16:00 con 30 minutos de colación, o sea
  7,5 horas efectivas por persona y día hábil.
- **Muestra indicadores de rendimiento** por actividad y por sector: cuánto se
  produce por hora-hombre, cuánto esfuerzo cuesta cada unidad, cuánto se lleva
  avanzado contra la meta y a qué ritmo hay que avanzar para llegar al 01-10-2026.
- **Muestra indicadores económicos** a partir de valores que se cargan a mano:
  costo de la hora-hombre, arriendo de camioneta, arriendo de baños y costos
  extras.

## Cómo se usa

1. Abrir la dirección de la aplicación en el teléfono y agregarla a la pantalla
   de inicio. Desde ese momento funciona aunque no haya señal.
2. En **Ajustes**, pegar la dirección del Apps Script (la entrega Google al
   implementar el script; ver `docs/como_publicar.md`).
3. En **Registrar**: elegir la actividad, revisar el horario que viene puesto,
   indicar cuántas personas trabajaron y cuánto se ejecutó. La duración, las
   horas-hombre y el rendimiento salen solos.
4. En **Registros**: revisar lo guardado y tocar «Sincronizar ahora» cuando haya
   señal.
5. En **Costos**: cargar los valores económicos cuando se conozcan.
6. En **Indicadores**: ver rendimiento, avance y costo.

## Qué actividades aparecen y cuáles no

La EDT tiene **32 actividades**. En la aplicación aparecen **11**:

| Aparecen | Motivo |
|---|---|
| 2.1 a 2.9 (9 actividades de conservación de suelos y aguas) | La EDT las marca con registro en la aplicación |
| 1.1 Informe de diseño de obras | La EDT dice «por confirmar» |
| 10.1 Ejecución de jornada de educación | La EDT dice «por confirmar» |

Las otras **21** quedan fuera del formulario porque la EDT indica que no se
registran en la aplicación. No desaparecen: siguen en la EDT, se listan en la
pestaña Ajustes y llegan a la planilla marcadas como «No» en la columna
`se_registra_en_app`, para poder seguirlas por fuera.

Las dos actividades «por confirmar» se muestran con esa etiqueta a la vista. Si
se decide que tampoco van en la aplicación, se cambia
`INCLUIR_POR_CONFIRMAR = False` en `herramientas/generar_config.py` y se regenera
la configuración; no hay que tocar nada más.

## Cómo está armado

```
index.html                      pantalla única con cinco pestañas
css/estilos.css
js/
  version.js                    APP_VERSION
  config-actividades.js         GENERADO desde la EDT — no editar a mano
  calculos.js                   duración, horas-hombre, KPI y costos
  almacenamiento.js             guardado local y estado de sincronización
  formulario.js                 arma el formulario desde la configuración
  indicadores.js                pantalla de indicadores
  costos.js                     pantalla de parámetros económicos
  sincronizacion.js             envío al Apps Script
  app.js                        conecta todo
sw.js                           funcionamiento sin conexión
apps-script/Codigo.gs           recibe los datos y arma la planilla
especificacion/*.xlsx           la EDT: fuente de verdad del formulario
herramientas/
  generar_config.py             EDT -> js/config-actividades.js
  verificar_versiones.js        comprueba las tres marcas de versión
pruebas/                        comprobaciones automáticas
```

**El formulario no se escribe a mano.** Sale de la planilla de
`especificacion/`. Si cambia una meta, una unidad o un campo:

```bash
python3 herramientas/generar_config.py
```

Editar `js/config-actividades.js` directamente funciona, pero ese cambio se
pierde en la próxima regeneración.

## Cómo comprobar que funciona

```bash
node pruebas/ejecutar.js          # versiones, cálculos, Apps Script simulado
node pruebas/prueba_navegador.js  # la aplicación en Chromium de verdad
```

La segunda necesita Playwright (`npm install playwright`). Con `--capturas`
deja imágenes de cada pantalla en `pruebas/capturas/`.

Entre las comprobaciones hay una que importa más que las otras: **una jornada
normal no debe producir ninguna advertencia**. En terreno, un aviso que aparece
siempre se aprende a cerrar sin leer, y entonces deja de servir cuando algo pasa
de verdad.

## Cómo se decide qué avisar

El sistema mide algo que todavía no se conoce, así que no hay contra qué
contrastar: un dato malo no se delata después. La regla es:

- **Se detiene** solo lo imposible: hora de término anterior a la de inicio, cero
  trabajadores, campos obligatorios vacíos.
- **Se avisa y se deja guardar** lo raro pero posible: una cantidad muy superior
  al ritmo de referencia, una jornada más larga que la estándar, una fecha fuera
  del período o en día no hábil. El aviso muestra el número que va a quedar
  guardado y pide confirmar.
- **No se avisa nada** cuando la EDT no define una referencia. Una actividad sin
  meta muestra lo medido y no inventa un número de comparación.

## Los tres números de versión

Un cambio no llega al equipo en terreno solo por estar escrito. Hay tres marcas
que deben subir juntas, y ninguna avisa si se queda atrás:

| Dónde | Qué pasa si no sube |
|---|---|
| `APP_VERSION` en `js/version.js` | No hay forma de saber qué versión tiene cada teléfono |
| `CACHE` en `sw.js` | Un teléfono que ya abrió la aplicación sigue sirviendo los archivos viejos |
| `KPI_VERSION` en `apps-script/Codigo.gs` | La planilla conserva el diseño anterior, porque el script corta apenas ve la misma versión |

`node herramientas/verificar_versiones.js` comprueba que las tres coincidan, y
esa comprobación también corre dentro de `node pruebas/ejecutar.js`.

## Qué falta para dejar de ser beta

- Confirmar si 1.1 y 10.1 se registran en la aplicación.
- Definir el catálogo de personas que registran. Hoy es un campo de texto libre,
  y eso significa que «J. Pérez» y «Juan Pérez» se cuentan como dos personas
  distintas en cualquier análisis.
- Cargar los valores económicos reales. Mientras estén vacíos, los indicadores
  de costo muestran una raya.
- Probar la sincronización contra la planilla real. Lo que está probado hasta
  ahora es el Apps Script contra una planilla simulada.
