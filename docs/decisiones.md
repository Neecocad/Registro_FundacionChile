# Decisiones tomadas al implementar la EDT

Este archivo explica **por qué** el sistema quedó como quedó, sobre todo donde la
EDT no daba una respuesta única. Sirve para discutirlo con fundamento y para no
repetir la conversación en seis meses.

---

## 1. La aplicación registra; la planilla calcula

**Decisión:** la aplicación no calcula ningún indicador. Captura registros y
calcula solo lo que necesita el propio registro (duración, colación,
horas-hombre). El avance, el rendimiento, el plazo y el costo se calculan en la
planilla de Google, con fórmulas vivas.

**Por qué así:**

- Los indicadores se miran sentado, en un computador, y se cruzan con cosas que
  la aplicación no conoce. El teléfono en terreno solo tiene que registrar rápido.
- Cada teléfono ve **solo lo que registró él**. Un indicador calculado en la
  aplicación mostraría el avance de un teléfono como si fuera el del proyecto, y
  eso es peor que no mostrar nada: se ve creíble y es falso.
- Las fórmulas de la planilla se recalculan solas. No hay un segundo lugar donde
  el cálculo pueda quedar desactualizado.

Es el mismo reparto del proyecto hermano (`santiago-solar-replante`), donde ya
está probado en terreno.

**Lo único que la aplicación sigue calculando** es lo que necesita para avisar en
el momento de escribir: la jornada y los avisos. Eso no puede esperar a la
planilla, porque para entonces la persona ya se fue del cerro.

---

## 2. Qué actividades aparecen en la aplicación

**Decisión:** aparecen las 11 actividades que la EDT no marca explícitamente con
«No» en la columna `registro_app_fuente`. Las 21 restantes no se ofrecen.

**Por qué así:** el encargo fue que no aparecieran los puntos que dicen que no se
registran en la aplicación. «Por confirmar» no es «No», así que 1.1 (Informe de
diseño de obras) y 10.1 (Ejecución de jornada de educación) sí aparecen, con la
etiqueta «por confirmar» a la vista.

**Qué hacer si se decide lo contrario:** cambiar `INCLUIR_POR_CONFIRMAR = False`
en `herramientas/generar_config.py` y volver a ejecutar el generador. Bajan a 9
actividades, tanto en el formulario como en la hoja KPI, sin tocar nada más.

**Qué se conserva igual:** las 32 actividades de la EDT siguen existiendo.
Sacarlas del formulario no las borra de la planificación.

---

## 3. La jornada y la colación

**Dato del proyecto:** de 08:00 a 16:00 con 30 minutos de descanso. Es decir, 8
horas de presencia y **7,5 horas efectivas** por persona y día hábil.

**Decisión:** la colación se descuenta solo cuando el tramo horario registrado se
solapa con una ventana de colación (13:00 a 13:30), y se descuenta únicamente el
tiempo de solape.

**Por qué así:** la alternativa obvia —descontar siempre 30 minutos— falla en un
caso frecuente. Si una cuadrilla registra la mañana (08:00 a 13:00) y la tarde
(13:30 a 16:00) por separado, descontar media hora a cada tramo restaría una hora
de trabajo que sí ocurrió, y bajaría el rendimiento medido sin que nadie se dé
cuenta. Con la regla del solape, esos dos tramos suman exactamente 7,5 horas.

**Dónde se cambia:** `JORNADA` en `herramientas/generar_config.py`. La hora de la
colación es un supuesto: si en terreno se toma a otra hora, hay que corregirla
ahí y regenerar.

**Lo que se ve en pantalla:** el panel de cálculo muestra las tres cifras por
separado —duración bruta, descuento de colación, duración trabajada— y explica en
palabras por qué descontó o por qué no.

---

## 4. Qué se detiene, qué se avisa y qué se deja pasar

| Situación | Qué hace la aplicación |
|---|---|
| Hora de término anterior a la de inicio | **Detiene.** No hay jornada posible. |
| Cero trabajadores | **Detiene.** |
| Campo obligatorio vacío | **Detiene** y nombra cuáles faltan. |
| Cantidad más de 3 veces el ritmo de referencia | **Avisa**, muestra el número y pide confirmar. |
| El acumulado del teléfono pasa la meta de la actividad | **Avisa.** |
| Jornada más larga que la estándar | **Avisa.** |
| Fecha fuera del período o en día no hábil | **Avisa.** |
| Actividad sin meta en la EDT | **No dice nada.** Muestra lo medido. |

**Por qué no bloquear más:** en terreno, un registro bloqueado es un registro
perdido. Y cuando el propósito del sistema es medir algo que todavía no se
conoce, no hay contra qué contrastar: un dato malo no se delata después. Lo único
que se puede hacer es mostrar el número que va a quedar guardado en el momento de
escribirlo.

**Por qué no avisar más:** un aviso que aparece siempre se aprende a cerrar sin
leer. Por eso hay una comprobación automática que verifica que **una jornada
normal no produce ninguna advertencia**.

**Sobre el aviso por acumulado:** cuenta solo lo registrado en ese teléfono, y el
mensaje lo dice. En el proyecto hermano existía una función que calculaba este
acumulado —lo decía su propio comentario— pero no se llamaba desde ninguna parte,
así que el aviso nunca apareció. Acá se llama, y hay dos comprobaciones que
verifican que el aviso sale de verdad: una sobre el cálculo y otra en pantalla.

---

## 5. Los indicadores de la planilla

