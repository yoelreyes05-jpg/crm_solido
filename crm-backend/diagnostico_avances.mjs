import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://axzdtgcouczgdxjopikn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4emR0Z2NvdWN6Z2R4am9waWtuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY4OTc5NiwiZXhwIjoyMDkxMjY1Nzk2fQ.usoQe04sTQz9SkHwU0Kpxb0YNWh_MO6Arr1kKgrBy-o"
);

// 1. Ver últimas ordenes
const { data: ordenes } = await supabase.from("ordenes_trabajo")
  .select("id, numero_orden, estado")
  .in("estado", ["REPARACION","CONTROL_CALIDAD","LISTO","ENTREGADO"])
  .order("id", { ascending: false })
  .limit(5);
console.log("\n== ÚLTIMAS ORDENES EN REPARACION/QC/LISTO ==");
console.log(JSON.stringify(ordenes, null, 2));

// 2. Ver diagnósticos de esas ordenes
const ordenIds = ordenes?.map(o => o.id) || [];
const { data: diags } = await supabase.from("diagnosticos")
  .select("id, orden_id, estado, tecnico_nombre")
  .in("orden_id", ordenIds);
console.log("\n== DIAGNÓSTICOS ==");
console.log(JSON.stringify(diags, null, 2));

// 3. Ver avances con esos diagnostico_ids
const diagIds = diags?.map(d => d.id) || [];
const { data: avances, error: avErr } = await supabase.from("avances_reparacion")
  .select("*")
  .in("diagnostico_id", diagIds)
  .order("created_at", { ascending: false })
  .limit(10);
console.log("\n== AVANCES (avances_reparacion) ==");
console.log("Error:", avErr?.message || "ninguno");
console.log(JSON.stringify(avances, null, 2));

// 4. Ver si hay avances con diagnostico_id NULL
const { data: avancesNull } = await supabase.from("avances_reparacion")
  .select("*")
  .is("diagnostico_id", null)
  .limit(5);
console.log("\n== AVANCES SIN diagnostico_id (NULL) ==");
console.log(JSON.stringify(avancesNull, null, 2));

// 5. Columnas reales de avances_reparacion (primeras filas)
const { data: todos } = await supabase.from("avances_reparacion")
  .select("*")
  .order("id", { ascending: false })
  .limit(3);
console.log("\n== MUESTRA AVANCES (3 últimos, todos los campos) ==");
console.log(JSON.stringify(todos, null, 2));

