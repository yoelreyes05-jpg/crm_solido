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
/**
 * ¿El cliente solo quiso el diagnóstico (no se reparó)?
 * Lo marca POST /ordenes/:id/solo-diagnostico: orden.aprobado_por_cliente=false,
 * diagnóstico RECHAZADO y un log "Solo diagnóstico: …".
 */
export function esSoloDiagnostico({ orden, diagnostico, cotizacion, estado_historial, historial } = {}) {
  if (orden?.aprobado_por_cliente === false) return true;
  if (/RECHAZ/i.test(String(diagnostico?.estado || ""))) return true;
  if (/RECHAZ/i.test(String(cotizacion?.estado || ""))) return true;
  const logs = arr(estado_historial).length ? arr(estado_historial) : arr(historial?.timeline_data);
  return logs.some((l) => /solo diagn/i.test(String(l?.motivo || "")));
}

const lineasTexto = (texto) => String(texto || "").split("\n")
  .map((l) => l.replace(/^[\s•\-✓*\d.)]+/, "").trim()).filter(Boolean);

export function reparacion({
  avances, diagnostico, cotizacion, cotizacion_items, factura_items, historial,
  orden, estado_historial,
} = {}) {
  const diag = diagnostico || {};
  const h = historial || {};
  const cot = cotizacion || obj(h.cotizacion_data);
  const soloDiag = esSoloDiagnostico({ orden, diagnostico: diag, cotizacion: cot, estado_historial, historial: h });

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

  let repuestos = items.filter(esRepuesto).map(lineaItem);

  // ── Lo que se cotizó (trabajos y repuestos propuestos por el técnico) ──
  // La cotización guarda la mano de obra como texto (mano_de_obra_detalle) y
  // los repuestos en items_detalle. Antes esto no salía en ningún lado cuando
  // el cliente decidía no reparar.
  const cotTrabajos = lineasTexto(cot?.mano_de_obra_detalle || diag.mano_de_obra_detalle || h.mano_de_obra_detalle);
  const cotItemsAll = itemsCot;
  const recomendados = {
    trabajos: [
      ...cotTrabajos.map((d) => ({ descripcion: d })),
      ...cotItemsAll.filter(esManoDeObra).map((it) => ({ descripcion: lineaItem(it).descripcion })),
    ].filter((t, i, a) => a.findIndex((x) => x.descripcion === t.descripcion) === i),
    repuestos: cotItemsAll.filter((it) => !esManoDeObra(it)).map(lineaItem),
    total: Number(cot?.total || 0) || null,
  };

  // Solo diagnóstico: lo realizado es el diagnóstico (lo facturado); lo
  // cotizado queda como "recomendado, no aprobado".
  if (soloDiag) {
    const facturado = itemsFac.map((it) => lineaItem(it).descripcion).filter((d) => d && d !== "—");
    trabajos = (facturado.length ? facturado : ["Diagnóstico técnico del vehículo"])
      .map((d) => ({ descripcion: d, tipo: "Diagnóstico", estado: "REALIZADO" }));
    repuestos = [];
  }

  const estadoCot = cot?.aprobado ? "APROBADA"
    : (/RECHAZ/i.test(String(cot?.estado || "")) || soloDiag) ? "RECHAZADA"
    : (cot && (cot.id || cot.total)) ? "PENDIENTE" : null;

  return {
    solo_diagnostico: soloDiag,
    cotizacion_estado: estadoCot,
    recomendados: (recomendados.trabajos.length || recomendados.repuestos.length) ? recomendados : null,
    avances_tecnico: avancesTecnico,
    trabajos,
    repuestos,
    cierre: cierre ? { tecnico: cierre.tecnico_nombre || null, fecha: cierre.created_at || null } : null,
    notas_entrega: h.notas_entrega || null,
    documentada: avancesTecnico.length > 0 || trabajos.length > 0,
  };
}

// ── Recorrido del vehículo ──────────────────────────────────────────────────

