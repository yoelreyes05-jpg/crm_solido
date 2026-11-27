// Pruebas del expediente que ve el cliente en la app.
//
// Cada caso reproduce un formato real que ha tenido la base de datos. Si una
// modificación del CRM cambia un nombre de columna o un formato y el
// expediente deja de mostrar la reparación, las fotos o la lista de
// verificación, una de estas pruebas falla en GitHub antes de publicar.
//
// Correr:  cd crm-backend && npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  construirExpediente, normalizarFotos, controlCalidad, reparacion,
  checklistInspeccion, esAvanceGenerico, EXPEDIENTE_VERSION,
  recorrido, esSoloDiagnostico, aISO,
} from "../services/expediente.mjs";

const FOTO = "data:image/jpeg;base64,AAAA";

// ── Fotos ───────────────────────────────────────────────────────────────────

test("fotos: formato que manda recepción [{ tipo, data }] sale con etiqueta legible", () => {
  const f = normalizarFotos({ fotos: [{ tipo: "frente", data: FOTO }, { tipo: "danos_visibles", data: FOTO + "B" }] });
  assert.equal(f.length, 2);
  assert.deepEqual(f[0], { slot: "frente", label: "Frente", src: FOTO });
  assert.equal(f[1].label, "Daños visibles");
});

test("fotos: formato fotos_slots { frente: dataURL }", () => {
  const f = normalizarFotos({ fotos_slots: { trasero: FOTO, interior: null } });
  assert.deepEqual(f, [{ slot: "trasero", label: "Trasero", src: FOTO }]);
});

test("fotos: JSONB guardado como string no rompe", () => {
  const f = normalizarFotos({ fotos: JSON.stringify([{ tipo: "tablero", data: FOTO }]) });
  assert.equal(f.length, 1);
  assert.equal(f[0].label, "Tablero");
});

test("fotos: no duplica la misma foto si viene en los dos formatos", () => {
  const f = normalizarFotos({ fotos_slots: { frente: FOTO }, fotos: [{ tipo: "frente", data: FOTO }] });
  assert.equal(f.length, 1);
});

test("fotos: sin inspección devuelve lista vacía", () => {
  assert.deepEqual(normalizarFotos(null), []);
  assert.deepEqual(normalizarFotos({}), []);
});

// ── Control de calidad ──────────────────────────────────────────────────────

test("QC: 'APROBADO' (como lo guarda el CRM) se lee como aprobado", () => {
  const qc = controlCalidad({ orden: { resultado_qc: "APROBADO", checklist_qc: { motor: true, frenos: true } } });
  assert.equal(qc.resultado, "APROBADO");
  assert.equal(qc.aprobado, true);
  assert.equal(qc.puntos_ok, 2);
  assert.equal(qc.checklist[0].label, "Motor funcionando correctamente");
});

test("QC: minúsculas o booleano también se entienden", () => {
  assert.equal(controlCalidad({ historial: { resultado_qc: "aprobado" } }).aprobado, true);
  assert.equal(controlCalidad({ orden: { resultado_qc: true } }).aprobado, true);
  assert.equal(controlCalidad({ orden: { resultado_qc: "RECHAZADO" } }).aprobado, false);
});

test("QC: la orden viva manda sobre el snapshot, el snapshot es respaldo", () => {
  const vivo = controlCalidad({
    orden: { resultado_qc: "APROBADO", checklist_qc: { motor: true } },
    historial: { resultado_qc: "RECHAZADO", checklist_qc: { frenos: false } },
  });
  assert.equal(vivo.resultado, "APROBADO");
  assert.equal(vivo.checklist[0].clave, "motor");

  const snap = controlCalidad({ orden: { resultado_qc: null, checklist_qc: {} }, historial: { resultado_qc: "APROBADO", checklist_qc: { frenos: true } } });
  assert.equal(snap.resultado, "APROBADO");
  assert.equal(snap.checklist[0].clave, "frenos");
});

test("QC: checklist como string JSON", () => {
  const qc = controlCalidad({ orden: { resultado_qc: "APROBADO", checklist_qc: '{"luces":true,"ac":false}' } });
  assert.equal(qc.puntos_total, 2);
  assert.equal(qc.puntos_ok, 1);
});

// ── Inspección ──────────────────────────────────────────────────────────────

test("inspección: checklist de accesorios con sus etiquetas", () => {
  const c = checklistInspeccion({ radio_pantalla: true, gato_ok: false, luces_ok: true });
  assert.deepEqual(c.map((x) => x.label), ["Radio / Pantalla", "Luces", "Gato"]);
  assert.equal(c.find((x) => x.clave === "gato_ok").ok, false);
});

