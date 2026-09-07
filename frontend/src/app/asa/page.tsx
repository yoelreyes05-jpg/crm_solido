"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { usePermisos } from "@/lib/usePermisos";
import { auditHeaders } from "@/lib/audit";
import {
  API_ASA, S, dinero, km as fmtKm, fechaCorta, hoyRD, nivelCombustible,
  COLOR_ESTADO_VEH, COLOR_SEVERIDAD, COLOR_ESTADO_FALLA, tipoGasto,
} from "@/lib/asa";

// ─────────────────────────────────────────────────────────────────────────────
// 🚚 ASA — TABLERO DE FLOTA
//
// Lo que el encargado de transportación necesita antes de las nueve de la
// mañana, en el orden en que le sirve:
//
//   1. Quién NO reportó todavía        (la unidad salió sin que nadie la mire)
//   2. Qué unidad no debe salir        (algo crítico en el parte de hoy)
//   3. Qué papel se vence              (marbete, seguro, inspección)
//   4. Qué falla lleva días abierta
//   5. Cuánto va costando cada unidad
//
// Los KPIs bonitos van al final a propósito: nadie decide nada a las 7am con
// un costo por kilómetro, pero sí con "la 03 no ha reportado".
// ─────────────────────────────────────────────────────────────────────────────

