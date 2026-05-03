"use client";
import { useEffect, useState } from "react";
import { API_URL as API } from "@/config";

// ─── DATOS EMPRESA ─────────────────────────────────────────────────────────
const EMPRESA = {
  nombre: "SÓLIDO AUTO SERVICIO SRL",
  telefono: "809-712-2027",
  rnc: "1-32-XXXXX-X",
  direccion: "Santo Domingo, República Dominicana",
  email: "info@solidoauto.com",
  logo: "/logo.png"
};

// ─── GENERADOR HTML DGII COMPLIANT ─────────────────────────────────────────
function generarHTML(
  factura: any,
  items: any[],
  clienteExtra: any = {},
  esCotizacion = false
) {
  const subtotal = Number(factura.subtotal || 0);
  const itbis    = Number(factura.itbis    || 0);
  const total    = Number(factura.total    || 0);

  const fecha = new Date(factura.created_at || Date.now()).toLocaleString("es-DO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
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
    return `
      <tr>
        <td style="padding:9px 8px;border-bottom:1px solid #eee;">
          <div style="font-weight:600;">${p.descripcion ?? p.name ?? ""}</div>
          ${p.tipo ? `<div style="font-size:11px;color:#888;text-transform:capitalize;">${String(p.tipo).replace("_", " ")}</div>` : ""}
        </td>
        <td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:center;">${cant}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;">RD$ ${precio.toFixed(2)}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:center;">${p.itbis_aplica ? "18%" : "—"}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">RD$ ${linea.toFixed(2)}</td>
      </tr>`;
  }).join("");

  const banner = esCotizacion
    ? `<div style="background:#fefce8;border:2px solid #eab308;color:#854d0e;text-align:center;padding:12px;font-size:18px;font-weight:900;border-radius:8px;margin:16px 0;">📄 COTIZACIÓN PREVENTIVA — Válida por 15 días</div>`
    : factura.estado === "CANCELADA"
    ? `<div style="background:#fee2e2;border:2px solid #dc2626;color:#dc2626;text-align:center;padding:12px;font-size:18px;font-weight:900;border-radius:8px;margin:16px 0;">⚠️ FACTURA CANCELADA</div>`
    : "";

  // ✅ FIX EDGE/CHROME PRINT: botón manual + autoprint con delay robusto.
  // NO usamos window.open() para imprimir — se llama desde abrirImpresion via iframe.
  const printScript = `
    <script>
      function imprimirAhora() { window.print(); }
      document.addEventListener("DOMContentLoaded", function() {
        setTimeout(function() { window.print(); }, 800);
      });
    <\/script>
  `;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>${esCotizacion ? "Cotización" : "Factura"} ${factura.ncf || ""}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:30px;max-width:780px;margin:auto;}
    .cabecera{display:flex;justify-content:space-between;align-items:flex-start;
      border-bottom:3px solid #111;padding-bottom:18px;margin-bottom:20px;gap:24px;}
    .cab-empresa{flex:1.2;}
    .cab-empresa img{height:56px;margin-bottom:8px;object-fit:contain;}
    .empresa-nombre{font-size:18px;font-weight:900;letter-spacing:.5px;text-transform:uppercase;line-height:1.2;}
    .empresa-meta{font-size:12px;color:#555;margin-top:6px;line-height:1.8;}
    .cab-doc{flex:1;text-align:right;border-left:2px solid #f0f0f0;padding-left:20px;}
    .doc-tipo{font-size:22px;font-weight:900;text-transform:uppercase;color:#111;}
    .doc-num{font-size:14px;color:#444;margin-top:3px;font-weight:600;}
    .doc-meta{font-size:12px;color:#666;margin-top:4px;line-height:1.7;}
    .doc-badge{display:inline-block;background:#111;color:#fff;padding:3px 10px;border-radius:4px;
      font-size:11px;font-weight:700;letter-spacing:.5px;margin-top:6px;}
    .ncf-box{background:#1a1a2e;color:#fff;display:flex;justify-content:space-between;
      align-items:center;padding:14px 20px;border-radius:8px;margin:18px 0;}
    .ncf-label{font-size:10px;letter-spacing:1.5px;opacity:.55;margin-bottom:3px;text-transform:uppercase;}
    .ncf-num{font-size:22px;font-weight:900;letter-spacing:4px;}
    .ncf-right{text-align:right;font-size:12px;color:rgba(255,255,255,.65);line-height:1.8;}
    .dos-col{display:flex;gap:14px;margin-bottom:20px;}
    .info-box{flex:1;background:#f8f8f8;border-radius:8px;padding:14px 16px;border:1px solid #ebebeb;}
    .info-box h3{font-size:10px;text-transform:uppercase;color:#888;margin-bottom:8px;
      letter-spacing:1px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;}
    .info-box p{margin-bottom:4px;font-size:13px;line-height:1.5;}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;}
    thead th{background:#111;color:#fff;padding:10px 8px;font-size:12px;text-align:left;}
    thead th:nth-child(2),thead th:nth-child(4){text-align:center;}
    thead th:nth-child(3),thead th:nth-child(5){text-align:right;}
    .totales{margin-left:auto;width:300px;margin-top:8px;}
    .t-row{display:flex;justify-content:space-between;padding:7px 0;font-size:14px;border-bottom:1px solid #eee;}
    .t-total{font-size:20px;font-weight:900;border-top:3px solid #111;border-bottom:none;
      padding-top:12px;margin-top:6px;}
    .footer{text-align:center;margin-top:30px;padding-top:16px;
      border-top:1px dashed #ccc;color:#777;font-size:12px;line-height:2;}
    .dgii-note{font-size:10.5px;color:#aaa;margin-top:3px;}
    .btn-imprimir{display:block;margin:16px auto 0;padding:12px 32px;background:#111;
      color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;}
    @media print { .btn-imprimir { display:none !important; } }
  </style></head><body>

  <div class="cabecera">
    <div class="cab-empresa">
      <img src="${EMPRESA.logo}" alt="Logo" onerror="this.style.display='none'"/>
      <div class="empresa-nombre">${EMPRESA.nombre}</div>
      <div class="empresa-meta">
        <strong>RNC:</strong> ${EMPRESA.rnc}<br/>
        <strong>Tel:</strong> ${EMPRESA.telefono}<br/>
        ${EMPRESA.direccion}<br/>
        ${EMPRESA.email}
      </div>
    </div>
    <div class="cab-doc">
      <div class="doc-tipo">${esCotizacion ? "Cotización" : "Factura"}</div>
      <div class="doc-num">
        ${esCotizacion ? "PRO-FORMA" : "FAC-" + String(factura.id).padStart(5, "0")}
      </div>
      <div class="doc-meta">
        <strong>Fecha:</strong> ${fecha}<br/>
        ${!esCotizacion ? `<strong>Vence NCF:</strong> ${ncfVence}<br/>` : ""}
        <strong>Método:</strong> ${factura.metodo_pago || factura.method || "EFECTIVO"}<br/>
        ${!esCotizacion ? `<strong>Tipo NCF:</strong> ${factura.ncf_tipo || "B02"}` : ""}
      </div>
      ${!esCotizacion ? `<div class="doc-badge">${factura.ncf_tipo || "B02"}</div>` : ""}
    </div>
  </div>

  ${banner}

  ${!esCotizacion ? `
  <div class="ncf-box">
    <div>
      <div class="ncf-label">Número de Comprobante Fiscal (NCF)</div>
      <div class="ncf-num">${factura.ncf || "—"}</div>
    </div>
    <div class="ncf-right">
      Tipo: ${factura.ncf_tipo || "B02"}<br/>
      Vencimiento: ${ncfVence}<br/>
      ${factura.estado === "CANCELADA" ? "⚠️ CANCELADA" : "✓ Vigente"}
    </div>
  </div>` : ""}

  <div class="dos-col">
    <div class="info-box">
      <h3>${(factura.ncf_tipo && ["B01","B14","B15"].includes(factura.ncf_tipo)) ? "Comprobante Fiscal" : "Cliente"}</h3>
      <p><strong>${factura.cliente_nombre || clienteExtra?.nombre || (factura.cliente_rnc ? "—" : "Consumidor Final")}</strong></p>
      ${(factura.cliente_rnc || clienteExtra?.rnc) ? `<p>RNC/Cédula: ${factura.cliente_rnc || clienteExtra.rnc}</p>` : ""}
      ${clienteExtra?.telefono ? `<p>Tel: ${clienteExtra.telefono}</p>` : ""}
      ${clienteExtra?.direccion ? `<p>${clienteExtra.direccion}</p>` : ""}
    </div>
    <div class="info-box">
      <h3>Vehículo</h3>
      ${factura.vehiculo_info
        ? `<p>🚗 ${factura.vehiculo_info}</p>`
        : "<p style='color:#888'>Sin vehículo asociado</p>"}
    </div>
  </div>

  <table>
    <thead><tr>
      <th>Descripción</th>
      <th style="text-align:center;">Cant.</th>
      <th style="text-align:right;">Precio Unit.</th>
      <th style="text-align:center;">ITBIS</th>
      <th style="text-align:right;">Total</th>
    </tr></thead>
    <tbody>${lineas}</tbody>
  </table>

  <div class="totales">
    <div class="t-row"><span>Subtotal:</span><span>RD$ ${subtotal.toFixed(2)}</span></div>
    <div class="t-row"><span>ITBIS (18%):</span><span>RD$ ${itbis.toFixed(2)}</span></div>
    <div class="t-row t-total"><span>TOTAL:</span><span>RD$ ${total.toFixed(2)}</span></div>
  </div>

  <button class="btn-imprimir" onclick="imprimirAhora()">🖨️ Imprimir / Guardar PDF</button>

  <div class="footer">
    <p>¡Gracias por confiar en <strong>${EMPRESA.nombre}</strong>! · ${EMPRESA.telefono}</p>
    ${esCotizacion ? "<p>Esta cotización tiene una validez de 15 días. Precios sujetos a cambios.</p>" : ""}
    <p class="dgii-note">Documento fiscal emitido conforme a la Norma General 06-2018 de la DGII — República Dominicana</p>
    <p class="dgii-note">Valide este comprobante en: <strong>www.dgii.gov.do</strong></p>
  </div>

  ${printScript}
  </body></html>`;
}

// ✅ FIX EDGE PRINT: en lugar de window.open (bloqueado por Edge), usamos un
// iframe oculto inyectado en el DOM actual. Edge permite imprimir iframes sin popup.
function abrirImpresion(html: string) {
  // Eliminar iframe previo si existe
  const prev = document.getElementById("__print_iframe__");
  if (prev) prev.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__print_iframe__";
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:820px;height:1000px;border:none;opacity:0;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    // Fallback: intentar con window.open igual
    const w = window.open("", "_blank", "width=820,height=1000");
    if (w) { w.document.write(html); w.document.close(); }
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  // Esperar que cargue antes de imprimir
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      // Si falla (CSP o popup blocker), abrir en nueva pestaña como último recurso
      const w = window.open("", "_blank", "width=820,height=1000");
      if (w) { w.document.write(html); w.document.close(); }
    }
  };
}

// ─── TIPOS NCF QUE REQUIEREN RNC ────────────────────────────────────────────
const NCF_REQUIERE_RNC = ["B01", "B14", "B15"];

// ═══════════════════════════════════════════════════════════════════════════
export default function FacturaPage() {
  const [clientes, setClientes]         = useState<any[]>([]);
  const [vehiculos, setVehiculos]       = useState<any[]>([]);
  const [items, setItems]               = useState<any[]>([]);
  const [facturas, setFacturas]         = useState<any[]>([]);
  const [diagnosticos, setDiagnosticos] = useState<any[]>([]);
  const [carrito, setCarrito]           = useState<any[]>([]);

  const [clienteId, setClienteId]             = useState("");
  const [clienteSeleccionado, setClienteSel]  = useState<any>(null);
  const [vehiculoId, setVehiculoId]           = useState("");
  const [method, setMethod]                   = useState("EFECTIVO");
  const [diasCredito, setDiasCredito]         = useState(30);
  const [ncfTipo, setNcfTipo]                 = useState("B02");
  // ✅ NUEVO: RNC manual para cuando no hay cliente seleccionado pero se emite B01/B14/B15
  const [rncManual, setRncManual]         = useState("");
  const [razonSocial, setRazonSocial]     = useState("");
  const [buscandoRNC, setBuscandoRNC]     = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [tab, setTab]                         = useState("nueva");
  const [busqueda, setBusqueda]               = useState("");
  const [busHistorial, setBusHistorial]       = useState("");
  const [ultimaFactura, setUltimaFactura]     = useState<any>(null);
  const [montoRecibido, setMontoRecibido]     = useState("");
  const [diagCargado, setDiagCargado]         = useState<number | null>(null);
  const [cargandoDiag, setCargandoDiag]       = useState(false);

  const [busqRNC, setBusqRNC]     = useState("");
  const [resultRNC, setResultRNC] = useState<any[]>([]);
  const [modoRNC, setModoRNC]     = useState(false);

  const [modalFac, setModalFac]         = useState<any>(null);
  const [modalMethod, setModalMethod]   = useState("EFECTIVO");
  const [modalCliente, setModalCliente] = useState("");

  // ── Carga inicial ────────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      const [cRes, vRes, iRes, fRes, dRes] = await Promise.all([
        fetch(`${API}/clientes`),
        fetch(`${API}/vehiculos`),
        fetch(`${API}/inventario`),
        fetch(`${API}/facturas`),
        fetch(`${API}/diagnosticos`)
      ]);
      setClientes(await cRes.json() || []);
      setVehiculos(await vRes.json() || []);
      setItems(await iRes.json() || []);
      setFacturas(await fRes.json() || []);
      const diags = await dRes.json() || [];

      setDiagnosticos(diags.filter((d: any) =>
        !["FACTURADO", "COMPLETADO"].includes(d.estado)
      ));
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Cuando cambia el tipo NCF, limpiar RNC manual si no aplica ───────────
  useEffect(() => {
    if (!NCF_REQUIERE_RNC.includes(ncfTipo)) { setRncManual(""); setRazonSocial(""); }
  }, [ncfTipo]);

  // ── Consulta DGII por RNC (proxy backend) ───────────────────────────────
  // El backend debe exponer GET /dgii/rnc/:rnc → { nombre, rnc, estado }
  // Si no tienes ese endpoint, la búsqueda simplemente no retorna nada y el
  // usuario escribe el nombre manualmente. No rompe nada.
  const consultarRNC = async (rnc: string) => {
    const limpio = rnc.replace(/[-\s]/g, "");
    if (limpio.length < 9) return;
    setBuscandoRNC(true);
    try {
      const res = await fetch(`${API}/dgii/rnc/${limpio}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.nombre) setRazonSocial(data.nombre);
      }
    } catch { /* silencioso — el usuario escribe manualmente */ }
    finally { setBuscandoRNC(false); }
  };
  const buscarCliente = (q: string) => {
    setBusqRNC(q);
    if (q.length < 2) { setResultRNC([]); return; }
    setResultRNC(
      clientes.filter(c =>
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
    const tipoNcf = c.tipo_cliente === "contribuyente" ? "B01" : "B02";
    setNcfTipo(tipoNcf);
    if (NCF_REQUIERE_RNC.includes(tipoNcf) && c.rnc) setRncManual(c.rnc);
    setRazonSocial(c.nombre || "");
    setBusqRNC("");
    setResultRNC([]);
    setModoRNC(false);
  };

  // ── Cargar diagnóstico ───────────────────────────────────────────────────
  const cargarDiagnostico = async (diag: any) => {
    setCargandoDiag(true);
    try {
      const cli = clientes.find((c: any) => c.id === Number(diag.cliente_id));
      if (cli) { setClienteSel(cli); setClienteId(String(cli.id)); }
      setVehiculoId(String(diag.vehiculo_id));
      setDiagCargado(diag.id);

      let precioMO = Number(diag.costo_estimado || 0);
      let descripcionMO = diag.mano_de_obra_detalle?.trim()
        ? diag.mano_de_obra_detalle
        : diag.tipo_servicio
          ? `Mano de Obra — ${diag.tipo_servicio}`
          : "Mano de Obra Técnica";

      if (!precioMO) {
        try {
          const res = await fetch(`${API}/diagnosticos/${diag.id}`);
          const detalle = await res.json();
          if (detalle.cotizacion) {
            precioMO = Number(detalle.cotizacion.mano_obra || 0);
            if (!detalle.diag?.mano_de_obra_detalle?.trim() && detalle.cotizacion.notas) {
              descripcionMO = detalle.cotizacion.notas;
            }
          }
        } catch (e) {
          console.warn("No se pudo cargar detalle del diagnóstico:", e);
        }
      }

      // ✅ NUEVO: itbis_aplica por defecto false para MO; el usuario puede activarlo desde el carrito
      const itemMO = {
        id:              `MO-${diag.id}`,
        descripcion:     descripcionMO,
        tipo:            "mano_obra",
        precio_unitario: precioMO,
        cantidad:        1,
        itbis_aplica:    false,
        inventario_id:   null,
        _diagId:         diag.id
      };

      setCarrito(prev => [
        itemMO,
        ...prev.filter(p => !String(p.id).startsWith("MO-"))
      ]);
    } finally {
      setCargandoDiag(false);
    }
  };

  // ── Inventario / carrito ──────────────────────────────────────────────────
  const vehiculosFiltrados = vehiculos.filter(v =>
    Number(v.cliente_id) === Number(clienteId)
  );

  const itemsFiltrados = items.filter(i =>
    !busqueda ||
    i.name?.toLowerCase().includes(busqueda.toLowerCase()) ||
    i.code?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const addItem = (item: any) => {
    if (item.stock <= 0) return alert("Sin stock disponible");
    const exists = carrito.find(p => p.id === item.id);
    if (exists) {
      if (exists.cantidad >= item.stock) return alert("Stock insuficiente");
      setCarrito(carrito.map(p =>
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
    if (cant <= 0) { setCarrito(carrito.filter(p => p.id !== id)); return; }
    const orig = items.find(i => i.id === id);
    if (orig && cant > orig.stock) { alert("Stock insuficiente"); return; }
    setCarrito(carrito.map(p => p.id === id ? { ...p, cantidad: cant } : p));
  };

  // ✅ NUEVO: toggle ITBIS para cualquier ítem del carrito (especialmente mano de obra)
  const toggleItbis = (id: any) => {
    setCarrito(carrito.map(p =>
      p.id === id ? { ...p, itbis_aplica: !p.itbis_aplica } : p
    ));
  };

  // ── Totales ───────────────────────────────────────────────────────────────
  const subtotal = carrito.reduce(
    (acc, p) => acc + Number(p.precio_unitario) * Number(p.cantidad), 0
  );
  const itbis = carrito
    .filter(p => p.itbis_aplica)
    .reduce((acc, p) => acc + Number(p.precio_unitario) * Number(p.cantidad) * 0.18, 0);
  const total  = subtotal + itbis;
  const vuelto = Number(montoRecibido || 0) - total;

  // ── RNC y nombre efectivos a usar en la factura ───────────────────────────
  const rncEfectivo    = clienteSeleccionado?.rnc || rncManual || null;
  const nombreEfectivo = clienteSeleccionado?.nombre || razonSocial || "";

  // ── Cotización (sin guardar en BD) ────────────────────────────────────────
  const handleCotizacion = () => {
    if (carrito.length === 0) return alert("Carrito vacío");
    if (NCF_REQUIERE_RNC.includes(ncfTipo) && !rncEfectivo) {
      return alert("Este tipo de NCF requiere el RNC/Cédula del cliente.");
    }
    const veh = vehiculosFiltrados.find(v => v.id === Number(vehiculoId));
    const mockFac = {
      subtotal, itbis, total,
      metodo_pago: method,
      vehiculo_info: veh ? `${veh.marca} ${veh.modelo} · Placa: ${veh.placa}` : "",
      cliente_nombre: clienteSeleccionado?.nombre || "Consumidor Final",
      cliente_rnc:    rncEfectivo,
      created_at: new Date()
    };
    abrirImpresion(generarHTML(mockFac, carrito, clienteSeleccionado, true));
  };

  // ── Generar factura real ──────────────────────────────────────────────────
  const generarFactura = async () => {
    if (carrito.length === 0) return alert("Carrito vacío");
    if (NCF_REQUIERE_RNC.includes(ncfTipo) && !rncEfectivo) {
      return alert(`El tipo NCF ${ncfTipo} requiere RNC/Cédula del cliente. Por favor ingrésalo.`);
    }
    if (Number(montoRecibido) > 0 && vuelto < 0)
      return alert(`Monto insuficiente. Faltan RD$ ${Math.abs(vuelto).toFixed(2)}`);

    setLoading(true);
    const snap = [...carrito];
    try {
      const veh = vehiculosFiltrados.find(v => v.id === Number(vehiculoId));

      const body = {
        items: snap.map(p => ({
          tipo:            p.tipo,
          descripcion:     p.descripcion,
          cantidad:        p.cantidad,
          precio_unitario: p.precio_unitario,
          itbis_aplica:    p.itbis_aplica,
          inventario_id:   p.inventario_id || null
        })),
        metodo_pago:    method,
        dias_credito:   method === "CREDITO" ? diasCredito : undefined,
        ncf_tipo:       ncfTipo,
        subtotal,
        itbis,
        total,
        cliente_id:     clienteId ? Number(clienteId) : null,
        cliente_nombre: nombreEfectivo || "Consumidor Final",
        cliente_rnc:    rncEfectivo,
        vehiculo_id:    vehiculoId ? Number(vehiculoId) : null,
        vehiculo_info:  veh ? `${veh.marca} ${veh.modelo} · Placa: ${veh.placa}` : null,
        diagnostico_id: diagCargado || null
      };

      const res  = await fetch(`${API}/facturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }

      setUltimaFactura({ factura: data, items: snap });
      abrirImpresion(generarHTML(data, snap, clienteSeleccionado || { rnc: rncManual }, false));

      setCarrito([]); setClienteId(""); setClienteSel(null);
      setVehiculoId(""); setMontoRecibido(""); setDiagCargado(null);
      setRncManual(""); setRazonSocial(""); setNcfTipo("B02");
      fetchData();
    } catch (e: any) { alert("Error generando factura: " + e.message); }
    finally { setLoading(false); }
  };

  // ── Historial ─────────────────────────────────────────────────────────────
  const reimprimirFactura = async (fac: any) => {
    try {
      const res  = await fetch(`${API}/facturas/${fac.id}/items`);
      const data = await res.json();
      abrirImpresion(generarHTML(fac, data.items || [], {}, false));
    } catch { alert("Error al cargar items"); }
  };

  const cancelarFactura = async (fac: any) => {
    if (!confirm(`¿Cancelar FAC-${String(fac.id).padStart(5,"0")}?`)) return;
    await fetch(`${API}/facturas/${fac.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "CANCELADA" })
    });
    fetchData();
  };

  const eliminarFactura = async (id: number) => {
    if (!confirm(`¿Eliminar permanentemente FAC-${String(id).padStart(5,"0")}?`)) return;
    await fetch(`${API}/facturas/${id}`, { method: "DELETE" });
    fetchData();
  };

  const guardarEdicion = async () => {
    if (!modalFac) return;
    await fetch(`${API}/facturas/${modalFac.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metodo_pago: modalMethod, cliente_nombre: modalCliente })
    });
    setModalFac(null);
    fetchData();
  };

  const facturasFiltradas = facturas.filter(f =>
    !busHistorial ||
    f.cliente_nombre?.toLowerCase().includes(busHistorial.toLowerCase()) ||
    f.ncf?.toLowerCase().includes(busHistorial.toLowerCase())
  );

  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div style={container}>
      <h1 style={title}>🧾 Facturación — {EMPRESA.nombre}</h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {["nueva", "historial"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...tabBtn,
              background: tab === t ? "#111827" : "#fff",
              color:      tab === t ? "#fff"    : "#111" }}>
            {t === "nueva"
              ? "➕ Nueva Factura / Cotización"
              : `📋 Historial (${facturas.length})`}
          </button>
        ))}
      </div>

      {/* ══════════════ NUEVA FACTURA ══════════════ */}
      {tab === "nueva" && (
        <div style={grid}>

          {/* COLUMNA IZQUIERDA */}
          <div>

            {/* CARGAR DIAGNÓSTICO */}
            <div style={{ ...card, marginBottom: 16, border: "2px solid #3b82f6" }}>
              <h2 style={{ ...cardTitle, color: "#1e40af" }}>📋 Cargar Diagnóstico Técnico</h2>
              <p style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
                Selecciona un diagnóstico para cargar la mano de obra automáticamente.
              </p>
              {diagnosticos.length === 0 ? (
                <p style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>
                  Sin diagnósticos pendientes de facturar.
                </p>
              ) : (
                <select style={input} value="" onChange={async e => {
                  const d = diagnosticos.find((x: any) => x.id === Number(e.target.value));
                  if (d) await cargarDiagnostico(d);
                }} disabled={cargandoDiag}>
                  <option value="">
                    {cargandoDiag ? "Cargando..." : "— Seleccionar diagnóstico —"}
                  </option>
                  {diagnosticos.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      #{d.id} · {d.tipo_servicio} · {d.cliente_nombre} · {d.vehiculo_info}
                      {d.costo_estimado ? ` · RD$${Number(d.costo_estimado).toLocaleString()}` : ""}
                    </option>
                  ))}
                </select>
              )}
              {diagCargado && (
                <div style={{ marginTop: 8, background: "#eff6ff", border: "1px solid #bfdbfe",
                  borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#1e40af",
                  display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>✅ Diagnóstico #{diagCargado} cargado</span>
                  <button onClick={() => {
                    setDiagCargado(null);
                    setCarrito(prev => prev.filter(p => !String(p.id).startsWith("MO-")));
                  }} style={{ background: "none", border: "none", color: "#ef4444",
                    cursor: "pointer", fontWeight: 700 }}>✕</button>
                </div>
              )}
            </div>

            {/* CLIENTE */}
            <div style={{ ...card, marginBottom: 16 }}>
              <h2 style={cardTitle}>👤 Cliente y Documento</h2>

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {["Lista", "Buscar por nombre / RNC"].map((label, i) => (
                  <button key={i} onClick={() => setModoRNC(i === 1)}
                    style={{ ...tabBtn, fontSize: 12, padding: "7px 14px",
                      background: modoRNC === (i === 1) ? "#111827" : "#fff",
                      color:      modoRNC === (i === 1) ? "#fff"    : "#111" }}>
                    {label}
                  </button>
                ))}
              </div>

              {!modoRNC && (
                <>
                  <label style={labelS}>Cliente</label>
                  <select value={clienteId} onChange={e => {
                    setClienteId(e.target.value);
                    setVehiculoId("");
                    const cli = clientes.find((c: any) => c.id === Number(e.target.value));
                    setClienteSel(cli || null);
                    if (cli?.tipo_cliente === "contribuyente") {
                      setNcfTipo("B01");
                      if (cli.rnc) setRncManual(cli.rnc);
                    } else {
                      setRncManual("");
                    }
                    setRazonSocial(cli?.nombre || "");
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

              {modoRNC && (
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <label style={labelS}>Buscar por nombre o RNC</label>
                  <input value={busqRNC} onChange={e => buscarCliente(e.target.value)}
                    placeholder="Escribe nombre o RNC..." style={input} />
                  {resultRNC.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0,
                      background: "#fff", border: "1px solid #ddd", borderRadius: 8,
                      zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,.15)",
                      maxHeight: 240, overflowY: "auto" }}>
                      {resultRNC.map((c: any) => (
                        <div key={c.id} onClick={() => seleccionarCliente(c)}
                          style={{ padding: "11px 14px", cursor: "pointer",
                            borderBottom: "1px solid #f0f0f0", fontSize: 13,
                            display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontWeight: 600 }}>{c.nombre}</span>
                          <span style={{ color: "#888", fontSize: 12 }}>
                            {c.rnc ? `RNC: ${c.rnc}` : c.telefono}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {clienteSeleccionado && (
                    <div style={{ background: "#f0fdf4", border: "1px solid #86efac",
                      borderRadius: 8, padding: "10px 14px", marginTop: 8,
                      display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{clienteSeleccionado.nombre}</div>
                        <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                          {clienteSeleccionado.rnc ? `RNC: ${clienteSeleccionado.rnc} · ` : ""}
                          {clienteSeleccionado.telefono}
                        </div>
                      </div>
                      <button onClick={() => { setClienteSel(null); setClienteId(""); setRncManual(""); setRazonSocial(""); }}
                        style={{ background: "none", border: "none", color: "#ef4444",
                          cursor: "pointer", fontSize: 18 }}>✕</button>
                    </div>
                  )}
                </div>
              )}

              {clienteId && (
                <>
                  <label style={labelS}>Vehículo</label>
                  <select value={vehiculoId} onChange={e => setVehiculoId(e.target.value)} style={input}>
                    <option value="">— Sin vehículo —</option>
                    {vehiculosFiltrados.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.marca} {v.modelo} · {v.placa}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelS}>Tipo NCF</label>
                  <select value={ncfTipo} onChange={e => setNcfTipo(e.target.value)} style={input}>
                    <option value="B02">B02 — Consumidor Final</option>
                    <option value="B01">B01 — Crédito Fiscal</option>
                    <option value="B14">B14 — Régimen Especial</option>
                    <option value="B15">B15 — Gubernamental</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelS}>Método de pago</label>
                  <select value={method} onChange={e => setMethod(e.target.value)} style={input}>
                    <option value="EFECTIVO">💵 Efectivo</option>
                    <option value="TARJETA">💳 Tarjeta</option>
                    <option value="TRANSFERENCIA">🏦 Transferencia</option>
                    <option value="CHEQUE">📄 Cheque</option>
                    <option value="CREDITO">🗓️ Crédito</option>
                  </select>
                  {method === "CREDITO" && (
                    <div style={{ marginTop: 8, background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px" }}>
                      <label style={{ ...labelS, color: "#92400e", marginBottom: 4 }}>📅 Días de crédito</label>
                      <select value={diasCredito} onChange={e => setDiasCredito(Number(e.target.value))} style={{ ...input, marginBottom: 0 }}>
                        <option value={15}>15 días</option>
                        <option value={30}>30 días</option>
                        <option value={45}>45 días</option>
                        <option value={60}>60 días</option>
                        <option value={90}>90 días</option>
                      </select>
                      <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>
                        ⚠️ Esta factura generará una cuenta por cobrar automáticamente.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ✅ NUEVO: Campo RNC + Razón Social visible solo cuando NCF lo requiere */}
              {NCF_REQUIERE_RNC.includes(ncfTipo) && (
                <div style={{ background: "#fef3c7", border: "1px solid #fde68a",
                  borderRadius: 10, padding: "12px 14px", marginTop: 4 }}>
                  <label style={{ ...labelS, color: "#92400e" }}>
                    🏢 RNC / Cédula <span style={{ color: "#dc2626" }}>*</span>
                    <span style={{ fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
                      (requerido para {ncfTipo})
                    </span>
                  </label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      value={clienteSeleccionado?.rnc || rncManual}
                      onChange={e => {
                        if (!clienteSeleccionado) setRncManual(e.target.value);
                      }}
                      onBlur={e => {
                        if (!clienteSeleccionado && e.target.value) consultarRNC(e.target.value);
                      }}
                      placeholder="Ej: 1-01-12345-6"
                      style={{
                        ...input, marginBottom: 0, flex: 1,
                        borderColor: (!clienteSeleccionado?.rnc && !rncManual) ? "#f87171" : "#fde68a",
                        background: "#fffbeb", fontWeight: 600
                      }}
                      readOnly={!!clienteSeleccionado?.rnc}
                    />
                    {!clienteSeleccionado && (
                      <button
                        type="button"
                        onClick={() => consultarRNC(rncManual)}
                        disabled={buscandoRNC || rncManual.length < 6}
                        style={{ padding: "0 12px", background: "#92400e", color: "#fff",
                          border: "none", borderRadius: 8, cursor: "pointer",
                          fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                          opacity: (buscandoRNC || rncManual.length < 6) ? 0.5 : 1 }}>
                        {buscandoRNC ? "..." : "🔍 Consultar"}
                      </button>
                    )}
                  </div>

                  {/* Campo Razón Social */}
                  <label style={{ ...labelS, color: "#92400e", marginTop: 10 }}>
                    🏷️ Razón Social / Nombre
                    {buscandoRNC && <span style={{ fontWeight: 400, marginLeft: 6, fontSize: 11 }}>Consultando DGII...</span>}
                  </label>
                  <input
                    value={clienteSeleccionado?.nombre || razonSocial}
                    onChange={e => { if (!clienteSeleccionado) setRazonSocial(e.target.value); }}
                    placeholder="Nombre de la empresa o persona"
                    style={{
                      ...input, marginBottom: 0,
                      borderColor: "#fde68a", background: "#fffbeb"
                    }}
                    readOnly={!!clienteSeleccionado?.nombre}
                  />

                  {clienteSeleccionado?.rnc && (
                    <p style={{ fontSize: 11, color: "#78350f", marginTop: 6 }}>
                      ✅ RNC y nombre tomados del cliente seleccionado
                    </p>
                  )}
                  {!clienteSeleccionado?.rnc && !rncManual && (
                    <p style={{ fontSize: 11, color: "#dc2626", marginTop: 6 }}>
                      ⚠️ Sin RNC no podrás generar este comprobante
                    </p>
                  )}
                  {!clienteSeleccionado && rncManual && !razonSocial && (
                    <p style={{ fontSize: 11, color: "#b45309", marginTop: 6 }}>
                      💡 Escribe la razón social manualmente o presiona "Consultar" para buscarla en DGII
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* REPUESTOS */}
            <div style={card}>
              <h2 style={cardTitle}>🔩 Repuestos del Inventario</h2>
              <input placeholder="🔍 Buscar repuesto o código..." value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{ ...input, marginBottom: 12 }} />
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                {itemsFiltrados.map((i: any) => (
                  <div key={i.id} style={productoRow}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{i.name}</div>
                      <div style={{ fontSize: 12, color: i.stock > 0 ? "#10b981" : "#e74c3c" }}>
                        Stock: {i.stock}{i.code ? ` · Cód: ${i.code}` : ""}
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
                {itemsFiltrados.length === 0 && (
                  <p style={{ color: "#888", textAlign: "center", padding: 20, fontSize: 13 }}>
                    Sin resultados
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA — CARRITO */}
          <div style={card}>
            <h2 style={cardTitle}>🛒 Detalle de Servicios y Piezas</h2>

            {carrito.length === 0 ? (
              <div style={{ color: "#888", textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
                <div>Carrito vacío</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>
                  Carga un diagnóstico o agrega repuestos
                </div>
              </div>
            ) : (
              carrito.map(p => (
                <div key={p.id} style={carritoRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 10,
                        background: p.tipo === "mano_obra" ? "#fef3c7" : "#dcfce7",
                        color:      p.tipo === "mano_obra" ? "#92400e" : "#166534",
                        padding: "2px 7px", borderRadius: 4, fontWeight: 700
                      }}>
                        {p.tipo === "mano_obra" ? "MANO OBRA" : "REPUESTO"}
                      </span>
                      {/* ✅ NUEVO: Toggle ITBIS en el carrito */}
                      <button
                        onClick={() => toggleItbis(p.id)}
                        title="Activar / desactivar ITBIS 18%"
                        style={{
                          fontSize: 10,
                          padding: "2px 7px",
                          borderRadius: 4,
                          fontWeight: 700,
                          border: "none",
                          cursor: "pointer",
                          background: p.itbis_aplica ? "#dcfce7" : "#f1f5f9",
                          color:      p.itbis_aplica ? "#166534" : "#64748b"
                        }}>
                        {p.itbis_aplica ? "✓ ITBIS 18%" : "+ ITBIS"}
                      </button>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.descripcion}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      RD$ {Number(p.precio_unitario).toFixed(2)} c/u ·{" "}
                      {p.itbis_aplica
                        ? `ITBIS: RD$ ${(Number(p.precio_unitario) * p.cantidad * 0.18).toFixed(2)}`
                        : "Sin ITBIS"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => updateCantidad(p.id, p.cantidad - 1)} style={btnQty}>−</button>
                    <span style={{ fontWeight: 700, minWidth: 24, textAlign: "center" }}>{p.cantidad}</span>
                    <button onClick={() => updateCantidad(p.id, p.cantidad + 1)} style={btnQty}>+</button>
                    <span style={{ minWidth: 90, textAlign: "right", fontWeight: 600 }}>
                      RD$ {(Number(p.precio_unitario) * Number(p.cantidad)).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}

            {/* TOTALES */}
            <div style={totalesBox}>
              <div style={totalesRow}><span>Subtotal</span><span>RD$ {subtotal.toFixed(2)}</span></div>
              <div style={totalesRow}><span>ITBIS (18%)</span><span>RD$ {itbis.toFixed(2)}</span></div>
              <div style={{ ...totalesRow, fontWeight: 700, fontSize: 18,
                borderTop: "2px solid #e2e8f0", paddingTop: 10, marginTop: 4 }}>
                <span>TOTAL</span>
                <span>RD$ {total.toFixed(2)}</span>
              </div>
            </div>

            {/* VUELTO */}
            <div style={vueltoBx}>
              <label style={labelS}>💵 Monto recibido (RD$)</label>
              <input type="number" value={montoRecibido}
                onChange={e => setMontoRecibido(e.target.value)}
                placeholder="0.00"
                style={{ ...input, fontSize: 18, fontWeight: 700, borderColor: "#fde68a" }} />
              {Number(montoRecibido) > 0 && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 8,
                  textAlign: "center",
                  background: vuelto >= 0 ? "#dcfce7" : "#fee2e2",
                  color:      vuelto >= 0 ? "#166534" : "#dc2626",
                  fontWeight: 800, fontSize: 20 }}>
                  {vuelto >= 0
                    ? `Vuelto: RD$ ${vuelto.toFixed(2)}`
                    : `Faltan: RD$ ${Math.abs(vuelto).toFixed(2)}`}
                </div>
              )}
            </div>

            {/* BOTONES */}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={handleCotizacion}
                style={{ ...btnFacturar, background: "#64748b", marginTop: 0 }}>
                📄 Cotización
              </button>
              <button onClick={generarFactura}
                disabled={loading || carrito.length === 0}
                style={{ ...btnFacturar,
                  background: carrito.length === 0 ? "#aaa" : "#10b981",
                  marginTop: 0, flex: 2 }}>
                {loading ? "Procesando..." : "🖨️ Facturar"}
              </button>
            </div>

            {ultimaFactura && (
              <button onClick={() =>
                abrirImpresion(generarHTML(
                  ultimaFactura.factura, ultimaFactura.items, {}, false
                ))
              } style={btnReimprimir}>
                🔁 Reimprimir FAC-{String(ultimaFactura.factura.id).padStart(5, "0")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ HISTORIAL ══════════════ */}
      {tab === "historial" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 16 }}>
            <h2 style={cardTitle}>📋 Historial de Facturas</h2>
            <input placeholder="Buscar por cliente o NCF..."
              value={busHistorial}
              onChange={e => setBusHistorial(e.target.value)}
              style={{ ...input, width: 280, marginBottom: 0 }} />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {["Factura","NCF","Tipo","Cliente","RNC","Método","Total","Estado","Fecha","Acciones"]
                    .map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {facturasFiltradas.map((f: any) => {
                  const cancelada = f.estado === "CANCELADA";
                  return (
                    <tr key={f.id} style={{ opacity: cancelada ? 0.6 : 1 }}>
                      <td style={td}><b>FAC-{String(f.id).padStart(5,"0")}</b></td>
                      <td style={{ ...td, fontSize: 11, fontFamily: "monospace" }}>{f.ncf}</td>
                      <td style={td}>{f.ncf_tipo}</td>
                      <td style={td}>{f.cliente_nombre}</td>
                      <td style={{ ...td, fontSize: 12, color: "#888" }}>{f.cliente_rnc || "—"}</td>
                      <td style={td}>{f.metodo_pago}</td>
                      <td style={{ ...td, fontWeight: 700 }}>RD$ {Number(f.total).toFixed(2)}</td>
                      <td style={td}>{cancelada ? "🔴 CANCELADA" : "🟢 ACTIVA"}</td>
                      <td style={{ ...td, fontSize: 11 }}>
                        {f.created_at ? new Date(f.created_at).toLocaleString("es-DO") : "—"}
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => reimprimirFactura(f)} style={btnAcc("#111827")}>🖨️</button>
                          {!cancelada && (
                            <button onClick={() => cancelarFactura(f)} style={btnAcc("#f59e0b")}>⛔</button>
                          )}
                          <button onClick={() => eliminarFactura(f.id)} style={btnAcc("#dc2626")}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {facturasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", color: "#888", padding: 32 }}>
                      Sin facturas registradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════ MODAL EDITAR ══════════════ */}
      {modalFac && (
        <div style={overlay}>
          <div style={modal}>
            <h2 style={{ marginBottom: 16 }}>✏️ Editar Factura</h2>
            <label style={labelS}>Cliente</label>
            <input value={modalCliente} onChange={e => setModalCliente(e.target.value)} style={input} />
            <label style={labelS}>Método de pago</label>
            <select value={modalMethod} onChange={e => setModalMethod(e.target.value)} style={input}>
              <option value="EFECTIVO">💵 Efectivo</option>
              <option value="TARJETA">💳 Tarjeta</option>
              <option value="TRANSFERENCIA">🏦 Transferencia</option>
            </select>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button onClick={guardarEdicion}
                style={{ flex: 1, padding: 12, background: "#111827", color: "#fff",
                  borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700 }}>
                💾 Guardar
              </button>
              <button onClick={() => setModalFac(null)}
                style={{ flex: 1, padding: 12, background: "#eee", borderRadius: 8,
                  border: "none", cursor: "pointer" }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ESTILOS ───────────────────────────────────────────────────────────────
const container: React.CSSProperties   = { padding: 20, background: "#f5f7fb", minHeight: "100vh" };
const title: React.CSSProperties       = { fontSize: 24, fontWeight: "bold", marginBottom: 20 };
const grid: React.CSSProperties        = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 };
const card: React.CSSProperties        = { background: "#fff", padding: 20, borderRadius: 15, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" };
const cardTitle: React.CSSProperties   = { marginBottom: 14, fontSize: 18, fontWeight: 600 };
const tabBtn: React.CSSProperties      = { padding: "10px 20px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", fontWeight: 600 };
const labelS: React.CSSProperties      = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#555" };
const input: React.CSSProperties       = { display: "block", marginBottom: 12, padding: 12, width: "100%", borderRadius: 8, border: "1px solid #ddd", boxSizing: "border-box", fontSize: 14 };
const productoRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0f0f0" };
const carritoRow: React.CSSProperties  = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0f0f0", gap: 8 };
const totalesBox: React.CSSProperties  = { marginTop: 16, padding: 16, background: "#f8fafc", borderRadius: 10 };
const totalesRow: React.CSSProperties  = { display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 15 };
const vueltoBx: React.CSSProperties    = { marginTop: 12, padding: 14, background: "#fefce8", borderRadius: 10, border: "1px solid #fde68a" };
const btnAdd: React.CSSProperties      = { padding: "6px 14px", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 };
const btnQty: React.CSSProperties      = { padding: "2px 10px", background: "#f1f5f9", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };
const btnFacturar: React.CSSProperties = { padding: 14, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", width: "100%", marginTop: 16, fontSize: 16, fontWeight: 700 };
const btnReimprimir: React.CSSProperties = { padding: 10, background: "#f1f5f9", color: "#111", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", width: "100%", marginTop: 10, fontSize: 13 };
const btnAcc = (bg: string): React.CSSProperties => ({ padding: "5px 9px", background: bg, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 });
const tableStyle: React.CSSProperties  = { width: "100%", borderCollapse: "collapse" };
const th: React.CSSProperties          = { textAlign: "left", padding: "10px 12px", background: "#f1f5f9", fontSize: 13, whiteSpace: "nowrap" };
const td: React.CSSProperties          = { padding: "10px 12px", borderBottom: "1px solid #eee", fontSize: 13 };
const overlay: React.CSSProperties     = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modal: React.CSSProperties       = { background: "#fff", padding: 28, borderRadius: 16, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };
