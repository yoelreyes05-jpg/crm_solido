"use client";
import { useEffect, useState, useCallback } from "react";
import { API_URL as API } from "@/config";

// ─── Fases del taller ─────────────────────────────────────────────────────────
const FASES = [
  { key: "RECIBIDO",        label: "Recibido",      color: "#3b82f6", bg: "#eff6ff", icon: "📋" },
  { key: "DIAGNOSTICO",     label: "Diagnóstico",   color: "#f59e0b", bg: "#fffbeb", icon: "🔍" },
  { key: "REPARACION",      label: "Reparación",    color: "#ef4444", bg: "#fef2f2", icon: "🔧" },
  { key: "CONTROL_CALIDAD", label: "Ctrl. Calidad", color: "#8b5cf6", bg: "#f5f3ff", icon: "✅" },
  { key: "LISTO",           label: "Listo ✓",       color: "#10b981", bg: "#ecfdf5", icon: "🎉" },
  { key: "ENTREGADO",       label: "Entregado",     color: "#6b7280", bg: "#f9fafb", icon: "🏁" },
];

const SLIDE_DURATION = 10_000;
const PROD_POR_SLIDE = 8;

// ─── Etiqueta NCF legible ─────────────────────────────────────────────────────
const NCF_LABEL: Record<string, string> = {
  B01: "Crédito Fiscal",
  B02: "Consumidor Final",
  B14: "Régimen Especial",
  B15: "Gubernamental",
};

