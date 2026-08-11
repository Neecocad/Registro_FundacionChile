# Cómo publicar la aplicación y el Apps Script

Son dos publicaciones distintas y ninguna reemplaza a la otra: la aplicación es
lo que se abre en el teléfono, y el Apps Script es lo que recibe los datos y
mantiene las hojas calculadas de la planilla.

---

## 1. La planilla

Ya está creada: **BD_FundacionChile**, y su identificador ya está escrito en
`apps-script/Codigo.gs` (`ID_PLANILLA`). No hay nada que hacer en este paso.

No hay que crear ninguna hoja a mano. El script crea las tres que necesita
(`Registros_MariaPinto`, `KPI_MariaPinto`, `Costos_MariaPinto`) la primera vez
que llega un registro. La «Hoja 1» que trae la planilla nueva se puede dejar
donde está o renombrar; el script no la toca.

Si algún día hay que apuntar a otra planilla, se cambia `ID_PLANILLA`: es lo que
va entre `/d/` y `/edit` en la dirección de la planilla. Es el único valor que
hay que tocar.

---

## 2. El Apps Script

### Primera vez

1. Ir a `script.google.com/home` → **Nuevo proyecto**.

   **Proyecto independiente, no desde Extensiones → Apps Script de la planilla.**
   Una planilla admite un solo script incrustado, y ese lugar puede quedar
   ocupado por otra aplicación que escriba en otras hojas de la misma planilla.

2. Borrar lo que traiga el editor y pegar el contenido completo de
   `apps-script/Codigo.gs`. Ya viene con el identificador de la planilla puesto.
3. Guardar.
4. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
5. Autorizar los permisos que pida Google. Va a pedir permiso para ver y
   administrar planillas: es para poder escribir en BD_FundacionChile.
6. Copiar la dirección que termina en `/exec`.

> Si «Quién tiene acceso» queda en cualquier otra opción, Google responde con una
> página de inicio de sesión en vez de datos. La aplicación detecta ese caso y lo
> dice con esas palabras, pero conviene saber de dónde viene.

### Comprobar de inmediato

Abrir la dirección `/exec` en el navegador. Responde con el **nombre de la
planilla donde escribe de verdad**, no con lo que diga el repositorio. Si ahí
aparece otra planilla, el resto no tiene sentido.

### Cada vez que cambie `Codigo.gs`

**Este paso hay que recordarlo siempre: cambiar el archivo en el repositorio no
cambia nada en Google.**

1. Pegar el contenido nuevo en el editor de Apps Script.
2. Guardar.
3. **Implementar → Administrar implementaciones** → editar (el lápiz) la que ya
   existe → Versión: **Nueva versión** → Implementar.
4. Si cambió el diseño de las hojas calculadas, ejecutar
   **`reconstruirIndicadores`**: en la barra superior del editor, elegir esa
   función en la lista y presionar **Ejecutar**.

   Sin ese paso, la hoja KPI se rehace recién cuando llega el próximo registro.
   Si el equipo no está sincronizando en ese momento, la planilla se queda con
   el diseño anterior y nada lo advierte.

   La función no toca la hoja de registros ni los valores cargados a mano en la
   de costos.

**«Nueva versión» y «Nueva implementación» no son lo mismo.**

| | Qué hace |
|---|---|
| Nueva versión | Conserva la misma dirección. Todos los teléfonos siguen sirviendo. |
| Nueva implementación | Entrega **otra** dirección. La anterior queda viva sirviendo el código viejo, así que unos equipos escribirían contra una y otros contra otra. |

Si de todas formas se crea una implementación nueva, hay que hacer **dos** cosas:
pegar la dirección nueva en `DIRECCION_POR_DEFECTO` (`js/sincronizacion.js`) **y**
subir el sufijo de `CLAVE_URL` en ese mismo archivo. Sin lo segundo, los
teléfonos que tengan una dirección escrita a mano la conservan guardada y le
seguirían escribiendo a la implementación antigua.

### Si se cambió el diseño de las hojas calculadas

Subir `KPI_VERSION` en `Codigo.gs`. Si no sube, el script corta apenas ve la
misma versión guardada y la planilla conserva el diseño anterior para siempre,
sin dar ningún error.

`reconstruirIndicadores` rehace la hoja de todas formas, aunque la versión no
haya cambiado: se ejecuta a mano y por eso no consulta la versión guardada.

El script **no elimina hojas**, a propósito: en Google Sheets, las fórmulas que
apuntan a una hoja eliminada quedan en `#REF!` y no se recuperan al crear otra
con el mismo nombre. Si hay que rehacer una hoja, se renombra la anterior y se
deja ahí.

---

## 3. La aplicación

La dirección `/exec` ya está puesta en `js/sincronizacion.js`
(`DIRECCION_POR_DEFECTO`), así que los teléfonos la traen y nadie tiene que
escribirla.

1. En el repositorio: **Settings → Pages** → Deploy from a branch, rama `main`,
   carpeta `/ (root)`.
2. En el teléfono: abrir la dirección que entrega GitHub y, en el menú del
   navegador, «Agregar a la pantalla de inicio».

### Al publicar una versión nueva

Antes de subir los cambios:

```bash
node pruebas/ejecutar.js
```

Comprueba, entre otras cosas, que las tres marcas de versión coincidan y que el
service worker guarde todos los archivos que la aplicación carga. Si algo no
calza, falla y dice qué.

Después de publicar, el teléfono toma la versión nueva la próxima vez que se abra
con señal. Sin señal sigue con la anterior, que es justamente lo que se busca.

---

## 4. Comprobar que quedó bien

En un teléfono con la aplicación abierta:

1. En **Exportar**, el recuadro de arriba dice en qué planilla escribe y muestra
   el enlace para abrirla.
2. Guardar un registro de prueba y sincronizar.
3. En la planilla, revisar:
   - `Registros_MariaPinto` tiene una fila nueva con su `record_id`, y **ninguna
     columna repetida**.
   - `KPI_MariaPinto` muestra números y no `#ERROR!` ni `#REF!`.
   - `Costos_MariaPinto` tiene las filas de costo de hora-hombre, camioneta y
     baños, vacías y listas para llenar.
4. Escribir un valor en `Costos_MariaPinto` y volver a sincronizar: **el valor
   tiene que seguir ahí**. El script agrega filas que falten, pero nunca
   sobreescribe lo cargado a mano.
5. Borrar el registro de prueba desde la aplicación y sincronizar otra vez: la
   fila de la planilla debe quedar con `registro_activo` en falso y dejar de
   sumar en el KPI.

El paso 5 importa: borrar en el teléfono no borra en la planilla por sí solo. La
baja viaja recién al sincronizar, y la aplicación lo advierte al eliminar.
