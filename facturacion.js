// ============================================================
// routes/facturacion.js
// Montar en app.js: app.use('/facturacion', require('./routes/facturacion'))
// ============================================================
const express = require("express");
const router  = express.Router();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── HELPERS ────────────────────────────────────────────────────────────────

/** Genera el próximo NCF y avanza la secuencia */
async function generarNCF(tipo) {
  const { data: cfg, error } = await supabase
    .from("ncf_config")
    .select("*")
    .eq("tipo", tipo)
    .single();

  if (error || !cfg) throw new Error(`NCF tipo ${tipo} no configurado`);

  const secuencia = cfg.secuencia_actual;
  const ncf = `${cfg.prefijo}${String(secuencia).padStart(8, "0")}`;

  // Calcular vencimiento (DGII: B01/B02 vencen en 2 años)
  const vence = new Date();
  vence.setFullYear(vence.getFullYear() + 2);

  // Avanzar secuencia
  await supabase
    .from("ncf_config")
    .update({ secuencia_actual: secuencia + 1 })
    .eq("tipo", tipo);

  return { ncf, ncf_vence: vence.toISOString().split("T")[0] };
}

/** Calcula totales a partir de los ítems */
function calcularTotales(items) {
  let subtotal = 0;
  let itbis    = 0;

  items.forEach((item) => {
    const linea = Number(item.cantidad) * Number(item.precio_unitario);
    subtotal   += linea;
    if (item.itbis_aplica) itbis += linea * 0.18;
  });

  return {
    subtotal: +subtotal.toFixed(2),
    itbis:    +itbis.toFixed(2),
    total:    +(subtotal + itbis).toFixed(2),
  };
}