const ETIQUETA_ESTADO = {
  RECIBIDO: "Recibido en el taller", DIAGNOSTICO: "En diagnóstico",
  ESPERANDO_APROBACION: "Esperando aprobación del cliente", APROBADO: "Aprobado por el cliente",
  REPARACION: "En reparación", CONTROL_CALIDAD: "Control de calidad", LISTO: "Listo para entregar",
  FACTURADO: "Facturado", ENTREGADO: "Entregado al cliente", COMPLETADO: "Completado", CANCELADA: "Cancelada",
};

/**
 * Fecha a ISO con zona. Las columnas `timestamp` sin zona (p. ej. el
 * created_at de diagnosticos) llegan como "2026-10-05T01:08:00" y están en
 * UTC: sin la Z, el navegador las leía como hora local y el diagnóstico de las
 * 9:08 p. m. salía a la 1:08 a. m. del día siguiente.
 */
export function aISO(fecha) {
  if (!fecha) return null;
  let s = String(fecha).trim();
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) s = `${s.replace(" ", "T")}Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const resumir = (t, n = 180) => {
  const s = String(t || "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};
const fmtRD = (n) => `RD$ ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Todo lo que le pasó al vehículo, en orden: recepción, inspección,
 * diagnóstico, cotización y respuesta del cliente, avances del técnico,
 * cambios de estado, control de calidad, factura y entrega.
 * Antes solo se mostraban los cambios de estado (orden_trabajo_log).
 * Devuelve [{ fecha, tipo, titulo, detalle, por }] ordenado por fecha.
 */
