# Registro en terreno — Fundación Chile / María Pinto

Aplicación web instalable para **registrar en terreno** las actividades del
proyecto. Funciona sin conexión y sincroniza contra una planilla de Google, que
es donde se calculan los indicadores.

> **Versión beta (0.1.0-beta).** La EDT todavía puede cambiar y hay dos
> actividades cuyo registro en la aplicación está por confirmar.

## Cómo está repartido el trabajo

| | Qué hace |
|---|---|
| **La aplicación** | Captura. Registra lo ejecutado y calcula la jornada: duración, colación y horas-hombre. Nada más. |
| **La planilla de Google** | Calcula. Avance, rendimiento, plazo y costo, con fórmulas que se recalculan solas cada vez que llega un registro. |

Esa separación es deliberada. Los indicadores se miran en un escritorio y se
cruzan con otras cosas; el teléfono en terreno solo tiene que registrar rápido y
sin depender de la señal. Es el mismo reparto del proyecto hermano
(`Neecocad/santiago-solar-replante`), que ya está probado en terreno.

## Cómo se usa

1. Abrir la dirección de la aplicación en el teléfono y agregarla a la pantalla
   de inicio. Desde ese momento funciona aunque no haya señal.
2. **Registrar**: elegir la actividad, revisar el horario que viene puesto,
   indicar cuántas personas trabajaron y cuánto se ejecutó. La duración, las
   horas-hombre y el rendimiento salen solos.
3. **Registros**: revisar lo guardado y tocar «Sincronizar ahora» cuando haya
   señal.
4. **Exportar**: enlace a la planilla, copia de respaldo en Excel o JSON, y la
   dirección del Apps Script.
5. Los indicadores se miran **en la planilla**, en la hoja `KPI_MariaPinto`.

## La jornada

De **08:00 a 16:00 con 30 minutos de colación**: 7,5 horas efectivas por persona
y día hábil.

La colación se descuenta **solo cuando el tramo registrado cubre la ventana de
colación** (13:00 a 13:30). Descontar siempre media hora fallaría en un caso
frecuente: si una cuadrilla registra la mañana (08:00 a 13:00) y la tarde (13:30
a 16:00) por separado, restaría una hora que sí se trabajó y bajaría el
rendimiento medido sin que nadie lo note.

## Qué actividades aparecen y cuáles no

La EDT tiene **32 actividades**. En la aplicación aparecen **11**:

| Aparecen | Motivo |
|---|---|
| 2.1 a 2.9 (conservación de suelos y aguas) | La EDT las marca con registro en la aplicación |
| 1.1 Informe de diseño de obras | La EDT dice «por confirmar» |
| 10.1 Ejecución de jornada de educación | La EDT dice «por confirmar» |

Las otras **21** quedan fuera del formulario porque la EDT indica que no se
registran en la aplicación. No desaparecen: se listan en la pestaña Exportar y
llegan a la planilla marcadas como «No» en la columna `se_registra_en_app`.

Si se decide que las dos «por confirmar» tampoco van, se cambia
`INCLUIR_POR_CONFIRMAR = False` en `herramientas/generar_config.py` y se regenera.

## Hojas que crea en la planilla

| Hoja | Qué tiene |
|---|---|
| `Registros_MariaPinto` | Una fila por registro. Los campos propios de cada actividad se agregan como columnas al final la primera vez que aparecen, sin descuadrar lo ya escrito. |
| `KPI_MariaPinto` | Plazo, avance por actividad, horas-hombre y esfuerzo, ritmo diario contra el plazo, costos, costo por unidad, y tablas por sector, por persona y día a día. |
| `Costos_MariaPinto` | Los valores económicos **que se llenan a mano**: costo de la hora-hombre, arriendo de camioneta, arriendo de baños y filas para costos extras. |

**El script nunca sobreescribe un valor cargado a mano en `Costos_MariaPinto`.**
Crea las filas que falten y deja el resto intacto.

## Los indicadores

Salen de la hoja `04_KPI_Definiciones` de la EDT:

- **Avance**: ejecutado, % contra la meta, cuánto falta, días con registro.
- **Esfuerzo**: horas-hombre, unidades por HH, HH por unidad, dotación y jornada
  promedio, HH estimadas para terminar.
