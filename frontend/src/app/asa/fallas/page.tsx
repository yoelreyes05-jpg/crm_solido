"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";

import { usePermisos } from "@/lib/usePermisos";
import { auditHeaders } from "@/lib/audit";
import {
  S, dinero, km as fmtKm, fechaCorta, COLOR_SEVERIDAD, COLOR_ESTADO_FALLA, asaGet, asaEnviar,
} from "@/lib/asa";

// ─────────────────────────────────────────────────────────────────────────────
// 🔧 ASA — FALLAS REPORTADAS
//
// Cada falla se abre una sola vez por vehículo y se va acumulando: si el
// conductor reporta "goma baja" cinco días seguidos, es una falla con cinco
// reportes, no cinco fallas. Ese contador es la señal — algo que se reporta
// cinco veces y sigue abierto es un problema de gestión, no del vehículo.
//
// El panel de fallas frecuentes cruza todas las unidades. Un mismo código
// saliendo en tres camionetas distintas rara vez es coincidencia: suele ser
// el suplidor de gomas o la ruta.
// ─────────────────────────────────────────────────────────────────────────────

const ESTADOS = [
  { v: "ABIERTA",     label: "Abierta" },
  { v: "EN_REVISION", label: "En revisión" },
  { v: "EN_TALLER",   label: "En taller" },
  { v: "RESUELTA",    label: "Resuelta" },
  { v: "DESCARTADA",  label: "Descartada" },
];

