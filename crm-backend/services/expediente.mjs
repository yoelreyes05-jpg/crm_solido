// ═══════════════════════════════════════════════════════════════════════════
// Expediente de servicio — forma única y estable para la app del cliente
// ═══════════════════════════════════════════════════════════════════════════
//
// POR QUÉ EXISTE
// El expediente se arma con datos de muchas tablas (orden, diagnóstico,
// avances, cotización, factura, inspección, QC) que cambian de nombre o de
// formato cada vez que se modifica un módulo del CRM. La app del cliente
// leía cada campo por su cuenta, a veces del snapshot y a veces de la tabla
// viva, y cada cambio rompía algo en silencio:
//   · el QC se guarda "APROBADO" y la app comparaba con "aprobado" → salía
//     "Rechazado" en un vehículo que sí pasó calidad;
//   · la cotización y la factura se leían solo del snapshot, que las órdenes
//     no archivadas no tienen;
//   · las fotos llegan con `tipo` y se mostraban con la clave cruda.
//
// Aquí se normaliza TODO en un solo lugar, con funciones puras (sin Supabase)
// que tienen pruebas en test/expediente.test.mjs. Si alguien cambia un nombre
// de columna o un formato, la prueba falla antes de llegar a producción.
//
// La salida lleva `version`. Si la forma cambia de manera incompatible, se
// sube la versión y la app la detecta.
// ═══════════════════════════════════════════════════════════════════════════

export const EXPEDIENTE_VERSION = 1;

export const FOTO_SLOT_LABELS = {
  frente:         "Frente",
  trasero:        "Trasero",
  lateral_izq:    "Lateral izquierdo",
  lateral_der:    "Lateral derecho",
  interior:       "Interior",
  tablero:        "Tablero",
  danos_visibles: "Daños visibles",
};

/** Accesorios revisados en recepción (columnas booleanas de inspeccion_vehiculo). */
export const ACCESORIOS_INSPECCION = [
  ["radio_pantalla",     "Radio / Pantalla"],
  ["tapiceria_ok",       "Tapicería"],
  ["alfombras_ok",       "Alfombras"],
  ["luces_ok",           "Luces"],
  ["bocina_ok",          "Bocina"],
  ["espejos_ok",         "Espejos"],
  ["gato_ok",            "Gato"],
  ["llanta_repuesto_ok", "Llanta de repuesto"],
  ["documentos_ok",      "Documentos"],
  ["herramientas_ok",    "Herramientas"],
];

/** Puntos del control de calidad (mismas claves que QC_CHECKLIST_ITEMS en ordenes/[id]). */
export const QC_LABELS = {
  motor:       "Motor funcionando correctamente",
  frenos:      "Sistema de frenos operativo",
  fluidos:     "Sin fugas de fluidos",
  luces:       "Sistema de luces completo",
  electrico:   "Sistema eléctrico sin fallas",
  transmision: "Transmisión / caja de cambios",
  suspension:  "Suspensión y dirección",
  ac:          "A/C y climatización",
  limpieza:    "Limpieza y presentación",
  prueba_ruta: "Prueba de ruta realizada",
  trabajo_ok:  "Trabajo solicitado completado al 100%",
  // Claves de versiones anteriores del checklist
  direccion:   "Dirección",
  escape:      "Escape",
  neumaticos:  "Neumáticos",
  documentos:  "Documentos",
};

/** Estados en los que la reparación ya debería estar documentada. */
const ESTADOS_POST_REPARACION = ["CONTROL_CALIDAD", "LISTO", "ENTREGADO", "FACTURADO", "COMPLETADO"];

// ── Utilidades ──────────────────────────────────────────────────────────────

/** JSONB que a veces llega como string. */
export function parseJSON(v, porDefecto) {
  if (v === null || v === undefined || v === "") return porDefecto;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return porDefecto; }
  }
  return v;
}

const arr = (v) => {
  const p = parseJSON(v, []);
  return Array.isArray(p) ? p : [];
};

const obj = (v) => {
  const p = parseJSON(v, {});
  return p && typeof p === "object" && !Array.isArray(p) ? p : {};
};

const tieneDatos = (o) => !!o && typeof o === "object" && Object.keys(o).length > 0;

const etiquetaDeClave = (k) => {
  const s = String(k || "").replace(/_/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
};

/**
 * Avances que el sistema escribe solo al cerrar la reparación. No describen
 * qué se le hizo al vehículo, así que no cuentan como documentación.
 */
export function esAvanceGenerico(texto) {
  const t = String(texto || "").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!t) return true;
  return /^reparacion completada( por (el )?tecnico)?\.?$/.test(t);
}

