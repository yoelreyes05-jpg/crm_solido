"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { usePermisos } from "@/lib/usePermisos";
import { S, dinero, km as fmtKm, hoyRD, TIPOS_GASTO, asaGet } from "@/lib/asa";

// ─────────────────────────────────────────────────────────────────────────────
// 📊 ASA — REPORTES
//
// Dos preguntas, dos tablas:
//
//   ¿Cuánto cuesta cada unidad?   Costo por km en un rango de fechas. Es el
//                                 único número que compara de verdad una
//                                 camioneta vieja con una nueva: el total
//                                 gastado siempre castiga a la que más rueda.
//
//   ¿Quién está cumpliendo?       Partes entregados, días reportados y fotos
//                                 completas por conductor. Sin esto, el que
//                                 nunca llena el parte pasa desapercibido
//                                 justo hasta que aparece un golpe sin dueño.
//
// Los km del período salen del primer y último odómetro leído en el rango, no
// de sumar los recorridos diarios: así los días sin parte no descuadran nada.
// ─────────────────────────────────────────────────────────────────────────────

export default function ReportesASAPage() {
  const { puedeVer } = usePermisos("asa");

  const hoy = hoyRD();
  const [desde, setDesde] = useState(hoy.slice(0, 5) + "01-01");
  const [hasta, setHasta] = useState(hoy);
  const [tab, setTab]     = useState<"costos" | "conductores">("costos");

  const [costos, setCostos]           = useState<any>(null);
  const [conductores, setConductores] = useState<any[]>([]);
  const [cargando, setCargando]       = useState(true);

  const cargar = async () => {
    setCargando(true);
    try {
      const [c, k] = await Promise.all([
        asaGet<any>(`/reportes/costos?desde=${desde}&hasta=${hasta}`),
        asaGet<any>(`/reportes/conductores?desde=${desde}&hasta=${hasta}`),
      ]);
      setCostos(c);
      setConductores(k.conductores || []);
    } catch { /* sin datos: las tablas quedan vacías */ }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, [desde, hasta]);

  const tiposPresentes = useMemo(() => {
    const s = new Set<string>();
    for (const v of costos?.por_vehiculo || []) Object.keys(v.por_tipo || {}).forEach(t => s.add(t));
    return TIPOS_GASTO.filter(t => s.has(t.codigo));
  }, [costos]);

  const exportarCSV = () => {
    const filas = (costos?.por_vehiculo || []).map((v: any) => ([
      v.codigo, v.placa, v.vehiculo, v.km_periodo, v.total, v.costo_km ?? "",
      v.galones, v.km_galon ?? "", v.movimientos,
    ]));
    const cab = ["Codigo", "Placa", "Vehiculo", "Km del periodo", "Total gastado", "Costo por km", "Galones", "Km por galon", "Movimientos"];
    const csv = [cab, ...filas].map(f => f.map((x: any) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `asa-costos-${desde}-a-${hasta}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!puedeVer) return <div style={{ padding: 40 }}>No tienes acceso al módulo ASA.</div>;

  const t = costos?.totales || {};

  return (
    <div style={{ padding: 24, maxWidth: 1600 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>📊 Reportes de flota</h1>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 2 }}>Costos por unidad y cumplimiento por conductor</div>
        </div>
        <div><label style={S.label}>Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ ...S.input, width: 150 }} /></div>
        <div><label style={S.label}>Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ ...S.input, width: 150 }} /></div>
        <button onClick={exportarCSV} style={S.btnGhost}>⬇ CSV</button>
        <Link href="/asa" style={{ ...S.btnGhost, textDecoration: "none", padding: "10px 14px" }}>← Tablero</Link>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["costos", "💰 Costos por vehículo"], ["conductores", "👥 Conductores"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)} style={{
            padding: "9px 15px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 700,
            border: `1px solid ${tab === id ? "#1d4ed8" : "#e2e8f0"}`,
            background: tab === id ? "#eff6ff" : "#fff", color: tab === id ? "#1d4ed8" : "#475569",
          }}>{label}</button>
        ))}
      </div>

      {cargando && <div style={{ color: "#64748b", padding: 20 }}>Calculando…</div>}

      {!cargando && tab === "costos" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 18 }}>
            {[
              ["Gasto del período", dinero(t.total), "#0f766e"],
              ["Km recorridos", fmtKm(t.km), "#1d4ed8"],
              ["Costo por km", t.costo_km != null ? dinero(t.costo_km) : "—", "#7c3aed"],
              ["Galones", `${Math.round((t.galones || 0) * 10) / 10}`, "#f59e0b"],
            ].map(([label, valor, color]: any) => (
              <div key={label} style={{
                background: "#fff", border: "1px solid #e5e7eb", borderLeft: `4px solid ${color}`,
                borderRadius: 12, padding: "14px 16px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color, marginTop: 4 }}>{valor}</div>
              </div>
            ))}
          </div>

          <div style={S.card}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={S.th}>Vehículo</th><th style={S.th}>Km período</th>
                  {tiposPresentes.map(x => <th key={x.codigo} style={S.th}>{x.icono} {x.label}</th>)}
                  <th style={S.th}>Total</th><th style={S.th}>Costo/km</th><th style={S.th}>Km/gal</th>
                </tr></thead>
                <tbody>
                  {(costos?.por_vehiculo || [])
                    .slice()
                    .sort((a: any, b: any) => (b.costo_km ?? -1) - (a.costo_km ?? -1))
                    .map((v: any) => (
                      <tr key={v.id}>
                        <td style={S.td}>
                          <Link href={`/asa/vehiculos/${v.id}`} style={{ fontWeight: 800, color: "#1d4ed8", textDecoration: "none" }}>
                            {v.codigo}
                          </Link>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{v.placa} · {v.vehiculo}</div>
                        </td>
                        <td style={S.td}>{v.km_periodo.toLocaleString("es-DO")}</td>
                        {tiposPresentes.map(x => (
                          <td key={x.codigo} style={S.td}>
                            {v.por_tipo?.[x.codigo] ? dinero(v.por_tipo[x.codigo]) : <span style={{ color: "#e2e8f0" }}>—</span>}
                          </td>
                        ))}
                        <td style={{ ...S.td, fontWeight: 800 }}>{dinero(v.total)}</td>
                        <td style={S.td}>
                          {v.costo_km != null
                            ? <span style={S.chip(v.costo_km > (t.costo_km || 0) * 1.3 ? "#dc2626" : "#16a34a")}>{dinero(v.costo_km)}</span>
                            : "—"}
                        </td>
                        <td style={S.td}>{v.km_galon ?? "—"}</td>
                      </tr>
                    ))}
                  {!costos?.por_vehiculo?.length && (
                    <tr><td style={S.td} colSpan={4 + tiposPresentes.length}>Sin movimientos en el período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 12 }}>
              En rojo, las unidades cuyo costo por kilómetro pasa un 30% del promedio de la flota.
              Antes de pensar en reemplazarlas conviene descartar lo barato: gomas, filtro de aire y forma de manejar.
            </div>
          </div>
        </>
      )}

      {!cargando && tab === "conductores" && (
        <div style={S.card}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={S.th}>Conductor</th><th style={S.th}>Partes</th><th style={S.th}>Días reportados</th>
                <th style={S.th}>Km recorridos</th><th style={S.th}>Con fotos</th><th style={S.th}>Sin fotos</th>
                <th style={S.th}>Cumplimiento fotos</th><th style={S.th}>Puntos en mal estado</th>
                <th style={S.th}>Fallas reportadas</th>
              </tr></thead>
              <tbody>
                {conductores.map(c => (
                  <tr key={c.id}>
                    <td style={S.td}><b>{c.nombre}</b><div style={{ fontSize: 11, color: "#94a3b8" }}>{c.cargo}</div></td>
                    <td style={S.td}>{c.partes}</td>
                    <td style={S.td}>{c.dias_reportados}</td>
                    <td style={S.td}>{fmtKm(c.km_recorrido)}</td>
                    <td style={S.td}>{c.con_fotos}</td>
                    <td style={S.td}>{c.sin_fotos || "—"}</td>
                    <td style={S.td}>
                      {c.cumplimiento_fotos == null ? "—" : (
                        <span style={S.chip(c.cumplimiento_fotos >= 80 ? "#16a34a" : c.cumplimiento_fotos >= 50 ? "#f59e0b" : "#dc2626")}>
                          {c.cumplimiento_fotos}%
                        </span>
                      )}
                    </td>
                    <td style={S.td}>{c.items_mal || "—"}</td>
                    <td style={S.td}>{c.fallas_reportadas || "—"}</td>
                  </tr>
                ))}
                {!conductores.length && <tr><td style={S.td} colSpan={9}>Sin partes en el período.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 12 }}>
            Un conductor con cero fallas reportadas en todo un mes no siempre es buena noticia:
            puede que esté llenando el parte de corrido sin mirar el vehículo.
          </div>
        </div>
      )}
    </div>
  );
}
