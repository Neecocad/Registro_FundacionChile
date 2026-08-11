#!/usr/bin/env python3
"""Genera js/config-actividades.js a partir de la planilla de especificacion (EDT).

Por que existe este script
--------------------------
El formulario de la aplicacion no se escribe a mano: se genera desde la EDT.
Si manana cambia una meta, una unidad de medida o se agrega un parametro, se
edita la planilla de `especificacion/` y se vuelve a ejecutar este script. Editar
`js/config-actividades.js` directamente tambien funciona, pero ese cambio se
pierde en la proxima regeneracion.

Uso:
    python3 herramientas/generar_config.py

Requiere: pip install openpyxl
"""

import datetime as dt
import json
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:  # pragma: no cover - depende del entorno
    sys.exit("Falta openpyxl. Instalar con: pip install openpyxl")

RAIZ = Path(__file__).resolve().parent.parent
PLANILLA = RAIZ / "especificacion" / "EDT_Fundacion_Chile_Maria_Pinto_KPI.xlsx"
SALIDA = RAIZ / "js" / "config-actividades.js"

# El Apps Script tambien necesita la lista de actividades, porque es el que arma
# la hoja de indicadores. Se escribe en el mismo archivo, entre estas marcas, en
# vez de mantenerla a mano en dos lugares: si las dos listas se separan, la hoja
# KPI queda mostrando actividades que el formulario ya no ofrece, y al reves.
APPS_SCRIPT = RAIZ / "apps-script" / "Codigo.gs"
MARCA_INICIO = "// <<< ACTIVIDADES GENERADAS — no editar a mano."
MARCA_FIN = "// >>> FIN ACTIVIDADES GENERADAS"

# Una actividad se muestra en la aplicacion salvo que la EDT diga explicitamente
# "No" en la columna registro_app_fuente. Las marcadas "Por confirmar" se
# muestran con una etiqueta visible; para ocultarlas basta cambiar esto a False
# y regenerar.
INCLUIR_POR_CONFIRMAR = True

# Jornada informada para este proyecto: 08:00 a 16:00 con 30 minutos de colacion.
# Vive aca (y no en el codigo de la aplicacion) porque es un dato del proyecto,
# no una decision de programacion.
JORNADA = {
    "hora_inicio": "08:00",
    "hora_termino": "16:00",
    "colacion_minutos": 30,
    # Ventana en que se toma la colacion. Solo se descuenta el tiempo de colacion
    # cuando el tramo registrado cubre esta ventana; asi, registrar la manana y
    # la tarde por separado no descuenta la colacion dos veces.
    "colacion_inicio": "13:00",
    "colacion_termino": "13:30",
}

# Traduccion del tipo de dato de la planilla al tipo de control del formulario.
TIPOS = {
    "Fecha": "fecha",
    "Hora": "hora",
    "Entero": "entero",
    "Decimal": "decimal",
    "Lista": "lista",
    "Texto": "texto",
    "Texto largo": "texto_largo",
    "Texto / futuro catálogo": "texto",
}


def texto(valor):
    if valor is None:
        return ""
    if isinstance(valor, dt.datetime):
        return valor.date().isoformat()
    if isinstance(valor, dt.date):
        return valor.isoformat()
    return str(valor).strip()


def numero(valor):
    if valor is None or valor == "":
        return None
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return None
    return int(n) if n == int(n) else round(n, 4)


def si_no(valor):
    return texto(valor).lower() in ("sí", "si", "true", "verdadero", "1")


def filas(hoja):
    """Devuelve las filas de una hoja como diccionarios, usando la fila 1 como encabezado."""
    it = hoja.iter_rows(values_only=True)
    encabezado = [texto(c) for c in next(it)]
    salida = []
    for fila in it:
        if all(c is None or texto(c) == "" for c in fila):
            continue
        salida.append({k: v for k, v in zip(encabezado, fila) if k})
    return salida


def tipo_control(tipo_planilla):
    limpio = texto(tipo_planilla)
    if limpio in TIPOS:
        return TIPOS[limpio]
    # Tolerancia a variantes de redaccion en la planilla.
    bajo = limpio.lower()
    if "largo" in bajo:
        return "texto_largo"
    if "lista" in bajo or "catálogo" in bajo or "catalogo" in bajo:
        return "texto" if "texto" in bajo else "lista"
    if "decimal" in bajo:
        return "decimal"
    if "entero" in bajo:
        return "entero"
    if "hora" in bajo:
        return "hora"
    if "fecha" in bajo:
        return "fecha"
    return "texto"


def parametro(fila):
    return {
        "codigo": texto(fila.get("codigo_parametro")),
        "etiqueta": texto(fila.get("etiqueta_formulario")),
        "tipo": tipo_control(fila.get("tipo_dato")),
        "obligatorio": si_no(fila.get("obligatorio")),
        "catalogo": texto(fila.get("catalogo")) or None,
        "validacion": texto(fila.get("validacion")) or None,
        "origen": texto(fila.get("origen")),
        "rol_kpi": texto(fila.get("rol_kpi")),
        "orden": numero(fila.get("orden")) or 0,
        "notas": texto(fila.get("notas")) or None,
    }


