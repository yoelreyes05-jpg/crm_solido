import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.get("/", (req, res) => res.send("🔥 SÓLIDO AUTO SERVICIO — SISTEMA ACTIVO"));

// =====================================================
// 📌 CLIENTES
// =====================================================
app.get("/clientes", async (req, res) => {
  const { data } = await supabase.from("clientes").select("*").order("id", { ascending: false });
  res.json(data || []);
});

app.post("/clientes", async (req, res) => {
  const { nombre, telefono, email } = req.body;
  const { data, error } = await supabase.from("clientes").insert([{ nombre, telefono, email }]).select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.delete("/clientes/:id", async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) return res.json({ error: error.message });
  res.json({ ok: true });
});

app.get("/clientes/:id/historial", async (req, res) => {
  const { id } = req.params;
  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", id).single();
  const { data: vehiculos } = await supabase.from("vehiculos").select("*").eq("cliente_id", id);
  const { data: ordenes } = await supabase.from("ordenes_trabajo").select("*").eq("cliente_id", id).order("created_at", { ascending: false });
  const { data: ventas } = await supabase.from("ventas").select("*").eq("customer_name", cliente?.nombre).order("created_at", { ascending: false });
  const { data: diagnosticos } = await supabase.from("diagnosticos").select("*").eq("cliente_id", id).order("created_at", { ascending: false });
  res.json({ cliente, vehiculos: vehiculos || [], ordenes: ordenes || [], ventas: ventas || [], diagnosticos: diagnosticos || [] });
});

// =====================================================
// 🚗 VEHÍCULOS
// =====================================================
app.get("/vehiculos/catalogo", (req, res) => {
  res.json({
    Toyota: ["Corolla", "Hilux", "RAV4", "4Runner", "Venza", "Camry", "Highlander", "Yaris"],
    Honda: ["Civic", "Accord", "CR-V", "Fit"],
    Nissan: ["Sentra", "Altima", "Versa", "Tiida", "Rouge", "Qashqui" "Frontier"],
    Hyundai: ["Elantra", "Tucson", "Santa Fe", "Sonata"],
    Kia: ["Rio", "Sportage", "Sorento"],
    Ford: ["F-150", "Explorer", "Ranger"],
    Chevrolet: ["Silverado", "Tahoe", "Spark"],
    BMW: ["X5", "X3", "Serie 3"],
    Mercedes: ["C-Class", "E-Class", "GLC"],
    Volkswagen: ["Jetta", "Amarok", "Polo"],
    Jeep: ["Wrangler", "Grand Cherokee"],
    OTRO: ["Personalizado"]
  });
});

app.get("/vehiculos", async (req, res) => {
  const { data: vehiculos } = await supabase.from("vehiculos").select("*");
  const { data: clientes } = await supabase.from("clientes").select("id, nombre");
  const fixed = (vehiculos || []).map(v => ({
    ...v,
    cliente_nombre: clientes?.find(c => c.id === v.cliente_id)?.nombre || "Sin cliente"
  }));
  res.json(fixed);
});