// ── Reparación ──────────────────────────────────────────────────────────────

test("reparación: el avance automático de cierre no cuenta como descripción", () => {
  assert.equal(esAvanceGenerico("Reparación completada por técnico"), true);
  assert.equal(esAvanceGenerico("reparacion completada"), true);
  assert.equal(esAvanceGenerico("Cambié pastillas y rectifiqué discos"), false);
});

test("reparación: avances escritos por el técnico aparecen", () => {
  const r = reparacion({ avances: [
    { descripcion: "Cambio de pastillas delanteras", tecnico_nombre: "Luis", created_at: "2026-11-26T19:00:00Z" },
    { descripcion: "Reparación completada por técnico", tecnico_nombre: "Luis", created_at: "2026-11-26T19:20:00Z" },
  ] });
  assert.equal(r.avances_tecnico.length, 1);
  assert.equal(r.avances_tecnico[0].descripcion, "Cambio de pastillas delanteras");
  assert.equal(r.cierre.tecnico, "Luis");
  assert.equal(r.documentada, true);
});

test("reparación: sin avances, usa los items de mano de obra de la cotización", () => {
  const r = reparacion({
    avances: [{ descripcion: "Reparación completada por técnico" }],
    cotizacion: { items_detalle: [
      { descripcion: "Cambio de bandas de freno", tipo: "mano_obra", cantidad: 1 },
      { descripcion: "Juego de bandas", tipo: "repuesto", cantidad: 1 },
    ] },
  });
  assert.equal(r.trabajos[0].descripcion, "Cambio de bandas de freno");
  assert.equal(r.repuestos[0].descripcion, "Juego de bandas");
  assert.equal(r.documentada, true);
});

test("reparación: trabajos_realizados_items del diagnóstico (string JSON)", () => {
  const r = reparacion({ diagnostico: { trabajos_realizados_items: '[{"nombre":"Rectificar discos","estado":"REALIZADO"}]' } });
  assert.deepEqual(r.trabajos[0], { descripcion: "Rectificar discos", tipo: null, estado: "REALIZADO" });
});

test("reparación: mano_de_obra_detalle en texto como último recurso", () => {
  const r = reparacion({ diagnostico: { mano_de_obra_detalle: "• Cambio de discos\n• Purgar frenos\n" } });
  assert.deepEqual(r.trabajos.map((t) => t.descripcion), ["Cambio de discos", "Purgar frenos"]);
});

test("reparación: servicio archivado lee del snapshot (avances_data, cotizacion_data)", () => {
  const r = reparacion({ historial: {
    avances_data: [{ descripcion: "Se cambiaron bandas" }],
    cotizacion_data: { items: [{ descripcion: "Mano de obra frenos", tipo: "servicio" }] },
  } });
  assert.equal(r.avances_tecnico[0].descripcion, "Se cambiaron bandas");
  assert.equal(r.trabajos[0].descripcion, "Mano de obra frenos");
});

// ── Expediente completo y faltantes ────────────────────────────────────────

test("expediente: caso OT-0057 (entregado, sin inspección, solo avance de cierre, QC sin checklist)", () => {
  const e = construirExpediente({
    orden: { estado: "ENTREGADO", resultado_qc: "APROBADO", checklist_qc: {} },
    avances: [{ descripcion: "Reparación completada por técnico" }],
    inspeccion: null,
  });
  assert.equal(e.version, EXPEDIENTE_VERSION);
  assert.equal(e.control_calidad.aprobado, true, "un vehículo entregado con QC APROBADO no puede salir como rechazado");
  const codigos = e.faltantes.map((f) => f.codigo);
  assert.ok(codigos.includes("sin_inspeccion"));
  assert.ok(codigos.includes("sin_detalle_reparacion"));
  assert.ok(codigos.includes("qc_sin_checklist"));
});

test("expediente: servicio completo no reporta faltantes", () => {
  const e = construirExpediente({
    orden: { estado: "ENTREGADO", resultado_qc: "APROBADO", checklist_qc: { motor: true } },
    avances: [{ descripcion: "Cambio de bandas y rectificado de discos" }],
    inspeccion: { radio_pantalla: true, fotos: [{ tipo: "frente", data: FOTO }] },
  });
  assert.deepEqual(e.faltantes, []);
  assert.equal(e.fotos.length, 1);
  assert.equal(e.inspeccion.checklist[0].label, "Radio / Pantalla");
});

