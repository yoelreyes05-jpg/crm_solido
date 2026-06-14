/**
 * reparar_historial.mjs
 * ─────────────────────────────────────────────────────────────────
 * Backfill de todos los registros de vehiculo_historial existentes.
 * Rellena el snapshot completo: avances, cotización, factura,
 * línea de tiempo, fechas del proceso, QC, número de orden.
 *
 * Ejecutar: node reparar_historial.mjs
 * ─────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const safe = async (fn) => { try { const r = await fn(); return r.data || null; } catch { return null; } };

async function main() {
  console.log("🔍 Leyendo todos los registros de vehiculo_historial...\n");

  const { data: historiales, error } = await supabase
    .from("vehiculo_historial")
    .select("id, diagnostico_id, placa, numero_orden, avances_data, cotizacion_data, factura_data, timeline_data, fechas_proceso")
    .not("diagnostico_id", "is", null)
    .order("id");

  if (error) { console.error("❌ Error:", error.message); process.exit(1); }
  if (!historiales?.length) { console.log("✅ Sin registros. Nada que hacer."); return; }

  console.log(`📋 ${historiales.length} registros encontrados.\n`);
  let actualizados = 0, errores = 0, sinCambios = 0;

  for (const hist of historiales) {
    const diagId = hist.diagnostico_id;

    // Verificar si ya tiene snapshot completo
    const yaCompleto =
      Array.isArray(hist.avances_data)    && hist.avances_data.length   >= 0 &&
      typeof hist.cotizacion_data === 'object' &&
      typeof hist.factura_data    === 'object' &&
      Array.isArray(hist.timeline_data)   && hist.timeline_data.length  >= 0 &&
      typeof hist.fechas_proceso  === 'object' &&
      hist.numero_orden !== null && hist.numero_orden !== undefined;

    // Solo actualizar registros que no tienen el snapshot (columnas nulas)
    const necesitaUpdate =
      hist.avances_data    === null ||
      hist.cotizacion_data === null ||
      hist.factura_data    === null ||
      hist.timeline_data   === null ||
      hist.fechas_proceso  === null ||
      hist.numero_orden    === null;

    if (!necesitaUpdate) {
      console.log(`  ✅ #${hist.id} (${hist.placa}) — snapshot ya completo.`);
      sinCambios++;
      continue;
    }

    // Leer diagnóstico
    const diag = await safe(() => supabase.from("diagnosticos").select("*").eq("id", diagId).maybeSingle());
    if (!diag) {
      console.warn(`  ⚠️  #${hist.id} — diagnóstico #${diagId} no encontrado.`);
      errores++;
      continue;
    }

    // Leer orden completa
    const orden = await safe(() => supabase.from("ordenes_trabajo").select("*").eq("id", diag.orden_id).maybeSingle());

    // Leer datos relacionados en paralelo
    const [cotizacion, avances, factura, timeline] = await Promise.all([
      safe(() => supabase.from("cotizaciones").select("*").eq("diagnostico_id", diagId).maybeSingle()),
      safe(() => supabase.from("avances_reparacion").select("*").eq("diagnostico_id", diagId).order("created_at")),
      safe(() => supabase.from("facturas").select("*").eq("orden_id", diag.orden_id).order("id", { ascending: false }).limit(1).maybeSingle()),
      safe(() => supabase.from("orden_trabajo_log").select("*").eq("orden_id", diag.orden_id).order("created_at")),
    ]);

    const facturaItems = factura?.id
      ? await safe(() => supabase.from("factura_items").select("*").eq("factura_id", factura.id).order("id"))
      : null;

    const avancesArr  = Array.isArray(avances)      ? avances      : [];
    const timelineArr = Array.isArray(timeline)      ? timeline     : [];
    const itemsArr    = Array.isArray(facturaItems)  ? facturaItems : [];

    const updates = {
      numero_orden:     orden?.numero_orden   || null,
      motivo_entrada:   orden?.motivo_entrada || null,
      notas_entrega:    orden?.notas_entrega  || null,
      resultado_qc:     orden?.resultado_qc      || null,
      observaciones_qc: orden?.observaciones_qc  || null,
      checklist_qc:     orden?.checklist_qc      || {},

      avances_data: avancesArr.map(a => ({
        descripcion:    a.descripcion,
        tecnico_nombre: a.tecnico_nombre,
        created_at:     a.created_at,
      })),

      cotizacion_data: cotizacion ? {
        id:           cotizacion.id,
        numero:       cotizacion.numero,
        mano_obra:    cotizacion.mano_obra,
        repuestos:    cotizacion.repuestos,
        subtotal:     cotizacion.subtotal,
        itbis:        cotizacion.itbis,
        total:        cotizacion.total,
        tiempo_estimado: cotizacion.tiempo_estimado,
        notas:        cotizacion.notas,
        aprobado:     cotizacion.aprobado,
        aprobado_at:  cotizacion.aprobado_at,
        items:        cotizacion.items       || [],
        items_detalle: cotizacion.items_detalle || [],
      } : {},

      factura_data: factura ? {
        id:          factura.id,
        ncf:         factura.ncf,
        ncf_tipo:    factura.ncf_tipo,
        estado:      factura.estado,
        subtotal:    factura.subtotal,
        itbis:       factura.itbis,
        total:       factura.total,
        metodo_pago: factura.metodo_pago,
        created_at:  factura.created_at,
        items: itemsArr.map(fi => ({
          descripcion:     fi.descripcion,
          tipo:            fi.tipo,
          cantidad:        fi.cantidad,
          precio_unitario: fi.precio_unitario,
          itbis_aplica:    fi.itbis_aplica,
          subtotal:        fi.subtotal,
        })),
      } : {},

      timeline_data: timelineArr.map(t => ({
        estado_anterior: t.estado_anterior,
        estado_nuevo:    t.estado_nuevo,
        usuario_nombre:  t.usuario_nombre,
        motivo:          t.motivo,
        created_at:      t.created_at,
      })),

      fechas_proceso: {
        recibido:              orden?.created_at                 || null,
        diagnostico:           orden?.fecha_diagnostico          || null,
        esperando_aprobacion:  orden?.fecha_esperando_aprobacion || null,
        aprobacion:            orden?.fecha_aprobacion           || null,
        inicio_reparacion:     orden?.fecha_inicio_reparacion    || null,
        control_calidad:       orden?.fecha_control_calidad      || null,
        listo:                 orden?.fecha_listo                || null,
        entrega:               orden?.fecha_entrega              || null,
      },
    };

    const { error: updErr } = await supabase
      .from("vehiculo_historial").update(updates).eq("id", hist.id);

    if (updErr) {
      console.error(`  ❌ #${hist.id} (${hist.placa}) — UPDATE falló: ${updErr.message}`);
      errores++;
    } else {
      console.log(`  ✅ #${hist.id} (${hist.placa}) — snapshot completo guardado. Orden: ${orden?.numero_orden || diag.orden_id}`);
      actualizados++;
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`✅ Actualizados: ${actualizados}  |  ⏭️  Sin cambios: ${sinCambios}  |  ❌ Errores: ${errores}`);
}

main().catch(err => { console.error("❌ Error fatal:", err.message); process.exit(1); });
