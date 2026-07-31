"use client";
import { useEffect, useState, useCallback } from "react";
import { API_URL as API } from "@/config";

const TELEFONO_TALLER = "849-569-2027";

const fmtDate = (d: string) =>
  d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("es-DO", { day: "2-digit", month: "long" }) : "próximamente";

const TIPO_LABEL: Record<string, string> = {
  CAMBIO_ACEITE: "Cambio de Aceite", FILTROS: "Filtros", FRENOS: "Frenos",
  CORREAS: "Correas", BUJIAS: "Bujías", ALINEACION: "Alineación",
  TRANSMISION: "Transmisión", AC: "Aire Acondicionado", SUSPENSION: "Suspensión",
  DIAGNOSTICO: "Diagnóstico", GOMAS: "Gomas / Neumáticos", BATERIA: "Batería",
  REFRIGERANTE: "Refrigerante", LAVADO: "Lavado", OTRO: "Mantenimiento",
};

// ── PLANTILLAS PREDISEÑADAS ──────────────────────────────────────────
// {nombre} {vehiculo} {servicio} {fecha} {hora} se reemplazan automáticamente
const PLANTILLAS: Record<string, { id: string; nombre: string; texto: string }[]> = {
  mantenimiento: [
    { id: "recordatorio", nombre: "🔔 Recordatorio estándar",
      texto: "Hola {nombre} 👋, le saludamos de *Sólido Auto Servicio*.\n\nLe recordamos que su vehículo *{vehiculo}* tiene programado el servicio de *{servicio}* para el *{fecha}*.\n\n¿Desea agendar su cita? Responda este mensaje o llámenos al " + TELEFONO_TALLER + ". ¡Con gusto le atendemos! 🚗" },
    { id: "vencido", nombre: "🔴 Servicio vencido",
      texto: "Hola {nombre} 👋, le saludamos de *Sólido Auto Servicio*.\n\nNotamos que el servicio de *{servicio}* de su *{vehiculo}* venció el *{fecha}*. Mantenerlo al día protege su motor y evita gastos mayores. 🛡️\n\nReserve su espacio respondiendo este mensaje o al " + TELEFONO_TALLER + ". ¡Le esperamos!" },
    { id: "promo", nombre: "🎁 Con incentivo",
      texto: "Hola {nombre} 👋, ¡de *Sólido Auto Servicio* para usted!\n\nSu *{vehiculo}* está listo para su *{servicio}* ({fecha}). Este mes, al realizarlo con nosotros, el *lavado va por la casa* 🚿✨.\n\nAgende respondiendo este mensaje o al " + TELEFONO_TALLER + "." },
  ],
  // Alertas por kilometraje. Además de {nombre} y {vehiculo}, estas plantillas
  // usan {km} (kilometraje estimado hoy) y {faltan} (km de más o de menos).
  km: [
    { id: "vencido_km", nombre: "🔴 Aceite vencido por km",
      texto: "Hola {nombre} 👋, le saludamos de *Sólido Auto Servicio*.\n\nSegún nuestro registro, su *{vehiculo}* ya alcanzó los *{km} km* aproximadamente, y el cambio de aceite estaba programado para los *{proximo} km*.\n\nRodar con el aceite vencido desgasta el motor y termina saliendo mucho más caro. 🛡️\n\n¿Le agendamos esta semana? Responda este mensaje o llámenos al " + TELEFONO_TALLER + "." },
    { id: "por_vencer_km", nombre: "🟡 Le faltan pocos km",
      texto: "Hola {nombre} 👋, de *Sólido Auto Servicio*.\n\nSu *{vehiculo}* va por los *{km} km* y le faltan apenas *{faltan} km* para el próximo cambio de aceite.\n\nSi quiere, le apartamos el espacio desde ya para que no se le pase. 🗓️\n\nResponda este mensaje o llámenos al " + TELEFONO_TALLER + "." },
    { id: "aprovechar_visita", nombre: "🔧 Aprovechar su visita",
      texto: "Hola {nombre} 👋, le saludamos de *Sólido Auto Servicio*.\n\nRevisando el historial de su *{vehiculo}* notamos que el cambio de aceite ya está vencido (va por los *{km} km*).\n\nComo ya nos visitó hace poco, si nos lo trae esta semana se lo hacemos de una vez y le ahorramos el viaje. 🚗\n\nResponda este mensaje o llámenos al " + TELEFONO_TALLER + "." },
  ],
  cita: [
    { id: "confirmacion", nombre: "📅 Confirmar cita",
      texto: "Hola {nombre} 👋, le saludamos de *Sólido Auto Servicio*.\n\nLe recordamos su cita:\n📅 *{fecha}* a las *{hora}*\n🚗 {vehiculo}\n🔧 {servicio}\n\nSi necesita reprogramar, responda este mensaje o llámenos al " + TELEFONO_TALLER + ". ¡Le esperamos!" },
    { id: "manana", nombre: "🌅 Es mañana",
      texto: "Hola {nombre} 👋, de *Sólido Auto Servicio*.\n\n¡Su cita es *mañana {fecha} a las {hora}*! 🗓️\n🚗 {vehiculo} — {servicio}\n\nSi surge algún inconveniente avísenos al " + TELEFONO_TALLER + ". ¡Le esperamos!" },
  ],
  seguimiento: [
    { id: "satisfaccion", nombre: "⭐ Cómo le fue",
      texto: "Hola {nombre} 👋, de *Sólido Auto Servicio*.\n\nHace unos días le entregamos su *{vehiculo}* y queremos saber: ¿cómo se ha comportado? ¿Todo en orden? 🚗\n\nSu opinión nos ayuda a mejorar. Si nota cualquier detalle, respóndanos — estamos para servirle. ¡Gracias por su confianza! 🙏" },
    { id: "garantia", nombre: "🛡️ Recordar garantía",
      texto: "Hola {nombre} 👋, de *Sólido Auto Servicio*.\n\nRecuerde que el trabajo realizado a su *{vehiculo}* tiene garantía. Si nota algo fuera de lo normal, tráigalo sin costo de revisión. 🛡️\n\nEstamos al " + TELEFONO_TALLER + ". ¡Gracias por preferirnos!" },
  ],
};

