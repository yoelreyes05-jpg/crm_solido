"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
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

const SLIDE_DURATION = 10_000; // 10 s por slide

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
      // Solo productos activos con stock
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

  // ── Slides: [0]=taller, [1..n]=una slide por categoría ──────────────────
  const categorias = useMemo(() => {
    const cats = new Set(productos.map((p: any) => p.categoria || "General"));
    return Array.from(cats) as string[];
  }, [productos]);

  // totalSlides = 1 (taller) + N categorías
  const totalSlides = 1 + categorias.length;

  useEffect(() => {
    if (totalSlides < 2) return;
    const id = setInterval(() => setSlideIdx(prev => (prev + 1) % totalSlides), SLIDE_DURATION);
    return () => clearInterval(id);
  }, [totalSlides]);

  // ── Datos taller ──────────────────────────────────────────────────────────
  const byFase: Record<string, any[]> = {};
  for (const f of FASES)
    byFase[f.key] = ordenes.filter((o: any) => (o.estado || "RECIBIDO") === f.key);
  const activas = ordenes.filter((o: any) => o.estado !== "ENTREGADO");
  const listos  = byFase["LISTO"]?.length || 0;

  // ── Datos cafetería (slide actual) ────────────────────────────────────────
  const esSliderTaller = slideIdx === 0;
  const catActual      = categorias[slideIdx - 1] || "";
  const prodsCatActual = productos.filter((p: any) => (p.categoria || "General") === catActual);

  // ── Cols de grid según cantidad de productos ──────────────────────────────
  const gridCols = prodsCatActual.length <= 3 ? 3
    : prodsCatActual.length <= 4 ? 4
    : prodsCatActual.length <= 6 ? 3
    : 4;

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
        borderBottom: "3px solid " + (esSliderTaller ? "#3b82f6" : "#f97316"),
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        flexShrink: 0,
        transition: "border-color 0.5s",
      }}>
        {/* Logo / Brand — blanco siempre */}
        <div style={{
          background: "#fff",
          padding: "14px 24px",
          display: "flex", alignItems: "center", gap: 14,
          minWidth: 240,
          borderRight: "2px solid #f3f4f6",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, overflow: "hidden",
            background: "#f3f4f6",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <img src="/logo.png" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#111", letterSpacing: 0.4 }}>
              SÓLIDO AUTO SERVICIO
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginTop: 2 }}>
              ☕ Sólido Cafe Garage
            </div>
          </div>
        </div>

        {/* Indicador de slide */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", paddingLeft: 24, gap: 14 }}>
          <div style={{
            background: esSliderTaller ? "#eff6ff" : "#fff7ed",
            border: `1.5px solid ${esSliderTaller ? "#bfdbfe" : "#fed7aa"}`,
            borderRadius: 10, padding: "6px 16px",
            fontSize: 13, fontWeight: 800,
            color: esSliderTaller ? "#1d4ed8" : "#ea580c",
          }}>
            {esSliderTaller ? "🔧 Estado del Taller" : `☕ ${catActual}`}
          </div>
          {!esSliderTaller && (
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              {prodsCatActual.length} producto{prodsCatActual.length !== 1 ? "s" : ""} disponible{prodsCatActual.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Reloj */}
        <div style={{ padding: "12px 24px", textAlign: "right", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 42, fontWeight: 900, color: "#111", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {hora}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3, textTransform: "capitalize" }}>{fecha}</div>
        </div>
      </div>

      {/* ══ CONTENIDO ═════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, overflow: "hidden" }}>

        {/* ─ SLIDE TALLER ──────────────────────────────────────────────── */}
        {esSliderTaller && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "16px 22px", gap: 12 }}>

            {/* Alerta listos */}
            {listos > 0 && (
              <div style={{
                background: "linear-gradient(135deg,#065f46,#10b981)",
                borderRadius: 12, padding: "10px 20px",
                display: "flex", alignItems: "center", gap: 14,
                boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 26 }}>🎉</span>
                <div style={{ color: "#fff" }}>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    {listos} vehículo{listos > 1 ? "s" : ""} LISTO{listos > 1 ? "S" : ""} PARA ENTREGAR
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>Puede pasar a recoger su vehículo en recepción</div>
                </div>
              </div>
            )}

            {/* KPIs */}
            <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
              {[
                { label: "En Taller",   val: activas.length,                     color: "#3b82f6" },
                { label: "Listos",      val: listos,                             color: "#10b981" },
                { label: "Diagnóstico", val: byFase["DIAGNOSTICO"]?.length || 0, color: "#f59e0b" },
                { label: "Reparación",  val: byFase["REPARACION"]?.length  || 0, color: "#ef4444" },
              ].map(k => (
                <div key={k.label} style={{
                  flex: 1, background: "#fff", borderRadius: 12,
                  padding: "12px 16px", borderLeft: `5px solid ${k.color}`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}>
                  <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>{k.label}</div>
                  <div style={{ fontSize: 40, fontWeight: 900, color: k.color, lineHeight: 1, marginTop: 3 }}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Kanban fases */}
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, overflow: "hidden" }}>
              {FASES.map(fase => {
                const cards = byFase[fase.key] || [];
                return (
                  <div key={fase.key} style={{
                    background: "#fff", borderRadius: 14,
                    border: `1.5px solid ${fase.color}33`,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    display: "flex", flexDirection: "column", overflow: "hidden",
                  }}>
                    <div style={{
                      padding: "9px 12px", background: fase.bg,
                      borderBottom: `3px solid ${fase.color}`,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <div>
                        <div style={{ fontSize: 14 }}>{fase.icon}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#111", marginTop: 1 }}>{fase.label}</div>
                      </div>
                      <div style={{
                        background: fase.color, color: "#fff",
                        borderRadius: "50%", width: 28, height: 28,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 900,
                      }}>{cards.length}</div>
                    </div>
                    <div style={{ flex: 1, overflowY: "hidden", padding: "7px 9px" }}>
                      {cards.length === 0 && (
                        <div style={{ textAlign: "center", color: "#d1d5db", fontSize: 12, padding: "14px 0", fontWeight: 600 }}>
                          Sin órdenes
                        </div>
                      )}
                      {cards.slice(0, 5).map((orden: any) => (
                        <div key={orden.id} style={{
                          background: fase.bg, borderRadius: 9, padding: "8px 10px",
                          marginBottom: 6, border: `1px solid ${fase.color}22`,
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {orden.cliente_nombre || "Sin cliente"}
                          </div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            🚗 {orden.vehiculo_info || "—"}
                          </div>
                        </div>
                      ))}
                      {cards.length > 5 && (
                        <div style={{ fontSize: 11, color: fase.color, textAlign: "center", fontWeight: 700 }}>
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

        {/* ─ SLIDE CAFETERÍA (por categoría) ──────────────────────────── */}
        {!esSliderTaller && (
          <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>

            {/* Sidebar — lista de categorías */}
            <div style={{
              width: 190, background: "#fff",
              borderRight: "2px solid #f3f4f6",
              display: "flex", flexDirection: "column", flexShrink: 0,
            }}>
              <div style={{
                background: "#ea580c", color: "#fff",
                padding: "12px 16px", fontWeight: 900, fontSize: 15, flexShrink: 0,
              }}>
                ☕ MENÚ DE EXPERIENCIA
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                {categorias.map((cat, i) => {
                  const isActive = cat === catActual;
                  const count = productos.filter((p: any) => (p.categoria || "General") === cat).length;
                  return (
                    <div key={cat} style={{
                      padding: "10px 12px", borderRadius: 10, marginBottom: 5,
                      background: isActive ? "#fff7ed" : "transparent",
                      border: isActive ? "1.5px solid #fed7aa" : "1.5px solid transparent",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      transition: "all 0.3s",
                    }}>
                      <div>
                        <div style={{
                          fontSize: 14, fontWeight: isActive ? 800 : 600,
                          color: isActive ? "#ea580c" : "#374151",
                        }}>{cat}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{count} item{count !== 1 ? "s" : ""}</div>
                      </div>
                      {isActive && (
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: "#ea580c",
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{
                borderTop: "1px solid #f3f4f6", padding: "10px 14px",
                fontSize: 11, color: "#9ca3af",
              }}>
                {productos.length} producto{productos.length !== 1 ? "s" : ""} en total
              </div>
            </div>

            {/* Grid de productos de la categoría */}
            <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Título categoría */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexShrink: 0 }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#111" }}>{catActual}</div>
                <div style={{ fontSize: 14, color: "#6b7280" }}>
                  {prodsCatActual.length} producto{prodsCatActual.length !== 1 ? "s" : ""} disponible{prodsCatActual.length !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Cards */}
              {prodsCatActual.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#d1d5db", fontSize: 18 }}>
                  Sin productos disponibles en esta categoría
                </div>
              ) : (
                <div style={{
                  flex: 1,
                  display: "grid",
                  gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                  gap: 14,
                  alignContent: "start",
                  overflow: "hidden",
                }}>
                  {prodsCatActual.map((prod: any) => (
                    <div key={prod.id} style={{
                      background: "#fff", borderRadius: 16,
                      boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
                      border: "1px solid #f3f4f6",
                      overflow: "hidden",
                      display: "flex", flexDirection: "column",
                    }}>
                      {/* Imagen compacta */}
                      {prod.imagen
                        ? <img src={prod.imagen} alt={prod.nombre}
                            style={{ width: "100%", height: 100, objectFit: "cover", flexShrink: 0 }} />
                        : <div style={{
                            width: "100%", height: 100, flexShrink: 0,
                            background: "#fff7ed",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 40,
                          }}>☕</div>
                      }
                      {/* Info */}
                      <div style={{ padding: "10px 14px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div style={{
                          fontWeight: 900, fontSize: 16, color: "#111",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>{prod.nombre}</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#16a34a", marginTop: 6 }}>
                          RD$ {Number(prod.precio).toFixed(2)}
                        </div>
                      </div>
                      {/* Barra naranja */}
                      <div style={{ height: 4, background: "#ea580c", flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══ FOOTER — dots y próxima categoría ════════════════════════════ */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "8px 0", background: "#fff",
        borderTop: "1px solid #f3f4f6", flexShrink: 0,
      }}>
        {/* Slide anterior */}
        {Array.from({ length: totalSlides }).map((_, i) => {
          const isActive = i === slideIdx;
          const isTaller = i === 0;
          const cat = categorias[i - 1];
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: isActive ? "4px 12px" : "4px 6px",
              borderRadius: 20,
              background: isActive ? (isTaller ? "#eff6ff" : "#fff7ed") : "transparent",
              border: isActive ? `1.5px solid ${isTaller ? "#bfdbfe" : "#fed7aa"}` : "none",
              transition: "all 0.4s ease",
            }}>
              <div style={{
                width: isActive ? 0 : 7, height: 7, borderRadius: "50%",
                background: isTaller ? "#3b82f6" : "#f97316",
                flexShrink: 0,
                display: isActive ? "none" : "block",
              }} />
              {isActive && (
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: isTaller ? "#1d4ed8" : "#ea580c",
                }}>
                  {isTaller ? "🔧 Taller" : `☕ ${cat}`}
                </span>
              )}
            </div>
          );
        })}
        <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 8 }}>
          Cambia cada 10s
        </span>
      </div>
    </div>
  );
}