test("expediente: la inspección del snapshot sirve si ya no hay tabla viva", () => {
  const e = construirExpediente({
    historial: { estado: "ENTREGADO", inspeccion_data: { luces_ok: true, fotos_slots: { frente: FOTO } } },
  });
  assert.equal(e.fotos.length, 1);
  assert.ok(e.inspeccion);
});

test("expediente: orden aún en reparación no exige descripción todavía", () => {
  const e = construirExpediente({ orden: { estado: "REPARACION" }, inspeccion: { fotos: [{ tipo: "frente", data: FOTO }] } });
  assert.deepEqual(e.faltantes, []);
});

test("expediente: la forma de salida no cambia sin querer", () => {
  const e = construirExpediente({});
  assert.deepEqual(Object.keys(e).sort(),
    ["control_calidad", "estado", "faltantes", "fotos", "inspeccion", "recorrido", "reparacion", "version"]);
  assert.deepEqual(Object.keys(e.reparacion).sort(),
    ["avances_tecnico", "cierre", "cotizacion_estado", "documentada", "notas_entrega", "recomendados",
     "repuestos", "solo_diagnostico", "trabajos"]);
  assert.deepEqual(Object.keys(e.control_calidad).sort(),
    ["aprobado", "checklist", "fecha", "observaciones", "puntos_ok", "puntos_total", "resultado", "tecnico"]);
});

// ── Solo diagnóstico y recorrido (caso OT-0055) ────────────────────────────

const OT55 = {
  orden: { id: 55, estado: "ENTREGADO", aprobado_por_cliente: false, created_at: "2026-10-05T00:52:00Z",
    motivo_entrada: "El vehiculo esta mezclando el coolant con el aceite", fecha_entrega: "2026-11-16T15:04:00Z" },
  diagnostico: { id: 70, estado: "RECHAZADO", tecnico_nombre: "Gerente", created_at: "2026-10-05T05:08:00Z",
    fallas_identificadas: "1. Enfriador de aceite dañado. 2. Mezcla de agua con aceite.",
    mano_de_obra_detalle: "• Cambio de enfriador de aceite\n• Lavado del sistema de enfriamiento\n• Cambio de aceite y filtro" },
  cotizacion: { id: 40, total: 18500, created_at: "2026-10-05T01:08:00Z",
    mano_de_obra_detalle: "• Cambio de enfriador de aceite\n• Lavado del sistema de enfriamiento\n• Cambio de aceite y filtro",
    items_detalle: [{ descripcion: "Enfriador de aceite", cantidad: 1, subtotal: 9500 }, { descripcion: "Coolant 1 gal", cantidad: 2 }] },
  factura: { id: 88, total: 1200, ncf: "B0200000100", metodo_pago: "Efectivo", created_at: "2026-11-16T14:50:00Z" },
  factura_items: [{ descripcion: "Diagnostico con escaner (lectura y borrado de codigos)", tipo: "servicio", cantidad: 1, subtotal: 1200 }],
  inspeccion: { km_entrada: 246597, nivel_combustible: 50, zonas_danio: [{ zona: "lat_izq" }, { zona: "lat_der" }],
    luces_ok: true, creado_por_nombre: "Gerente", created_at: "2026-10-05T00:52:30Z" },
  estado_historial: [
    { estado_anterior: null, estado_nuevo: "RECIBIDO", motivo: "Orden creada", usuario_nombre: "Gerente", created_at: "2026-10-05T00:52:00Z" },
    { estado_anterior: "RECIBIDO", estado_nuevo: "DIAGNOSTICO", motivo: "Cambio de estado", usuario_nombre: "Gerente", created_at: "2026-10-05T00:52:10Z" },
    { estado_anterior: "DIAGNOSTICO", estado_nuevo: "ESPERANDO_APROBACION", motivo: "Técnico cerró el diagnóstico", usuario_nombre: "Gerente", created_at: "2026-10-05T01:08:00Z" },
    { estado_anterior: "ESPERANDO_APROBACION", estado_nuevo: "LISTO", motivo: "Solo diagnóstico: el cliente no desea reparar", usuario_nombre: "Gerente", created_at: "2026-10-11T01:21:00Z" },
    { estado_anterior: "LISTO", estado_nuevo: "ENTREGADO", motivo: "Vehículo entregado al cliente", usuario_nombre: "Gerente", created_at: "2026-11-16T15:04:00Z" },
  ],
};