function armarMensaje(plantilla: string, datos: Record<string, string>) {
  return plantilla
    .replace(/\{nombre\}/g,   datos.nombre   || "cliente")
    .replace(/\{vehiculo\}/g, datos.vehiculo || "su vehículo")
    .replace(/\{servicio\}/g, datos.servicio || "mantenimiento")
    .replace(/\{fecha\}/g,    datos.fecha    || "próximamente")
    .replace(/\{hora\}/g,     datos.hora     || "")
    // Solo se usan en las alertas por kilometraje
    .replace(/\{km\}/g,       datos.km       || "—")
    .replace(/\{proximo\}/g,  datos.proximo  || "—")
    .replace(/\{faltan\}/g,   datos.faltan   || "—");
}

type Seccion = "mantenimiento" | "km" | "cita" | "seguimiento";

export default function RecordatoriosPage() {
  const [data, setData]       = useState<any>({ mantenimientos: [], km: [], citas: [], seguimientos: [] });
  const [loading, setLoading] = useState(true);
  const [seccion, setSeccion] = useState<Seccion>("mantenimiento");
  const [plantillaSel, setPlantillaSel] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ titulo: string; mensaje: string } | null>(null);
  const [enviados, setEnviados] = useState<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      // Las alertas por kilometraje viven en otra ruta porque salen de una
      // vista distinta (proyección de uso), no de mantenimiento_preventivo.
      const [r, rKm] = await Promise.all([
        fetch(`${API}/recordatorios`),
        fetch(`${API}/mantenimiento/alertas-km`).catch(() => null),
      ]);
      const d = await r.json();

      let alertasKm: any[] = [];
      if (rKm && rKm.ok) {
        const crudo = await rKm.json();
        // La vista trae otros nombres de campo. Se normalizan aquí para que la
        // tabla de abajo funcione igual que con las demás secciones.
        alertasKm = (Array.isArray(crudo) ? crudo : []).map((a: any) => ({
          ...a,
          id:               a.vehiculo_id,
          cliente_nombre:   a.cliente,
          cliente_telefono: a.telefono,
          vehiculo_info:    [a.vehiculo, a.placa].filter(Boolean).join(" · "),
        }));
      }

      setData({
        mantenimientos: d.mantenimientos || [],
        km:             alertasKm,
        citas:          d.citas || [],
        seguimientos:   d.seguimientos || [],
      });
    } catch { /* silencioso */ }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const miles = (n: any) => Number(n || 0).toLocaleString("es-DO");

  const datosDe = (tipo: Seccion, item: any): Record<string, string> => ({
    nombre:   item.cliente_nombre,
    vehiculo: item.vehiculo_info,
    servicio: tipo === "km"
      ? "cambio de aceite"
      : (TIPO_LABEL[item.tipo_servicio] || item.tipo_servicio || item.descripcion || "mantenimiento"),
    fecha:    fmtDate(tipo === "cita" ? item.fecha : tipo === "km" ? item.fecha_ultimo_cambio : item.proximo_fecha),
    hora:     item.hora || "",
    // Solo aplican a las alertas por kilometraje
    km:       miles(item.km_estimado_hoy),
    proximo:  miles(item.km_proximo_cambio),
    faltan:   miles(Math.abs(Number(item.km_restantes || 0))),
  });

  // Plantilla sugerida por defecto. En las alertas de kilometraje depende del
  // semáforo: no se le escribe igual a quien ya está vencido que a quien le
  // faltan 300 km.
  const plantillaPorDefecto = (tipo: Seccion, item: any) => {
    if (tipo === "km") return item.estado === "POR_VENCER" ? "por_vencer_km" : "vencido_km";
    return PLANTILLAS[tipo][0].id;
  };

  const mensajeDe = (tipo: Seccion, item: any) => {
    const lista = PLANTILLAS[tipo];
    const sel = plantillaSel[`${tipo}-${item.id}`] || plantillaPorDefecto(tipo, item);
    const pl = lista.find(p => p.id === sel) || lista[0];
    return armarMensaje(pl.texto, datosDe(tipo, item));
  };

  const enviar = async (tipo: Seccion, item: any) => {
    if (!item.cliente_telefono) return alert("Este cliente no tiene teléfono registrado.");
    const msg = mensajeDe(tipo, item);
    window.open(`https://wa.me/${item.cliente_telefono.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
    // Memoria: marcar como enviado + registrar en la ficha del cliente
    await fetch(`${API}/recordatorios/enviado`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo, id: tipo === "seguimiento" ? item.orden_id : item.id,
        cliente_id: item.cliente_id, vehiculo_id: item.vehiculo_id || null, mensaje: msg,
      }),
    });
    setEnviados(prev => new Set(prev).add(`${tipo}-${item.id}`));
  };

  const items: any[] =
    seccion === "mantenimiento" ? data.mantenimientos :
    seccion === "km" ? data.km :
    seccion === "cita" ? data.citas : data.seguimientos;

  const pendientes = (arr: any[], flag: string) => arr.filter((x: any) => !x[flag]).length;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>💬 Recordatorios</h1>
          <p style={S.subtitle}>SÓLIDO AUTO SERVICIO — Centro de comunicación con el cliente (WhatsApp con un clic)</p>
        </div>
        <button onClick={cargar} style={S.btnPrimary}>🔄 Actualizar</button>
      </div>

      <div style={S.kpiRow}>
        <KpiCard icon="🔧" label="Mantenimientos por avisar" value={pendientes(data.mantenimientos, "notificado")} color="#ef4444" />
        <KpiCard icon="🛣️" label="Aceite vencido por km"     value={data.km.filter((x: any) => x.estado === "VENCIDO").length} color="#dc2626" />
        <KpiCard icon="📅" label="Citas por recordar (48h)"  value={pendientes(data.citas, "recordatorio_enviado")} color="#f59e0b" />
        <KpiCard icon="⭐" label="Seguimientos post-entrega" value={data.seguimientos.length} color="#3b82f6" />
      </div>

      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 16px", fontSize: 13, color: "#1e40af", marginBottom: 16 }}>
        ℹ️ Cada botón <b>💬 Enviar</b> abre WhatsApp con el mensaje ya escrito — solo presionas enviar.
        El sistema lo registra en la ficha del cliente automáticamente. Cuando consigas la API de WhatsApp Business, estos mismos mensajes saldrán solos.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {([
          { key: "mantenimiento", label: `🔧 Mantenimientos (${data.mantenimientos.length})` },
          { key: "km",            label: `🛣️ Por kilometraje (${data.km.length})` },
          { key: "cita",          label: `📅 Citas próximas (${data.citas.length})` },
          { key: "seguimiento",   label: `⭐ Seguimiento (${data.seguimientos.length})` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setSeccion(t.key)}
            style={seccion === t.key ? S.tabActive : S.tabInactive}>{t.label}</button>
        ))}
      </div>

      <div style={S.card}>
        {loading ? (
          <p style={S.empty}>Cargando...</p>
        ) : items.length === 0 ? (
          <p style={S.empty}>
            {seccion === "mantenimiento" && "🎉 No hay mantenimientos vencidos ni próximos por avisar."}
            {seccion === "km" && "🎉 Ningún vehículo tiene el aceite vencido por kilometraje. (Requiere kilometraje registrado en la ficha del vehículo.)"}
            {seccion === "cita" && "No hay citas en las próximas 48 horas por recordar."}
            {seccion === "seguimiento" && "No hay entregas recientes pendientes de seguimiento."}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>{["Cliente", "Vehículo", "Motivo",
                      seccion === "cita" ? "Cita" : seccion === "km" ? "Kilometraje" : "Fecha",
                      "Plantilla", "Estado", ""].map((h, i) =>
                  <th key={i} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => {
                  const key = `${seccion}-${item.id}`;
                  const yaEnviado = enviados.has(key) ||
                    (seccion === "mantenimiento" && item.notificado) ||
                    (seccion === "cita" && item.recordatorio_enviado);
                  const vencido =
                    (seccion === "mantenimiento" && item.dias_restantes !== null && item.dias_restantes < 0) ||
                    (seccion === "km" && item.estado === "VENCIDO");
                  return (
                    <tr key={key} style={{ background: vencido && !yaEnviado ? "#fff5f5" : "transparent" }}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 700 }}>{item.cliente_nombre}</div>
                        <div style={{ fontSize: 11, color: item.cliente_telefono ? "#60a5fa" : "#dc2626" }}>
                          {item.cliente_telefono ? `📞 ${item.cliente_telefono}` : "⚠️ Sin teléfono"}
                        </div>
                      </td>
                      <td style={S.td}>{item.vehiculo_info || "—"}</td>
                      <td style={S.td}>
                        {seccion === "mantenimiento" && (
                          <>
                            <div>{TIPO_LABEL[item.tipo_servicio] || item.tipo_servicio}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: vencido ? "#dc2626" : "#d97706" }}>
                              {item.dias_restantes < 0 ? `🔴 ${Math.abs(item.dias_restantes)}d vencido`
                                : item.dias_restantes === 0 ? "🟡 Vence hoy" : `🟡 en ${item.dias_restantes}d`}
                            </div>
                          </>
                        )}
                        {seccion === "km" && (
                          <>
                            <div>Cambio de aceite</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: vencido ? "#dc2626" : "#d97706" }}>
                              {vencido
                                ? `🔴 ${miles(Math.abs(item.km_restantes))} km pasado`
                                : `🟡 faltan ${miles(item.km_restantes)} km`}
                            </div>
                            {item.tiene_membresia && (
                              <div style={{ fontSize: 10, color: "#7c3aed", fontWeight: 700 }}>💎 Tiene membresía</div>
                            )}
                          </>
                        )}
                        {seccion === "cita" && (TIPO_LABEL[item.tipo_servicio] || item.tipo_servicio || item.descripcion || "Cita")}
                        {seccion === "seguimiento" && (
                          <>
                            <div>Orden #{item.orden_id} entregada</div>
                            {item.descripcion && <div style={{ fontSize: 11, color: "#888" }}>{item.descripcion.slice(0, 60)}</div>}
                          </>
                        )}
                      </td>
                      <td style={S.td}>
                        {seccion === "km" ? (
                          <>
                            <div style={{ fontWeight: 700 }}>~{miles(item.km_estimado_hoy)} km hoy</div>
                            <div style={{ fontSize: 11, color: "#888" }}>
                              toca a los {miles(item.km_proximo_cambio)} km
                            </div>
                            <div style={{ fontSize: 10, color: item.confianza === "ALTA" ? "#16a34a" : "#d97706" }}>
                              {item.confianza === "ALTA" ? "✓ estimado con 2+ lecturas"
                                : item.confianza === "MEDIA" ? "≈ estimado con 1 lectura"
                                : "? sin lecturas"}
                              {item.km_por_mes ? ` · ~${miles(item.km_por_mes)} km/mes` : ""}
                            </div>
                          </>
                        ) : seccion === "cita" ? `${fmtDate(item.fecha)} · ${item.hora}`
                          : seccion === "seguimiento" ? fmtDate(item.entregado_el)
                          : fmtDate(item.proximo_fecha)}
                      </td>
                      <td style={S.td}>
                        <select
                          value={plantillaSel[key] || plantillaPorDefecto(seccion, item)}
                          onChange={e => setPlantillaSel(p => ({ ...p, [key]: e.target.value }))}
                          style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, background: "#fafafa", maxWidth: 190 }}>
                          {PLANTILLAS[seccion].map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                        <button
                          onClick={() => setPreview({ titulo: `Mensaje para ${item.cliente_nombre}`, mensaje: mensajeDe(seccion, item) })}
                          style={{ ...S.btnSmall, marginLeft: 6 }} title="Ver mensaje">👁️</button>
                      </td>
                      <td style={S.td}>
                        {yaEnviado
                          ? <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#dcfce7", color: "#16a34a" }}>✅ Enviado</span>
                          : <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#fef3c7", color: "#d97706" }}>⏳ Pendiente</span>}
                      </td>
                      <td style={S.td}>
                        <button
                          onClick={() => enviar(seccion, item)}
                          disabled={!item.cliente_telefono}
                          style={{ ...S.btnWhatsapp, opacity: item.cliente_telefono ? 1 : 0.4, cursor: item.cliente_telefono ? "pointer" : "not-allowed" }}>
                          💬 {yaEnviado ? "Reenviar" : "Enviar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL VISTA PREVIA */}
      {preview && (
        <div style={S.overlay} onClick={() => setPreview(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ ...S.cardTitle, marginBottom: 12 }}>👁️ {preview.titulo}</h3>
            <div style={{ background: "#e7ffdb", border: "1px solid #b6e3a8", borderRadius: "12px 12px 12px 2px",
              padding: "12px 16px", fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.5, color: "#111" }}>
              {preview.mensaje.replace(/\*/g, "")}
            </div>
            <button onClick={() => setPreview(null)} style={{ ...S.btnPrimary, width: "100%", marginTop: 16, background: "#6b7280" }}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px",
      boxShadow: "0 2px 12px rgba(0,0,0,.07)", flex: 1, minWidth: 140,
      borderLeft: `5px solid ${color}` }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 30, fontWeight: 900, color, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#888" }}>{label}</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:      { padding: "24px 28px", background: "#f5f7fb", minHeight: "100vh" },
  header:    { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title:     { fontSize: 26, fontWeight: 900, color: "#111827", margin: 0 },
  subtitle:  { fontSize: 13, color: "#6b7280", marginTop: 4 },
  kpiRow:    { display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" },
  card:      { background: "#fff", padding: 22, borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,.07)", marginBottom: 20 },
  cardTitle: { fontSize: 17, fontWeight: 700, marginBottom: 16, color: "#111827" },
  btnPrimary: { padding: "11px 22px", background: "#111827", color: "#fff", border: "none",
                borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 14 },
  btnSmall:  { padding: "6px 10px", background: "#f1f5f9", color: "#374151", border: "none",
               borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 12 },
  btnWhatsapp: { padding: "8px 14px", background: "#25d366", color: "#fff", border: "none",
                 borderRadius: 8, fontWeight: 700, fontSize: 12 },
  tabActive: { padding: "9px 18px", borderRadius: 10, border: "none", background: "#111827",
               color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 },
  tabInactive: { padding: "9px 18px", borderRadius: 10, border: "1px solid #e2e8f0",
                 background: "#fff", color: "#374151", cursor: "pointer", fontWeight: 600, fontSize: 13 },
  table:     { width: "100%", borderCollapse: "collapse" },
  th:        { textAlign: "left", padding: "10px 12px", background: "#f8fafc", fontSize: 12,
               fontWeight: 700, color: "#555", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" },
  td:        { padding: "11px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 13 },
  empty:     { color: "#aaa", textAlign: "center", padding: "32px 0", fontStyle: "italic" },
  overlay:   { position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex",
               alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal:     { background: "#fff", borderRadius: 16, padding: 28, width: 480, maxWidth: "95vw",
               boxShadow: "0 20px 60px rgba(0,0,0,.3)" },
};