export default function ASADashboardPage() {
  const { puedeVer, puedeEditar } = usePermisos("asa");

  const [d, setD]             = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [fecha, setFecha]     = useState(hoyRD());

  const cargar = async () => {
    setCargando(true);
    try {
      const r = await fetch(`${API_ASA}/dashboard?fecha=${fecha}`).then(x => x.json());
      if (r.error) throw new Error(r.mensaje);
      setD(r);
      setError(null);
    } catch (e: any) {
      setError(e.message || "No se pudo conectar con el servidor.");
    } finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, [fecha]);

  const cambiarEstadoFalla = async (id: number, estado: string) => {
    try {
      await fetch(`${API_ASA}/fallas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...auditHeaders() },
        body: JSON.stringify({ estado }),
      });
      cargar();
    } catch { alert("No se pudo actualizar la falla."); }
  };

  const enlaceChequeo = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/asa/chequeo` : "/asa/chequeo"),
    []
  );

  if (!puedeVer) return <div style={{ padding: 40 }}>No tienes acceso al módulo ASA.</div>;
  if (cargando && !d) return <div style={{ padding: 40, color: "#64748b" }}>Cargando flota…</div>;
  if (error) return <div style={{ padding: 40, color: "#dc2626" }}>{error}</div>;

  const k = d?.kpis ?? {};

  const Kpi = ({ icono, label, valor, sub, color = "#0f172a", alerta = false }: any) => (
    <div style={{
      background: "#fff", border: `1px solid ${alerta ? color + "55" : "#e5e7eb"}`,
      borderLeft: `4px solid ${color}`, borderRadius: 12, padding: "14px 16px", minWidth: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: 0.5, textTransform: "uppercase" }}>
        {icono} {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color, marginTop: 4, lineHeight: 1.1 }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1500 }}>

      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>🚚 Flota ASA</h1>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 2 }}>
            Control de vehículos, chequeo diario, fallas y costos
          </div>
        </div>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
               style={{ ...S.input, width: 160 }} />
        <Link href="/asa/vehiculos" style={{ ...S.btnGhost, textDecoration: "none", padding: "10px 14px" }}>🚗 Vehículos</Link>
        <Link href="/asa/gastos"    style={{ ...S.btnGhost, textDecoration: "none", padding: "10px 14px" }}>💰 Gastos</Link>
        <Link href="/asa/reportes"  style={{ ...S.btnGhost, textDecoration: "none", padding: "10px 14px" }}>📊 Reportes</Link>
        <a href="/asa/chequeo" target="_blank" rel="noreferrer"
           style={{ ...S.btn, textDecoration: "none", background: "#0f766e" }}>📱 Abrir chequeo</a>
      </div>

      {/* Enlace para los conductores */}
      <div style={{
        ...S.card, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        background: "linear-gradient(135deg,#0f172a,#1e293b)", border: "none", color: "#e2e8f0",
      }}>
        <div style={{ fontSize: 28 }}>📱</div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Enlace del chequeo diario</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            Mándalo por WhatsApp a los conductores. No pide usuario ni contraseña: tocan su nombre y llenan el parte.
          </div>
        </div>
        <code style={{
          background: "#0b1220", padding: "9px 12px", borderRadius: 8,
          fontSize: 12, color: "#7dd3fc", maxWidth: "100%", overflow: "auto",
        }}>{enlaceChequeo}</code>
        <button onClick={() => { navigator.clipboard?.writeText(enlaceChequeo); }}
                style={{ ...S.btn, background: "#334155" }}>Copiar</button>
      </div>

      {/* Lo urgente */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 18 }}>
        <Kpi icono="⏰" label="Falta el parte" valor={k.faltan_chequeo ?? 0}
             sub={`${k.chequearon_hoy ?? 0} de ${k.vehiculos_activos ?? 0} reportaron`}
             color={k.faltan_chequeo ? "#dc2626" : "#16a34a"} alerta={!!k.faltan_chequeo} />
        <Kpi icono="⛔" label="No deben salir" valor={k.no_aptos ?? 0}
             sub="Algo crítico en el parte de hoy"
             color={k.no_aptos ? "#dc2626" : "#16a34a"} alerta={!!k.no_aptos} />
        <Kpi icono="📷" label="Sin fotos hoy" valor={k.sin_fotos_hoy ?? 0}
             sub="Partes con fotos incompletas"
             color={k.sin_fotos_hoy ? "#f59e0b" : "#16a34a"} alerta={!!k.sin_fotos_hoy} />
        <Kpi icono="🔧" label="Fallas abiertas" valor={k.fallas_abiertas ?? 0}
             sub={`${k.fallas_graves ?? 0} graves`}
             color={k.fallas_graves ? "#dc2626" : k.fallas_abiertas ? "#f59e0b" : "#16a34a"} alerta={!!k.fallas_abiertas} />
        <Kpi icono="🏷️" label="Documentos" valor={k.documentos_alerta ?? 0}
             sub="Vencidos o por vencer"
             color={k.documentos_alerta ? "#dc2626" : "#16a34a"} alerta={!!k.documentos_alerta} />
      </div>

      {/* Faltan por reportar */}
      {(d?.sin_chequeo?.length > 0) && (
        <div style={{ ...S.card, borderLeft: "4px solid #dc2626" }}>
          <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 10, color: "#b91c1c" }}>
            ⏰ Sin parte del {fechaCorta(fecha)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {d.sin_chequeo.map((v: any) => (
              <Link key={v.id} href={`/asa/vehiculos/${v.id}`} style={{
                display: "flex", alignItems: "center", gap: 8, textDecoration: "none",
                padding: "9px 13px", borderRadius: 10, border: "1px solid #fecaca",
                background: "#fef2f2", color: "#7f1d1d", fontWeight: 700, fontSize: 13,
              }}>
                <b>{v.codigo}</b> · {v.placa}
                <span style={{ color: "#b91c1c", fontSize: 11 }}>
                  {v.empleado ? `(${v.empleado})` : "(sin conductor asignado)"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Documentos por vencer */}
      {(d?.documentos_alerta?.length > 0) && (
        <div style={{ ...S.card, borderLeft: "4px solid #f59e0b" }}>
          <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 10 }}>🏷️ Documentos que vencen</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={S.th}>Vehículo</th><th style={S.th}>Documento</th>
                <th style={S.th}>Compañía</th><th style={S.th}>Vence</th><th style={S.th}>Situación</th>
              </tr></thead>
              <tbody>
                {d.documentos_alerta.map((x: any) => (
                  <tr key={x.id}>
                    <td style={S.td}><b>{x.codigo}</b> · {x.placa}</td>
                    <td style={S.td}>{x.tipo}{x.numero ? ` · ${x.numero}` : ""}</td>
                    <td style={S.td}>{x.compania || "—"}</td>
                    <td style={S.td}>{fechaCorta(x.vence)}</td>
                    <td style={S.td}>
                      <span style={S.chip(x.situacion === "VENCIDO" ? "#dc2626" : "#f59e0b")}>
                        {x.situacion === "VENCIDO"
                          ? `Vencido hace ${Math.abs(x.dias_restantes)} d`
                          : `En ${x.dias_restantes} d`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fallas abiertas */}
      <div style={S.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 15, flex: 1 }}>🔧 Fallas abiertas</div>
          <Link href="/asa/fallas" style={{ ...S.btnGhost, textDecoration: "none" }}>Ver todas</Link>
        </div>
        {(!d?.fallas_abiertas?.length) ? (
          <div style={{ color: "#64748b", fontSize: 14, padding: "10px 0" }}>
            Ninguna falla abierta. 👍
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={S.th}>Vehículo</th><th style={S.th}>Falla</th>
                <th style={S.th}>Severidad</th><th style={S.th}>Veces</th>
                <th style={S.th}>Reportó</th><th style={S.th}>Último</th>
                <th style={S.th}>Estado</th>
              </tr></thead>
              <tbody>
                {d.fallas_abiertas.slice(0, 12).map((f: any) => (
                  <tr key={f.id}>
                    <td style={S.td}>
                      <b>{f.asa_vehiculos?.codigo}</b>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{f.asa_vehiculos?.placa}</div>
                    </td>
                    <td style={S.td}>
                      {f.falla_etiqueta}
                      {f.detiene_vehiculo && <span title="No debe salir" style={{ marginLeft: 6 }}>⛔</span>}
                    </td>
                    <td style={S.td}>
                      <span style={S.chip(COLOR_SEVERIDAD[f.severidad] || "#64748b")}>{f.severidad}</span>
                    </td>
                    <td style={S.td}>{f.veces_reportada}</td>
                    <td style={S.td}>{f.empleado_nombre || "—"}</td>
                    <td style={S.td}>{fechaCorta(String(f.ultima_vez).slice(0, 10))}</td>
                    <td style={S.td}>
                      {puedeEditar ? (
                        <select value={f.estado} onChange={e => cambiarEstadoFalla(f.id, e.target.value)}
                                style={{ ...S.input, padding: "5px 8px", width: 130, fontSize: 12 }}>
                          <option value="ABIERTA">Abierta</option>
                          <option value="EN_REVISION">En revisión</option>
                          <option value="EN_TALLER">En taller</option>
                          <option value="RESUELTA">Resuelta</option>
                          <option value="DESCARTADA">Descartada</option>
                        </select>
                      ) : (
                        <span style={S.chip(COLOR_ESTADO_FALLA[f.estado] || "#64748b")}>{f.estado}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Partes de hoy */}
      <div style={S.card}>
        <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>
          📋 Partes del {fechaCorta(fecha)}
        </div>
        {(!d?.chequeos_hoy?.length) ? (
          <div style={{ color: "#64748b", fontSize: 14 }}>Todavía nadie ha reportado.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 12 }}>
            {d.chequeos_hoy.map((c: any) => {
              const v = d.vehiculos.find((x: any) => x.id === c.vehiculo_id);
              const n = nivelCombustible(c.combustible_octavos);
              return (
                <Link key={c.id} href={`/asa/vehiculos/${c.vehiculo_id}`} style={{
                  textDecoration: "none", color: "inherit",
                  border: `1px solid ${c.apto_circular ? "#e5e7eb" : "#fecaca"}`,
                  background: c.apto_circular ? "#fff" : "#fef2f2",
                  borderRadius: 12, padding: 14, display: "block",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <b style={{ fontSize: 15 }}>{v?.codigo || "—"}</b>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{v?.placa}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: "#64748b" }}>
                      {c.turno === "SALIDA" ? "🌅" : "🌙"} {c.turno}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>👤 {c.empleado_nombre}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={S.chip("#0f172a")}>{fmtKm(c.km)}</span>
                    <span style={S.chip(n.color)}>⛽ {n.label}</span>
                    {c.items_mal > 0 && <span style={S.chip("#f59e0b")}>{c.items_mal} en mal estado</span>}
                    {c.fallas_reportadas > 0 && <span style={S.chip("#dc2626")}>{c.fallas_reportadas} fallas</span>}
                    <span style={S.chip(c.fotos_completas ? "#16a34a" : "#f59e0b")}>
                      {c.fotos_completas ? "📷 fotos ok" : "📷 sin fotos"}
                    </span>
                    {!c.apto_circular && <span style={S.chip("#dc2626")}>⛔ no debe salir</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Costos */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 18 }}>
        <Kpi icono="💰" label="Gasto del mes" valor={dinero(k.gasto_mes)} sub={`${k.galones_mes ?? 0} galones`} color="#0f766e" />
        <Kpi icono="📏" label="Km de la flota" valor={fmtKm(k.km_flota)} sub="Acumulado histórico" color="#1d4ed8" />
        <Kpi icono="📉" label="Costo por km" valor={k.costo_km_flota != null ? dinero(k.costo_km_flota) : "—"} sub="Promedio de la flota" color="#7c3aed" />
        <Kpi icono="🚗" label="En taller" valor={k.vehiculos_en_taller ?? 0} sub={`${k.vehiculos_activos ?? 0} activos`} color="#f59e0b" />
      </div>

      {/* Gasto del mes por tipo */}
      {d?.gasto_mes_por_tipo && Object.keys(d.gasto_mes_por_tipo).length > 0 && (
        <div style={S.card}>
          <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>💸 Gasto del mes por tipo</div>
          <div style={{ display: "grid", gap: 8 }}>
            {Object.entries(d.gasto_mes_por_tipo)
              .sort((a: any, b: any) => b[1] - a[1])
              .map(([tipo, monto]: any) => {
                const t = tipoGasto(tipo);
                const max = Math.max(...Object.values(d.gasto_mes_por_tipo).map(Number));
                return (
                  <div key={tipo} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 130, fontSize: 13, fontWeight: 700, color: "#334155" }}>
                      {t.icono} {t.label}
                    </div>
                    <div style={{ flex: 1, height: 20, background: "#f1f5f9", borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ width: `${(Number(monto) / max) * 100}%`, height: "100%", background: t.color }} />
                    </div>
                    <div style={{ width: 120, textAlign: "right", fontSize: 13, fontWeight: 800 }}>{dinero(monto)}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Tabla de la flota */}
      <div style={S.card}>
        <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>🚗 La flota</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={S.th}>Código</th><th style={S.th}>Vehículo</th><th style={S.th}>Conductor</th>
              <th style={S.th}>Estado</th><th style={S.th}>Km actual</th><th style={S.th}>Recorridos</th>
              <th style={S.th}>Gastado</th><th style={S.th}>Costo/km</th><th style={S.th}>Km/galón</th>
              <th style={S.th}>Fallas</th><th style={S.th}>Último parte</th>
            </tr></thead>
            <tbody>
              {(d?.vehiculos || []).map((v: any) => (
                <tr key={v.id}>
                  <td style={S.td}>
                    <Link href={`/asa/vehiculos/${v.id}`} style={{ fontWeight: 800, color: "#1d4ed8", textDecoration: "none" }}>
                      {v.codigo}
                    </Link>
                  </td>
                  <td style={S.td}>
                    {v.placa}
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{[v.marca, v.modelo, v.anio].filter(Boolean).join(" ")}</div>
                  </td>
                  <td style={S.td}>{v.empleado || <span style={{ color: "#cbd5e1" }}>sin asignar</span>}</td>
                  <td style={S.td}><span style={S.chip(COLOR_ESTADO_VEH[v.estado] || "#64748b")}>{v.estado}</span></td>
                  <td style={S.td}>{fmtKm(v.km_actual)}</td>
                  <td style={S.td}>{fmtKm(v.km_recorridos)}</td>
                  <td style={S.td}>{dinero(v.total_gastado)}</td>
                  <td style={S.td}>{v.costo_por_km != null ? <b>{dinero(v.costo_por_km)}</b> : "—"}</td>
                  <td style={S.td}>{v.km_por_galon != null ? `${v.km_por_galon}` : "—"}</td>
                  <td style={S.td}>
                    {v.fallas_abiertas > 0
                      ? <span style={S.chip("#dc2626")}>{v.fallas_abiertas}</span>
                      : <span style={{ color: "#cbd5e1" }}>0</span>}
                  </td>
                  <td style={S.td}>{fechaCorta(v.ultimo_chequeo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