export function recorrido({
  orden = null, historial = null, diagnostico = null, avances = [], cotizacion = null,
  factura = null, inspeccion = null, estado_historial = [], control_calidad = null,
} = {}) {
  const o = orden || {};
  const h = historial || {};
  const ev = [];
  const add = (fecha, tipo, titulo, detalle = null, por = null) => {
    const f = aISO(fecha);
    if (!f) return;
    ev.push({ fecha: f, tipo, titulo, detalle: detalle || null, por: por || null, _t: new Date(f).getTime() });
  };

  const fechas = obj(h.fechas_proceso);
  const recibido = o.created_at || fechas.recibido || null;
  add(recibido, "recibido", "Vehículo recibido en el taller", resumir(o.motivo_entrada || o.descripcion || h.motivo_entrada), null);

  if (tieneDatos(inspeccion)) {
    const nf = normalizarFotos(inspeccion).length;
    const nd = arr(inspeccion.zonas_danio).length;
    const partes = [
      inspeccion.km_entrada ? `${Number(inspeccion.km_entrada).toLocaleString("en-US")} km` : null,
      inspeccion.nivel_combustible != null ? `combustible ${inspeccion.nivel_combustible}%` : null,
      nf ? `${nf} foto${nf === 1 ? "" : "s"}` : "sin fotos",
      nd ? `${nd} zona${nd === 1 ? "" : "s"} con daño` : null,
    ].filter(Boolean);
    add(inspeccion.fecha_recepcion || inspeccion.created_at || recibido, "inspeccion",
      "Inspección de recepción", partes.join(" · "), inspeccion.creado_por_nombre);
  }

  if (diagnostico?.created_at) {
    add(diagnostico.created_at, "diagnostico", "Diagnóstico técnico registrado",
      resumir(diagnostico.fallas_identificadas || diagnostico.tipo_servicio), diagnostico.tecnico_nombre);
  }

  const cot = cotizacion || obj(h.cotizacion_data);
  if (cot && (cot.id || cot.total)) {
    const nTrab = lineasTexto(cot.mano_de_obra_detalle).length;
    const nRep = arr(cot.items_detalle).length;
    const det = [cot.total ? fmtRD(cot.total) : null,
      nTrab ? `${nTrab} trabajo${nTrab === 1 ? "" : "s"}` : null,
      nRep ? `${nRep} repuesto${nRep === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ");
    add(cot.created_at || o.fecha_esperando_aprobacion || diagnostico?.created_at, "cotizacion",
      `Cotización${cot.numero ? ` #${cot.numero}` : ""} preparada`, det);
    if (cot.aprobado && cot.aprobado_at) add(cot.aprobado_at, "aprobacion", "El cliente aprobó la cotización");
  }

  (arr(avances).length ? arr(avances) : arr(h.avances_data)).forEach((a) => {
    if (esAvanceGenerico(a?.descripcion)) return;
    add(a.created_at, "avance", "Avance de reparación", resumir(a.descripcion, 400), a.tecnico_nombre);
  });

  const logs = arr(estado_historial).length ? arr(estado_historial) : arr(h.timeline_data);
  logs.forEach((l) => {
    const nuevo = String(l.estado_nuevo || "").toUpperCase();
    if (nuevo === "RECIBIDO" && recibido) return; // ya está como "Vehículo recibido"
    let titulo = ETIQUETA_ESTADO[nuevo] || nuevo.replace(/_/g, " ");
    let detalle = l.motivo || null;
    if (/solo diagn/i.test(String(l.motivo || ""))) titulo = "El cliente decidió no reparar (solo diagnóstico)";
    if (String(l.estado_anterior || "").toUpperCase() === "CONTROL_CALIDAD" && control_calidad?.resultado) {
      const qc = control_calidad;
      detalle = `Control de calidad ${qc.aprobado ? "aprobado" : "rechazado"}${qc.puntos_total ? ` · ${qc.puntos_ok}/${qc.puntos_total} puntos` : ""}`;
    }
    if (nuevo === "ENTREGADO" && (o.notas_entrega || h.notas_entrega)) {
      detalle = `${detalle ? `${detalle} · ` : ""}${o.notas_entrega || h.notas_entrega}`;
    }
    add(l.created_at, "estado", titulo, detalle, l.usuario_nombre);
  });

  const fac = factura && (factura.id || factura.total) ? factura : obj(h.factura_data);
  if (fac && (fac.id || fac.total)) {
    const det = [fac.ncf ? `NCF ${fac.ncf}` : null, fac.total ? fmtRD(fac.total) : null, fac.metodo_pago || null]
      .filter(Boolean).join(" · ");
    add(fac.created_at, "factura", "Factura emitida", det);
  }

  ev.sort((a, b) => a._t - b._t);
  return ev.map(({ _t, ...e }) => e);
}

// ── Expediente completo ─────────────────────────────────────────────────────

/**
 * Arma las secciones normalizadas y la lista de lo que falta.
 * Recibe lo mismo que ya juntan los endpoints de detalle.
 */
export function construirExpediente({
  orden = null, historial = null, diagnostico = null, avances = [],
  cotizacion = null, cotizacion_items = [], factura = null, factura_items = [], inspeccion = null,
  estado_historial = [],
} = {}) {
  const insp = tieneDatos(inspeccion)
    ? inspeccion
    : (tieneDatos(obj(historial?.inspeccion_data)) ? obj(historial.inspeccion_data) : null);

  const fotos = normalizarFotos(insp);
  const qc = controlCalidad({ orden, historial });
  const rep = reparacion({ avances, diagnostico, cotizacion, cotizacion_items, factura_items, historial, orden, estado_historial });
  const pasos = recorrido({ orden, historial, diagnostico, avances, cotizacion, factura, inspeccion: insp, estado_historial, control_calidad: qc });

  const estado = String(orden?.estado || historial?.estado || "").toUpperCase();
  const yaReparado = ESTADOS_POST_REPARACION.includes(estado);

  // Lo que falta, para avisarle al taller (no al cliente) antes de entregar.
  const faltantes = [];
  if (!insp) {
    faltantes.push({ codigo: "sin_inspeccion", mensaje: "No hay inspección de recepción guardada (checklist, daños y fotos)." });
  } else if (fotos.length === 0) {
    faltantes.push({ codigo: "sin_fotos", mensaje: "La inspección de recepción no tiene fotos." });
  }
  if (yaReparado && !rep.documentada && !rep.solo_diagnostico) {
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
    recorrido: pasos,
    faltantes,
  };
}