- **Ritmo contra el plazo**: meta diaria teórica, ritmo real por día con
  registro, avance esperado a hoy, desviación y ritmo requerido para llegar al
  01-10-2026.
- **Costos**: mano de obra a la fecha, camioneta y baños prorrateados por día
  hábil, extras, costo total, proyección al término y costo por unidad ejecutada.

Dos reglas que valen para toda la hoja:

- **Una actividad sin meta en la EDT no muestra porcentaje ni desviación.** No
  hay contra qué compararla, y un número inventado después se cita como si
  hubiera sido medido.
- **El costo unitario de mano de obra es un dato duro**; el costo con indirectos
  prorrateados es una **estimación**, y así se rotula en la planilla.

## Cómo está armado

```
index.html                      tres pantallas: Registrar / Registros / Exportar
css/estilos.css
js/
  version.js                    APP_VERSION
  config-actividades.js         GENERADO desde la EDT — no editar a mano
  calculos.js                   jornada, horas-hombre y avisos
  almacenamiento.js             guardado local y estado de sincronización
  formulario.js                 arma el formulario desde la configuración
  sincronizacion.js             envío al Apps Script
  exportar.js                   respaldo en Excel y JSON
  xlsx-minimo.js                generador de Excel sin dependencias
  app.js                        conecta todo
sw.js                           funcionamiento sin conexión
apps-script/Codigo.gs           recibe los datos y mantiene las hojas calculadas
especificacion/*.xlsx           la EDT: fuente de verdad
herramientas/
  generar_config.py             EDT -> js/config-actividades.js + bloque del Apps Script
  verificar_versiones.js        comprueba las tres marcas de versión
pruebas/                        comprobaciones automáticas
```

**Ni el formulario ni la lista de actividades del Apps Script se escriben a
mano.** Los dos salen de la planilla de `especificacion/`:

```bash
python3 herramientas/generar_config.py
```

Si las dos listas se separaran, la hoja KPI mostraría actividades que el
formulario ya no ofrece, o dejaría fuera una que sí se está registrando.

## Cómo comprobar que funciona

```bash
node pruebas/ejecutar.js          # versiones, archivos, cálculos, Apps Script simulado
node pruebas/prueba_navegador.js  # la aplicación en Chromium de verdad
```

La segunda necesita Playwright (`npm install playwright`). Con `--capturas` deja
imágenes de cada pantalla en `pruebas/capturas/`.

Entre las comprobaciones hay una que importa más que las otras: **una jornada
normal no debe producir ninguna advertencia**. En terreno, un aviso que aparece
siempre se aprende a cerrar sin leer, y entonces deja de servir cuando algo pasa
de verdad.

## Cómo se decide qué avisar

- **Se detiene** solo lo imposible: hora de término anterior a la de inicio, cero
  trabajadores, campos obligatorios vacíos.
- **Se avisa y se deja guardar** lo raro pero posible: una cantidad muy superior
  al ritmo de referencia, un acumulado que pasa la meta, una jornada más larga
  que la estándar, una fecha fuera del período o en día no hábil. El aviso
  muestra el número que va a quedar guardado y pide confirmar.
- **No se avisa nada** cuando la EDT no define una referencia.

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

- **Comprobar la primera sincronización real.** La planilla
  (**BD_FundacionChile**), el identificador en el Apps Script y la dirección
  `/exec` en la aplicación ya están puestos; falta guardar un registro de prueba,
  sincronizar y revisar que la hoja `KPI_MariaPinto` muestre números y no
  `#ERROR!`. Ver el paso 4 de `docs/como_publicar.md`.
- **Publicar la aplicación** en GitHub Pages.
- Confirmar si 1.1 y 10.1 se registran en la aplicación.
- Definir el catálogo de personas. Hoy es texto libre, y eso significa que
  «J. Pérez» y «Juan Pérez» se cuentan como dos personas distintas en la hoja
  «Por persona».
- Cargar los valores económicos en `Costos_MariaPinto`.
- Probar la primera sincronización real. Lo probado hasta ahora es el Apps Script
  contra una planilla simulada.