def leer(planilla):
    wb = openpyxl.load_workbook(planilla, data_only=True)

    config = {texto(f["clave"]): f for f in filas(wb["00_Config_Proyecto"])}

    proyecto = {
        "proyecto_id": texto(config["proyecto_id"]["valor"]),
        "nombre": texto(config["nombre_proyecto"]["valor"]),
        "fecha_inicio": texto(config["fecha_inicio"]["valor"]),
        "fecha_termino": texto(config["fecha_termino"]["valor"]),
        "dias_habiles_plan": numero(config["dias_habiles_plan"]["valor"]),
        "feriados": sorted(
            texto(f["valor"]) for k, f in config.items() if k.startswith("feriado_")
        ),
        "regla_sector": texto(config["regla_sector"]["valor"]),
    }

    catalogos = {}
    for fila in filas(wb["03_Catalogos"]):
        nombre = texto(fila.get("catalogo"))
        if not nombre or not si_no(fila.get("activo")):
            continue
        catalogos.setdefault(nombre, []).append(
            {
                "codigo": texto(fila.get("codigo")),
                "etiqueta": texto(fila.get("valor_visible")),
                "orden": numero(fila.get("orden")) or 0,
            }
        )
    for valores in catalogos.values():
        valores.sort(key=lambda v: v["orden"])

    comunes, especificos = [], {}
    for fila in filas(wb["02_Parametros_Actividad"]):
        alcance = texto(fila.get("alcance")).upper()
        p = parametro(fila)
        if alcance == "COMUN":
            comunes.append(p)
        else:
            especificos.setdefault(texto(fila.get("codigo_edt")), []).append(p)
    comunes.sort(key=lambda p: p["orden"])
    for lista in especificos.values():
        lista.sort(key=lambda p: p["orden"])

    incluidas, excluidas = [], []
    for fila in filas(wb["01_EDT_Actividades"]):
        codigo = texto(fila.get("codigo_edt"))
        registro_app = texto(fila.get("registro_app_fuente"))
        actividad = {
            "codigo": codigo,
            "categoria": texto(fila.get("categoria")),
            "nombre": texto(fila.get("actividad")),
            "tipo_formulario": texto(fila.get("tipo_formulario")),
            "unidad_medida": texto(fila.get("unidad_medida")),
            "meta": numero(fila.get("meta_numero")),
            "meta_texto": texto(fila.get("meta_texto")) or None,
            "campo_cantidad_ejecutada": texto(fila.get("campo_cantidad_ejecutada")),
            "tipo_kpi": texto(fila.get("tipo_kpi")),
            "meta_diaria_teorica": numero(fila.get("meta_diaria_teorica")),
            "por_confirmar": registro_app.lower().startswith("por confirmar"),
            "parametros": especificos.get(codigo, []),
        }

        # Regla pedida: lo que la EDT marca como "No" no aparece en la aplicacion.
        if registro_app.lower() == "no":
            excluidas.append(
                {
                    "codigo": codigo,
                    "nombre": actividad["nombre"],
                    "categoria": actividad["categoria"],
                    "motivo": "La EDT indica que no se registra en la aplicacion",
                }
            )
            continue
        if actividad["por_confirmar"] and not INCLUIR_POR_CONFIRMAR:
            excluidas.append(
                {
                    "codigo": codigo,
                    "nombre": actividad["nombre"],
                    "categoria": actividad["categoria"],
                    "motivo": "Registro en aplicacion por confirmar",
                }
            )
            continue

        if not actividad["campo_cantidad_ejecutada"]:
            raise SystemExit(
                f"La actividad {codigo} entra a la aplicacion sin campo_cantidad_ejecutada. "
                "Sin ese dato no se puede calcular ningun KPI de rendimiento."
            )
        codigos_parametros = {p["codigo"] for p in actividad["parametros"]}
        if actividad["campo_cantidad_ejecutada"] not in codigos_parametros:
            raise SystemExit(
                f"La actividad {codigo} declara campo_cantidad_ejecutada="
                f"'{actividad['campo_cantidad_ejecutada']}' pero ese parametro no esta "
                "definido en 02_Parametros_Actividad."
            )
        incluidas.append(actividad)

    return proyecto, catalogos, comunes, incluidas, excluidas


def js(valor, sangria=0):
    """Serializa a JSON legible y lo devuelve como texto para incrustar en el archivo JS."""
    bruto = json.dumps(valor, ensure_ascii=False, indent=2)
    if sangria:
        relleno = " " * sangria
        bruto = "\n".join(
            (relleno + linea) if i else linea for i, linea in enumerate(bruto.split("\n"))
        )
    return bruto


