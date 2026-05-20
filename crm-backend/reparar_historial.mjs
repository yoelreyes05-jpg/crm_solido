/**
 * reparar_historial.mjs
 * ─────────────────────────────────────────────────────────────────
 * Actualiza todos los registros de vehiculo_historial que tienen
 * campos de inspección vacíos, usando los datos del diagnóstico
 * y la orden de trabajo correspondientes.
 *
 * Ejecutar: node reparar_historial.mjs
 * ─────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ── Helpers ──────────────────────────────────────────────────────
const safe = async (fn) => {
  try {
    const r = await fn();
    return r.data || null;
  } catch {
    return null;
  }
};

const fmt = (v) => (v === null || v === undefined ? "NULL" : String(v).slice(0, 60));

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log("🔍 Buscando registros de vehiculo_historial con campos faltantes...\n");

  // Traer todos los historial que tienen diagnostico_id pero les faltan inspecciones
  const { data: historiales, error: hErr } = await supabase
    .from("vehiculo_historial")
    .select("id, diagnostico_id, placa, inspeccion_mecanica, inspeccion_electrica, inspeccion_electronica, codigos_falla, fecha_servicio")
    .not("diagnostico_id", "is", null)
    .or("inspeccion_mecanica.is.null,inspeccion_electrica.is.null,inspeccion_electronica.is.null,codigos_falla.is.null");

  if (hErr) {
    console.error("❌ Error consultando vehiculo_historial:", hErr.message);
    process.exit(1);
  }

  if (!historiales || historiales.length === 0) {
    console.log("✅ Todos los registros ya tienen los campos completos. Nada que actualizar.");
    return;
  }

  console.log(`📋 ${historiales.length} registros a actualizar:\n`);
  historiales.forEach(h =>
    console.log(`  #${h.id} — Placa: ${h.placa} | Diag: ${h.diagnostico_id}`)
  );
  console.log("");

  let actualizados = 0;
  let errores = 0;

  for (const hist of historiales) {
    const diagId = hist.diagnostico_id;

    // Leer el diagnóstico completo
    const diag = await safe(() =>
      supabase.from("diagnosticos").select("*").eq("id", diagId).maybeSingle()
    );

    if (!diag) {
      console.warn(`  ⚠️  Historial #${hist.id} — diagnóstico #${diagId} no encontrado. Saltando.`);
      errores++;
      continue;
    }

    // Leer la orden para la fecha real de entrega
    const orden = await safe(() =>
      supabase
        .from("ordenes_trabajo")
        .select("id, fecha_entrega, notas_entrega, numero_orden")
        .eq("id", diag.orden_id)
        .maybeSingle()
    );

    // Construir los campos a actualizar (solo los que vienen vacíos en el registro)
    const updates = {};

    if (!hist.inspeccion_mecanica && diag.inspeccion_mecanica)
      updates.inspeccion_mecanica = diag.inspeccion_mecanica;

    if (!hist.inspeccion_electrica && diag.inspeccion_electrica)
      updates.inspeccion_electrica = diag.inspeccion_electrica;

    if (!hist.inspeccion_electronica && diag.inspeccion_electronica)
      updates.inspeccion_electronica = diag.inspeccion_electronica;

    if (!hist.codigos_falla && diag.scanner_resultado)
      updates.codigos_falla = diag.scanner_resultado;

    // Actualizar fecha_servicio si usa la fecha de creación del historial (sospechosamente = created_at)
    if (orden?.fecha_entrega) {
      const fechaReal = new Date(orden.fecha_entrega).toISOString();
      const fechaActual = hist.fecha_servicio ? new Date(hist.fecha_servicio).toISOString() : null;
      // Solo actualizar si la diferencia es mayor a 1 minuto (era new Date() al insertar)
      if (!fechaActual || Math.abs(new Date(fechaReal) - new Date(fechaActual)) > 60000) {
        updates.fecha_servicio = fechaReal;
      }
    }

    if (Object.keys(updates).length === 0) {
      console.log(`  ✅ Historial #${hist.id} (${hist.placa}) — ya completo, sin cambios.`);
      continue;
    }

    // Hacer el UPDATE
    const { error: updErr } = await supabase
      .from("vehiculo_historial")
      .update(updates)
      .eq("id", hist.id);

    if (updErr) {
      console.error(`  ❌ Historial #${hist.id} (${hist.placa}) — UPDATE falló: ${updErr.message}`);
      errores++;
    } else {
      const camposMod = Object.keys(updates).join(", ");
      console.log(`  ✅ Historial #${hist.id} (${hist.placa}) — actualizado: ${camposMod}`);
      actualizados++;
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`✅ Actualizados: ${actualizados}  |  ⚠️  Errores: ${errores}  |  Total revisados: ${historiales.length}`);
}

main().catch((err) => {
  console.error("❌ Error fatal:", err.message);
  process.exit(1);
});
