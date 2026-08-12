"use client";
/**
 * Módulo de Seguridad — Sólido Auto Servicio
 *
 * Cuatro áreas en una pantalla:
 *   Panorama  estado de la alarma, cámaras con problema y últimos eventos
 *   Cámaras   inventario e instalación (todavía ninguna instalada)
 *   Alarma    zonas y armado/desarmado
 *   Altavoz   llamar técnicos por las bocinas del taller
 *   Bitácora  quién armó, quién desarmó, qué cámara se cayó
 *
 * Requiere sql/migracion_v31_seguridad_altavoz.sql y routes/seguridad.mjs.
 */
import React, { useCallback, useEffect, useState } from "react";
import { API_URL as API } from "@/config";
import { usePermisos } from "@/lib/usePermisos";

// ── Paleta (la misma del resto del CRM) ──────────────────────────────────────
const C = {
  bg: "#0f172a", card: "#1e293b", card2: "#162032", border: "#334155",
  text: "#e2e8f0", muted: "#94a3b8", blue: "#3b82f6", green: "#10b981",
  red: "#ef4444", orange: "#f97316", yellow: "#f59e0b", purple: "#8b5cf6",
};

const ESTADO_CAM: Record<string, { label: string; color: string }> = {
  PLANIFICADA:    { label: "Planificada",    color: C.muted  },
  INSTALADA:      { label: "Instalada",      color: C.blue   },
  EN_LINEA:       { label: "En línea",       color: C.green  },
  FUERA_DE_LINEA: { label: "Fuera de línea", color: C.red    },
  EN_REPARACION:  { label: "En reparación",  color: C.orange },
  RETIRADA:       { label: "Retirada",       color: C.muted  },
};

const ESTADO_ZONA: Record<string, { label: string; color: string }> = {
  PLANIFICADA: { label: "Planificada", color: C.muted  },
  INSTALADA:   { label: "Instalada",   color: C.blue   },
  OK:          { label: "OK",          color: C.green  },
  ABIERTA:     { label: "Abierta",     color: C.orange },
  FALLA:       { label: "Falla",       color: C.red    },
  ANULADA:     { label: "Anulada",     color: C.muted  },
};

const SEVERIDAD: Record<string, string> = { info: C.blue, aviso: C.yellow, critico: C.red };

const fmtFH = (v: any) =>
  v ? new Date(v).toLocaleString("es-DO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

const fmtDinero = (n: number) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 2 }).format(n || 0);