// ── Fotos ───────────────────────────────────────────────────────────────────

/**
 * Fotos de la inspección de recepción → [{ slot, label, src }].
 * Acepta los dos formatos que ha usado recepción:
 *   · fotos_slots: { frente: "data:…", … }
 *   · fotos: [{ tipo: "frente", data: "data:…" }]  (o { label, data })
 */
export function normalizarFotos(inspeccion) {
  if (!inspeccion || typeof inspeccion !== "object") return [];

  const slots = obj(inspeccion.fotos_slots);
  const vistos = new Set();
  const desdeSlots = Object.keys(FOTO_SLOT_LABELS)
    .filter((k) => typeof slots[k] === "string" && slots[k])
    .map((k) => { vistos.add(slots[k]); return { slot: k, label: FOTO_SLOT_LABELS[k], src: slots[k] }; });

  const desdeLista = arr(inspeccion.fotos)
    .map((f, i) => {
      if (typeof f === "string") return { slot: `extra_${i}`, label: "Foto", src: f };
      const src = f?.data || f?.src || f?.url;
      if (!src) return null;
      const tipo = f.tipo || f.slot;
      return {
        slot: tipo || `extra_${i}`,
        label: f.label || FOTO_SLOT_LABELS[tipo] || etiquetaDeClave(tipo) || "Foto",
        src,
      };
    })
    .filter((f) => f && !vistos.has(f.src));

  return [...desdeSlots, ...desdeLista];
}

// ── Inspección de recepción ─────────────────────────────────────────────────

/** Checklist de accesorios → [{ clave, label, ok }]. Vacío si no hay inspección. */
export function checklistInspeccion(inspeccion) {
  if (!tieneDatos(inspeccion)) return [];
  return ACCESORIOS_INSPECCION
    .filter(([k]) => k in inspeccion)
    .map(([k, label]) => ({ clave: k, label, ok: inspeccion[k] === true || inspeccion[k] === "true" }));
}

// ── Control de calidad ──────────────────────────────────────────────────────

/**
 * Resultado del QC. La orden viva manda; el snapshot es respaldo.
 * `resultado` siempre sale en MAYÚSCULAS ("APROBADO" | "RECHAZADO") o null.
 */
export function controlCalidad({ orden, historial } = {}) {
  const o = orden || {};
  const h = historial || {};

  const crudo = o.resultado_qc ?? h.resultado_qc ?? null;
  let resultado = null;
  if (crudo === true) resultado = "APROBADO";
  else if (crudo === false) resultado = "RECHAZADO";
  else if (crudo) {
    const t = String(crudo).trim().toUpperCase();
    resultado = t.startsWith("APROB") ? "APROBADO" : t.startsWith("RECHAZ") ? "RECHAZADO" : t;
  }

  const ck = tieneDatos(obj(o.checklist_qc)) ? obj(o.checklist_qc) : obj(h.checklist_qc);
  const checklist = Object.entries(ck).map(([clave, v]) => ({
    clave,
    label: QC_LABELS[clave] || etiquetaDeClave(clave),
    ok: v === true || v === "true",
  }));

  return {
    resultado,
    aprobado: resultado === "APROBADO",
    checklist,
    puntos_ok: checklist.filter((c) => c.ok).length,
    puntos_total: checklist.length,
    observaciones: o.observaciones_qc || h.observaciones_qc || null,
    tecnico: o.tecnico_qc || h.tecnico_qc || null,
    fecha: o.fecha_control_calidad || null,
  };
}

// ── Reparación ──────────────────────────────────────────────────────────────

const esManoDeObra = (it) => /mano|servicio|labor|trabajo/i.test(String(it?.tipo || it?.categoria || ""));
const esRepuesto  = (it) => /repuesto|pieza|producto|material/i.test(String(it?.tipo || it?.categoria || ""));

const lineaItem = (it) => ({
  descripcion: it?.descripcion || it?.nombre || it?.trabajo || "—",
  cantidad: Number(it?.cantidad || 1),
  tipo: it?.tipo || null,
});

/**
 * Qué se le hizo al vehículo, juntando todas las fuentes posibles:
 * avances escritos por el técnico, trabajos del diagnóstico, cotización
 * aprobada y factura. Devuelve listas vacías, nunca undefined.
 */
