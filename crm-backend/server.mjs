import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();

// CORS — configurable por variable de entorno CORS_ORIGINS
// En producción: CORS_ORIGINS=https://mi-app.vercel.app,https://otro-dominio.com
// En desarrollo: dejar vacío para permitir todo
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map(o => o.trim())
  : null;

app.use(cors({
  origin: (origin, cb) => {
    // Sin restricción si CORS_ORIGINS no está configurado
    if (!CORS_ORIGINS) return cb(null, true);
    // Permitir peticiones sin origin (Postman, Railway-internal, SSR)
    if (!origin) return cb(null, true);
    if (CORS_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origen no permitido → ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.get("/", (req, res) => res.send("🔥 SÓLIDO AUTO SERVICIO — SISTEMA ACTIVO"));

// ── DIAGNÓSTICO TEMPORAL ─────────────────────────────────────────────────────
app.get("/debug/orden/:id", async (req, res) => {
  const idNum = parseInt(req.params.id, 10);
  const [ordRes, diagRes, allDiags] = await Promise.all([
    supabase.from("ordenes_trabajo").select("id, estado, numero_orden").eq("id", idNum).maybeSingle(),
    supabase.from("diagnosticos").select("*").eq("orden_id", idNum),
    supabase.from("diagnosticos").select("*").order("id", { ascending: false }).limit(10),
  ]);
  res.json({
    orden:              ordRes.data,
    orden_error:        ordRes.error?.message || null,
    diagnosticos_orden: diagRes.data,
    diagnosticos_error: diagRes.error?.message || null,
    ultimos_10_diags:   allDiags.data,
    ultimos_10_error:   allDiags.error?.message || null,
  });
});

app.get("/debug", async (req, res) => {
  const keyRaw  = process.env.SUPABASE_KEY || "";
  const urlRaw  = process.env.SUPABASE_URL || "";
  const keyPrev = keyRaw ? keyRaw.substring(0, 40) + "..." : "⚠️ NO ENCONTRADA";

  // Test 1: Supabase JS client
  const { data: clientData, error: clientError } = await supabase.from("clientes").select("count").limit(1);

  // Test 2: Fetch directo a la REST API (sin cliente JS)
  let fetchResult = null;
  let fetchError  = null;
  try {
    const r = await fetch(`${urlRaw}/rest/v1/clientes?select=count&limit=1`, {
      headers: {
        "apikey":        keyRaw,
        "Authorization": `Bearer ${keyRaw}`,
        "Content-Type":  "application/json",
      },
    });
    fetchResult = { status: r.status, ok: r.ok, body: await r.text() };
  } catch (e) {
    fetchError = e.message;
  }

  res.json({
    supabase_url:       urlRaw || "⚠️ NO ENCONTRADA",
    supabase_key_prev:  keyPrev,
    key_length:         keyRaw.length,
    client_data:        clientData,
    client_error:       clientError ? { message: clientError.message, code: clientError.code } : null,
    fetch_directo:      fetchResult,
    fetch_directo_error: fetchError,
  });
});

// =====================================================
// 📌 CLIENTES
// =====================================================
app.get("/clientes", async (req, res) => {
  const { data } = await supabase
    .from("clientes")
    .select("*")
    .or("activo.eq.true,activo.is.null")
    .order("id", { ascending: false });
  res.json(data || []);
});

app.post("/clientes", async (req, res) => {
  const { nombre, telefono, email } = req.body;
  const { data, error } = await supabase.from("clientes").insert([{ nombre, telefono, email }]).select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.patch("/clientes/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, email } = req.body;
  const campos = {};
  if (nombre   !== undefined) campos.nombre   = nombre;
  if (telefono !== undefined) campos.telefono = telefono;
  if (email    !== undefined) campos.email    = email;
  const { data, error } = await supabase.from("clientes").update(campos).eq("id", id).select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.delete("/clientes/:id", async (req, res) => {
  const { id } = req.params;
  // Soft delete: marcar como inactivo preserva historial de órdenes y vehículos
  const { error } = await supabase.from("clientes").update({ activo: false }).eq("id", id);
  if (error) return res.json({ error: error.message });
  res.json({ ok: true, archived: true });
});

// Historial completo de un cliente
app.get("/clientes/:id/historial", async (req, res) => {
  const { id } = req.params;
  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", id).single();
  const { data: vehiculos } = await supabase.from("vehiculos").select("*").eq("cliente_id", id);
  const { data: ordenes } = await supabase.from("ordenes_trabajo").select("*").eq("cliente_id", id).order("created_at", { ascending: false });
  const { data: ventas } = await supabase.from("ventas").select("*").eq("customer_name", cliente?.nombre).order("created_at", { ascending: false });
  const { data: diagnosticos } = await supabase.from("diagnosticos").select("*").eq("cliente_id", id).order("created_at", { ascending: false });
  res.json({ cliente, vehiculos: vehiculos || [], ordenes: ordenes || [], ventas: ventas || [], diagnosticos: diagnosticos || [] });
});

// GET /clientes/:id/vehiculos — vehículos de un cliente (usado en Recepción paso 2)
app.get("/clientes/:id/vehiculos", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("vehiculos")
      .select("*")
      .eq("cliente_id", req.params.id)
      .order("id", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    // Filtrar soft-deleted si la columna activo existe
    res.json((data || []).filter(v => v.activo !== false));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// 🚗 VEHÍCULOS
// =====================================================
// =====================================================
// 🚗 VIN DECODER (NHTSA) + CATÁLOGO DE COMPATIBILIDAD
// =====================================================

/**
 * Normaliza la respuesta de NHTSA a campos simples.
 * NHTSA retorna un array de {Variable, Value} — extraemos los que importan.
 */
function parsearNHTSA(results) {
  const get = (label) =>
    results.find(r => r.Variable === label)?.Value?.trim() || null;

  const marca       = get("Make");
  const modeloBase  = get("Model");
  const trim        = get("Trim");
  // Combinar modelo + trim: "RX" + "330" → "RX 330"
  const modelo      = modeloBase && trim ? `${modeloBase} ${trim}` : (modeloBase || null);
  const ano         = get("Model Year");
  const motorCC     = get("Displacement (CC)");
  const motorL      = get("Displacement (L)");
  const cilindros   = get("Engine Number of Cylinders");
  const config      = get("Engine Configuration");
  const combustible = get("Fuel Type - Primary");
  const pais        = get("Plant Country");
  const tipo        = get("Vehicle Type");

  // Normalizar configuración de motor: "V-Shaped" → "V6", "In-Line" → "L4"
  let configStr = null;
  if (config && cilindros) {
    if (config.toLowerCase().includes("v")) configStr = `V${cilindros}`;
    else if (config.toLowerCase().includes("line")) configStr = `L${cilindros}`;
    else configStr = config;
  }

  // Construir descripción del motor: "3.3L V6" o "1.5L L4"
  let motorStr = null;
  if (motorL) {
    motorStr = `${parseFloat(motorL).toFixed(1)}L`;
    if (configStr) motorStr += ` ${configStr}`;
    else if (cilindros) motorStr += ` (${cilindros} cil.)`;
  } else if (motorCC) {
    motorStr = `${motorCC}cc`;
    if (configStr) motorStr += ` ${configStr}`;
  }

  // Normalizar combustible
  const fuelMap = {
    "Gasoline": "Gasolina", "Diesel": "Diesel", "Electric": "Eléctrico",
    "Flexible Fuel Vehicle (FFV)": "Flex (Gas/Etanol)",
    "Hybrid": "Híbrido", "Plug-in Hybrid": "Híbrido Enchufable",
    "Compressed Natural Gas (CNG)": "Gas Natural",
  };
  const combustibleStr = (combustible && fuelMap[combustible]) || combustible || null;

  return { marca, modelo, ano, motor: motorStr, combustible: combustibleStr, pais, tipo_vehiculo: tipo };
}

/**
 * GET /vin/:vin
 * Decodifica un VIN usando la API gratuita de NHTSA.
 * Cachea el resultado en la tabla vin_cache para no repetir llamadas.
 */
app.get("/vin/:vin", async (req, res) => {
  try {
    const vin = req.params.vin?.trim().toUpperCase();
    if (!vin || vin.length !== 17) return res.status(400).json({ error: "VIN debe tener exactamente 17 caracteres" });

    // 1. Buscar en caché
    const { data: cached } = await supabase
      .from("vin_cache")
      .select("*")
      .eq("vin", vin)
      .maybeSingle();
    if (cached) {
      console.log(`✅ VIN ${vin} — desde caché`);
      return res.json({ ...cached, fuente: "cache" });
    }

    // 2. Llamar a NHTSA (timeout manual compatible con Node 16+)
    const nhtsa = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`
    );
    if (!nhtsa.ok) return res.status(502).json({ error: "Error consultando NHTSA" });

    const json    = await nhtsa.json();
    const results = json?.Results || [];
    const parsed  = parsearNHTSA(results);

    if (!parsed.marca) {
      return res.status(404).json({ error: "VIN no reconocido por NHTSA" });
    }

    // 3. Guardar en caché
    await supabase.from("vin_cache").upsert({
      vin,
      ...parsed,
      datos_raw:  results,
      created_at: new Date().toISOString(),
    }, { onConflict: "vin" }).catch(() => {});

    console.log(`✅ VIN ${vin} — ${parsed.marca} ${parsed.modelo} ${parsed.ano}`);
    res.json({ ...parsed, vin, fuente: "nhtsa" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /vin/:vin/repuestos-sugeridos ─────────────────────────────────────────
// Para ventas de mostrador: decodifica el VIN y retorna repuestos compatibles
// sin necesitar un vehiculo_id registrado en el sistema.
app.get("/vin/:vin/repuestos-sugeridos", async (req, res) => {
  try {
    const vin = req.params.vin.toUpperCase().trim();
    if (vin.length !== 17) return res.status(400).json({ error: "VIN debe tener 17 caracteres" });

    // 1. Intentar cache primero
    let perfil = null;
    const { data: cached } = await supabase
      .from("vin_cache")
      .select("marca, modelo, ano, motor, combustible")
      .eq("vin", vin)
      .maybeSingle();

    if (cached?.marca) {
      perfil = cached;
    } else {
      // 2. Llamar NHTSA
      const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(vin)}?format=json`;
      const r = await fetch(url);
      const body = await r.json();
      const results = body?.Results || [];
      perfil = parsearNHTSA(results);

      if (perfil.marca) {
        await supabase.from("vin_cache").upsert({
          vin, ...perfil, datos_raw: results, created_at: new Date().toISOString(),
        }, { onConflict: "vin" }).catch(() => {});
      }
    }

    if (!perfil?.marca) return res.status(404).json({ error: "VIN no reconocido", sugeridos: [] });

    // 3. Buscar compatibilidades en catálogo
    const anoNum = parseInt(perfil.ano) || 0;
    const { data: compat } = await supabase
      .from("repuesto_compatibilidad")
      .select(`
        inventario_id, veces_usado, confirmado, origen,
        inventario:inventario_id (id, name, code, price, stock, categoria)
      `)
      .ilike("marca", perfil.marca || "")
      .or(`modelo.ilike.%${perfil.modelo || ""}%,modelo.is.null`)
      .lte("ano_desde", anoNum || 9999)
      .gte("ano_hasta", anoNum || 0)
      .order("veces_usado", { ascending: false })
      .limit(15);

    const vistos = new Set();
    const sugeridos = (compat || []).filter(c => {
      if (!c.inventario || vistos.has(c.inventario_id)) return false;
      vistos.add(c.inventario_id);
      return true;
    });

    res.json({ perfil, sugeridos, vin });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── IA: Mejorar texto técnico (diagnóstico / trabajos) ───────────────────────
app.post("/api/ia/mejorar-texto", async (req, res) => {
  const { texto, tipo, vehiculo, cliente } = req.body;
  if (!texto || texto.trim().length < 10)
    return res.status(400).json({ error: "Texto muy corto para procesar." });

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: "IA no configurada en el servidor." });

  const ctx = [vehiculo ? `Vehículo: ${vehiculo}` : "", cliente ? `Cliente: ${cliente}` : ""].filter(Boolean).join(" | ");

  const prompts = {
    diagnostico: `Eres el asistente técnico oficial de "Sólido Auto Servicio", taller automotriz en República Dominicana.
Un técnico escribió este diagnóstico de forma rápida${ctx ? ` (${ctx})` : ""}:
"""
${texto.trim()}
"""
Transfórmalo en un DIAGNÓSTICO TÉCNICO PROFESIONAL en español usando exactamente este formato:

HALLAZGOS TÉCNICOS:
[descripción clara y técnica de cada problema detectado]

CAUSA PROBABLE:
[análisis técnico de la causa raíz]

TRABAJOS RECOMENDADOS:
[lista numerada de los trabajos a realizar]

OBSERVACIONES:
[notas relevantes para el cliente o el taller]

Reglas: mantén TODA la información original sin inventar nada nuevo. Usa terminología técnica automotriz. Máximo 320 palabras. Responde SOLO con el diagnóstico.`,

    trabajos: `Eres el asistente técnico de "Sólido Auto Servicio", taller en República Dominicana.
Un técnico escribió esta lista de trabajos a realizar (es un DIAGNÓSTICO, NO un reporte de trabajos ya ejecutados)${ctx ? ` (${ctx})` : ""}:
"""
${texto.trim()}
"""
Transfórmala en una lista numerada de TRABAJOS RECOMENDADOS, redactados en modo prescriptivo/recomendación (lo que SE DEBE HACER), NO en pasado ni como reporte de trabajos ya ejecutados. Usa verbos en infinitivo o futuro ("Sustituir...", "Verificar...", "Realizar..."). Descripción técnica breve por ítem, menciona estándares cuando aplique. Máximo 220 palabras. Responde SOLO con la lista.`,
  };

    avance: `Eres el asistente técnico de "Sólido Auto Servicio", taller en República Dominicana.
Un técnico describió el trabajo que YA REALIZÓ (avance de reparación)${ctx ? ` (${ctx})` : ""}:
"""
${texto.trim()}
"""
Transfórmalo en un REPORTE TÉCNICO PROFESIONAL de trabajo ejecutado, redactado en pasado ("Se sustituyó...", "Se verificó...", "Se procedió a..."). Lista numerada, descripción técnica precisa por ítem, menciona materiales o estándares cuando aplique. Máximo 220 palabras. Responde SOLO con el reporte.`,
  };

  const prompt = prompts[tipo] || prompts.diagnostico;

  try {
    const oRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 700,
        temperature: 0.25,
      }),
    });
    if (!oRes.ok) {
      const err = await oRes.text();
      console.error("OpenAI error:", err);
      return res.status(502).json({ error: "Error al conectar con IA." });
    }
    const data = await oRes.json();
    const mejorado = data.choices?.[0]?.message?.content?.trim();
    if (!mejorado) return res.status(502).json({ error: "IA no devolvió respuesta." });
    res.json({ mejorado });
  } catch (e) {
    console.error("IA error:", e);
    res.status(500).json({ error: "Error interno al procesar con IA." });
  }
});

// ── POST /vin/registrar-consulta ─────────────────────────────────────────────
// Registra en vin_historial cada vez que se decodifica un VIN en el frontend.
app.post("/vin/registrar-consulta", async (req, res) => {
  try {
    const { vin, marca, modelo, ano, motor, combustible,
            origen, vehiculo_id, orden_id, factura_id } = req.body || {};
    if (!vin || vin.length !== 17) return res.status(400).json({ error: "VIN inválido" });

    await supabase.from("vin_historial").insert({
      vin: vin.toUpperCase(),
      marca: marca || null, modelo: modelo || null, ano: ano || null,
      motor: motor || null, combustible: combustible || null,
      origen: origen || null,
      vehiculo_id: vehiculo_id ? Number(vehiculo_id) : null,
      orden_id:    orden_id    ? Number(orden_id)    : null,
      factura_id:  factura_id  ? Number(factura_id)  : null,
      consultado_en: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/predictivo/vin-historial ────────────────────────────────────────
// Retorna las últimas 60 consultas VIN con info del vehículo enlazado.
app.get("/api/predictivo/vin-historial", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("vin_historial")
      .select("id, vin, marca, modelo, ano, motor, combustible, origen, consultado_en, vehiculo_id, orden_id, factura_id")
      .order("consultado_en", { ascending: false })
      .limit(60);
    if (error) throw error;

    const rows = data || [];
    const vehiculoIds = [...new Set(rows.filter(r => r.vehiculo_id).map(r => r.vehiculo_id))];
    let vehiculoMap = {};
    if (vehiculoIds.length > 0) {
      const { data: vehs } = await supabase
        .from("vehiculos")
        .select("id, placa, clientes:cliente_id(nombre)")
        .in("id", vehiculoIds);
      (vehs || []).forEach(v => { vehiculoMap[v.id] = v; });
    }

    const enriched = rows.map(r => ({
      ...r,
      placa:          vehiculoMap[r.vehiculo_id]?.placa || null,
      cliente_nombre: vehiculoMap[r.vehiculo_id]?.clientes?.nombre || null,
    }));
    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/predictivo/compatibilidad-stats ─────────────────────────────────
// Estadísticas del catálogo de compatibilidad auto-aprendido.
app.get("/api/predictivo/compatibilidad-stats", async (req, res) => {
  try {
    const { data: totales } = await supabase
      .from("repuesto_compatibilidad")
      .select("origen, confirmado");

    const totalAuto      = (totales || []).filter(r => r.origen === "auto").length;
    const totalManual    = (totales || []).filter(r => r.origen === "manual").length;
    const totalConfirmado = (totales || []).filter(r => r.confirmado).length;

    const { data: topRepuestos } = await supabase
      .from("repuesto_compatibilidad")
      .select("inventario_id, veces_usado, inventario:inventario_id(name, code, categoria)")
      .order("veces_usado", { ascending: false })
      .limit(15);

    const { data: topMarcasRaw } = await supabase
      .from("repuesto_compatibilidad")
      .select("marca")
      .not("marca", "is", null);

    const marcaCount = {};
    (topMarcasRaw || []).forEach(r => {
      const m = r.marca?.toUpperCase();
      if (m) marcaCount[m] = (marcaCount[m] || 0) + 1;
    });
    const top_marcas = Object.entries(marcaCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([marca, total]) => ({ marca, total }));

    res.json({
      resumen: { total_auto: totalAuto, total_manual: totalManual, total_confirmado: totalConfirmado },
      top_repuestos: topRepuestos || [],
      top_marcas,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /vehiculos/:id/repuestos-sugeridos ───────────────────────────────────
// Retorna los repuestos más usados/compatibles con el vehículo de esa orden.
app.get("/vehiculos/:id/repuestos-sugeridos", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: veh } = await supabase
      .from("vehiculos")
      .select("marca, modelo, ano, motor, combustible")
      .eq("id", id)
      .maybeSingle();
    if (!veh) return res.status(404).json({ error: "Vehículo no encontrado" });

    const anoNum = parseInt(veh.ano) || 0;

    // Buscar compatibilidades exactas o por marca/modelo
    const { data: compat } = await supabase
      .from("repuesto_compatibilidad")
      .select(`
        inventario_id, veces_usado, confirmado, origen,
        inventario:inventario_id (id, name, code, price, stock, categoria)
      `)
      .ilike("marca", veh.marca || "")
      .or(`modelo.ilike.%${veh.modelo || ""}%,modelo.is.null`)
      .lte("ano_desde", anoNum || 9999)
      .gte("ano_hasta", anoNum || 0)
      .order("veces_usado", { ascending: false })
      .limit(15);

    // Deduplicar por inventario_id (puede haber varios rangos)
    const vistos = new Set();
    const dedup  = (compat || []).filter(c => {
      if (!c.inventario || vistos.has(c.inventario_id)) return false;
      vistos.add(c.inventario_id);
      return true;
    });

    res.json({ vehiculo: veh, sugeridos: dedup });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /inventario/:id/compatibilidad ──────────────────────────────────────
app.get("/inventario/:id/compatibilidad", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("repuesto_compatibilidad")
      .select("*")
      .eq("inventario_id", req.params.id)
      .order("marca").order("modelo").order("ano_desde");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /repuesto-compatibilidad — agregar/confirmar manualmente ────────────
app.post("/repuesto-compatibilidad", async (req, res) => {
  try {
    const { inventario_id, marca, modelo, ano_desde, ano_hasta, motor, combustible, notas } = req.body;
    if (!inventario_id || !marca) return res.status(400).json({ error: "inventario_id y marca requeridos" });

    // Upsert: si ya existe la combinación, incrementa veces_usado
    const { data: existing } = await supabase
      .from("repuesto_compatibilidad")
      .select("id, veces_usado")
      .eq("inventario_id", inventario_id)
      .ilike("marca", marca)
      .ilike("modelo", modelo || "")
      .eq("ano_desde", ano_desde || 0)
      .eq("ano_hasta", ano_hasta || 9999)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("repuesto_compatibilidad")
        .update({ veces_usado: existing.veces_usado + 1, confirmado: true, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data[0]);
    }

    const { data, error } = await supabase
      .from("repuesto_compatibilidad")
      .insert([{
        inventario_id, marca, modelo: modelo || null,
        ano_desde: ano_desde || 0, ano_hasta: ano_hasta || 9999,
        motor: motor || null, combustible: combustible || null,
        notas: notas || null, confirmado: true, origen: "manual",
      }])
      .select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /repuesto-compatibilidad/:id ─────────────────────────────────────
app.delete("/repuesto-compatibilidad/:id", async (req, res) => {
  try {
    await supabase.from("repuesto_compatibilidad").delete().eq("id", req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * Registra compatibilidades aprendidas cuando se cierra una orden.
 * Lee los repuestos usados en cotizaciones.items_detalle y los ata al vehículo.
 */
async function registrarCompatibilidadesDeOrden(ordenId) {
  try {
    const { data: orden } = await supabase
      .from("ordenes_trabajo")
      .select("vehiculo_id")
      .eq("id", ordenId)
      .maybeSingle();
    if (!orden?.vehiculo_id) return;

    const { data: veh } = await supabase
      .from("vehiculos")
      .select("marca, modelo, ano, motor, combustible")
      .eq("id", orden.vehiculo_id)
      .maybeSingle();
    if (!veh?.marca) return;

    const { data: diag } = await supabase
      .from("diagnosticos")
      .select("id")
      .eq("orden_id", ordenId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!diag?.id) return;

    const { data: cot } = await supabase
      .from("cotizaciones")
      .select("items_detalle")
      .eq("diagnostico_id", diag.id)
      .maybeSingle();
    if (!cot?.items_detalle) return;

    const items = Array.isArray(cot.items_detalle) ? cot.items_detalle : [];
    const anoNum = parseInt(veh.ano) || 0;

    for (const item of items) {
      if (!item.inventario_id && !item.id) continue;
      const invId = item.inventario_id || item.id;

      // Buscar si ya existe esta combinación
      const { data: ex } = await supabase
        .from("repuesto_compatibilidad")
        .select("id, veces_usado")
        .eq("inventario_id", invId)
        .ilike("marca", veh.marca)
        .ilike("modelo", veh.modelo || "")
        .maybeSingle();

      if (ex) {
        await supabase
          .from("repuesto_compatibilidad")
          .update({ veces_usado: ex.veces_usado + 1, updated_at: new Date().toISOString() })
          .eq("id", ex.id);
      } else {
        await supabase.from("repuesto_compatibilidad").insert([{
          inventario_id: invId,
          marca:        veh.marca,
          modelo:       veh.modelo  || null,
          ano_desde:    anoNum > 0 ? anoNum : 0,
          ano_hasta:    anoNum > 0 ? anoNum : 9999,
          motor:        veh.motor   || null,
          combustible:  veh.combustible || null,
          origen:       "aprendido",
          confirmado:   false,
        }]).catch(() => {});
      }
    }
    console.log(`📚 Compatibilidades aprendidas — orden ${ordenId}`);
  } catch (e) {
    console.warn("⚠️ registrarCompatibilidades error:", e.message);
  }
}

app.get("/vehiculos/catalogo", (req, res) => {
  res.json({
    Toyota: ["Corolla", "Hilux", "Camry", "Venza", "RAV4", "4Runner", "Yaris"],
    Honda: ["Civic", "Accord", "CR-V", "Fit"],
    Nissan: ["Sentra", "Altima", "Versa", "Tiida", "Rougue", "Qashqui", "Frontier"],
    Hyundai: ["Elantra", "Tucson", "Sonada", "Avante", "Santa Fe"],
    Kia: ["Rio", "Sportage", "K5", "Sorento"],
    Ford: ["F-150", "Explorer", "Scape", "Ranger"],
    Chevrolet: ["Silverado", "Tahoe", "Spark"],
    BMW: ["X5", "X3", "Serie 3"],
    Volkswagen: ["Amarok", "Jetta", "Polo"],
    Mercedes: ["C-Class", "E-Class", "GLC"],
    Jeep: ["Wrangler", "Grand Cherokee"],
    OTRO: ["Personalizado"]
  });
});

app.get("/vehiculos", async (req, res) => {
  try {
    // Query 1: todos los vehículos (sin join embebido — más robusto)
    const { data: vData, error: vError } = await supabase
      .from("vehiculos")
      .select("*")
      .order("id", { ascending: false });
    if (vError) return res.status(500).json({ error: vError.message });

    // Query 2: clientes (para armar nombre/teléfono)
    const { data: cData } = await supabase.from("clientes").select("id, nombre, telefono");
    const clienteMap = {};
    (cData || []).forEach(c => { clienteMap[c.id] = c; });

    // Unir y filtrar soft-deleted (si la columna activo existe)
    const fixed = (vData || [])
      .filter(v => v.activo !== false)
      .map(v => ({
        ...v,
        cliente_nombre:   clienteMap[v.cliente_id]?.nombre   || "Sin cliente",
        cliente_telefono: clienteMap[v.cliente_id]?.telefono || "",
      }));

    res.json(fixed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/vehiculos", async (req, res) => {
  const { cliente_id, marca, modelo, ano, placa, color, vin, motor, combustible, vin_data } = req.body;
  const { data, error } = await supabase.from("vehiculos")
    .insert([{ cliente_id, marca, modelo, ano, placa, color,
      vin: vin || null, motor: motor || null,
      combustible: combustible || null, vin_data: vin_data || null }])
    .select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.delete("/vehiculos/:id", async (req, res) => {
  const { id } = req.params;
  // Intentar soft delete primero; si la columna activo no existe, hacer hard delete
  const { error: softError } = await supabase.from("vehiculos").update({ activo: false }).eq("id", id);
  if (softError) {
    // La columna activo puede no existir — hacer delete físico como fallback
    const { error: hardError } = await supabase.from("vehiculos").delete().eq("id", id);
    if (hardError) return res.json({ error: hardError.message });
  }
  res.json({ ok: true });
});

app.patch("/vehiculos/:id", async (req, res) => {
  const { id } = req.params;
  const campos = ["cliente_id","marca","modelo","ano","placa","color","vin","motor","combustible","vin_data"].reduce((o, k) => {
    if (req.body[k] !== undefined) o[k] = req.body[k];
    return o;
  }, {});
  const { data, error } = await supabase.from("vehiculos").update(campos).eq("id", id).select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

// =====================================================
// 🧾 ÓRDENES DE TRABAJO
// =====================================================
app.get("/ordenes", async (req, res) => {
  try {
    // Query 1: órdenes sin join embebido
    const { data: oData, error: oError } = await supabase
      .from("ordenes_trabajo")
      .select("*")
      .order("id", { ascending: false });
    if (oError) throw new Error(oError.message);

    // Query 2, 3 y 4: clientes, vehículos y técnicos asignados
    // Cada query tiene su propio catch para que un fallo aislado no rompa toda la lista
    const [cRes, vRes, uRes] = await Promise.all([
      supabase.from("clientes").select("id, nombre, telefono").then(r => r).catch(() => ({ data: [] })),
      supabase.from("vehiculos").select("id, marca, modelo, placa, ano").then(r => r).catch(() => ({ data: [] })),
      supabase.from("usuarios").select("id, nombre").then(r => r).catch(() => ({ data: [] })),
    ]);
    const cData = cRes.data || [];
    const vData = vRes.data || [];
    const uData = uRes.data || [];

    const clienteMap = {};
    cData.forEach(c => { clienteMap[c.id] = c; });
    const vehiculoMap = {};
    vData.forEach(v => { vehiculoMap[v.id] = v; });
    const usuarioMap = {};
    uData.forEach(u => { usuarioMap[u.id] = u; });

    const fixed = (oData || []).map(o => {
      const cli = clienteMap[o.cliente_id];
      const veh = vehiculoMap[o.vehiculo_id];
      const tec = o.tecnico_asignado_id ? usuarioMap[o.tecnico_asignado_id] : null;
      return {
        ...o,
        estado:           o.estado || "RECIBIDO",
        numero_orden:     o.numero_orden || `OT-${String(o.id).padStart(4, "0")}`,
        cliente_nombre:   cli?.nombre   || "Sin cliente",
        cliente_telefono: cli?.telefono || "",
        vehiculo_info:    veh ? `${veh.marca} ${veh.modelo} (${veh.placa})` : "Sin vehículo",
        vehiculo_placa:   veh?.placa    || "",
        vehiculo_marca:   veh?.marca    || "",
        vehiculo_modelo:  veh?.modelo   || "",
        vehiculo_ano:     veh?.ano      ? String(veh.ano) : "",
        // Técnico asignado (desde FK tecnico_asignado_id → usuarios)
        tecnico_nombre:   tec?.nombre   || null,
      };
    });

    res.json(fixed);
  } catch (err) {
    console.error("ERROR /ordenes:", err.message);
    res.json([]);
  }
});

app.post("/ordenes", async (req, res) => {
  try {
    const { cliente_id, vehiculo_id, descripcion, usuario_id, usuario_nombre, inspeccion_id, motivo_entrada, prioridad } = req.body;
    if (!cliente_id || !vehiculo_id) return res.status(400).json({ error: "cliente_id y vehiculo_id son requeridos" });

    // Construir payload limpio — solo columnas que sabemos que existen
    const payload = {
      cliente_id:   Number(cliente_id),
      vehiculo_id:  Number(vehiculo_id),
      descripcion:  descripcion || "",
      estado:       "RECIBIDO",
      total:        0,
    };
    // Columnas opcionales nuevas (solo si fueron enviadas)
    if (inspeccion_id)  payload.inspeccion_id  = Number(inspeccion_id);
    if (motivo_entrada) payload.motivo_entrada  = motivo_entrada;
    if (prioridad)      payload.prioridad       = prioridad;

    const { data, error } = await supabase.from("ordenes_trabajo").insert([payload]).select();
    if (error) return res.status(400).json({ error: error.message });

    const orden = data[0];

    // Generar numero_orden y guardarlo (si la columna existe en Supabase)
    const numeroOrden = `OT-${String(orden.id).padStart(4, "0")}`;
    await supabase.from("ordenes_trabajo")
      .update({ numero_orden: numeroOrden })
      .eq("id", orden.id)
      .then(() => { orden.numero_orden = numeroOrden; })
      .catch(() => { orden.numero_orden = numeroOrden; }); // silencioso si columna no existe

    // Log de auditoría (silencioso si la tabla aún no existe)
    supabase.from("orden_trabajo_log").insert([{
      orden_id:        orden.id,
      estado_anterior: null,
      estado_nuevo:    "RECIBIDO",
      usuario_id:      usuario_id || null,
      usuario_nombre:  usuario_nombre || "Sistema",
      motivo:          "Orden creada",
      metadata:        {},
    }]).then(() => {}).catch(() => {});

    res.json(orden);
  } catch (err) {
    console.error("❌ POST /ordenes:", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch("/ordenes/:id", async (req, res) => {
  const { id } = req.params;
  const campos = { ...req.body };

  // Si viene un cambio de estado, usar la máquina de estados (kanban drag & drop)
  if (campos.estado !== undefined || campos.status !== undefined) {
    const nuevoEstado = campos.estado || campos.status;
    const usr = campos.usuario_nombre || "Sistema";
    const uid = campos.usuario_id || null;
    const result = await transicionarEstado(Number(id), nuevoEstado, {
      usuarioId: uid,
      usuarioNombre: usr,
      motivo: campos.motivo || "Cambio de estado",
    });
    if (!result.ok) {
      // Si la orden ya está en ese estado, devolver OK silencioso (evita error en borrador técnico)
      const { data: ordenActual } = await supabase
        .from("ordenes_trabajo").select("*").eq("id", id).maybeSingle();
      if (ordenActual?.estado === nuevoEstado) {
        return res.json(ordenActual);
      }
      return res.status(400).json({ error: result.error });
    }
    // Devolver la orden actualizada
    const { data: ordenFinal } = await supabase
      .from("ordenes_trabajo").select("*").eq("id", id).maybeSingle();
    return res.json(ordenFinal || { ok: true });
  }

  const { data, error } = await supabase.from("ordenes_trabajo").update(campos).eq("id", id).select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.delete("/ordenes/:id", async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("ordenes_trabajo").delete().eq("id", id);
  if (error) return res.json({ error: error.message });
  res.json({ ok: true });
});

// =====================================================
// 📦 INVENTARIO
// =====================================================
app.get("/inventario", async (req, res) => {
  const { data } = await supabase.from("inventario").select("*").order("id", { ascending: false });
  res.json(data || []);
});

app.post("/inventario", async (req, res) => {
  const { name, code, price, stock, min_stock, supplier_id,
          categoria, descripcion, marcas_compatibles, observaciones } = req.body;
  const { data, error } = await supabase.from("inventario")
    .insert([{
      name, code,
      price:       Number(price),
      stock:       Number(stock),
      min_stock:   Number(min_stock || 5),
      supplier_id: supplier_id || null,
      categoria:            categoria            || "General",
      descripcion:          descripcion          || null,
      marcas_compatibles:   marcas_compatibles   || null,
      observaciones:        observaciones        || null,
    }])
    .select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.put("/inventario/:id", async (req, res) => {
  const { id } = req.params;
  const { name, code, price, stock, min_stock, supplier_id,
          categoria, descripcion, marcas_compatibles, observaciones } = req.body;
  const { data, error } = await supabase.from("inventario")
    .update({
      name, code,
      price:       Number(price),
      stock:       Number(stock),
      min_stock:   Number(min_stock || 5),
      supplier_id: supplier_id || null,
      categoria:            categoria            || "General",
      descripcion:          descripcion          || null,
      marcas_compatibles:   marcas_compatibles   || null,
      observaciones:        observaciones        || null,
    })
    .eq("id", id).select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

// PATCH /inventario/:id — actualización parcial (ej: stock_delta para descontar)
app.patch("/inventario/:id", async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  // stock_delta: -N descuenta N unidades, +N suma N unidades
  if (body.stock_delta !== undefined) {
    const delta = Number(body.stock_delta);
    // Leer stock actual
    const { data: actual, error: errRead } = await supabase
      .from("inventario").select("stock").eq("id", id).single();
    if (errRead) return res.status(404).json({ error: errRead.message });

    const nuevoStock = Math.max(0, (actual.stock || 0) + delta);
    const { data, error } = await supabase.from("inventario")
      .update({ stock: nuevoStock }).eq("id", id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // Actualización genérica de campos enviados
  const campos = {};
  if (body.stock    !== undefined) campos.stock    = Number(body.stock);
  if (body.price    !== undefined) campos.price    = Number(body.price);
  if (body.name     !== undefined) campos.name     = body.name;
  if (body.code     !== undefined) campos.code     = body.code;
  if (Object.keys(campos).length === 0) return res.status(400).json({ error: "Sin campos para actualizar" });

  const { data, error } = await supabase.from("inventario")
    .update(campos).eq("id", id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete("/inventario/:id", async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("inventario").delete().eq("id", id);
  if (error) return res.json({ error: error.message });
  res.json({ ok: true });
});

// =====================================================
// 🚚 SUPLIDORES
// =====================================================
app.get("/suplidores", async (req, res) => {
  const { data } = await supabase.from("suplidores").select("*");
  res.json(data || []);
});

app.post("/suplidores", async (req, res) => {
  const { name, rnc, direccion, telefono, correo, tipo_servicio } = req.body;
  const { data, error } = await supabase.from("suplidores").insert([{ name, rnc, direccion, telefono, correo, tipo_servicio: tipo_servicio || null }]).select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.patch("/suplidores/:id", async (req, res) => {
  const { id } = req.params;
  const campos = ["name","rnc","direccion","telefono","correo","tipo_servicio"].reduce((o, k) => {
    if (req.body[k] !== undefined) o[k] = req.body[k];
    return o;
  }, {});
  const { data, error } = await supabase.from("suplidores").update(campos).eq("id", id).select();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});

app.delete("/suplidores/:id", async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("suplidores").delete().eq("id", id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// =====================================================
// 💰 VENTAS
// =====================================================
app.get("/ventas", async (req, res) => {
  const { data } = await supabase
    .from("ventas")
    .select("*")
    .order("id", { ascending: false });
  res.json(data || []);
});

app.post("/ventas", async (req, res) => {
  const { items, method, customer_name, ncf_tipo } = req.body;
  let subtotal = 0;
  const itemsConPrecio = [];

  for (const item of items) {
    const { data: prod } = await supabase
      .from("inventario")
      .select("*")
      .eq("id", item.partId)
      .single();

    if (prod) {
      subtotal += prod.price * item.quantity;
      itemsConPrecio.push({
        partId: item.partId,
        quantity: item.quantity,
        price: prod.price
      });
      await supabase
        .from("inventario")
        .update({ stock: prod.stock - item.quantity })
        .eq("id", item.partId);
    }
  }

  const itbis = subtotal * 0.18;
  const total = subtotal + itbis;
  const tipo = ncf_tipo || "B02";

  const { data: ncfData } = await supabase
    .from("ncf_config")
    .select("*")
    .eq("tipo", tipo)
    .single();

  let ncf;
  if (ncfData) {
    const nuevo = ncfData.secuencia_actual + 1;
    await supabase.from("ncf_config").update({ secuencia_actual: nuevo }).eq("tipo", tipo);
    ncf = ncfData.prefijo + String(nuevo).padStart(8, "0");
  } else {
    ncf = tipo + Math.floor(Math.random() * 99999999).toString().padStart(8, "0");
  }

  const { data: venta, error } = await supabase
    .from("ventas")
    .insert([{ customer_name, method, subtotal, itbis, total, ncf, ncf_tipo: tipo, estado: "ACTIVA" }])
    .select();

  if (error) return res.json({ error: error.message });

  if (itemsConPrecio.length > 0) {
    await supabase.from("venta_items").insert(
      itemsConPrecio.map(i => ({
        venta_id: venta[0].id,
        part_id: i.partId,
        quantity: i.quantity,
        price: i.price
      }))
    );
  }

  res.json(venta[0]);
});

// ⚠️ Este debe ir ANTES de /ventas/:id
app.get("/ventas/:id/items", async (req, res) => {
  const { id } = req.params;

  const { data: venta } = await supabase.from("ventas").select("*").eq("id", id).single();
  if (!venta) return res.json({ error: "Venta no encontrada" });

  const { data: ventaItems } = await supabase.from("venta_items").select("*").eq("venta_id", id);

  const itemsConDetalle = await Promise.all(
    (ventaItems || []).map(async (vi) => {
      const { data: prod } = await supabase
        .from("inventario").select("name, price").eq("id", vi.part_id).single();
      return {
        id: vi.part_id,
        name: prod?.name || "Producto eliminado",
        price: Number(vi.price),
        qty: vi.quantity
      };
    })
  );

  res.json({ venta, items: itemsConDetalle });
});

app.patch("/ventas/:id", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from("ventas").update(req.body).eq("id", id).select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.delete("/ventas/:id", async (req, res) => {
  const { id } = req.params;
  await supabase.from("venta_items").delete().eq("venta_id", id);
  const { error } = await supabase.from("ventas").delete().eq("id", id);
  if (error) return res.json({ error: error.message });
  res.json({ ok: true });
});

// =====================================================
// ☕ CAFETERÍA
// =====================================================
app.get("/cafeteria/productos", async (req, res) => {
  // Solo productos activos (soft delete: activo = true o activo IS NULL para compatibilidad)
  const { data } = await supabase
    .from("cafeteria_productos")
    .select("*")
    .or("activo.eq.true,activo.is.null")
    .order("categoria")
    .order("nombre");
  res.json(data || []);
});

app.post("/cafeteria/productos", async (req, res) => {
  const { nombre, precio, categoria, stock, imagen } = req.body;
  const { data, error } = await supabase.from("cafeteria_productos")
    .insert([{ nombre, precio: Number(precio), categoria: categoria || "General", stock: Number(stock || 0), imagen: imagen || null }])
    .select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.put("/cafeteria/productos/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, precio, categoria, stock, imagen } = req.body;
  const { data, error } = await supabase.from("cafeteria_productos")
    .update({ nombre, precio: Number(precio), categoria: categoria || "General", stock: Number(stock || 0), imagen: imagen !== undefined ? imagen : undefined })
    .eq("id", id).select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.patch("/cafeteria/productos/:id", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from("cafeteria_productos")
    .update(req.body).eq("id", id).select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.delete("/cafeteria/productos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  // Soft delete: marcar como inactivo para preservar historial de ventas
  // (no podemos borrar físicamente porque cafeteria_detalle tiene FK a esta tabla)
  const { error } = await supabase
    .from("cafeteria_productos")
    .update({ activo: false })
    .eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, archived: true });
});

// =====================================================
// 🔩 REPUESTOS (alias público sobre tabla inventario)
// Lee de la tabla "inventario" existente y mapea campos
// para el portal web. La gestión se hace desde /inventario.
// =====================================================
app.get("/repuestos", async (req, res) => {
  const { data } = await supabase
    .from("inventario")
    .select("id, name, code, price, stock, categoria, descripcion, marcas_compatibles, observaciones")
    .order("categoria", { ascending: true })
    .order("name",      { ascending: true });
  // Mapear campos de inventario al formato que espera la web
  const mapped = (data || []).map(item => ({
    id:                 item.id,
    nombre:             item.name,
    codigo:             item.code || null,
    descripcion:        item.descripcion || (item.code ? `Ref: ${item.code}` : null),
    precio:             item.price,
    stock:              item.stock,
    categoria:          item.categoria || "General",
    marcas_compatibles: item.marcas_compatibles || null,
    observaciones:      item.observaciones || null,
    imagen:             null,
    activo:             true,
  }));
  res.json(mapped);
});

app.get("/cafeteria/ordenes", async (req, res) => {
  const { data } = await supabase.from("cafeteria_ventas").select("*").order("id", { ascending: false });
  res.json(data || []);
});

// GET /cafeteria/historial?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&page=1
// Ventas con sus ítems y nombres de productos (para historial de facturas)
app.get("/cafeteria/historial", async (req, res) => {
  try {
    const { desde, hasta, page = 1 } = req.query;
    const limit  = 50;
    const offset = (parseInt(page) - 1) * limit;

    let q = supabase
      .from("cafeteria_ventas")
      .select(`id, total, metodo_pago, ncf, ncf_tipo, created_at,
               cafeteria_detalle(id, cantidad, precio,
                 cafeteria_productos(id, nombre))`, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (desde) q = q.gte("created_at", desde + "T00:00:00");
    if (hasta) q = q.lte("created_at", hasta + "T23:59:59");

    const { data, error, count } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ventas: data || [], total: count || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/cafeteria/ordenes", async (req, res) => {
  const { items, total, metodo_pago } = req.body;
  const { data: venta, error } = await supabase.from("cafeteria_ventas")
    .insert([{ total: Number(total), metodo_pago, created_at: new Date() }])
    .select();
  if (error) return res.json({ error: error.message });
  for (const item of items) {
    await supabase.from("cafeteria_detalle").insert([{ venta_id: venta[0].id, producto_id: item.id, cantidad: item.qty, precio: item.precio }]);
    const { data: prod } = await supabase.from("cafeteria_productos").select("stock").eq("id", item.id).single();
    if (prod) await supabase.from("cafeteria_productos").update({ stock: prod.stock - item.qty }).eq("id", item.id);
  }
  res.json(venta[0]);
});

app.post("/cafeteria/venta", async (req, res) => {
  const { items, total, metodo_pago, ncf_tipo } = req.body;
  const tipo = ncf_tipo || "B02";

  const { data: ncfData } = await supabase.from("ncf_config").select("*").eq("tipo", tipo).single();

  let ncf = tipo + "00000001";
  if (ncfData) {
    const nuevo = ncfData.secuencia_actual + 1;
    await supabase.from("ncf_config").update({ secuencia_actual: nuevo }).eq("tipo", tipo);
    ncf = ncfData.prefijo + String(nuevo).padStart(8, "0");
  }

  const { data: venta, error } = await supabase
    .from("cafeteria_ventas")
    .insert([{ total: Number(total), metodo_pago, ncf, ncf_tipo: tipo, created_at: new Date() }])
    .select();
  if (error) return res.json({ error: error.message });

  for (const item of items) {
    await supabase.from("cafeteria_detalle").insert([{
      venta_id: venta[0].id, producto_id: item.id,
      cantidad: item.qty, precio: item.precio
    }]);
    const { data: prod } = await supabase.from("cafeteria_productos").select("stock").eq("id", item.id).single();
    if (prod) await supabase.from("cafeteria_productos").update({ stock: prod.stock - item.qty }).eq("id", item.id);
  }
  res.json({ ...venta[0], ncf });
});

// =====================================================
// ☕ CUADRE DE CAFETERÍA
// =====================================================

// GET /cafeteria/cuadre/auto?fecha=YYYY-MM-DD — calcula ventas del día
app.get("/cafeteria/cuadre/auto", async (req, res) => {
  try {
    const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
    const desde = `${fecha}T00:00:00`;
    const hasta  = `${fecha}T23:59:59`;

    const { data: ventas } = await supabase
      .from("cafeteria_ventas")
      .select("total, metodo_pago")
      .gte("created_at", desde)
      .lte("created_at", hasta);

    const vtas = ventas || [];
    const ventas_efectivo      = vtas.filter(v => (v.metodo_pago || "EFECTIVO") === "EFECTIVO").reduce((a, v) => a + Number(v.total), 0);
    const ventas_tarjeta       = vtas.filter(v => v.metodo_pago === "TARJETA").reduce((a, v) => a + Number(v.total), 0);
    const ventas_transferencia = vtas.filter(v => v.metodo_pago === "TRANSFERENCIA").reduce((a, v) => a + Number(v.total), 0);
    const ventas_total         = vtas.reduce((a, v) => a + Number(v.total), 0);

    res.json({
      fecha,
      transacciones_count: vtas.length,
      ventas_efectivo,
      ventas_tarjeta,
      ventas_transferencia,
      ventas_total,
      por_metodo: [
        { metodo: "EFECTIVO",      total: ventas_efectivo },
        { metodo: "TARJETA",       total: ventas_tarjeta },
        { metodo: "TRANSFERENCIA", total: ventas_transferencia },
      ].filter(m => m.total > 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /cafeteria/cuadre — historial de cuadres de cafetería
app.get("/cafeteria/cuadre", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cafeteria_cuadre")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(60);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /cafeteria/cuadre — guardar cuadre de cafetería
app.post("/cafeteria/cuadre", async (req, res) => {
  try {
    const {
      fecha, usuario,
      ventas_efectivo, ventas_tarjeta, ventas_transferencia, ventas_total,
      transacciones_count, efectivo_contado, diferencia, notas
    } = req.body;

    if (!fecha) return res.status(400).json({ error: "La fecha es requerida" });

    const { data, error } = await supabase
      .from("cafeteria_cuadre")
      .insert([{
        fecha,
        usuario:              usuario || "Sistema",
        ventas_efectivo:      Number(ventas_efectivo      || 0),
        ventas_tarjeta:       Number(ventas_tarjeta       || 0),
        ventas_transferencia: Number(ventas_transferencia || 0),
        ventas_total:         Number(ventas_total         || 0),
        transacciones_count:  Number(transacciones_count  || 0),
        efectivo_contado:     (efectivo_contado !== undefined && efectivo_contado !== null && efectivo_contado !== "")
                                ? Number(efectivo_contado) : null,
        diferencia:           Number(diferencia || 0),
        notas:                notas || null,
        creado_en:            new Date().toISOString()
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// 📋 CAFETERÍA — RECETAS (v7)
// =====================================================

// ── Ingredientes ─────────────────────────────────────

// GET /cafeteria/ingredientes
app.get("/cafeteria/ingredientes", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cafeteria_ingredientes")
      .select("*")
      .eq("activo", true)
      .order("nombre");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /cafeteria/ingredientes
app.post("/cafeteria/ingredientes", async (req, res) => {
  try {
    const { nombre, unidad, stock_actual, stock_minimo, costo_unitario, proveedor, notas } = req.body;
    const { data, error } = await supabase
      .from("cafeteria_ingredientes")
      .insert([{ nombre, unidad: unidad || "unidad", stock_actual: Number(stock_actual || 0),
                 stock_minimo: Number(stock_minimo || 0), costo_unitario: Number(costo_unitario || 0),
                 proveedor: proveedor || null, notas: notas || null }])
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /cafeteria/ingredientes/:id
app.put("/cafeteria/ingredientes/:id", async (req, res) => {
  try {
    const { nombre, unidad, stock_actual, stock_minimo, costo_unitario, proveedor, notas } = req.body;
    const { data, error } = await supabase
      .from("cafeteria_ingredientes")
      .update({ nombre, unidad, stock_actual: Number(stock_actual || 0),
                stock_minimo: Number(stock_minimo || 0), costo_unitario: Number(costo_unitario || 0),
                proveedor: proveedor || null, notas: notas || null,
                updated_at: new Date().toISOString() })
      .eq("id", parseInt(req.params.id))
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /cafeteria/ingredientes/:id  (soft delete)
app.delete("/cafeteria/ingredientes/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from("cafeteria_ingredientes")
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq("id", parseInt(req.params.id));
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Recetas ───────────────────────────────────────────

// GET /cafeteria/recetas  — trae recetas con sus ingredientes
app.get("/cafeteria/recetas", async (req, res) => {
  try {
    const { data: recetas, error } = await supabase
      .from("cafeteria_recetas")
      .select(`*, cafeteria_productos(id, nombre, precio),
               cafeteria_receta_ingredientes(id, cantidad, unidad, notas, orden,
                 cafeteria_ingredientes(id, nombre, unidad, costo_unitario))`)
      .eq("activo", true)
      .order("nombre");
    if (error) return res.status(500).json({ error: error.message });
    res.json(recetas);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /cafeteria/recetas  — crea receta + sus ingredientes
app.post("/cafeteria/recetas", async (req, res) => {
  try {
    const { nombre, descripcion, instrucciones, rendimiento, tiempo_prep_min,
            producto_id, ingredientes, created_by } = req.body;

    const { data: receta, error: rErr } = await supabase
      .from("cafeteria_recetas")
      .insert([{ nombre, descripcion: descripcion || null, instrucciones: instrucciones || null,
                 rendimiento: Number(rendimiento || 1), tiempo_prep_min: tiempo_prep_min ? Number(tiempo_prep_min) : null,
                 producto_id: producto_id ? Number(producto_id) : null,
                 created_by: created_by || "Sistema" }])
      .select().single();
    if (rErr) return res.status(500).json({ error: rErr.message });

    if (Array.isArray(ingredientes) && ingredientes.length > 0) {
      const rows = ingredientes.map((i, idx) => ({
        receta_id: receta.id, ingrediente_id: Number(i.ingrediente_id),
        cantidad: Number(i.cantidad), unidad: i.unidad || null,
        notas: i.notas || null, orden: idx
      }));
      const { error: iErr } = await supabase.from("cafeteria_receta_ingredientes").insert(rows);
      if (iErr) return res.status(500).json({ error: iErr.message });
    }
    res.json(receta);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /cafeteria/recetas/:id  — actualiza receta y reemplaza ingredientes
app.put("/cafeteria/recetas/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nombre, descripcion, instrucciones, rendimiento, tiempo_prep_min,
            producto_id, ingredientes } = req.body;

    const { error: rErr } = await supabase
      .from("cafeteria_recetas")
      .update({ nombre, descripcion: descripcion || null, instrucciones: instrucciones || null,
                rendimiento: Number(rendimiento || 1),
                tiempo_prep_min: tiempo_prep_min ? Number(tiempo_prep_min) : null,
                producto_id: producto_id ? Number(producto_id) : null,
                updated_at: new Date().toISOString() })
      .eq("id", id);
    if (rErr) return res.status(500).json({ error: rErr.message });

    // Reemplazar ingredientes
    await supabase.from("cafeteria_receta_ingredientes").delete().eq("receta_id", id);
    if (Array.isArray(ingredientes) && ingredientes.length > 0) {
      const rows = ingredientes.map((i, idx) => ({
        receta_id: id, ingrediente_id: Number(i.ingrediente_id),
        cantidad: Number(i.cantidad), unidad: i.unidad || null,
        notas: i.notas || null, orden: idx
      }));
      const { error: iErr } = await supabase.from("cafeteria_receta_ingredientes").insert(rows);
      if (iErr) return res.status(500).json({ error: iErr.message });
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /cafeteria/recetas/:id  (soft delete)
app.delete("/cafeteria/recetas/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from("cafeteria_recetas")
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq("id", parseInt(req.params.id));
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// =====================================================
// 🔬 DIAGNÓSTICOS
// =====================================================
app.get("/diagnosticos", async (req, res) => {
  try {
    let qDiag = supabase.from("diagnosticos").select("*").order("created_at", { ascending: false });
    if (req.query.orden_id) qDiag = qDiag.eq("orden_id", parseInt(req.query.orden_id, 10));
    const { data: dData, error: dError } = await qDiag;
    if (dError) return res.status(500).json({ error: dError.message });

    const [cRes2, vRes2] = await Promise.all([
      supabase.from("clientes").select("id, nombre").then(r => r).catch(() => ({ data: [] })),
      supabase.from("vehiculos").select("id, marca, modelo, placa").then(r => r).catch(() => ({ data: [] })),
    ]);
    const cData = cRes2.data || [];
    const vData = vRes2.data || [];
    const clienteMap = {};
    cData.forEach(c => { clienteMap[c.id] = c; });
    const vehiculoMap = {};
    vData.forEach(v => { vehiculoMap[v.id] = v; });

    const fixed = (dData || []).map(d => {
      const veh = vehiculoMap[d.vehiculo_id];
      // La tabla diagnosticos guarda costo_estimado como total; mano_obra/repuestos están en cotizaciones
      const totalCalc = Number(d.costo_estimado || 0);
      return {
        ...d,
        cliente_nombre: clienteMap[d.cliente_id]?.nombre || "Sin cliente",
        vehiculo_info:  veh ? `${veh.marca} ${veh.modelo} (${veh.placa})` : "Sin vehículo",
        tecnico_nombre: d.tecnico_nombre || d.usuario_nombre || "—",
        // Totales — mano_obra/repuestos individuales solo están en cotizaciones (join costoso aquí)
        mano_obra:  0,
        repuestos:  0,
        total:      totalCalc,
        // Aliases de compatibilidad: los nombres que usa el frontend
        descripcion: d.fallas_identificadas || d.tipo_servicio || "",
        hallazgos:   d.fallas_identificadas || "",
        notas:       d.observaciones || "",
      };
    });
    res.json(fixed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/diagnosticos/:id", async (req, res) => {
  const { id } = req.params;
  const { data: diag } = await supabase.from("diagnosticos").select("*").eq("id", id).single();
  if (!diag) return res.json({ error: "No encontrado" });

  const [
    { data: cotizacion },
    { data: avances },
    { data: cliente },
    { data: vehiculo },
  ] = await Promise.all([
    supabase.from("cotizaciones").select("*").eq("diagnostico_id", id).maybeSingle(),
    supabase.from("avances_reparacion").select("*").eq("diagnostico_id", id).order("created_at"),
    supabase.from("clientes").select("*").eq("id", diag.cliente_id).maybeSingle(),
    supabase.from("vehiculos").select("*").eq("id", diag.vehiculo_id).maybeSingle(),
  ]);

  // mano_obra y repuestos viven en cotizaciones, NO en la tabla diagnosticos
  const moTotal   = Number(cotizacion?.mano_obra  || 0);
  const repTotal  = Number(cotizacion?.repuestos  || 0);
  const totalCalc = Number(cotizacion?.total || 0) || (moTotal + repTotal) || Number(diag.costo_estimado || 0);

  const diagEnriquecido = {
    ...diag,
    tecnico_nombre:   diag.tecnico_nombre  || diag.usuario_nombre || "—",
    mano_obra:        moTotal,
    repuestos:        repTotal,
    total:            totalCalc,
    tiempo_estimado:  cotizacion?.tiempo_estimado || null,
    repuestos_items:  cotizacion?.items_detalle || [],
    // Aliases de compatibilidad con el frontend
    descripcion:      diag.fallas_identificadas || diag.tipo_servicio || "",
    hallazgos:        diag.fallas_identificadas || "",
    notas:            diag.observaciones || "",
  };
  res.json({ diag: diagEnriquecido, cotizacion, avances: avances || [], cliente, vehiculo });
});

app.post("/diagnosticos", async (req, res) => {
  // ⚠️  Extraer campos que NO son columnas de la tabla antes del INSERT
  // Columnas reales de diagnosticos: orden_id, cliente_id, vehiculo_id, tipo_servicio,
  //   inspeccion_mecanica, inspeccion_electrica, inspeccion_electronica, scanner_resultado,
  //   fallas_identificadas, observaciones, tecnico_nombre, estado, created_at,
  //   costo_estimado, mano_de_obra_detalle, repuestos_items
  const {
    repuestos_items,  // guardado en cotizaciones.items_detalle
    terminado,        // flag de control, no columna
    descripcion,      // → fallas_identificadas
    mano_obra,        // → costo_estimado + cotizaciones.mano_obra
    repuestos,        // → costo_estimado + cotizaciones.repuestos
    tiempo_estimado,  // → cotizaciones.tiempo_estimado (no existe en diagnosticos)
    notas,            // → observaciones
    total,            // → calculado
    usuario_id,       // no es columna — solo se usa para el log de auditoría
    usuario_nombre,   // → tecnico_nombre
    ...bodyDiag
  } = req.body;

  const cotManoObra  = Number(mano_obra  || 0);
  const cotRepuestos = Number(repuestos  || 0);
  const costoTotal   = (cotManoObra + cotRepuestos) || Number(bodyDiag.costo_estimado || 0);

  // Mapear usuario_nombre → tecnico_nombre; campos frontend → columnas reales de la BD
  const insertPayload = {
    ...bodyDiag,
    tecnico_nombre:       bodyDiag.tecnico_nombre || usuario_nombre || null,
    estado:               "PENDIENTE",
    created_at:           new Date(),
    fallas_identificadas: bodyDiag.fallas_identificadas || descripcion || null,
    observaciones:        bodyDiag.observaciones || notas || null,
    costo_estimado:       costoTotal,
  };

  const { data, error } = await supabase.from("diagnosticos")
    .insert([insertPayload])
    .select();
  if (error) {
    console.error("❌ POST /diagnosticos INSERT error:", error.message);
    return res.status(500).json({ error: error.message });
  }

  const diag = data[0];
  const ordenId = req.body.orden_id;

  // Guardar mano_obra, repuestos, items y tiempo en cotizaciones (tabla correcta para ese desglose)
  if (diag?.id) {
    const cotPayload = {
      diagnostico_id:      diag.id,
      items_detalle:       Array.isArray(repuestos_items) ? repuestos_items : [],
      mano_obra:           cotManoObra,
      repuestos:           cotRepuestos,
      total:               costoTotal,
      tiempo_estimado:     tiempo_estimado || null,
      mano_de_obra_detalle: bodyDiag.mano_de_obra_detalle || null,
    };
    const { data: cotExist } = await supabase.from("cotizaciones")
      .select("id").eq("diagnostico_id", diag.id).maybeSingle().then(r => r).catch(() => ({ data: null }));
    if (cotExist?.id) {
      await supabase.from("cotizaciones").update(cotPayload).eq("id", cotExist.id).then(r => r).catch(() => {});
    } else {
      await supabase.from("cotizaciones").insert([cotPayload]).then(r => r).catch(() => {});
    }
  }

  if (ordenId) {
    // Paso 1: RECIBIDO → DIAGNOSTICO (siempre al crear el diagnóstico)
    const r1 = await transicionarEstado(Number(ordenId), "DIAGNOSTICO", {
      usuarioId:     usuario_id    || null,
      usuarioNombre: usuario_nombre || "Técnico",
      motivo: "Técnico abrió diagnóstico",
    });
    if (!r1.ok) {
      // Silencioso: puede que ya esté en DIAGNOSTICO
      console.warn(`⚠️ Transición DIAGNOSTICO para orden ${ordenId}: ${r1.error}`);
    }

    // Paso 2: si el técnico cierra en el mismo POST (terminado=true) → ESPERANDO_APROBACION
    if (req.body.terminado === true) {
      const r2 = await transicionarEstado(Number(ordenId), "ESPERANDO_APROBACION", {
        usuarioId:     req.body.usuario_id    || null,
        usuarioNombre: req.body.usuario_nombre || "Técnico",
        motivo: "Técnico cerró el diagnóstico",
      });
      if (!r2.ok) console.warn(`⚠️ Transición ESPERANDO_APROBACION orden ${ordenId}: ${r2.error}`);
    }
  }

  // Devolver diagnóstico enriquecido con aliases para el frontend
  res.json({
    ...diag,
    repuestos_items:     Array.isArray(repuestos_items) ? repuestos_items : [],
    // Aliases de compatibilidad con el frontend
    descripcion:         diag.fallas_identificadas || diag.tipo_servicio || "",
    hallazgos:           diag.fallas_identificadas || "",
    notas:               diag.observaciones || "",
    mano_obra:           cotManoObra,
    repuestos:           cotRepuestos,
    total:               costoTotal,
    tiempo_estimado:     tiempo_estimado || null,
  });
});

app.patch("/diagnosticos/:id", async (req, res) => {
  const { id } = req.params;

  // ⚠️  Extraer campos que NO son columnas de la tabla antes del UPDATE
  const {
    repuestos_items,  // guardado en cotizaciones.items_detalle
    terminado,        // flag de control, no columna
    descripcion,      // → fallas_identificadas
    mano_obra,        // → costo_estimado + cotizaciones.mano_obra
    repuestos,        // → costo_estimado + cotizaciones.repuestos
    tiempo_estimado,  // → cotizaciones.tiempo_estimado
    notas,            // → observaciones
    total,            // → calculado
    usuario_id,       // no es columna
    usuario_nombre,   // → tecnico_nombre si no hay valor previo
    ...bodyDiag
  } = req.body;

  const cotManoObra  = Number(mano_obra  || 0);
  const cotRepuestos = Number(repuestos  || 0);

  // Construir payload con sólo columnas reales de la BD
  const updatePayload = { ...bodyDiag };
  if (descripcion !== undefined)   updatePayload.fallas_identificadas = bodyDiag.fallas_identificadas || descripcion;
  if (notas !== undefined)         updatePayload.observaciones        = bodyDiag.observaciones || notas;
  if (usuario_nombre !== undefined && !bodyDiag.tecnico_nombre) updatePayload.tecnico_nombre = usuario_nombre;
  if (mano_obra !== undefined || repuestos !== undefined) {
    const nuevoTotal = cotManoObra + cotRepuestos;
    if (nuevoTotal > 0) updatePayload.costo_estimado = nuevoTotal;
  }

  const { data, error } = await supabase.from("diagnosticos").update(updatePayload).eq("id", id).select();
  if (error) {
    console.error("❌ PATCH /diagnosticos/:id UPDATE error:", error.message);
    return res.status(500).json({ error: error.message });
  }

  const diag = data[0];

  // Actualizar cotizaciones cuando el técnico edita costos o repuestos
  const actualizarCot = repuestos_items !== undefined || mano_obra !== undefined
    || repuestos !== undefined || tiempo_estimado !== undefined
    || bodyDiag.mano_de_obra_detalle !== undefined;

  if (diag?.id && actualizarCot) {
    const costoEst = Number(diag.costo_estimado || 0);
    const cotPayload = {};
    if (Array.isArray(repuestos_items))        cotPayload.items_detalle       = repuestos_items;
    if (mano_obra  !== undefined)              cotPayload.mano_obra           = cotManoObra;
    if (repuestos  !== undefined)              cotPayload.repuestos           = cotRepuestos;
    if (mano_obra !== undefined || repuestos !== undefined)
                                               cotPayload.total               = cotManoObra + cotRepuestos || costoEst;
    if (tiempo_estimado !== undefined)         cotPayload.tiempo_estimado     = tiempo_estimado;
    if (bodyDiag.mano_de_obra_detalle !== undefined) cotPayload.mano_de_obra_detalle = bodyDiag.mano_de_obra_detalle;

    const { data: cotExist } = await supabase.from("cotizaciones")
      .select("id").eq("diagnostico_id", diag.id).maybeSingle().then(r => r).catch(() => ({ data: null }));
    if (cotExist?.id) {
      await supabase.from("cotizaciones").update(cotPayload).eq("id", cotExist.id).then(r => r).catch(() => {});
    } else {
      await supabase.from("cotizaciones")
        .insert([{ ...cotPayload, diagnostico_id: diag.id }]).then(r => r).catch(() => {});
    }
  }

  // ── Cuando el técnico cierra el diagnóstico → orden pasa a ESPERANDO_APROBACION ──
  if (req.body.estado === "TERMINADO" || req.body.terminado === true) {
    if (diag?.orden_id) {
      const r = await transicionarEstado(Number(diag.orden_id), "ESPERANDO_APROBACION", {
        usuarioId:     req.body.usuario_id     || null,
        usuarioNombre: req.body.usuario_nombre || "Técnico",
        motivo: "Técnico cerró el diagnóstico — esperando aprobación del cliente",
      });
      if (!r.ok) console.warn(`⚠️ Transición ESPERANDO_APROBACION orden ${diag.orden_id}: ${r.error}`);
    }
  }

  // 📚 Auto-crear historial + mantenimiento cuando el diagnóstico pasa a FACTURADO o COMPLETADO
  if (req.body.estado === "FACTURADO" || req.body.estado === "COMPLETADO") {
    crearHistorialDesdeDiagnostico(Number(id)).catch(err =>
      console.error("❌ Error creando historial automático:", err)
    );
    crearMantenimientoDesdeDiagnostico(Number(id)).catch(err =>
      console.error("❌ Error creando mantenimiento automático:", err)
    );
  }

  // Devolver con aliases de compatibilidad para el frontend
  res.json({
    ...diag,
    repuestos_items:  Array.isArray(repuestos_items) ? repuestos_items : [],
    descripcion:      diag.fallas_identificadas || diag.tipo_servicio || "",
    hallazgos:        diag.fallas_identificadas || "",
    notas:            diag.observaciones || "",
    mano_obra:        cotManoObra,
    repuestos:        cotRepuestos,
    total:            cotManoObra + cotRepuestos || Number(diag.costo_estimado || 0),
    tiempo_estimado:  tiempo_estimado || null,
  });
});

// =====================================================
// 💰 COTIZACIONES (internas de diagnóstico)
// =====================================================
app.post("/cotizaciones/diagnostico", async (req, res) => {
  const {
    diagnostico_id, mano_obra, repuestos, total, tiempo_estimado,
    mano_de_obra_detalle, notas, usuario_id, usuario_nombre,
    items_detalle,   // ← array de repuestos estructurados [{inventario_id, nombre, cantidad, precio_unitario, subtotal}]
  } = req.body;

  const totalCalculado = Number(mano_obra || 0) + Number(repuestos || 0);
  const itemsJSON = Array.isArray(items_detalle) ? items_detalle : [];

  const { data: exist } = await supabase.from("cotizaciones").select("id").eq("diagnostico_id", diagnostico_id).single();
  let result;
  if (exist) {
    const { data } = await supabase.from("cotizaciones")
      .update({ mano_obra, repuestos, total: totalCalculado, tiempo_estimado, notas, items_detalle: itemsJSON })
      .eq("diagnostico_id", diagnostico_id).select();
    result = data?.[0];
  } else {
    const { data } = await supabase.from("cotizaciones")
      .insert([{ diagnostico_id, mano_obra, repuestos, total: totalCalculado, tiempo_estimado, notas, items_detalle: itemsJSON }])
      .select();
    result = data?.[0];
  }

  await supabase
    .from("diagnosticos")
    .update({
      mano_de_obra_detalle: mano_de_obra_detalle || null,
      costo_estimado: totalCalculado,
      repuestos_items: itemsJSON,   // ← guardar también en el diagnóstico
    })
    .eq("id", diagnostico_id);

  await supabase.from("diagnosticos").update({ estado: "COTIZADO" }).eq("id", diagnostico_id);

  // Transicionar orden a ESPERANDO_APROBACION automáticamente al guardar cotización
  const { data: diag } = await supabase.from("diagnosticos").select("orden_id").eq("id", diagnostico_id).single();
  if (diag?.orden_id) {
    await transicionarEstado(Number(diag.orden_id), "ESPERANDO_APROBACION", {
      usuarioId: usuario_id || null,
      usuarioNombre: usuario_nombre || "Sistema",
      motivo: "Cotización guardada, esperando aprobación del cliente",
    }).catch(e => console.warn("⚠️ No se pudo transicionar a ESPERANDO_APROBACION:", e.message));
  }

  res.json(result);
});

// GET /cotizaciones/por-diagnostico/:diagnostico_id — obtener cotización por diagnóstico
// ⚠️ DEBE ir ANTES de /cotizaciones/:id para que Express no confunda "por-diagnostico" con un :id
app.get("/cotizaciones/por-diagnostico/:diagnostico_id", async (req, res) => {
  try {
    const { diagnostico_id } = req.params;
    const { data: cot, error } = await supabase.from("cotizaciones").select("*").eq("diagnostico_id", diagnostico_id).single();
    if (error || !cot) return res.json(null);
    res.json(cot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /cotizaciones/:id — obtener cotización completa con diagnóstico, inspección, cliente y vehículo
app.get("/cotizaciones/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: cot, error } = await supabase.from("cotizaciones").select("*").eq("id", id).single();
    if (error || !cot) return res.status(404).json({ error: "Cotización no encontrada" });

    // Cargar diagnóstico
    const { data: diag } = await supabase.from("diagnosticos").select("*").eq("id", cot.diagnostico_id).single();

    let cliente = null, vehiculo = null, inspeccion = null, orden = null;
    if (diag) {
      const [{ data: cli }, { data: veh }] = await Promise.all([
        supabase.from("clientes").select("*").eq("id", diag.cliente_id).single(),
        supabase.from("vehiculos").select("*").eq("id", diag.vehiculo_id).single(),
      ]);
      cliente  = cli;
      vehiculo = veh;

      if (diag.orden_id) {
        const [{ data: ins }, { data: ord }] = await Promise.all([
          supabase.from("inspeccion_vehiculo").select("*").eq("orden_id", diag.orden_id).single(),
          supabase.from("ordenes_trabajo").select("id, descripcion, motivo_entrada, numero_orden, created_at, prioridad").eq("id", diag.orden_id).maybeSingle(),
        ]);
        inspeccion = ins || null;
        orden      = ord || null;
      }
    }

    res.json({ cotizacion: cot, diagnostico: diag, cliente, vehiculo, inspeccion, orden });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/cotizaciones/:id/aprobar", async (req, res) => {
  const { id } = req.params;
  const { firma_cliente } = req.body;
  const { data } = await supabase.from("cotizaciones").update({ aprobado: true, aprobado_at: new Date(), firma_cliente }).eq("id", id).select();
  if (data?.[0]) {
    await supabase.from("diagnosticos").update({ estado: "APROBADO" }).eq("id", data[0].diagnostico_id);
  }
  res.json(data?.[0]);
});

// =====================================================
// ⚙️ AVANCES
// =====================================================
app.get("/avances/:orden_id", async (req, res) => {
  const ordenId = parseInt(req.params.orden_id, 10);
  if (isNaN(ordenId)) return res.json([]);
  // Buscar el diagnóstico de esta orden para obtener sus avances
  const { data: diag } = await supabase.from("diagnosticos")
    .select("id")
    .eq("orden_id", ordenId)
    .order("id", { ascending: false })
    .limit(1);
  if (!diag || diag.length === 0) return res.json([]);
  const { data, error } = await supabase.from("avances_reparacion")
    .select("*")
    .eq("diagnostico_id", diag[0].id)
    .order("created_at", { ascending: true });
  if (error) return res.json({ error: error.message });
  res.json(data || []);
});

app.post("/avances", async (req, res) => {
  const { diagnostico_id, orden_id, descripcion, tecnico_nombre, usuario_id } = req.body;

  // Resolver diagnostico_id desde orden_id si no viene directo
  let diagId = diagnostico_id;
  let ordenIdResuelto = orden_id;
  if (!diagId && orden_id) {
    const { data: diag } = await supabase.from("diagnosticos")
      .select("id, orden_id")
      .eq("orden_id", orden_id)
      .order("id", { ascending: false })
      .limit(1);
    if (diag && diag.length > 0) { diagId = diag[0].id; ordenIdResuelto = diag[0].orden_id; }
  }

  const { data, error } = await supabase.from("avances_reparacion")
    .insert([{ diagnostico_id: diagId, descripcion, tecnico_nombre, created_at: new Date() }])
    .select();
  if (error) return res.json({ error: error.message });

  if (diagId) {
    await supabase.from("diagnosticos").update({ estado: "EN_REPARACION" }).eq("id", diagId).then(r => r).catch(() => {});
  }

  // Auto-transicionar la orden a REPARACION solo si está en DIAGNOSTICO
  // (NO desde ESPERANDO_APROBACION — esa transición requiere aprobación explícita del cliente)
  const oid = ordenIdResuelto || (diagId ? (await supabase.from("diagnosticos").select("orden_id").eq("id", diagId).single()).data?.orden_id : null);
  if (oid) {
    const { data: ordenActualAvance } = await supabase.from("ordenes_trabajo").select("estado").eq("id", oid).maybeSingle();
    const estadoParaAvance = ordenActualAvance?.estado;
    if (estadoParaAvance === "DIAGNOSTICO") {
      const r = await transicionarEstado(Number(oid), "REPARACION", {
        usuarioId:     usuario_id    || null,
        usuarioNombre: tecnico_nombre || "Técnico",
        motivo: "Técnico inició reparación",
      });
      if (!r.ok) console.warn(`⚠️ Transición REPARACION orden ${oid}: ${r.error}`);
    }
    // Si está en REPARACION ya, no hacer nada (es el flujo normal de agregar avances)
    // Si está en ESPERANDO_APROBACION, tampoco — el cliente debe aprobar primero
  }

  res.json(data[0]);
});

// =====================================================
// 📊 DASHBOARD STATS
// =====================================================
app.get("/dashboard/stats", async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const { data: ordenes } = await supabase.from("ordenes_trabajo").select("estado, created_at");
    const { data: clientes } = await supabase.from("clientes").select("id");
    const { data: vehiculos } = await supabase.from("vehiculos").select("id");
    const { data: facturasHoy } = await supabase.from("facturas").select("total").gte("created_at", hoy.toISOString()).neq("estado", "CANCELADA");
    const { data: inventario } = await supabase.from("inventario").select("stock, min_stock, name");
    const { data: diagnosticos } = await supabase.from("diagnosticos").select("estado");

    const ingresoHoy = (facturasHoy || []).reduce((s, v) => s + Number(v.total), 0);
    const stockBajo = (inventario || []).filter(i => i.stock <= i.min_stock).length;

    res.json({
      ordenes: {
        total: ordenes?.length || 0,
        recibido: ordenes?.filter(o => o.estado === "RECIBIDO").length || 0,
        diagnostico: ordenes?.filter(o => o.estado === "DIAGNOSTICO").length || 0,
        reparacion: ordenes?.filter(o => o.estado === "REPARACION").length || 0,
        control_calidad: ordenes?.filter(o => o.estado === "CONTROL_CALIDAD").length || 0,
        listo: ordenes?.filter(o => o.estado === "LISTO").length || 0,
        entregado: ordenes?.filter(o => o.estado === "ENTREGADO").length || 0,
      },
      clientes: clientes?.length || 0,
      vehiculos: vehiculos?.length || 0,
      ingresoHoy,
      stockBajo,
      diagnosticos: {
        total: diagnosticos?.length || 0,
        pendientes: diagnosticos?.filter(d => d.estado === "PENDIENTE").length || 0,
        en_reparacion: diagnosticos?.filter(d => d.estado === "EN_REPARACION").length || 0,
      }
    });
  } catch (err) {
    res.json({ error: err });
  }
});

// GET /dashboard/kpis-gerente — KPIs avanzados para el rol gerente (C7)
app.get("/dashboard/kpis-gerente", async (req, res) => {
  try {
    const ahora = new Date();
    // Ventanas de tiempo
    const hace14 = new Date(ahora); hace14.setDate(hace14.getDate() - 13); hace14.setHours(0,0,0,0);
    const hace7  = new Date(ahora); hace7.setDate(hace7.getDate() - 6);   hace7.setHours(0,0,0,0);
    const hoy    = new Date(ahora); hoy.setHours(0,0,0,0);
    const inicioSemana = new Date(hoy); inicioSemana.setDate(hoy.getDate() - hoy.getDay());

    // Datos en paralelo
    const [
      { data: ordenes14 },
      { data: facturasHoy },
      { data: facturasSemana },
      { data: aprobaciones },
      { data: inventarioAll },
      { data: facturas7 },
    ] = await Promise.all([
      supabase.from("ordenes_trabajo")
        .select("id, estado, total, created_at")
        .gte("created_at", hace14.toISOString()),
      supabase.from("facturas")
        .select("total")
        .gte("created_at", hoy.toISOString())
        .neq("estado", "CANCELADA"),
      supabase.from("facturas")
        .select("total")
        .gte("created_at", inicioSemana.toISOString())
        .neq("estado", "CANCELADA"),
      supabase.from("ordenes_trabajo")
        .select("id, estado, created_at")
        .in("estado", ["LISTO","ENTREGADO","CANCELADA"])
        .gte("created_at", hace14.toISOString()),
      supabase.from("inventario")
        .select("id, name, stock, min_stock")
        .order("name"),
      supabase.from("facturas")
        .select("total, created_at")
        .gte("created_at", hace7.toISOString())
        .neq("estado", "CANCELADA")
        .order("created_at", { ascending: false }),
    ]);

    // Filtrar stock bajo en JS (comparación de columnas no soportada en Supabase JS client)
    const inventarioBajo = (inventarioAll || []).filter(i => Number(i.stock || 0) <= Number(i.min_stock || 0));

    // ── Volumen diario últimos 14 días ──────────────────────────────────────
    const diasMap = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(hace14); d.setDate(d.getDate() + i);
      diasMap[d.toISOString().slice(0,10)] = 0;
    }
    for (const o of (ordenes14 || [])) {
      const dia = o.created_at?.slice(0,10);
      if (dia && diasMap[dia] !== undefined) diasMap[dia]++;
    }
    const volumenDiario = Object.entries(diasMap).map(([fecha, total]) => ({ fecha, total }));

    // ── Ingresos por día (facturación) últimos 7 días ─────────────────────
    const ingresosMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(hace7); d.setDate(d.getDate() + i);
      ingresosMap[d.toISOString().slice(0,10)] = 0;
    }
    for (const f of (facturas7 || [])) {
      const dia = f.created_at?.slice(0,10);
      if (dia && ingresosMap[dia] !== undefined) ingresosMap[dia] += Number(f.total) || 0;
    }
    const ingresosDiarios = Object.entries(ingresosMap).map(([fecha, total]) => ({ fecha, total }));

    // ── KPIs calculados ───────────────────────────────────────────────────
    const ingresoHoy    = (facturasHoy    || []).reduce((s, v) => s + Number(v.total), 0);
    const ingresoSemana = (facturasSemana || []).reduce((s, v) => s + Number(v.total), 0);
    // Ticket promedio desde facturas (más preciso que ordenes_trabajo.total)
    const facturasConTotal = (facturas7 || []).filter(f => Number(f.total) > 0);
    const ticketPromedio  = facturasConTotal.length > 0
      ? facturasConTotal.reduce((s, f) => s + Number(f.total), 0) / facturasConTotal.length
      : 0;
    const completadas   = (aprobaciones || []).filter(o => ["LISTO","ENTREGADO"].includes(o.estado)).length;
    const canceladas    = (aprobaciones || []).filter(o => o.estado === "CANCELADA").length;
    const tasaAprob     = completadas + canceladas > 0
      ? Math.round((completadas / (completadas + canceladas)) * 100)
      : null;

    res.json({
      ingresoHoy,
      ingresoSemana,
      ticketPromedio,
      tasaAprobacion: tasaAprob,
      ordenes14dias: ordenes14?.length || 0,
      volumenDiario,
      ingresosDiarios,
      stockBajoItems: (inventarioBajo || []).slice(0, 5).map(i => ({
        nombre: i.name, stock: i.stock, min: i.min_stock,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// 👤 USUARIOS Y AUTENTICACIÓN
// =====================================================
app.get("/usuarios", async (req, res) => {
  const { data } = await supabase
    .from("usuarios")
    .select("id, nombre, email, rol, activo, created_at")
    .order("id");
  res.json(data || []);
});

app.post("/usuarios", async (req, res) => {
  const { nombre, email, password_hash, rol } = req.body;
  if (!nombre || !email || !password_hash || !rol)
    return res.json({ error: "Todos los campos son requeridos" });
  const { data, error } = await supabase
    .from("usuarios")
    .insert([{ nombre, email, password_hash, rol, activo: true }])
    .select("id, nombre, email, rol, activo");
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.patch("/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from("usuarios")
    .update(req.body)
    .eq("id", id)
    .select("id, nombre, email, rol, activo");
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.delete("/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("usuarios").delete().eq("id", id);
  if (error) return res.json({ error: error.message });
  res.json({ ok: true });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.json({ error: "Email y contraseña requeridos" });

  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("email", email)
    .eq("password_hash", password)
    .single();

  if (error || !data) return res.json({ error: "Credenciales incorrectas" });

  // Actualizar último acceso (sin bloquear si falla)
  supabase.from("usuarios")
    .update({ ultimo_acceso: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {}).catch(() => {});

  const { password_hash, ...usuario } = data;
  res.json({ ok: true, usuario });
});

// =====================================================
// 🧾 NCF
// =====================================================
app.get("/ncf/siguiente", async (req, res) => {
  const { tipo } = req.query;
  const { data } = await supabase
    .from("ncf_config")
    .select("*")
    .eq("tipo", tipo || "B02")
    .single();
  if (!data) return res.json({ ncf: (tipo || "B02") + "00000001" });
  const nuevo = data.secuencia_actual + 1;
  await supabase.from("ncf_config").update({ secuencia_actual: nuevo }).eq("tipo", tipo || "B02");
  res.json({ ncf: data.prefijo + String(nuevo).padStart(8, "0") });
});

// =====================================================
// 🧾 FACTURACIÓN — consulta RNC
// =====================================================
app.get("/facturacion/rnc/:rnc", async (req, res) => {
  const { rnc } = req.params;
  const { data } = await supabase.from("clientes").select("*").eq("rnc", rnc).single();
  if (!data) return res.json({ error: true, mensaje: "RNC no encontrado" });
  res.json({ nombre: data.nombre, rnc: data.rnc, direccion: data.direccion || "" });
});

// =====================================================
// 🧾 FACTURAS
// =====================================================
app.get("/facturas", async (req, res) => {
  const { data, error } = await supabase
    .from("facturas")
    .select("*")
    .order("id", { ascending: false });
  if (error) return res.json({ error: error.message });
  res.json(data || []);
});

app.post("/facturas", async (req, res) => {
  const {
    items,
    metodo_pago,
    ncf_tipo,
    cliente_id,
    cliente_nombre,
    cliente_rnc,
    vehiculo_id,
    vehiculo_info,
    diagnostico_id,
    notas
  } = req.body;

  if (!items || items.length === 0)
    return res.json({ error: "Sin items en la factura" });

  try {
    let subtotal = 0;
    let itbis = 0;
    for (const item of items) {
      const linea = Number(item.precio_unitario) * Number(item.cantidad);
      subtotal += linea;
      if (item.itbis_aplica) itbis += linea * 0.18;
    }
    const total = subtotal + itbis;

    const tipo = ncf_tipo || "B02";
    const { data: ncfData } = await supabase.from("ncf_config").select("*").eq("tipo", tipo).single();

    let ncf;
    const fechaVence = new Date();
    fechaVence.setFullYear(fechaVence.getFullYear() + 2);

    if (ncfData) {
      const nuevo = (ncfData.secuencia_actual || 0) + 1;
      await supabase.from("ncf_config").update({ secuencia_actual: nuevo }).eq("tipo", tipo);
      ncf = (ncfData.prefijo || tipo) + String(nuevo).padStart(8, "0");
    } else {
      ncf = tipo + Math.floor(Math.random() * 99999999).toString().padStart(8, "0");
    }

    // Resolver orden_id y cotizacion_id desde diagnostico_id
    let orden_id_resuelto = null;
    let cotizacion_id_resuelta = null;
    if (diagnostico_id) {
      const { data: diagRow } = await supabase.from("diagnosticos").select("orden_id").eq("id", diagnostico_id).maybeSingle();
      orden_id_resuelto = diagRow?.orden_id || null;
      const { data: cotRow } = await supabase.from("cotizaciones").select("id").eq("diagnostico_id", diagnostico_id).order("id", { ascending: false }).limit(1).maybeSingle();
      cotizacion_id_resuelta = cotRow?.id || null;
    }

    const { data: factura, error: errFac } = await supabase
      .from("facturas")
      .insert([{
        ncf,
        ncf_tipo: tipo,
        ncf_vence: fechaVence.toISOString().split("T")[0],
        estado: "ACTIVA",
        cliente_id: cliente_id || null,
        cliente_nombre: cliente_nombre || "Consumidor Final",
        cliente_rnc: cliente_rnc || null,
        vehiculo_id: vehiculo_id || null,
        vehiculo_info: vehiculo_info || null,
        diagnostico_id: diagnostico_id || null,
        orden_id: orden_id_resuelto,
        cotizacion_id: cotizacion_id_resuelta,
        subtotal,
        itbis,
        total,
        metodo_pago: metodo_pago || "EFECTIVO",
        notas: notas || null,
        created_at: new Date()
      }])
      .select();

    if (errFac) return res.json({ error: errFac.message });
    const facturaId = factura[0].id;

    for (const item of items) {
      const subtotalItem = Number(item.precio_unitario) * Number(item.cantidad);
      await supabase.from("factura_items").insert([{
        factura_id: facturaId,
        tipo: item.tipo || "repuesto",
        descripcion: item.descripcion,
        cantidad: Number(item.cantidad),
        precio_unitario: Number(item.precio_unitario),
        itbis_aplica: item.itbis_aplica || false,
        subtotal: subtotalItem,
        inventario_id: item.inventario_id || null
      }]);

      if (item.tipo === "repuesto" && item.inventario_id) {
        const { data: prod } = await supabase
          .from("inventario").select("stock").eq("id", item.inventario_id).single();
        if (prod) {
          await supabase.from("inventario")
            .update({ stock: prod.stock - Number(item.cantidad) })
            .eq("id", item.inventario_id);
          await supabase.from("inventario_movimientos").insert([{
            part_id: item.inventario_id,
            tipo: "SALIDA",
            cantidad: Number(item.cantidad),
            descripcion: `Factura ${ncf}`,
            created_at: new Date()
          }]);
        }
      }
    }

    if (diagnostico_id) {
      await supabase.from("diagnosticos").update({ estado: "FACTURADO" }).eq("id", diagnostico_id);
    }

    // Si el método de pago es CRÉDITO, crear cuenta por cobrar (no registrar en caja todavía)
    if ((metodo_pago || "EFECTIVO").toUpperCase() === "CREDITO") {
      const diasCredito = req.body.dias_credito || 30;
      const fechaVence  = new Date();
      fechaVence.setDate(fechaVence.getDate() + Number(diasCredito));
      await supabase.from("cuentas_cobrar").insert([{
        cliente_id:        cliente_id || null,
        factura_id:        facturaId,
        descripcion:       `Factura ${ncf} — ${cliente_nombre || "Consumidor Final"}`,
        monto_original:    total,
        monto_pagado:      0,
        fecha_emision:     new Date().toISOString().slice(0, 10),
        fecha_vencimiento: fechaVence.toISOString().slice(0, 10),
        estado:            "PENDIENTE",
        created_by:        "Sistema (Factura)",
      }]);
    } else {
      // Solo registrar en caja si el pago es inmediato
      await supabase.from("caja_movimientos").insert([{
        tipo: "INGRESO",
        concepto: `Factura ${ncf} — ${cliente_nombre || "Consumidor Final"}`,
        monto: total,
        metodo_pago: metodo_pago || "EFECTIVO",
        factura_id: facturaId,
        created_at: new Date()
      }]);
    }

    res.json(factura[0]);
  } catch (err) {
    console.error("Error creando factura:", err);
    res.json({ error: err.message || "Error interno" });
  }
});

app.get("/facturas/:id/items", async (req, res) => {
  const { id } = req.params;
  const { data: factura } = await supabase.from("facturas").select("*").eq("id", id).single();
  if (!factura) return res.json({ error: "Factura no encontrada" });
  const { data: items } = await supabase.from("factura_items").select("*").eq("factura_id", id);
  res.json({ factura, items: items || [] });
});

app.patch("/facturas/:id", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from("facturas").update(req.body).eq("id", id).select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.delete("/facturas/:id", async (req, res) => {
  const { id } = req.params;
  await supabase.from("factura_items").delete().eq("factura_id", id);
  const { error } = await supabase.from("facturas").delete().eq("id", id);
  if (error) return res.json({ error: error.message });
  res.json({ ok: true });
});

// =====================================================
// 🧮 CONTABILIDAD — CUADRE DE CAJA
// =====================================================

// GET /contabilidad/cuadre — historial de cuadres ordenado por fecha desc
app.get("/api/contabilidad/cuadre", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cuadre_caja")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(60);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /contabilidad/cuadre — guardar un nuevo cuadre de caja
app.post("/api/contabilidad/cuadre", async (req, res) => {
  try {
    const {
      fecha, efectivo_inicial, efectivo_final,
      ventas_efectivo, ventas_tarjeta, ventas_transferencia,
      ventas_cheque, ventas_credito,
      facturas_count, tipo, efectivo_contado, notas,
      gastos, diferencia, usuario
    } = req.body;

    if (!fecha) return res.status(400).json({ error: "La fecha es requerida" });

    const basePayload = {
      fecha,
      efectivo_inicial:     Number(efectivo_inicial     || 0),
      efectivo_final:       Number(efectivo_final       || 0),
      ventas_efectivo:      Number(ventas_efectivo      || 0),
      ventas_tarjeta:       Number(ventas_tarjeta       || 0),
      ventas_transferencia: Number(ventas_transferencia || 0),
      gastos:               Number(gastos               || 0),
      diferencia:           Number(diferencia           || 0),
      usuario:              usuario || "Sistema",
      creado_en:            new Date().toISOString()
    };

    // Campos extendidos (requieren migración v5)
    const extendedPayload = {
      ...basePayload,
      ventas_cheque:    Number(ventas_cheque  || 0),
      ventas_credito:   Number(ventas_credito || 0),
      facturas_count:   Number(facturas_count || 0),
      tipo:             tipo || "AUTO",
      efectivo_contado: (efectivo_contado !== undefined && efectivo_contado !== null && efectivo_contado !== "")
                          ? Number(efectivo_contado) : null,
      notas:            notas || null,
    };

    // Intentar con campos extendidos; si falla (migración no corrida), usar base
    let { data, error } = await supabase
      .from("cuadre_caja").insert([extendedPayload]).select().single();

    if (error) {
      const fallback = await supabase
        .from("cuadre_caja").insert([basePayload]).select().single();
      if (fallback.error) return res.status(500).json({ error: fallback.error.message });
      return res.json(fallback.data);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /contabilidad/cuadre/:id — eliminar un cuadre
app.delete("/api/contabilidad/cuadre/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("cuadre_caja").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// 🧮 CONTABILIDAD — CAJA CHICA
// =====================================================

// GET /contabilidad/caja-chica — lista de movimientos + saldo actual
app.get("/api/contabilidad/caja-chica", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("caja_chica")
      .select("*")
      .order("fecha", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const movimientos = data || [];

    // Calcular saldo actual: suma ingresos - suma egresos
    const fondo_actual = movimientos.reduce((acc, m) => {
      return m.tipo === "INGRESO"
        ? acc + Number(m.monto)
        : acc - Number(m.monto);
    }, 0);

    res.json({ movimientos, fondo_actual });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /contabilidad/caja-chica — registrar ingreso o egreso
app.post("/api/contabilidad/caja-chica", async (req, res) => {
  try {
    const { descripcion, monto, tipo, usuario } = req.body;

    if (!descripcion || !monto || !tipo)
      return res.status(400).json({ error: "Descripción, monto y tipo son requeridos" });

    if (!["INGRESO", "EGRESO"].includes(tipo))
      return res.status(400).json({ error: "Tipo debe ser INGRESO o EGRESO" });

    // Validar fondos suficientes si es egreso
    if (tipo === "EGRESO") {
      const { data: movs } = await supabase.from("caja_chica").select("monto, tipo");
      const saldo = (movs || []).reduce((acc, m) =>
        m.tipo === "INGRESO" ? acc + Number(m.monto) : acc - Number(m.monto), 0
      );
      if (Number(monto) > saldo) {
        return res.status(400).json({ error: `Fondos insuficientes. Saldo actual: RD$ ${saldo.toFixed(2)}` });
      }
    }

    const { data, error } = await supabase
      .from("caja_chica")
      .insert([{
        descripcion,
        monto:   Number(monto),
        tipo,
        usuario: usuario || "Sistema",
        fecha:   new Date().toISOString()
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /contabilidad/caja-chica/:id — eliminar movimiento
app.delete("/api/contabilidad/caja-chica/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("caja_chica").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// 📊 CONTABILIDAD — COSTOS Y UTILIDADES
// =====================================================

// GET /contabilidad/costos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// Reporte financiero del período consultando facturas reales
app.get("/api/contabilidad/costos", async (req, res) => {
  try {
    const hoy  = new Date().toISOString().slice(0, 10);
    const ini  = new Date(); ini.setDate(1);
    const desde = req.query.desde || ini.toISOString().slice(0, 10);
    const hasta = req.query.hasta || hoy;

    // Facturas activas del período
    const { data: facturas, error: errF } = await supabase
      .from("facturas")
      .select("*")
      .neq("estado", "CANCELADA")
      .gte("created_at", `${desde}T00:00:00`)
      .lte("created_at", `${hasta}T23:59:59`);

    if (errF) return res.status(500).json({ error: errF.message });

    const facs = facturas || [];

    // Totales generales
    const ingresos_totales = facs.reduce((a, f) => a + Number(f.total    || 0), 0);
    const itbis_total      = facs.reduce((a, f) => a + Number(f.itbis    || 0), 0);
    const subtotal_total   = facs.reduce((a, f) => a + Number(f.subtotal || 0), 0);

    // Por método de pago
    const metodoMap = {};
    facs.forEach(f => {
      const m = f.metodo_pago || "EFECTIVO";
      metodoMap[m] = (metodoMap[m] || 0) + Number(f.total || 0);
    });
    const por_metodo = Object.entries(metodoMap).map(([metodo, total]) => ({ metodo, total }));

    // Por tipo NCF
    const ncfMap = {};
    facs.forEach(f => {
      const t = f.ncf_tipo || "B02";
      ncfMap[t] = (ncfMap[t] || 0) + Number(f.total || 0);
    });
    const por_ncf = Object.entries(ncfMap).map(([tipo, total]) => ({ tipo, total }));

    // Costo de repuestos desde compras en el período
    const { data: compras } = await supabase
      .from("compras_inventario")
      .select("total")
      .neq("estado", "CANCELADA")
      .gte("created_at", `${desde}T00:00:00`)
      .lte("created_at", `${hasta}T23:59:59`);

    const costo_repuestos = (compras || []).reduce((a, c) => a + Number(c.total || 0), 0);

    // Gastos de caja chica en el período
    const { data: gastosCC } = await supabase
      .from("caja_chica")
      .select("monto, tipo")
      .gte("fecha", `${desde}T00:00:00`)
      .lte("fecha", `${hasta}T23:59:59`);

    const gastos_caja_chica = (gastosCC || [])
      .filter(g => g.tipo === "EGRESO")
      .reduce((a, g) => a + Number(g.monto || 0), 0);

    // Utilidades
    const utilidad_bruta  = subtotal_total - costo_repuestos;
    const utilidad_neta   = utilidad_bruta - gastos_caja_chica;

    res.json({
      periodo:            { desde, hasta },
      facturas_count:     facs.length,
      ingresos_totales,
      itbis_total,
      subtotal_total,
      costo_repuestos,
      gastos_caja_chica,
      utilidad_bruta,
      utilidad_neta,
      ticket_promedio:    facs.length ? ingresos_totales / facs.length : 0,
      por_metodo,
      por_ncf,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// 🧾 COMPRAS DE INVENTARIO (ya existentes, expuestas aquí)
// =====================================================
app.get("/compras", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("compras_inventario")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// 📚 HISTORIAL DE VEHÍCULOS
// =====================================================

// Helper interno: captura y persiste el historial COMPLETO desde un diagnóstico
// Guarda un snapshot independiente de toda la información de la orden al momento de entrega
async function crearHistorialDesdeDiagnostico(diagnosticoId) {
  try {
    const { data: diag, error: diagErr } = await supabase
      .from("diagnosticos").select("*").eq("id", diagnosticoId).maybeSingle();
    if (diagErr) { console.error(`❌ crearHistorial: error leyendo diagnóstico #${diagnosticoId}:`, diagErr.message); return; }
    if (!diag)   { console.warn(`⚠️ crearHistorial: diagnóstico #${diagnosticoId} no encontrado`); return; }

    // Verificar duplicado
    const { data: existe } = await supabase
      .from("vehiculo_historial").select("id").eq("diagnostico_id", diagnosticoId).maybeSingle();
    if (existe) {
      console.log(`ℹ️ Historial ya existe para diagnóstico #${diagnosticoId}, omitiendo.`);
      return;
    }

    // Obtener orden completa
    const { data: orden } = await supabase
      .from("ordenes_trabajo")
      .select("*")
      .eq("id", diag.orden_id)
      .maybeSingle();

    const vehiculoId = diag.vehiculo_id || orden?.vehiculo_id || null;
    const clienteId  = diag.cliente_id  || orden?.cliente_id  || null;

    // Queries con fallback seguro — una falla no rompe el resto
    const safe = async (fn) => { try { const r = await fn(); return r.data || null; } catch { return null; } };

    const [vehiculo, cliente, cotizacion, avances, factura, timeline, tecUsuario, inspeccion] = await Promise.all([
      safe(() => supabase.from("vehiculos").select("*").eq("id", vehiculoId).maybeSingle()),
      safe(() => supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle()),
      safe(() => supabase.from("cotizaciones").select("*").eq("diagnostico_id", diagnosticoId).maybeSingle()),
      safe(() => supabase.from("avances_reparacion").select("*").eq("diagnostico_id", diagnosticoId).order("created_at")),
      safe(() => supabase.from("facturas").select("*").eq("orden_id", diag.orden_id).order("id", { ascending: false }).limit(1).maybeSingle()),
      safe(() => supabase.from("orden_trabajo_log").select("*").eq("orden_id", diag.orden_id).order("created_at")),
      safe(() => orden?.tecnico_asignado_id
        ? supabase.from("usuarios").select("nombre").eq("id", orden.tecnico_asignado_id).maybeSingle()
        : Promise.resolve({ data: null })
      ),
      safe(() => supabase.from("inspeccion_vehiculo").select("*").eq("orden_id", diag.orden_id).order("created_at", { ascending: false }).limit(1).maybeSingle()),
    ]);

    // Items de factura (query separada)
    const facturaItems = factura?.id
      ? await safe(() => supabase.from("factura_items").select("*").eq("factura_id", factura.id).order("id"))
      : null;

    const avancesArr  = Array.isArray(avances)      ? avances      : [];
    const timelineArr = Array.isArray(timeline)      ? timeline     : [];
    const itemsArr    = Array.isArray(facturaItems)  ? facturaItems : [];

    const tecnicoNombre =
      diag.tecnico_nombre || diag.usuario_nombre || orden?.tecnico_qc || tecUsuario?.nombre || "Sin asignar";

    // ── Parsear trabajos_realizados_items (puede ser string JSON o array) ──
    let trabajosItemsParsed = diag.trabajos_realizados_items;
    if (typeof trabajosItemsParsed === "string") {
      try { trabajosItemsParsed = JSON.parse(trabajosItemsParsed); } catch { trabajosItemsParsed = []; }
    }
    if (!Array.isArray(trabajosItemsParsed)) trabajosItemsParsed = [];

    // ── Texto de trabajos realizados (campo legacy de texto) ──
    let trabajos = null;
    if (avancesArr.length > 0) {
      trabajos = avancesArr
        .map(a => `[${new Date(a.created_at).toLocaleDateString("es-DO")}] ${a.tecnico_nombre || tecnicoNombre}: ${a.descripcion}`)
        .join("\n");
    } else if (trabajosItemsParsed.length > 0) {
      trabajos = trabajosItemsParsed
        .map(t => `• [${t.tipo || "Trabajo"}] ${t.descripcion || t.trabajo || JSON.stringify(t)}`)
        .join("\n");
    } else {
      trabajos = cotizacion?.mano_de_obra_detalle || diag.mano_de_obra_detalle || null;
    }
    if (orden?.notas_entrega) {
      trabajos = trabajos
        ? `${trabajos}\n\n📋 Notas de entrega: ${orden.notas_entrega}`
        : `📋 Notas de entrega: ${orden.notas_entrega}`;
    }

    // ── Costos ──
    const costoManoObra  = Number(cotizacion?.mano_obra  || 0);
    const costoRepuestos = Number(cotizacion?.repuestos   || 0);
    const costoTotal     = Number(
      cotizacion?.total                ||
      (costoManoObra + costoRepuestos) ||
      diag.costo_estimado              ||
      factura?.total                   ||
      0
    );

    // ── Fecha real de entrega ──
    const fechaServicio = orden?.fecha_entrega
      ? new Date(orden.fecha_entrega).toISOString()
      : new Date().toISOString();

    const diagGeneral = diag.fallas_identificadas || diag.tipo_servicio || "";

    // ── Snapshot de cotización (con sus items JSONB incluidos) ──
    const manoObraDetalle = cotizacion?.mano_de_obra_detalle || diag.mano_de_obra_detalle || null;
    const cotizacionData = cotizacion ? {
      id:                       cotizacion.id,
      numero:                   cotizacion.numero,
      mano_obra:                cotizacion.mano_obra,
      repuestos:                cotizacion.repuestos,
      subtotal:                 cotizacion.subtotal,
      itbis:                    cotizacion.itbis,
      total:                    cotizacion.total,
      tiempo_estimado:          cotizacion.tiempo_estimado,
      notas:                    cotizacion.notas,
      aprobado:                 cotizacion.aprobado,
      aprobado_at:              cotizacion.aprobado_at,
      items:                    cotizacion.items      || [],
      items_detalle:            cotizacion.items_detalle || [],
      // Detalles de mano de obra y trabajos (para historial completo)
      mano_de_obra_detalle:     manoObraDetalle,
      trabajos_realizados_items: trabajosItemsParsed,
    } : {
      // Sin cotizacion: guardar igualmente para que el historial los muestre
      mano_de_obra_detalle:     manoObraDetalle,
      trabajos_realizados_items: trabajosItemsParsed,
    };

    // ── Snapshot de factura (con items de factura_items) ──
    const facturaData = factura ? {
      id:           factura.id,
      ncf:          factura.ncf,
      ncf_tipo:     factura.ncf_tipo,
      estado:       factura.estado,
      subtotal:     factura.subtotal,
      itbis:        factura.itbis,
      total:        factura.total,
      metodo_pago:  factura.metodo_pago,
      created_at:   factura.created_at,
      items:        itemsArr.map(fi => ({
        descripcion:    fi.descripcion,
        tipo:           fi.tipo,
        cantidad:       fi.cantidad,
        precio_unitario: fi.precio_unitario,
        itbis_aplica:   fi.itbis_aplica,
        subtotal:       fi.subtotal,
      })),
    } : {};

    // ── Snapshot de avances ──
    const avancesData = avancesArr.map(a => ({
      descripcion:   a.descripcion,
      tecnico_nombre: a.tecnico_nombre,
      created_at:    a.created_at,
    }));

    // ── Snapshot de línea de tiempo (orden_trabajo_log) ──
    const timelineData = timelineArr.map(t => ({
      estado_anterior: t.estado_anterior,
      estado_nuevo:    t.estado_nuevo,
      usuario_nombre:  t.usuario_nombre,
      motivo:          t.motivo,
      created_at:      t.created_at,
    }));

    // ── Snapshot de fechas del proceso ──
    const fechasProceso = {
      recibido:               orden?.created_at                  || null,
      diagnostico:            orden?.fecha_diagnostico           || null,
      esperando_aprobacion:   orden?.fecha_esperando_aprobacion  || null,
      aprobacion:             orden?.fecha_aprobacion            || null,
      inicio_reparacion:      orden?.fecha_inicio_reparacion     || null,
      control_calidad:        orden?.fecha_control_calidad       || null,
      listo:                  orden?.fecha_listo                 || null,
      entrega:                orden?.fecha_entrega               || null,
    };

    // ── Snapshot de inspección vehicular de recepción ──
    const inspeccionData = inspeccion ? {
      id:                  inspeccion.id,
      fecha_recepcion:     inspeccion.fecha_recepcion,
      km_entrada:          inspeccion.km_entrada,
      nivel_combustible:   inspeccion.nivel_combustible,
      condicion_general:   inspeccion.condicion_general,
      zonas_danio:         inspeccion.zonas_danio         || [],
      rayones:             inspeccion.rayones,
      golpes:              inspeccion.golpes,
      estado_vidrios:      inspeccion.estado_vidrios,
      estado_llantas:      inspeccion.estado_llantas,
      estado_pintura:      inspeccion.estado_pintura,
      // Checklist de accesorios
      radio_pantalla:      inspeccion.radio_pantalla,
      tapiceria_ok:        inspeccion.tapiceria_ok,
      alfombras_ok:        inspeccion.alfombras_ok,
      luces_ok:            inspeccion.luces_ok,
      bocina_ok:           inspeccion.bocina_ok,
      espejos_ok:          inspeccion.espejos_ok,
      gato_ok:             inspeccion.gato_ok,
      llanta_repuesto_ok:  inspeccion.llanta_repuesto_ok,
      documentos_ok:       inspeccion.documentos_ok,
      herramientas_ok:     inspeccion.herramientas_ok,
      otros_accesorios:    inspeccion.otros_accesorios,
      // Fotos y firma
      fotos:               inspeccion.fotos              || [],
      fotos_slots:         inspeccion.fotos_slots        || {},
      firma_cliente:       inspeccion.firma_cliente,
      // Observaciones y auditoría
      observaciones:       inspeccion.observaciones,
      creado_por_nombre:   inspeccion.creado_por_nombre,
    } : {};

    // ── PAYLOAD COMPLETO ──────────────────────────────────────────
    const payload = {
      // Datos del vehículo
      vehiculo_id:            vehiculoId,
      placa:                  (vehiculo?.placa || "N/A").toUpperCase().trim(),
      marca:                  vehiculo?.marca  || "",
      modelo:                 vehiculo?.modelo || "",
      ano:                    vehiculo?.ano    || null,
      color:                  vehiculo?.color  || "",
      // Datos del cliente
      cliente_id:             clienteId,
      cliente_nombre:         cliente?.nombre   || "Particular",
      cliente_telefono:       cliente?.telefono || "",
      // Referencia al diagnóstico
      diagnostico_id:         diagnosticoId,
      // Datos del servicio
      fecha_servicio:         fechaServicio,
      tipo_servicio:          diag.tipo_servicio || diagGeneral,
      diagnostico_general:    diagGeneral,
      // Inspecciones del diagnóstico
      inspeccion_mecanica:    diag.inspeccion_mecanica    || null,
      inspeccion_electrica:   diag.inspeccion_electrica   || null,
      inspeccion_electronica: diag.inspeccion_electronica || null,
      codigos_falla:          diag.scanner_resultado      || null,
      fallas_identificadas:   diag.fallas_identificadas   || null,
      observaciones:          diag.observaciones          || null,
      // Trabajos (texto resumen legacy)
      trabajos_realizados:    trabajos,
      // Costos
      costo_mano_obra:        costoManoObra,
      costo_repuestos:        costoRepuestos,
      costo_total:            costoTotal,
      // Estado y técnico
      estado:                 "ENTREGADO",
      tecnico_nombre:         tecnicoNombre,
      ncf:                    factura?.ncf || null,
      // Datos adicionales de la orden
      numero_orden:           orden?.numero_orden   || null,
      descripcion:            orden?.descripcion    || null,
      motivo_entrada:         orden?.motivo_entrada || null,
      notas_entrega:          orden?.notas_entrega  || null,
      usuario_entrego:        orden?.usuario_entrego || null,
      firma_entrega:          orden?.firma_entrega   || null,
      fecha_entrega:          orden?.fecha_entrega   || null,
      // Mano de obra y trabajos (accesibles desde el snapshot sin llamar al detalle)
      mano_de_obra_detalle:   manoObraDetalle,
      // Control de calidad
      resultado_qc:           orden?.resultado_qc      || null,
      observaciones_qc:       orden?.observaciones_qc  || null,
      checklist_qc:           orden?.checklist_qc      || {},
      // Snapshots JSONB completos
      avances_data:           avancesData,
      cotizacion_data:        cotizacionData,
      factura_data:           facturaData,
      timeline_data:          timelineData,
      fechas_proceso:         fechasProceso,
      inspeccion_data:        inspeccionData,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("vehiculo_historial").insert([payload]).select("id").maybeSingle();

    if (insertErr) {
      console.error(`❌ crearHistorial INSERT falló — Diagnóstico #${diagnosticoId}:`, insertErr.message);
      console.error("Payload enviado:", JSON.stringify(payload, null, 2));
    } else {
      console.log(`✅ Historial guardado (id=${inserted?.id}) — Orden #${orden?.numero_orden || diag.orden_id} | Placa: ${payload.placa} | Técnico: ${tecnicoNombre}`);
    }
  } catch (err) {
    console.error("❌ crearHistorialDesdeDiagnostico excepción:", err.message);
  }
}

// ── POST /ordenes/:id/crear-historial — forzar creación de historial (órdenes ya entregadas) ──
app.post("/ordenes/:id/crear-historial", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: orden } = await supabase.from("ordenes_trabajo").select("estado").eq("id", id).maybeSingle();
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    if (orden.estado !== "ENTREGADO") return res.status(400).json({ error: "La orden debe estar en estado ENTREGADO" });

    const { data: diag } = await supabase
      .from("diagnosticos").select("id").eq("orden_id", id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (!diag?.id) return res.status(400).json({ error: "No hay diagnóstico para esta orden" });

    // Eliminar historial previo si existe para re-crearlo
    await supabase.from("vehiculo_historial").delete().eq("diagnostico_id", diag.id).catch(() => {});

    await crearHistorialDesdeDiagnostico(diag.id);
    res.json({ ok: true, mensaje: `Historial creado para orden #${id}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /vehiculo-historial — lista completa (admin)
// Fuente de verdad: ordenes_trabajo (tiene TODAS las órdenes, activas y entregadas).
// vehiculo_historial se usa solo para el detalle/snapshot; no para la lista.
app.get("/vehiculo-historial", async (req, res) => {
  try {
    const safe = async (fn) => { try { const r = await fn(); return r.data || null; } catch { return null; } };

    // 1. Todas las órdenes de trabajo (menos CANCELADO)
    const ordenes = await safe(() =>
      supabase.from("ordenes_trabajo")
        .select("id, numero_orden, descripcion, motivo_entrada, estado, created_at, cliente_id, vehiculo_id, total")
        .not("estado", "eq", "CANCELADO")
        .order("created_at", { ascending: false })
        .limit(1000)
    ) || [];

    if (ordenes.length === 0) return res.json([]);

    // 2. Enriquecer con vehículo y cliente en 2 queries en paralelo
    const vehiculoIds = [...new Set(ordenes.map(o => o.vehiculo_id).filter(Boolean))];
    const clienteIds  = [...new Set(ordenes.map(o => o.cliente_id).filter(Boolean))];

    const [vehiculos, clientes, histSnap] = await Promise.all([
      vehiculoIds.length > 0
        ? safe(() => supabase.from("vehiculos").select("id,placa,marca,modelo,ano,color").in("id", vehiculoIds))
        : Promise.resolve([]),
      clienteIds.length > 0
        ? safe(() => supabase.from("clientes").select("id,nombre,telefono").in("id", clienteIds))
        : Promise.resolve([]),
      // vehiculo_historial: id real + campos extra para el detalle
      safe(() => supabase.from("vehiculo_historial")
        .select("id, orden_id, costo_total, costo_mano_obra, costo_repuestos, tecnico_nombre, ncf, fecha_entrega, tipo_servicio")
        .order("created_at", { ascending: false })),
    ]);

    const vMap = {}; (vehiculos || []).forEach(v => { vMap[v.id] = v; });
    const cMap = {}; (clientes  || []).forEach(c => { cMap[c.id] = c; });
    const hMap = {}; (histSnap  || []).forEach(h => { if (h.orden_id) hMap[h.orden_id] = h; });

    const lista = ordenes.map(o => {
      const v = vMap[o.vehiculo_id] || {};
      const c = cMap[o.cliente_id]  || {};
      const h = hMap[o.id]          || {};
      const entregada = o.estado === "ENTREGADO";
      const histId = hMap[o.id]?.id || null; // id real de vehiculo_historial (si existe)
      return {
        id:               histId ? histId : `orden_${o.id}`,  // numérico si tiene historial, string si no
        orden_id:         o.id,
        _historial_id:    histId,   // para saber si hay snapshot en vehiculo_historial
        placa:            v.placa    || "—",
        marca:            v.marca    || "—",
        modelo:           v.modelo   || "—",
        ano:              v.ano      || null,
        color:            v.color    || null,
        cliente_nombre:   c.nombre   || "Particular",
        cliente_telefono: c.telefono || null,
        numero_orden:     o.numero_orden || `OT-${String(o.id).padStart(4, "0")}`,
        tipo_servicio:    h.tipo_servicio || o.descripcion || o.motivo_entrada || "En proceso",
        tecnico_nombre:   h.tecnico_nombre || null,
        costo_total:      Number(h.costo_total || o.total || 0),
        costo_mano_obra:  Number(h.costo_mano_obra || 0),
        costo_repuestos:  Number(h.costo_repuestos || 0),
        ncf:              h.ncf || null,
        fecha_servicio:   h.fecha_entrega || o.created_at,
        estado:           o.estado || "RECIBIDO",
        _activa:          !entregada,
      };
    });

    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /vehiculo-historial/:id/detalle — datos completos de la orden (diagnóstico, avances, cotización, factura, QC)
app.get("/vehiculo-historial/:id/detalle", async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Registro base del historial
    const { data: hist, error: hErr } = await supabase
      .from("vehiculo_historial")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (hErr || !hist) return res.status(404).json({ error: "Historial no encontrado" });

    const safe = async (fn) => { try { const r = await fn(); return r.data || null; } catch { return null; } };

    // 2. Diagnóstico completo
    const diag = hist.diagnostico_id
      ? await safe(() => supabase.from("diagnosticos").select("*").eq("id", hist.diagnostico_id).maybeSingle())
      : null;

    const ordenId = diag?.orden_id || null;

    // 3. Orden de trabajo completa
    const orden = ordenId
      ? await safe(() => supabase.from("ordenes_trabajo").select("*").eq("id", ordenId).maybeSingle())
      : null;

    // 4. Avances de reparación
    const avances = hist.diagnostico_id
      ? await safe(() => supabase.from("avances_reparacion").select("*").eq("diagnostico_id", hist.diagnostico_id).order("created_at"))
      : null;

    // 5. Cotización + items
    const cotizacion = hist.diagnostico_id
      ? await safe(() => supabase.from("cotizaciones").select("*").eq("diagnostico_id", hist.diagnostico_id).maybeSingle())
      : null;

    const cotizacion_items = cotizacion?.id
      ? await safe(() => supabase.from("cotizacion_items").select("*").eq("cotizacion_id", cotizacion.id).order("id"))
      : null;

    // 6. Factura + items — busca por orden_id, luego fallback por cotizacion_id
    let factura = ordenId
      ? await safe(() => supabase.from("facturas").select("*").eq("orden_id", ordenId).order("id", { ascending: false }).limit(1).maybeSingle())
      : null;
    if (!factura && cotizacion?.id) {
      factura = await safe(() => supabase.from("facturas").select("*").eq("cotizacion_id", cotizacion.id).order("id", { ascending: false }).limit(1).maybeSingle());
    }

    const factura_items = factura?.id
      ? await safe(() => supabase.from("factura_items").select("*").eq("factura_id", factura.id).order("id"))
      : null;

    // 7. Estado historial (auditoría de transiciones)
    const estado_historial = ordenId
      ? await safe(() => supabase.from("estado_historial").select("*").eq("orden_id", ordenId).order("created_at"))
      : null;

    // 8. Inspección vehicular de recepción
    const inspeccion = ordenId
      ? await safe(() => supabase.from("inspeccion_vehiculo").select("*").eq("orden_id", ordenId).order("created_at", { ascending: false }).limit(1).maybeSingle())
      : null;

    // 9. Email del cliente
    const cliente = hist.cliente_id
      ? await safe(() => supabase.from("clientes").select("nombre,telefono,email").eq("id", hist.cliente_id).maybeSingle())
      : null;

    res.json({
      historial: hist,
      diagnostico: diag,
      orden,
      avances: Array.isArray(avances) ? avances : [],
      cotizacion,
      cotizacion_items: Array.isArray(cotizacion_items) ? cotizacion_items : [],
      factura,
      factura_items: Array.isArray(factura_items) ? factura_items : [],
      estado_historial: Array.isArray(estado_historial) ? estado_historial : [],
      inspeccion: inspeccion || null,
      cliente: cliente || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /vehiculo-historial/orden/:ordenId/detalle — detalle de una orden activa (no está en vehiculo_historial aún)
// Usado por la PWA cuando hace click en un item de historial cuyo id empieza con "orden_"
app.get("/vehiculo-historial/orden/:ordenId/detalle", async (req, res) => {
  try {
    const ordenId = parseInt(req.params.ordenId, 10);
    if (!ordenId) return res.status(400).json({ error: "ID inválido" });

    const safe = async (fn) => { try { const r = await fn(); return r.data || null; } catch { return null; } };

    // 1. Orden de trabajo completa
    const orden = await safe(() => supabase.from("ordenes_trabajo").select("*").eq("id", ordenId).maybeSingle());
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });

    // 2. Diagnóstico más reciente
    const diag = await safe(() =>
      supabase.from("diagnosticos").select("*").eq("orden_id", ordenId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle()
    );

    // 3–8. Todo en paralelo
    const [avances, inspeccion, cotizacion, factura, estado_historial, vehiculo, cliente, tecnico] = await Promise.all([
      diag?.id
        ? safe(() => supabase.from("avances_reparacion").select("*").eq("diagnostico_id", diag.id).order("created_at"))
        : Promise.resolve([]),
      safe(() => supabase.from("inspeccion_vehiculo").select("*").eq("orden_id", ordenId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle()),
      diag?.id
        ? safe(() => supabase.from("cotizaciones").select("*").eq("diagnostico_id", diag.id).maybeSingle())
        : Promise.resolve(null),
      safe(() => supabase.from("facturas").select("*").eq("orden_id", ordenId)
        .order("id", { ascending: false }).limit(1).maybeSingle()),
      safe(() => supabase.from("orden_trabajo_log").select("*").eq("orden_id", ordenId).order("created_at")),
      orden.vehiculo_id
        ? safe(() => supabase.from("vehiculos").select("*").eq("id", orden.vehiculo_id).maybeSingle())
        : Promise.resolve(null),
      orden.cliente_id
        ? safe(() => supabase.from("clientes").select("*").eq("id", orden.cliente_id).maybeSingle())
        : Promise.resolve(null),
      orden.tecnico_asignado_id
        ? safe(() => supabase.from("usuarios").select("nombre").eq("id", orden.tecnico_asignado_id).maybeSingle())
        : Promise.resolve(null),
    ]);

    // Fallback factura por cotizacion_id (para registros sin orden_id)
    let facturaFinal = factura;
    if (!facturaFinal && cotizacion?.id) {
      facturaFinal = await safe(() => supabase.from("facturas").select("*").eq("cotizacion_id", cotizacion.id).order("id", { ascending: false }).limit(1).maybeSingle());
    }

    // Items de factura (si hay factura)
    const factura_items = facturaFinal?.id
      ? await safe(() => supabase.from("factura_items").select("*").eq("factura_id", facturaFinal.id).order("id"))
      : [];

    // Items de cotización (del JSONB items_detalle o del campo items)
    const cotizacion_items = Array.isArray(cotizacion?.items_detalle) ? cotizacion.items_detalle
      : Array.isArray(cotizacion?.items) ? cotizacion.items : [];

    // Calcular fechas del proceso desde orden y log
    const fechas_proceso = {
      recibido:            orden.created_at,
      diagnostico:         orden.fecha_diagnostico || null,
      esperando_aprobacion:orden.fecha_esperando_aprobacion || null,
      aprobacion:          orden.fecha_aprobacion || null,
      inicio_reparacion:   orden.fecha_inicio_reparacion || null,
      control_calidad:     orden.fecha_control_calidad || null,
      listo:               orden.fecha_listo || null,
      entrega:             orden.fecha_entrega || null,
    };

    // Nombre del técnico
    const tecnico_nombre = diag?.tecnico_nombre || orden.tecnico_nombre || tecnico?.nombre || null;

    res.json({
      historial:       null,
      diagnostico:     diag || null,
      orden,
      avances:         Array.isArray(avances) ? avances : [],
      cotizacion:      cotizacion || null,
      cotizacion_items,
      factura:         facturaFinal || null,
      factura_items:   Array.isArray(factura_items) ? factura_items : [],
      estado_historial:Array.isArray(estado_historial) ? estado_historial : [],
      inspeccion:      inspeccion || null,
      cliente:         cliente || null,
      vehiculo:        vehiculo || null,
      tecnico_nombre,
      fechas_proceso,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /vehiculo-historial/placa/:placa — consulta pública para PWA del cliente y web
// Busca en AMBAS fuentes: órdenes activas + historial cerrado
app.get("/vehiculo-historial/placa/:placa", async (req, res) => {
  try {
    const resultado = await consultarHistorialPorPlaca(req.params.placa);
    if (!resultado.found) return res.json({ found: false, historial: [] });
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /vehiculo-historial/vehiculo/:id — historial de un vehículo específico (admin)
app.get("/vehiculo-historial/vehiculo/:vehiculoId", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("vehiculo_historial")
      .select("*")
      .eq("vehiculo_id", req.params.vehiculoId)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /vehiculo-historial — crear registro manualmente
app.post("/vehiculo-historial", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("vehiculo_historial")
      .insert([{ ...req.body, created_at: new Date() }])
      .select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /vehiculo-historial/:id — actualizar registro (agregar detalles, corregir info)
app.patch("/vehiculo-historial/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("vehiculo_historial")
      .update(req.body)
      .eq("id", req.params.id)
      .select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// 🔍 HELPER COMPARTIDO — Consulta historial por placa
// Replica EXACTAMENTE la lógica de la PWA del cliente.
// Usa select("*") para órdenes — evita fallos por columnas que pueden
// tener distintos nombres según la migración que esté aplicada.
// =====================================================
async function consultarHistorialPorPlaca(placa, _debug = false) {
  const dbgLog = [];
  const dbg = (msg) => { console.log("🤖 TG_DBG:", msg); dbgLog.push(msg); };

  // Normalizar: mayúsculas, sin espacios ni guiones
  const placaNorm = placa.toUpperCase().replace(/[\s\-_]/g, "").trim();
  dbg(`placa_input="${placa}" → normalizada="${placaNorm}"`);

  // ── 1. Buscar vehículo — igual que la PWA: traer todos y filtrar client-side ──
  const { data: todosVehiculos, error: vErr } = await supabase
    .from("vehiculos")
    .select("id, marca, modelo, placa, ano, color, cliente_id");
  if (vErr) {
    console.error("🤖 TG[vehiculos]:", vErr.message);
    dbg(`ERROR vehiculos: ${vErr.message}`);
  }
  dbg(`vehiculos_en_bd=${(todosVehiculos || []).length}`);

  const vehiculo = (todosVehiculos || []).find(v =>
    v.placa?.toUpperCase().replace(/[\s\-_]/g, "") === placaNorm
  );
  dbg(`vehiculo_encontrado=${vehiculo ? `id=${vehiculo.id} placa="${vehiculo.placa}"` : "NO"}`);

  // ── 2. Historial cerrado (vehiculo_historial) — búsqueda flexible ──
  const placaConGuion = placaNorm.replace(/^([A-Z]{1,2})(\d+)$/, "$1-$2");
  const { data: histData, error: hErr } = await supabase
    .from("vehiculo_historial")
    .select("*")
    .or(`placa.ilike.${placaNorm},placa.ilike.${placaConGuion}`)
    .order("created_at", { ascending: false });
  if (hErr) {
    console.error("🤖 TG[historial]:", hErr.message);
    dbg(`ERROR historial: ${hErr.message}`);
  }
  dbg(`vehiculo_historial_rows=${(histData || []).length}`);

  // ── 3. Todas las órdenes del vehículo SIN filtro de estado (igual que la PWA) ──
  // Usamos select("*") para no fallar si alguna columna tiene distinto nombre en BD.
  let todasOrdenes = [];

  if (vehiculo) {
    // Intento principal: filtrar por vehiculo_id
    let ordenesRaw = null;
    const { data: ordPrimary, error: oErr } = await supabase
      .from("ordenes_trabajo")
      .select("*")
      .eq("vehiculo_id", vehiculo.id)
      .order("created_at", { ascending: false });

    if (oErr) {
      console.error("🤖 TG[ordenes]:", oErr.message);
      dbg(`ERROR ordenes vehiculo_id: ${oErr.message}`);
      // Fallback: traer todas del cliente y filtrar por vehiculo_id en memoria
      if (vehiculo.cliente_id) {
        dbg(`Fallback por cliente_id=${vehiculo.cliente_id}`);
        const { data: ordFb, error: oErrFb } = await supabase
          .from("ordenes_trabajo")
          .select("*")
          .eq("cliente_id", vehiculo.cliente_id)
          .order("created_at", { ascending: false });
        if (oErrFb) {
          dbg(`ERROR fallback: ${oErrFb.message}`);
        } else {
          ordenesRaw = (ordFb || []).filter(o =>
            String(o.vehiculo_id) === String(vehiculo.id)
          );
          dbg(`fallback_ordenes=${ordenesRaw.length}`);
        }
      }
    } else {
      ordenesRaw = ordPrimary || [];
      dbg(`ordenes_encontradas=${ordenesRaw.length}`);
    }

    if (ordenesRaw && ordenesRaw.length > 0) {
      const ordenIds = ordenesRaw.map(o => o.id);

      // ── 4. Diagnósticos por orden_id ──
      const { data: diags, error: dErr } = await supabase
        .from("diagnosticos")
        .select(
          "id, orden_id, tipo_servicio, observaciones, fallas_identificadas, " +
          "trabajos_realizados, mano_de_obra_detalle, trabajos_realizados_items, " +
          "mano_obra, repuestos, total, terminado, " +
          "inspeccion_mecanica, inspeccion_electrica, inspeccion_electronica, " +
          "codigos_falla, descripcion, hallazgos, notas, tiempo_estimado, " +
          "tecnico_nombre, usuario_nombre, created_at"
        )
        .in("orden_id", ordenIds)
        .order("created_at", { ascending: false });
      if (dErr) {
        console.error("🤖 TG[diagnosticos]:", dErr.message);
        dbg(`ERROR diagnosticos: ${dErr.message}`);
      }
      dbg(`diagnosticos_encontrados=${(diags || []).length}`);

      const diagPorOrden = {};
      (diags || []).forEach(d => { diagPorOrden[d.orden_id] = d; });

      // ── 5. Avances de todos los diagnósticos de una vez ──
      const diagIds = (diags || []).map(d => d.id);
      let avancesPorDiag = {};
      if (diagIds.length > 0) {
        const { data: avancesAll, error: aErr } = await supabase
          .from("avances_reparacion")
          .select("diagnostico_id, descripcion, created_at, tecnico_nombre")
          .in("diagnostico_id", diagIds)
          .order("created_at", { ascending: false });
        if (aErr) console.error("🤖 TG[avances]:", aErr.message);
        (avancesAll || []).forEach(a => {
          if (!avancesPorDiag[a.diagnostico_id]) avancesPorDiag[a.diagnostico_id] = [];
          if (avancesPorDiag[a.diagnostico_id].length < 4)
            avancesPorDiag[a.diagnostico_id].push(a);
        });
      }

      // ── 6. Construir entradas enriquecidas por orden ──
      todasOrdenes = ordenesRaw.map(o => {
        const diag = diagPorOrden[o.id] || null;

        let trabajosItems = [];
        const rawItems = diag?.trabajos_realizados_items;
        if (Array.isArray(rawItems)) trabajosItems = rawItems;
        else if (typeof rawItems === "string" && rawItems.trim().startsWith("[")) {
          try { trabajosItems = JSON.parse(rawItems); } catch { trabajosItems = []; }
        }

        // Soporte para columna "total" O "costo_total" (desde orden o diagnóstico)
        const moAmount   = Number(diag?.mano_obra  || 0);
        const repAmount  = Number(diag?.repuestos   || 0);
        const diagTotal  = moAmount + repAmount || Number(diag?.total || 0);
        const costoFinal = Number(o.costo_total || o.total || diagTotal || 0);

        return {
          id:                        `orden_${o.id}`,
          placa:                     vehiculo.placa,
          marca:                     vehiculo.marca,
          modelo:                    vehiculo.modelo,
          ano:                       vehiculo.ano,
          color:                     vehiculo.color,
          estado:                    o.estado || "RECIBIDO",
          numero_orden:              o.numero_orden || `OT-${String(o.id).padStart(4, "0")}`,
          tipo_servicio:             diag?.tipo_servicio || o.descripcion || "Servicio en proceso",
          descripcion:               o.descripcion || null,
          motivo_entrada:            o.motivo_entrada || o.descripcion || null,
          observaciones:             diag?.observaciones || "",
          fallas_identificadas:      diag?.fallas_identificadas || "",
          trabajos_realizados:       diag?.trabajos_realizados || "",
          mano_de_obra_detalle:      diag?.mano_de_obra_detalle || "",
          trabajos_realizados_items: trabajosItems,
          avances_recientes:         diag ? (avancesPorDiag[diag.id] || []) : [],
          costo_total:               costoFinal,
          costo_mano_obra:           moAmount,
          costo_repuestos:           repAmount,
          tecnico_nombre:            diag?.tecnico_nombre || null,
          fecha_servicio:            o.created_at,
          created_at:                o.created_at,
          // Nombres que espera la PWA en su vista de detalle:
          avances_data:              diag ? (avancesPorDiag[diag.id] || []) : [],
          // Cliente (para imprimir expediente sin esperar detalle async)
          cliente_nombre:            null, // se rellena abajo si hay cliente
          cliente_telefono:          null,
          _activa:                   !["COMPLETADO","FACTURADO","ENTREGADO","CANCELADA"].includes(o.estado),
          _orden_id:                 o.id,
          _cliente_id:               o.cliente_id || null,
        };
      });

      // ── 6b. Enriquecer con nombre del cliente (batch único) ──
      const clienteIds = [...new Set(todasOrdenes.map(o => o._cliente_id).filter(Boolean))];
      if (clienteIds.length > 0) {
        const { data: clientes } = await supabase
          .from("clientes")
          .select("id, nombre, telefono")
          .in("id", clienteIds);
        if (clientes && clientes.length > 0) {
          const clienteMap = {};
          clientes.forEach(c => { clienteMap[c.id] = c; });
          todasOrdenes = todasOrdenes.map(o => {
            const c = clienteMap[o._cliente_id];
            return c ? { ...o, cliente_nombre: c.nombre || null, cliente_telefono: c.telefono || null } : o;
          });
        }
      }
    }
  }

  // ── 7. Combinar: órdenes + historial cerrado (sin duplicados por numero_orden) ──
  const numerosDeOrdenes = new Set(todasOrdenes.map(o => o.numero_orden).filter(Boolean));
  const histFiltrado = (histData || []).filter(h =>
    !h.numero_orden || !numerosDeOrdenes.has(h.numero_orden)
  );
  const historial = [...todasOrdenes, ...histFiltrado];

  console.log(`🤖 TG[placa:${placaNorm}] vehiculo=${vehiculo?.id ?? "no"} ordenes=${todasOrdenes.length} historial=${histFiltrado.length}`);

  if (historial.length === 0) {
    if (vehiculo) {
      return {
        found: true,
        vehiculo: { placa: vehiculo.placa, marca: vehiculo.marca, modelo: vehiculo.modelo, ano: vehiculo.ano, color: vehiculo.color },
        ultimo_estado: "RECIBIDO",
        historial: [{
          id: `veh_${vehiculo.id}`, placa: vehiculo.placa,
          marca: vehiculo.marca, modelo: vehiculo.modelo,
          ano: vehiculo.ano, color: vehiculo.color,
          estado: "RECIBIDO", tipo_servicio: "Vehículo registrado",
          created_at: new Date().toISOString(), _activa: false,
        }],
      };
    }
    return { found: false, historial: [] };
  }

  const ref = historial[0];
  return {
    found: true,
    vehiculo: {
      placa:  ref.placa  || vehiculo?.placa  || placaNorm,
      marca:  ref.marca  || vehiculo?.marca  || "",
      modelo: ref.modelo || vehiculo?.modelo || "",
      ano:    ref.ano    || vehiculo?.ano    || null,
      color:  ref.color  || vehiculo?.color  || null,
    },
    ultimo_estado: ref.estado,
    historial,
  };
}

// =====================================================
// 🤖 TELEGRAM BOT — ASISTENTE VIRTUAL SÓLIDO AUTO SERVICIO
// Usa: TELEGRAM_TOKEN y OPENAI_API_KEY como variables de entorno
// =====================================================

const TG_TOKEN  = process.env.TELEGRAM_TOKEN;
const OAI_KEY   = process.env.OPENAI_API_KEY;
const TG_API    = `https://api.telegram.org/bot${TG_TOKEN}`;

// ── Contexto del taller para la IA ───────────────────────────────────────────
const CONTEXTO_TALLER = `
Eres el asistente virtual de Sólido Auto Servicio, un taller automotriz profesional en Santo Domingo, República Dominicana. Tu nombre es SólidoBot.

INFORMACIÓN DEL TALLER:
- Nombre: Sólido Auto Servicio
- Teléfono / WhatsApp: 849-569-2027
- Dirección: Santo Domingo, República Dominicana
- Horario: Lunes–Viernes 8:00 AM–6:00 PM | Sábados 8:00 AM–4:00 PM | Domingos 9:00 AM–2:00 PM

SERVICIOS:
1. Diagnóstico Computarizado — scanner digital completo
2. Mantenimiento Preventivo — aceite, filtros, bujías, correas
3. Sistema de Frenos — pastillas, discos, tambores, líquido de frenos
4. Suspensión y Dirección — amortiguadores, rótulas, terminales, dirección asistida
5. Sistema Eléctrico — diagnóstico y reparación eléctrica y electrónica
6. Sistema de Enfriamiento — radiador, bomba de agua, termostato
7. Motor y Transmisión — reparaciones mayores y menores
8. Aire Acondicionado — recarga, diagnóstico y reparación de A/C
9. Alineación y Balanceo — alineación computarizada de 4 ruedas

VALORES (acrónimo SÓLIDO): Servicio · Organización · Limpieza · Institucionalidad · Dinamismo · Orden

MISIÓN: Estandarizar los protocolos para la intervención automotriz con los más altos estándares.
VISIÓN: Ser el taller automotriz de referencia en Santo Domingo, reconocido por calidad y transparencia.

CAFETERÍA: Contamos con Sólido Café Garage, donde los clientes pueden disfrutar de bebidas y comida mientras esperan su vehículo.

CITAS Y AGENDAMIENTO:
- Los clientes pueden agendar citas en línea en: https://crm-automotriz-3wde-production.up.railway.app/cita
- Solo necesitan: placa, teléfono, tipo de servicio, fecha y hora deseada.
- El taller confirma o cancela la cita. El cliente recibe una notificación push 1 hora antes.
- También pueden llamar al 849-569-2027 para agendar.

NOTIFICACIONES DE CAMBIO DE ACEITE:
- El sistema envía alertas automáticas cuando se acerca la fecha del próximo cambio de aceite.
- El cliente debe activar las notificaciones en: https://crm-automotriz-3wde-production.up.railway.app/cliente
- Las alertas llegan directamente al teléfono como notificaciones de la app.

REGLAS PARA RESPONDER:
- Responde siempre en español, de forma amable, breve y profesional.
- Si el cliente pregunta por el estado de su vehículo, pídele que escriba su placa (ej: A123456).
- Si preguntan por agendar una cita, dales el enlace: https://crm-automotriz-3wde-production.up.railway.app/cita
- Si preguntan por presupuestos específicos o reparaciones complejas, diles que un técnico los contactará pronto.
- No inventes precios exactos. Puedes decir que los precios varían según el vehículo y el diagnóstico.
- Si no sabes algo con certeza, sugiere llamar al 849-569-2027.
- Respuestas máximo 3 párrafos cortos.
`.trim();

// ── Helpers ───────────────────────────────────────────────────────────────────

// Enviar mensaje a Telegram
async function tgSend(chatId, text, extra = {}) {
  try {
    await fetch(`${TG_API}/sendMessage`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
    });
  } catch (e) { console.error("tgSend error:", e.message); }
}

// Indicador "escribiendo..."
async function tgTyping(chatId) {
  try {
    await fetch(`${TG_API}/sendChatAction`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ chat_id: chatId, action: "typing" }),
    });
  } catch {}
}

// Extrae una placa dominicana del texto (mensaje exacto O embebido en una oración)
// Formatos soportados: A123456 | AB12345 | A-123456 | A 123456 | A-12-3456
// También detecta frases como "mi placa es A123456", "placa: A-123", "tengo el A123456"
function extraerPlaca(txt) {
  if (!txt || typeof txt !== "string") return null;
  const upper = txt.toUpperCase().trim();

  // Normalizar para comparación: quitar guiones, espacios y guiones bajos
  const limpio = upper.replace(/[\s\-_]/g, "");

  // ── Coincidencia exacta: el usuario SOLO escribió la placa ──
  // Formatos RD: 1-2 letras + 3-7 dígitos  |  3-7 dígitos solos
  if (/^[A-Z]{1,2}\d{3,7}$/.test(limpio)) return limpio;
  if (/^\d{3,7}$/.test(limpio))           return limpio;

  // ── Buscar placa embebida en texto natural ──
  // Ej: "mi placa es A-123456", "el carro A123456 está listo", "placa: AB12345"
  const patron = /(?:placa[:\s]*|número[:\s]*|numero[:\s]*|vehículo[:\s]*|vehiculo[:\s]*|el\s+|mi\s+)?([A-Z]{1,2}[\s\-]?\d{3,7}|\d{3,7})\b/gi;
  const matches = [...upper.matchAll(patron)];
  for (const m of matches) {
    const candidato = m[1].replace(/[\s\-]/g, "");
    if (/^[A-Z]{1,2}\d{3,7}$/.test(candidato) || /^\d{3,7}$/.test(candidato)) {
      return candidato;
    }
  }

  // ── Fallback: buscar cualquier patrón de placa en el texto ──
  const fallback = upper.match(/\b([A-Z]{1,2}[\s\-]?\d{3,7}|\d{3,7})\b/);
  if (fallback) {
    const candidato = fallback[1].replace(/[\s\-]/g, "");
    if (/^[A-Z]{1,2}\d{3,7}$/.test(candidato) || /^\d{3,7}$/.test(candidato)) {
      return candidato;
    }
  }

  return null;
}

// Llamar a OpenAI GPT-4o-mini
async function preguntarIA(userMsg) {
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OAI_KEY}` },
      body:    JSON.stringify({
        model:       "gpt-4o-mini",
        max_tokens:  400,
        temperature: 0.6,
        messages: [
          { role: "system", content: CONTEXTO_TALLER },
          { role: "user",   content: userMsg },
        ],
      }),
    });
    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim()
      || "Lo siento, no pude procesar tu consulta. Por favor llámanos al 849-569-2027.";
  } catch (e) {
    console.error("OpenAI error:", e.message);
    return "Lo siento, hubo un problema. Por favor llámanos al 849-569-2027.";
  }
}

// ── Webhook principal ─────────────────────────────────────────────────────────
app.post("/telegram/webhook", async (req, res) => {
  res.sendStatus(200); // Responder a Telegram de inmediato (requerido)

  try {
    const update = req.body;
    if (!update?.message?.text) return;

    const chatId  = update.message.chat.id;
    const nombre  = update.message.from?.first_name || "Cliente";
    const texto   = update.message.text.trim();
    const textoUp = texto.toUpperCase().replace(/[\s\-]/g, "");

    await tgTyping(chatId);

    // ── Comando /debug PLACA — diagnóstico visible en Telegram ────────────
    const debugMatch = texto.match(/^\/debug\s+(.+)$/i);
    if (debugMatch) {
      const placaTest = debugMatch[1].trim();
      const placaNormTest = placaTest.toUpperCase().replace(/[\s\-_]/g, "");
      let info = `🔍 <b>DEBUG: "${placaTest}" → "${placaNormTest}"</b>\n\n`;

      // 1. Vehiculos
      const { data: vAll, error: vE } = await supabase
        .from("vehiculos").select("id, placa, marca, modelo, cliente_id");
      if (vE) info += `❌ vehiculos: ${vE.message}\n`;
      else {
        info += `✅ vehiculos en BD: ${(vAll || []).length}\n`;
        const vMatch = (vAll || []).find(v =>
          v.placa?.toUpperCase().replace(/[\s\-_]/g, "") === placaNormTest
        );
        if (vMatch) {
          info += `✅ Vehículo: id=${vMatch.id} placa="${vMatch.placa}" ${vMatch.marca} ${vMatch.modelo}\n`;
          // 2. Ordenes
          const { data: ords, error: oE } = await supabase
            .from("ordenes_trabajo").select("id, estado, vehiculo_id, created_at")
            .eq("vehiculo_id", vMatch.id);
          if (oE) info += `❌ ordenes (vehiculo_id): ${oE.message}\n`;
          else info += `✅ órdenes encontradas: ${(ords || []).length}\n${(ords || []).map(o => `   • id=${o.id} estado="${o.estado}"`).join("\n")}\n`;
          // 3. Historial
          const { data: hist, error: hE } = await supabase
            .from("vehiculo_historial").select("id, placa, estado")
            .or(`placa.ilike.${placaNormTest},placa.ilike.${placaNormTest.replace(/^([A-Z]{1,2})(\d+)$/, "$1-$2")}`);
          if (hE) info += `❌ historial: ${hE.message}\n`;
          else info += `✅ historial filas: ${(hist || []).length}\n`;
        } else {
          info += `❌ Vehículo NO encontrado para esa placa\n`;
          info += `📋 Placas en BD: ${(vAll || []).slice(0, 10).map(v => `"${v.placa}"`).join(", ")}`;
        }
      }
      await tgSend(chatId, info);
      return;
    }

    // ── /start, /ayuda o saludo ───────────────────────────────────────────
    const esMenuTrigger =
      texto === "/start" ||
      texto === "/ayuda" ||
      texto === "/menu"  ||
      texto === "."      ||
      /^(hola|hi|hey|alo|aló|hello|buenas|buenos|buen dia|buen día|buen día|como estas|cómo estás|como estás|cómo estas|qué tal|que tal|buenas tardes|buenas noches|buenas días|buenas dias)$/i.test(texto);

    if (esMenuTrigger) {
      await tgSend(chatId,
        `👋 ¡Hola, <b>${nombre}</b>! Soy <b>SólidoBot</b>, el asistente virtual de Sólido Auto Servicio.\n\n` +
        `¿En qué puedo ayudarte hoy?\n\n` +
        `🚗 <b>Estado de tu vehículo</b>\n   → Escríbeme tu placa (ej: <code>A123456</code>)\n\n` +
        `📅 <b>Agendar una cita</b>\n   → Usa el botón <b>📅 Agendar Cita</b>\n\n` +
        `🔩 <b>Repuestos disponibles</b>\n   → Usa el botón <b>🔩 Repuestos</b>\n\n` +
        `☕ <b>Menú cafetería</b>\n   → Usa el botón <b>☕ Menú</b>\n\n` +
        `🛠️ <b>Nuestros servicios</b>\n   → Usa el botón <b>🛠️ Servicios</b>\n\n` +
        `📞 <b>Contacto y horarios</b>\n   → Usa el botón <b>📞 Contacto</b>\n\n` +
        `O simplemente escríbeme tu consulta. 😊`,
        {
          reply_markup: JSON.stringify({
            keyboard: [
              [{ text: "🚗 Mi Vehículo" }, { text: "📅 Agendar Cita" }],
              [{ text: "🔩 Repuestos"   }, { text: "☕ Menú"          }],
              [{ text: "🛠️ Servicios"  }, { text: "📞 Contacto"      }],
              [{ text: "💬 Hablar con asesor" }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
          }),
        }
      );
      return;
    }

    // ── Botón "Mi Vehículo" ───────────────────────────────────────────────
    if (/^🚗 mi vehículo$/i.test(texto) || /^(mi vehículo|mi vehiculo|ver estado|consultar estado|estado vehiculo)$/i.test(texto)) {
      await tgSend(chatId,
        `🚗 Por favor escríbeme la <b>placa</b> de tu vehículo.\n` +
        `Ejemplo: <code>A123456</code> o <code>AB12345</code>`
      );
      return;
    }

    // ── Botón / intención "Agendar Cita" ────────────────────────────────────
    if (
      /^📅 agendar cita$/i.test(texto) ||
      /\b(agendar|reservar|cita|appointment|quiero una cita|necesito una cita|sacar turno|turno|agendarme)\b/i.test(texto)
    ) {
      const PWA_URL = "https://crm-automotriz-3wde-production.up.railway.app/cita";
      await tgSend(chatId,
        `📅 <b>Agendar tu cita en Sólido Auto Servicio</b>\n\n` +
        `Puedes reservar tu cita directamente desde nuestro portal en línea:\n\n` +
        `👉 <a href="${PWA_URL}">Agendar mi cita aquí</a>\n\n` +
        `Solo necesitas:\n` +
        `• Tu número de placa\n` +
        `• Tu teléfono de contacto\n` +
        `• El tipo de servicio que necesitas\n` +
        `• Fecha y hora de tu preferencia\n\n` +
        `⏰ Te recordaremos tu cita <b>1 hora antes</b> por notificación.\n\n` +
        `También puedes llamarnos directamente al <b>849-569-2027</b> para reservar. 😊`
      );
      return;
    }

    // ── Consulta sobre cambio de aceite / mantenimiento próximo ─────────────
    if (/\b(cambio.?de.?aceite|aceite|aceites|oil change|mantenimiento proximo|próximo mantenimiento|cuando.?toca|me toca)\b/i.test(texto)) {
      await tgSend(chatId,
        `🛢️ <b>Cambio de Aceite y Mantenimiento</b>\n\n` +
        `Nuestro sistema monitorea el historial de tu vehículo y te enviará una <b>notificación automática</b> cuando se acerque la fecha de tu próximo cambio de aceite. 🔔\n\n` +
        `Para activar estas alertas, visita nuestra app:\n` +
        `👉 <a href="https://crm-automotriz-3wde-production.up.railway.app/cliente">Ver estado de mi vehículo</a>\n` +
        `y presiona el botón <b>🔔 Activar Notificaciones</b>.\n\n` +
        `Si ya se te acercó el mantenimiento, <b>agenda tu cita ahora</b>:\n` +
        `📅 <a href="https://crm-automotriz-3wde-production.up.railway.app/cita">Reservar cita</a>\n\n` +
        `📞 También puedes llamarnos al <b>849-569-2027</b>.`
      );
      return;
    }

    // ── Detección de placa ─────────────────────────────────────────────────
    const placaDetectada = extraerPlaca(texto);
    if (placaDetectada) {

      // Usa exactamente la misma lógica que la PWA del cliente
      const resultado = await consultarHistorialPorPlaca(placaDetectada);

      if (!resultado.found) {
        await tgSend(chatId,
          `❓ No encontré registros para la placa <b>${placaDetectada}</b> en nuestro sistema.\n\n` +
          `¿Es correcta la placa? Escríbela sin guiones ni espacios.\n` +
          `Ej: <code>A123456</code> o <code>AB12345</code>\n\n` +
          `Si el número es correcto, puedes usar <code>/debug ${placaDetectada}</code> para diagnóstico,\n` +
          `o llámanos al <b>849-569-2027</b>.`
        );
        return;
      }

      const { vehiculo, historial } = resultado;
      const ultimo = historial[0];

      // ── Tabla de estados completa (igual que la PWA cliente) ──
      const ESTADO_INFO = {
        RECIBIDO:             { icon: "📋", label: "Recibido",            tip: "Hemos recibido tu vehículo. Pronto un técnico comenzará el diagnóstico.", activo: true  },
        DIAGNOSTICO:          { icon: "🔬", label: "En Diagnóstico",       tip: "Nuestro técnico está evaluando tu vehículo en este momento.",             activo: true  },
        ESPERANDO_APROBACION: { icon: "⏳", label: "Esperando aprobación", tip: "Diagnóstico listo. Necesitamos tu autorización para continuar.",          activo: true  },
        REPARACION:           { icon: "🔧", label: "En Reparación",        tip: "Tu vehículo está siendo reparado por nuestro equipo técnico.",            activo: true  },
        CONTROL_CALIDAD:      { icon: "🔎", label: "Control de Calidad",   tip: "Revisión final de calidad en proceso. Casi listo.",                       activo: true  },
        LISTO:                { icon: "🎉", label: "¡Listo para retirar!", tip: "Tu vehículo está listo. Puedes pasar a recogerlo.",                       activo: true  },
        ENTREGADO:            { icon: "🏁", label: "Entregado",            tip: "Vehículo entregado. ¡Gracias por confiar en Sólido Auto Servicio!",       activo: false },
        COMPLETADO:           { icon: "✅", label: "Completado",           tip: "Servicio completado satisfactoriamente.",                                 activo: false },
        FACTURADO:            { icon: "🧾", label: "Facturado",            tip: "Servicio facturado y finalizado.",                                        activo: false },
        CANCELADA:            { icon: "❌", label: "Cancelada",            tip: "Esta orden fue cancelada.",                                               activo: false },
        EN_PROCESO:           { icon: "🔧", label: "En Proceso",           tip: "Tu vehículo está siendo atendido.",                                       activo: true  },
      };
      const getEI = (estado) => ESTADO_INFO[estado] || { icon: "🔧", label: (estado || "En proceso").replace(/_/g, " "), tip: "", activo: true };

      const estadoInfo = getEI(ultimo?.estado);
      const esActiva   = ultimo?._activa ?? estadoInfo.activo;

      // ── Mensaje 1: encabezado + estado actual + detalles del último servicio ──
      let msg1 = `🚗 <b>${vehiculo.marca || ""} ${vehiculo.modelo || ""}</b>`.trim();
      if (vehiculo.ano)   msg1 += ` (${vehiculo.ano})`;
      if (vehiculo.color) msg1 += ` · ${vehiculo.color}`;
      msg1 += `\n🏷️ Placa: <code>${vehiculo.placa}</code>`;
      if (ultimo?.numero_orden) msg1 += `  |  📋 <b>${ultimo.numero_orden}</b>`;
      msg1 += `\n\n${estadoInfo.icon} <b>${estadoInfo.label}</b>`;
      if (estadoInfo.tip) msg1 += `\n<i>${estadoInfo.tip}</i>`;

      if (ultimo && ultimo.tipo_servicio && ultimo.tipo_servicio !== "Vehículo registrado") {
        msg1 += `\n\n🔧 <b>Servicio:</b> ${ultimo.tipo_servicio}`;
      }

      const fechaUlt = ultimo?.fecha_servicio
        ? new Date(ultimo.fecha_servicio).toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" })
        : null;
      if (fechaUlt)                   msg1 += `\n📅 ${fechaUlt}`;
      if (ultimo?.tecnico_nombre)     msg1 += `  ·  👨‍🔧 ${ultimo.tecnico_nombre}`;

      // Diagnóstico / fallas
      if (ultimo?.fallas_identificadas)
        msg1 += `\n\n⚠️ <b>Diagnóstico</b>\n${ultimo.fallas_identificadas.substring(0, 280)}`;

      // Trabajos — mano de obra detalle > items estructurados > campo texto
      const moDetalle    = ultimo?.mano_de_obra_detalle || "";
      const trabajosItems = Array.isArray(ultimo?.trabajos_realizados_items) ? ultimo.trabajos_realizados_items : [];
      if (moDetalle) {
        const lineas = moDetalle.split("\n").filter(l => l.trim()).slice(0, 6);
        if (lineas.length) {
          msg1 += `\n\n🔩 <b>Trabajos</b>`;
          lineas.forEach(l => { msg1 += `\n  ✓ ${l.trim()}`; });
        }
      } else if (trabajosItems.length) {
        msg1 += `\n\n🔩 <b>Trabajos</b>`;
        trabajosItems.slice(0, 5).forEach(t => {
          const chk = t.estado === "REALIZADO" ? "✅" : "🔧";
          msg1 += `\n  ${chk} ${t.nombre || t.descripcion || "—"}`;
        });
      } else if (ultimo?.trabajos_realizados) {
        msg1 += `\n\n🛠️ <b>Trabajos</b>\n${ultimo.trabajos_realizados.substring(0, 300)}`;
      }

      // Avances recientes
      const avances = Array.isArray(ultimo?.avances_recientes) ? ultimo.avances_recientes : [];
      if (avances.length) {
        msg1 += `\n\n📋 <b>Últimos Avances</b>`;
        avances.forEach(a => {
          const fav = a.created_at
            ? new Date(a.created_at).toLocaleString("es-DO", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
            : "";
          msg1 += `\n  • <i>${fav}</i> — ${(a.descripcion || "").substring(0, 100)}`;
        });
      }

      // Costo
      if (ultimo?.costo_total > 0)
        msg1 += `\n\n💰 <b>Total: RD$ ${Number(ultimo.costo_total).toLocaleString("es-DO", { minimumFractionDigits: 2 })}</b>`;

      // Observaciones / NCF (historial cerrado)
      if (ultimo?.observaciones && !esActiva)
        msg1 += `\n📝 ${ultimo.observaciones.substring(0, 180)}`;
      if (ultimo?.ncf)
        msg1 += `\n🧾 NCF: ${ultimo.ncf}`;

      // CTA por estado
      if (esActiva) {
        const estado = ultimo?.estado;
        if (estado === "LISTO") {
          msg1 += `\n\n🎉 <b>¡Tu vehículo te espera!</b> Pasa a buscarlo.\n`;
          msg1 += `💬 <a href="https://wa.me/18495692027?text=${encodeURIComponent(`Hola, voy a buscar mi ${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.placa}).`)}">Avisar por WhatsApp</a>`;
        } else if (estado === "ESPERANDO_APROBACION") {
          msg1 += `\n\n📲 <b>¿Apruebas la reparación?</b> Contáctanos:\n`;
          msg1 += `💬 <a href="https://wa.me/18495692027?text=${encodeURIComponent(`Hola, apruebo la reparación de mi ${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.placa}).`)}">Aprobar por WhatsApp</a>`;
        } else if (estado === "CONTROL_CALIDAD") {
          msg1 += `\n\n🔎 <i>Revisión final en curso. Tu vehículo estará listo muy pronto.</i>`;
        } else if (["RECIBIDO","DIAGNOSTICO","REPARACION"].includes(estado)) {
          msg1 += `\n\n⏳ <i>Seguimos trabajando para ti. Te avisaremos cuando esté listo.</i>`;
        }
      }

      await tgSend(chatId, msg1);

      // ── Mensaje 2: timeline historial completo (si tiene >1 visita) ──
      if (historial.length > 1) {
        // Dividir en bloques si hay muchos para no exceder límite Telegram (4096 chars)
        const BLOQUES_MAX = 10;
        let msg2 = `📚 <b>Historial de Servicios — ${historial.length} visita${historial.length !== 1 ? "s" : ""}</b>\n`;
        historial.slice(0, BLOQUES_MAX).forEach((h, i) => {
          const ei    = getEI(h.estado);
          const fecha = (h.fecha_servicio || h.created_at)
            ? new Date(h.fecha_servicio || h.created_at).toLocaleDateString("es-DO", { year: "numeric", month: "short", day: "numeric" })
            : "—";
          const isActH = h._activa ?? ei.activo;
          msg2 += `\n${isActH ? "🟢" : "⚫"} <b>${i + 1}. ${h.tipo_servicio || h.descripcion || "Servicio"}</b>\n`;
          msg2 += `   ${ei.icon} ${ei.label}  ·  📅 ${fecha}`;
          if (h.numero_orden) msg2 += `  ·  ${h.numero_orden}`;
          if (h.tecnico_nombre) msg2 += `\n   👨‍🔧 ${h.tecnico_nombre}`;
          if (h.costo_total > 0)
            msg2 += `\n   💰 RD$ ${Number(h.costo_total).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`;
          msg2 += "\n";
        });
        if (historial.length > BLOQUES_MAX)
          msg2 += `\n<i>... y ${historial.length - BLOQUES_MAX} visitas más en el historial.</i>\n`;
        msg2 += `\n📞 ¿Alguna pregunta? Llámanos al <b>849-569-2027</b>.`;
        await tgSend(chatId, msg2);
      } else {
        await tgSend(chatId, `📞 ¿Alguna consulta? Llámanos al <b>849-569-2027</b> o escríbenos por WhatsApp.`);
      }

      return;
    }

    // ── Repuestos ──────────────────────────────────────────────────────────
    if (/repuest|pieza|piezas|invent|🔩/i.test(texto)) {
      const { data: rep } = await supabase
        .from("inventario").select("name, price, stock, code")
        .gt("stock", 0).order("name").limit(20);

      if (rep?.length) {
        const lista = rep.map(r =>
          `• ${r.name}${r.code ? ` <i>(${r.code})</i>` : ""} — <b>RD$ ${Number(r.price).toLocaleString("es-DO")}</b> ` +
          (r.stock <= 3 ? "⚠️" : "✅")
        ).join("\n");
        await tgSend(chatId,
          `🔩 <b>Repuestos disponibles</b>\n\n${lista}\n\n` +
          `Para apartar o consultar disponibilidad escríbenos al WhatsApp <b>849-569-2027</b>.`
        );
      } else {
        await tgSend(chatId,
          `🔩 En este momento no hay repuestos con stock registrado.\n` +
          `Para consultas de disponibilidad llámanos al <b>849-569-2027</b>.`
        );
      }
      return;
    }

    // ── Menú cafetería ─────────────────────────────────────────────────────
    if (/menú|menu|café|cafe|cafeter|comer|bebid|comid|☕/i.test(texto)) {
      const { data: prods } = await supabase
        .from("cafeteria_productos").select("nombre, precio, categoria, stock")
        .or("activo.is.null,activo.eq.true")
        .gt("stock", 0).order("categoria").limit(25);

      if (prods?.length) {
        const cats = [...new Set(prods.map(p => p.categoria || "General"))];
        let msg = `☕ <b>Menú — Sólido Café Garage</b>\n\n`;
        cats.forEach(cat => {
          msg += `<b>— ${cat} —</b>\n`;
          prods.filter(p => (p.categoria || "General") === cat)
               .forEach(p => { msg += `  • ${p.nombre} — RD$ ${Number(p.precio).toLocaleString("es-DO")}\n`; });
          msg += "\n";
        });
        msg += `Disfruta mientras esperas tu vehículo. 😊`;
        await tgSend(chatId, msg);
      } else {
        await tgSend(chatId, `☕ El menú no está disponible en este momento. Visítanos directamente o llámanos al <b>849-569-2027</b>.`);
      }
      return;
    }

    // ── Servicios ──────────────────────────────────────────────────────────
    if (/servicio|hacen|ofrecen|trabajo|reparaci|manten|diagnos|🛠️/i.test(texto)) {
      await tgSend(chatId,
        `🛠️ <b>Nuestros Servicios</b>\n\n` +
        `• Diagnóstico Computarizado (Scanner)\n` +
        `• Mantenimiento Preventivo (aceite, filtros, bujías)\n` +
        `• Sistema de Frenos\n` +
        `• Suspensión y Dirección\n` +
        `• Sistema Eléctrico y Electrónico\n` +
        `• Sistema de Enfriamiento\n` +
        `• Motor y Transmisión\n` +
        `• Aire Acondicionado\n` +
        `• Alineación y Balanceo computarizado\n\n` +
        `Para cotizaciones escríbenos al WhatsApp <b>849-569-2027</b>.`
      );
      return;
    }

    // ── Contacto y horarios ────────────────────────────────────────────────
    if (/contacto|horario|hora|abierto|abren|cierran|direcci|dónde|donde|ubicaci|📞/i.test(texto)) {
      await tgSend(chatId,
        `📍 <b>Sólido Auto Servicio</b>\n\n` +
        `📞 Teléfono: <b>849-569-2027</b>\n` +
        `💬 WhatsApp: <a href="https://wa.me/18495692027">+1 849-569-2027</a>\n` +
        `📍 Santo Domingo, República Dominicana\n\n` +
        `⏰ <b>Horario de Atención</b>\n` +
        `Lunes – Viernes: 8:00 AM – 6:00 PM\n` +
        `Sábados:          8:00 AM – 4:00 PM\n` +
        `Domingos:         9:00 AM – 2:00 PM`
      );
      return;
    }

    // ── Escalación a humano ────────────────────────────────────────────────
    if (/hablar|persona|humano|agente|técnico|tecnico|presupuest|cotizaci|precio de|cuánto cuesta|cuanto cuesta|💬 hablar/i.test(texto)) {
      await tgSend(chatId,
        `👨‍🔧 Entendido, <b>${nombre}</b>. Te conectaré con nuestro equipo.\n\n` +
        `📞 Llámanos: <b>849-569-2027</b>\n` +
        `💬 WhatsApp: <a href="https://wa.me/18495692027?text=Hola, necesito hablar con un técnico">Escríbenos aquí</a>\n\n` +
        `Horario: Lunes–Viernes 8AM–6PM | Sábados 8AM–4PM.`
      );
      return;
    }

    // ── Todo lo demás → OpenAI ─────────────────────────────────────────────
    const respuestaIA = await preguntarIA(
      `Cliente llamado ${nombre} dice: "${texto}"`
    );
    await tgSend(chatId, respuestaIA);

  } catch (err) {
    console.error("🤖 Telegram bot error:", err.message);
  }
});

// ── Registro del webhook (llamar UNA VEZ después de hacer deploy) ─────────────
// Visitar: https://crm-automotriz-3wde-production.up.railway.app/telegram/setup
app.get("/telegram/setup", async (req, res) => {
  if (!TG_TOKEN) return res.json({ error: "TELEGRAM_TOKEN no configurado" });
  const webhookUrl = "https://crm-automotriz-3wde-production.up.railway.app/telegram/webhook";
  const r    = await fetch(`${TG_API}/setWebhook`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ url: webhookUrl, allowed_updates: ["message"] }),
  });
  const data = await r.json();
  res.json({ webhookUrl, telegram: data });
});

// ── Info del bot ──────────────────────────────────────────────────────────────
app.get("/telegram/info", async (req, res) => {
  if (!TG_TOKEN) return res.json({ error: "TELEGRAM_TOKEN no configurado" });
  const r    = await fetch(`${TG_API}/getWebhookInfo`);
  const data = await r.json();
  res.json(data);
});

// =====================================================
// 🤖 AI — CONSULTA DE CLIENTE (para Telegram bot en Vercel)
// POST /ai/consulta-cliente
// Body: { "pregunta": "...", "cliente_id": <optional> }
// Devuelve: { "respuesta": "..." }
// =====================================================
app.post("/ai/consulta-cliente", async (req, res) => {
  try {
    const { pregunta, cliente_id } = req.body;

    if (!pregunta || typeof pregunta !== "string" || !pregunta.trim()) {
      return res.status(400).json({ error: "El campo 'pregunta' es requerido." });
    }

    if (!OAI_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY no configurada en el servidor." });
    }

    // ── Recopilar contexto del cliente desde Supabase ─────────────────────
    let contextoCliente = "";

    if (cliente_id) {
      const id = Number(cliente_id);

      const [
        { data: cliente },
        { data: vehiculos },
        { data: ordenes },
        { data: diagnosticos },
        { data: ventas },
      ] = await Promise.all([
        supabase.from("clientes").select("*").eq("id", id).single(),
        supabase.from("vehiculos").select("*").eq("cliente_id", id),
        supabase.from("ordenes_trabajo").select("*").eq("cliente_id", id).order("created_at", { ascending: false }).limit(10),
        supabase.from("diagnosticos").select("*").eq("cliente_id", id).order("created_at", { ascending: false }).limit(10),
        supabase.from("ventas").select("*").eq("customer_name", cliente?.nombre ?? "").order("created_at", { ascending: false }).limit(10),
      ]);

      if (cliente) {
        contextoCliente += `\n\n--- DATOS DEL CLIENTE ---`;
        contextoCliente += `\nNombre: ${cliente.nombre}`;
        if (cliente.telefono) contextoCliente += ` | Teléfono: ${cliente.telefono}`;
        if (cliente.email)    contextoCliente += ` | Email: ${cliente.email}`;
      }

      if (vehiculos?.length) {
        contextoCliente += `\n\n--- VEHÍCULOS (${vehiculos.length}) ---`;
        vehiculos.forEach(v => {
          contextoCliente += `\n• ${v.marca} ${v.modelo} ${v.ano ?? ""} — Placa: ${v.placa ?? "N/A"} — Color: ${v.color ?? "N/A"}`;
        });
      }

      if (ordenes?.length) {
        contextoCliente += `\n\n--- ÓRDENES DE TRABAJO (últimas ${ordenes.length}) ---`;
        ordenes.forEach(o => {
          const fecha = o.created_at ? new Date(o.created_at).toLocaleDateString("es-DO") : "N/A";
          contextoCliente += `\n• [${fecha}] Estado: ${o.estado ?? o.status ?? "N/A"} — ${o.descripcion ?? "Sin descripción"} — Total: RD$ ${Number(o.total ?? 0).toLocaleString("es-DO")}`;
        });
      }

      if (diagnosticos?.length) {
        contextoCliente += `\n\n--- DIAGNÓSTICOS (últimos ${diagnosticos.length}) ---`;
        diagnosticos.forEach(d => {
          const fecha = d.created_at ? new Date(d.created_at).toLocaleDateString("es-DO") : "N/A";
          contextoCliente += `\n• [${fecha}] Estado: ${d.estado ?? "N/A"} — ${d.descripcion ?? d.problema ?? "Sin descripción"}`;
        });
      }

      if (ventas?.length) {
        contextoCliente += `\n\n--- VENTAS / COMPRAS (últimas ${ventas.length}) ---`;
        ventas.forEach(v => {
          const fecha = v.created_at ? new Date(v.created_at).toLocaleDateString("es-DO") : "N/A";
          contextoCliente += `\n• [${fecha}] NCF: ${v.ncf ?? "N/A"} — Total: RD$ ${Number(v.total ?? 0).toLocaleString("es-DO")} — Método: ${v.method ?? "N/A"}`;
        });
      }

      if (!contextoCliente) {
        contextoCliente = "\n\nNo se encontraron datos para este cliente en el sistema.";
      }
    } else {
      contextoCliente = "\n\nNo se proporcionó un cliente_id; responde de forma general sobre el taller.";
    }

    // ── Construir prompt y llamar a OpenAI ────────────────────────────────
    const systemPrompt =
      `${CONTEXTO_TALLER}\n\n` +
      `Además de la información general del taller, tienes acceso a los datos reales del cliente en el CRM:` +
      contextoCliente +
      `\n\nResponde la pregunta del usuario basándote en estos datos. Sé preciso, amable y conciso.`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OAI_KEY}` },
      body:    JSON.stringify({
        model:       "gpt-4o-mini",
        max_tokens:  600,
        temperature: 0.5,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: pregunta.trim() },
        ],
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("OpenAI API error:", resp.status, errBody);
      return res.status(502).json({ error: "Error al contactar OpenAI.", detalle: errBody });
    }

    const data = await resp.json();
    const respuesta = data.choices?.[0]?.message?.content?.trim()
      ?? "No pude generar una respuesta. Por favor intenta de nuevo.";

    res.json({ respuesta });

  } catch (err) {
    console.error("🤖 /ai/consulta-cliente error:", err.message);
    res.status(500).json({ error: "Error interno del servidor.", detalle: err.message });
  }
});

// =====================================================
// 🔄 CUADRE DE CAJA AUTOMÁTICO
// =====================================================

// GET /api/contabilidad/cuadre/auto?fecha=YYYY-MM-DD
// Calcula el cuadre del día automáticamente desde facturas + caja_chica
app.get("/api/contabilidad/cuadre/auto", async (req, res) => {
  try {
    const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
    const desde = `${fecha}T00:00:00`;
    const hasta  = `${fecha}T23:59:59`;

    // Facturas activas del día
    const { data: facturas } = await supabase
      .from("facturas")
      .select("total, itbis, metodo_pago, estado")
      .neq("estado", "CANCELADA")
      .gte("created_at", desde)
      .lte("created_at", hasta);

    const facs = facturas || [];
    const ventas_efectivo_taller = facs.filter(f => f.metodo_pago === "EFECTIVO")
      .reduce((a, f) => a + Number(f.total), 0);
    const ventas_tarjeta       = facs.filter(f => f.metodo_pago === "TARJETA")
      .reduce((a, f) => a + Number(f.total), 0);
    const ventas_transferencia = facs.filter(f => f.metodo_pago === "TRANSFERENCIA")
      .reduce((a, f) => a + Number(f.total), 0);
    const ventas_cheque        = facs.filter(f => f.metodo_pago === "CHEQUE")
      .reduce((a, f) => a + Number(f.total), 0);
    const ventas_credito       = facs.filter(f => f.metodo_pago === "CREDITO")
      .reduce((a, f) => a + Number(f.total), 0);
    const ventas_total_taller  = facs.reduce((a, f) => a + Number(f.total), 0);

    // Egresos de caja chica del día
    const { data: gastosCC } = await supabase
      .from("caja_chica")
      .select("monto, tipo")
      .gte("fecha", desde)
      .lte("fecha", hasta);

    const gastos = (gastosCC || [])
      .filter(g => g.tipo === "EGRESO")
      .reduce((a, g) => a + Number(g.monto), 0);

    // Efectivo del taller solamente (cafetería tiene su propio cuadre)
    const ventas_efectivo = ventas_efectivo_taller;

    // Saldo inicial: efectivo_final del último cuadre anterior a hoy
    const { data: ultimoCuadre } = await supabase
      .from("cuadre_caja")
      .select("efectivo_final, fecha")
      .lt("fecha", fecha)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle();

    const efectivo_inicial = ultimoCuadre ? Number(ultimoCuadre.efectivo_final || 0) : 0;

    // Saldo esperado = efectivo_inicial + ventas_efectivo - gastos
    const saldo_esperado = efectivo_inicial + ventas_efectivo - gastos;

    res.json({
      fecha,
      efectivo_inicial,
      saldo_esperado,
      facturas_count: facs.length,
      ventas_efectivo,
      ventas_tarjeta,
      ventas_transferencia,
      ventas_cheque,
      ventas_credito,
      ventas_total: ventas_total_taller,
      gastos,
      por_metodo: [
        { metodo: "EFECTIVO",      total: ventas_efectivo },
        { metodo: "TARJETA",       total: ventas_tarjeta },
        { metodo: "TRANSFERENCIA", total: ventas_transferencia },
        { metodo: "CHEQUE",        total: ventas_cheque },
        { metodo: "CRÉDITO",       total: ventas_credito },
      ].filter(m => m.total > 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// 🔧 MANTENIMIENTO PREVENTIVO
// =====================================================

// Intervalos por defecto según tipo de servicio
const INTERVALOS_MANT = {
  CAMBIO_ACEITE:   { dias: 90,  km: 5000  },
  FILTROS:         { dias: 180, km: 10000 },
  FRENOS:          { dias: 365, km: 20000 },
  CORREAS:         { dias: 730, km: 40000 },
  BUJIAS:          { dias: 365, km: 20000 },
  ALINEACION:      { dias: 180, km: null  },
  TRANSMISION:     { dias: 365, km: 40000 },
  AC:              { dias: 365, km: null  },
  SUSPENSION:      { dias: 365, km: 20000 },
  DIAGNOSTICO:     { dias: 180, km: null  },
  OTRO:            { dias: 180, km: null  },
};

// Normaliza tipo_servicio del diagnóstico al tipo de mantenimiento
function normalizarTipoMantenimiento(tipoServicio) {
  const t = (tipoServicio || "").toUpperCase();
  if (t.includes("ACEITE"))       return "CAMBIO_ACEITE";
  if (t.includes("FILTRO"))       return "FILTROS";
  if (t.includes("FRENO"))        return "FRENOS";
  if (t.includes("CORREA"))       return "CORREAS";
  if (t.includes("BUJIA") || t.includes("BUJÍAS")) return "BUJIAS";
  if (t.includes("ALINEAC"))      return "ALINEACION";
  if (t.includes("TRANSMIS"))     return "TRANSMISION";
  if (t.includes("AIRE") || t.includes("A/C") || t.includes("AC")) return "AC";
  if (t.includes("SUSPENSION") || t.includes("SUSPENSIÓN")) return "SUSPENSION";
  if (t.includes("DIAGN"))        return "DIAGNOSTICO";
  return "OTRO";
}

// GET /mantenimiento — lista todos con info de vehículo y cliente
app.get("/mantenimiento", async (req, res) => {
  try {
    const { data: planes } = await supabase
      .from("mantenimiento_preventivo")
      .select("*")
      .neq("estado", "CANCELADO")
      .order("proximo_fecha", { ascending: true });

    if (!planes || planes.length === 0) return res.json([]);

    const vehiculoIds = [...new Set(planes.map(p => p.vehiculo_id).filter(Boolean))];
    const clienteIds  = [...new Set(planes.map(p => p.cliente_id).filter(Boolean))];

    const [{ data: vehiculos }, { data: clientes }] = await Promise.all([
      supabase.from("vehiculos").select("id, marca, modelo, placa, ano").in("id", vehiculoIds),
      supabase.from("clientes").select("id, nombre, telefono").in("id", clienteIds),
    ]);

    const hoy = new Date();
    const enrich = planes.map(p => {
      const v = vehiculos?.find(x => x.id === p.vehiculo_id);
      const c = clientes?.find(x => x.id === p.cliente_id);
      const diasRestantes = p.proximo_fecha
        ? Math.ceil((new Date(p.proximo_fecha) - hoy) / 86400000)
        : null;
      const semaforo =
        diasRestantes === null ? "gris" :
        diasRestantes < 0      ? "rojo"  :
        diasRestantes <= 7     ? "amarillo" : "verde";
      return {
        ...p,
        vehiculo_info:  v ? `${v.marca} ${v.modelo} (${v.placa})` : "Sin vehículo",
        vehiculo_placa: v?.placa || "",
        cliente_nombre: c?.nombre || "Sin cliente",
        cliente_telefono: c?.telefono || "",
        dias_restantes: diasRestantes,
        semaforo,
      };
    });

    res.json(enrich);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /mantenimiento/urgentes — vencidos + por vencer en 7 días
app.get("/mantenimiento/urgentes", async (req, res) => {
  try {
    const en7dias = new Date();
    en7dias.setDate(en7dias.getDate() + 7);

    const { data } = await supabase
      .from("mantenimiento_preventivo")
      .select("*")
      .eq("estado", "ACTIVO")
      .lte("proximo_fecha", en7dias.toISOString().slice(0, 10))
      .order("proximo_fecha", { ascending: true });

    const ids = [...new Set((data || []).map(p => p.vehiculo_id).filter(Boolean))];
    const { data: vehiculos } = ids.length
      ? await supabase.from("vehiculos").select("id, marca, modelo, placa").in("id", ids)
      : { data: [] };

    const hoy = new Date();
    const enrich = (data || []).map(p => {
      const v = vehiculos?.find(x => x.id === p.vehiculo_id);
      const diasRestantes = p.proximo_fecha
        ? Math.ceil((new Date(p.proximo_fecha) - hoy) / 86400000)
        : null;
      return {
        ...p,
        vehiculo_info: v ? `${v.marca} ${v.modelo} (${v.placa})` : "Sin vehículo",
        dias_restantes: diasRestantes,
        semaforo: diasRestantes !== null && diasRestantes < 0 ? "rojo" : "amarillo",
      };
    });

    res.json(enrich);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /mantenimiento/vehiculo/:id
app.get("/mantenimiento/vehiculo/:vehiculoId", async (req, res) => {
  try {
    const { data } = await supabase
      .from("mantenimiento_preventivo")
      .select("*")
      .eq("vehiculo_id", req.params.vehiculoId)
      .order("proximo_fecha", { ascending: true });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /mantenimiento — crear plan manualmente
app.post("/mantenimiento", async (req, res) => {
  try {
    const {
      vehiculo_id, cliente_id, tipo_servicio, descripcion,
      intervalo_dias, intervalo_km,
      ultimo_servicio_fecha, ultimo_servicio_km, proximo_fecha, proximo_km
    } = req.body;

    const { data, error } = await supabase
      .from("mantenimiento_preventivo")
      .insert([{
        vehiculo_id, cliente_id: cliente_id || null,
        tipo_servicio, descripcion: descripcion || null,
        intervalo_dias:        Number(intervalo_dias  || 180),
        intervalo_km:          intervalo_km ? Number(intervalo_km) : null,
        ultimo_servicio_fecha: ultimo_servicio_fecha || null,
        ultimo_servicio_km:    ultimo_servicio_km ? Number(ultimo_servicio_km) : null,
        proximo_fecha:         proximo_fecha || null,
        proximo_km:            proximo_km ? Number(proximo_km) : null,
        estado: "ACTIVO",
      }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /mantenimiento/:id — actualizar (completar, editar, cancelar)
app.patch("/mantenimiento/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body, updated_at: new Date().toISOString() };

    // Si se está completando, calcular el próximo vencimiento automáticamente
    if (req.body.estado === "COMPLETADO" && req.body.ultimo_servicio_fecha) {
      const tipoKey = normalizarTipoMantenimiento(req.body.tipo_servicio || "");
      const intervalo = INTERVALOS_MANT[tipoKey] || INTERVALOS_MANT.OTRO;
      const ultimaFecha = new Date(req.body.ultimo_servicio_fecha);
      ultimaFecha.setDate(ultimaFecha.getDate() + (req.body.intervalo_dias || intervalo.dias));
      updates.proximo_fecha = ultimaFecha.toISOString().slice(0, 10);
      updates.estado = "ACTIVO";  // Reiniciar para el próximo ciclo
      updates.notificado = false;
    }

    const { data, error } = await supabase
      .from("mantenimiento_preventivo")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /mantenimiento/:id
app.delete("/mantenimiento/:id", async (req, res) => {
  try {
    await supabase.from("mantenimiento_alertas")
      .delete().eq("mantenimiento_id", req.params.id);
    const { error } = await supabase
      .from("mantenimiento_preventivo")
      .delete().eq("id", req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /mantenimiento/stats — KPIs para el dashboard
app.get("/mantenimiento/stats", async (req, res) => {
  try {
    const hoy   = new Date().toISOString().slice(0, 10);
    const en7   = new Date(); en7.setDate(en7.getDate() + 7);
    const en7s  = en7.toISOString().slice(0, 10);

    const { data: todos } = await supabase
      .from("mantenimiento_preventivo")
      .select("estado, proximo_fecha")
      .neq("estado", "CANCELADO");

    const planes = todos || [];
    const vencidos       = planes.filter(p => p.proximo_fecha && p.proximo_fecha < hoy && p.estado === "ACTIVO").length;
    const proximos7dias  = planes.filter(p => p.proximo_fecha >= hoy && p.proximo_fecha <= en7s && p.estado === "ACTIVO").length;
    const alDia          = planes.filter(p => (!p.proximo_fecha || p.proximo_fecha > en7s) && p.estado === "ACTIVO").length;

    res.json({ vencidos, proximos7dias, alDia, total: planes.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: crea o actualiza plan de mantenimiento desde un diagnóstico completado
async function crearMantenimientoDesdeDiagnostico(diagId) {
  try {
    const { data: diag } = await supabase
      .from("diagnosticos").select("*").eq("id", diagId).single();
    if (!diag || !diag.vehiculo_id) return;

    const tipoKey = normalizarTipoMantenimiento(diag.tipo_servicio || "");
    const intervalo = INTERVALOS_MANT[tipoKey] || INTERVALOS_MANT.OTRO;

    const fechaHoy = new Date();
    const proximaFecha = new Date(fechaHoy);
    proximaFecha.setDate(proximaFecha.getDate() + intervalo.dias);

    // Buscar si ya existe un plan activo de este tipo para este vehículo
    const { data: existente } = await supabase
      .from("mantenimiento_preventivo")
      .select("id")
      .eq("vehiculo_id", diag.vehiculo_id)
      .eq("tipo_servicio", tipoKey)
      .neq("estado", "CANCELADO")
      .maybeSingle();

    const payload = {
      vehiculo_id:           diag.vehiculo_id,
      cliente_id:            diag.cliente_id || null,
      tipo_servicio:         tipoKey,
      descripcion:           diag.tipo_servicio || tipoKey,
      intervalo_dias:        intervalo.dias,
      intervalo_km:          intervalo.km || null,
      ultimo_servicio_fecha: fechaHoy.toISOString().slice(0, 10),
      proximo_fecha:         proximaFecha.toISOString().slice(0, 10),
      estado:                "ACTIVO",
      notificado:            false,
      diagnostico_origen_id: diagId,
      updated_at:            new Date().toISOString(),
    };

    if (existente) {
      await supabase.from("mantenimiento_preventivo").update(payload).eq("id", existente.id);
      console.log(`🔧 Mantenimiento actualizado — Diagnóstico #${diagId} | Tipo: ${tipoKey}`);
    } else {
      await supabase.from("mantenimiento_preventivo").insert([payload]);
      console.log(`🔧 Mantenimiento creado — Diagnóstico #${diagId} | Tipo: ${tipoKey}`);
    }
  } catch (err) {
    console.error("❌ crearMantenimientoDesdeDiagnostico:", err.message);
  }
}

// =====================================================
// 🔮 INTELIGENCIA PREDICTIVA
// =====================================================

// GET /api/predictivo/fallas-por-modelo
app.get("/api/predictivo/fallas-por-modelo", async (req, res) => {
  try {
    const { data: diags } = await supabase
      .from("diagnosticos")
      .select("tipo_servicio, fallas_identificadas, vehiculo_id")
      .not("tipo_servicio", "is", null);

    const { data: vehiculos } = await supabase
      .from("vehiculos")
      .select("id, marca, modelo, ano");

    const vehiculoMap = {};
    (vehiculos || []).forEach(v => { vehiculoMap[v.id] = v; });

    const conteo = {};
    (diags || []).forEach(d => {
      const v = vehiculoMap[d.vehiculo_id];
      if (!v) return;
      const clave = `${v.marca} ${v.modelo}`;
      if (!conteo[clave]) conteo[clave] = { modelo: clave, marca: v.marca, servicios: {}, total: 0 };
      const srv = d.tipo_servicio || "OTRO";
      conteo[clave].servicios[srv] = (conteo[clave].servicios[srv] || 0) + 1;
      conteo[clave].total++;
    });

    const resultado = Object.values(conteo)
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)
      .map(m => ({
        ...m,
        top_servicios: Object.entries(m.servicios)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([servicio, count]) => ({ servicio, count })),
      }));

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/predictivo/demanda-inventario
app.get("/api/predictivo/demanda-inventario", async (req, res) => {
  try {
    // Consumo de los últimos 90 días desde factura_items
    const desde90 = new Date();
    desde90.setDate(desde90.getDate() - 90);

    const { data: items } = await supabase
      .from("factura_items")
      .select("inventario_id, cantidad, created_at")
      .eq("tipo", "repuesto")
      .not("inventario_id", "is", null)
      .gte("created_at", desde90.toISOString());

    const consumo = {};
    (items || []).forEach(i => {
      consumo[i.inventario_id] = (consumo[i.inventario_id] || 0) + Number(i.cantidad);
    });

    const { data: inventario } = await supabase
      .from("inventario")
      .select("id, name, stock, min_stock, price");

    const resultado = (inventario || [])
      .map(p => {
        const consumo90 = consumo[p.id] || 0;
        const consumoMensual = consumo90 / 3;
        const diasCobertura = consumoMensual > 0 ? Math.floor((p.stock / consumoMensual) * 30) : null;
        const alerta = consumoMensual > 0 && p.stock < consumoMensual;
        return {
          id:               p.id,
          nombre:           p.name,
          stock_actual:     p.stock,
          min_stock:        p.min_stock,
          consumo_mensual:  Math.ceil(consumoMensual),
          consumo_90dias:   consumo90,
          dias_cobertura:   diasCobertura,
          alerta,
          precio:           p.price,
        };
      })
      .filter(p => p.consumo_90dias > 0)
      .sort((a, b) => (a.dias_cobertura ?? 999) - (b.dias_cobertura ?? 999));

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/predictivo/clientes-riesgo
app.get("/api/predictivo/clientes-riesgo", async (req, res) => {
  try {
    const { data: historial } = await supabase
      .from("vehiculo_historial")
      .select("cliente_id, cliente_nombre, fecha_servicio, created_at")
      .order("fecha_servicio", { ascending: false });

    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, nombre, telefono, email");

    const clienteMap = {};
    (clientes || []).forEach(c => { clienteMap[c.id] = c; });

    // Agrupar visitas por cliente
    const visitasPorCliente = {};
    (historial || []).forEach(h => {
      if (!h.cliente_id) return;
      if (!visitasPorCliente[h.cliente_id]) visitasPorCliente[h.cliente_id] = [];
      visitasPorCliente[h.cliente_id].push(new Date(h.fecha_servicio || h.created_at));
    });

    const hoy = new Date();
    const resultado = [];

    Object.entries(visitasPorCliente).forEach(([clienteId, visitas]) => {
      if (visitas.length < 2) return;
      visitas.sort((a, b) => b - a);
      const ultima = visitas[0];
      const diasDesdeUltima = Math.floor((hoy - ultima) / 86400000);

      // Calcular intervalo promedio entre visitas
      let sumIntervalos = 0;
      for (let i = 0; i < visitas.length - 1; i++) {
        sumIntervalos += Math.floor((visitas[i] - visitas[i + 1]) / 86400000);
      }
      const intervaloPromedio = Math.floor(sumIntervalos / (visitas.length - 1));

      // En riesgo si lleva más de 1.5x el intervalo promedio sin aparecer
      if (intervaloPromedio > 0 && diasDesdeUltima > intervaloPromedio * 1.5) {
        const c = clienteMap[clienteId];
        resultado.push({
          cliente_id:         Number(clienteId),
          nombre:             c?.nombre || "Sin nombre",
          telefono:           c?.telefono || "",
          email:              c?.email || "",
          visitas_total:      visitas.length,
          ultima_visita:      ultima.toISOString().slice(0, 10),
          dias_sin_visita:    diasDesdeUltima,
          intervalo_promedio: intervaloPromedio,
          nivel_riesgo:       diasDesdeUltima > intervaloPromedio * 3 ? "ALTO" : "MEDIO",
        });
      }
    });

    resultado.sort((a, b) => b.dias_sin_visita - a.dias_sin_visita);
    res.json(resultado.slice(0, 50));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/predictivo/proyeccion-ingresos
app.get("/api/predictivo/proyeccion-ingresos", async (req, res) => {
  try {
    const hoy  = new Date();
    const mesActualInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const mesAnteriorInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const mesAnteriorFin    = new Date(hoy.getFullYear(), hoy.getMonth(), 0);

    const [{ data: facturasMes }, { data: facturasAnt }] = await Promise.all([
      supabase.from("facturas").select("total, created_at")
        .neq("estado", "CANCELADA")
        .gte("created_at", mesActualInicio.toISOString()),
      supabase.from("facturas").select("total, created_at")
        .neq("estado", "CANCELADA")
        .gte("created_at", mesAnteriorInicio.toISOString())
        .lte("created_at", mesAnteriorFin.toISOString()),
    ]);

    const ingresosActuales = (facturasMes || []).reduce((a, f) => a + Number(f.total), 0);
    const ingresosAnt      = (facturasAnt  || []).reduce((a, f) => a + Number(f.total), 0);

    // Proyección lineal: (ingresos actuales / día transcurrido) × días del mes
    const diasTranscurridos = hoy.getDate();
    const diasDelMes        = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const proyeccion = diasTranscurridos > 0
      ? (ingresosActuales / diasTranscurridos) * diasDelMes
      : 0;

    // Ingresos por día de los últimos 30 días
    const desde30 = new Date(); desde30.setDate(desde30.getDate() - 29);
    const { data: facs30 } = await supabase
      .from("facturas")
      .select("total, created_at")
      .neq("estado", "CANCELADA")
      .gte("created_at", desde30.toISOString());

    const porDia = {};
    (facs30 || []).forEach(f => {
      const d = f.created_at.slice(0, 10);
      porDia[d] = (porDia[d] || 0) + Number(f.total);
    });
    const tendencia30 = Object.entries(porDia)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([fecha, total]) => ({ fecha, total }));

    res.json({
      ingresos_actuales:     ingresosActuales,
      ingresos_mes_anterior: ingresosAnt,
      proyeccion_mes:        Math.round(proyeccion),
      dias_transcurridos:    diasTranscurridos,
      dias_del_mes:          diasDelMes,
      variacion_pct:         ingresosAnt > 0
        ? Math.round(((proyeccion - ingresosAnt) / ingresosAnt) * 100)
        : 0,
      tendencia_30_dias:     tendencia30,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/predictivo/top-clientes
app.get("/api/predictivo/top-clientes", async (req, res) => {
  try {
    const { data: facturas } = await supabase
      .from("facturas")
      .select("cliente_id, cliente_nombre, total, created_at")
      .neq("estado", "CANCELADA")
      .not("cliente_id", "is", null);

    const resumen = {};
    (facturas || []).forEach(f => {
      const id = f.cliente_id;
      if (!resumen[id]) resumen[id] = {
        cliente_id: id,
        nombre: f.cliente_nombre || "Sin nombre",
        total_facturado: 0,
        visitas: 0,
        ultima_visita: null,
      };
      resumen[id].total_facturado += Number(f.total);
      resumen[id].visitas++;
      if (!resumen[id].ultima_visita || f.created_at > resumen[id].ultima_visita) {
        resumen[id].ultima_visita = f.created_at?.slice(0, 10);
      }
    });

    const resultado = Object.values(resumen)
      .map(c => ({
        ...c,
        ticket_promedio: c.visitas > 0 ? Math.round(c.total_facturado / c.visitas) : 0,
      }))
      .sort((a, b) => b.total_facturado - a.total_facturado)
      .slice(0, 20);

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/predictivo/resumen — dashboard de inteligencia
app.get("/api/predictivo/resumen", async (req, res) => {
  try {
    // Llamadas en paralelo
    const [urgentes, riesgo, demanda] = await Promise.all([
      supabase.from("mantenimiento_preventivo")
        .select("id", { count: "exact" })
        .eq("estado", "ACTIVO")
        .lte("proximo_fecha", new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)),
      supabase.from("vehiculo_historial")
        .select("cliente_id, fecha_servicio, created_at"),
      supabase.from("inventario")
        .select("id, stock, min_stock"),
    ]);

    const mantenimientosUrgentes = urgentes.count || 0;
    const stockCritico = (demanda.data || [])
      .filter(i => i.stock <= i.min_stock).length;

    res.json({
      mantenimientos_urgentes: mantenimientosUrgentes,
      stock_critico:           stockCritico,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// 💳 CUENTAS POR COBRAR
// =====================================================

// GET /api/contabilidad/cuentas-cobrar — lista con filtros opcionales
app.get("/api/contabilidad/cuentas-cobrar", async (req, res) => {
  try {
    const { estado, cliente_id } = req.query;
    let query = supabase
      .from("cuentas_cobrar")
      .select("*")
      .order("fecha_vencimiento", { ascending: true });

    if (estado && estado !== "TODOS") query = query.eq("estado", estado);
    if (cliente_id)                   query = query.eq("cliente_id", cliente_id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Actualizar estados de vencidas automáticamente
    const hoy = new Date().toISOString().slice(0, 10);
    const cuentas = (data || []).map(c => {
      let estadoReal = c.estado;
      if (estadoReal === "PENDIENTE" && c.fecha_vencimiento < hoy) estadoReal = "VENCIDO";
      if (estadoReal === "PARCIAL"   && c.fecha_vencimiento < hoy) estadoReal = "VENCIDO";
      const saldo = Number(c.monto_original) - Number(c.monto_pagado);
      return { ...c, saldo, estado: estadoReal };
    });

    res.json(cuentas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contabilidad/cuentas-cobrar/resumen — KPIs
app.get("/api/contabilidad/cuentas-cobrar/resumen", async (req, res) => {
  try {
    const hoy    = new Date().toISOString().slice(0, 10);
    const en7    = new Date(); en7.setDate(en7.getDate() + 7);
    const en7s   = en7.toISOString().slice(0, 10);

    const { data } = await supabase
      .from("cuentas_cobrar")
      .select("monto_original, monto_pagado, fecha_vencimiento, estado")
      .not("estado", "in", '("PAGADO","INCOBRABLE")');

    const cuentas = data || [];
    const totalPorCobrar = cuentas
      .reduce((a, c) => a + (Number(c.monto_original) - Number(c.monto_pagado)), 0);
    const vencidas = cuentas
      .filter(c => c.fecha_vencimiento < hoy)
      .reduce((a, c) => a + (Number(c.monto_original) - Number(c.monto_pagado)), 0);
    const porVencerSemana = cuentas
      .filter(c => c.fecha_vencimiento >= hoy && c.fecha_vencimiento <= en7s)
      .reduce((a, c) => a + (Number(c.monto_original) - Number(c.monto_pagado)), 0);

    res.json({ total_por_cobrar: totalPorCobrar, vencidas, por_vencer_semana: porVencerSemana, count: cuentas.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contabilidad/cuentas-cobrar/:id — detalle + pagos
app.get("/api/contabilidad/cuentas-cobrar/:id", async (req, res) => {
  try {
    const [{ data: cuenta }, { data: pagos }] = await Promise.all([
      supabase.from("cuentas_cobrar").select("*").eq("id", req.params.id).single(),
      supabase.from("pagos_cobrar").select("*").eq("cuenta_id", req.params.id)
        .order("fecha", { ascending: false }),
    ]);
    if (!cuenta) return res.status(404).json({ error: "Cuenta no encontrada" });
    res.json({ cuenta: { ...cuenta, saldo: Number(cuenta.monto_original) - Number(cuenta.monto_pagado) }, pagos: pagos || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contabilidad/cuentas-cobrar — crear cuenta
app.post("/api/contabilidad/cuentas-cobrar", async (req, res) => {
  try {
    const {
      cliente_id, factura_id, descripcion,
      monto_original, fecha_emision, fecha_vencimiento, notas, created_by
    } = req.body;

    if (!descripcion || !monto_original || !fecha_vencimiento)
      return res.status(400).json({ error: "Descripción, monto y fecha de vencimiento son requeridos" });

    const { data, error } = await supabase
      .from("cuentas_cobrar")
      .insert([{
        cliente_id:        cliente_id || null,
        factura_id:        factura_id || null,
        descripcion,
        monto_original:    Number(monto_original),
        monto_pagado:      0,
        fecha_emision:     fecha_emision || new Date().toISOString().slice(0, 10),
        fecha_vencimiento,
        estado:            "PENDIENTE",
        notas:             notas || null,
        created_by:        created_by || "Sistema",
      }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contabilidad/cuentas-cobrar/:id/pago — registrar pago
app.post("/api/contabilidad/cuentas-cobrar/:id/pago", async (req, res) => {
  try {
    const { id } = req.params;
    const { monto, fecha, metodo, referencia, notas, usuario } = req.body;

    if (!monto || Number(monto) <= 0)
      return res.status(400).json({ error: "Monto inválido" });

    // Leer saldo actual
    const { data: cuenta } = await supabase
      .from("cuentas_cobrar").select("*").eq("id", id).single();
    if (!cuenta) return res.status(404).json({ error: "Cuenta no encontrada" });

    const saldoActual = Number(cuenta.monto_original) - Number(cuenta.monto_pagado);
    if (Number(monto) > saldoActual + 0.01)
      return res.status(400).json({ error: `Monto excede el saldo. Saldo: RD$ ${saldoActual.toFixed(2)}` });

    // Registrar pago
    const { data: pago } = await supabase
      .from("pagos_cobrar")
      .insert([{
        cuenta_id:  Number(id),
        monto:      Number(monto),
        fecha:      fecha || new Date().toISOString().slice(0, 10),
        metodo:     metodo || "EFECTIVO",
        referencia: referencia || null,
        notas:      notas || null,
        usuario:    usuario || "Sistema",
      }])
      .select()
      .single();

    // Actualizar monto_pagado y estado
    const nuevoMontoPagado = Number(cuenta.monto_pagado) + Number(monto);
    const nuevoEstado = nuevoMontoPagado >= Number(cuenta.monto_original) - 0.01
      ? "PAGADO"
      : "PARCIAL";

    await supabase.from("cuentas_cobrar")
      .update({
        monto_pagado: nuevoMontoPagado,
        estado: nuevoEstado,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    // Si fue pago total, registrar en caja_movimientos
    if (nuevoEstado === "PAGADO") {
      await supabase.from("caja_movimientos").insert([{
        tipo:       "INGRESO",
        concepto:   `Cobro cuenta — ${cuenta.descripcion}`,
        monto:      Number(monto),
        metodo_pago: metodo || "EFECTIVO",
        created_at: new Date(),
      }]);
    }

    res.json({ pago, nuevo_estado: nuevoEstado, saldo_restante: Number(cuenta.monto_original) - nuevoMontoPagado });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/contabilidad/cuentas-cobrar/:id
app.patch("/api/contabilidad/cuentas-cobrar/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cuentas_cobrar")
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Patch DIAGNÓSTICOS: agregar auto-creación de mantenimiento ───────────────
// (Override del endpoint ya existente — se añade llamada al helper)
app.patch("/diagnosticos/:id/completar-con-mantenimiento", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("diagnosticos").update(req.body).eq("id", id).select();
    if (error) return res.json({ error: error.message });

    if (req.body.estado === "FACTURADO" || req.body.estado === "COMPLETADO") {
      crearHistorialDesdeDiagnostico(Number(id)).catch(console.error);
      crearMantenimientoDesdeDiagnostico(Number(id)).catch(console.error);
    }
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// 📄 COTIZACIONES
// =====================================================

app.get("/cotizaciones", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cotizaciones")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/cotizaciones", async (req, res) => {
  try {
    const vencimiento = new Date(); vencimiento.setDate(vencimiento.getDate() + 15);

    const { cliente_id, cliente_nombre, cliente_rnc, vehiculo_id, vehiculo_info,
            items, subtotal, itbis, total, ncf_tipo, notas, created_by } = req.body;

    // Insertar sin número primero para obtener el id SERIAL real
    const { data, error } = await supabase.from("cotizaciones").insert([{
      cliente_id: cliente_id || null, cliente_nombre, cliente_rnc,
      vehiculo_id: vehiculo_id || null, vehiculo_info,
      items: items || [], subtotal, itbis, total,
      ncf_tipo: ncf_tipo || "B02",
      valida_hasta: vencimiento.toISOString().slice(0, 10),
      estado: "PENDIENTE", notas, created_by,
    }]).select();
    if (error) return res.status(400).json({ error: error.message });

    // Generar número basado en el id real para garantizar unicidad y secuencia correcta
    const numero = `COT-${String(data[0].id).padStart(5, "0")}`;
    const { data: updated, error: updErr } = await supabase
      .from("cotizaciones")
      .update({ numero })
      .eq("id", data[0].id)
      .select();
    if (updErr) return res.status(400).json({ error: updErr.message });

    res.json(updated[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Convertir cotización a factura
app.post("/cotizaciones/:id/convertir", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: cot } = await supabase.from("cotizaciones").select("*").eq("id", id).single();
    if (!cot) return res.status(404).json({ error: "Cotización no encontrada" });
    if (cot.estado === "CONVERTIDA") return res.status(400).json({ error: "Ya fue convertida" });

    // Crear factura con los datos de la cotización
    const { metodo_pago = "EFECTIVO", dias_credito } = req.body;

    // Obtener siguiente NCF
    const { data: ncfRow } = await supabase
      .from("ncf_secuencias")
      .select("*")
      .eq("tipo", cot.ncf_tipo)
      .single();

    let ncf = null;
    if (ncfRow) {
      const siguienteNum = (ncfRow.actual || 0) + 1;
      ncf = `${cot.ncf_tipo}${String(siguienteNum).padStart(8, "0")}`;
      await supabase.from("ncf_secuencias").update({ actual: siguienteNum }).eq("tipo", cot.ncf_tipo);
    }

    // Resolver orden_id desde el diagnóstico de la cotización
    let orden_id_factura = null;
    if (cot.diagnostico_id) {
      const { data: diagForFac } = await supabase.from("diagnosticos").select("orden_id").eq("id", cot.diagnostico_id).maybeSingle();
      orden_id_factura = diagForFac?.orden_id || null;
    }

    const { data: factura, error: fErr } = await supabase.from("facturas").insert([{
      cliente_id:     cot.cliente_id,
      cliente_nombre: cot.cliente_nombre,
      cliente_rnc:    cot.cliente_rnc,
      vehiculo_id:    cot.vehiculo_id,
      vehiculo_info:  cot.vehiculo_info,
      orden_id:       orden_id_factura,
      cotizacion_id:  cot.id,
      ncf, ncf_tipo: cot.ncf_tipo,
      subtotal: cot.subtotal, itbis: cot.itbis, total: cot.total,
      metodo_pago, estado: "ACTIVA",
    }]).select();
    if (fErr) return res.status(400).json({ error: fErr.message });

    // Insertar items
    const itemsF = (cot.items || []).map(i => ({
      factura_id: factura[0].id,
      tipo: i.tipo || "servicio",
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      itbis_aplica: i.itbis_aplica,
      inventario_id: i.inventario_id || null,
    }));
    if (itemsF.length > 0) await supabase.from("factura_items").insert(itemsF);

    // Registrar en caja
    if (metodo_pago !== "CREDITO") {
      await supabase.from("caja_movimientos").insert([{
        tipo: "INGRESO", monto: cot.total,
        descripcion: `Factura convertida desde ${cot.numero}`,
        metodo: metodo_pago,
      }]);
    } else if (dias_credito) {
      const venceCred = new Date();
      venceCred.setDate(venceCred.getDate() + Number(dias_credito));
      await supabase.from("cuentas_cobrar").insert([{
        cliente_id: cot.cliente_id,
        factura_id: factura[0].id,
        descripcion: `Factura FAC-${String(factura[0].id).padStart(5,"0")} — ${cot.cliente_nombre || "Consumidor Final"}`,
        monto_original: cot.total,
        fecha_vencimiento: venceCred.toISOString().slice(0,10),
        estado: "PENDIENTE",
      }]);
    }

    // Marcar cotización como convertida
    await supabase.from("cotizaciones").update({ estado: "CONVERTIDA", factura_id: factura[0].id }).eq("id", id);

    res.json({ factura: factura[0], factura_items: itemsF });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch("/cotizaciones/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const campos = ["estado","notas"].reduce((o, k) => {
      if (req.body[k] !== undefined) o[k] = req.body[k];
      return o;
    }, {});
    const { data, error } = await supabase.from("cotizaciones").update(campos).eq("id", id).select();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// =====================================================
// 📤 CUENTAS POR PAGAR
// =====================================================

// Resumen KPI
app.get("/api/contabilidad/cuentas-pagar/resumen", async (req, res) => {
  try {
    const { data } = await supabase
      .from("cuentas_pagar")
      .select("monto_original, monto_pagado, estado, fecha_vencimiento");
    const activas  = (data || []).filter(c => c.estado !== "PAGADO" && c.estado !== "ANULADO");
    const hoy      = new Date().toISOString().slice(0, 10);
    const enSemana = new Date(); enSemana.setDate(enSemana.getDate() + 7);
    const enSemStr = enSemana.toISOString().slice(0, 10);
    const totalPorPagar   = activas.reduce((s, c) => s + (Number(c.monto_original) - Number(c.monto_pagado)), 0);
    const vencidas        = activas.filter(c => c.fecha_vencimiento < hoy).reduce((s, c) => s + (Number(c.monto_original) - Number(c.monto_pagado)), 0);
    const porVencerSemana = activas.filter(c => c.fecha_vencimiento >= hoy && c.fecha_vencimiento <= enSemStr).reduce((s, c) => s + (Number(c.monto_original) - Number(c.monto_pagado)), 0);
    res.json({ total_por_pagar: totalPorPagar, vencidas, por_vencer_semana: porVencerSemana, count: activas.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Listar con suplidor
app.get("/api/contabilidad/cuentas-pagar", async (req, res) => {
  try {
    const { estado } = req.query;
    let query = supabase
      .from("cuentas_pagar")
      .select("*")
      .order("fecha_vencimiento", { ascending: true });
    if (estado && estado !== "TODOS") query = query.eq("estado", estado);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Obtener nombres de suplidores por separado
    const { data: sData } = await supabase.from("suplidores").select("id, nombre");
    const supMap = {};
    (sData || []).forEach(s => { supMap[s.id] = s.nombre; });

    const hoy = new Date().toISOString().slice(0, 10);
    const rows = (data || []).map(c => {
      const saldo = Number(c.monto_original) - Number(c.monto_pagado);
      let est = c.estado;
      if (est === "PENDIENTE" && c.fecha_vencimiento < hoy) est = "VENCIDO";
      return { ...c, saldo, estado: est, suplidor_display: supMap[c.suplidor_id] || c.suplidor_nombre || "—" };
    });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Detalle + pagos
app.get("/api/contabilidad/cuentas-pagar/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: cuenta } = await supabase.from("cuentas_pagar").select("*").eq("id", id).single();
    const { data: pagos  } = await supabase.from("pagos_pagar").select("*").eq("cuenta_id", id).order("fecha");
    const supNombre = cuenta?.suplidor_id
      ? (await supabase.from("suplidores").select("nombre").eq("id", cuenta.suplidor_id).single()).data?.nombre
      : null;
    res.json({ cuenta: { ...cuenta, suplidor_display: supNombre || cuenta?.suplidor_nombre || "—" }, pagos: pagos || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Crear cuenta por pagar
app.post("/api/contabilidad/cuentas-pagar", async (req, res) => {
  try {
    const { suplidor_id, suplidor_nombre, descripcion, monto_original, fecha_emision, fecha_vencimiento, notas, created_by } = req.body;
    const { data, error } = await supabase.from("cuentas_pagar").insert([{
      suplidor_id: suplidor_id || null,
      suplidor_nombre: suplidor_nombre || null,
      descripcion, monto_original, fecha_emision, fecha_vencimiento, notas, created_by,
      estado: "PENDIENTE",
    }]).select();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Registrar pago
app.post("/api/contabilidad/cuentas-pagar/:id/pago", async (req, res) => {
  try {
    const { id } = req.params;
    const { monto, fecha, metodo, referencia, notas, usuario } = req.body;
    // Insertar pago
    await supabase.from("pagos_pagar").insert([{ cuenta_id: Number(id), monto: Number(monto), fecha, metodo, referencia, notas, usuario }]);
    // Actualizar monto_pagado
    const { data: cuenta } = await supabase.from("cuentas_pagar").select("monto_original, monto_pagado").eq("id", id).single();
    const nuevoTotal = Number(cuenta.monto_pagado) + Number(monto);
    const nuevoEstado = nuevoTotal >= Number(cuenta.monto_original) ? "PAGADO" : "PARCIAL";
    const { data: updated } = await supabase.from("cuentas_pagar")
      .update({ monto_pagado: nuevoTotal, estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq("id", id).select();
    res.json(updated?.[0] || { ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Actualizar estado / notas
app.patch("/api/contabilidad/cuentas-pagar/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const campos = ["estado", "notas", "fecha_vencimiento"].reduce((o, k) => {
      if (req.body[k] !== undefined) o[k] = req.body[k];
      return o;
    }, {});
    campos.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from("cuentas_pagar").update(campos).eq("id", id).select();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// =====================================================
// 📱 WHATSAPP BUSINESS API (Meta Cloud API)
// =====================================================

const WA_TOKEN    = process.env.WHATSAPP_TOKEN    || "";
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_ID || "";
const WA_VERIFY   = process.env.WHATSAPP_VERIFY_TOKEN || "solido_auto_wa_verify";

/**
 * Normaliza un número de teléfono dominicano al formato internacional E.164
 * Entrada: "849-569-2027" | "8495692027" | "18495692027" → "18495692027"
 */
function normalizarTelefono(tel) {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;          // 809xxxxxxx → 1809xxxxxxx
  if (digits.length === 11 && digits.startsWith("1")) return digits; // ya tiene código país
  if (digits.length === 12 && digits.startsWith("1")) return digits;
  if (digits.length >= 10) return `1${digits.slice(-10)}`; // fallback
  return null;
}

/**
 * Envía un mensaje de WhatsApp usando la Cloud API de Meta.
 * @param {string} telefono - número del destinatario (cualquier formato dominicano)
 * @param {string} mensaje  - texto a enviar (soporta emojis y saltos de línea)
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
async function enviarWhatsApp(telefono, mensaje) {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    console.warn("⚠️ WhatsApp no configurado (WHATSAPP_TOKEN o WHATSAPP_PHONE_ID faltante)");
    return { ok: false, error: "WhatsApp no configurado" };
  }
  const to = normalizarTelefono(telefono);
  if (!to) return { ok: false, error: `Teléfono inválido: ${telefono}` };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WA_TOKEN}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: mensaje },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      console.error("❌ WhatsApp API error:", JSON.stringify(data));
      return { ok: false, error: data?.error?.message || "Error de API" };
    }
    console.log(`✅ WhatsApp enviado a ${to} — msg_id: ${data?.messages?.[0]?.id}`);
    return { ok: true };
  } catch (e) {
    console.error("❌ WhatsApp fetch error:", e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Obtiene config de WhatsApp desde la tabla config_sistema.
 * Retorna { habilitado, numero } — cacheable por llamada.
 */
async function waConfig() {
  const { data } = await supabase
    .from("config_sistema")
    .select("clave, valor")
    .in("clave", ["notif_whatsapp", "whatsapp_numero"])
    .catch(() => ({ data: [] }));
  const map = Object.fromEntries((data || []).map(r => [r.clave, cfgVal(r)]));
  return {
    habilitado: map.notif_whatsapp === "true",
    numero:     map.whatsapp_numero || "",
  };
}

/**
 * Envía notificación WhatsApp al cliente de una orden si las notificaciones están activas.
 * Obtiene el teléfono del cliente desde la BD.
 * @param {number} ordenId
 * @param {string} mensaje
 */
async function notificarClienteWA(ordenId, mensaje) {
  const cfg = await waConfig();
  if (!cfg.habilitado) return;

  const { data: orden } = await supabase
    .from("ordenes_trabajo")
    .select("cliente_id, numero_orden, vehiculos(marca, modelo, placa)")
    .eq("id", ordenId)
    .maybeSingle();
  if (!orden) return;

  const { data: cliente } = await supabase
    .from("clientes")
    .select("nombre, telefono")
    .eq("id", orden.cliente_id)
    .maybeSingle();
  if (!cliente?.telefono) return;

  const vehiculo = orden.vehiculos;
  const infoVeh  = vehiculo ? `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.placa})` : "su vehículo";
  const textoFinal = mensaje
    .replace("{cliente}", cliente.nombre || "Cliente")
    .replace("{vehiculo}", infoVeh)
    .replace("{orden}", orden.numero_orden || String(ordenId));

  await enviarWhatsApp(cliente.telefono, textoFinal);
}

// Mensajes por estado
const WA_MENSAJES = {
  DIAGNOSTICO:          "🔧 Hola {cliente}, su {vehiculo} ya está en diagnóstico. Le avisaremos cuando tengamos novedades. — Sólido Auto Servicio",
  ESPERANDO_APROBACION: "📋 Hola {cliente}, tenemos lista la cotización de su {vehiculo} (Orden {orden}). Por favor contáctenos para aprobar la reparación. 📞 849-569-2027 — Sólido Auto Servicio",
  REPARACION:           "⚙️ Hola {cliente}, iniciamos la reparación de su {vehiculo}. Le notificaremos cuando esté listo. — Sólido Auto Servicio",
  LISTO:                "✅ ¡Hola {cliente}! Su {vehiculo} está LISTO para retirar. 🎉 Pase cuando guste. Horario: Lun–Vie 8AM–6PM | Sáb 8AM–4PM. 📞 849-569-2027 — Sólido Auto Servicio",
  ENTREGADO:            "🙏 Hola {cliente}, gracias por confiar en Sólido Auto Servicio. ¡Fue un placer atenderle! Recuerde que estamos disponibles para su próximo mantenimiento. 🚗",
};

// ── GET /test-whatsapp?tel=18091234567 — prueba manual desde el panel ──────
app.get("/test-whatsapp", async (req, res) => {
  const { tel, msg } = req.query;
  if (!tel) return res.status(400).json({ error: "Falta parámetro tel" });
  const result = await enviarWhatsApp(tel, msg || "✅ Prueba de WhatsApp desde Sólido Auto Servicio. Si recibe esto, ¡la integración funciona!");
  res.json(result);
});

// ── GET /webhook/whatsapp — verificación de Meta ───────────────────────────
app.get("/webhook/whatsapp", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === WA_VERIFY) {
    console.log("✅ Webhook WhatsApp verificado");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ── POST /webhook/whatsapp — recibe mensajes entrantes (chatbot) ───────────
app.post("/webhook/whatsapp", async (req, res) => {
  res.sendStatus(200); // responder inmediatamente para evitar reintentos de Meta

  try {
    const entry   = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value   = changes?.value;
    if (!value?.messages) return;

    const msg      = value.messages[0];
    const from     = msg.from;   // número en formato E.164 sin +
    const texto    = (msg.text?.body || "").trim().toLowerCase();
    const msgId    = msg.id;
    const phoneId  = value.metadata?.phone_number_id;

    // Función helper para responder
    const responder = async (cuerpo) => {
      if (!WA_TOKEN || !phoneId) return;
      await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WA_TOKEN}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to:   from,
          type: "text",
          text: { body: cuerpo },
          context: { message_id: msgId },
        }),
      }).catch(e => console.error("❌ chatbot respuesta error:", e.message));
    };

    // Buscar cliente por teléfono (normalizado)
    const telSufijo = from.slice(-10);
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, nombre, telefono")
      .ilike("telefono", `%${telSufijo}`)
      .limit(1);
    const cliente = clientes?.[0];

    if (!cliente) {
      await responder(
        "👋 Hola, soy el asistente de *Sólido Auto Servicio*.\n\n" +
        "No encontré su número en nuestro sistema. Para consultas llámenos al 📞 *849-569-2027*.\n\n" +
        "Horario: Lun–Vie 8AM–6PM | Sáb 8AM–4PM."
      );
      return;
    }

    // Saludos / menú
    if (/^(hola|hi|buenas|buenos|buen|hey|ola|menu|menú|ayuda|help|inicio|start|0)/.test(texto)) {
      await responder(
        `👋 Hola *${cliente.nombre}*, bienvenido a *Sólido Auto Servicio*.\n\n` +
        "¿En qué le puedo ayudar?\n\n" +
        "1️⃣ *estado* — Ver estado de su vehículo\n" +
        "2️⃣ *historial* — Ver historial de servicios\n" +
        "3️⃣ *contacto* — Hablar con un agente\n\n" +
        "_Responda con el número o la palabra clave._"
      );
      return;
    }

    // Estado de la orden activa
    if (/^(1|estado|orden|veh[ií]culo|carro|auto|mi veh)/.test(texto)) {
      const { data: ordenes } = await supabase
        .from("ordenes_trabajo")
        .select("id, numero_orden, estado, created_at, vehiculos(marca, modelo, placa)")
        .eq("cliente_id", cliente.id)
        .not("estado", "in", '("ENTREGADO","CANCELADA")')
        .order("created_at", { ascending: false })
        .limit(3);

      if (!ordenes?.length) {
        const { data: ultimaOrden } = await supabase
          .from("ordenes_trabajo")
          .select("estado, vehiculos(marca, modelo), created_at")
          .eq("cliente_id", cliente.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (ultimaOrden?.[0]) {
          await responder(
            `✅ *${cliente.nombre}*, actualmente no tiene órdenes activas.\n\n` +
            `Último servicio: ${ultimaOrden[0].vehiculos?.marca} ${ultimaOrden[0].vehiculos?.modelo} — estado: *${ultimaOrden[0].estado}*\n\n` +
            `Para agendar un nuevo servicio: 📞 *849-569-2027*`
          );
        } else {
          await responder(`Hola *${cliente.nombre}*, no encontré órdenes registradas a su nombre.\nLlámenos: 📞 *849-569-2027*`);
        }
        return;
      }

      const ESTADO_LABEL = {
        RECIBIDO:             "📥 Recibido en taller",
        DIAGNOSTICO:          "🔍 En diagnóstico",
        ESPERANDO_APROBACION: "📋 Esperando su aprobación",
        REPARACION:           "⚙️ En reparación",
        CONTROL_CALIDAD:      "🔎 Control de calidad",
        LISTO:                "✅ ¡LISTO para retirar!",
        ENTREGADO:            "🏁 Entregado",
        CANCELADA:            "❌ Cancelada",
      };

      let respuesta = `🔍 *Estado de sus vehículos — ${cliente.nombre}*\n\n`;
      for (const ord of ordenes) {
        const veh = ord.vehiculos;
        respuesta += `🚗 *${veh?.marca} ${veh?.modelo}* (${veh?.placa})\n`;
        respuesta += `   Orden: ${ord.numero_orden}\n`;
        respuesta += `   Estado: *${ESTADO_LABEL[ord.estado] || ord.estado}*\n\n`;
      }
      respuesta += `📞 ¿Preguntas? Llámenos: *849-569-2027*`;
      await responder(respuesta);
      return;
    }

    // Historial
    if (/^(2|historial|servicios|anteriores|pasad)/.test(texto)) {
      const { data: historial } = await supabase
        .from("vehiculo_historial")
        .select("marca, modelo, placa, fecha_entrega, descripcion_diagnostico")
        .eq("cliente_id", cliente.id)
        .order("fecha_entrega", { ascending: false })
        .limit(5);

      if (!historial?.length) {
        await responder(`*${cliente.nombre}*, aún no hay historial de servicios registrado a su nombre.\n📞 *849-569-2027*`);
        return;
      }

      let resp = `📋 *Historial de Servicios — ${cliente.nombre}*\n\n`;
      for (const h of historial) {
        const fecha = h.fecha_entrega ? new Date(h.fecha_entrega).toLocaleDateString("es-DO") : "—";
        resp += `• ${fecha} — *${h.marca} ${h.modelo}* (${h.placa})\n`;
        if (h.descripcion_diagnostico) resp += `  _${h.descripcion_diagnostico.slice(0, 80)}_\n`;
      }
      await responder(resp);
      return;
    }

    // Contacto / agente
    if (/^(3|contacto|agente|humano|persona|hablar|llamar|tel[eé]fono)/.test(texto)) {
      await responder(
        "📞 Para hablar con nuestro equipo:\n\n" +
        "☎️ Teléfono: *849-569-2027*\n" +
        "📍 Santo Domingo, República Dominicana\n\n" +
        "⏰ *Horario de Atención*\n" +
        "Lun–Vie: 8:00 AM – 6:00 PM\n" +
        "Sáb: 8:00 AM – 4:00 PM\n" +
        "Dom: 9:00 AM – 2:00 PM"
      );
      return;
    }

    // Respuesta genérica
    await responder(
      `Hola *${cliente.nombre}* 👋\n\n` +
      "Responda con una de estas opciones:\n\n" +
      "1️⃣ *estado* — Estado de su vehículo\n" +
      "2️⃣ *historial* — Historial de servicios\n" +
      "3️⃣ *contacto* — Teléfono y horarios\n\n" +
      "📞 *849-569-2027* — Sólido Auto Servicio"
    );

  } catch (e) {
    console.error("❌ Error webhook WhatsApp:", e.message);
  }
});

// =====================================================
// 🔄 MÁQUINA DE ESTADOS — FLUJO AUTOMÁTICO DE ÓRDENES
// =====================================================

// Transiciones válidas: [estado_actual] → estados_permitidos[]
const TRANSICIONES_VALIDAS = {
  RECIBIDO:              ["DIAGNOSTICO"],
  DIAGNOSTICO:           ["ESPERANDO_APROBACION", "REPARACION", "CANCELADA"],
  ESPERANDO_APROBACION:  ["REPARACION", "CANCELADA"],
  REPARACION:            ["CONTROL_CALIDAD"],
  CONTROL_CALIDAD:       ["LISTO", "REPARACION"],   // puede devolver al técnico
  LISTO:                 ["ENTREGADO"],
  CANCELADA:             [],
  ENTREGADO:             [],
};

/**
 * transicionarEstado — cambia el estado de una orden de forma controlada
 * y deja registro en orden_trabajo_log.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
async function transicionarEstado(ordenId, nuevoEstado, { usuarioId = null, usuarioNombre = "Sistema", motivo = null, extra = {} } = {}) {
  const idNum = parseInt(ordenId, 10);
  if (isNaN(idNum)) return { ok: false, error: "ID de orden inválido" };

  // Leer orden actual
  const { data: orden, error: errLeer } = await supabase
    .from("ordenes_trabajo")
    .select("id, estado")
    .eq("id", idNum)
    .maybeSingle();

  if (errLeer) return { ok: false, error: errLeer.message };
  if (!orden)  return { ok: false, error: `Orden ${idNum} no encontrada` };

  const estadoActual = orden.estado || "RECIBIDO";

  // Validar que la transición sea permitida
  const permitidos = TRANSICIONES_VALIDAS[estadoActual] || [];
  if (!permitidos.includes(nuevoEstado)) {
    return {
      ok: false,
      error: `Transición inválida: ${estadoActual} → ${nuevoEstado}. Permitidas: ${permitidos.join(", ") || "ninguna"}`
    };
  }

  // Campos de fecha según destino
  const camposFecha = {
    DIAGNOSTICO:           { fecha_diagnostico:           new Date().toISOString() },
    ESPERANDO_APROBACION:  { fecha_esperando_aprobacion:  new Date().toISOString() },
    REPARACION:            { fecha_inicio_reparacion:     new Date().toISOString() },
    CANCELADA:             { fecha_cancelacion:           new Date().toISOString() },
    CONTROL_CALIDAD:       { fecha_control_calidad:       new Date().toISOString() },
    LISTO:                 { fecha_listo:                 new Date().toISOString() },
    ENTREGADO:             { fecha_entrega:               new Date().toISOString() },
  };

  // Actualizar estado en la orden — primero solo el campo estado (siempre existe)
  const { error: errUpdate } = await supabase
    .from("ordenes_trabajo")
    .update({ estado: nuevoEstado, ...extra })
    .eq("id", idNum);

  if (errUpdate) return { ok: false, error: errUpdate.message };

  // Intentar guardar campo de fecha (silencioso si la columna no existe aún en Supabase)
  const fechaExtra = camposFecha[nuevoEstado];
  if (fechaExtra) {
    await supabase.from("ordenes_trabajo").update(fechaExtra).eq("id", idNum).then(r => r).catch(() => {});
  }

  // Insertar en log de auditoría
  await supabase.from("orden_trabajo_log").insert([{
    orden_id:       idNum,
    estado_anterior: estadoActual,
    estado_nuevo:    nuevoEstado,
    usuario_id:      usuarioId,
    usuario_nombre:  usuarioNombre,
    motivo:          motivo,
    metadata:        extra,
    created_at:      new Date().toISOString(),
  }]).then(r => r).catch(err => console.warn("⚠️ No se pudo escribir log (¿tabla existe?):", err.message));

  // 📱 Notificación automática por WhatsApp
  if (WA_MENSAJES[nuevoEstado]) {
    notificarClienteWA(idNum, WA_MENSAJES[nuevoEstado]).catch(e =>
      console.warn("⚠️ WhatsApp notif error:", e.message)
    );
  }

  return { ok: true };
}

// ── GET /ordenes/:id — detalle completo de una orden ────────────────────────
app.get("/ordenes/:id", async (req, res) => {
  try {
    const idNum = parseInt(req.params.id, 10);
    if (isNaN(idNum)) return res.status(400).json({ error: "ID de orden inválido" });

    const { data: orden, error: ordenError } = await supabase
      .from("ordenes_trabajo")
      .select("*")
      .eq("id", idNum)
      .maybeSingle();

    if (ordenError) {
      console.error("❌ GET /ordenes/:id — error Supabase:", ordenError.message);
      return res.status(500).json({ error: ordenError.message });
    }
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });

    // Cada query es independiente — si una tabla no existe todavía, devuelve null/[] sin romper todo
    const [clienteRes, vehiculoRes, diagnosticoRes, logRes, inspeccionRes] = await Promise.all([
      supabase.from("clientes").select("*").eq("id", orden.cliente_id).maybeSingle().then(r => r).catch(() => ({ data: null })),
      supabase.from("vehiculos").select("*").eq("id", orden.vehiculo_id).maybeSingle().then(r => r).catch(() => ({ data: null })),
      supabase.from("diagnosticos").select("*").eq("orden_id", idNum).order("created_at", { ascending: false }).limit(1).maybeSingle().then(r => r).catch(() => ({ data: null })),
      supabase.from("orden_trabajo_log").select("*").eq("orden_id", idNum).order("created_at", { ascending: true }).then(r => r).catch(() => ({ data: [] })),
      supabase.from("inspeccion_vehiculo").select("*").eq("orden_id", idNum).order("created_at", { ascending: false }).limit(1).maybeSingle().then(r => r).catch(() => ({ data: null })),
    ]);

    // Avances de reparación y cotizacion (ligados al diagnóstico)
    let avances = [];
    let cotizacionOrden = null;
    if (diagnosticoRes.data?.id) {
      const [avRes, cotRes] = await Promise.all([
        supabase.from("avances_reparacion").select("*").eq("diagnostico_id", diagnosticoRes.data.id)
          .order("created_at", { ascending: true }).then(r => r).catch(() => ({ data: [] })),
        supabase.from("cotizaciones").select("*").eq("diagnostico_id", diagnosticoRes.data.id)
          .maybeSingle().then(r => r).catch(() => ({ data: null })),
      ]);
      avances        = avRes.data  || [];
      cotizacionOrden = cotRes.data || null;
    }

    // Enriquecer diagnóstico con alias, totales calculados y repuestos del inventario
    // NOTA: mano_obra/repuestos viven en cotizaciones, NO en la tabla diagnosticos
    const diagRaw = diagnosticoRes.data;
    const diagnosticoFinal = diagRaw ? (() => {
      // Desglose real viene de cotizaciones; fallback a costo_estimado como total
      const moTotal   = Number(cotizacionOrden?.mano_obra  || 0);
      const repTotal  = Number(cotizacionOrden?.repuestos  || 0);
      const totalCalc = Number(cotizacionOrden?.total || 0) || (moTotal + repTotal) || Number(diagRaw.costo_estimado || 0);
      return {
        ...diagRaw,
        avances,
        tecnico_nombre:   diagRaw.tecnico_nombre || diagRaw.usuario_nombre || "—",
        mano_obra:        moTotal,
        repuestos:        repTotal,
        total:            totalCalc,
        tiempo_estimado:  cotizacionOrden?.tiempo_estimado || null,
        // Items del inventario para que el form pueda restaurarlos
        repuestos_items:  cotizacionOrden?.items_detalle || [],
        // Aliases de compatibilidad con el frontend
        descripcion:      diagRaw.fallas_identificadas || diagRaw.tipo_servicio || "",
        hallazgos:        diagRaw.fallas_identificadas || "",
        notas:            diagRaw.observaciones || "",
      };
    })() : null;

    res.json({
      orden,
      cliente:     clienteRes.data    || null,
      vehiculo:    vehiculoRes.data   || null,
      diagnostico: diagnosticoFinal,
      log:         logRes.data        || [],
      inspeccion:  inspeccionRes.data || null,
    });
  } catch (err) {
    console.error("❌ GET /ordenes/:id — catch:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /ordenes/:id/log — historial de estados ─────────────────────────────
app.get("/ordenes/:id/log", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orden_trabajo_log")
      .select("*")
      .eq("orden_id", req.params.id)
      .order("created_at", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ordenes/:id/aprobar — cliente aprueba la reparación ───────────────
// Acepta desde DIAGNOSTICO o ESPERANDO_APROBACION → REPARACION
app.post("/ordenes/:id/aprobar", async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_id, usuario_nombre, motivo } = req.body;

    // Verificar estado actual antes de transicionar
    const { data: orden } = await supabase.from("ordenes_trabajo").select("estado").eq("id", id).single();
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });

    const estadoOrigen = orden.estado;
    if (!["DIAGNOSTICO", "ESPERANDO_APROBACION"].includes(estadoOrigen)) {
      return res.status(400).json({ error: `No se puede aprobar desde estado ${estadoOrigen}` });
    }

    const result = await transicionarEstado(Number(id), "REPARACION", {
      usuarioId: usuario_id, usuarioNombre: usuario_nombre || "Cliente",
      motivo: motivo || "Cliente aprobó la reparación",
      extra: { aprobado_por_cliente: true, fecha_aprobacion: new Date().toISOString() },
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    // Actualizar diagnóstico vinculado si existe
    await supabase.from("diagnosticos").update({ estado: "APROBADO" }).eq("orden_id", id);
    res.json({ ok: true, mensaje: "Orden pasó a REPARACIÓN" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ordenes/:id/rechazar — cliente rechaza la reparación ──────────────
// Acepta desde DIAGNOSTICO o ESPERANDO_APROBACION → CANCELADA
app.post("/ordenes/:id/rechazar", async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_id, usuario_nombre, motivo } = req.body;

    const { data: orden } = await supabase.from("ordenes_trabajo").select("estado").eq("id", id).single();
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });

    if (!["DIAGNOSTICO", "ESPERANDO_APROBACION"].includes(orden.estado)) {
      return res.status(400).json({ error: `No se puede rechazar desde estado ${orden.estado}` });
    }

    const result = await transicionarEstado(Number(id), "CANCELADA", {
      usuarioId: usuario_id, usuarioNombre: usuario_nombre || "Cliente",
      motivo: motivo || "Cliente rechazó la reparación",
      extra: { aprobado_por_cliente: false, motivo_cancelacion: motivo || "Rechazado por cliente", usuario_cancelo: usuario_nombre || null },
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    await supabase.from("diagnosticos").update({ estado: "RECHAZADO" }).eq("orden_id", id);
    res.json({ ok: true, mensaje: "Orden CANCELADA" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ordenes/:id/calidad-aprobada — pasa control de calidad → LISTO ───
app.post("/ordenes/:id/calidad-aprobada", async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_id, usuario_nombre, motivo, tecnico_qc, checklist_qc, observaciones_qc } = req.body;

    // Verificar estado actual — si ya es LISTO, responder OK sin error (idempotente)
    const { data: ordenQC } = await supabase.from("ordenes_trabajo").select("estado").eq("id", id).maybeSingle();
    if (ordenQC?.estado === "LISTO") {
      return res.json({ ok: true, mensaje: "El control de calidad ya fue aprobado — vehículo LISTO para entrega" });
    }
    if (ordenQC?.estado !== "CONTROL_CALIDAD") {
      return res.status(400).json({ error: `No se puede aprobar QC desde estado ${ordenQC?.estado || "desconocido"}. La orden debe estar en CONTROL_CALIDAD.` });
    }

    const result = await transicionarEstado(Number(id), "LISTO", {
      usuarioId: usuario_id, usuarioNombre: usuario_nombre || "Encargado",
      motivo: motivo || "Pasó control de calidad",
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    // Guardar datos del QC
    await supabase.from("ordenes_trabajo").update({
      tecnico_qc:      tecnico_qc || usuario_nombre || null,
      checklist_qc:    checklist_qc || {},
      observaciones_qc: observaciones_qc || null,
      resultado_qc:    "APROBADO",
    }).eq("id", id).then(r => r).catch(() => {});
    res.json({ ok: true, mensaje: "Vehículo LISTO para entrega" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ordenes/:id/calidad-rechazada — QC rechazado, regresa a REPARACION ─
app.post("/ordenes/:id/calidad-rechazada", async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_id, usuario_nombre, motivo, tecnico_qc, checklist_qc, observaciones_qc } = req.body;

    // Verificar que esté en CONTROL_CALIDAD antes de rechazar
    const { data: ordenQCR } = await supabase.from("ordenes_trabajo").select("estado").eq("id", id).maybeSingle();
    if (ordenQCR?.estado !== "CONTROL_CALIDAD") {
      return res.status(400).json({ error: `No se puede rechazar QC desde estado ${ordenQCR?.estado || "desconocido"}. La orden debe estar en CONTROL_CALIDAD.` });
    }

    const result = await transicionarEstado(Number(id), "REPARACION", {
      usuarioId: usuario_id, usuarioNombre: usuario_nombre || "QC",
      motivo: motivo || "Control de calidad rechazado — requiere corrección",
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    await supabase.from("ordenes_trabajo").update({
      tecnico_qc:           tecnico_qc || usuario_nombre || null,
      checklist_qc:         checklist_qc || {},
      observaciones_qc:     observaciones_qc || null,
      resultado_qc:         "RECHAZADO",
      motivo_rechazo_calidad: motivo || null,
    }).eq("id", id).then(r => r).catch(() => {});
    res.json({ ok: true, mensaje: "Control de calidad rechazado — volviendo a REPARACIÓN" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ordenes/:id/entregar — cliente paga y recibe el vehículo ──────────
app.post("/ordenes/:id/entregar", async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_id, usuario_nombre, motivo, notas_entrega, firma_entrega, usuario_entrego } = req.body;
    const result = await transicionarEstado(Number(id), "ENTREGADO", {
      usuarioId: usuario_id, usuarioNombre: usuario_nombre || "Recepcionista",
      motivo: motivo || "Vehículo entregado al cliente",
      extra: { notas_entrega: notas_entrega || null, firma_entrega: firma_entrega || null, usuario_entrego: usuario_entrego || usuario_nombre || null },
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    // Guardar campos de entrega adicionales
    await supabase.from("ordenes_trabajo").update({
      usuario_entrego: usuario_entrego || usuario_nombre || null,
      firma_entrega:   firma_entrega   || null,
      notas_entrega:   notas_entrega   || null,
    }).eq("id", id).then(r => r).catch(() => {});
    // Crear historial automático
    const { data: diag } = await supabase
      .from("diagnosticos").select("id").eq("orden_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (diag?.id) {
      crearHistorialDesdeDiagnostico(diag.id).catch(console.error);
      crearMantenimientoDesdeDiagnostico(diag.id).catch(console.error);
    }
    // Aprender compatibilidades de repuestos usados en esta orden
    registrarCompatibilidadesDeOrden(Number(id)).catch(console.error);
    res.json({ ok: true, mensaje: "Vehículo ENTREGADO — orden cerrada" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /ordenes/:id/completar-reparacion — técnico termina reparación → Control de Calidad
app.post("/ordenes/:id/completar-reparacion", async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_id, usuario_nombre, motivo } = req.body;
    const result = await transicionarEstado(Number(id), "CONTROL_CALIDAD", {
      usuarioId:     usuario_id,
      usuarioNombre: usuario_nombre || "Técnico",
      motivo:        motivo || "Reparación completada por técnico",
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true, mensaje: "Reparación completada — orden en Control de Calidad" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// 📋 INSPECCIÓN DE VEHÍCULO
// =====================================================

// POST /inspeccion — crear inspección al recibir el vehículo
app.post("/inspeccion", async (req, res) => {
  try {
    const {
      orden_id, vehiculo_id, cliente_id,
      km_entrada, nivel_combustible, condicion_general,
      zonas_danio, rayones, golpes, estado_vidrios,
      estado_llantas, estado_pintura,
      radio_pantalla, tapiceria_ok, alfombras_ok, luces_ok,
      bocina_ok, espejos_ok, gato_ok, llanta_repuesto_ok,
      documentos_ok, herramientas_ok, otros_accesorios,
      fotos, firma_cliente, observaciones,
      creado_por_id, creado_por_nombre,
    } = req.body;

    if (!orden_id) return res.status(400).json({ error: "orden_id es requerido" });

    const { data, error } = await supabase
      .from("inspeccion_vehiculo")
      .insert([{
        orden_id, vehiculo_id: vehiculo_id || null, cliente_id: cliente_id || null,
        km_entrada: km_entrada ? Number(km_entrada) : null,
        nivel_combustible: nivel_combustible !== undefined ? Number(nivel_combustible) : 0,
        condicion_general: condicion_general || null,
        zonas_danio: zonas_danio || [],
        rayones: rayones || null, golpes: golpes || null,
        estado_vidrios: estado_vidrios || null,
        estado_llantas: estado_llantas || null,
        estado_pintura: estado_pintura || null,
        radio_pantalla:    Boolean(radio_pantalla),
        tapiceria_ok:      Boolean(tapiceria_ok),
        alfombras_ok:      Boolean(alfombras_ok),
        luces_ok:          Boolean(luces_ok),
        bocina_ok:         Boolean(bocina_ok),
        espejos_ok:        Boolean(espejos_ok),
        gato_ok:           Boolean(gato_ok),
        llanta_repuesto_ok: Boolean(llanta_repuesto_ok),
        documentos_ok:     Boolean(documentos_ok),
        herramientas_ok:   Boolean(herramientas_ok),
        otros_accesorios: otros_accesorios || null,
        fotos: fotos || [],
        firma_cliente: firma_cliente || null,
        observaciones: observaciones || null,
        creado_por_id: creado_por_id || null,
        creado_por_nombre: creado_por_nombre || "Sistema",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /inspeccion/orden/:ordenId — obtener inspección de una orden
app.get("/inspeccion/orden/:ordenId", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("inspeccion_vehiculo")
      .select("*")
      .eq("orden_id", req.params.ordenId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /inspeccion/:id — actualizar inspección (agregar fotos, firma, etc.)
app.patch("/inspeccion/:id", async (req, res) => {
  try {
    const campos = { ...req.body, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from("inspeccion_vehiculo")
      .update(campos)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// 🏛️ CONSULTA RNC — Padrón DGII
// =====================================================

/**
 * GET /rnc/buscar?q=texto  ← debe ir ANTES de /rnc/:rnc para que Express no confunda
 * Búsqueda por nombre o prefijo de RNC (máx 10 resultados) — para autocompletar.
 */
app.get("/rnc/buscar", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q || q.length < 2) return res.json([]);

    // Si parece un número, buscar por prefijo de RNC (usa el PRIMARY KEY índice)
    if (/^\d+$/.test(q)) {
      const { data, error } = await supabase
        .from("rnc_dgii")
        .select("rnc, razon_social, nombre_comercial, estado")
        .like("rnc", `${q}%`)
        .limit(10);
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data || []);
    }

    // Búsqueda por nombre usando full-text search con el índice GIN existente.
    // Convierte cada palabra en prefijo: "solido auto" → "solido:* & auto:*"
    // Esto es ~100x más rápido que ILIKE '%q%' en 800K filas.
    const palabras = q.split(/\s+/).filter(Boolean);
    const tsQuery  = palabras.map(p => `${p}:*`).join(" & ");

    const { data, error } = await supabase
      .from("rnc_dgii")
      .select("rnc, razon_social, nombre_comercial, estado")
      .textSearch("razon_social", tsQuery, { config: "simple" })
      .limit(10);

    if (error) {
      // Fallback a ILIKE si textSearch falla (p.ej. caracteres especiales)
      const { data: d2, error: e2 } = await supabase
        .from("rnc_dgii")
        .select("rnc, razon_social, nombre_comercial, estado")
        .ilike("razon_social", `${q}%`)
        .limit(10);
      if (e2) return res.status(500).json({ error: e2.message });
      return res.json(d2 || []);
    }

    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /rnc/:rnc
 * Consulta exacta por RNC o cédula.
 * Retorna: { rnc, razon_social, nombre_comercial, actividad, estado, fecha_constitucion, tipo }
 */
app.get("/rnc/:rnc", async (req, res) => {
  try {
    const rnc = req.params.rnc?.replace(/\D/g, "");
    if (!rnc || rnc.length < 9) return res.status(400).json({ error: "RNC inválido" });

    const { data, error } = await supabase
      .from("rnc_dgii")
      .select("rnc, razon_social, nombre_comercial, actividad, estado, fecha_constitucion, tipo")
      .eq("rnc", rnc)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data)  return res.status(404).json({ error: "RNC no encontrado en el padrón DGII" });

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Alias legacy: /dgii/rnc/:rnc — compatibilidad con facturacion/page.tsx */
app.get("/dgii/rnc/:rnc", async (req, res) => {
  try {
    const rnc = req.params.rnc?.replace(/\D/g, "");
    if (!rnc || rnc.length < 9) return res.status(400).json({ error: "RNC inválido" });
    const { data, error } = await supabase
      .from("rnc_dgii")
      .select("rnc, razon_social, nombre_comercial, actividad, estado")
      .eq("rnc", rnc)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data)  return res.status(404).json({ error: "RNC no encontrado" });
    res.json({ ...data, nombre: data.razon_social });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================
// 🔍 BÚSQUEDA GLOBAL
// =====================================================
app.get("/buscar", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ clientes: [], vehiculos: [], ordenes: [] });
    const term = `%${q.trim()}%`;
    const [cliRes, vehRes, ordRes] = await Promise.all([
      supabase.from("clientes").select("id, nombre, telefono, email, cedula_rnc").or(`nombre.ilike.${term},telefono.ilike.${term},email.ilike.${term},cedula_rnc.ilike.${term}`).limit(5),
      supabase.from("vehiculos").select("id, placa, marca, modelo, ano, color").or(`placa.ilike.${term},marca.ilike.${term},modelo.ilike.${term}`).limit(5),
      supabase.from("ordenes_trabajo").select("id, numero_orden, estado, created_at").or(`numero_orden.ilike.${term}`).limit(5),
    ]);
    res.json({
      clientes:  cliRes.data  || [],
      vehiculos: vehRes.data  || [],
      ordenes:   ordRes.data  || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// ⚙️ CONFIGURACIÓN DEL SISTEMA
// =====================================================

/** Convierte valor JSONB almacenado {v: "texto"} → string plano */
const cfgVal = (row) => {
  if (!row) return "";
  const v = row.valor;
  if (typeof v === "object" && v !== null && "v" in v) return v.v ?? "";
  if (typeof v === "string") return v;
  return String(v ?? "");
};

// GET /config → devuelve todos los pares clave/valor
app.get("/config", async (req, res) => {
  try {
    const { data, error } = await supabase.from("config_sistema").select("*").order("clave");
    if (error) return res.status(500).json({ error: error.message });
    res.json((data || []).map(r => ({
      clave: r.clave,
      valor: cfgVal(r),
      updated_at: r.updated_at,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /config → upsert array [{clave, valor}]
app.put("/config", async (req, res) => {
  try {
    const configs = req.body;
    if (!Array.isArray(configs)) return res.status(400).json({ error: "Se esperaba un array" });
    const rows = configs.map(c => ({
      clave: c.clave,
      valor: { v: c.valor ?? "" },
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("config_sistema").upsert(rows, { onConflict: "clave" });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /ncf/config → devuelve tabla ncf_config completa
app.get("/ncf/config", async (req, res) => {
  try {
    const { data, error } = await supabase.from("ncf_config").select("*").order("tipo");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =====================================================
// 📥 EXPORTACIÓN CSV
// =====================================================

const toCSV = (rows, cols) => {
  const header = cols.map(c => c.label).join(",");
  const body = rows.map(r =>
    cols.map(c => {
      const val = r[c.key] ?? "";
      const str = String(val).replace(/"/g, '""');
      return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
    }).join(",")
  ).join("\n");
  return `${header}\n${body}`;
};

// GET /export/clientes
app.get("/export/clientes", async (req, res) => {
  try {
    const { data } = await supabase.from("clientes").select("id,nombre,telefono,email,cedula,created_at").order("nombre");
    const csv = toCSV(data || [], [
      { key: "id", label: "ID" },
      { key: "nombre", label: "Nombre" },
      { key: "telefono", label: "Teléfono" },
      { key: "email", label: "Email" },
      { key: "cedula", label: "Cédula/RNC" },
      { key: "created_at", label: "Registro" },
    ]);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="clientes_${Date.now()}.csv"`);
    res.send("﻿" + csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /export/facturas
app.get("/export/facturas", async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    let q = supabase.from("facturas").select("id,ncf,ncf_tipo,total,metodo_pago,estado,created_at").order("created_at", { ascending: false });
    if (desde) q = q.gte("created_at", desde);
    if (hasta) q = q.lte("created_at", hasta + "T23:59:59");
    const { data } = await q;
    const csv = toCSV(data || [], [
      { key: "id", label: "ID" },
      { key: "ncf", label: "NCF" },
      { key: "ncf_tipo", label: "Tipo NCF" },
      { key: "total", label: "Total RD$" },
      { key: "metodo_pago", label: "Método Pago" },
      { key: "estado", label: "Estado" },
      { key: "created_at", label: "Fecha" },
    ]);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="facturas_${Date.now()}.csv"`);
    res.send("﻿" + csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /export/inventario
app.get("/export/inventario", async (req, res) => {
  try {
    const { data } = await supabase.from("inventario").select("*").order("nombre");
    const csv = toCSV(data || [], [
      { key: "codigo", label: "Código" },
      { key: "nombre", label: "Nombre" },
      { key: "categoria", label: "Categoría" },
      { key: "stock", label: "Stock" },
      { key: "stock_minimo", label: "Stock Mínimo" },
      { key: "precio_compra", label: "Precio Compra" },
      { key: "precio_venta", label: "Precio Venta" },
      { key: "proveedor", label: "Proveedor" },
    ]);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="inventario_${Date.now()}.csv"`);
    res.send("\ufeff" + csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ✉️  ASISTENTE DE CORREO — POST /asistente-correo
// ══════════════════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT_CORREO = `
Eres el asistente de correo oficial de SÓLIDO AUTO SERVICIO, un taller automotriz profesional ubicado en Santo Domingo, República Dominicana.

INFORMACIÓN DE LA EMPRESA:
- Nombre: Sólido Auto Servicio
- Teléfono: 849-569-2027 | WhatsApp: +1 (809) 712-2027
- Ubicación: Santo Domingo, República Dominicana
- Horario: Lun-Vie 7:30 AM – 6:00 PM | Sáb 8:00 AM – 2:00 PM | Dom Cerrado
- Misión: Brindar servicio de mantenimiento automotriz de calidad, con equipo de profesionales guiados por la mejora continua.
- Visión: Ser un taller reconocido por excelencia, institucionalidad y adaptación a nuevas tecnologías automotrices.

SERVICIOS:
- Diagnóstico mecánico, eléctrico y electrónico
- Reparación de motor, transmisión, suspensión, frenos
- Diagnóstico con escáner especializado
- Mantenimiento preventivo (aceite, filtros, correas, etc.)
- Control de calidad post-reparación con prueba de manejo
- Lavado y limpieza interior del vehículo

PROCESO DE SERVICIO (9 etapas principales):
1. Recepción y registro del vehículo con checklist obligatorio
2. Diagnóstico técnico completo (mecánico, eléctrico, electrónico)
3. Cotización detallada (mano de obra + repuestos + tiempo estimado)
4. Aprobación del cliente (OBLIGATORIA antes de iniciar cualquier trabajo)
5. Ejecución de la reparación con registro de avances
6. Control de calidad y prueba del vehículo
7. Limpieza y preparación para entrega
8. Facturación con comprobante fiscal (NCF dominicano)
9. Entrega con firma de conformidad del cliente

POLÍTICAS CLAVE:
- Ningún trabajo inicia sin aprobación expresa del cliente
- Todo vehículo recibe checklist de inspección firmado al ingreso
- Emitimos comprobantes fiscales (B02 consumidor final, B14 crédito fiscal)
- Los clientes pueden consultar el estado de su vehículo por placa en nuestra plataforma digital

TONO Y ESTILO:
- Profesional, cálido y cordial
- Español formal dominicano (tratar de "usted")
- Sin tecnicismos innecesarios
- Firma siempre: "Equipo de Sólido Auto Servicio"
- Incluir siempre teléfono y horario al final

INSTRUCCIONES:
1. Genera SOLO el cuerpo del correo (desde saludo hasta firma)
2. Adapta el tono según el tipo de correo
3. Para reclamos: empatía primero, luego solución concreta
4. Para cotizaciones: explicar proceso y solicitar que llamen para coordinar
5. Formato texto plano con saltos de línea (sin markdown)
`.trim();

app.post("/asistente-correo", async (req, res) => {
  try {
    const {
      correo_entrante = "",
      tipo_correo     = "general",
      nombre_cliente  = "",
      datos_orden     = null,

      tono            = "profesional",
    } = req.body;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY no configurada en el servidor" });

    const TIPOS = {
      cotizacion:  "El cliente solicita información sobre costos o una cotización de servicio.",
      estado:      "El cliente pregunta sobre el estado actual de su vehículo en reparación.",
      reclamo:     "El cliente expresa una queja o insatisfacción. Responde con empatía y propón solución concreta.",
      cita:        "El cliente solicita o confirma una cita. Indica que se coordina por teléfono y da el número.",
      seguimiento: "Correo de seguimiento post-servicio para verificar satisfacción del cliente.",
      nuevo:       "Composición de correo nuevo desde cero para contactar a un cliente.",
      general:     "Correo general — responde de manera cordial y profesional.",
    };

    let contextoOrden = "";
    if (datos_orden) {
      contextoOrden = `
DATOS DE LA ORDEN (úsalos si son relevantes):
  Placa: ${datos_orden.placa || "—"} | Vehículo: ${datos_orden.vehiculo || "—"}
  Orden: ${datos_orden.numero_orden || "—"} | Estado: ${datos_orden.estado || "—"}
  Técnico: ${datos_orden.tecnico || "—"}
  Observaciones: ${datos_orden.observaciones || "—"}`;
    }

    const userPrompt = [
      `TIPO: \${tipo_correo.toUpperCase()} — \${TIPOS[tipo_correo] || TIPOS.general}`,
      `TONO: \${tono}`,
      nombre_cliente ? `CLIENTE: \${nombre_cliente}` : "",
      contextoOrden,
      correo_entrante
        ? `CORREO ENTRANTE (responder):\n---\n\${correo_entrante}\n---`
        : "COMPONER CORREO NUEVO (sin correo entrante).",
      "\nGenera el correo de respuesta profesional en español:",
    ].filter(Boolean).join("\n");

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model:       "gpt-4o-mini",
      max_tokens:  1200,
      temperature: 0.6,
      messages: [
        { role: "system", content: SYSTEM_PROMPT_CORREO },
        { role: "user",   content: userPrompt },
      ],
    });

    const respuesta = completion.choices[0]?.message?.content?.trim() || "";
    const tokens    = completion.usage?.total_tokens || 0;

    res.json({ respuesta, tipo_correo, tokens });

  } catch (err) {
    console.error("\u274c Asistente correo:", err.message);
    res.status(500).json({ error: err.message });
  }
});


// ══════════════════════════════════════════════════════════════════════════════
// 🤖 ASISTENTE IA GENERAL — /api/ia/asistente
// ══════════════════════════════════════════════════════════════════════════════

const IA_TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_facturas",
      description: "Busca facturas por nombre de cliente, número de factura o rango de fechas.",
      parameters: {
        type: "object",
        properties: {
          cliente_nombre: { type: "string", description: "Nombre parcial o completo del cliente" },
          numero_factura:  { type: "string", description: "Número de factura" },
          fecha_desde:     { type: "string", description: "Fecha inicio YYYY-MM-DD" },
          fecha_hasta:     { type: "string", description: "Fecha fin YYYY-MM-DD" },
          limit:           { type: "number", description: "Máximo de resultados (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_ordenes",
      description: "Busca órdenes de trabajo por placa, cliente, estado o fecha.",
      parameters: {
        type: "object",
        properties: {
          placa:          { type: "string", description: "Placa del vehículo" },
          cliente_nombre: { type: "string", description: "Nombre del cliente" },
          estado:         { type: "string", description: "Estado de la orden" },
          fecha_desde:    { type: "string", description: "Fecha inicio YYYY-MM-DD" },
          fecha_hasta:    { type: "string", description: "Fecha fin YYYY-MM-DD" },
          limit:          { type: "number", description: "Máximo de resultados (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_clientes",
      description: "Busca clientes por nombre, teléfono o cédula.",
      parameters: {
        type: "object",
        properties: {
          nombre:   { type: "string", description: "Nombre parcial o completo" },
          telefono: { type: "string", description: "Teléfono del cliente" },
          cedula:   { type: "string", description: "Cédula o RNC" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_inventario",
      description: "Consulta el inventario de repuestos: stock, precio, repuestos con stock bajo.",
      parameters: {
        type: "object",
        properties: {
          nombre:      { type: "string", description: "Nombre parcial del repuesto" },
          codigo:      { type: "string", description: "Código del repuesto" },
          stock_bajo:  { type: "boolean", description: "Si true, solo repuestos con stock bajo mínimo" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cuentas_por_cobrar",
      description: "Consulta cuentas pendientes de cobro y montos adeudados.",
      parameters: {
        type: "object",
        properties: {
          cliente_nombre: { type: "string", description: "Nombre del cliente (opcional)" },
          solo_vencidas:  { type: "boolean", description: "Solo cuentas vencidas" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resumen_ventas",
      description: "Resumen de facturación de un período: total, cantidad, métodos de pago.",
      parameters: {
        type: "object",
        properties: {
          fecha_desde: { type: "string", description: "Fecha inicio YYYY-MM-DD" },
          fecha_hasta: { type: "string", description: "Fecha fin YYYY-MM-DD" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "historial_vehiculo",
      description: "Historial completo de servicios de un vehículo por su placa.",
      parameters: {
        type: "object",
        properties: {
          placa: { type: "string", description: "Placa del vehículo" },
        },
        required: ["placa"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ordenes_del_dia",
      description: "Lista todas las órdenes de trabajo de hoy o de una fecha específica.",
      parameters: {
        type: "object",
        properties: {
          fecha: { type: "string", description: "Fecha YYYY-MM-DD (default hoy)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "historial_cliente",
      description: "Historial completo de un cliente: sus vehículos, todas sus órdenes de trabajo con fechas de entrega, totales pagados y estado. Úsalo cuando pregunten por el historial o vehículo de un cliente por nombre.",
      parameters: {
        type: "object",
        properties: {
          cliente_nombre: { type: "string", description: "Nombre parcial o completo del cliente" },
        },
        required: ["cliente_nombre"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_vehiculos",
      description: "Busca vehículos por placa, marca, modelo o propietario. Devuelve información del vehículo y su dueño.",
      parameters: {
        type: "object",
        properties: {
          placa:          { type: "string", description: "Placa del vehículo (parcial o completa)" },
          marca:          { type: "string", description: "Marca del vehículo, ej: Toyota, Honda" },
          modelo:         { type: "string", description: "Modelo del vehículo" },
          cliente_nombre: { type: "string", description: "Nombre del propietario" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_suplidores",
      description: "Lista o busca suplidores/proveedores registrados. Devuelve nombre, RNC, teléfono y correo.",
      parameters: {
        type: "object",
        properties: {
          nombre: { type: "string", description: "Nombre parcial del suplidor" },
          rnc:    { type: "string", description: "RNC del suplidor" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resumen_dashboard",
      description: "Resumen general del taller: órdenes activas por estado, ingreso de hoy, stock bajo, total clientes y vehículos. Úsalo cuando pregunten '¿cómo va el taller?' o quieran un resumen rápido.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "contabilidad_resumen",
      description: "Resumen financiero: cuentas por cobrar pendientes, cuentas por pagar pendientes, facturación del mes actual y del mes anterior.",
      parameters: {
        type: "object",
        properties: {
          mes: { type: "string", description: "Mes en formato YYYY-MM (default mes actual)" },
        },
        required: [],
      },
    },
  },
];

async function ejecutarHerramientaIA(nombre, args) {
  try {
    switch (nombre) {

      case "buscar_facturas": {
        let q = supabase
          .from("facturas")
          .select("id, ncf, ncf_tipo, cliente_nombre, total, metodo_pago, estado, created_at")
          .order("created_at", { ascending: false })
          .limit(args.limit || 10);
        if (args.cliente_nombre) q = q.ilike("cliente_nombre", `%${args.cliente_nombre}%`);
        if (args.numero_factura) {
          // Buscar por NCF o por ID numérico
          const num = parseInt(args.numero_factura.replace(/\D/g, ""), 10);
          if (!isNaN(num)) q = q.eq("id", num);
          else q = q.ilike("ncf", `%${args.numero_factura}%`);
        }
        if (args.fecha_desde) q = q.gte("created_at", args.fecha_desde);
        if (args.fecha_hasta) q = q.lte("created_at", args.fecha_hasta + "T23:59:59");
        const { data, error } = await q;
        if (error) return { error: error.message };
        return { facturas: data, total_encontradas: data?.length || 0 };
      }

      case "buscar_ordenes": {
        // Buscar cliente por nombre primero si se proporcionó
        let clienteIds = null;
        if (args.cliente_nombre) {
          const { data: clis } = await supabase
            .from("clientes").select("id, nombre").ilike("nombre", `%${args.cliente_nombre}%`).limit(10);
          clienteIds = clis?.map(c => c.id) || [];
          if (clienteIds.length === 0) return { ordenes: [], total_encontradas: 0, nota: `No se encontró cliente con nombre "${args.cliente_nombre}"` };
        }
        // Buscar vehículo por placa si se proporcionó
        let vehiculoIds = null;
        if (args.placa) {
          const { data: vehs } = await supabase
            .from("vehiculos").select("id, placa, marca, modelo").ilike("placa", `%${args.placa}%`).limit(5);
          vehiculoIds = vehs?.map(v => v.id) || [];
          if (vehiculoIds.length === 0) return { ordenes: [], total_encontradas: 0, nota: `No se encontró vehículo con placa "${args.placa}"` };
        }
        let q = supabase
          .from("ordenes_trabajo")
          .select("id, numero_orden, estado, descripcion, total, cliente_id, vehiculo_id, created_at, tecnico_asignado_id, motivo_entrada")
          .order("created_at", { ascending: false })
          .limit(args.limit || 10);
        if (clienteIds)  q = q.in("cliente_id", clienteIds);
        if (vehiculoIds) q = q.in("vehiculo_id", vehiculoIds);
        if (args.estado) q = q.ilike("estado", args.estado);
        if (args.fecha_desde) q = q.gte("created_at", args.fecha_desde);
        if (args.fecha_hasta) q = q.lte("created_at", args.fecha_hasta + "T23:59:59");
        const { data: ordenes, error } = await q;
        if (error) return { error: error.message };
        // Enriquecer con nombres de clientes y vehículos
        const allClienteIds = [...new Set((ordenes || []).map(o => o.cliente_id).filter(Boolean))];
        const allVehIds     = [...new Set((ordenes || []).map(o => o.vehiculo_id).filter(Boolean))];
        const [cRes, vRes]  = await Promise.all([
          allClienteIds.length ? supabase.from("clientes").select("id, nombre, telefono").in("id", allClienteIds) : { data: [] },
          allVehIds.length     ? supabase.from("vehiculos").select("id, placa, marca, modelo, ano").in("id", allVehIds) : { data: [] },
        ]);
        const cMap = Object.fromEntries((cRes.data || []).map(c => [c.id, c]));
        const vMap = Object.fromEntries((vRes.data || []).map(v => [v.id, v]));
        const enriched = (ordenes || []).map(o => ({
          ...o,
          cliente_nombre:  cMap[o.cliente_id]?.nombre || "Sin cliente",
          cliente_telefono:cMap[o.cliente_id]?.telefono || "",
          vehiculo_info:   vMap[o.vehiculo_id] ? `${vMap[o.vehiculo_id].marca} ${vMap[o.vehiculo_id].modelo} (${vMap[o.vehiculo_id].placa})` : "Sin vehículo",
          vehiculo_placa:  vMap[o.vehiculo_id]?.placa || "",
        }));
        return { ordenes: enriched, total_encontradas: enriched.length };
      }

      case "buscar_clientes": {
        let q = supabase
          .from("clientes")
          .select("id, nombre, telefono, email, rnc, activo, created_at")
          .eq("activo", true)
          .limit(15);
        if (args.nombre)   q = q.ilike("nombre",   `%${args.nombre}%`);
        if (args.telefono) q = q.ilike("telefono",  `%${args.telefono}%`);
        if (args.cedula)   q = q.ilike("rnc",       `%${args.cedula}%`);
        const { data, error } = await q;
        if (error) return { error: error.message };
        return { clientes: data, total_encontrados: data?.length || 0 };
      }

      case "consultar_inventario": {
        const { data: allInv, error } = await supabase
          .from("inventario")
          .select("id, name, code, price, stock, min_stock, categoria")
          .order("name")
          .limit(200);
        if (error) return { error: error.message };
        let resultado = allInv || [];
        if (args.nombre) {
          // Normalizar: quitar guiones y espacios para comparación flexible
          const normalize = s => s.toLowerCase().replace(/[-\s]/g, "");
          const term = normalize(args.nombre);
          resultado = resultado.filter(r => normalize(r.name || "").includes(term) || normalize(r.code || "").includes(term));
        }
        if (args.codigo) {
          resultado = resultado.filter(r => (r.code || "").toLowerCase().includes(args.codigo.toLowerCase()));
        }
        if (args.stock_bajo) resultado = resultado.filter(r => (r.stock || 0) <= (r.min_stock || 0));
        if (resultado.length === 0) return { repuestos: [], total: 0, nota: `No se encontró ningún repuesto con ese criterio. Intenta con otro término.` };
        return {
          repuestos: resultado.slice(0, 25).map(r => ({ ...r, nombre: r.name, codigo: r.code, precio: r.price, stock_minimo: r.min_stock })),
          total: resultado.length
        };
      }

      case "cuentas_por_cobrar": {
        let q = supabase
          .from("cuentas_cobrar")
          .select("id, cliente_id, descripcion, monto_original, monto_pagado, fecha_vencimiento, estado, created_at")
          .order("fecha_vencimiento", { ascending: true })
          .limit(20);
        if (args.solo_vencidas) q = q.eq("estado", "VENCIDA");
        const { data, error } = await q;
        if (error) return { error: error.message };
        // Enriquecer con nombre de cliente
        const ids = [...new Set((data || []).map(r => r.cliente_id).filter(Boolean))];
        const { data: clis } = ids.length ? await supabase.from("clientes").select("id, nombre").in("id", ids) : { data: [] };
        const cMap = Object.fromEntries((clis || []).map(c => [c.id, c.nombre]));
        const enriched = (data || []).map(r => ({
          ...r,
          cliente_nombre:   cMap[r.cliente_id] || "Sin cliente",
          saldo_pendiente:  (Number(r.monto_original) - Number(r.monto_pagado || 0)).toFixed(2),
        }));
        if (args.cliente_nombre) {
          const filtrado = enriched.filter(r => r.cliente_nombre.toLowerCase().includes(args.cliente_nombre.toLowerCase()));
          const total = filtrado.reduce((a, r) => a + Number(r.saldo_pendiente), 0);
          return { cuentas: filtrado, total_cuentas: filtrado.length, total_pendiente_RD: total.toFixed(2) };
        }
        const total = enriched.reduce((a, r) => a + Number(r.saldo_pendiente), 0);
        return { cuentas: enriched, total_cuentas: enriched.length, total_pendiente_RD: total.toFixed(2) };
      }

      case "resumen_ventas": {
        const hoy   = new Date().toISOString().slice(0, 10);
        const desde = args.fecha_desde || hoy;
        const hasta = args.fecha_hasta || hoy;
        const { data, error } = await supabase
          .from("facturas")
          .select("total, metodo_pago, estado, created_at")
          .gte("created_at", desde)
          .lte("created_at", hasta + "T23:59:59");
        if (error) return { error: error.message };
        const totalFacturado = data?.reduce((a, r) => a + Number(r.total || 0), 0) || 0;
        const porMetodo = {};
        data?.forEach(r => { const m = r.metodo_pago || "N/A"; porMetodo[m] = (porMetodo[m] || 0) + Number(r.total || 0); });
        return { periodo: `${desde} → ${hasta}`, cantidad_facturas: data?.length || 0, total_facturado_RD: totalFacturado.toFixed(2), por_metodo_pago: porMetodo };
      }

      case "historial_vehiculo": {
        const placa = (args.placa || "").toUpperCase().trim();
        const { data: veh } = await supabase.from("vehiculos").select("id, marca, modelo, ano, color, placa, cliente_id").ilike("placa", placa).maybeSingle();
        if (!veh) return { error: `No se encontró vehículo con placa ${placa}` };
        const { data: cli } = veh.cliente_id ? await supabase.from("clientes").select("nombre, telefono").eq("id", veh.cliente_id).maybeSingle() : { data: null };
        const { data: ordenes } = await supabase
          .from("ordenes_trabajo")
          .select("id, numero_orden, estado, descripcion, total, created_at")
          .eq("vehiculo_id", veh.id)
          .order("created_at", { ascending: false })
          .limit(20);
        return {
          vehiculo: { ...veh, cliente_nombre: cli?.nombre || "Sin cliente", cliente_telefono: cli?.telefono || "" },
          historial: ordenes || [],
          total_visitas: ordenes?.length || 0,
          total_facturado_RD: (ordenes?.reduce((a, o) => a + Number(o.total || 0), 0) || 0).toFixed(2),
        };
      }

      case "ordenes_del_dia": {
        const fecha = args.fecha || new Date().toISOString().slice(0, 10);
        const { data, error } = await supabase
          .from("ordenes_trabajo")
          .select("id, numero_orden, estado, descripcion, cliente_id, vehiculo_id, total, created_at")
          .gte("created_at", fecha)
          .lte("created_at", fecha + "T23:59:59")
          .order("created_at", { ascending: false });
        if (error) return { error: error.message };
        const allCIds = [...new Set((data || []).map(o => o.cliente_id).filter(Boolean))];
        const allVIds = [...new Set((data || []).map(o => o.vehiculo_id).filter(Boolean))];
        const [cR, vR] = await Promise.all([
          allCIds.length ? supabase.from("clientes").select("id, nombre").in("id", allCIds) : { data: [] },
          allVIds.length ? supabase.from("vehiculos").select("id, placa, marca, modelo").in("id", allVIds) : { data: [] },
        ]);
        const cM = Object.fromEntries((cR.data || []).map(c => [c.id, c.nombre]));
        const vM = Object.fromEntries((vR.data || []).map(v => [v.id, `${v.marca} ${v.modelo} (${v.placa})`]));
        const porEstado = {};
        const enriched = (data || []).map(o => {
          porEstado[o.estado] = (porEstado[o.estado] || 0) + 1;
          return { ...o, cliente_nombre: cM[o.cliente_id] || "Sin cliente", vehiculo_info: vM[o.vehiculo_id] || "Sin vehículo" };
        });
        return { fecha, ordenes: enriched, total: enriched.length, por_estado: porEstado };
      }

      case "historial_cliente": {
        // 1. Encontrar cliente(s) por nombre
        const { data: clis } = await supabase.from("clientes")
          .select("id, nombre, telefono, email")
          .ilike("nombre", `%${args.cliente_nombre}%`)
          .limit(5);
        if (!clis || clis.length === 0)
          return { error: `No se encontró ningún cliente con nombre "${args.cliente_nombre}"` };

        const resultado = [];
        for (const cli of clis) {
          // 2. Vehículos del cliente
          const { data: vehs } = await supabase.from("vehiculos")
            .select("id, placa, marca, modelo, ano, color")
            .eq("cliente_id", cli.id);

          // 3. Órdenes del cliente (todas)
          const { data: ordenes } = await supabase.from("ordenes_trabajo")
            .select("id, numero_orden, estado, descripcion, motivo_entrada, total, created_at, fecha_entrega, vehiculo_id")
            .eq("cliente_id", cli.id)
            .order("created_at", { ascending: false })
            .limit(30);

          const vMap = Object.fromEntries((vehs || []).map(v => [v.id, v]));
          const ordenesEnriquecidas = (ordenes || []).map(o => ({
            ...o,
            vehiculo_info: vMap[o.vehiculo_id]
              ? `${vMap[o.vehiculo_id].marca} ${vMap[o.vehiculo_id].modelo} (${vMap[o.vehiculo_id].placa})`
              : "Sin vehículo",
            placa: vMap[o.vehiculo_id]?.placa || null,
          }));

          const totalPagado = (ordenes || []).reduce((s, o) => s + Number(o.total || 0), 0);
          const ultimaEntrega = (ordenes || []).find(o => o.fecha_entrega || o.estado === "ENTREGADO");

          resultado.push({
            cliente: { nombre: cli.nombre, telefono: cli.telefono, email: cli.email },
            vehiculos: vehs || [],
            total_ordenes: ordenes?.length || 0,
            total_pagado_RD: totalPagado.toFixed(2),
            ultima_entrega: ultimaEntrega?.fecha_entrega || null,
            ultima_entrega_estado: ultimaEntrega?.estado || null,
            ordenes: ordenesEnriquecidas,
          });
        }
        return resultado.length === 1 ? resultado[0] : { clientes_encontrados: resultado };
      }

      case "buscar_vehiculos": {
        let q = supabase
          .from("vehiculos")
          .select("id, placa, marca, modelo, ano, color, cliente_id, vin")
          .order("marca")
          .limit(20);
        if (args.placa)  q = q.ilike("placa",  `%${args.placa}%`);
        if (args.marca)  q = q.ilike("marca",  `%${args.marca}%`);
        if (args.modelo) q = q.ilike("modelo", `%${args.modelo}%`);
        const { data: vehs, error } = await q;
        if (error) return { error: error.message };
        let resultado = vehs || [];
        // Filtrar por nombre de cliente si se indicó
        if (args.cliente_nombre && resultado.length > 0) {
          const ids = [...new Set(resultado.map(v => v.cliente_id).filter(Boolean))];
          const { data: clis } = ids.length ? await supabase.from("clientes").select("id, nombre").in("id", ids) : { data: [] };
          const cMap = Object.fromEntries((clis || []).map(c => [c.id, c.nombre]));
          resultado = resultado.filter(v => (cMap[v.cliente_id] || "").toLowerCase().includes(args.cliente_nombre.toLowerCase()));
          resultado = resultado.map(v => ({ ...v, cliente_nombre: cMap[v.cliente_id] || "Sin cliente" }));
        } else if (resultado.length > 0) {
          const ids = [...new Set(resultado.map(v => v.cliente_id).filter(Boolean))];
          const { data: clis } = ids.length ? await supabase.from("clientes").select("id, nombre, telefono").in("id", ids) : { data: [] };
          const cMap = Object.fromEntries((clis || []).map(c => [c.id, c]));
          resultado = resultado.map(v => ({
            ...v,
            cliente_nombre: cMap[v.cliente_id]?.nombre || "Sin cliente",
            cliente_telefono: cMap[v.cliente_id]?.telefono || "",
          }));
        }
        return { vehiculos: resultado, total: resultado.length };
      }

      case "buscar_suplidores": {
        let q = supabase.from("suplidores").select("id, name, rnc, telefono, correo, direccion").order("name").limit(50);
        if (args.nombre) q = q.ilike("name", `%${args.nombre}%`);
        if (args.rnc)    q = q.ilike("rnc",  `%${args.rnc}%`);
        const { data, error } = await q;
        if (error) return { error: error.message };
        return { suplidores: (data || []).map(s => ({ ...s, nombre: s.name })), total: data?.length || 0 };
      }

      case "resumen_dashboard": {
        const hoyD = new Date(); hoyD.setHours(0,0,0,0);
        const [{ data: ordenes }, { data: facturasH }, { data: clientes }, { data: vehiculos }, { data: inventarioD }] = await Promise.all([
          supabase.from("ordenes_trabajo").select("estado").not("estado", "eq", "CANCELADO"),
          supabase.from("facturas").select("total").gte("created_at", hoyD.toISOString()).neq("estado", "CANCELADA"),
          supabase.from("clientes").select("id", { count: "exact", head: true }),
          supabase.from("vehiculos").select("id", { count: "exact", head: true }),
          supabase.from("inventario").select("stock, min_stock, name"),
        ]);
        const porEstado = {};
        for (const o of (ordenes || [])) porEstado[o.estado] = (porEstado[o.estado] || 0) + 1;
        const ingresoHoyD = (facturasH || []).reduce((s, f) => s + Number(f.total), 0);
        const stockBajoItems = (inventarioD || []).filter(i => Number(i.stock||0) <= Number(i.min_stock||0)).map(i => i.name);
        return {
          ordenes_por_estado: porEstado,
          total_en_taller: (ordenes || []).filter(o => o.estado !== "ENTREGADO").length,
          listos_para_entregar: porEstado["LISTO"] || 0,
          ingreso_hoy_RD: ingresoHoyD.toFixed(2),
          total_clientes: clientes?.length || 0,
          total_vehiculos: vehiculos?.length || 0,
          stock_bajo_count: stockBajoItems.length,
          stock_bajo_items: stockBajoItems.slice(0, 8),
        };
      }

      case "contabilidad_resumen": {
        const ahora = new Date();
        const mesStr = args.mes || ahora.toISOString().slice(0, 7);
        const [anio, mes] = mesStr.split("-").map(Number);
        const inicioMes  = new Date(anio, mes - 1, 1).toISOString();
        const finMes     = new Date(anio, mes, 0, 23, 59, 59).toISOString();
        const mesAntStr  = new Date(anio, mes - 2, 1).toISOString();
        const mesAntFin  = new Date(anio, mes - 1, 0, 23, 59, 59).toISOString();

        const [
          { data: facturasMes },
          { data: facturasAnt },
          { data: cuentasCobrar },
          { data: cuentasPagar },
        ] = await Promise.all([
          supabase.from("facturas").select("total, metodo_pago").gte("created_at", inicioMes).lte("created_at", finMes).neq("estado", "CANCELADA"),
          supabase.from("facturas").select("total").gte("created_at", mesAntStr).lte("created_at", mesAntFin).neq("estado", "CANCELADA"),
          supabase.from("cuentas_cobrar").select("monto_original, monto_pagado, estado, fecha_vencimiento").neq("estado", "PAGADA"),
          supabase.from("cuentas_pagar").select("monto_original, monto_pagado, estado, fecha_vencimiento").neq("estado", "PAGADA"),
        ]);

        const totalMes = (facturasMes || []).reduce((s, f) => s + Number(f.total), 0);
        const totalAnt = (facturasAnt || []).reduce((s, f) => s + Number(f.total), 0);
        const porMetodo = {};
        (facturasMes || []).forEach(f => { const m = f.metodo_pago || "N/A"; porMetodo[m] = (porMetodo[m] || 0) + Number(f.total); });

        const pendCobrar = (cuentasCobrar || []).reduce((s, c) => s + Math.max(0, Number(c.monto_original) - Number(c.monto_pagado || 0)), 0);
        const vencidasCobrar = (cuentasCobrar || []).filter(c => c.estado === "VENCIDA").length;
        const pendPagar  = (cuentasPagar  || []).reduce((s, c) => s + Math.max(0, Number(c.monto_original) - Number(c.monto_pagado || 0)), 0);
        const vencidasPagar = (cuentasPagar || []).filter(c => c.estado === "VENCIDA").length;

        const variacion = totalAnt > 0 ? (((totalMes - totalAnt) / totalAnt) * 100).toFixed(1) : null;

        return {
          mes: mesStr,
          facturacion_mes_RD: totalMes.toFixed(2),
          facturas_emitidas: facturasMes?.length || 0,
          por_metodo_pago: porMetodo,
          mes_anterior_RD: totalAnt.toFixed(2),
          variacion_pct: variacion ? `${variacion > 0 ? "+" : ""}${variacion}%` : "N/A",
          cuentas_por_cobrar: { total_pendiente_RD: pendCobrar.toFixed(2), cantidad: cuentasCobrar?.length || 0, vencidas: vencidasCobrar },
          cuentas_por_pagar:  { total_pendiente_RD: pendPagar.toFixed(2),  cantidad: cuentasPagar?.length  || 0, vencidas: vencidasPagar  },
        };
      }

      default:
        return { error: `Herramienta desconocida: ${nombre}` };
    }
  } catch (e) {
    return { error: e.message };
  }
}

app.post("/api/ia/asistente", async (req, res) => {
  try {
    const { pregunta, historial = [] } = req.body;
    if (!pregunta?.trim()) return res.status(400).json({ error: "El campo 'pregunta' es requerido." });
    if (!OAI_KEY)          return res.status(500).json({ error: "OPENAI_API_KEY no configurada." });

    const systemPrompt = `Eres el asistente interno de Sólido Auto Servicio SRL, taller automotriz en Santo Domingo, República Dominicana.
Tu función es dar respuestas rápidas y precisas al personal consultando la base de datos en tiempo real.

HERRAMIENTAS DISPONIBLES Y CUÁNDO USARLAS:
- historial_cliente: cuando pregunten por el vehículo, historial u órdenes de un cliente por nombre. ESTA ES LA HERRAMIENTA PRINCIPAL para preguntas como "el vehículo de Claudio", "cuándo entregaron el carro de Juan", "qué servicios ha traído Pedro".
- buscar_facturas: facturas, cobros, NCF, pagos
- buscar_ordenes: buscar órdenes por placa, estado o fecha (no por nombre de cliente — para eso usa historial_cliente)
- buscar_clientes: solo si necesitas teléfono, email o cédula de un cliente. Si preguntan por su historial, usa historial_cliente directamente.
- buscar_vehiculos: buscar vehículo por placa, marca o modelo
- consultar_inventario: stock de repuestos, precios, stock bajo
- buscar_suplidores: proveedores registrados
- cuentas_por_cobrar: deudas pendientes de clientes
- resumen_ventas: total facturado en un período
- historial_vehiculo: historial de un vehículo por PLACA (cuando ya tienes la placa)
- ordenes_del_dia: órdenes de hoy o de una fecha
- resumen_dashboard: estado general del taller (úsalo para "¿cómo va el taller?")
- contabilidad_resumen: facturación del mes, cuentas por cobrar/pagar

REGLAS:
1. SIEMPRE usa una herramienta — nunca respondas de memoria.
2. Para preguntas sobre cliente + vehículo/historial: llama historial_cliente de inmediato con el nombre. No llames buscar_clientes primero.
3. Puedes encadenar herramientas: si una devuelve una placa, úsala en historial_vehiculo en la siguiente ronda.
4. Si no hay resultados: "No encontré ningún registro con ese criterio."
5. Montos en formato "RD$ X,XXX.XX".
6. Responde en español dominicano, breve y directo.
7. Incluye fechas de entrega cuando estén disponibles (campo fecha_entrega o estado ENTREGADO).`;

    const mensajes = [
      { role: "system", content: systemPrompt },
      ...historial.slice(-8),
      { role: "user", content: pregunta.trim() },
    ];

    // Loop agentic: hasta 4 rondas de tool calls
    const MAX_ROUNDS = 4;
    let conversacion = [...mensajes];
    let msg = null;

    for (let ronda = 0; ronda < MAX_ROUNDS; ronda++) {
      const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OAI_KEY}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: conversacion,
          tools: IA_TOOLS,
          tool_choice: "auto",
          max_tokens: 1000,
          temperature: 0.3,
        }),
      });
      if (!oaiRes.ok) return res.status(502).json({ error: "Error al contactar OpenAI.", detalle: await oaiRes.text() });

      const oaiData = await oaiRes.json();
      msg = oaiData.choices?.[0]?.message;

      // Si no hay tool_calls, la IA ya tiene la respuesta final
      if (!msg?.tool_calls?.length) break;

      // Ejecutar todas las herramientas pedidas en paralelo
      conversacion.push(msg);
      const resultados = await Promise.all(
        msg.tool_calls.map(async (tc) => {
          let args = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
          const resultado = await ejecutarHerramientaIA(tc.function.name, args);
          return { role: "tool", tool_call_id: tc.id, content: JSON.stringify(resultado) };
        })
      );
      conversacion.push(...resultados);
    }

    res.json({ respuesta: msg?.content?.trim() || "No pude generar una respuesta. Intenta de nuevo." });
  } catch (err) {
    console.error("🤖 /api/ia/asistente error:", err.message);
    res.status(500).json({ error: "Error interno.", detalle: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 🚀 SERVIDOR
// ══════════════════════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\ud83d\udd25 SÓLIDO AUTO SERVICIO — Servidor activo en puerto \${PORT}`);
});
