// ARCHIVO GENERADO. No editar a mano.
//
// Se genera con:  python3 herramientas/generar_config.py
// Fuente:         especificacion/EDT_Fundacion_Chile_Maria_Pinto_KPI.xlsx
// Generado:       2026-08-11 10:07
//
// Si necesitas cambiar una meta, una unidad o un campo del formulario, cambia la
// planilla de especificacion y vuelve a ejecutar el generador. Un cambio hecho
// aca se pierde en la proxima regeneracion.

const PROYECTO = {
  "proyecto_id": "FCH_MARIA_PINTO",
  "nombre": "Fundación Chile - María Pinto",
  "fecha_inicio": "2026-08-11",
  "fecha_termino": "2026-10-01",
  "dias_habiles_plan": 36,
  "feriados": [
    "2026-09-17",
    "2026-09-18"
  ],
  "regla_sector": "1 sector por registro"
};

// Jornada informada: 08:00 a 16:00 con 30 minutos de colacion (7,5 horas efectivas).
const JORNADA = {
  "hora_inicio": "08:00",
  "hora_termino": "16:00",
  "colacion_minutos": 30,
  "colacion_inicio": "13:00",
  "colacion_termino": "13:30"
};

const CATALOGOS = {
  "SECTORES_FCH": [
    {
      "codigo": "LAS_MERCEDES",
      "etiqueta": "Las Mercedes",
      "orden": 1
    },
    {
      "codigo": "IBACACHE",
      "etiqueta": "Ibacache",
      "orden": 2
    }
  ],
  "ESTADOS_ENTREGABLE": [
    {
      "codigo": "NO_INICIADO",
      "etiqueta": "No iniciado",
      "orden": 1
    },
    {
      "codigo": "EN_ELABORACION",
      "etiqueta": "En elaboración",
      "orden": 2
    },
    {
      "codigo": "EN_REVISION",
      "etiqueta": "En revisión",
      "orden": 3
    },
    {
      "codigo": "EMITIDO",
      "etiqueta": "Emitido",
      "orden": 4
    },
    {
      "codigo": "APROBADO",
      "etiqueta": "Aprobado",
      "orden": 5
    }
  ],
  "ESTADO_REVISION": [
    {
      "codigo": "COMPLETO",
      "etiqueta": "Completo",
      "orden": 1
    },
    {
      "codigo": "CON_OBSERVACIONES",
      "etiqueta": "Con observaciones",
      "orden": 2
    },
    {
      "codigo": "REQUIERE_REPOSICIÓN",
      "etiqueta": "Requiere reposición",
      "orden": 3
    }
  ]
};