export default function PantallaTV() {
  const [ordenes,   setOrdenes]   = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [slideIdx,  setSlideIdx]  = useState(0);
  const [hora,      setHora]      = useState("");
  const [fecha,     setFecha]     = useState("");

  // ── Carga datos ───────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    try {
      const [oRes, pRes] = await Promise.all([
        fetch(`${API}/ordenes`),
        fetch(`${API}/cafeteria/productos`),
      ]);
      const o = await oRes.json();
      const p = await pRes.json();
      setOrdenes(Array.isArray(o) ? o : []);
      setProductos(Array.isArray(p) ? p.filter((x: any) => x.stock > 0) : []);
    } catch {}
  }, []);

  useEffect(() => {
    cargar();
    const r = setInterval(cargar, 30_000);
    return () => clearInterval(r);
  }, [cargar]);

  // ── Reloj ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setHora(now.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" }));
      setFecha(now.toLocaleDateString("es-DO", { weekday: "long", day: "2-digit", month: "long" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Slides ────────────────────────────────────────────────────────────────
  const cafSlides: any[][] = [];
  for (let i = 0; i < productos.length; i += PROD_POR_SLIDE)
    cafSlides.push(productos.slice(i, i + PROD_POR_SLIDE));

  // slide 0 = taller, slides 1..n = cafetería
  const totalSlides = 1 + cafSlides.length;

  useEffect(() => {
    const id = setInterval(() => setSlideIdx(prev => (prev + 1) % totalSlides), SLIDE_DURATION);
    return () => clearInterval(id);
  }, [totalSlides]);

  // ── Datos taller ──────────────────────────────────────────────────────────
  const byFase: Record<string, any[]> = {};
  for (const f of FASES)
    byFase[f.key] = ordenes.filter(o => (o.estado || "RECIBIDO") === f.key);
  const activas = ordenes.filter(o => o.estado !== "ENTREGADO");
  const listos  = byFase["LISTO"]?.length || 0;

  const esSliderTaller = slideIdx === 0;
  const cafSlide = cafSlides[slideIdx - 1] || [];

  return (
    <div style={{
      width: "100vw", height: "100vh", overflow: "hidden",
      background: "#f8f9fb",
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      color: "#111", display: "flex", flexDirection: "column",
    }}>

      {/* ══ HEADER ════════════════════════════════════════════════════════ */}
      <div style={{
        display: "flex", alignItems: "stretch",
        background: "#fff",
        borderBottom: "3px solid #f97316",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        flexShrink: 0,
      }}>
        {/* Logo / Brand */}
        <div style={{
          background: esSliderTaller ? "#fff" : "linear-gradient(135deg,#ea580c,#f97316)",
          padding: "16px 28px",
          display: "flex", alignItems: "center", gap: 14,
          minWidth: 260,
          borderRight: esSliderTaller ? "2px solid #f3f4f6" : "none",
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, overflow: "hidden",
            background: esSliderTaller ? "#f3f4f6" : "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)", flexShrink: 0,
          }}>
            <img src="/logo.png" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, color: esSliderTaller ? "#111" : "#fff", letterSpacing: 0.5 }}>
              SÓLIDO AUTO SERVICIO
            </div>
            <div style={{ fontSize: 12, color: esSliderTaller ? "#6b7280" : "rgba(255,255,255,0.82)", fontWeight: 600, marginTop: 2 }}>
              ☕ Sólido Cafe Garage
            </div>
          </div>
        </div>

        {/* Slide label */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", paddingLeft: 28 }}>
          <div>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: esSliderTaller ? "#3b82f6" : "#f97316",
              textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 2,
            }}>
              {esSliderTaller ? "🔧 Estado del Taller" : "☕ Menú Cafetería"}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#111" }}>
              {esSliderTaller
                ? `${activas.length} vehículo${activas.length !== 1 ? "s" : ""} en servicio`
                : "Productos disponibles hoy"}
            </div>
          </div>
        </div>

        {/* Reloj */}
        <div style={{
          padding: "14px 28px", textAlign: "right",
          display: "flex", flexDirection: "column", justifyContent: "center",
        }}>
          <div style={{ fontSize: 44, fontWeight: 900, color: "#111", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {hora}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4, textTransform: "capitalize" }}>{fecha}</div>
        </div>
      </div>

      {/* ══ CONTENIDO ═════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, overflow: "hidden" }}>

        {/* ─ SLIDE TALLER ──────────────────────────────────────────────── */}
        {esSliderTaller && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "18px 24px", gap: 14 }}>

            {/* Alerta listos */}
            {listos > 0 && (
              <div style={{
                background: "linear-gradient(135deg,#065f46,#10b981)",
                borderRadius: 14, padding: "12px 22px",
                display: "flex", alignItems: "center", gap: 16,
                boxShadow: "0 4px 16px rgba(16,185,129,0.35)",
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 30 }}>🎉</span>
                <div style={{ color: "#fff" }}>
                  <div style={{ fontWeight: 900, fontSize: 20 }}>
                    {listos} vehículo{listos > 1 ? "s" : ""} LISTO{listos > 1 ? "S" : ""} PARA ENTREGAR
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.85 }}>Puede pasar a recoger su vehículo</div>
                </div>
              </div>
            )}

            {/* KPIs rápidos */}
            <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
              {[
                { label: "En Taller",   val: activas.length,                    color: "#3b82f6" },
                { label: "Listos",      val: listos,                            color: "#10b981" },
                { label: "Diagnóstico", val: byFase["DIAGNOSTICO"]?.length || 0, color: "#f59e0b" },
                { label: "Reparación",  val: byFase["REPARACION"]?.length  || 0, color: "#ef4444" },
              ].map(k => (
                <div key={k.label} style={{
                  flex: 1, background: "#fff", borderRadius: 14,
                  padding: "14px 18px", borderLeft: `5px solid ${k.color}`,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                }}>
                  <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>{k.label}</div>
                  <div style={{ fontSize: 44, fontWeight: 900, color: k.color, lineHeight: 1, marginTop: 4 }}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Kanban fases */}
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, overflow: "hidden" }}>
              {FASES.map(fase => {
                const cards = byFase[fase.key] || [];
                return (
                  <div key={fase.key} style={{
                    background: "#fff", borderRadius: 16,
                    border: `1.5px solid ${fase.color}33`,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                    display: "flex", flexDirection: "column", overflow: "hidden",
                  }}>
                    {/* Header fase */}
                    <div style={{
                      padding: "10px 14px", background: fase.bg,
                      borderBottom: `3px solid ${fase.color}`,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: fase.color }}>{fase.icon}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#111", marginTop: 1 }}>{fase.label}</div>
                      </div>
                      <div style={{
                        background: fase.color, color: "#fff",
                        borderRadius: "50%", width: 30, height: 30,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 15, fontWeight: 900,
                      }}>{cards.length}</div>
                    </div>
                    {/* Cards */}
                    <div style={{ flex: 1, overflowY: "hidden", padding: "8px 10px" }}>
                      {cards.length === 0 && (
                        <div style={{ textAlign: "center", color: "#d1d5db", fontSize: 13, padding: "16px 0", fontWeight: 600 }}>
                          Sin órdenes
                        </div>
                      )}
                      {cards.slice(0, 5).map(orden => (
                        <div key={orden.id} style={{
                          background: fase.bg, borderRadius: 10, padding: "9px 11px",
                          marginBottom: 7, border: `1px solid ${fase.color}22`,
                        }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {orden.cliente_nombre || "Sin cliente"}
                          </div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            🚗 {orden.vehiculo_info || "—"}
                          </div>
                        </div>
                      ))}
                      {cards.length > 5 && (
                        <div style={{ fontSize: 12, color: fase.color, textAlign: "center", fontWeight: 700 }}>
                          +{cards.length - 5} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─ SLIDE CAFETERÍA ──────────────────────────────────────────── */}
        {!esSliderTaller && (
          <div style={{ height: "100%", display: "flex", gap: 0, overflow: "hidden" }}>

            {/* Sidebar izquierdo */}
            <div style={{
              width: 180, background: "#fff7ed",
              borderRight: "2px solid #fed7aa",
              display: "flex", flexDirection: "column", flexShrink: 0,
            }}>
              <div style={{
                background: "#ea580c", color: "#fff",
                padding: "14px 16px", fontWeight: 900, fontSize: 16,
              }}>
                ☕ Menú del Día
              </div>
              <div style={{ padding: "12px 14px", flex: 1 }}>
                <div style={{ fontSize: 11, color: "#9a3412", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                  Disponibles hoy
                </div>
                <div style={{ fontSize: 38, fontWeight: 900, color: "#ea580c", lineHeight: 1 }}>
                  {cafSlide.length}
                </div>
                <div style={{ fontSize: 11, color: "#c2410c", marginTop: 4 }}>productos en pantalla</div>
                {cafSlides.length > 1 && (
                  <div style={{ marginTop: 16, fontSize: 11, color: "#9a3412", background: "#fed7aa", borderRadius: 8, padding: "6px 10px" }}>
                    Página {slideIdx} de {cafSlides.length}
                  </div>
                )}
              </div>
              <div style={{ padding: "12px 14px", borderTop: "1px solid #fed7aa", fontSize: 11, color: "#9a3412" }}>
                Sólido Cafe Garage<br />809-712-2027
              </div>
            </div>

            {/* Grid productos */}
            <div style={{ flex: 1, padding: "16px 20px", overflow: "hidden" }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: cafSlide.length <= 4 ? "repeat(4,1fr)"
                  : cafSlide.length <= 6 ? "repeat(3,1fr)" : "repeat(4,1fr)",
                gap: 12, height: "100%", alignContent: "start",
              }}>
                {cafSlide.map(prod => (
                  <div key={prod.id} style={{
                    background: "#fff", borderRadius: 14,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
                    border: "1px solid #f3f4f6",
                    overflow: "hidden",
                    display: "flex", flexDirection: "column",
                  }}>
                    {/* Imagen compacta */}
                    {prod.imagen
                      ? <img src={prod.imagen} alt={prod.nombre}
                          style={{ width: "100%", height: 90, objectFit: "cover", flexShrink: 0 }} />
                      : <div style={{
                          width: "100%", height: 90, flexShrink: 0,
                          background: "#fff7ed",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 34,
                        }}>☕</div>
                    }
                    {/* Info compacta */}
                    <div style={{ padding: "9px 12px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{
                          fontWeight: 900, fontSize: 15, color: "#111",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2,
                        }}>{prod.nombre}</div>
                        {prod.categoria && (
                          <div style={{
                            display: "inline-block", fontSize: 9, fontWeight: 700,
                            background: "#fff7ed", color: "#ea580c",
                            borderRadius: 5, padding: "1px 6px",
                            textTransform: "uppercase", letterSpacing: 0.5,
                          }}>{prod.categoria}</div>
                        )}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#16a34a", marginTop: 4 }}>
                        RD$ {Number(prod.precio).toFixed(2)}
                      </div>
                    </div>
                    <div style={{ height: 3, background: "#ea580c", flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ FOOTER con dots ═══════════════════════════════════════════════ */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "10px 0", background: "#fff",
        borderTop: "2px solid #f3f4f6", flexShrink: 0,
      }}>
        {Array.from({ length: totalSlides }).map((_, i) => (
          <div key={i} style={{
            width: i === slideIdx ? 32 : 8, height: 8, borderRadius: 4,
            background: i === slideIdx ? "#f97316" : "#e5e7eb",
            transition: "all 0.4s ease",
          }} />
        ))}
        <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 12, fontWeight: 600 }}>
          Auto-actualiza cada 10s
        </span>
      </div>
    </div>
  );
}