test("solo diagnóstico: se detecta por la orden, el diagnóstico o el log", () => {
  assert.equal(esSoloDiagnostico({ orden: { aprobado_por_cliente: false } }), true);
  assert.equal(esSoloDiagnostico({ diagnostico: { estado: "RECHAZADO" } }), true);
  assert.equal(esSoloDiagnostico({ estado_historial: [{ motivo: "Solo diagnóstico: x" }] }), true);
  assert.equal(esSoloDiagnostico({ orden: { aprobado_por_cliente: true }, diagnostico: { estado: "EN_REPARACION" } }), false);
});

test("OT-0055: lo realizado es el diagnóstico y lo cotizado queda como recomendado", () => {
  const e = construirExpediente(OT55);
  const r = e.reparacion;
  assert.equal(r.solo_diagnostico, true);
  assert.equal(r.cotizacion_estado, "RECHAZADA");
  assert.deepEqual(r.trabajos.map((t) => t.descripcion), ["Diagnostico con escaner (lectura y borrado de codigos)"]);
  assert.deepEqual(r.repuestos, []);
  assert.deepEqual(r.recomendados.trabajos.map((t) => t.descripcion),
    ["Cambio de enfriador de aceite", "Lavado del sistema de enfriamiento", "Cambio de aceite y filtro"]);
  assert.deepEqual(r.recomendados.repuestos.map((x) => x.descripcion), ["Enfriador de aceite", "Coolant 1 gal"]);
  assert.equal(r.recomendados.total, 18500);
  assert.ok(!e.faltantes.some((f) => f.codigo === "sin_detalle_reparacion"), "solo diagnóstico no exige descripción de reparación");
});

test("OT-0055: el recorrido trae inspección, diagnóstico, cotización, decisión, factura y entrega en orden", () => {
  const e = construirExpediente(OT55);
  const tipos = e.recorrido.map((x) => x.tipo);
  assert.deepEqual(tipos, ["recibido", "estado", "inspeccion", "cotizacion", "estado", "diagnostico", "estado", "factura", "estado"]);
  const titulos = e.recorrido.map((x) => x.titulo);
  assert.ok(titulos.includes("El cliente decidió no reparar (solo diagnóstico)"));
  assert.ok(titulos.includes("Factura emitida"));
  const insp = e.recorrido.find((x) => x.tipo === "inspeccion");
  assert.match(insp.detalle, /246,597 km/);
  assert.match(insp.detalle, /2 zonas con daño/);
  const fac = e.recorrido.find((x) => x.tipo === "factura");
  assert.match(fac.detalle, /RD\$ 1,200\.00/);
});

test("recorrido: avances del técnico y resultado del QC aparecen en su momento", () => {
  const pasos = recorrido({
    orden: { created_at: "2026-11-26T18:47:00Z" },
    avances: [
      { descripcion: "Cambio de bandas delanteras", tecnico_nombre: "Luis", created_at: "2026-11-26T19:22:00Z" },
      { descripcion: "Reparación completada por técnico", created_at: "2026-11-26T19:23:00Z" },
    ],
    estado_historial: [
      { estado_anterior: "CONTROL_CALIDAD", estado_nuevo: "LISTO", usuario_nombre: "Gerente", created_at: "2026-11-26T19:23:30Z" },
    ],
    control_calidad: { resultado: "APROBADO", aprobado: true, puntos_ok: 7, puntos_total: 8 },
  });
  assert.deepEqual(pasos.map((p) => p.tipo), ["recibido", "avance", "estado"]);
  assert.equal(pasos[1].por, "Luis");
  assert.equal(pasos[2].detalle, "Control de calidad aprobado · 7/8 puntos");
});

test("recorrido: un servicio archivado usa los snapshots (timeline_data, avances_data, factura_data)", () => {
  const pasos = recorrido({ historial: {
    fechas_proceso: { recibido: "2026-09-01T12:00:00Z" },
    timeline_data: [{ estado_nuevo: "ENTREGADO", created_at: "2026-09-02T12:00:00Z" }],
    avances_data: [{ descripcion: "Cambio de aceite", created_at: "2026-09-01T15:00:00Z" }],
    factura_data: { id: 1, total: 2500, created_at: "2026-09-02T11:00:00Z" },
  } });
  assert.deepEqual(pasos.map((p) => p.tipo), ["recibido", "avance", "factura", "estado"]);
});

test("fechas sin zona se leen como UTC (no corre el diagnóstico al día siguiente)", () => {
  assert.equal(aISO("2026-10-05T01:08:00"), "2026-10-05T01:08:00.000Z");
  assert.equal(aISO("2026-10-05 01:08:00.123"), "2026-10-05T01:08:00.123Z");
  assert.equal(aISO("2026-10-05T01:08:00-04:00"), "2026-10-05T05:08:00.000Z");
  assert.equal(aISO(null), null);
});