// Campos que se piden en toda actividad.
const PARAMETROS_COMUNES = [
  {
    "codigo": "fecha",
    "etiqueta": "Fecha",
    "tipo": "fecha",
    "obligatorio": true,
    "catalogo": null,
    "validacion": "Dentro del periodo del proyecto",
    "origen": "Usuario",
    "rol_kpi": "dimensión",
    "orden": 1,
    "notas": null
  },
  {
    "codigo": "persona_que_registra",
    "etiqueta": "Persona que registra",
    "tipo": "texto",
    "obligatorio": true,
    "catalogo": null,
    "validacion": "Catálogo de personas pendiente de definición",
    "origen": "Usuario",
    "rol_kpi": "dimensión",
    "orden": 2,
    "notas": null
  },
  {
    "codigo": "sector",
    "etiqueta": "Sector",
    "tipo": "lista",
    "obligatorio": true,
    "catalogo": "SECTORES_FCH",
    "validacion": "Las Mercedes o Ibacache",
    "origen": "Usuario",
    "rol_kpi": "dimensión",
    "orden": 3,
    "notas": "Un solo sector por registro"
  },
  {
    "codigo": "cantidad_trabajadores",
    "etiqueta": "Cantidad de trabajadores",
    "tipo": "entero",
    "obligatorio": true,
    "catalogo": null,
    "validacion": "> 0",
    "origen": "Usuario",
    "rol_kpi": "insumo_kpi",
    "orden": 4,
    "notas": null
  },
  {
    "codigo": "hora_inicio",
    "etiqueta": "Hora de inicio",
    "tipo": "hora",
    "obligatorio": true,
    "catalogo": null,
    "validacion": null,
    "origen": "Usuario",
    "rol_kpi": "insumo_kpi",
    "orden": 5,
    "notas": null
  },
  {
    "codigo": "hora_termino",
    "etiqueta": "Hora de término",
    "tipo": "hora",
    "obligatorio": true,
    "catalogo": null,
    "validacion": "Posterior a hora_inicio o manejar cruce de medianoche",
    "origen": "Usuario",
    "rol_kpi": "insumo_kpi",
    "orden": 6,
    "notas": null
  },
  {
    "codigo": "duracion_horas",
    "etiqueta": "Duración (h)",
    "tipo": "decimal",
    "obligatorio": false,
    "catalogo": null,
    "validacion": "Calculada desde horas",
    "origen": "Calculado",
    "rol_kpi": "insumo_kpi",
    "orden": 7,
    "notas": "No editable"
  },
  {
    "codigo": "horas_hombre",
    "etiqueta": "Horas-hombre",
    "tipo": "decimal",
    "obligatorio": false,
    "catalogo": null,
    "validacion": "duracion_horas × cantidad_trabajadores",
    "origen": "Calculado",
    "rol_kpi": "insumo_kpi",
    "orden": 8,
    "notas": "No editable"
  },
  {
    "codigo": "observaciones",
    "etiqueta": "Observaciones",
    "tipo": "texto_largo",
    "obligatorio": false,
    "catalogo": null,
    "validacion": null,
    "origen": "Usuario",
    "rol_kpi": "descriptivo",
    "orden": 99,
    "notas": null
  }
];

