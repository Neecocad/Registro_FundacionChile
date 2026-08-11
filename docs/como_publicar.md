# Cómo publicar la aplicación y el Apps Script

Son dos publicaciones distintas y ninguna reemplaza a la otra: la aplicación es
lo que se abre en el teléfono, y el Apps Script es lo que recibe los datos en la
planilla.

---

## 1. La planilla y el Apps Script

### Primera vez

1. Crear una planilla de Google nueva (o abrir la que se vaya a usar).
2. **Extensiones > Apps Script**.
3. Borrar lo que traiga el editor y pegar el contenido completo de
   `apps-script/Codigo.gs`.
4. Guardar.
5. **Implementar > Nueva implementación**.
   - Tipo: **Aplicación web**.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier persona**.
6. Autorizar los permisos que pida Google.
7. Copiar la dirección que termina en `/exec`. Esa es la que se pega en la
   pestaña **Ajustes** de la aplicación, en cada teléfono.

> Si «Quién tiene acceso» queda en cualquier otra opción, Google responde con una
> página de inicio de sesión en vez de datos. La aplicación lo detecta y muestra
> ese mensaje, pero conviene saber de dónde viene.

### Cada vez que cambie `Codigo.gs`

**Este paso hay que recordarlo siempre: cambiar el archivo en el repositorio no
cambia nada en Google.**

1. Pegar el contenido nuevo en el editor de Apps Script.
2. Guardar.
3. **Implementar > Administrar implementaciones**.
4. Editar (el lápiz) la implementación que ya existe.
5. Versión: **Nueva versión**. Implementar.

**«Nueva versión» y «Nueva implementación» no son lo mismo.**

| | Qué hace |
|---|---|
| Nueva versión | Conserva la misma dirección. Todos los teléfonos siguen sirviendo. |
| Nueva implementación | Entrega **otra** dirección y deja la anterior viva sirviendo el código antiguo. Si algunos equipos quedan apuntando a una y otros a la otra, los datos se parten en dos planillas de comportamiento distinto. |

Usar siempre «Nueva versión», salvo que se quiera deliberadamente una segunda
instalación separada.

### Si se cambió el diseño de las hojas

Además de subir `KPI_VERSION` en `Codigo.gs`, hay que recordar que el script
**no elimina hojas**. Es a propósito: en Google Sheets, las fórmulas que apuntan
a una hoja eliminada quedan en `#REF!` y no se recuperan al crear otra con el
mismo nombre. Si hay que rehacer una hoja, se renombra la anterior y se deja ahí.

---

## 2. La aplicación

La aplicación son archivos estáticos: sirve cualquier servidor web. Lo más
directo es GitHub Pages.

1. En el repositorio, **Settings > Pages**.
2. Source: **Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. Esperar el despliegue y abrir la dirección que entrega GitHub.

En el teléfono: abrir esa dirección, y en el menú del navegador elegir «Agregar a
la pantalla de inicio». Desde ahí funciona como una aplicación y sigue
funcionando sin señal.

### Al publicar una versión nueva

Antes de subir los cambios:

```bash
node herramientas/verificar_versiones.js
```

Si las tres marcas no coinciden, el comando falla y dice cuál está atrasada. Las
tres son:

- `APP_VERSION` en `js/version.js`
- `CACHE` en `sw.js`
- `KPI_VERSION` en `apps-script/Codigo.gs`

Después de publicar, el teléfono toma la versión nueva la próxima vez que se abra
con señal. Sin señal sigue con la anterior, que es justamente lo que se busca.

---

## 3. Comprobar que quedó bien

En un teléfono con la aplicación abierta:

1. La pestaña **Ajustes** muestra la versión esperada.
2. Guardar un registro de prueba y sincronizar.
3. En la planilla, revisar:
   - `07_Registro_Actividad` tiene una fila nueva con su `record_id`.
   - `08_Registro_Detalle` tiene la fila del parámetro específico.
   - `10_Indicadores` muestra números y no `#ERROR!` ni `#REF!`.
4. Borrar el registro de prueba desde la aplicación y volver a sincronizar: la
   fila de la planilla debe quedar con `registro_activo` en falso.

Ese último paso importa: borrar en el teléfono no borra en la planilla por sí
solo. La baja viaja recién al sincronizar, y la aplicación lo advierte al
eliminar.
