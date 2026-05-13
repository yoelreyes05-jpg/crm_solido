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

// ── DIAGNÓSTICO TEMPORAL (borrar después de resolver el problema) ─────────────
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
  const { cliente_id, marca, modelo, ano, placa, color } = req.body;
  const { data, error } = await supabase.from("vehiculos").insert([{ cliente_id, marca, modelo, ano, placa, color }]).select();
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
  const campos = ["cliente_id","marca","modelo","ano","placa","color"].reduce((o, k) => {
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

    // Query 2 y 3: clientes y vehículos para armar los campos derivados
    const [{ data: cData }, { data: vData }] = await Promise.all([
      supabase.from("clientes").select("id, nombre, telefono"),
      supabase.from("vehiculos").select("id, marca, modelo, placa, ano"),
    ]);

    const clienteMap = {};
    (cData || []).forEach(c => { clienteMap[c.id] = c; });
    const vehiculoMap = {};
    (vData || []).forEach(v => { vehiculoMap[v.id] = v; });

    const fixed = (oData || []).map(o => {
      const cli = clienteMap[o.cliente_id];
      const veh = vehiculoMap[o.vehiculo_id];
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
    try {
      const ordenActualizada = await transicionarEstado(Number(id), nuevoEstado, {
        usuarioId: uid,
        usuarioNombre: usr,
        motivo: "Cambio desde kanban"
      });
      return res.json(ordenActualizada);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
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
  const { name, rnc, direccion, telefono, correo } = req.body;
  const { data, error } = await supabase.from("suplidores").insert([{ name, rnc, direccion, telefono, correo }]).select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.patch("/suplidores/:id", async (req, res) => {
  const { id } = req.params;
  const campos = ["name","rnc","direccion","telefono","correo"].reduce((o, k) => {
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
// 🔬 DIAGNÓSTICOS
// =====================================================
app.get("/diagnosticos", async (req, res) => {
  try {
    let qDiag = supabase.from("diagnosticos").select("*").order("created_at", { ascending: false });
    if (req.query.orden_id) qDiag = qDiag.eq("orden_id", parseInt(req.query.orden_id, 10));
    const { data: dData, error: dError } = await qDiag;
    if (dError) return res.json({ error: dError.message });

    const [{ data: cData }, { data: vData }] = await Promise.all([
      supabase.from("clientes").select("id, nombre"),
      supabase.from("vehiculos").select("id, marca, modelo, placa"),
    ]);
    const clienteMap = {};
    (cData || []).forEach(c => { clienteMap[c.id] = c; });
    const vehiculoMap = {};
    (vData || []).forEach(v => { vehiculoMap[v.id] = v; });

    const fixed = (dData || []).map(d => {
      const veh = vehiculoMap[d.vehiculo_id];
      return {
        ...d,
        cliente_nombre: clienteMap[d.cliente_id]?.nombre || "Sin cliente",
        vehiculo_info:  veh ? `${veh.marca} ${veh.modelo} (${veh.placa})` : "Sin vehículo",
      };
    });
    res.json(fixed);
  } catch (err) {
    res.json({ error: err.message });
  }
});

app.get("/diagnosticos/:id", async (req, res) => {
  const { id } = req.params;
  const { data: diag } = await supabase.from("diagnosticos").select("*").eq("id", id).single();
  if (!diag) return res.json({ error: "No encontrado" });
  const { data: cotizacion } = await supabase.from("cotizaciones").select("*").eq("diagnostico_id", id).single();
  const { data: avances } = await supabase.from("avances_reparacion").select("*").eq("diagnostico_id", id).order("created_at");
  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", diag.cliente_id).single();
  const { data: vehiculo } = await supabase.from("vehiculos").select("*").eq("id", diag.vehiculo_id).single();
  res.json({ diag, cotizacion, avances: avances || [], cliente, vehiculo });
});

app.post("/diagnosticos", async (req, res) => {
  const { data, error } = await supabase.from("diagnosticos")
    .insert([{ ...req.body, estado: "PENDIENTE", created_at: new Date() }])
    .select();
  if (error) return res.json({ error: error.message });

  const diag = data[0];
  const ordenId = req.body.orden_id;

  if (ordenId) {
    // Paso 1: RECIBIDO → DIAGNOSTICO (siempre al crear el diagnóstico)
    const r1 = await transicionarEstado(Number(ordenId), "DIAGNOSTICO", {
      usuarioId:     req.body.usuario_id    || null,
      usuarioNombre: req.body.usuario_nombre || "Técnico",
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

  res.json(diag);
});

app.patch("/diagnosticos/:id", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from("diagnosticos").update(req.body).eq("id", id).select();
  if (error) return res.json({ error: error.message });

  const diag = data[0];

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

  // ── Cuando el técnico agrega avance de reparación → orden ya debe estar en REPARACION ──
  // (manejado en POST /avances, pero dejamos aquí como respaldo)

  // 📚 Auto-crear historial + mantenimiento cuando el diagnóstico pasa a FACTURADO o COMPLETADO
  if (req.body.estado === "FACTURADO" || req.body.estado === "COMPLETADO") {
    crearHistorialDesdeDiagnostico(Number(id)).catch(err =>
      console.error("❌ Error creando historial automático:", err)
    );
    crearMantenimientoDesdeDiagnostico(Number(id)).catch(err =>
      console.error("❌ Error creando mantenimiento automático:", err)
    );
  }

  res.json(diag);
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

    // Cargar diagnóstico, cliente, vehículo e inspección en paralelo
    const [{ data: diag }, { data: orden }] = await Promise.all([
      supabase.from("diagnosticos").select("*").eq("id", cot.diagnostico_id).single(),
      cot.diagnostico_id
        ? supabase.from("diagnosticos").select("orden_id").eq("id", cot.diagnostico_id).single()
        : Promise.resolve({ data: null }),
    ]);

    let cliente = null, vehiculo = null, inspeccion = null;
    if (diag) {
      const [{ data: cli }, { data: veh }] = await Promise.all([
        supabase.from("clientes").select("*").eq("id", diag.cliente_id).single(),
        supabase.from("vehiculos").select("*").eq("id", diag.vehiculo_id).single(),
      ]);
      cliente  = cli;
      vehiculo = veh;

      if (diag.orden_id) {
        const { data: ins } = await supabase.from("inspeccion_vehiculo").select("*").eq("orden_id", diag.orden_id).single();
        inspeccion = ins || null;
      }
    }

    res.json({ cotizacion: cot, diagnostico: diag, cliente, vehiculo, inspeccion });
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
    await supabase.from("diagnosticos").update({ estado: "EN_REPARACION" }).eq("id", diagId).catch(() => {});
  }

  // Auto-transicionar la orden a REPARACION si está en DIAGNOSTICO o ESPERANDO_APROBACION
  const oid = ordenIdResuelto || (diagId ? (await supabase.from("diagnosticos").select("orden_id").eq("id", diagId).single()).data?.orden_id : null);
  if (oid) {
    const r = await transicionarEstado(Number(oid), "REPARACION", {
      usuarioId:     usuario_id    || null,
      usuarioNombre: tecnico_nombre || "Técnico",
      motivo: "Técnico inició reparación",
    });
    if (!r.ok) console.warn(`⚠️ Transición REPARACION orden ${oid}: ${r.error}`);
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
    const { data: ventasHoy } = await supabase.from("ventas").select("total, created_at").gte("created_at", hoy.toISOString());
    const { data: inventario } = await supabase.from("inventario").select("stock, min_stock");
    const { data: diagnosticos } = await supabase.from("diagnosticos").select("estado");

    const ingresoHoy = (ventasHoy || []).reduce((s, v) => s + Number(v.total), 0);
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
      { data: ventasHoy },
      { data: ventasSemana },
      { data: aprobaciones },
      { data: inventarioBajo },
      { data: facturas7 },
    ] = await Promise.all([
      supabase.from("ordenes_trabajo")
        .select("id, estado, total, created_at")
        .gte("created_at", hace14.toISOString()),
      supabase.from("ventas")
        .select("total")
        .gte("created_at", hoy.toISOString()),
      supabase.from("ventas")
        .select("total")
        .gte("created_at", inicioSemana.toISOString()),
      supabase.from("ordenes_trabajo")
        .select("id, estado, created_at")
        .in("estado", ["LISTO","ENTREGADO","CANCELADA"])
        .gte("created_at", hace14.toISOString()),
      supabase.from("inventario")
        .select("id, name, stock, min_stock")
        .filter("stock", "lte", "min_stock"),
      supabase.from("facturacion")
        .select("total, created_at")
        .gte("created_at", hace7.toISOString())
        .order("created_at", { ascending: false }),
    ]);

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
    const ingresoHoy    = (ventasHoy    || []).reduce((s, v) => s + Number(v.total), 0);
    const ingresoSemana = (ventasSemana || []).reduce((s, v) => s + Number(v.total), 0);
    const ordenesConTotal = (ordenes14 || []).filter(o => o.total > 0);
    const ticketPromedio  = ordenesConTotal.length > 0
      ? ordenesConTotal.reduce((s, o) => s + Number(o.total), 0) / ordenesConTotal.length
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

// Helper interno: captura y persiste el historial completo desde un diagnóstico
async function crearHistorialDesdeDiagnostico(diagnosticoId) {
  try {
    const { data: diag } = await supabase.from("diagnosticos").select("*").eq("id", diagnosticoId).single();
    if (!diag) return;

    // Verificar que no exista ya un registro para este diagnóstico
    const { data: existe } = await supabase
      .from("vehiculo_historial")
      .select("id")
      .eq("diagnostico_id", diagnosticoId)
      .single();
    if (existe) {
      console.log(`ℹ️ Historial ya existe para diagnóstico #${diagnosticoId}, omitiendo.`);
      return;
    }

    const { data: vehiculo } = await supabase.from("vehiculos").select("*").eq("id", diag.vehiculo_id).single();
    const { data: cliente }  = await supabase.from("clientes").select("*").eq("id", diag.cliente_id).single();
    const { data: cotizacion } = await supabase.from("cotizaciones").select("*").eq("diagnostico_id", diagnosticoId).single();
    const { data: avances } = await supabase.from("avances_reparacion").select("*").eq("diagnostico_id", diagnosticoId).order("created_at");
    const { data: factura } = await supabase.from("facturas").select("ncf").eq("diagnostico_id", diagnosticoId).single();

    const trabajos = (avances || [])
      .map(a => `[${new Date(a.created_at).toLocaleDateString("es-DO")}] ${a.tecnico_nombre || "Técnico"}: ${a.descripcion}`)
      .join("\n") || diag.mano_de_obra_detalle || null;

    await supabase.from("vehiculo_historial").insert([{
      vehiculo_id:           diag.vehiculo_id || null,
      placa:                 (vehiculo?.placa || "N/A").toUpperCase().trim(),
      marca:                 vehiculo?.marca || "",
      modelo:                vehiculo?.modelo || "",
      ano:                   vehiculo?.ano || null,
      color:                 vehiculo?.color || "",
      cliente_id:            diag.cliente_id || null,
      cliente_nombre:        cliente?.nombre || "Particular",
      cliente_telefono:      cliente?.telefono || "",
      diagnostico_id:        diagnosticoId,
      fecha_servicio:        new Date(),
      tipo_servicio:         diag.tipo_servicio || "",
      diagnostico_general:   diag.tipo_servicio || "",
      inspeccion_mecanica:   diag.inspeccion_mecanica || null,
      inspeccion_electrica:  diag.inspeccion_electrica || null,
      inspeccion_electronica: diag.inspeccion_electronica || null,
      codigos_falla:         diag.scanner_resultado || null,
      fallas_identificadas:  diag.fallas_identificadas || null,
      observaciones:         diag.observaciones || null,
      trabajos_realizados:   trabajos,
      costo_mano_obra:       Number(cotizacion?.mano_obra || 0),
      costo_repuestos:       Number(cotizacion?.repuestos || 0),
      costo_total:           Number(cotizacion?.total || diag.costo_estimado || 0),
      estado:                "ENTREGADO",
      tecnico_nombre:        diag.tecnico_nombre || null,
      ncf:                   factura?.ncf || null,
    }]);

    console.log(`✅ Historial guardado — Diagnóstico #${diagnosticoId} | Placa: ${vehiculo?.placa || "N/A"}`);
  } catch (err) {
    console.error("❌ crearHistorialDesdeDiagnostico:", err.message);
  }
}

// GET /vehiculo-historial — lista completa (admin)
app.get("/vehiculo-historial", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("vehiculo_historial")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
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
// Misma lógica que GET /vehiculo-historial/placa/:placa
// Usada por el endpoint HTTP y el bot de Telegram
// =====================================================
async function consultarHistorialPorPlaca(placa) {
  const placaNorm = placa.toUpperCase().replace(/\s+/g, "").trim();

  // 1. Historial cerrado (vehiculo_historial)
  const { data: histData } = await supabase
    .from("vehiculo_historial")
    .select(
      "id, placa, marca, modelo, ano, color, fecha_servicio, tipo_servicio, " +
      "diagnostico_general, inspeccion_mecanica, inspeccion_electrica, inspeccion_electronica, " +
      "codigos_falla, fallas_identificadas, observaciones, trabajos_realizados, " +
      "costo_total, costo_mano_obra, costo_repuestos, estado, tecnico_nombre, ncf, created_at"
    )
    .ilike("placa", placaNorm)
    .order("created_at", { ascending: false });

  // 2. Vehículo activo + órdenes activas
  const { data: vehiculoActivo } = await supabase
    .from("vehiculos")
    .select("id, marca, modelo, placa, ano, color, cliente_id")
    .ilike("placa", placaNorm)
    .maybeSingle();

  let ordenesActivas = [];
  if (vehiculoActivo) {
    const { data: ordenes } = await supabase
      .from("ordenes_trabajo")
      .select("id, descripcion, estado, status, created_at, updated_at, total")
      .eq("vehiculo_id", vehiculoActivo.id)
      .not("estado", "in", "(COMPLETADO,FACTURADO,ENTREGADO)")
      .order("created_at", { ascending: false });

    if (ordenes && ordenes.length > 0) {
      const { data: diag } = await supabase
        .from("diagnosticos")
        .select("tipo_servicio, observaciones, fallas_identificadas, trabajos_realizados, tecnico_nombre, estado")
        .eq("orden_id", ordenes[0].id)
        .maybeSingle();

      ordenesActivas = ordenes.map(o => ({
        id:                   `orden_${o.id}`,
        placa:                vehiculoActivo.placa,
        marca:                vehiculoActivo.marca,
        modelo:               vehiculoActivo.modelo,
        ano:                  vehiculoActivo.ano,
        color:                vehiculoActivo.color,
        estado:               o.estado || o.status || "RECIBIDO",
        tipo_servicio:        diag?.tipo_servicio || o.descripcion || "Servicio en proceso",
        observaciones:        diag?.observaciones || "",
        fallas_identificadas: diag?.fallas_identificadas || "",
        trabajos_realizados:  diag?.trabajos_realizados || "",
        costo_total:          o.total || 0,
        costo_mano_obra:      0,
        costo_repuestos:      0,
        tecnico_nombre:       diag?.tecnico_nombre || null,
        fecha_servicio:       o.created_at,
        created_at:           o.created_at,
        _activa:              true,
      }));
    }
  }

  // 3. Combinar: órdenes activas primero, luego historial cerrado
  const historial = [...ordenesActivas, ...(histData || [])];

  if (historial.length === 0) {
    if (vehiculoActivo) {
      return {
        found: true,
        vehiculo: { placa: vehiculoActivo.placa, marca: vehiculoActivo.marca, modelo: vehiculoActivo.modelo, ano: vehiculoActivo.ano, color: vehiculoActivo.color },
        ultimo_estado: "RECIBIDO",
        historial: [{
          id: `veh_${vehiculoActivo.id}`,
          placa: vehiculoActivo.placa, marca: vehiculoActivo.marca, modelo: vehiculoActivo.modelo,
          ano: vehiculoActivo.ano, color: vehiculoActivo.color,
          estado: "RECIBIDO", tipo_servicio: "Vehículo registrado",
          created_at: new Date().toISOString(), _activa: true,
        }],
      };
    }
    return { found: false, historial: [] };
  }

  const ref = historial[0];
  return {
    found: true,
    vehiculo: { placa: ref.placa, marca: ref.marca, modelo: ref.modelo, ano: ref.ano, color: ref.color },
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
- Teléfono / WhatsApp: 809-712-2027
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

REGLAS PARA RESPONDER:
- Responde siempre en español, de forma amable, breve y profesional.
- Si el cliente pregunta por el estado de su vehículo, pídele que escriba su placa (ej: A123456).
- Si preguntan por presupuestos específicos o reparaciones complejas, diles que un técnico los contactará pronto.
- No inventes precios exactos. Puedes decir que los precios varían según el vehículo y el diagnóstico.
- Si no sabes algo con certeza, sugiere llamar al 809-712-2027.
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
// Formatos soportados: A123456 | AB12345 | 1234567 | A-12-3456 | "mi placa es A123456"
function extraerPlaca(txt) {
  const limpio = txt.toUpperCase().replace(/[\s\-_]/g, "");
  // Coincidencia exacta primero (el usuario solo escribió la placa)
  if (/^[A-Z]{1,2}\d{4,7}$/.test(limpio) || /^\d{6,7}$/.test(limpio)) return limpio;
  // Buscar dentro del texto (ej: "mi placa es A123456 gracias")
  const m = txt.toUpperCase().match(/\b([A-Z]{1,2}[\s\-]?\d{4,7}|\d{6,7})\b/);
  if (m) return m[1].replace(/[\s\-]/g, "");
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
      || "Lo siento, no pude procesar tu consulta. Por favor llámanos al 809-712-2027.";
  } catch (e) {
    console.error("OpenAI error:", e.message);
    return "Lo siento, hubo un problema. Por favor llámanos al 809-712-2027.";
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

    // ── /start o saludo ────────────────────────────────────────────────────
    if (texto === "/start" || /^(hola|buenas|hey|buenos|buen dia|buen día)$/i.test(texto)) {
      await tgSend(chatId,
        `👋 ¡Hola, <b>${nombre}</b>! Soy <b>SólidoBot</b>, el asistente de Sólido Auto Servicio.\n\n` +
        `Puedo ayudarte con:\n\n` +
        `🔍 <b>Estado de tu vehículo</b>\n   → Escríbeme tu placa (ej: <code>A123456</code>)\n\n` +
        `🔩 <b>Repuestos disponibles</b>\n   → Escribe <b>repuestos</b>\n\n` +
        `☕ <b>Menú cafetería</b>\n   → Escribe <b>menú</b>\n\n` +
        `🛠️ <b>Nuestros servicios</b>\n   → Escribe <b>servicios</b>\n\n` +
        `📞 <b>Contacto y horarios</b>\n   → Escribe <b>contacto</b>\n\n` +
        `O simplemente escríbeme tu consulta y te respondo. 😊`
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
          `Si acabas de dejar tu vehículo, puede que aún estemos procesando la información.\n` +
          `Para verificar, llámanos al <b>809-712-2027</b> o escríbenos por WhatsApp.`
        );
        return;
      }

      const { vehiculo, historial } = resultado;
      const ultimo = historial[0];

      const ESTADO_INFO = {
        RECIBIDO:        { icon: "📋", label: "Recibido" },
        DIAGNOSTICO:     { icon: "🔍", label: "En Diagnóstico" },
        COTIZADO:        { icon: "📄", label: "Cotizado" },
        APROBADO:        { icon: "✅", label: "Aprobado" },
        EN_REPARACION:   { icon: "🔧", label: "En Reparación" },
        CONTROL_CALIDAD: { icon: "🔎", label: "Control de Calidad" },
        LISTO:           { icon: "🎉", label: "Listo para entrega" },
        COMPLETADO:      { icon: "✅", label: "Completado" },
        FACTURADO:       { icon: "🧾", label: "Facturado" },
        ENTREGADO:       { icon: "🏁", label: "Entregado" },
      };

      const estadoInfo = ESTADO_INFO[ultimo?.estado] || { icon: "🔧", label: (ultimo?.estado || "En proceso").replace(/_/g, " ") };

      // ── Mensaje 1: encabezado + último servicio (igual que la PWA) ────
      let msg1 = `🚗 <b>${vehiculo.marca} ${vehiculo.modelo}</b>`;
      if (vehiculo.ano)   msg1 += ` (${vehiculo.ano})`;
      if (vehiculo.color) msg1 += ` · ${vehiculo.color}`;
      msg1 += `\n🏷️ Placa: <code>${vehiculo.placa}</code>\n`;
      msg1 += `\n${estadoInfo.icon} <b>Estado: ${estadoInfo.label}</b>\n`;

      if (ultimo) {
        if (ultimo.tipo_servicio && ultimo.tipo_servicio !== "Vehículo registrado") {
          msg1 += `🔧 Servicio: ${ultimo.tipo_servicio}\n`;
        }
        const fechaUlt = ultimo.fecha_servicio
          ? new Date(ultimo.fecha_servicio).toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" })
          : null;
        if (fechaUlt)                 msg1 += `📅 Fecha: ${fechaUlt}\n`;
        if (ultimo.tecnico_nombre)    msg1 += `👨‍🔧 Técnico: ${ultimo.tecnico_nombre}\n`;
        if (ultimo.costo_total > 0)   msg1 += `💰 Total: RD$ ${Number(ultimo.costo_total).toLocaleString("es-DO", { minimumFractionDigits: 2 })}\n`;
        if (ultimo.trabajos_realizados)
          msg1 += `\n🛠️ <b>Trabajos Realizados</b>\n${ultimo.trabajos_realizados.substring(0, 400)}\n`;
        if (ultimo.fallas_identificadas)
          msg1 += `\n⚠️ <b>Fallas Identificadas</b>\n${ultimo.fallas_identificadas.substring(0, 250)}\n`;
        if (ultimo.observaciones)
          msg1 += `\n📝 <b>Observaciones</b>\n${ultimo.observaciones.substring(0, 250)}\n`;
        if (ultimo.ncf)
          msg1 += `\n🧾 NCF: ${ultimo.ncf}\n`;
        if (ultimo._activa) {
          msg1 += ultimo.estado === "LISTO"
            ? `\n🎉 <b>¡Tu vehículo está listo para entrega!</b>`
            : `\n⏳ Seguimos trabajando en tu vehículo.`;
        }
      }

      await tgSend(chatId, msg1);

      // ── Mensaje 2: timeline de historial (igual que la PWA, si hay >1 visita) ──
      if (historial.length > 1) {
        let msg2 = `📚 <b>Historial de Servicios (${historial.length} visitas)</b>\n`;
        historial.forEach((h, i) => {
          const ei = ESTADO_INFO[h.estado] || { icon: "🔧", label: (h.estado || "Completado").replace(/_/g, " ") };
          const fecha = h.fecha_servicio
            ? new Date(h.fecha_servicio).toLocaleDateString("es-DO", { year: "numeric", month: "short", day: "numeric" })
            : "—";
          msg2 += `\n<b>${i + 1}. ${h.tipo_servicio || "Servicio"}</b>  ${ei.icon} ${ei.label}\n`;
          msg2 += `   📅 ${fecha}`;
          if (h.tecnico_nombre) msg2 += ` · 👨‍🔧 ${h.tecnico_nombre}`;
          if (h.costo_total > 0)
            msg2 += `\n   💰 RD$ ${Number(h.costo_total).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`;
          msg2 += "\n";
        });
        msg2 += `\n📞 ¿Alguna pregunta? Llámanos al <b>809-712-2027</b>.`;
        await tgSend(chatId, msg2);
      } else {
        await tgSend(chatId, `📞 ¿Alguna consulta adicional? Llámanos al <b>809-712-2027</b>.`);
      }

      return;
    }

    // ── Repuestos ──────────────────────────────────────────────────────────
    if (/repuest|pieza|piezas|invent/i.test(texto)) {
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
          `Para apartar o consultar disponibilidad escríbenos al WhatsApp <b>809-712-2027</b>.`
        );
      } else {
        await tgSend(chatId,
          `🔩 En este momento no hay repuestos con stock registrado.\n` +
          `Para consultas de disponibilidad llámanos al <b>809-712-2027</b>.`
        );
      }
      return;
    }

    // ── Menú cafetería ─────────────────────────────────────────────────────
    if (/menú|menu|café|cafe|cafeter|comer|bebid|comid/i.test(texto)) {
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
        await tgSend(chatId, `☕ El menú no está disponible en este momento. Visítanos directamente o llámanos al <b>809-712-2027</b>.`);
      }
      return;
    }

    // ── Servicios ──────────────────────────────────────────────────────────
    if (/servicio|hacen|ofrecen|trabajo|reparaci|manten|diagnos/i.test(texto)) {
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
        `Para cotizaciones escríbenos al WhatsApp <b>809-712-2027</b>.`
      );
      return;
    }

    // ── Contacto y horarios ────────────────────────────────────────────────
    if (/contacto|horario|hora|abierto|abren|cierran|direcci|dónde|donde|ubicaci/i.test(texto)) {
      await tgSend(chatId,
        `📍 <b>Sólido Auto Servicio</b>\n\n` +
        `📞 Teléfono: <b>809-712-2027</b>\n` +
        `💬 WhatsApp: <a href="https://wa.me/18097122027">+1 809-712-2027</a>\n` +
        `📍 Santo Domingo, República Dominicana\n\n` +
        `⏰ <b>Horario de Atención</b>\n` +
        `Lunes – Viernes: 8:00 AM – 6:00 PM\n` +
        `Sábados:          8:00 AM – 4:00 PM\n` +
        `Domingos:         9:00 AM – 2:00 PM`
      );
      return;
    }

    // ── Escalación a humano ────────────────────────────────────────────────
    if (/hablar|persona|humano|agente|técnico|tecnico|presupuest|cotizaci|precio de|cuánto cuesta|cuanto cuesta/i.test(texto)) {
      await tgSend(chatId,
        `👨‍🔧 Entendido, <b>${nombre}</b>. Te conectaré con nuestro equipo.\n\n` +
        `📞 Llámanos: <b>809-712-2027</b>\n` +
        `💬 WhatsApp: <a href="https://wa.me/18097122027?text=Hola, necesito hablar con un técnico">Escríbenos aquí</a>\n\n` +
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

    const { data: factura, error: fErr } = await supabase.from("facturas").insert([{
      cliente_id:     cot.cliente_id,
      cliente_nombre: cot.cliente_nombre,
      cliente_rnc:    cot.cliente_rnc,
      vehiculo_id:    cot.vehiculo_id,
      vehiculo_info:  cot.vehiculo_info,
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
    await supabase.from("ordenes_trabajo").update(fechaExtra).eq("id", idNum).catch(() => {});
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
  }]).catch(err => console.warn("⚠️ No se pudo escribir log (¿tabla existe?):", err.message));

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
      supabase.from("clientes").select("*").eq("id", orden.cliente_id).maybeSingle().catch(() => ({ data: null })),
      supabase.from("vehiculos").select("*").eq("id", orden.vehiculo_id).maybeSingle().catch(() => ({ data: null })),
      supabase.from("diagnosticos").select("*").eq("orden_id", idNum).order("created_at", { ascending: false }).limit(1).maybeSingle().catch(() => ({ data: null })),
      supabase.from("orden_trabajo_log").select("*").eq("orden_id", idNum).order("created_at", { ascending: true }).catch(() => ({ data: [] })),
      supabase.from("inspeccion_vehiculo").select("*").eq("orden_id", idNum).order("created_at", { ascending: false }).limit(1).maybeSingle().catch(() => ({ data: null })),
    ]);

    // Avances de reparación (ligados al diagnóstico)
    let avances = [];
    if (diagnosticoRes.data?.id) {
      const { data: av } = await supabase
        .from("avances_reparacion")
        .select("*")
        .eq("diagnostico_id", diagnosticoRes.data.id)
        .order("created_at", { ascending: true })
        .catch(() => ({ data: [] }));
      avances = av || [];
    }

    res.json({
      orden,
      cliente:     clienteRes.data    || null,
      vehiculo:    vehiculoRes.data   || null,
      diagnostico: diagnosticoRes.data
        ? { ...diagnosticoRes.data, avances }
        : null,
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
      extra: { aprobado_por_cliente: false, motivo_cancelacion: motivo || "Rechazado por cliente" },
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
    const { usuario_id, usuario_nombre, motivo } = req.body;
    const result = await transicionarEstado(Number(id), "LISTO", {
      usuarioId: usuario_id, usuarioNombre: usuario_nombre || "Encargado",
      motivo: motivo || "Pasó control de calidad",
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true, mensaje: "Vehículo LISTO para entrega" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ordenes/:id/entregar — cliente paga y recibe el vehículo ──────────
app.post("/ordenes/:id/entregar", async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_id, usuario_nombre, motivo, notas_entrega } = req.body;
    const result = await transicionarEstado(Number(id), "ENTREGADO", {
      usuarioId: usuario_id, usuarioNombre: usuario_nombre || "Recepcionista",
      motivo: motivo || "Vehículo entregado al cliente",
      extra: { notas_entrega: notas_entrega || null },
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    // Crear historial automático
    const { data: diag } = await supabase
      .from("diagnosticos").select("id").eq("orden_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (diag?.id) {
      crearHistorialDesdeDiagnostico(diag.id).catch(console.error);
      crearMantenimientoDesdeDiagnostico(diag.id).catch(console.error);
    }
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
// 🔍 BÚSQUEDA GLOBAL
// =====================================================
app.get("/busqueda", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (q.length < 2) return res.json({ clientes: [], vehiculos: [], ordenes: [] });
    const term = `%${q}%`;

    const [cRes, vRes, oRes] = await Promise.all([
      supabase.from("clientes")
        .select("id, nombre, telefono, cedula")
        .or(`nombre.ilike.${term},telefono.ilike.${term},cedula.ilike.${term}`)
        .limit(5),
      supabase.from("vehiculos")
        .select("id, marca, modelo, ano, placa, cliente_id")
        .or(`placa.ilike.${term},marca.ilike.${term},modelo.ilike.${term}`)
        .limit(5),
      supabase.from("ordenes_trabajo")
        .select("id, numero_orden, estado, descripcion, cliente_id")
        .or(`numero_orden.ilike.${term},descripcion.ilike.${term}`)
        .order("id", { ascending: false })
        .limit(5),
    ]);

    // Mapa de clientes para armar nombres sin join
    const clienteMap = {};
    (cRes.data || []).forEach(c => { clienteMap[c.id] = c.nombre; });

    // Completar con nombres de clientes que aparecen en vehiculos u ordenes pero no en la búsqueda de clientes
    const extraIds = [
      ...(vRes.data || []).map(v => v.cliente_id),
      ...(oRes.data || []).map(o => o.cliente_id),
    ].filter(id => id && !clienteMap[id]);

    if (extraIds.length > 0) {
      const { data: extras } = await supabase.from("clientes").select("id, nombre").in("id", [...new Set(extraIds)]);
      (extras || []).forEach(c => { clienteMap[c.id] = c.nombre; });
    }

    res.json({
      clientes: cRes.data || [],
      vehiculos: (vRes.data || []).map(v => ({ ...v, cliente_nombre: clienteMap[v.cliente_id] || "" })),
      ordenes:   (oRes.data || []).map(o => ({
        ...o,
        numero_orden:   o.numero_orden || `OT-${String(o.id).padStart(4, "0")}`,
        cliente_nombre: clienteMap[o.cliente_id] || "",
      })),
    });
  } catch (err) {
    res.json({ clientes: [], vehiculos: [], ordenes: [] });
  }
});

// =====================================================
// ⚙️  PERMISOS RBAC
// =====================================================

// GET /permisos — cargar configuración de permisos guardada en Supabase
app.get("/permisos", async (req, res) => {
  try {
    const { data } = await supabase
      .from("config_sistema")
      .select("valor")
      .eq("clave", "permisos_roles")
      .maybeSingle();
    // Devuelve el objeto guardado o null (el frontend usará PERMISOS_DEFAULT)
    res.json(data?.valor ?? null);
  } catch (err) {
    res.json(null);
  }
});

// POST /permisos — guardar configuración de permisos (solo gerente debe llamar esto)
app.post("/permisos", async (req, res) => {
  try {
    const config = req.body;
    if (!config || typeof config !== "object") {
      return res.status(400).json({ error: "Payload inválido" });
    }
    const { error } = await supabase
      .from("config_sistema")
      .upsert(
        { clave: "permisos_roles", valor: config, updated_at: new Date().toISOString() },
        { onConflict: "clave" }
      );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🔥 SÓLIDO AUTO SERVICIO corriendo en puerto ${PORT}`);
});