// ── 1. BUSCAR CLIENTE (por nombre o RNC) ───────────────────────────────────
router.get("/clientes/buscar", async (req, res) => {
  const { q } = req.query; // ?q=Juan  o  ?q=101234567
  if (!q) return res.json([]);

  const { data, error } = await supabase
    .from("clientes")
    .select("id, nombre, rnc, telefono, email, direccion, tipo_cliente")
    .or(`nombre.ilike.%${q}%,rnc.ilike.%${q}%`)
    .limit(10);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── 2. ACTUALIZAR / COMPLETAR DATOS DE CLIENTE ────────────────────────────
router.put("/clientes/:id", async (req, res) => {
  const { rnc, direccion, tipo_cliente, nombre, telefono, email } = req.body;
  const { data, error } = await supabase
    .from("clientes")
    .update({ rnc, direccion, tipo_cliente, nombre, telefono, email })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── 3. CARGAR DATOS PARA PRE-LLENAR LA FACTURA ────────────────────────────
// Devuelve diagnóstico + cotización + inventario listo para el formulario
router.get("/prefill/:diagnostico_id", async (req, res) => {
  const { diagnostico_id } = req.params;

  const [diagRes, cotRes] = await Promise.all([
    supabase
      .from("diagnosticos")
      .select(`
        *,
        clientes(id, nombre, rnc, telefono, direccion, tipo_cliente),
        ordenes(id, problema)
      `)
      .eq("id", diagnostico_id)
      .single(),

    supabase
      .from("cotizaciones")
      .select("*")
      .eq("diagnostico_id", diagnostico_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
  ]);

  if (diagRes.error) return res.status(404).json({ error: "Diagnóstico no encontrado" });

  const diag = diagRes.data;
  const cot  = cotRes.data || null;

  // Construir ítems sugeridos
  const items = [];

  // Mano de obra desde diagnóstico
  if (diag.costo_estimado) {
    items.push({
      tipo:            "mano_obra",
      descripcion:     diag.mano_de_obra_detalle || "Mano de obra – " + diag.tipo_servicio,
      cantidad:        1,
      precio_unitario: Number(diag.costo_estimado),
      itbis_aplica:    false,
    });
  }

  // Si la cotización tiene mano de obra diferente
  if (cot && Number(cot.mano_obra) > 0 && !diag.costo_estimado) {
    items.push({
      tipo:            "mano_obra",
      descripcion:     "Mano de obra",
      cantidad:        1,
      precio_unitario: Number(cot.mano_obra),
      itbis_aplica:    false,
    });
  }

  res.json({
    diagnostico: diag,
    cotizacion:  cot,
    cliente:     diag.clientes,
    orden:       diag.ordenes,
    items_sugeridos: items,
  });
});

// ── 4. CREAR FACTURA ──────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const {
    cliente_id,
    diagnostico_id,
    orden_id,
    ncf_tipo,           // 'B01' | 'B02' | 'B14' | 'B15'
    metodo_pago,
    descuento,
    items,              // array de ítems
    usuario_id,
    // Datos del cliente (por si se actualiza en el momento)
    cliente_nombre,
    cliente_rnc,
    cliente_direccion,
  } = req.body;

  if (!items || items.length === 0)
    return res.status(400).json({ error: "La factura debe tener al menos un ítem" });

  try {
    // a) Generar NCF
    const { ncf, ncf_vence } = await generarNCF(ncf_tipo || "B02");

    // b) Calcular montos
    const { subtotal, itbis, total } = calcularTotales(items);
    const desc = Number(descuento || 0);

    // c) Insertar factura
    const { data: factura, error: fErr } = await supabase
      .from("facturas")
      .insert({
        ncf,
        ncf_tipo:          ncf_tipo || "B02",
        ncf_vence,
        cliente_id,
        cliente_nombre,
        cliente_rnc,
        cliente_direccion,
        diagnostico_id:    diagnostico_id || null,
        orden_id:          orden_id       || null,
        subtotal,
        descuento:         desc,
        itbis,
        total:             +(total - desc).toFixed(2),
        metodo_pago:       metodo_pago || "efectivo",
        usuario_id:        usuario_id  || null,
      })
      .select()
      .single();

    if (fErr) throw new Error(fErr.message);

    // d) Insertar ítems
    const itemsInsert = items.map((item) => ({
      factura_id:      factura.id,
      tipo:            item.tipo            || "servicio",
      descripcion:     item.descripcion,
      cantidad:        Number(item.cantidad),
      precio_unitario: Number(item.precio_unitario),
      itbis_aplica:    item.itbis_aplica    || false,
      subtotal:        +(Number(item.cantidad) * Number(item.precio_unitario)).toFixed(2),
      inventario_id:   item.inventario_id   || null,
    }));

    const { error: iErr } = await supabase
      .from("factura_items")
      .insert(itemsInsert);

    if (iErr) throw new Error(iErr.message);

    // e) Descontar stock de inventario para ítems tipo 'repuesto'
    for (const item of items) {
      if (item.tipo === "repuesto" && item.inventario_id) {
        // Leer stock actual
        const { data: part } = await supabase
          .from("inventario")
          .select("stock")
          .eq("id", item.inventario_id)
          .single();

        if (part) {
          const nuevoStock = Math.max(0, part.stock - Number(item.cantidad));
          await supabase
            .from("inventario")
            .update({ stock: nuevoStock })
            .eq("id", item.inventario_id);

          // Registrar movimiento
          await supabase.from("inventario_movimientos").insert({
            part_id:     item.inventario_id,
            tipo:        "salida",
            cantidad:    Number(item.cantidad),
            descripcion: `Factura #${factura.id} – NCF ${ncf}`,
          });
        }
      }
    }

    res.json({ ok: true, factura_id: factura.id, ncf, total: factura.total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 5. OBTENER FACTURA COMPLETA (para imprimir) ───────────────────────────
router.get("/:id", async (req, res) => {
  const { data: factura, error } = await supabase
    .from("facturas")
    .select("*, factura_items(*)")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(404).json({ error: "Factura no encontrada" });
  res.json(factura);
});

// ── 6. LISTAR FACTURAS ────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("facturas")
    .select("id, ncf, ncf_tipo, cliente_nombre, cliente_rnc, total, metodo_pago, estado, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── 7. ANULAR FACTURA ─────────────────────────────────────────────────────
router.put("/:id/anular", async (req, res) => {
  const { data, error } = await supabase
    .from("facturas")
    .update({ estado: "anulada" })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, factura: data });
});

module.exports = router;