// Actividades que SI se registran en la aplicacion.
const ACTIVIDADES = [
  {
    "codigo": "1.1",
    "categoria": "Informes",
    "nombre": "Informe de diseño de obras",
    "tipo_formulario": "Entregable / gestión",
    "unidad_medida": "Informe de diseño de obras",
    "meta": null,
    "meta_texto": "Sin meta definida",
    "campo_cantidad_ejecutada": "cantidad_informes_emitidos",
    "tipo_kpi": "Rendimiento HH sin % avance",
    "meta_diaria_teorica": null,
    "por_confirmar": true,
    "parametros": [
      {
        "codigo": "estado_entregable",
        "etiqueta": "Estado del informe",
        "tipo": "lista",
        "obligatorio": true,
        "catalogo": "ESTADOS_ENTREGABLE",
        "validacion": null,
        "origen": "Usuario",
        "rol_kpi": "dimensión",
        "orden": 20,
        "notas": null
      },
      {
        "codigo": "cantidad_informes_emitidos",
        "etiqueta": "Cantidad de informes emitidos",
        "tipo": "entero",
        "obligatorio": true,
        "catalogo": null,
        "validacion": ">=0",
        "origen": "Usuario",
        "rol_kpi": "cantidad_ejecutada",
        "orden": 21,
        "notas": "Este parámetro alimenta la columna canónica cantidad_ejecutada para KPI."
      }
    ]
  },
  {
    "codigo": "2.1",
    "categoria": "Conservación de suelos y aguas",
    "nombre": "Trazado y replanteo de zanjas",
    "tipo_formulario": "Terreno",
    "unidad_medida": "N° de zanjas marcadas",
    "meta": 1800,
    "meta_texto": null,
    "campo_cantidad_ejecutada": "cantidad_zanjas_marcadas",
    "tipo_kpi": "Avance + rendimiento HH",
    "meta_diaria_teorica": 50,
    "por_confirmar": false,
    "parametros": [
      {
        "codigo": "cantidad_zanjas_marcadas",
        "etiqueta": "Cantidad de zanjas marcadas",
        "tipo": "entero",
        "obligatorio": true,
        "catalogo": null,
        "validacion": ">=0",
        "origen": "Usuario",
        "rol_kpi": "cantidad_ejecutada",
        "orden": 20,
        "notas": "Este parámetro alimenta la columna canónica cantidad_ejecutada para KPI."
      }
    ]
  },
  {
    "codigo": "2.2",
    "categoria": "Conservación de suelos y aguas",
    "nombre": "Trazado y replanteo de microterrazas",
    "tipo_formulario": "Terreno",
    "unidad_medida": "Metros de microterraza marcados",
    "meta": 1500,
    "meta_texto": null,
    "campo_cantidad_ejecutada": "metros_microterraza_marcados",
    "tipo_kpi": "Avance + rendimiento HH",
    "meta_diaria_teorica": 41.6667,
    "por_confirmar": false,
    "parametros": [
      {
        "codigo": "metros_microterraza_marcados",
        "etiqueta": "Metros de microterraza marcados",
        "tipo": "decimal",
        "obligatorio": true,
        "catalogo": null,
        "validacion": "≥0",
        "origen": "Usuario",
        "rol_kpi": "cantidad_ejecutada",
        "orden": 20,
        "notas": "Este parámetro alimenta la columna canónica cantidad_ejecutada para KPI."
      }
    ]
  },
  {
    "codigo": "2.3",
    "categoria": "Conservación de suelos y aguas",
    "nombre": "Trazado y replanteo de sacos de tierra",
    "tipo_formulario": "Terreno",
    "unidad_medida": "Metros de sacos de tierra marcados",
    "meta": 1500,
    "meta_texto": null,
    "campo_cantidad_ejecutada": "metros_sacos_tierra_marcados",
    "tipo_kpi": "Avance + rendimiento HH",
    "meta_diaria_teorica": 41.6667,
    "por_confirmar": false,
    "parametros": [
      {
        "codigo": "metros_sacos_tierra_marcados",
        "etiqueta": "Metros de sacos de tierra marcados",
        "tipo": "decimal",
        "obligatorio": true,
        "catalogo": null,
        "validacion": "≥0",
        "origen": "Usuario",
        "rol_kpi": "cantidad_ejecutada",
        "orden": 20,
        "notas": "Este parámetro alimenta la columna canónica cantidad_ejecutada para KPI."
      }
    ]
  },
  {
    "codigo": "2.4",
    "categoria": "Conservación de suelos y aguas",
    "nombre": "Relleno de sacos de tierra",
    "tipo_formulario": "Terreno",
    "unidad_medida": "N° de sacos de tierra llenos",
    "meta": null,
    "meta_texto": "Sin meta; registrar ejecución",
    "campo_cantidad_ejecutada": "cantidad_sacos_llenos",
    "tipo_kpi": "Rendimiento HH sin % avance",
    "meta_diaria_teorica": null,
    "por_confirmar": false,
    "parametros": [
      {
        "codigo": "cantidad_sacos_llenos",
        "etiqueta": "Cantidad de sacos de tierra llenos",
        "tipo": "entero",
        "obligatorio": true,
        "catalogo": null,
        "validacion": ">=0",
        "origen": "Usuario",
        "rol_kpi": "cantidad_ejecutada",
        "orden": 20,
        "notas": "Este parámetro alimenta la columna canónica cantidad_ejecutada para KPI."
      }
    ]
  },
  {
    "codigo": "2.5",
    "categoria": "Conservación de suelos y aguas",
    "nombre": "Confección de zanjas de infiltración",
    "tipo_formulario": "Terreno",
    "unidad_medida": "N° de zanjas confeccionadas, con todas sus componentes",
    "meta": 1800,
    "meta_texto": null,
    "campo_cantidad_ejecutada": "cantidad_zanjas_confeccionadas",
    "tipo_kpi": "Avance + rendimiento HH",
    "meta_diaria_teorica": 50,
    "por_confirmar": false,
    "parametros": [
      {
        "codigo": "cantidad_zanjas_confeccionadas",
        "etiqueta": "Cantidad de zanjas confeccionadas completas",
        "tipo": "entero",
        "obligatorio": true,
        "catalogo": null,
        "validacion": ">=0",
        "origen": "Usuario",
        "rol_kpi": "cantidad_ejecutada",
        "orden": 20,
        "notas": "Este parámetro alimenta la columna canónica cantidad_ejecutada para KPI."
      }
    ]
  },
  {
    "codigo": "2.6",
    "categoria": "Conservación de suelos y aguas",
    "nombre": "Confección de microterrazas",
    "tipo_formulario": "Terreno",
    "unidad_medida": "Metros construidos",
    "meta": 1500,
    "meta_texto": null,
    "campo_cantidad_ejecutada": "metros_microterrazas_construidos",
    "tipo_kpi": "Avance + rendimiento HH",
    "meta_diaria_teorica": 41.6667,
    "por_confirmar": false,
    "parametros": [
      {
        "codigo": "metros_microterrazas_construidos",
        "etiqueta": "Metros de microterrazas construidos",
        "tipo": "decimal",
        "obligatorio": true,
        "catalogo": null,
        "validacion": "≥0",
        "origen": "Usuario",
        "rol_kpi": "cantidad_ejecutada",
        "orden": 20,
        "notas": "Este parámetro alimenta la columna canónica cantidad_ejecutada para KPI."
      }
    ]
  },
  {
    "codigo": "2.7",
    "categoria": "Conservación de suelos y aguas",
    "nombre": "Confección de sacos de tierra",
    "tipo_formulario": "Terreno",
    "unidad_medida": "Metros construidos",
    "meta": 1500,
    "meta_texto": null,
    "campo_cantidad_ejecutada": "metros_sacos_tierra_construidos",
    "tipo_kpi": "Avance + rendimiento HH",
    "meta_diaria_teorica": 41.6667,
    "por_confirmar": false,
    "parametros": [
      {
        "codigo": "metros_sacos_tierra_construidos",
        "etiqueta": "Metros de obra con sacos de tierra construidos",
        "tipo": "decimal",
        "obligatorio": true,
        "catalogo": null,
        "validacion": "≥0",
        "origen": "Usuario",
        "rol_kpi": "cantidad_ejecutada",
        "orden": 20,
        "notas": "Este parámetro alimenta la columna canónica cantidad_ejecutada para KPI."
      }
    ]
  },
  {
    "codigo": "2.8",
    "categoria": "Conservación de suelos y aguas",
    "nombre": "Trazado del sendero",
    "tipo_formulario": "Terreno",
    "unidad_medida": "Metros de sendero marcados",
    "meta": 500,
    "meta_texto": null,
    "campo_cantidad_ejecutada": "metros_sendero_marcados",
    "tipo_kpi": "Avance + rendimiento HH",
    "meta_diaria_teorica": 13.8889,
    "por_confirmar": false,
    "parametros": [
      {
        "codigo": "metros_sendero_marcados",
        "etiqueta": "Metros de sendero marcados",
        "tipo": "decimal",
        "obligatorio": true,
        "catalogo": null,
        "validacion": "≥0",
        "origen": "Usuario",
        "rol_kpi": "cantidad_ejecutada",
        "orden": 20,
        "notas": "Este parámetro alimenta la columna canónica cantidad_ejecutada para KPI."
      }
    ]
  },
  {
    "codigo": "2.9",
    "categoria": "Conservación de suelos y aguas",
    "nombre": "Construcción de sendero",
    "tipo_formulario": "Terreno",
    "unidad_medida": "Metros construidos",
    "meta": 500,
    "meta_texto": null,
    "campo_cantidad_ejecutada": "metros_sendero_construidos",
    "tipo_kpi": "Avance + rendimiento HH",
    "meta_diaria_teorica": 13.8889,
    "por_confirmar": false,
    "parametros": [
      {
        "codigo": "metros_sendero_construidos",
        "etiqueta": "Metros de sendero construidos",
        "tipo": "decimal",
        "obligatorio": true,
        "catalogo": null,
        "validacion": "≥0",
        "origen": "Usuario",
        "rol_kpi": "cantidad_ejecutada",
        "orden": 20,
        "notas": "Este parámetro alimenta la columna canónica cantidad_ejecutada para KPI."
      }
    ]
  },
  {
    "codigo": "10.1",
    "categoria": "Educación ambiental",
    "nombre": "Ejecución de jornada de educación",
    "tipo_formulario": "Terreno",
    "unidad_medida": "Cantidad de asistentes",
    "meta": null,
    "meta_texto": "Sin meta; registrar ejecución",
    "campo_cantidad_ejecutada": "cantidad_asistentes",
    "tipo_kpi": "Rendimiento HH sin % avance",
    "meta_diaria_teorica": null,
    "por_confirmar": true,
    "parametros": [
      {
        "codigo": "cantidad_asistentes",
        "etiqueta": "Cantidad de asistentes",
        "tipo": "entero",
        "obligatorio": true,
        "catalogo": null,
        "validacion": ">=0",
        "origen": "Usuario",
        "rol_kpi": "cantidad_ejecutada",
        "orden": 20,
        "notas": "Este parámetro alimenta la columna canónica cantidad_ejecutada para KPI."
      },
      {
        "codigo": "tipo_publico",
        "etiqueta": "Tipo de público participante",
        "tipo": "texto",
        "obligatorio": false,
        "catalogo": null,
        "validacion": null,
        "origen": "Usuario",
        "rol_kpi": "descriptivo",
        "orden": 21,
        "notas": null
      }
    ]
  }
];

