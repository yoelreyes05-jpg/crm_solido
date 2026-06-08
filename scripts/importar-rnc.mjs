/**
 * importar-rnc.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Importa DGII_RNC.TXT a la tabla rnc_dgii en Supabase.
 *
 * EJECUTAR DESDE LA RAÍZ DEL PROYECTO:
 *   node scripts/importar-rnc.mjs
 *
 * No requiere dependencias externas — usa Node.js nativo (≥18) + fetch nativo.
 * Lee SUPABASE_URL y SUPABASE_KEY desde crm-backend/.env automáticamente.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs       from "fs";
import path     from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");

// ── 1. Leer .env sin dotenv ──────────────────────────────────────────────────
function leerEnv(rutaEnv) {
  const env = {};
  if (!fs.existsSync(rutaEnv)) return env;
  for (const linea of fs.readFileSync(rutaEnv, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

const envVars      = leerEnv(path.join(ROOT, "crm-backend", ".env"));
const SUPABASE_URL = process.env.SUPABASE_URL || envVars.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || envVars.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Faltan SUPABASE_URL o SUPABASE_KEY en crm-backend/.env");
  process.exit(1);
}

// ── 2. Config ────────────────────────────────────────────────────────────────
const TXT_PATH   = path.join(ROOT, "DGII_RNC.TXT");
const BATCH_SIZE = 500;
const REST_BASE  = `${SUPABASE_URL}/rest/v1/rnc_dgii`;
const HEADERS    = {
  "apikey":        SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type":  "application/json",
  "Prefer":        "resolution=merge-duplicates",  // upsert
};

if (!fs.existsSync(TXT_PATH)) {
  console.error(`❌ Archivo no encontrado: ${TXT_PATH}`);
  process.exit(1);
}

// ── 3. Parser ────────────────────────────────────────────────────────────────
function parsearLinea(linea) {
  const cols = linea.split("|");
  if (cols.length < 10) return null;
  const rnc = cols[0]?.trim();
  if (!rnc || rnc.length < 9) return null;
  return {
    rnc,
    razon_social:      cols[1]?.trim() || "",
    nombre_comercial:  cols[2]?.trim() || null,
    actividad:         cols[3]?.trim() || null,
    fecha_constitucion: cols[8]?.trim() || null,
    estado:            cols[9]?.trim()  || null,
    tipo:              cols[10]?.trim() || null,
  };
}

// ── 4. Insertar batch via REST API (sin cliente supabase-js) ─────────────────
async function insertarBatch(batch) {
  const res = await fetch(REST_BASE, {
    method:  "POST",
    headers: HEADERS,
    body:    JSON.stringify(batch),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error(`  ⚠️  Batch error ${res.status}: ${txt.slice(0, 120)}`);
    return false;
  }
  return true;
}

// ── 5. Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Iniciando importación DGII → Supabase");
  console.log(`   Archivo : ${TXT_PATH}`);
  console.log(`   Destino : ${REST_BASE}`);
  console.log(`   Batch   : ${BATCH_SIZE} filas\n`);

  // Leer como latin1 directamente (Node admite 'latin1' en createReadStream)
  const stream = fs.createReadStream(TXT_PATH, { encoding: "latin1" });
  const rl     = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let batch    = [];
  let total    = 0;
  let errores  = 0;
  let omitidas = 0;
  const inicio = Date.now();

  for await (const linea of rl) {
    const row = parsearLinea(linea);
    if (!row) { omitidas++; continue; }

    batch.push(row);

    if (batch.length >= BATCH_SIZE) {
      const ok = await insertarBatch(batch);
      total += batch.length;
      if (!ok) errores += batch.length;
      batch = [];

      if (total % 10000 === 0) {
        const seg = ((Date.now() - inicio) / 1000).toFixed(0);
        const rpm = Math.round(total / Number(seg) * 60);
        console.log(`   ✅ ${total.toLocaleString()} registros | ${seg}s | ~${rpm} reg/min`);
      }
    }
  }

  // Último batch
  if (batch.length) {
    const ok = await insertarBatch(batch);
    total += batch.length;
    if (!ok) errores += batch.length;
  }

  const seg = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log("\n════════════════════════════════════════");
  console.log(`✅ Completado en ${seg}s`);
  console.log(`   Insertados : ${(total - errores).toLocaleString()}`);
  console.log(`   Omitidas   : ${omitidas.toLocaleString()}`);
  console.log(`   Con error  : ${errores.toLocaleString()}`);
  console.log("════════════════════════════════════════");
}

main().catch(e => { console.error("❌ Error fatal:", e.message); process.exit(1); });
