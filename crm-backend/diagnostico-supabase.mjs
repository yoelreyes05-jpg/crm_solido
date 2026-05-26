/**
 * diagnostico-supabase.mjs
 * Ejecutar desde la carpeta crm-backend:
 *   node diagnostico-supabase.mjs
 *
 * Analiza la estructura real de las tablas y datos para
 * diagnosticar por qué Telegram no encuentra placas.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const sep = (titulo) => console.log(`\n${"═".repeat(60)}\n  ${titulo}\n${"═".repeat(60)}`);

async function main() {
  console.log("🔍 DIAGNÓSTICO SUPABASE — CRM Sólido Auto Servicio");
  console.log(`   URL: ${process.env.SUPABASE_URL}`);

  // ─────────────────────────────────────────────────
  // 1. Columnas reales de VEHICULOS
  // ─────────────────────────────────────────────────
  sep("1. COLUMNAS DE LA TABLA vehiculos");
  {
    const { data, error } = await supabase
      .from("vehiculos")
      .select("*")
      .limit(1);
    if (error) {
      console.error("❌ Error:", error.message);
    } else if (data && data.length > 0) {
      console.log("Columnas encontradas:", Object.keys(data[0]).join(", "));
    } else {
      console.log("⚠️  Tabla vacía o sin acceso");
    }
  }

  // ─────────────────────────────────────────────────
  // 2. Muestra de placas en vehiculos
  // ─────────────────────────────────────────────────
  sep("2. PLACAS EN vehiculos (primeras 20)");
  {
    const { data, error } = await supabase
      .from("vehiculos")
      .select("id, placa, marca, modelo, ano, cliente_id")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      console.error("❌ Error:", error.message);
    } else {
      console.log(`Total registros encontrados: ${data.length}`);
      data.forEach((v) =>
        console.log(
          `  id=${v.id} | placa="${v.placa}" | ${v.marca} ${v.modelo} ${v.ano} | cliente_id=${v.cliente_id}`
        )
      );
    }
  }

  // ─────────────────────────────────────────────────
  // 3. Columnas reales de ORDENES_TRABAJO
  // ─────────────────────────────────────────────────
  sep("3. COLUMNAS DE LA TABLA ordenes_trabajo");
  {
    const { data, error } = await supabase
      .from("ordenes_trabajo")
      .select("*")
      .limit(1);
    if (error) {
      console.error("❌ Error:", error.message);
    } else if (data && data.length > 0) {
      console.log("Columnas encontradas:", Object.keys(data[0]).join(", "));
      console.log("\nEjemplo de fila:");
      const row = data[0];
      Object.entries(row).forEach(([k, v]) =>
        console.log(`  ${k}: ${JSON.stringify(v)?.substring(0, 80)}`)
      );
    } else {
      console.log("⚠️  Tabla vacía");
    }
  }

  // ─────────────────────────────────────────────────
  // 4. Estados distintos en ordenes_trabajo
  // ─────────────────────────────────────────────────
  sep("4. VALORES DISTINTOS DE estado EN ordenes_trabajo");
  {
    // No hay .distinct() en supabase-js — traemos todos y agrupamos
    const { data, error } = await supabase
      .from("ordenes_trabajo")
      .select("estado");
    if (error) {
      console.error("❌ Error:", error.message);
    } else {
      const counts = {};
      (data || []).forEach((r) => {
        counts[r.estado] = (counts[r.estado] || 0) + 1;
      });
      console.log("Estado → conteo:");
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([estado, cnt]) => console.log(`  "${estado}" → ${cnt}`));
    }
  }

  // ─────────────────────────────────────────────────
  // 5. ¿ordenes_trabajo tiene vehiculo_id?
  // ─────────────────────────────────────────────────
  sep("5. ÓRDENES POR vehiculo_id — prueba con primer vehículo");
  {
    // Primero obtenemos el primer vehículo con placa
    const { data: vData } = await supabase
      .from("vehiculos")
      .select("id, placa")
      .not("placa", "is", null)
      .limit(1);

    if (!vData || vData.length === 0) {
      console.log("⚠️  No hay vehículos con placa");
    } else {
      const v = vData[0];
      console.log(`Usando vehiculo id=${v.id} placa="${v.placa}"`);
      const { data: ordenes, error } = await supabase
        .from("ordenes_trabajo")
        .select("id, estado, numero_orden, vehiculo_id, created_at")
        .eq("vehiculo_id", v.id);
      if (error) {
        console.error("❌ Error al filtrar por vehiculo_id:", error.message);
        console.log("   → Esto confirma que vehiculo_id NO existe o el filtro falla");
      } else {
        console.log(`Órdenes encontradas para vehiculo_id=${v.id}: ${ordenes.length}`);
        ordenes.slice(0, 5).forEach((o) =>
          console.log(`  id=${o.id} numero_orden="${o.numero_orden}" estado="${o.estado}"`)
        );
      }
    }
  }

  // ─────────────────────────────────────────────────
  // 6. Columnas reales de DIAGNOSTICOS
  // ─────────────────────────────────────────────────
  sep("6. COLUMNAS DE LA TABLA diagnosticos");
  {
    const { data, error } = await supabase
      .from("diagnosticos")
      .select("*")
      .limit(1);
    if (error) {
      console.error("❌ Error:", error.message);
    } else if (data && data.length > 0) {
      console.log("Columnas encontradas:", Object.keys(data[0]).join(", "));
    } else {
      console.log("⚠️  Tabla vacía");
    }
  }

  // ─────────────────────────────────────────────────
  // 7. vehiculo_historial — columnas y muestra
  // ─────────────────────────────────────────────────
  sep("7. COLUMNAS DE vehiculo_historial + muestra de placas");
  {
    const { data, error } = await supabase
      .from("vehiculo_historial")
      .select("*")
      .limit(3);
    if (error) {
      console.error("❌ Error:", error.message);
    } else if (data && data.length > 0) {
      console.log("Columnas encontradas:", Object.keys(data[0]).join(", "));
      console.log("\nPrimeras 3 filas (placa y numero_orden):");
      data.forEach((h) =>
        console.log(
          `  placa="${h.placa}" | numero_orden="${h.numero_orden}" | estado="${h.estado}"`
        )
      );
    } else {
      console.log("⚠️  Tabla vehiculo_historial está VACÍA — no hay historial cerrado aún");
    }
  }

  // ─────────────────────────────────────────────────
  // 8. Simulación completa de consultarHistorialPorPlaca
  //    usando la primera placa real del sistema
  // ─────────────────────────────────────────────────
  sep("8. SIMULACIÓN COMPLETA — consultarHistorialPorPlaca");
  {
    // Tomar primera placa real
    const { data: vTodos } = await supabase
      .from("vehiculos")
      .select("id, placa, marca, modelo, cliente_id")
      .not("placa", "is", null)
      .limit(1);

    if (!vTodos || vTodos.length === 0) {
      console.log("⚠️  No hay vehículos con placa para simular");
    } else {
      const vReal = vTodos[0];
      const placaInput = vReal.placa;
      const placaNorm = placaInput.toUpperCase().replace(/[\s\-_]/g, "").trim();
      console.log(`Simulando búsqueda para placa="${placaInput}" → normalizada="${placaNorm}"`);

      // Step 1: Todos los vehículos, filtro client-side
      const { data: todosVehiculos, error: vErr } = await supabase
        .from("vehiculos")
        .select("id, marca, modelo, placa, ano, color, cliente_id");
      if (vErr) console.error("  ❌ vehiculos error:", vErr.message);
      const vehiculo = (todosVehiculos || []).find(
        (v) => v.placa?.toUpperCase().replace(/[\s\-_]/g, "") === placaNorm
      );
      console.log(`  Paso 1 — vehiculo encontrado: ${vehiculo ? `id=${vehiculo.id}` : "NO ENCONTRADO ❌"}`);

      if (!vehiculo) {
        console.log("  Placas en BD:", (todosVehiculos || []).map((v) => `"${v.placa}"`).join(", "));
        return;
      }

      // Step 2: vehiculo_historial
      const placaConGuion = placaNorm.replace(/^([A-Z]{1,2})(\d+)$/, "$1-$2");
      const { data: histData, error: hErr } = await supabase
        .from("vehiculo_historial")
        .select("id, placa, numero_orden, estado, created_at")
        .or(`placa.ilike.${placaNorm},placa.ilike.${placaConGuion}`)
        .order("created_at", { ascending: false });
      if (hErr) console.error("  ❌ vehiculo_historial error:", hErr.message);
      console.log(`  Paso 2 — historial filas: ${(histData || []).length}`);

      // Step 3: ordenes por vehiculo_id
      const { data: ordenes, error: oErr } = await supabase
        .from("ordenes_trabajo")
        .select("id, descripcion, estado, numero_orden, created_at, total")
        .eq("vehiculo_id", vehiculo.id)
        .order("created_at", { ascending: false });
      if (oErr) console.error("  ❌ ordenes error:", oErr.message);
      console.log(`  Paso 3 — ordenes encontradas: ${(ordenes || []).length}`);
      if (oErr) {
        console.log("  → Columna vehiculo_id probablemente NO EXISTE en ordenes_trabajo");
        // Intentar sin filtro para ver cómo se relacionan
        const { data: todasOrd } = await supabase
          .from("ordenes_trabajo")
          .select("id, estado, numero_orden, created_at")
          .limit(5);
        console.log("  Primeras 5 órdenes sin filtro:");
        (todasOrd || []).forEach((o) =>
          console.log(`    id=${o.id} numero_orden="${o.numero_orden}" estado="${o.estado}"`)
        );
      }

      // Step 4: diagnósticos por orden_id IN
      if (ordenes && ordenes.length > 0) {
        const ordenIds = ordenes.map((o) => o.id);
        const { data: diags, error: dErr } = await supabase
          .from("diagnosticos")
          .select("id, orden_id, tipo_servicio, tecnico_nombre, created_at")
          .in("orden_id", ordenIds);
        if (dErr) console.error("  ❌ diagnosticos error:", dErr.message);
        console.log(`  Paso 4 — diagnósticos encontrados: ${(diags || []).length}`);
      }
    }
  }

  sep("DIAGNÓSTICO COMPLETADO");
  console.log("Comparte la salida completa para analizar el problema.\n");
}

main().catch((e) => {
  console.error("Error fatal:", e);
  process.exit(1);
});