app.post("/vehiculos", async (req, res) => {
  const { cliente_id, marca, modelo, ano, placa, color } = req.body;
  const { data, error } = await supabase.from("vehiculos").insert([{ cliente_id, marca, modelo, ano, placa, color }]).select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.delete("/vehiculos/:id", async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("vehiculos").delete().eq("id", id);
  if (error) return res.json({ error: error.message });
  res.json({ ok: true });
});

// =====================================================
// 🧾 ÓRDENES DE TRABAJO
// =====================================================
app.get("/ordenes", async (req, res) => {
  try {
    const { data: ordenes } = await supabase.from("ordenes_trabajo").select("*").order("id", { ascending: false });
    if (!ordenes) return res.json([]);
    const { data: clientes } = await supabase.from("clientes").select("id, nombre");
    const { data: vehiculos } = await supabase.from("vehiculos").select("id, marca, modelo, placa");
    const fixed = ordenes.map(o => ({
      ...o,
      estado: o.estado || o.status || "RECIBIDO",
      cliente_nombre: clientes?.find(c => c.id === o.cliente_id)?.nombre || "Sin cliente",
      vehiculo_info: (() => {
        const v = vehiculos?.find(v => v.id === o.vehiculo_id);
        return v ? `${v.marca} ${v.modelo} (${v.placa})` : "Sin vehículo";
      })()
    }));
    res.json(fixed);
  } catch (err) {
    console.log("ERROR /ordenes:", err);
    res.json([]);
  }
});

app.post("/ordenes", async (req, res) => {
  const { cliente_id, vehiculo_id, descripcion } = req.body;
  const { data, error } = await supabase.from("ordenes_trabajo")
    .insert([{ cliente_id, vehiculo_id, descripcion, estado: "RECIBIDO", status: "RECIBIDO", total: 0, created_at: new Date() }])
    .select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.patch("/ordenes/:id", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from("ordenes_trabajo").update(req.body).eq("id", id).select();
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
  const { name, code, price, stock, min_stock, supplier_id } = req.body;
  const { data, error } = await supabase.from("inventario")
    .insert([{ name, code, price: Number(price), stock: Number(stock), min_stock: Number(min_stock || 5), supplier_id: supplier_id || null }])
    .select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.put("/inventario/:id", async (req, res) => {
  const { id } = req.params;
  const { name, code, price, stock, min_stock, supplier_id } = req.body;
  const { data, error } = await supabase.from("inventario")
    .update({ name, code, price: Number(price), stock: Number(stock), min_stock: Number(min_stock || 5), supplier_id: supplier_id || null })
    .eq("id", id).select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
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
  const { name } = req.body;
  const { data, error } = await supabase.from("suplidores").insert([{ name }]).select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

// =====================================================
// 💰 VENTAS (sistema anterior — se mantiene intacto)
// =====================================================
app.get("/ventas", async (req, res) => {
  const { data } = await supabase.from("ventas").select("*").order("id", { ascending: false });
  res.json(data || []);
});

app.post("/ventas", async (req, res) => {
  const { items, method, customer_name, ncf_tipo } = req.body;
  let subtotal = 0;
  const itemsConPrecio = [];
  for (const item of items) {
    const { data: prod } = await supabase.from("inventario").select("*").eq("id", item.partId).single();
    if (prod) {
      subtotal += prod.price * item.quantity;
      itemsConPrecio.push({ partId: item.partId, quantity: item.quantity, price: prod.price });
      await supabase.from("inventario").update({ stock: prod.stock - item.quantity }).eq("id", item.partId);
    }
  }
  const itbis = subtotal * 0.18;
  const total = subtotal + itbis;
  const tipo = ncf_tipo || "B02";
  const { data: ncfData } = await supabase.from("ncf_config").select("*").eq("tipo", tipo).single();
  let ncf;
  if (ncfData) {
    const nuevo = ncfData.secuencia_actual + 1;
    await supabase.from("ncf_config").update({ secuencia_actual: nuevo }).eq("tipo", tipo);
    ncf = ncfData.prefijo + String(nuevo).padStart(8, "0");
  } else {
    ncf = tipo + Math.floor(Math.random() * 99999999).toString().padStart(8, "0");
  }
  const { data: venta, error } = await supabase.from("ventas")
    .insert([{ customer_name, method, subtotal, itbis, total, ncf, ncf_tipo: tipo, estado: "ACTIVA" }])
    .select();
  if (error) return res.json({ error: error.message });
  if (itemsConPrecio.length > 0) {
    await supabase.from("venta_items").insert(
      itemsConPrecio.map(i => ({ venta_id: venta[0].id, part_id: i.partId, quantity: i.quantity, price: i.price }))
    );
  }
  res.json(venta[0]);
});

app.get("/ventas/:id/items", async (req, res) => {
  const { id } = req.params;
  const { data: venta } = await supabase.from("ventas").select("*").eq("id", id).single();
  if (!venta) return res.json({ error: "Venta no encontrada" });
  const { data: ventaItems } = await supabase.from("venta_items").select("*").eq("venta_id", id);
  const itemsConDetalle = await Promise.all((ventaItems || []).map(async vi => {
    const { data: prod } = await supabase.from("inventario").select("name, price").eq("id", vi.part_id).single();
    return { id: vi.part_id, name: prod?.name || "Producto eliminado", price: Number(vi.price), qty: vi.quantity };
  }));
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
  const { data } = await supabase.from("cafeteria_productos").select("*").order("id");
  res.json(data || []);
});

app.post("/cafeteria/productos", async (req, res) => {
  const { nombre, precio, categoria, stock } = req.body;
  const { data, error } = await supabase.from("cafeteria_productos")
    .insert([{ nombre, precio: Number(precio), categoria: categoria || "General", stock: Number(stock || 0) }])
    .select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
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
  const { data: venta, error } = await supabase.from("cafeteria_ventas")
    .insert([{ total: Number(total), metodo_pago, ncf, ncf_tipo: tipo, created_at: new Date() }])
    .select();
  if (error) return res.json({ error: error.message });
  for (const item of items) {
    await supabase.from("cafeteria_detalle").insert([{ venta_id: venta[0].id, producto_id: item.id, cantidad: item.qty, precio: item.precio }]);
    const { data: prod } = await supabase.from("cafeteria_productos").select("stock").eq("id", item.id).single();
    if (prod) await supabase.from("cafeteria_productos").update({ stock: prod.stock - item.qty }).eq("id", item.id);
  }
  res.json({ ...venta[0], ncf });
});

// =====================================================
// 🔬 DIAGNÓSTICOS
// =====================================================
app.get("/diagnosticos", async (req, res) => {
  const { data } = await supabase.from("diagnosticos").select("*").order("created_at", { ascending: false });
  if (!data) return res.json([]);
  const { data: clientes } = await supabase.from("clientes").select("id, nombre");
  const { data: vehiculos } = await supabase.from("vehiculos").select("id, marca, modelo, placa");
  const fixed = data.map(d => ({
    ...d,
    cliente_nombre: clientes?.find(c => c.id === d.cliente_id)?.nombre || "Sin cliente",
    vehiculo_info: (() => {
      const v = vehiculos?.find(v => v.id === d.vehiculo_id);
      return v ? `${v.marca} ${v.modelo} (${v.placa})` : "Sin vehículo";
    })()
  }));
  res.json(fixed);
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
    .insert([{ ...req.body, estado: "PENDIENTE", created_at: new Date() }]).select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.patch("/diagnosticos/:id", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from("diagnosticos").update(req.body).eq("id", id).select();
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

// =====================================================
// 💬 COTIZACIONES
// ✅ FIXES:
//   1. totalCalculado camelCase consistente
//   2. mano_de_obra_detalle incluido en UPDATE
//   3. costo_estimado SIEMPRE se actualiza en diagnosticos
// =====================================================
app.post("/cotizaciones", async (req, res) => {
  const {
    diagnostico_id,
    mano_obra,
    repuestos,
    tiempo_estimado,
    mano_de_obra_detalle,
    notas
  } = req.body;

  // ✅ FIX 1: camelCase consistente, nunca undefined
  const totalCalculado = Number(mano_obra || 0) + Number(repuestos || 0);

  const { data: exist } = await supabase
    .from("cotizaciones")
    .select("id")
    .eq("diagnostico_id", diagnostico_id)
    .single();

  let result;
  if (exist) {
    // ✅ FIX 2: mano_de_obra_detalle incluido en UPDATE
    const { data, error } = await supabase
      .from("cotizaciones")
      .update({
        mano_obra:            Number(mano_obra  || 0),
        repuestos:            Number(repuestos  || 0),
        total:                totalCalculado,
        tiempo_estimado:      tiempo_estimado   || null,
        notas:                notas             || null,
        mano_de_obra_detalle: mano_de_obra_detalle || null
      })
      .eq("diagnostico_id", diagnostico_id)
      .select();
    if (error) console.error("Error UPDATE cotizacion:", error.message);
    result = data?.[0];
  } else {
    const { data, error } = await supabase
      .from("cotizaciones")
      .insert([{
        diagnostico_id,
        mano_obra:            Number(mano_obra  || 0),
        repuestos:            Number(repuestos  || 0),
        total:                totalCalculado,
        tiempo_estimado:      tiempo_estimado   || null,
        notas:                notas             || null,
        mano_de_obra_detalle: mano_de_obra_detalle || null
      }])
      .select();
    if (error) console.error("Error INSERT cotizacion:", error.message);
    result = data?.[0];
  }

  // ✅ FIX 3: actualizar diagnostico SIEMPRE (con o sin detalle de texto)
  const updateDiag = {
    costo_estimado: totalCalculado,
    estado: "COTIZADO"
  };
  if (mano_de_obra_detalle !== undefined) {
    updateDiag.mano_de_obra_detalle = mano_de_obra_detalle || null;
  }

  const { error: errDiag } = await supabase
    .from("diagnosticos")
    .update(updateDiag)
    .eq("id", diagnostico_id);

  if (errDiag) console.error("Error UPDATE diagnostico costo_estimado:", errDiag.message);

  res.json(result || { ok: true, total: totalCalculado });
});

app.patch("/cotizaciones/:id/aprobar", async (req, res) => {
  const { id } = req.params;
  const { firma_cliente } = req.body;
  const { data } = await supabase
    .from("cotizaciones")
    .update({ aprobado: true, aprobado_at: new Date(), firma_cliente })
    .eq("id", id)
    .select();
  if (data?.[0]) {
    await supabase.from("diagnosticos").update({ estado: "APROBADO" }).eq("id", data[0].diagnostico_id);
  }
  res.json(data?.[0]);
});

// =====================================================
// ⚙️ AVANCES DE REPARACIÓN
// =====================================================
app.post("/avances", async (req, res) => {
  const { diagnostico_id, descripcion, tecnico_nombre } = req.body;
  const { data, error } = await supabase.from("avances_reparacion")
    .insert([{ diagnostico_id, descripcion, tecnico_nombre, created_at: new Date() }])
    .select();
  if (error) return res.json({ error: error.message });
  await supabase.from("diagnosticos").update({ estado: "EN_REPARACION" }).eq("id", diagnostico_id);
  res.json(data[0]);
});

// =====================================================
// 📊 DASHBOARD
// =====================================================
app.get("/dashboard/stats", async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const { data: ordenes }      = await supabase.from("ordenes_trabajo").select("estado, created_at");
    const { data: clientes }     = await supabase.from("clientes").select("id");
    const { data: vehiculos }    = await supabase.from("vehiculos").select("id");
    const { data: ventasHoy }    = await supabase.from("ventas").select("total, created_at").gte("created_at", hoy.toISOString());
    const { data: facturasHoy }  = await supabase.from("facturas").select("total, created_at").gte("created_at", hoy.toISOString()).eq("estado", "ACTIVA");
    const { data: inventario }   = await supabase.from("inventario").select("stock, min_stock");
    const { data: diagnosticos } = await supabase.from("diagnosticos").select("estado");

    const ingresoVentas   = (ventasHoy   || []).reduce((s, v) => s + Number(v.total), 0);
    const ingresoFacturas = (facturasHoy || []).reduce((s, f) => s + Number(f.total), 0);
    const ingresoHoy  = ingresoVentas + ingresoFacturas;
    const stockBajo   = (inventario || []).filter(i => i.stock <= i.min_stock).length;

    res.json({
      ordenes: {
        total:           ordenes?.length || 0,
        recibido:        ordenes?.filter(o => o.estado === "RECIBIDO").length        || 0,
        diagnostico:     ordenes?.filter(o => o.estado === "DIAGNOSTICO").length     || 0,
        reparacion:      ordenes?.filter(o => o.estado === "REPARACION").length      || 0,
        control_calidad: ordenes?.filter(o => o.estado === "CONTROL_CALIDAD").length || 0,
        listo:           ordenes?.filter(o => o.estado === "LISTO").length           || 0,
        entregado:       ordenes?.filter(o => o.estado === "ENTREGADO").length       || 0,
      },
      clientes:  clientes?.length  || 0,
      vehiculos: vehiculos?.length || 0,
      ingresoHoy,
      stockBajo,
      diagnosticos: {
        total:         diagnosticos?.length || 0,
        pendientes:    diagnosticos?.filter(d => d.estado === "PENDIENTE").length     || 0,
        en_reparacion: diagnosticos?.filter(d => d.estado === "EN_REPARACION").length || 0,
      }
    });
  } catch (err) {
    res.json({ error: String(err) });
  }
});

// =====================================================
// 👤 USUARIOS Y AUTENTICACIÓN
// =====================================================
app.get("/usuarios", async (req, res) => {
  const { data } = await supabase.from("usuarios")
    .select("id, nombre, email, rol, activo, created_at").order("id");
  res.json(data || []);
});

app.post("/usuarios", async (req, res) => {
  const { nombre, email, password_hash, rol } = req.body;
  if (!nombre || !email || !password_hash || !rol)
    return res.json({ error: "Todos los campos son requeridos" });
  const { data, error } = await supabase.from("usuarios")
    .insert([{ nombre, email, password_hash, rol, activo: true }])
    .select("id, nombre, email, rol, activo");
  if (error) return res.json({ error: error.message });
  res.json(data[0]);
});

app.patch("/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from("usuarios")
    .update(req.body).eq("id", id)
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
  const { data } = await supabase.from("usuarios")
    .select("*").eq("email", email).eq("password_hash", password).eq("activo", true).single();
  if (!data) return res.json({ error: "Credenciales incorrectas o usuario inactivo" });
  const { password_hash, ...usuario } = data;
  res.json({ ok: true, usuario });
});

// =====================================================
// 🔢 NCF
// =====================================================
app.get("/ncf/siguiente", async (req, res) => {
  const { tipo } = req.query;
  const { data } = await supabase.from("ncf_config").select("*").eq("tipo", tipo || "B02").single();
  if (!data) return res.json({ ncf: (tipo || "B02") + "00000001" });
  const nuevo = data.secuencia_actual + 1;
  await supabase.from("ncf_config").update({ secuencia_actual: nuevo }).eq("tipo", tipo || "B02");
  res.json({ ncf: data.prefijo + String(nuevo).padStart(8, "0") });
});

// =====================================================
// 🧾 CONSULTA RNC
// =====================================================
app.get("/facturacion/rnc/:rnc", async (req, res) => {
  const { rnc } = req.params;
  const { data } = await supabase.from("clientes").select("*").eq("rnc", rnc).single();
  if (!data) return res.json({ error: true, mensaje: "RNC no encontrado en el sistema" });
  res.json({ nombre: data.nombre, rnc: data.rnc, direccion: data.direccion || "", telefono: data.telefono || "" });
});

// =====================================================
// 🧾 FACTURAS
// ✅ GET /facturas — manejo de errores robusto, siempre JSON
// =====================================================
app.get("/facturas", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("facturas")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("Error GET /facturas:", error.message);
      return res.status(200).json([]);
    }
    res.json(data || []);
  } catch (err) {
    console.error("Excepción GET /facturas:", err);
    res.status(200).json([]);
  }
});

// =====================================================
// POST /facturas
// ✅ FIXES:
//   1. caja_movimientos en try/catch propio — no rompe la factura
//   2. inventario_movimientos protegido individualmente
//   3. Respuesta SIEMPRE es JSON válido
// =====================================================
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
    // Calcular totales en el backend
    let subtotal = 0;
    let itbis    = 0;
    for (const item of items) {
      const linea = Number(item.precio_unitario) * Number(item.cantidad);
      subtotal += linea;
      if (item.itbis_aplica) itbis += linea * 0.18;
    }
    const total = subtotal + itbis;

    // NCF secuencial
    const tipo = ncf_tipo || "B02";
    const { data: ncfData } = await supabase
      .from("ncf_config").select("*").eq("tipo", tipo).single();

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

    // Insertar factura principal
    const { data: factura, error: errFac } = await supabase
      .from("facturas")
      .insert([{
        ncf,
        ncf_tipo:       tipo,
        ncf_vence:      fechaVence.toISOString().split("T")[0],
        estado:         "ACTIVA",
        cliente_id:     cliente_id     || null,
        cliente_nombre: cliente_nombre || "Consumidor Final",
        cliente_rnc:    cliente_rnc    || null,
        vehiculo_id:    vehiculo_id    || null,
        vehiculo_info:  vehiculo_info  || null,
        diagnostico_id: diagnostico_id || null,
        subtotal,
        itbis,
        total,
        metodo_pago:    metodo_pago    || "EFECTIVO",
        notas:          notas          || null,
        created_at:     new Date()
      }])
      .select();

    if (errFac) {
      console.error("Error INSERT facturas:", errFac.message);
      return res.json({ error: errFac.message });
    }

    const facturaId = factura[0].id;

    // Insertar ítems
    for (const item of items) {
      const subtotalItem = Number(item.precio_unitario) * Number(item.cantidad);

      const { error: errItem } = await supabase.from("factura_items").insert([{
        factura_id:      facturaId,
        tipo:            item.tipo          || "repuesto",
        descripcion:     item.descripcion,
        cantidad:        Number(item.cantidad),
        precio_unitario: Number(item.precio_unitario),
        itbis_aplica:    item.itbis_aplica  || false,
        subtotal:        subtotalItem,
        inventario_id:   item.inventario_id || null
      }]);

      if (errItem) console.error("Error INSERT factura_items:", errItem.message);

      // Solo repuestos con inventario_id descontan stock
      if (item.tipo === "repuesto" && item.inventario_id) {
        try {
          const { data: prod } = await supabase
            .from("inventario").select("stock").eq("id", item.inventario_id).single();
          if (prod) {
            await supabase.from("inventario")
              .update({ stock: prod.stock - Number(item.cantidad) })
              .eq("id", item.inventario_id);

            // ✅ inventario_movimientos protegido — opcional
            try {
              await supabase.from("inventario_movimientos").insert([{
                part_id:     item.inventario_id,
                tipo:        "SALIDA",
                cantidad:    Number(item.cantidad),
                descripcion: `Factura ${ncf}`,
                created_at:  new Date()
              }]);
            } catch (e) {
              console.warn("inventario_movimientos no disponible:", e.message);
            }
          }
        } catch (e) {
          console.warn("Error actualizando stock:", e.message);
        }
      }
    }

    // Marcar diagnóstico como FACTURADO
    if (diagnostico_id) {
      const { error: errDF } = await supabase
        .from("diagnosticos").update({ estado: "FACTURADO" }).eq("id", diagnostico_id);
      if (errDF) console.warn("Error marcando FACTURADO:", errDF.message);
    }

    // ✅ caja_movimientos en su propio try/catch
    // Si la tabla no existe, la factura ya fue creada y se devuelve igual
    try {
      await supabase.from("caja_movimientos").insert([{
        tipo:        "INGRESO",
        concepto:    `Factura ${ncf} — ${cliente_nombre || "Consumidor Final"}`,
        monto:       total,
        metodo_pago: metodo_pago || "EFECTIVO",
        factura_id:  facturaId,
        created_at:  new Date()
      }]);
    } catch (e) {
      console.warn("caja_movimientos no disponible:", e.message);
    }

    // ✅ Siempre devolver la factura guardada
    res.json(factura[0]);

  } catch (err) {
    console.error("Error general POST /facturas:", err);
    res.status(200).json({ error: err.message || "Error interno del servidor" });
  }
});

// IMPORTANTE: /facturas/:id/items ANTES de /facturas/:id
app.get("/facturas/:id/items", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: factura } = await supabase.from("facturas").select("*").eq("id", id).single();
    if (!factura) return res.json({ error: "Factura no encontrada" });
    const { data: items } = await supabase.from("factura_items").select("*").eq("factura_id", id);
    res.json({ factura, items: items || [] });
  } catch (err) {
    res.json({ error: err.message });
  }
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
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🔥 SÓLIDO AUTO SERVICIO corriendo en puerto ${PORT}`);
});
