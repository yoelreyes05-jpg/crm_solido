import { createClient } from "@supabase/supabase-js";
const s = createClient(
  "https://axzdtgcouczgdxjopikn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4emR0Z2NvdWN6Z2R4am9waWtuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY4OTc5NiwiZXhwIjoyMDkxMjY1Nzk2fQ.usoQe04sTQz9SkHwU0Kpxb0YNWh_MO6Arr1kKgrBy-o"
);

// Solo avances recientes
const r1 = await s.from("avances_reparacion").select("id,diagnostico_id,descripcion,tecnico_nombre,created_at").order("id",{ascending:false}).limit(5);
console.log("AVANCES:", JSON.stringify(r1.data));
console.log("ERR:", r1.error?.message);