Salen de la hoja `04_KPI_Definiciones` de la EDT. Tres decisiones que no estaban
ahí:

**Se compara ritmo diario contra ritmo diario.** La EDT no entrega un rendimiento
por persona; entrega una meta total y un plazo. Así que la comparación honesta es
entre lo que se está logrando por día hábil y lo que habría que lograr
(`meta ÷ 36`). Comparar el rendimiento por persona contra la meta diaria mezclaría
dos cosas distintas y daría un cumplimiento sin sentido.

**Con menos de 3 días con registro, el ritmo se informa como preliminar.** Con uno
o dos días el número es anecdótico: un día de lluvia o un terreno duro lo mueven
entero. La hoja lo dice con esas palabras en vez de alertar sobre un dato que
todavía no significa nada.

**Una actividad sin meta no muestra porcentaje ni desviación.** No hay contra qué
compararla. Muestra lo ejecutado y su ritmo medido, y nada más.

---

## 6. Los costos

**Decisión:** los valores económicos se llenan **en la planilla**, en la hoja
`Costos_MariaPinto`, no en la aplicación.

**Por qué así:** quien carga costos no es la persona que está en el cerro con el
teléfono. Es la misma razón por la que los indicadores viven en la planilla.

| Valor | Cómo se pide |
|---|---|
| Costo de la hora-hombre | Un monto en pesos. Es una tarifa unitaria, así que no se convierte a total del proyecto. |
| Arriendo de camioneta | Monto + periodicidad |
| Arriendo de baños | Monto + periodicidad |
| Costos extras | Diez filas en blanco, listas para escribir concepto y monto |

**Por qué la periodicidad:** un arriendo se puede haber acordado por mes, por día
hábil o por el proyecto entero. Pedir solo un número obligaría a hacer la
conversión a mano y a equivocarse en silencio. La hoja convierte cada monto a
total del proyecto **en una columna a la vista**, para que la conversión se pueda
revisar.

**La periodicidad es una lista cerrada.** Escribir «mensual» en vez de «Por mes»
haría que la conversión devolviera el monto sin convertir, sin avisar de nada.

**El script nunca sobreescribe un valor cargado a mano.** Crea las filas que
falten y deja el resto intacto. Si reescribiera la hoja en cada sincronización,
el equipo perdería lo cargado y no habría forma de notarlo hasta ver un indicador
raro. Hay una comprobación automática dedicada a esto.

**Dos números con nombres distintos, a propósito:**

- **Costo unitario de mano de obra**: dato duro. Horas-hombre registradas por el
  valor de la hora.
- **Costo unitario con indirectos**: estimación. Reparte camioneta y baños entre
  las actividades según su participación en las horas-hombre. Ese reparto es un
  supuesto, no una medición, y así se rotula en la hoja.

**Mientras falte un valor, el indicador queda en blanco** y la hoja dice «Faltan
valores por cargar». No se rellena con cero ni con un promedio.

**Este bloque es el único que está en prueba.** Las dos secciones económicas de
la hoja KPI van rotuladas «EN PRUEBA» y la hoja de costos lleva una nota que dice
lo mismo. El registro y los indicadores de avance, rendimiento y plazo ya son
definitivos; los económicos hay que contrastarlos con los costos reales del
proyecto antes de usarlos para decidir.

---

## 7. Borrar

Un registro que todavía no se sincronizó se borra del teléfono y no queda rastro.

Un registro **ya sincronizado** no se borra: se marca como baja y queda pendiente
de enviar. La aplicación lo dice explícitamente al eliminar, porque borrarlo del
teléfono dejaría su fila viva en la planilla sin que nadie se entere. La baja
llega al sincronizar, y ahí la fila queda con `registro_activo` en falso. Todas
las fórmulas del KPI filtran por esa columna, y hay una comprobación que recorre
cada fórmula de la hoja para asegurarlo.

---

## 8. Persona y sector se eligen de una lista

**Decisión:** los dos campos son listas cerradas. Las personas son Franklin
Nettle, Cristian Diaz y Maria Paz Quiroz; los sectores, Las Mercedes e Ibacache.

**Por qué así:** la EDT dejaba la persona como texto libre, con el catálogo «por
definir». Con texto libre, «J. Pérez» y «Juan Pérez» cuentan como dos personas
distintas en la tabla «Por persona» de la hoja KPI, y eso no se nota hasta que
alguien mira ese cuadro y no le calzan las horas.

**Dónde se cambia:** en la hoja `03_Catalogos` de la planilla de especificación,
catálogo `PERSONAS_FCH`, y después `python3 herramientas/generar_config.py`. Si
entra o sale gente del equipo, ese es el único lugar que hay que tocar.

**Qué se guarda y qué viaja:** por dentro se guarda un código estable
(`FRANKLIN_NETTLE`), pero a la planilla viaja el nombre visible. Si viajara el
código, la tabla «Por persona» diría `FRANKLIN_NETTLE`. La traducción se resuelve
desde la configuración y no campo por campo, así que un catálogo nuevo no obliga
a acordarse de agregarla.

---

## 9. Lo que quedó pendiente

- **Crear la planilla, implementar el Apps Script y pegar las dos direcciones.**
  Ver `docs/como_publicar.md`.
- **Confirmar 1.1 y 10.1.** Hoy aparecen marcadas «por confirmar».
- **Probar contra la planilla real.** Lo probado es el Apps Script contra una
  planilla simulada en Node. La primera sincronización real hay que mirarla.
- **Cargar los valores económicos** en `Costos_MariaPinto`.