export default function FallasASAPage() {
  const { puedeVer, puedeEditar } = usePermisos("asa");

  const [fallas, setFallas]         = useState<any[]>([]);
  const [frecuentes, setFrecuentes] = useState<any[]>([]);
  const [filtro, setFiltro]         = useState("");
  const [cargando, setCargando]     = useState(true);
  const [cerrando, setCerrando]     = useState<any>(null);

  const cargar = async () => {
    setCargando(true);
    try {
      const p = filtro ? `?estado=${filtro}` : "";
      const d = await asaGet<any>(`/fallas${p}`);
      setFallas(d.fallas || []);
      setFrecuentes(d.frecuentes || []);
    } catch { /* la tabla queda vacía */ }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, [filtro]);

  const cambiar = async (id: number, estado: string) => {
    try {
      await asaEnviar(`/fallas/${id}`, "PATCH", { estado }, auditHeaders());
      cargar();
    } catch (e: any) { alert(e.message); }
  };

  const cerrar = async (costo: string, nota: string) => {
    try {
      await asaEnviar(`/fallas/${cerrando.id}`, "PATCH", {
        estado: "RESUELTA",
        costo_reparacion: costo === "" ? null : Number(costo),
        nota: nota || null,
      }, auditHeaders());
      setCerrando(null);
      cargar();
    } catch (e: any) { alert(e.message); }
  };

  if (!puedeVer) return <div style={{ padding: 40 }}>No tienes acceso al módulo ASA.</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1500 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>🔧 Fallas reportadas</h1>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 2 }}>
            Lo que los conductores están reportando desde el chequeo diario
          </div>
        </div>
        <select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ ...S.input, width: 190 }}>
          <option value="">Abiertas y en curso</option>
          {ESTADOS.map(e => <option key={e.v} value={e.v}>{e.label}</option>)}
        </select>
        <Link href="/asa" style={{ ...S.btnGhost, textDecoration: "none", padding: "10px 14px" }}>← Tablero</Link>
      </div>

      <div style={S.card}>
        {cargando ? <div style={{ color: "#64748b" }}>Cargando…</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={S.th}>Vehículo</th><th style={S.th}>Falla</th><th style={S.th}>Categoría</th>
                <th style={S.th}>Severidad</th><th style={S.th}>Veces</th><th style={S.th}>Reportó</th>
                <th style={S.th}>Desde</th><th style={S.th}>Km</th><th style={S.th}>Costo</th>
                <th style={S.th}>Estado</th><th style={S.th}></th>
              </tr></thead>
              <tbody>
                {fallas.map(f => {
                  const dias = Math.round((Date.now() - new Date(f.primera_vez).getTime()) / 86400000);
                  return (
                    <tr key={f.id} style={f.detiene_vehiculo && f.estado === "ABIERTA" ? { background: "#fef2f2" } : undefined}>
                      <td style={S.td}>
                        <Link href={`/asa/vehiculos/${f.vehiculo_id}`} style={{ fontWeight: 800, color: "#1d4ed8", textDecoration: "none" }}>
                          {f.asa_vehiculos?.codigo}
                        </Link>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{f.asa_vehiculos?.placa}</div>
                      </td>
                      <td style={S.td}>{f.falla_etiqueta} {f.detiene_vehiculo && <span title="No debe salir">⛔</span>}</td>
                      <td style={S.td}>{f.categoria}</td>
                      <td style={S.td}><span style={S.chip(COLOR_SEVERIDAD[f.severidad] || "#64748b")}>{f.severidad}</span></td>
                      <td style={S.td}>
                        <span style={S.chip(f.veces_reportada >= 3 ? "#dc2626" : "#64748b")}>{f.veces_reportada}</span>
                      </td>
                      <td style={S.td}>{f.empleado_nombre || "—"}</td>
                      <td style={S.td}>
                        {fechaCorta(String(f.primera_vez).slice(0, 10))}
                        <div style={{ fontSize: 11, color: dias > 7 ? "#dc2626" : "#94a3b8" }}>hace {dias} d</div>
                      </td>
                      <td style={S.td}>{f.km_reporte != null ? fmtKm(f.km_reporte) : "—"}</td>
                      <td style={S.td}>{f.costo_reparacion != null ? dinero(f.costo_reparacion) : "—"}</td>
                      <td style={S.td}>
                        {puedeEditar ? (
                          <select value={f.estado} onChange={e => {
                            if (e.target.value === "RESUELTA") setCerrando(f);
                            else cambiar(f.id, e.target.value);
                          }} style={{ ...S.input, padding: "5px 8px", width: 130, fontSize: 12 }}>
                            {ESTADOS.map(x => <option key={x.v} value={x.v}>{x.label}</option>)}
                          </select>
                        ) : (
                          <span style={S.chip(COLOR_ESTADO_FALLA[f.estado] || "#64748b")}>{f.estado}</span>
                        )}
                      </td>
                      <td style={S.td}>
                        {puedeEditar && f.estado !== "RESUELTA" && (
                          <button onClick={() => setCerrando(f)} style={S.btnGhost}>Cerrar</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!fallas.length && (
                  <tr><td style={S.td} colSpan={11}>Nada por aquí. 👍</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Frecuentes */}
      <div style={S.card}>
        <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 4 }}>📈 Las que más se repiten</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
          Cruzando toda la flota. Si una misma falla aparece en varias unidades, mira el suplidor o la ruta antes que el vehículo.
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={S.th}>Falla</th><th style={S.th}>Categoría</th><th style={S.th}>Severidad</th>
              <th style={S.th}>Reportes</th><th style={S.th}>Veces totales</th>
              <th style={S.th}>Vehículos</th><th style={S.th}>Abiertas</th><th style={S.th}>Costo acumulado</th>
            </tr></thead>
            <tbody>
              {frecuentes.map((f, i) => (
                <tr key={i}>
                  <td style={S.td}><b>{f.falla_etiqueta}</b></td>
                  <td style={S.td}>{f.categoria}</td>
                  <td style={S.td}><span style={S.chip(COLOR_SEVERIDAD[f.severidad] || "#64748b")}>{f.severidad}</span></td>
                  <td style={S.td}>{f.reportes}</td>
                  <td style={S.td}>{f.veces_total}</td>
                  <td style={S.td}>
                    {f.vehiculos_afectados > 1
                      ? <span style={S.chip("#f59e0b")}>{f.vehiculos_afectados} unidades</span>
                      : f.vehiculos_afectados}
                  </td>
                  <td style={S.td}>{f.abiertas || "—"}</td>
                  <td style={S.td}>{Number(f.costo_acumulado) > 0 ? dinero(f.costo_acumulado) : "—"}</td>
                </tr>
              ))}
              {!frecuentes.length && <tr><td style={S.td} colSpan={8}>Todavía no hay historial suficiente.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {cerrando && <ModalCerrar falla={cerrando} onCerrar={() => setCerrando(null)} onGuardar={cerrar} />}
    </div>
  );
}

function ModalCerrar({ falla, onCerrar, onGuardar }: any) {
  const [costo, setCosto] = useState("");
  const [nota, setNota]   = useState("");
  return (
    <div onClick={onCerrar} style={{
      position: "fixed", inset: 0, background: "#0f172a99", zIndex: 200,
      display: "grid", placeItems: "center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Cerrar falla</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 0 }}>
          <b>{falla.falla_etiqueta}</b> en {falla.asa_vehiculos?.codigo}.
          El costo que anotes aquí alimenta el costo por kilómetro de la unidad.
        </p>
        <label style={S.label}>Costo de la reparación</label>
        <input type="number" value={costo} onChange={e => setCosto(e.target.value)} style={S.input} />
        <div style={{ marginTop: 12 }}>
          <label style={S.label}>Qué se hizo</label>
          <textarea value={nota} onChange={e => setNota(e.target.value)}
                    style={{ ...S.input, minHeight: 70, resize: "vertical" }} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button onClick={onCerrar} style={S.btnGhost}>Cancelar</button>
          <button onClick={() => onGuardar(costo, nota)} style={{ ...S.btn, background: "#16a34a" }}>Marcar resuelta</button>
        </div>
      </div>
    </div>
  );
}