export function reparacion({
  avances, diagnostico, cotizacion, cotizacion_items, factura_items, historial,
} = {}) {
  const diag = diagnostico || {};
  const h = historial || {};
  const cot = cotizacion || obj(h.cotizacion_data);

  const todos = arr(avances).length ? arr(avances) : arr(h.avances_data);
  const avancesTecnico = todos
    .filter((a) => !esAvanceGenerico(a?.descripcion))
    .map((a) => ({
      descripcion: String(a.descripcion).trim(),
      tecnico: a.tecnico_nombre || null,
      fecha: a.created_at || null,
    }));
  const cierre = todos.find((a) => esAvanceGenerico(a?.descripcion) && a?.descripcion);

  // Trabajos: del diagnóstico primero, luego de la cotización, luego del texto
  let trabajos = arr(diag.trabajos_realizados_items).length
    ? arr(diag.trabajos_realizados_items)
    : arr(cot?.trabajos_realizados_items);
  trabajos = trabajos.map((t) => ({
    descripcion: t?.nombre || t?.descripcion || t?.trabajo || "—",
    tipo: t?.tipo || null,
    estado: t?.estado || null,
  }));

  const itemsCot = arr(cotizacion_items).length
    ? arr(cotizacion_items)
    : (arr(cot?.items_detalle).length ? arr(cot.items_detalle) : arr(cot?.items));
  const itemsFac = arr(factura_items).length ? arr(factura_items) : arr(obj(h.factura_data).items);
  const items = itemsCot.length ? itemsCot : itemsFac;

  if (trabajos.length === 0) {
    const mo = items.filter(esManoDeObra);
    trabajos = mo.map((it) => ({ descripcion: lineaItem(it).descripcion, tipo: "Mano de obra", estado: null }));
  }
  if (trabajos.length === 0) {
    const texto = diag.mano_de_obra_detalle || cot?.mano_de_obra_detalle || h.mano_de_obra_detalle || "";
    trabajos = String(texto).split("\n").map((l) => l.replace(/^[\s•\-✓*]+/, "").trim()).filter(Boolean)
      .map((d) => ({ descripcion: d, tipo: "Mano de obra", estado: null }));
  }

  const repuestos = items.filter(esRepuesto).map(lineaItem);

  return {
    avances_tecnico: avancesTecnico,
    trabajos,
    repuestos,
    cierre: cierre ? { tecnico: cierre.tecnico_nombre || null, fecha: cierre.created_at || null } : null,
    notas_entrega: h.notas_entrega || null,
    documentada: avancesTecnico.length > 0 || trabajos.length > 0,
  };
}

// ── Expediente completo ─────────────────────────────────────────────────────

/**
 * Arma las secciones normalizadas y la lista de lo que falta.
 * Recibe lo mismo que ya juntan los endpoints de detalle.
 */
export function construirExpediente({
  orden = null, historial = null, diagnostico = null, avances = [],
  cotizacion = null, cotizacion_items = [], factura_items = [], inspeccion = null,
} = {}) {
  const insp = tieneDatos(inspeccion)
    ? inspeccion
    : (tieneDatos(obj(historial?.inspeccion_data)) ? obj(historial.inspeccion_data) : null);

  const fotos = normalizarFotos(insp);
  const qc = controlCalidad({ orden, historial });
  const rep = reparacion({ avances, diagnostico, cotizacion, cotizacion_items, factura_items, historial });

  const estado = String(orden?.estado || historial?.estado || "").toUpperCase();
  const yaReparado = ESTADOS_POST_REPARACION.includes(estado);

  // Lo que falta, para avisarle al taller (no al cliente) antes de entregar.
  const faltantes = [];
  if (!insp) {
    faltantes.push({ codigo: "sin_inspeccion", mensaje: "No hay inspección de recepción guardada (checklist, daños y fotos)." });
  } else if (fotos.length === 0) {
    faltantes.push({ codigo: "sin_fotos", mensaje: "La inspección de recepción no tiene fotos." });
  }
  if (yaReparado && !rep.documentada) {
    faltantes.push({ codigo: "sin_detalle_reparacion", mensaje: "El técnico no describió la reparación realizada." });
  }
  if (qc.resultado && qc.checklist.length === 0) {
    faltantes.push({ codigo: "qc_sin_checklist", mensaje: "El control de calidad no tiene la lista de verificación marcada." });
  }

  return {
    version: EXPEDIENTE_VERSION,
    estado: estado || null,
    fotos,
    inspeccion: insp ? {
      checklist: checklistInspeccion(insp),
      km_entrada: insp.km_entrada ?? null,
      nivel_combustible: insp.nivel_combustible ?? null,
      condicion_general: insp.condicion_general || null,
      zonas_danio: arr(insp.zonas_danio),
      observaciones: insp.observaciones || null,
      recibido_por: insp.creado_por_nombre || null,
      fecha: insp.fecha_recepcion || insp.created_at || null,
    } : null,
    control_calidad: qc,
    reparacion: rep,
    faltantes,
  };
}