def bloque_apps_script(incluidas):
    """Arma el bloque de actividades que va dentro de apps-script/Codigo.gs."""
    lineas = [
        MARCA_INICIO,
        "// Se generan con `python3 herramientas/generar_config.py` desde",
        "// especificacion/EDT_Fundacion_Chile_Maria_Pinto_KPI.xlsx. Son las mismas que",
        "// ofrece la aplicación, así que la hoja KPI no puede quedar desalineada con el",
        "// formulario.",
        "var ACTIVIDADES = [",
    ]
    for i, a in enumerate(incluidas):
        coma = "" if i == len(incluidas) - 1 else ","
        meta = "null" if a["meta"] is None else repr(a["meta"])
        lineas.append(
            "  {{ edt: {codigo}, nombre: {nombre}, unidad: {unidad}, meta: {meta} }}{coma}".format(
                codigo=js_texto(a["codigo"]),
                nombre=js_texto(a["nombre"]),
                unidad=js_texto(a["unidad_medida"]),
                meta=meta,
                coma=coma,
            )
        )
    lineas.append("];")
    lineas.append(MARCA_FIN)
    return "\n".join(lineas)


def js_texto(valor):
    """Texto entre comillas simples, escapando lo que rompería el literal."""
    return "'" + str(valor).replace("\\", "\\\\").replace("'", "\\'") + "'"


def escribir_apps_script(incluidas):
    contenido = APPS_SCRIPT.read_text(encoding="utf-8")
    inicio = contenido.find(MARCA_INICIO)
    fin = contenido.find(MARCA_FIN)
    if inicio == -1 or fin == -1:
        raise SystemExit(
            "No se encontraron las marcas de bloque generado en apps-script/Codigo.gs. "
            "Sin ellas no se puede mantener la lista de actividades sincronizada con la EDT."
        )
    nuevo = contenido[:inicio] + bloque_apps_script(incluidas) + contenido[fin + len(MARCA_FIN):]
    if nuevo != contenido:
        APPS_SCRIPT.write_text(nuevo, encoding="utf-8")
        return True
    return False


def generar():
    proyecto, catalogos, comunes, incluidas, excluidas = leer(PLANILLA)

    sello = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    contenido = f"""// ARCHIVO GENERADO. No editar a mano.
//
// Se genera con:  python3 herramientas/generar_config.py
// Fuente:         especificacion/EDT_Fundacion_Chile_Maria_Pinto_KPI.xlsx
// Generado:       {sello}
//
// Si necesitas cambiar una meta, una unidad o un campo del formulario, cambia la
// planilla de especificacion y vuelve a ejecutar el generador. Un cambio hecho
// aca se pierde en la proxima regeneracion.

const PROYECTO = {js(proyecto)};

// Jornada informada: 08:00 a 16:00 con 30 minutos de colacion (7,5 horas efectivas).
const JORNADA = {js(JORNADA)};

const CATALOGOS = {js(catalogos)};

// Campos que se piden en toda actividad.
const PARAMETROS_COMUNES = {js(comunes)};

// Actividades que SI se registran en la aplicacion.
const ACTIVIDADES = {js(incluidas)};

// Actividades de la EDT que quedan fuera de la aplicacion. Se conservan aca solo
// como documentacion y para que la planilla de destino tenga la EDT completa;
// la aplicacion nunca las ofrece para registrar.
const ACTIVIDADES_FUERA_DE_APP = {js(excluidas)};

// Todo junto en un solo objeto. Se publica como variable global porque un `const`
// de nivel superior no queda colgando de `window` y los demas archivos necesitan
// llegar a el.
const CONFIG = {{
  PROYECTO,
  JORNADA,
  CATALOGOS,
  PARAMETROS_COMUNES,
  ACTIVIDADES,
  ACTIVIDADES_FUERA_DE_APP,
}};

if (typeof module !== 'undefined' && module.exports) {{
  module.exports = CONFIG;
}} else if (typeof self !== 'undefined') {{
  self.CONFIG = CONFIG;
}}
"""
    SALIDA.write_text(contenido, encoding="utf-8")
    cambio_script = escribir_apps_script(incluidas)

    print(f"Escrito: {SALIDA.relative_to(RAIZ)}")
    print(
        f"  {APPS_SCRIPT.relative_to(RAIZ)}: "
        + ("bloque de actividades actualizado" if cambio_script else "sin cambios")
    )
    print(f"  Actividades en la aplicacion: {len(incluidas)}")
    for a in incluidas:
        marca = "  (por confirmar)" if a["por_confirmar"] else ""
        print(f"    {a['codigo']:<5} {a['nombre']}{marca}")
    print(f"  Actividades fuera de la aplicacion: {len(excluidas)}")
    print(f"  Catalogos: {', '.join(catalogos)}")


if __name__ == "__main__":
    generar()