// Actividades de la EDT que quedan fuera de la aplicacion. Se conservan aca solo
// como documentacion y para que la planilla de destino tenga la EDT completa;
// la aplicacion nunca las ofrece para registrar.
const ACTIVIDADES_FUERA_DE_APP = [
  {
    "codigo": "3.1",
    "nombre": "Elaboración del plan de trabajo (Carta gantt)",
    "categoria": "Gestión y planificación",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "4.1",
    "nombre": "Buscar trabajadores de Quilpué",
    "categoria": "Gestión del personal",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "4.2",
    "nombre": "Contactar posibles trabajadores María Pinto",
    "categoria": "Gestión del personal",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "4.3",
    "nombre": "Seleccionar personal",
    "categoria": "Gestión del personal",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "4.4",
    "nombre": "Contratación y firma",
    "categoria": "Gestión del personal",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "5.1",
    "nombre": "Gestionar arriendo de camioneta",
    "categoria": "Logística",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "5.2",
    "nombre": "Revisar herramientas",
    "categoria": "Logística",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "5.3",
    "nombre": "Entrega de EPP",
    "categoria": "Logística",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "6.1",
    "nombre": "Coordinar inducción de seguridad",
    "categoria": "Coordinación",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "7.1",
    "nombre": "Medición de pluviómetro",
    "categoria": "Monitoreo",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "7.2",
    "nombre": "Medición de estacas de control de erosión",
    "categoria": "Monitoreo",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "7.3",
    "nombre": "Seguimiento de cambios en vegetación",
    "categoria": "Monitoreo",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "8.1",
    "nombre": "Registro de charla diaria de seguridad",
    "categoria": "Seguridad",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "8.2",
    "nombre": "Registro de Análisis de Riesgos del Trabajo (ART)",
    "categoria": "Seguridad",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "8.3",
    "nombre": "Registro de checklist de camioneta",
    "categoria": "Seguridad",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "9.1",
    "nombre": "Registro limpieza de baños",
    "categoria": "Gestión",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "10.2",
    "nombre": "Generación de contenido educativo",
    "categoria": "Educación ambiental",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "10.3",
    "nombre": "Generación de señalética",
    "categoria": "Educación ambiental",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "11.1",
    "nombre": "Reportes diarios",
    "categoria": "Reportabilidad",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "11.2",
    "nombre": "Informes mensuales",
    "categoria": "Reportabilidad",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  },
  {
    "codigo": "11.3",
    "nombre": "Informe final",
    "categoria": "Reportabilidad",
    "motivo": "La EDT indica que no se registra en la aplicacion"
  }
];

// Todo junto en un solo objeto. Se publica como variable global porque un `const`
// de nivel superior no queda colgando de `window` y los demas archivos necesitan
// llegar a el.
const CONFIG = {
  PROYECTO,
  JORNADA,
  CATALOGOS,
  PARAMETROS_COMUNES,
  ACTIVIDADES,
  ACTIVIDADES_FUERA_DE_APP,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} else if (typeof self !== 'undefined') {
  self.CONFIG = CONFIG;
}
