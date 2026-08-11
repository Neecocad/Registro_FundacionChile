# Contexto para Claude

> Preparado a partir del proyecto Santiago Solar — Replante.
> Completa las secciones marcadas con «COMPLETAR» y borra esta nota.

## Cómo comunicarse en este proyecto

Quien mantiene este repositorio **no es programador de oficio** y quiere entender
lo que se construye. Además de ejecutar, se espera un **rol pedagógico**:
explicar el porqué de cada decisión, traducir el término técnico la primera vez,
señalar dónde algo puede fallar en silencio, y decir qué mirar para comprobar
que funciona.

Se escribe en **español neutro**, sin modismos ni voseo. Quien mantiene el
repositorio es chileno: nada de "vos", "acá", "fijate", "andá", "decime". Usar
"tú" o formas impersonales. Esto vale para las respuestas, los comentarios del
código, los mensajes de commit y la documentación.

## Qué es este proyecto

Formulario de registro en terreno para **Fundación Chile**.

COMPLETAR: qué se registra, quién lo usa, con qué frecuencia, y a qué planilla
llega.

Es un pariente cercano de la PWA de replante de Santiago Solar
(`Neecocad/santiago-solar-replante`): captura sin conexión, cálculo de
horas-hombre y rendimiento a partir de lo registrado, y sincronización a una
planilla de Google mediante Apps Script. **Conviene revisar ese repositorio
antes de resolver algo desde cero**: la estructura de `js/`, el esquema de
columnas y la hoja de indicadores ya están resueltos ahí y probados en terreno.

## Reglas que no se deben romper

COMPLETAR con las de este proyecto. Del proyecto hermano se heredan estas, que
resultaron ser las que más costó descubrir:

- **Duración y horas-hombre son calculados**, nunca campos que la persona llena.
- **Offline primero**: registrar nunca puede depender de que haya red. Cualquier
  validación que exija consultar el servidor rompe esta regla.
- **Una actividad sin valor de referencia no genera alerta**, solo muestra lo
  medido. Nunca inventar un número de comparación.
- **El formulario se genera desde la especificación**, no se escribe a mano. Si
  cambia la especificación, se regenera el archivo de configuración. Ojo: editar
  ese archivo a mano funciona, pero el cambio se pierde en la próxima
  regeneración, así que hay que reflejarlo también en la fuente.

## Lecciones del proyecto hermano

Estas salieron de errores reales. Vale la pena leerlas antes de dar algo por
terminado.

### Un cambio no llega al usuario solo por estar escrito

Hubo tres marcas de versión que había que subir para que el cambio se propagara,
y ninguna avisaba al quedarse atrás:

- `KPI_VERSION` en el Apps Script: si no sube, la planilla conserva el diseño
  viejo para siempre, porque el script corta apenas ve la misma versión.
- `CACHE` en `sw.js` y `VERSION` en la app: si no suben, un equipo sin señal
  sigue sirviendo los archivos viejos y no hay forma de saber qué versión tiene
  cada teléfono.

Al terminar un cambio, la pregunta no es "¿está el código correcto?" sino
"¿por qué camino llega esto al equipo en terreno, y ese camino está abierto?".

### Hay mecanismos escritos que nunca se ejecutan

Aparecieron dos, y ninguno daba error:

- El código ocultaba un campo agregando una clase CSS que **no estaba definida**
  en la hoja de estilos. La instrucción corría y no hacía nada.
- Una función calculaba un acumulado para advertir cuando se supera la meta —así
  lo decía su propio comentario— pero **no se llamaba desde ninguna parte**.

Los dos parecían completos al leer el código. Leer no basta: hay que ejecutar la
rama concreta y mirar el resultado.

### Verificar contando no es verificar

Una simulación informó "45 columnas creadas" cuando correspondían 26, y el
número pasó sin ser cuestionado porque la comprobación solo miraba que cierto
campo estuviera presente. La hoja nació con las columnas duplicadas.

Una comprobación tiene que afirmar la propiedad que importa —"ninguna columna se
repite"— y no un número que hay que interpretar.

### Los datos malos se guardan sin protestar

Invertir las horas al escribirlas (15:00 a 07:30) producía una jornada de 16,5
horas y reportaba la mitad del rendimiento real, sin ninguna advertencia. Una
cantidad diez veces superior a la meta también se guardaba.

Cuando el propósito del sistema es **medir algo que todavía no se conoce**, no
hay contra qué contrastar: un dato malo no se delata después. Conviene avisar al
momento de escribirlo, mostrando el número resultante y pidiendo confirmación,
sin bloquear.

### Borrar en un lado no borra en el otro

Eliminar un registro ya sincronizado lo sacaba del dispositivo pero dejaba su
fila en la planilla, sin mencionarlo. Si no se puede resolver la divergencia,
al menos hay que hacerla visible.

## Al trabajar aquí

- **Verificar de verdad.** La app en Chromium con Playwright; el Apps Script
  contra una planilla simulada en Node, porque no se puede ejecutar localmente.
- **Incluir siempre un caso de control.** Una corrección que interrumpe el uso
  normal es peor que el problema que resuelve: en terreno, un aviso que aparece
  siempre se aprende a cerrar sin leer. Comprobar que el camino habitual sigue
  sin fricción.
- **El paso manual hay que recordarlo cada vez.** Cambiar el Apps Script no
  basta: hay que pegarlo en el editor de Google y volver a implementar.
- **En Apps Script, "Nueva versión" y "Nueva implementación" no son lo mismo.**
  La primera conserva la URL. La segunda entrega otra URL y deja la anterior
  viva sirviendo el código antiguo, lo que puede dejar a unos equipos escribiendo
  contra una versión y a otros contra otra.
- **No borrar una hoja a la que apuntan fórmulas.** En Google Sheets las
  referencias a una hoja eliminada quedan en `#REF!` y no se recuperan al crear
  otra con el mismo nombre.
