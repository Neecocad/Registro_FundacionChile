# Decisiones tomadas al implementar la EDT

Este archivo explica **por qué** el sistema quedó como quedó, sobre todo en los
puntos donde la EDT no daba una respuesta única. Sirve para discutir la beta con
fundamento y para no repetir la conversación en seis meses.

---

## 1. Qué actividades aparecen en la aplicación

**Decisión:** aparecen las 11 actividades que la EDT no marca explícitamente con
«No» en la columna `registro_app_fuente`. Las 21 restantes no se ofrecen para
registrar.

**Por qué así:** el encargo fue que no aparecieran los puntos que dicen que no se
registran en la aplicación. «Por confirmar» no es «No», así que 1.1 (Informe de
diseño de obras) y 10.1 (Ejecución de jornada de educación) sí aparecen, con la
etiqueta «por confirmar» a la vista.

**Qué hacer si se decide lo contrario:** cambiar `INCLUIR_POR_CONFIRMAR = False`
en `herramientas/generar_config.py` y volver a ejecutar el generador. Bajan a 9
actividades y las otras dos pasan a la lista de excluidas, sin tocar nada más.

**Qué se conserva igual:** las 32 actividades de la EDT viajan a la planilla, con
una columna que dice cuáles se registran en la aplicación y cuáles no. Sacarlas
del formulario no significa borrarlas de la planificación.

---

## 2. La jornada y la colación

**Dato del proyecto:** de 08:00 a 16:00 con 30 minutos de descanso. O sea, 8
horas de presencia y **7,5 horas efectivas** por persona y día hábil.

**Decisión:** la colación se descuenta solo cuando el tramo horario registrado se
solapa con una ventana de colación (13:00 a 13:30), y se descuenta únicamente el
tiempo de solape.

**Por qué así:** la alternativa obvia —descontar siempre 30 minutos— falla en un
caso frecuente. Si una cuadrilla registra la mañana (08:00 a 13:00) y la tarde
(13:30 a 16:00) por separado, descontar 30 minutos a cada tramo restaría una hora
de trabajo que sí ocurrió, y bajaría el rendimiento medido sin que nadie se dé
cuenta. Con la regla del solape, esos dos tramos suman exactamente 7,5 horas.

**Dónde se cambia:** `JORNADA` en `herramientas/generar_config.py`. La hora de la
colación es un supuesto: si en terreno se toma a otra hora, hay que corregirla
ahí y regenerar.

**Lo que se ve en pantalla:** el panel de cálculo muestra las tres cifras por
separado —duración bruta, descuento de colación, duración trabajada— y explica en
palabras por qué descontó o por qué no. El número no aparece sin explicación.

---

## 3. Qué se detiene, qué se avisa y qué se deja pasar

| Situación | Qué hace el sistema |
|---|---|
| Hora de término anterior a la de inicio | **Detiene.** No hay jornada posible. |
| Cero trabajadores | **Detiene.** |
| Campo obligatorio vacío | **Detiene** y nombra cuáles faltan. |
| Cantidad más de 3 veces el ritmo de referencia | **Avisa**, muestra el número y pide confirmar. |
| Cantidad mayor que la meta total de la actividad | **Avisa.** |
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
normal no produce ninguna advertencia**; si esa comprobación falla, el sistema se
volvió ruidoso y los avisos dejaron de servir.

---

## 4. Los indicadores de rendimiento

Salen de la hoja `04_KPI_Definiciones` de la EDT, sin agregar nada:

- Rendimiento por hora-hombre, horas-hombre por unidad, ritmo de cuadrilla,
  tamaño medio de cuadrilla.
- Avance acumulado y porcentaje de avance (solo con meta).
- Meta diaria teórica, avance esperado a la fecha, desviación y ritmo requerido
  para el plazo restante.

**Dos decisiones que no estaban en la EDT:**

1. **El porcentaje de avance por sector no se calcula.** Las metas de la EDT son
   del proyecto completo, no de cada sector. Repartirlas a la mitad entre Las
   Mercedes e Ibacache sería inventar una referencia que nadie definió. Por sector
   se muestra lo ejecutado y el rendimiento, que sí son medidas directas.

2. **Sin registros, los indicadores muestran una raya y no un cero.** Un cero se
   lee como «se midió cero» y no como «no lo sé».

---

## 5. Los indicadores económicos

Los valores no vienen de ninguna parte: los carga a mano quien administra el
proyecto, en la pestaña **Costos**.

| Valor | Cómo se pide |
|---|---|
| Costo de la hora-hombre | Un monto en pesos |
| Arriendo de camioneta | Monto + periodicidad (por día hábil, por mes o total del proyecto) |
| Arriendo de baños | Monto + periodicidad |
| Costos extras | Lista libre de concepto y monto |

**Por qué la periodicidad:** un arriendo se puede haber acordado por mes, por día
o por el proyecto entero. Pedir solo un número obligaría a hacer la conversión a
mano y a equivocarse en silencio. El sistema lleva todo a un costo por día hábil
usando los 36 días del plan.

**Qué se calcula:**

- Costo de mano de obra a la fecha = horas-hombre registradas × costo de la hora.
- Costo de camioneta y baños a la fecha = prorrateo por días hábiles transcurridos.
- Costo total a la fecha y proyección al término.
- Costo por unidad ejecutada de cada actividad.

**Dos números distintos y con nombres distintos a propósito:**

- **Costo unitario de mano de obra**: dato duro. Sale de horas-hombre por valor
  de la hora, todo medido.
- **Costo unitario con indirectos**: estimación. Reparte camioneta y baños entre
  las actividades según su participación en las horas-hombre. Ese reparto es un
  supuesto, no una medición, y así se dice en pantalla.

**Mientras falte un valor, el indicador queda en blanco** y la pantalla dice cuál
falta. No se rellena con cero ni con un promedio.

**Ayuda para no escribir a ciegas:** al escribir el costo de la hora-hombre, la
pantalla traduce el número a costo por trabajador y día hábil, y a costo por
trabajador en todo el proyecto. Un error de un dígito se nota de inmediato.

---

## 6. Borrar

Un registro que todavía no se sincronizó se borra del teléfono y no queda rastro.

Un registro **ya sincronizado** no se borra: se marca como baja y queda pendiente
de enviar. La aplicación lo dice explícitamente al eliminar, porque borrarlo del
teléfono dejaría su fila viva en la planilla sin que nadie se entere. La baja
llega a la planilla recién al sincronizar, y ahí la fila queda con
`registro_activo` en falso; las fórmulas de indicadores solo suman las filas
vigentes.

---

## 7. Lo que quedó pendiente

- **Confirmar 1.1 y 10.1.** Hoy aparecen marcadas «por confirmar».
- **Catálogo de personas.** La EDT lo deja pendiente. Hoy es texto libre, lo que
  significa que «J. Pérez» y «Juan Pérez» se cuentan como dos personas distintas
  en cualquier análisis posterior. Cuando se defina la lista, se agrega como
  catálogo en la hoja `03_Catalogos` y se regenera la configuración.
- **Probar contra la planilla real.** Lo probado es el Apps Script contra una
  planilla simulada en Node. La primera sincronización real hay que mirarla.
- **Valores económicos reales.** Sin ellos, la mitad económica muestra rayas.