export default function SeguridadPage() {
  const { usuario, puedeVer, puedeCrear, puedeEditar } = usePermisos("seguridad");
  const { puedeCrear: puedeAnunciar } = usePermisos("altavoz");

  const [tab, setTab] = useState<"panorama" | "camaras" | "alarma" | "altavoz" | "bitacora">("panorama");

  // El sidebar enlaza a /seguridad?tab=altavoz. Se lee de window y no con
  // useSearchParams para no obligar a envolver la página en <Suspense>, que
  // es lo que exige Next en el App Router.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && ["panorama", "camaras", "alarma", "altavoz", "bitacora"].includes(t)) {
      setTab(t as any);
    }
  }, []);
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error" | "info"; texto: string } | null>(null);

  const [resumen, setResumen]     = useState<any>(null);
  const [camaras, setCamaras]     = useState<any[]>([]);
  const [resCam, setResCam]       = useState<any>(null);
  const [zonas, setZonas]         = useState<any[]>([]);
  const [eventos, setEventos]     = useState<any[]>([]);
  const [plantillas, setPlantillas] = useState<any[]>([]);
  const [historialAlt, setHistorialAlt] = useState<any[]>([]);

  // Formulario de altavoz
  const [destinatario, setDestinatario] = useState("");
  const [mensajeLibre, setMensajeLibre] = useState("");
  const [repeticiones, setRepeticiones] = useState(2);
  const [enviando, setEnviando] = useState(false);

  const cabeceras = useCallback(() => ({
    "Content-Type": "application/json",
    "x-usuario": JSON.stringify({ id: usuario?.id, nombre: usuario?.nombre || usuario?.name }),
  }), [usuario]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [r1, r2, r3, r4, r5, r6] = await Promise.all([
        fetch(`${API}/seguridad/resumen`).then(r => r.json()).catch(() => null),
        fetch(`${API}/seguridad/camaras`).then(r => r.json()).catch(() => null),
        fetch(`${API}/seguridad/zonas`).then(r => r.json()).catch(() => null),
        fetch(`${API}/seguridad/eventos?limit=60`).then(r => r.json()).catch(() => null),
        fetch(`${API}/seguridad/altavoz/plantillas`).then(r => r.json()).catch(() => null),
        fetch(`${API}/seguridad/altavoz/historial?limit=25`).then(r => r.json()).catch(() => null),
      ]);
      if (r1 && !r1.error) setResumen(r1);
      if (r2 && !r2.error) { setCamaras(r2.camaras || []); setResCam(r2.resumen || null); }
      if (r3 && !r3.error) setZonas(r3.zonas || []);
      if (r4 && !r4.error) setEventos(r4.eventos || []);
      if (r5 && !r5.error) setPlantillas(r5.plantillas || []);
      if (r6 && !r6.error) setHistorialAlt(r6.anuncios || []);
    } catch {
      setMsg({ tipo: "error", texto: "No se pudo cargar el módulo de seguridad." });
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // El panorama se refresca solo: si una cámara se cae mientras la pantalla
  // está abierta, tiene que notarse sin que nadie recargue.
  useEffect(() => {
    if (tab !== "panorama") return;
    const t = setInterval(() => {
      fetch(`${API}/seguridad/resumen`).then(r => r.json())
        .then(d => { if (d && !d.error) setResumen(d); }).catch(() => {});
    }, 30_000);
    return () => clearInterval(t);
  }, [tab]);

  // ── Acciones ───────────────────────────────────────────────────────────────
  const cambiarAlarma = async (modo: string, forzar = false) => {
    try {
      const r = await fetch(`${API}/seguridad/alarma`, {
        method: "POST", headers: cabeceras(),
        body: JSON.stringify({ modo, forzar, usuario_id: usuario?.id, usuario_nombre: usuario?.nombre || usuario?.name }),
      });
      const d = await r.json();

      // 409 = hay zonas abiertas. Se ofrece forzar en vez de fallar en seco:
      // a veces el portón queda abierto a propósito y hay que armar igual.
      if (r.status === 409 && d.requiere === "forzar") {
        const lista = (d.zonas_pendientes || []).map((z: any) => `• ${z.nombre} (${z.estado})`).join("\n");
        if (confirm(`Hay zonas sin cerrar:\n\n${lista}\n\n¿Armar de todas formas?`)) {
          return cambiarAlarma(modo, true);
        }
        return;
      }
      if (d.error) { setMsg({ tipo: "error", texto: d.mensaje || "No se pudo cambiar la alarma." }); return; }

      setMsg({ tipo: "ok", texto: modo === "DESARMADA" ? "Alarma desarmada." : `Alarma armada en modo ${modo}.` });
      cargar();
    } catch {
      setMsg({ tipo: "error", texto: "Error de conexión al cambiar la alarma." });
    }
  };

  const cambiarEstadoCamara = async (cam: any, estado: string) => {
    try {
      await fetch(`${API}/seguridad/camaras/${cam.id}`, {
        method: "PATCH", headers: cabeceras(),
        body: JSON.stringify({ estado, usuario_id: usuario?.id, usuario_nombre: usuario?.nombre || usuario?.name }),
      });
      cargar();
    } catch { setMsg({ tipo: "error", texto: "No se pudo actualizar la cámara." }); }
  };

  const cambiarEstadoZona = async (z: any, estado: string) => {
    try {
      await fetch(`${API}/seguridad/zonas/${z.id}`, {
        method: "PATCH", headers: cabeceras(),
        body: JSON.stringify({ estado, usuario_id: usuario?.id, usuario_nombre: usuario?.nombre || usuario?.name }),
      });
      cargar();
    } catch { setMsg({ tipo: "error", texto: "No se pudo actualizar la zona." }); }
  };

  const anunciar = async (cuerpo: any) => {
    setEnviando(true); setMsg(null);
    try {
      const r = await fetch(`${API}/seguridad/altavoz/anunciar`, {
        method: "POST", headers: cabeceras(),
        body: JSON.stringify({ ...cuerpo, usuario_id: usuario?.id, usuario_nombre: usuario?.nombre || usuario?.name }),
      });
      const d = await r.json();
      if (d.error) { setMsg({ tipo: "error", texto: d.mensaje || "No se pudo enviar el anuncio." }); return; }

      // El aviso de "no hay receptor" importa: sin él, quien llama se queda
      // esperando a un técnico que nunca oyó nada.
      setMsg(d.aviso
        ? { tipo: "info", texto: `Anuncio en cola. ${d.aviso}` }
        : { tipo: "ok", texto: "Anuncio enviado a las bocinas del taller." });

      setMensajeLibre("");
      fetch(`${API}/seguridad/altavoz/historial?limit=25`).then(r => r.json())
        .then(h => { if (h && !h.error) setHistorialAlt(h.anuncios || []); }).catch(() => {});
    } catch {
      setMsg({ tipo: "error", texto: "Error de conexión al enviar el anuncio." });
    } finally { setEnviando(false); }
  };

  // ── Estilos reutilizables ──────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18,
  };
  const input: React.CSSProperties = {
    width: "100%", padding: "10px 12px", background: C.card2,
    border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
    fontSize: 14, boxSizing: "border-box",
  };
  const btn = (bg: string): React.CSSProperties => ({
    background: bg, color: "#fff", border: "none", borderRadius: 9,
    padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer",
  });
  const chip = (color: string): React.CSSProperties => ({
    display: "inline-block", padding: "3px 10px", borderRadius: 20,
    fontSize: 11, fontWeight: 700, background: color + "22", color,
    border: `1px solid ${color}55`,
  });

  if (!puedeVer) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.muted, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        No tienes permiso para ver el módulo de Seguridad.<br />Pídele acceso al gerente desde Permisos de Roles.
      </div>
    );
  }

  const alarma = resumen?.alarma || {};

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif" }}>

      {/* Cabecera */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: "16px 24px" }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>🛡️ Seguridad del Taller</h1>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: C.muted }}>
          Cámaras, alarma, bitácora y llamados por altavoz
        </p>
      </div>

      {/* Pestañas */}
      <div style={{ display: "flex", gap: 6, padding: "14px 24px 0", flexWrap: "wrap" }}>
        {([
          ["panorama", "📊 Panorama"],
          ["camaras",  `📷 Cámaras (${camaras.length})`],
          ["alarma",   "🚨 Alarma"],
          ["altavoz",  "📢 Altavoz"],
          ["bitacora", "📜 Bitácora"],
        ] as [typeof tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{
              background: tab === k ? C.blue : C.card, color: tab === k ? "#fff" : C.muted,
              border: `1px solid ${tab === k ? C.blue : C.border}`, borderRadius: 9,
              padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>

        {msg && (
          <div style={{
            background: (msg.tipo === "ok" ? C.green : msg.tipo === "error" ? C.red : C.blue) + "22",
            border: `1px solid ${(msg.tipo === "ok" ? C.green : msg.tipo === "error" ? C.red : C.blue)}55`,
            color: msg.tipo === "ok" ? C.green : msg.tipo === "error" ? C.red : C.blue,
            borderRadius: 9, padding: "11px 14px", fontSize: 13, marginBottom: 16, lineHeight: 1.5,
          }}>
            {msg.texto}
            <button onClick={() => setMsg(null)}
              style={{ float: "right", background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700 }}>✕</button>
          </div>
        )}

        {cargando && <p style={{ color: C.muted, fontSize: 14 }}>Cargando…</p>}

        {/* ══ PANORAMA ══ */}
        {!cargando && tab === "panorama" && (
          <div style={{ display: "grid", gap: 14 }}>

            {/* Estado de la alarma */}
            <div style={{
              ...card,
              background: alarma.armada ? "#052e2b" : C.card,
              border: `1px solid ${alarma.armada ? C.green : C.border}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 40 }}>{alarma.armada ? "🔒" : "🔓"}</span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: alarma.armada ? C.green : C.yellow }}>
                    {alarma.armada ? `Alarma armada — ${alarma.modo}` : "Alarma desarmada"}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                    {alarma.por ? `Por ${alarma.por} · ${fmtFH(alarma.desde)}` : "Sin registro previo"}
                    {alarma.forzada && " · ⚠️ armada con zonas abiertas"}
                  </div>
                </div>
              </div>
            </div>

            {/* Tarjetas de estado */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {[
                ["Cámaras en línea", `${resumen?.camaras?.en_linea ?? 0} / ${resumen?.camaras?.total ?? 0}`, C.green],
                ["Fuera de línea",   resumen?.camaras?.fuera_linea ?? 0, (resumen?.camaras?.fuera_linea ?? 0) > 0 ? C.red : C.muted],
                ["Por instalar",     resumen?.camaras?.planificadas ?? 0, C.yellow],
                ["Zonas abiertas",   (resumen?.zonas?.abiertas || []).length, (resumen?.zonas?.abiertas || []).length > 0 ? C.orange : C.muted],
                ["Anuncios en cola", resumen?.anuncios_pendientes ?? 0, (resumen?.anuncios_pendientes ?? 0) > 0 ? C.orange : C.muted],
              ].map(([label, valor, color]) => (
                <div key={String(label)} style={card}>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: .6 }}>{label}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: color as string, marginTop: 4 }}>{valor as any}</div>
                </div>
              ))}
            </div>

            {/* Estado de la instalación: todas las cámaras están planificadas */}
            {(resCam?.planificadas ?? 0) > 0 && (
              <div style={{ ...card, background: "#1c1917", border: `1px solid ${C.yellow}55` }}>
                <div style={{ fontWeight: 700, color: C.yellow, marginBottom: 6 }}>
                  📋 Instalación pendiente
                </div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                  Hay <b style={{ color: C.text }}>{resCam.planificadas}</b> cámaras planificadas sin instalar.
                  {resCam.costo_pendiente > 0 && <> Presupuesto registrado: <b style={{ color: C.text }}>{fmtDinero(resCam.costo_pendiente)}</b>.</>}
                  {" "}Cuando el instalador conecte el DVR, pon la URL del stream en cada cámara y cambia su estado a “En línea”.
                </div>
              </div>
            )}

            {/* Últimos eventos */}
            <div style={card}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Últimos movimientos</div>
              {(resumen?.eventos_recientes || []).length === 0 ? (
                <p style={{ color: C.muted, fontSize: 13 }}>Sin eventos registrados todavía.</p>
              ) : (
                (resumen.eventos_recientes as any[]).map(e => (
                  <div key={e.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}44` }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: SEVERIDAD[e.severidad] || C.blue, marginTop: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13 }}>{e.descripcion}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        {fmtFH(e.created_at)}{e.usuario_nombre ? ` · ${e.usuario_nombre}` : ""}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ══ CÁMARAS ══ */}
        {!cargando && tab === "camaras" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {camaras.map(cam => {
              const est = ESTADO_CAM[cam.estado] || ESTADO_CAM.PLANIFICADA;
              return (
                <div key={cam.id} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{cam.nombre}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                        <span style={{ fontFamily: "monospace" }}>{cam.codigo}</span> · {cam.ubicacion}
                      </div>
                    </div>
                    <span style={chip(est.color)}>{est.label}</span>
                  </div>

                  {cam.cubre && (
                    <div style={{ fontSize: 12.5, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
                      👁 {cam.cubre}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, fontSize: 11, color: C.muted }}>
                    <span>{cam.interior ? "🏠 Interior" : "🌤 Exterior"}</span>
                    <span>· {cam.tipo}</span>
                    {cam.resolucion && <span>· {cam.resolucion}</span>}
                    {cam.vision_nocturna && <span>· 🌙 Nocturna</span>}
                  </div>

                  {/* El visor aparece solo cuando exista la URL del DVR */}
                  {cam.url_stream ? (
                    <div style={{ marginTop: 12, padding: 10, background: C.card2, borderRadius: 8, fontSize: 12, color: C.green }}>
                      🎥 Stream configurado
                    </div>
                  ) : (
                    <div style={{ marginTop: 12, padding: 10, background: C.card2, borderRadius: 8, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                      Sin stream. Cuando se instale el DVR, guarda aquí la URL <span style={{ fontFamily: "monospace" }}>rtsp://…</span> del canal {cam.canal_dvr || "correspondiente"}.
                    </div>
                  )}

                  {puedeEditar && (
                    <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                      {(["INSTALADA", "EN_LINEA", "FUERA_DE_LINEA", "EN_REPARACION"] as const)
                        .filter(e => e !== cam.estado)
                        .map(e => (
                          <button key={e} onClick={() => cambiarEstadoCamara(cam, e)}
                            style={{
                              background: C.card2, border: `1px solid ${C.border}`, color: C.muted,
                              borderRadius: 7, padding: "5px 10px", fontSize: 11, cursor: "pointer",
                            }}>
                            {ESTADO_CAM[e].label}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ ALARMA ══ */}
        {!cargando && tab === "alarma" && (
          <div style={{ display: "grid", gap: 14 }}>
            {puedeCrear ? (
              <div style={card}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Armado</div>
                <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>
                  <b style={{ color: C.text }}>Total</b>: todo armado, taller cerrado. {" "}
                  <b style={{ color: C.text }}>Perimetral</b>: solo los accesos, se trabaja adentro con el almacén protegido.
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => cambiarAlarma("TOTAL")}      style={btn(C.green)}>🔒 Armar total</button>
                  <button onClick={() => cambiarAlarma("PERIMETRAL")} style={btn(C.blue)}>🛡 Armar perimetral</button>
                  <button onClick={() => cambiarAlarma("DESARMADA")}  style={btn(C.card2)}>🔓 Desarmar</button>
                </div>
              </div>
            ) : (
              <div style={{ ...card, color: C.muted, fontSize: 13 }}>
                Solo puedes consultar. Armar o desarmar requiere permiso de creación en el módulo Seguridad.
              </div>
            )}

            <div style={card}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Zonas ({zonas.length})</div>
              {zonas.map(z => {
                const est = ESTADO_ZONA[z.estado] || ESTADO_ZONA.PLANIFICADA;
                return (
                  <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.border}44`, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {z.nombre}
                        {z.siempre_activa && (
                          <span style={{ ...chip(C.purple), marginLeft: 8 }}>24 h</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                        <span style={{ fontFamily: "monospace" }}>{z.codigo}</span> · {z.tipo_sensor}{z.ubicacion ? ` · ${z.ubicacion}` : ""}
                      </div>
                    </div>
                    <span style={chip(est.color)}>{est.label}</span>
                    {puedeEditar && (
                      <div style={{ display: "flex", gap: 5 }}>
                        {(["OK", "ABIERTA", "FALLA"] as const).filter(e => e !== z.estado).map(e => (
                          <button key={e} onClick={() => cambiarEstadoZona(z, e)}
                            style={{ background: C.card2, border: `1px solid ${C.border}`, color: C.muted, borderRadius: 7, padding: "4px 9px", fontSize: 11, cursor: "pointer" }}>
                            {ESTADO_ZONA[e].label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ ALTAVOZ ══ */}
        {!cargando && tab === "altavoz" && (
          <div style={{ display: "grid", gap: 14 }}>

            <div style={{ ...card, background: "#0d1f1e", border: `1px solid #0f766e88` }}>
              <div style={{ fontWeight: 700, color: "#5eead4", marginBottom: 6 }}>Cómo funciona</div>
              <div style={{ fontSize: 12.5, color: "#99f6e4", lineHeight: 1.65 }}>
                El anuncio entra en una cola. Una computadora del taller conectada a las bocinas, con la pantalla
                <b> /altavoz/receptor</b> abierta, lo locuta en voz alta. Si esa pantalla no está abierta, el anuncio
                queda pendiente y aquí te avisamos — así nadie asume que el técnico fue llamado cuando no lo oyó nadie.
              </div>
            </div>

            {!puedeAnunciar ? (
              <div style={{ ...card, color: C.muted, fontSize: 13 }}>
                No tienes permiso para anunciar por altavoz.
              </div>
            ) : (
              <>
                <div style={card}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: .6 }}>
                    ¿A quién se llama?
                  </label>
                  <input value={destinatario} onChange={e => setDestinatario(e.target.value)}
                    placeholder="Ej: Ramón, el lavador, todo el personal"
                    style={{ ...input, marginTop: 6, marginBottom: 16 }} />

                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: .6 }}>
                    Frases rápidas
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 8, marginBottom: 16 }}>
                    {plantillas.map(p => (
                      <button key={p.codigo} disabled={enviando}
                        onClick={() => anunciar({ plantilla_codigo: p.codigo, destinatario, tipo: p.tipo, repeticiones })}
                        style={{
                          background: p.tipo === "EMERGENCIA" ? C.red + "22" : C.card2,
                          border: `1px solid ${p.tipo === "EMERGENCIA" ? C.red : C.border}`,
                          color: p.tipo === "EMERGENCIA" ? C.red : C.text,
                          borderRadius: 20, padding: "7px 14px", fontSize: 12.5,
                          cursor: enviando ? "wait" : "pointer", fontWeight: 600,
                        }}>
                        {p.icono} {p.etiqueta}
                      </button>
                    ))}
                  </div>

                  <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: .6 }}>
                    O escribe el mensaje
                  </label>
                  <textarea value={mensajeLibre} onChange={e => setMensajeLibre(e.target.value.slice(0, 300))}
                    rows={3} placeholder="Ramón, favor presentarse en la bahía 3."
                    style={{ ...input, marginTop: 6, resize: "vertical" }} />
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{mensajeLibre.length}/300</div>

                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
                    <label style={{ fontSize: 12.5, color: C.muted }}>
                      Repetir{" "}
                      <select value={repeticiones} onChange={e => setRepeticiones(Number(e.target.value))}
                        style={{ background: C.card2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 8px" }}>
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} {n === 1 ? "vez" : "veces"}</option>)}
                      </select>
                    </label>
                    <button disabled={enviando || !mensajeLibre.trim()}
                      onClick={() => anunciar({ mensaje: mensajeLibre.trim(), destinatario, repeticiones })}
                      style={{ ...btn(mensajeLibre.trim() ? C.blue : C.muted), marginLeft: "auto", cursor: mensajeLibre.trim() ? "pointer" : "not-allowed" }}>
                      {enviando ? "Enviando…" : "📢 Anunciar"}
                    </button>
                  </div>
                </div>

                <div style={card}>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>Últimos anuncios</div>
                  {historialAlt.length === 0 ? (
                    <p style={{ color: C.muted, fontSize: 13 }}>Todavía no se ha anunciado nada.</p>
                  ) : historialAlt.map(a => (
                    <div key={a.id} style={{ padding: "9px 0", borderBottom: `1px solid ${C.border}44` }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <div style={{ flex: 1, fontSize: 13 }}>{a.mensaje}</div>
                        <span style={chip(
                          a.estado === "REPRODUCIDO" ? C.green :
                          a.estado === "PENDIENTE"   ? C.orange : C.muted
                        )}>
                          {a.estado === "REPRODUCIDO" ? "Sonó" : a.estado === "PENDIENTE" ? "En cola" : a.estado}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                        {fmtFH(a.created_at)} · {a.usuario_nombre || "—"}
                        {a.reproducido_at && ` · sonó ${fmtFH(a.reproducido_at)}`}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ BITÁCORA ══ */}
        {!cargando && tab === "bitacora" && (
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Bitácora de seguridad</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14 }}>
              Quién armó, quién desarmó, qué cámara se cayó y cuándo.
            </div>
            {eventos.length === 0 ? (
              <p style={{ color: C.muted, fontSize: 13 }}>Sin eventos registrados.</p>
            ) : eventos.map(e => (
              <div key={e.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.border}44` }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: SEVERIDAD[e.severidad] || C.blue, marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>{e.descripcion}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                    <span style={{ fontFamily: "monospace" }}>{e.tipo}</span> · {fmtFH(e.created_at)}
                    {e.usuario_nombre ? ` · ${e.usuario_nombre}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
