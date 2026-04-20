"use client";
import { useEffect, useState } from "react";
import { API_URL as API } from "@/config";

// ─── DATOS EMPRESA ─────────────────────────────────────────────────────────
const EMPRESA = {
  nombre:    "SÓLIDO AUTO SERVICIO SRL",
  telefono:  "809-712-2027",
  rnc:       "1-32-XXXXX-X",
  direccion: "Santo Domingo, República Dominicana",
  email:     "info@solidoauto.com",
  logo:      "/logo.png"
};

// ─── GENERADOR HTML DGII ──────────────────────────────────────────────────
function generarHTML(factura: any, items: any[], clienteExtra: any = {}, esCotizacion = false) {
  const subtotal = Number(factura.subtotal || 0);
  const itbis    = Number(factura.itbis    || 0);
  const total    = Number(factura.total    || 0);

  const fecha = new Date(factura.created_at || Date.now()).toLocaleString("es-DO", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const ncfVence = factura.ncf_vence
    ? new Date(factura.ncf_vence).toLocaleDateString("es-DO")
    : (() => {
        const d = new Date(factura.created_at || Date.now());
        d.setFullYear(d.getFullYear() + 2);
        return d.toLocaleDateString("es-DO");
      })();

  const lineas = items.map(p => {
    const cant   = Number(p.cantidad ?? p.qty ?? 1);
    const precio = Number(p.precio_unitario ?? p.price ?? 0);
    const linea  = cant * precio;
    const desc   = p.descripcion ?? p.name ?? "";
    const tipo   = p.tipo ?? "";
    return `
      <tr>
        <td style="padding:9px 8px;border-bottom:1px solid #eee;">
          <div style="font-weight:600;font-size:13px;">${desc}</div>
          ${tipo ? `<span style="font-size:10px;background:${tipo === "mano_obra" ? "#fef3c7" : "#dcfce7"};
            color:${tipo === "mano_obra" ? "#92400e" : "#166534"};
            padding:1px 6px;border-radius:3px;font-weight:700;text-transform:uppercase;">${
              tipo === "mano_obra" ? "MANO DE OBRA" : tipo === "repuesto" ? "REPUESTO" : tipo
            }</span>` : ""}
        </td>
        <td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:center;">${cant}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;">RD$ ${precio.toFixed(2)}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:center;">
          <span style="font-size:11px;color:${p.itbis_aplica ? "#1e40af" : "#888"};">
            ${p.itbis_aplica ? "18%" : "—"}
          </span>
        </td>
        <td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">RD$ ${linea.toFixed(2)}</td>
      </tr>`;
  }).join("");

  const banner = esCotizacion
    ? `<div style="background:#fefce8;border:2px solid #eab308;color:#854d0e;text-align:center;
        padding:12px;font-size:16px;font-weight:900;border-radius:8px;margin:16px 0;letter-spacing:1px;">
        📄 COTIZACIÓN PREVENTIVA — Válida por 15 días</div>`
    : factura.estado === "CANCELADA"
    ? `<div style="background:#fee2e2;border:2px solid #dc2626;color:#dc2626;text-align:center;
        padding:12px;font-size:16px;font-weight:900;border-radius:8px;margin:16px 0;">
        ⚠️ FACTURA CANCELADA</div>`
    : "";

  const clienteNombre = factura.cliente_nombre || clienteExtra?.nombre || "Consumidor Final";
  const clienteRNC    = factura.cliente_rnc    || clienteExtra?.rnc    || null;
  const clienteTel    = clienteExtra?.telefono || null;
  const vehiculoInfo  = factura.vehiculo_info  || null;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/>
<title>${esCotizacion ? "Cotización" : "Factura"} ${factura.ncf || ""}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:32px;max-width:800px;margin:auto;}

  /* ── CABECERA DGII: empresa izq | documento der ── */
  .cab{display:flex;justify-content:space-between;align-items:flex-start;
    border-bottom:3px solid #111;padding-bottom:20px;margin-bottom:22px;gap:28px;}
  .cab-izq{flex:1.3;}
  .cab-izq img{height:58px;margin-bottom:8px;object-fit:contain;display:block;}
  .emp-nombre{font-size:20px;font-weight:900;letter-spacing:.5px;text-transform:uppercase;line-height:1.2;}
  .emp-meta{font-size:12px;color:#555;margin-top:6px;line-height:1.9;}
  .cab-der{flex:1;text-align:right;border-left:2px solid #ebebeb;padding-left:22px;}
  .doc-tipo{font-size:24px;font-weight:900;text-transform:uppercase;color:#111;}
  .doc-num{font-size:15px;color:#333;margin-top:3px;font-weight:700;}
  .doc-meta{font-size:12px;color:#555;margin-top:5px;line-height:1.9;}
  .tipo-badge{display:inline-block;background:#111;color:#fff;padding:3px 12px;
    border-radius:4px;font-size:11px;font-weight:700;letter-spacing:.5px;margin-top:6px;}

  /* ── NCF ── */
  .ncf-box{background:#0f172a;color:#fff;display:flex;justify-content:space-between;
    align-items:center;padding:14px 22px;border-radius:10px;margin:18px 0;}
  .ncf-lbl{font-size:10px;letter-spacing:2px;opacity:.5;margin-bottom:3px;text-transform:uppercase;}
  .ncf-num{font-size:24px;font-weight:900;letter-spacing:5px;}
  .ncf-right{text-align:right;font-size:12px;color:rgba(255,255,255,.6);line-height:1.9;}

  /* ── DATOS DOS COL ── */
  .dos-col{display:flex;gap:14px;margin-bottom:22px;}
  .info-box{flex:1;background:#f8f8f8;border-radius:8px;padding:14px 16px;border:1px solid #ebebeb;}
  .ib-title{font-size:10px;text-transform:uppercase;color:#888;font-weight:700;
    margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:5px;letter-spacing:1px;}
  .ib-row{font-size:13px;margin-bottom:4px;line-height:1.6;}

  /* ── TABLA ── */
  table{width:100%;border-collapse:collapse;margin-bottom:16px;}
  thead th{background:#111;color:#fff;padding:10px 8px;font-size:12px;text-align:left;}
  thead th:nth-child(2),thead th:nth-child(4){text-align:center;}
  thead th:nth-child(3),thead th:nth-child(5){text-align:right;}

  /* ── TOTALES ── */
  .totales{margin-left:auto;width:310px;}
  .t-row{display:flex;justify-content:space-between;padding:7px 0;font-size:14px;border-bottom:1px solid #eee;}
  .t-total{font-size:21px;font-weight:900;border-top:3px solid #111;border-bottom:none;padding-top:13px;margin-top:6px;}

  /* ── FOOTER ── */
  .footer{text-align:center;margin-top:32px;padding-top:16px;border-top:1px dashed #ccc;
    color:#777;font-size:12px;line-height:2.2;}
  .dgii-note{font-size:10px;color:#bbb;margin-top:2px;}

  @media print{body{padding:10px;} .ncf-box{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style></head><body>

<!-- CABECERA DGII -->
<div class="cab">
  <div class="cab-izq">
    <img src="${EMPRESA.logo}" alt="Logo" onerror="this.style.display='none'"/>
    <div class="emp-nombre">🔧 ${EMPRESA.nombre}</div>
    <div class="emp-meta">
      <strong>RNC:</strong> ${EMPRESA.rnc}<br/>
      <strong>Tel:</strong> ${EMPRESA.telefono}<br/>
      <strong>Dir:</strong> ${EMPRESA.direccion}<br/>
      ${EMPRESA.email}
    </div>
  </div>
  <div class="cab-der">
    <div class="doc-tipo">${esCotizacion ? "Cotización" : "Factura"}</div>
    <div class="doc-num">${esCotizacion ? "PRO-FORMA" : "FAC-" + String(factura.id || 0).padStart(5, "0")}</div>
    <div class="doc-meta">
      <strong>Fecha:</strong> ${fecha}<br/>
      <strong>Método:</strong> ${factura.metodo_pago || factura.method || "EFECTIVO"}<br/>
      ${!esCotizacion ? `<strong>Tipo NCF:</strong> ${factura.ncf_tipo || "B02"}<br/><strong>Vence:</strong> ${ncfVence}` : ""}
    </div>
    ${!esCotizacion ? `<div class="tipo-badge">${factura.ncf_tipo || "B02"}</div>` : ""}
  </div>
</div>

${banner}

<!-- NCF -->
${!esCotizacion ? `
<div class="ncf-box">
  <div>
    <div class="ncf-lbl">Número de Comprobante Fiscal — NCF</div>
    <div class="ncf-num">${factura.ncf || "—"}</div>
  </div>
  <div class="ncf-right">
    Tipo: ${factura.ncf_tipo || "B02"}<br/>
    Vencimiento: ${ncfVence}<br/>
    ${factura.estado === "CANCELADA" ? "⚠️ CANCELADA" : "✓ Vigente"}
  </div>
</div>` : ""}

<!-- CLIENTE + VEHÍCULO -->
<div class="dos-col">
  <div class="info-box">
    <div class="ib-title">👤 Cliente</div>
    <div class="ib-row"><strong>${clienteNombre}</strong></div>
    ${clienteRNC ? `<div class="ib-row">RNC/Cédula: ${clienteRNC}</div>` : ""}
    ${clienteTel ? `<div class="ib-row">Tel: ${clienteTel}</div>` : ""}
  </div>
  <div class="info-box">
    <div class="ib-title">🚗 Vehículo</div>
    ${vehiculoInfo
      ? `<div class="ib-row">${vehiculoInfo}</div>`
      : `<div class="ib-row" style="color:#aaa;">Sin vehículo asociado</div>`}
    ${factura.diagnostico_id ? `<div class="ib-row" style="font-size:11px;color:#888;">Diag. #${factura.diagnostico_id}</div>` : ""}
  </div>
</div>

<!-- ITEMS -->
<table>
  <thead>
    <tr>
      <th>Descripción / Servicio</th>
      <th style="text-align:center;width:60px;">Cant.</th>
      <th style="text-align:right;width:130px;">Precio Unit.</th>
      <th style="text-align:center;width:60px;">ITBIS</th>
      <th style="text-align:right;width:120px;">Total</th>
    </tr>
  </thead>
  <tbody>${lineas || `<tr><td colspan="5" style="padding:20px;text-align:center;color:#888;">Sin ítems</td></tr>`}</tbody>
</table>

<!-- TOTALES -->
<div class="totales">
  <div class="t-row"><span>Subtotal:</span><span>RD$ ${subtotal.toFixed(2)}</span></div>
  <div class="t-row"><span>ITBIS (18%):</span><span>RD$ ${itbis.toFixed(2)}</span></div>
  <div class="t-row t-total"><span>TOTAL:</span><span>RD$ ${total.toFixed(2)}</span></div>
</div>

<!-- FOOTER -->
<div class="footer">
  <p>¡Gracias por confiar en <strong>${EMPRESA.nombre}</strong>! · ${EMPRESA.telefono}</p>
  ${esCotizacion
    ? "<p>Esta cotización tiene validez de 15 días hábiles. Precios sujetos a cambios.</p>"
    : ""}
  <p class="dgii-note">Documento fiscal emitido conforme a la Norma General 06-2018 de la DGII — República Dominicana</p>
  <p class="dgii-note">Valide este comprobante en: <strong>www.dgii.gov.do</strong></p>
</div>

<script>
  window.onload = function() { setTimeout(function(){ window.print(); }, 400); };
  window.onafterprint = function() { window.close(); };
</script>
</body></html>`;
}

function abrirImpresion(html: string) {
  const w = window.open("", "_blank", "width=840,height=1050");
  if (w) { w.document.write(html); w.document.close(); }
  else alert("⚠️ Permite ventanas emergentes para imprimir.");
}

// ═══════════════════════════════════════════════════════════════════════════
export default function FacturaPage() {
  const [clientes,     setClientes]     = useState<any[]>([]);
  const [vehiculos,    setVehiculos]    = useState<any[]>([]);
  const [items,        setItems]        = useState<any[]>([]);
  const [facturas,     setFacturas]     = useState<any[]>([]);
  const [diagnosticos, setDiagnosticos] = useState<any[]>([]);
  const [carrito,      setCarrito]      = useState<any[]>([]);

  const [clienteId,          setClienteId]    = useState("");
  const [clienteSeleccionado,setClienteSel]   = useState<any>(null);
  const [vehiculoId,         setVehiculoId]   = useState("");
  const [method,             setMethod]       = useState("EFECTIVO");
  const [ncfTipo,            setNcfTipo]      = useState("B02");
  const [loading,            setLoading]      = useState(false);
  const [tab,                setTab]          = useState("nueva");
  const [busqueda,           setBusqueda]     = useState("");
  const [busHistorial,       setBusHistorial] = useState("");
  const [ultimaFactura,      setUltimaFactura]= useState<any>(null);
  const [montoRecibido,      setMontoRecibido]= useState("");
  const [diagCargado,        setDiagCargado]  = useState<number | null>(null);

  // Búsqueda inline cliente
  const [busqCliente,  setBusqCliente]  = useState("");
  const [resultCli,    setResultCli]    = useState<any[]>([]);
  const [modoRNC,      setModoRNC]      = useState(false);

  // Modal historial
  const [modalFac,     setModalFac]     = useState<any>(null);
  const [modalMethod,  setModalMethod]  = useState("EFECTIVO");
  const [modalCliente, setModalCliente] = useState("");

  // ── fetchData: cada endpoint es INDEPENDIENTE ────────────────────────────
  // Si uno falla (404, HTML, error de red), los demás igual cargan.
  const safeFetch = async (url: string): Promise<any[]> => {
    try {
      const res = await fetch(url);
      const ct  = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        console.warn(`[fetchData] ${url} devolvió no-JSON (status ${res.status})`);
        return [];
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn(`[fetchData] error en ${url}:`, e);
      return [];
    }
  };

  const fetchData = async () => {
    const [c, v, i, f, d] = await Promise.all([
      safeFetch(`${API}/clientes`),
      safeFetch(`${API}/vehiculos`),
      safeFetch(`${API}/inventario`),
      safeFetch(`${API}/facturas`),
      safeFetch(`${API}/diagnosticos`)
    ]);
    setClientes(c);
    setVehiculos(v);
    setItems(i);
    setFacturas(f);
    // Diagnósticos disponibles para facturar
    setDiagnosticos(
      d.filter((x: any) =>
        x.estado !== "FACTURADO" &&
        (Number(x.costo_estimado) > 0 ||
          x.estado === "COTIZADO" ||
          x.estado === "APROBADO" ||
          x.estado === "COMPLETADO")
      )
    );
  };

  useEffect(() => { fetchData(); }, []);

  // ── Búsqueda cliente ──────────────────────────────────────────────────────
  const buscarCliente = (q: string) => {
    setBusqCliente(q);
    if (q.length < 1) { setResultCli([]); return; }
    setResultCli(
      clientes.filter((c: any) =>
        c.nombre?.toLowerCase().includes(q.toLowerCase()) ||
        c.rnc?.includes(q) ||
        c.telefono?.includes(q)
      ).slice(0, 8)
    );
  };

  const seleccionarCliente = (c: any) => {
    setClienteSel(c);
    setClienteId(String(c.id));
    setVehiculoId("");
    setBusqCliente("");
    setResultCli([]);
    // Auto-asignar NCF B01 si tiene RNC
    if (c.rnc) setNcfTipo("B01");
  };

  const limpiarCliente = () => {
    setClienteSel(null);
    setClienteId("");
    setVehiculoId("");
    setBusqCliente("");
    setResultCli([]);
    setNcfTipo("B02");
  };

  // ── Cargar diagnóstico ────────────────────────────────────────────────────
  const cargarDiagnostico = (diag: any) => {
    // Setear cliente y vehículo automáticamente
    const cli = clientes.find((c: any) => c.id === Number(diag.cliente_id));
    if (cli) { setClienteSel(cli); setClienteId(String(cli.id)); }
    if (diag.vehiculo_id) setVehiculoId(String(diag.vehiculo_id));
    setDiagCargado(diag.id);

    // Armar ítem(s) de mano de obra
    const nuevosItems: any[] = [];
    const precioMO = Number(diag.costo_estimado || 0);

    // Si hay detalle de mano de obra, crear una línea por cada tarea
    if (diag.mano_de_obra_detalle?.trim()) {
      const lineas = diag.mano_de_obra_detalle
        .split("\n")
        .map((l: string) => l.trim())
        .filter(Boolean);

      if (lineas.length === 1) {
        // Una sola línea: usar precio total como monto
        nuevosItems.push({
          id:              `MO-${diag.id}-0`,
          descripcion:     lineas[0],
          tipo:            "mano_obra",
          precio_unitario: precioMO,
          cantidad:        1,
          itbis_aplica:    false,
          inventario_id:   null,
          _diagId:         diag.id
        });
      } else {
        // Múltiples líneas: distribuir precio equitativamente
        const precioPorLinea = lineas.length > 0
          ? parseFloat((precioMO / lineas.length).toFixed(2))
          : 0;
        lineas.forEach((linea: string, idx: number) => {
          nuevosItems.push({
            id:              `MO-${diag.id}-${idx}`,
            descripcion:     linea,
            tipo:            "mano_obra",
            precio_unitario: idx === 0
              // Primera línea absorbe el centavo del redondeo
              ? parseFloat((precioMO - precioPorLinea * (lineas.length - 1)).toFixed(2))
              : precioPorLinea,
            cantidad:        1,
            itbis_aplica:    false,
            inventario_id:   null,
            _diagId:         diag.id
          });
        });
      }
    } else {
      // Sin detalle: un ítem genérico
      nuevosItems.push({
        id:              `MO-${diag.id}-0`,
        descripcion:     diag.tipo_servicio
          ? `Mano de Obra — ${diag.tipo_servicio}`
          : "Mano de Obra Técnica",
        tipo:            "mano_obra",
        precio_unitario: precioMO,
        cantidad:        1,
        itbis_aplica:    false,
        inventario_id:   null,
        _diagId:         diag.id
      });
    }

    // Reemplazar ítems MO previos, conservar repuestos
    setCarrito(prev => [
      ...nuevosItems,
      ...prev.filter((p: any) => !String(p.id).startsWith("MO-"))
    ]);
  };

  const quitarDiagnostico = () => {
    setDiagCargado(null);
    setCarrito(prev => prev.filter((p: any) => !String(p.id).startsWith("MO-")));
  };

  // ── Inventario / carrito ──────────────────────────────────────────────────
  const vehiculosFiltrados = vehiculos.filter((v: any) =>
    Number(v.cliente_id) === Number(clienteId)
  );

  const itemsFiltrados = items.filter((i: any) =>
    !busqueda ||
    i.name?.toLowerCase().includes(busqueda.toLowerCase()) ||
    i.code?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const addItem = (item: any) => {
    if (item.stock <= 0) return alert("Sin stock disponible");
    const exists = carrito.find((p: any) => p.id === item.id);
    if (exists) {
      if (exists.cantidad >= item.stock) return alert("Stock insuficiente");
      setCarrito(carrito.map((p: any) =>
        p.id === item.id ? { ...p, cantidad: p.cantidad + 1 } : p
      ));
    } else {
      setCarrito([...carrito, {
        id:              item.id,
        descripcion:     item.name,
        tipo:            "repuesto",
        precio_unitario: Number(item.price),
        cantidad:        1,
        itbis_aplica:    true,
        inventario_id:   item.id
      }]);
    }
  };

  const updateCantidad = (id: any, cant: number) => {
    if (cant <= 0) { setCarrito(carrito.filter((p: any) => p.id !== id)); return; }
    const orig = items.find((i: any) => i.id === id);
    if (orig && cant > orig.stock) return alert("Stock insuficiente");
    setCarrito(carrito.map((p: any) => p.id === id ? { ...p, cantidad: cant } : p));
  };

  // ── Totales ───────────────────────────────────────────────────────────────
  const subtotal = carrito.reduce(
    (acc: number, p: any) => acc + Number(p.precio_unitario) * Number(p.cantidad), 0
  );
  const itbis = carrito
    .filter((p: any) => p.itbis_aplica)
    .reduce((acc: number, p: any) => acc + Number(p.precio_unitario) * Number(p.cantidad) * 0.18, 0);
  const total  = subtotal + itbis;
  const vuelto = Number(montoRecibido || 0) - total;

  // ── Cotización (sin guardar en BD) ────────────────────────────────────────
  const handleCotizacion = () => {
    if (carrito.length === 0) return alert("Carrito vacío");
    const veh = vehiculosFiltrados.find((v: any) => v.id === Number(vehiculoId));
    const mockFac = {
      subtotal, itbis, total,
      metodo_pago:    method,
      vehiculo_info:  veh ? `${veh.marca} ${veh.modelo} · Placa: ${veh.placa}` : "",
      cliente_nombre: clienteSeleccionado?.nombre || "Consumidor Final",
      cliente_rnc:    clienteSeleccionado?.rnc    || "",
      created_at:     new Date()
    };
    abrirImpresion(generarHTML(mockFac, carrito, clienteSeleccionado, true));
  };

  // ── Generar factura real ──────────────────────────────────────────────────
  const generarFactura = async () => {
    if (carrito.length === 0) return alert("Carrito vacío");
    if (Number(montoRecibido) > 0 && vuelto < 0)
      return alert(`Monto insuficiente. Faltan RD$ ${Math.abs(vuelto).toFixed(2)}`);

    setLoading(true);
    const snap = [...carrito];
    try {
      const veh = vehiculosFiltrados.find((v: any) => v.id === Number(vehiculoId));

      const body = {
        items: snap.map((p: any) => ({
          tipo:            p.tipo,
          descripcion:     p.descripcion,
          cantidad:        p.cantidad,
          precio_unitario: p.precio_unitario,
          itbis_aplica:    p.itbis_aplica,
          inventario_id:   p.inventario_id || null
        })),
        metodo_pago:    method,
        ncf_tipo:       ncfTipo,
        subtotal,
        itbis,
        total,
        cliente_id:     clienteId ? Number(clienteId) : null,
        cliente_nombre: clienteSeleccionado?.nombre || "Consumidor Final",
        cliente_rnc:    clienteSeleccionado?.rnc    || null,
        vehiculo_id:    vehiculoId ? Number(vehiculoId) : null,
        vehiculo_info:  veh ? `${veh.marca} ${veh.modelo} · Placa: ${veh.placa}` : null,
        diagnostico_id: diagCargado || null
      };

      const res  = await fetch(`${API}/facturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      // Protección: si el servidor devuelve HTML (error), atrapar aquí
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Respuesta no JSON:", text);
        alert("El servidor no está disponible. Verifica que el backend esté corriendo.");
        return;
      }

      const data = await res.json();
      if (data.error) { alert("Error: " + data.error); return; }

      setUltimaFactura({ factura: data, items: snap });
      abrirImpresion(generarHTML(data, snap, clienteSeleccionado, false));

      // Limpiar
      setCarrito([]); setClienteId(""); setClienteSel(null);
      setVehiculoId(""); setMontoRecibido(""); setDiagCargado(null);
      setBusqCliente("");
      fetchData();
    } catch (e: any) {
      alert("Error generando factura: " + (e.message || "Error desconocido"));
    } finally { setLoading(false); }
  };

  // ── Historial ─────────────────────────────────────────────────────────────
  const reimprimirFactura = async (fac: any) => {
    try {
      const res  = await fetch(`${API}/facturas/${fac.id}/items`);
      const data = await res.json();
      abrirImpresion(generarHTML(fac, data.items || [], {}, false));
    } catch { alert("Error al cargar ítems"); }
  };

  const cancelarFactura = async (fac: any) => {
    if (!confirm(`¿Cancelar FAC-${String(fac.id).padStart(5, "0")}?`)) return;
    await fetch(`${API}/facturas/${fac.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "CANCELADA" })
    });
    fetchData();
  };

  const eliminarFactura = async (id: number) => {
    if (!confirm(`¿Eliminar permanentemente FAC-${String(id).padStart(5, "0")}?`)) return;
    await fetch(`${API}/facturas/${id}`, { method: "DELETE" });
    fetchData();
  };

  const guardarEdicion = async () => {
    if (!modalFac) return;
    await fetch(`${API}/facturas/${modalFac.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metodo_pago: modalMethod, cliente_nombre: modalCliente })
    });
    setModalFac(null);
    fetchData();
  };

  const facturasFiltradas = facturas.filter((f: any) =>
    !busHistorial ||
    f.cliente_nombre?.toLowerCase().includes(busHistorial.toLowerCase()) ||
    f.ncf?.toLowerCase().includes(busHistorial.toLowerCase())
  );

  const diagSeleccionado = diagnosticos.find((d: any) => d.id === diagCargado);

  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div style={container}>
      <h1 style={title}>🧾 Facturación — {EMPRESA.nombre}</h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {["nueva", "historial"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...tabBtn, background: tab === t ? "#111827" : "#fff",
              color: tab === t ? "#fff" : "#111" }}>
            {t === "nueva" ? "➕ Nueva Factura / Cotización" : `📋 Historial (${facturas.length})`}
          </button>
        ))}
      </div>

      {/* ══════════ NUEVA FACTURA ══════════ */}
      {tab === "nueva" && (
        <div style={grid}>

          {/* ── COLUMNA IZQUIERDA ── */}
          <div>

            {/* DIAGNÓSTICO */}
            <div style={{ ...card, marginBottom: 16, border: "2px solid #3b82f6" }}>
              <h2 style={{ ...cardTitle, color: "#1d4ed8" }}>📋 Cargar desde Diagnóstico</h2>
              <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                Selecciona un diagnóstico para cargar la mano de obra automáticamente al carrito.
              </p>

              {diagnosticos.length === 0 ? (
                <p style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic", padding: "8px 0" }}>
                  Sin diagnósticos disponibles para facturar.
                </p>
              ) : (
                <select style={input} defaultValue="" onChange={e => {
                  const d = diagnosticos.find((x: any) => x.id === Number(e.target.value));
                  if (d) cargarDiagnostico(d);
                  (e.target as HTMLSelectElement).value = "";
                }}>
                  <option value="">— Seleccionar diagnóstico —</option>
                  {diagnosticos.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      #{d.id} · {d.tipo_servicio} · {d.cliente_nombre}
                      {d.costo_estimado > 0 ? ` · RD$ ${Number(d.costo_estimado).toLocaleString("es-DO")}` : ""}
                      {" · "}{d.estado}
                    </option>
                  ))}
                </select>
              )}

              {diagCargado && diagSeleccionado && (
                <div style={{ background: "#eff6ff", border: "1px solid #93c5fd",
                  borderRadius: 8, padding: "12px 14px", fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: "#1d4ed8" }}>
                      ✅ Diagnóstico #{diagCargado} cargado
                    </span>
                    <button onClick={quitarDiagnostico}
                      style={{ background: "none", border: "none", color: "#ef4444",
                        cursor: "pointer", fontWeight: 700, fontSize: 16 }}>✕</button>
                  </div>
                  <div style={{ color: "#334155", lineHeight: 1.7 }}>
                    <strong>{diagSeleccionado.tipo_servicio}</strong><br/>
                    Cliente: {diagSeleccionado.cliente_nombre}<br/>
                    Vehículo: {diagSeleccionado.vehiculo_info}<br/>
                    {diagSeleccionado.costo_estimado > 0 &&
                      `Costo estimado: RD$ ${Number(diagSeleccionado.costo_estimado).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`}
                  </div>
                </div>
              )}
            </div>

            {/* CLIENTE Y DOCUMENTO */}
            <div style={{ ...card, marginBottom: 16 }}>
              <h2 style={cardTitle}>👤 Cliente y Documento</h2>

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button onClick={() => { setModoRNC(false); limpiarCliente(); }}
                  style={{ ...tabBtn, fontSize: 12, padding: "7px 14px",
                    background: !modoRNC ? "#111827" : "#fff",
                    color: !modoRNC ? "#fff" : "#111" }}>
                  Lista
                </button>
                <button onClick={() => { setModoRNC(true); limpiarCliente(); }}
                  style={{ ...tabBtn, fontSize: 12, padding: "7px 14px",
                    background: modoRNC ? "#111827" : "#fff",
                    color: modoRNC ? "#fff" : "#111" }}>
                  Buscar por nombre / RNC
                </button>
              </div>

              {/* MODO LISTA */}
              {!modoRNC && (
                <>
                  <label style={label}>Cliente</label>
                  <select value={clienteId} onChange={e => {
                    setClienteId(e.target.value);
                    setVehiculoId("");
                    const cli = clientes.find((c: any) => c.id === Number(e.target.value));
                    setClienteSel(cli || null);
                    if (cli?.rnc) setNcfTipo("B01");
                    else setNcfTipo("B02");
                  }} style={input}>
                    <option value="">Consumidor Final</option>
                    {clientes.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}{c.rnc ? ` (RNC: ${c.rnc})` : ""}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {/* MODO BÚSQUEDA RNC */}
              {modoRNC && (
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <label style={label}>Buscar cliente por nombre o RNC</label>
                  <input value={busqCliente}
                    onChange={e => buscarCliente(e.target.value)}
                    placeholder="Escribe nombre, RNC o teléfono..."
                    style={input} autoComplete="off" />

                  {/* Dropdown resultados */}
                  {resultCli.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0,
                      background: "#fff", border: "1px solid #ddd", borderRadius: 8,
                      zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,.15)",
                      maxHeight: 220, overflowY: "auto" }}>
                      {resultCli.map((c: any) => (
                        <div key={c.id} onClick={() => seleccionarCliente(c)}
                          style={{ padding: "11px 14px", cursor: "pointer",
                            borderBottom: "1px solid #f0f0f0", fontSize: 13 }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                          <div style={{ fontWeight: 700 }}>{c.nombre}</div>
                          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                            {c.rnc ? `RNC: ${c.rnc} · ` : ""}{c.telefono}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cliente seleccionado */}
                  {clienteSeleccionado && (
                    <div style={{ background: "#f0fdf4", border: "1px solid #86efac",
                      borderRadius: 8, padding: "10px 14px", marginTop: 8,
                      display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{clienteSeleccionado.nombre}</div>
                        <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                          {clienteSeleccionado.rnc ? `RNC: ${clienteSeleccionado.rnc} · ` : ""}
                          {clienteSeleccionado.telefono || ""}
                        </div>
                      </div>
                      <button onClick={limpiarCliente}
                        style={{ background: "none", border: "none", color: "#ef4444",
                          cursor: "pointer", fontSize: 18 }}>✕</button>
                    </div>
                  )}
                </div>
              )}

              {/* RNC mostrado si existe */}
              {clienteSeleccionado?.rnc && (
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe",
                  borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13,
                  color: "#1e40af" }}>
                  🏢 RNC del cliente: <strong>{clienteSeleccionado.rnc}</strong>
                  {" "} — NCF tipo B01 asignado automáticamente
                </div>
              )}

              {/* Vehículo */}
              {clienteId && (
                <>
                  <label style={label}>Vehículo</label>
                  <select value={vehiculoId}
                    onChange={e => setVehiculoId(e.target.value)} style={input}>
                    <option value="">— Sin vehículo —</option>
                    {vehiculosFiltrados.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.marca} {v.modelo} · {v.placa}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={label}>Tipo NCF</label>
                  <select value={ncfTipo} onChange={e => setNcfTipo(e.target.value)} style={input}>
                    <option value="B02">B02 — Consumidor Final</option>
                    <option value="B01">B01 — Crédito Fiscal</option>
                    <option value="B14">B14 — Régimen Especial</option>
                    <option value="B15">B15 — Gubernamental</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Método de pago</label>
                  <select value={method} onChange={e => setMethod(e.target.value)} style={input}>
                    <option value="EFECTIVO">💵 Efectivo</option>
                    <option value="TARJETA">💳 Tarjeta</option>
                    <option value="TRANSFERENCIA">🏦 Transferencia</option>
                    <option value="CHEQUE">📄 Cheque</option>
                  </select>
                </div>
              </div>
            </div>

            {/* REPUESTOS */}
            <div style={card}>
              <h2 style={cardTitle}>🔩 Repuestos del Inventario</h2>
              <input placeholder="🔍 Buscar repuesto o código..."
                value={busqueda} onChange={e => setBusqueda(e.target.value)}
                style={{ ...input, marginBottom: 12 }} />
              <div style={{ maxHeight: 260, overflowY: "auto" }}>
                {itemsFiltrados.length === 0 && (
                  <p style={{ color: "#94a3b8", textAlign: "center", padding: 20, fontSize: 13 }}>
                    {items.length === 0 ? "Sin productos en inventario" : "Sin resultados"}
                  </p>
                )}
                {itemsFiltrados.map((i: any) => (
                  <div key={i.id} style={productoRow}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{i.name}</div>
                      <div style={{ fontSize: 12, color: i.stock > 0 ? "#10b981" : "#ef4444" }}>
                        Stock: {i.stock}{i.code ? ` · ${i.code}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 700 }}>RD$ {Number(i.price).toFixed(2)}</span>
                      <button onClick={() => addItem(i)} disabled={i.stock <= 0}
                        style={{ ...btnAdd, background: i.stock <= 0 ? "#ccc" : "#111827" }}>
                        + Agregar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── COLUMNA DERECHA: CARRITO ── */}
          <div style={card}>
            <h2 style={cardTitle}>🛒 Detalle de la Factura</h2>

            {carrito.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🧾</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Carrito vacío</div>
                <div style={{ fontSize: 12 }}>
                  Carga un diagnóstico técnico o agrega repuestos del inventario
                </div>
              </div>
            ) : (
              carrito.map((p: any) => (
                <div key={p.id} style={carritoRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                      <span style={{
                        fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 700,
                        background: p.tipo === "mano_obra" ? "#fef3c7" : "#dcfce7",
                        color:      p.tipo === "mano_obra" ? "#92400e" : "#166534"
                      }}>
                        {p.tipo === "mano_obra" ? "MANO OBRA" : "REPUESTO"}
                      </span>
                      {!p.itbis_aplica && (
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>sin ITBIS</span>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.4 }}>
                      {p.descripcion}
                    </div>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      RD$ {Number(p.precio_unitario).toFixed(2)} c/u
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
                    <button onClick={() => updateCantidad(p.id, p.cantidad - 1)}
                      style={btnQty}>−</button>
                    <span style={{ fontWeight: 700, minWidth: 24, textAlign: "center" }}>
                      {p.cantidad}
                    </span>
                    <button onClick={() => updateCantidad(p.id, p.cantidad + 1)}
                      style={btnQty}>+</button>
                    <span style={{ minWidth: 92, textAlign: "right", fontWeight: 700 }}>
                      RD$ {(Number(p.precio_unitario) * Number(p.cantidad)).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}

            {/* TOTALES */}
            <div style={totalesBox}>
              <div style={totalesRow}>
                <span>Subtotal</span><span>RD$ {subtotal.toFixed(2)}</span>
              </div>
              <div style={totalesRow}>
                <span>ITBIS (18%)</span><span>RD$ {itbis.toFixed(2)}</span>
              </div>
              <div style={{ ...totalesRow, fontWeight: 700, fontSize: 19,
                borderTop: "2px solid #e2e8f0", paddingTop: 10, marginTop: 4 }}>
                <span>TOTAL</span><span>RD$ {total.toFixed(2)}</span>
              </div>
            </div>

            {/* VUELTO */}
            <div style={vueltoBx}>
              <label style={{ ...label, color: "#92400e" }}>
                💵 Monto recibido del cliente (RD$)
              </label>
              <input type="number" value={montoRecibido}
                onChange={e => setMontoRecibido(e.target.value)}
                placeholder="0.00"
                style={{ ...input, fontSize: 18, fontWeight: 700,
                  border: "1px solid #fde68a", marginBottom: 0 }} />
              {Number(montoRecibido) > 0 && (
                <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 8,
                  textAlign: "center",
                  background: vuelto >= 0 ? "#dcfce7" : "#fee2e2",
                  color:      vuelto >= 0 ? "#166534" : "#dc2626",
                  fontWeight: 800, fontSize: 20 }}>
                  {vuelto >= 0
                    ? `💚 Vuelto: RD$ ${vuelto.toFixed(2)}`
                    : `🔴 Faltan: RD$ ${Math.abs(vuelto).toFixed(2)}`}
                </div>
              )}
            </div>

            {/* BOTONES ACCIÓN */}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={handleCotizacion}
                style={{ ...btnFacturar, background: "#64748b", flex: 1, marginTop: 0 }}>
                📄 Cotización
              </button>
              <button onClick={generarFactura}
                disabled={loading || carrito.length === 0}
                style={{ ...btnFacturar,
                  background: loading || carrito.length === 0 ? "#94a3b8" : "#10b981",
                  flex: 2, marginTop: 0 }}>
                {loading ? "⏳ Procesando..." : `🖨️ Facturar — RD$ ${total.toFixed(2)}`}
              </button>
            </div>

            {ultimaFactura && (
              <button onClick={() => abrirImpresion(
                generarHTML(ultimaFactura.factura, ultimaFactura.items, {}, false)
              )} style={btnReimprimir}>
                🔁 Reimprimir FAC-{String(ultimaFactura.factura.id).padStart(5, "0")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════ HISTORIAL ══════════ */}
      {tab === "historial" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ ...cardTitle, marginBottom: 0 }}>📋 Historial de Facturas</h2>
            <input placeholder="Buscar por cliente o NCF..."
              value={busHistorial} onChange={e => setBusHistorial(e.target.value)}
              style={{ ...input, width: 280, marginBottom: 0 }} />
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {["Factura","NCF","Tipo","Cliente","RNC Cliente","Método","Total","Estado","Fecha","Acciones"]
                    .map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {facturasFiltradas.length === 0 ? (
                  <tr><td colSpan={10}
                    style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>
                    Sin facturas registradas
                  </td></tr>
                ) : facturasFiltradas.map((f: any) => {
                  const cancelada = f.estado === "CANCELADA";
                  return (
                    <tr key={f.id} style={{ opacity: cancelada ? 0.55 : 1 }}>
                      <td style={td}><b>FAC-{String(f.id).padStart(5, "0")}</b></td>
                      <td style={{ ...td, fontSize: 11, fontFamily: "monospace" }}>{f.ncf}</td>
                      <td style={td}>
                        <span style={{ background: "#dbeafe", color: "#1e40af",
                          padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          {f.ncf_tipo}
                        </span>
                      </td>
                      <td style={{ ...td, fontWeight: 600 }}>{f.cliente_nombre}</td>
                      <td style={{ ...td, fontSize: 12, color: "#64748b" }}>
                        {f.cliente_rnc || "—"}
                      </td>
                      <td style={td}>{f.metodo_pago}</td>
                      <td style={{ ...td, fontWeight: 700 }}>
                        RD$ {Number(f.total).toFixed(2)}
                      </td>
                      <td style={td}>
                        {cancelada
                          ? <span style={{ background: "#fee2e2", color: "#dc2626",
                              padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                              CANCELADA
                            </span>
                          : <span style={{ background: "#dcfce7", color: "#16a34a",
                              padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                              ACTIVA
                            </span>
                        }
                      </td>
                      <td style={{ ...td, fontSize: 11 }}>
                        {f.created_at ? new Date(f.created_at).toLocaleString("es-DO") : "—"}
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => reimprimirFactura(f)}
                            style={btnAcc("#111827")} title="Imprimir">🖨️</button>
                          {!cancelada && <>
                            <button
                              onClick={() => { setModalFac(f); setModalMethod(f.metodo_pago || "EFECTIVO"); setModalCliente(f.cliente_nombre); }}
                              style={btnAcc("#2563eb")} title="Editar">✏️</button>
                            <button onClick={() => cancelarFactura(f)}
                              style={btnAcc("#f59e0b")} title="Cancelar">⛔</button>
                          </>}
                          <button onClick={() => eliminarFactura(f.id)}
                            style={btnAcc("#dc2626")} title="Eliminar">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════ MODAL EDITAR ══════════ */}
      {modalFac && (
        <div style={overlay}>
          <div style={modal}>
            <h2 style={{ marginBottom: 16, fontSize: 18, fontWeight: 700 }}>
              ✏️ Editar FAC-{String(modalFac.id).padStart(5, "0")}
            </h2>
            <label style={label}>Nombre del cliente</label>
            <input value={modalCliente}
              onChange={e => setModalCliente(e.target.value)} style={input} />
            <label style={label}>Método de pago</label>
            <select value={modalMethod}
              onChange={e => setModalMethod(e.target.value)} style={input}>
              <option value="EFECTIVO">💵 Efectivo</option>
              <option value="TARJETA">💳 Tarjeta</option>
              <option value="TRANSFERENCIA">🏦 Transferencia</option>
              <option value="CHEQUE">📄 Cheque</option>
            </select>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button onClick={guardarEdicion}
                style={{ flex: 1, padding: 12, background: "#111827", color: "#fff",
                  borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700 }}>
                💾 Guardar
              </button>
              <button onClick={() => setModalFac(null)}
                style={{ flex: 1, padding: 12, background: "#f1f5f9", color: "#111",
                  borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ESTILOS ───────────────────────────────────────────────────────────────
const container:    React.CSSProperties = { padding: 20, background: "#f5f7fb", minHeight: "100vh" };
const title:        React.CSSProperties = { fontSize: 24, fontWeight: "bold", marginBottom: 20 };
const grid:         React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 };
const card:         React.CSSProperties = { background: "#fff", padding: 20, borderRadius: 15, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" };
const cardTitle:    React.CSSProperties = { marginBottom: 14, fontSize: 18, fontWeight: 600 };
const tabBtn:       React.CSSProperties = { padding: "10px 20px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", fontWeight: 600 };
const label:        React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#555" };
const input:        React.CSSProperties = { display: "block", marginBottom: 12, padding: 12, width: "100%", borderRadius: 8, border: "1px solid #ddd", boxSizing: "border-box", fontSize: 14 };
const productoRow:  React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0f0f0" };
const carritoRow:   React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid #f0f0f0", gap: 8 };
const totalesBox:   React.CSSProperties = { marginTop: 16, padding: 16, background: "#f8fafc", borderRadius: 10 };
const totalesRow:   React.CSSProperties = { display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 15 };
const vueltoBx:     React.CSSProperties = { marginTop: 12, padding: 14, background: "#fefce8", borderRadius: 10, border: "1px solid #fde68a" };
const btnAdd:       React.CSSProperties = { padding: "6px 14px", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" };
const btnQty:       React.CSSProperties = { padding: "2px 10px", background: "#f1f5f9", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };
const btnFacturar:  React.CSSProperties = { padding: 14, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", width: "100%", marginTop: 16, fontSize: 15, fontWeight: 700 };
const btnReimprimir:React.CSSProperties = { padding: 10, background: "#f1f5f9", color: "#111", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", width: "100%", marginTop: 10, fontSize: 13 };
const btnAcc = (bg: string): React.CSSProperties => ({ padding: "5px 9px", background: bg, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 });
const tableStyle:   React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const th:           React.CSSProperties = { textAlign: "left", padding: "10px 12px", background: "#f1f5f9", fontSize: 13, whiteSpace: "nowrap" };
const td:           React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 13 };
const overlay:      React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modal:        React.CSSProperties = { background: "#fff", padding: 28, borderRadius: 16, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };
