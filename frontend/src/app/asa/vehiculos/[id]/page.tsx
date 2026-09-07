"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { usePermisos } from "@/lib/usePermisos";
import { auditHeaders } from "@/lib/audit";
import {
  API_ASA, S, dinero, km as fmtKm, fechaCorta, hoyRD, nivelCombustible,
  COLOR_ESTADO_VEH, COLOR_SEVERIDAD, COLOR_ESTADO_FALLA, tipoGasto, asaGet, asaEnviar,
} from "@/lib/asa";

// ─────────────────────────────────────────────────────────────────────────────
// 🚙 ASA — FICHA DEL VEHÍCULO
//
// Todo lo de una unidad en una pantalla: lo que costó, lo que recorrió, lo
// que le pasa, lo que le hicieron y cómo se ve.
//
// El rendimiento (km/galón) se calcula tanqueo a tanqueo y no dividiendo el
// total: los tanqueos parciales ensucian el promedio general y dan cifras que
// nadie se cree.
// ─────────────────────────────────────────────────────────────────────────────

const PESTANAS = [
  { id: "resumen",  label: "Resumen",       icono: "📊" },
  { id: "chequeos", label: "Partes",        icono: "📋" },
  { id: "fallas",   label: "Fallas",        icono: "🔧" },
  { id: "gastos",   label: "Gastos",        icono: "💰" },
  { id: "fotos",    label: "Fotos",         icono: "📷" },
  { id: "docs",     label: "Documentos",    icono: "🏷️" },
  { id: "mant",     label: "Mantenimiento", icono: "🛠️" },
];

export default function FichaVehiculoASAPage() {
  const params = useParams();
  const id = Number(params?.id);
  const { puedeVer, puedeEditar } = usePermisos("asa");

  const [d, setD]           = useState<any>(null);
  const [cargando, setCarg] = useState(true);
  const [tab, setTab]       = useState("resumen");
  const [error, setError]   = useState<string | null>(null);

  const cargar = async () => {
    setCarg(true);
    try {
      const r = await asaGet<any>(`/vehiculos/${id}/ficha`);
      setD(r); setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setCarg(false); }
  };
  useEffect(() => { if (id) cargar(); }, [id]);

  const rendimientoPromedio = useMemo(() => {
    const r = d?.rendimientos || [];
    if (!r.length) return null;
    return Math.round((r.reduce((s: number, x: any) => s + x.km_galon, 0) / r.length) * 100) / 100;
  }, [d]);

  if (!puedeVer) return <div style={{ padding: 40 }}>No tienes acceso al módulo ASA.</div>;
  if (cargando && !d) return <div style={{ padding: 40, color: "#64748b" }}>Cargando ficha…</div>;
  if (error) return <div style={{ padding: 40, color: "#dc2626" }}>{error}</div>;

  const v = d.vehiculo;
  const r = d.resumen || {};

  const Dato = ({ label, valor, color }: any) => (
    <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 900, marginTop: 3, color: color || "#0f172a" }}>{valor}</div>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>

      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <Link href="/asa/vehiculos" style={{ ...S.btnGhost, textDecoration: "none", padding: "10px 14px" }}>←</Link>
        <div style={{
          width: 56, height: 56, borderRadius: 14, background: "#f1f5f9",
          display: "grid", placeItems: "center", fontSize: 28,
        }}>{v.tipo === "MOTOR" ? "🏍️" : v.tipo === "CAMION" ? "🚛" : v.tipo === "AUTOBUS" || v.tipo === "MINIBUS" ? "🚐" : "🚙"}</div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>
            {v.codigo} <span style={{ color: "#64748b", fontWeight: 700, fontSize: 18 }}>· {v.placa}</span>
          </h1>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 2 }}>
            {[v.marca, v.modelo, v.anio, v.color].filter(Boolean).join(" · ")} · {v.combustible}
          </div>
        </div>
        <span style={S.chip(COLOR_ESTADO_VEH[v.estado] || "#64748b")}>{v.estado.replace("_", " ")}</span>
        {r.conductor && <span style={S.chip("#1d4ed8")}>👤 {r.conductor}</span>}
      </div>

      {/* Cifras clave */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 18 }}>
        <Dato label="Km actual" valor={fmtKm(v.km_actual)} />
        <Dato label="Recorridos" valor={fmtKm(r.km_recorridos)} />
        <Dato label="Total gastado" valor={dinero(r.total_gastado)} color="#0f766e" />
        <Dato label="Costo por km" valor={r.costo_por_km != null ? dinero(r.costo_por_km) : "—"} color="#7c3aed" />
        <Dato label="Km por galón" valor={rendimientoPromedio ?? (r.km_por_galon ?? "—")} color="#1d4ed8" />
        <Dato label="Fallas abiertas" valor={r.fallas_abiertas ?? 0}
              color={r.fallas_abiertas ? "#dc2626" : "#16a34a"} />
      </div>

      {/* Pestañas */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16, borderBottom: "1px solid #e5e7eb", paddingBottom: 10 }}>
        {PESTANAS.map(p => (
          <button key={p.id} onClick={() => setTab(p.id)} style={{
            padding: "9px 15px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 700,
            border: `1px solid ${tab === p.id ? "#1d4ed8" : "#e2e8f0"}`,
            background: tab === p.id ? "#eff6ff" : "#fff",
            color: tab === p.id ? "#1d4ed8" : "#475569",
          }}>{p.icono} {p.label}</button>
        ))}
      </div>

      {/* ── RESUMEN ─────────────────────────────────────────────────────────── */}
      {tab === "resumen" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
            <div style={S.card}>
              <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>💸 En qué se ha ido el dinero</div>
              {(() => {
                const filas = [
                  ["Combustible", r.total_combustible, "#f59e0b"],
                  ["Mantenimiento y gomas", r.total_mantenimiento, "#0ea5e9"],
                  ["Reparaciones", r.total_reparacion, "#dc2626"],
                  ["Documentos y seguro", r.total_documentos, "#8b5cf6"],
                  ["Peajes, parqueo y multas", r.total_multas, "#64748b"],
                ] as [string, number, string][];
                const max = Math.max(1, ...filas.map(f => Number(f[1] || 0)));
                return filas.map(([label, monto, color]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                    <div style={{ width: 170, fontSize: 13, color: "#334155", fontWeight: 600 }}>{label}</div>
                    <div style={{ flex: 1, height: 18, background: "#f1f5f9", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ width: `${(Number(monto || 0) / max) * 100}%`, height: "100%", background: color }} />
                    </div>
                    <div style={{ width: 110, textAlign: "right", fontSize: 13, fontWeight: 800 }}>{dinero(monto)}</div>
                  </div>
                ));
              })()}
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>⛽ Rendimiento tanqueo a tanqueo</div>
              {(!d.rendimientos?.length) ? (
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  Hacen falta al menos dos tanqueos con kilometraje anotado para poder calcularlo.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      <th style={S.th}>Fecha</th><th style={S.th}>Km recorridos</th>
                      <th style={S.th}>Galones</th><th style={S.th}>Km/galón</th>
                    </tr></thead>
                    <tbody>
                      {d.rendimientos.slice(-12).reverse().map((x: any, i: number) => (
                        <tr key={i}>
                          <td style={S.td}>{fechaCorta(x.fecha)}</td>
                          <td style={S.td}>{x.km.toLocaleString("es-DO")}</td>
                          <td style={S.td}>{x.galones}</td>
                          <td style={S.td}><b style={{
                            color: rendimientoPromedio && x.km_galon < rendimientoPromedio * 0.8 ? "#dc2626" : "#16a34a",
                          }}>{x.km_galon}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                    Un rendimiento que cae bruscamente suele ser una goma baja, un filtro sucio
                    o combustible que no llegó al tanque.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={S.card}>
            <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>👥 Quién ha manejado esta unidad</div>
            {(!d.asignaciones?.length) ? (
              <div style={{ color: "#64748b", fontSize: 13 }}>Sin asignaciones registradas.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={S.th}>Conductor</th><th style={S.th}>Desde</th><th style={S.th}>Hasta</th>
                  <th style={S.th}>Km entrega</th><th style={S.th}>Km devolución</th><th style={S.th}>Asignó</th>
                </tr></thead>
                <tbody>
                  {d.asignaciones.map((a: any) => (
                    <tr key={a.id}>
                      <td style={S.td}><b>{a.asa_flota_conductores?.nombre || "—"}</b></td>
                      <td style={S.td}>{fechaCorta(a.desde)}</td>
                      <td style={S.td}>{a.hasta ? fechaCorta(a.hasta) : <span style={S.chip("#16a34a")}>Actual</span>}</td>
                      <td style={S.td}>{a.km_entrega != null ? fmtKm(a.km_entrega) : "—"}</td>
                      <td style={S.td}>{a.km_devuelve != null ? fmtKm(a.km_devuelve) : "—"}</td>
                      <td style={S.td}>{a.asignado_por || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── PARTES ──────────────────────────────────────────────────────────── */}
      {tab === "chequeos" && (
        <div style={S.card}>
          <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>📋 Partes diarios</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={S.th}>Fecha</th><th style={S.th}>Turno</th><th style={S.th}>Conductor</th>
                <th style={S.th}>Km</th><th style={S.th}>Recorrido</th><th style={S.th}>Combustible</th>
                <th style={S.th}>En mal estado</th><th style={S.th}>Fallas</th>
                <th style={S.th}>Fotos</th><th style={S.th}>Apto</th>
              </tr></thead>
              <tbody>
                {(d.chequeos || []).map((c: any) => {
                  const n = nivelCombustible(c.combustible_octavos);
                  return (
                    <tr key={c.id}>
                      <td style={S.td}>{fechaCorta(c.fecha)}</td>
                      <td style={S.td}>{c.turno === "SALIDA" ? "🌅" : "🌙"}</td>
                      <td style={S.td}>{c.conductor_nombre}</td>
                      <td style={S.td}>{fmtKm(c.km)}</td>
                      <td style={S.td}>{c.km_recorrido != null ? fmtKm(c.km_recorrido) : "—"}</td>
                      <td style={S.td}><span style={S.chip(n.color)}>{n.label}</span></td>
                      <td style={S.td}>{c.items_mal || "—"}</td>
                      <td style={S.td}>{c.fallas_reportadas || "—"}</td>
                      <td style={S.td}>
                        <span style={S.chip(c.fotos_completas ? "#16a34a" : "#f59e0b")}>
                          {c.fotos_subidas}
                        </span>
                      </td>
                      <td style={S.td}>
                        {c.apto_circular ? <span style={S.chip("#16a34a")}>Sí</span> : <span style={S.chip("#dc2626")}>⛔ No</span>}
                      </td>
                    </tr>
                  );
                })}
                {!d.chequeos?.length && (
                  <tr><td style={S.td} colSpan={10}>Sin partes registrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── FALLAS ──────────────────────────────────────────────────────────── */}
      {tab === "fallas" && (
        <div style={S.card}>
          <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>🔧 Fallas del vehículo</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={S.th}>Falla</th><th style={S.th}>Categoría</th><th style={S.th}>Severidad</th>
                <th style={S.th}>Veces</th><th style={S.th}>Primera vez</th><th style={S.th}>Última</th>
                <th style={S.th}>Km</th><th style={S.th}>Costo</th><th style={S.th}>Estado</th>
              </tr></thead>
              <tbody>
                {(d.fallas || []).map((f: any) => (
                  <tr key={f.id}>
                    <td style={S.td}>{f.falla_etiqueta} {f.detiene_vehiculo && "⛔"}</td>
                    <td style={S.td}>{f.categoria}</td>
                    <td style={S.td}><span style={S.chip(COLOR_SEVERIDAD[f.severidad] || "#64748b")}>{f.severidad}</span></td>
                    <td style={S.td}>{f.veces_reportada}</td>
                    <td style={S.td}>{fechaCorta(String(f.primera_vez).slice(0, 10))}</td>
                    <td style={S.td}>{fechaCorta(String(f.ultima_vez).slice(0, 10))}</td>
                    <td style={S.td}>{f.km_reporte != null ? fmtKm(f.km_reporte) : "—"}</td>
                    <td style={S.td}>{f.costo_reparacion != null ? dinero(f.costo_reparacion) : "—"}</td>
                    <td style={S.td}><span style={S.chip(COLOR_ESTADO_FALLA[f.estado] || "#64748b")}>{f.estado}</span></td>
                  </tr>
                ))}
                {!d.fallas?.length && <tr><td style={S.td} colSpan={9}>Sin fallas reportadas.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── GASTOS ──────────────────────────────────────────────────────────── */}
      {tab === "gastos" && (
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 15, flex: 1 }}>💰 Gastos</div>
            <Link href={`/asa/gastos?vehiculo=${id}`} style={{ ...S.btn, textDecoration: "none" }}>+ Registrar gasto</Link>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={S.th}>Fecha</th><th style={S.th}>Tipo</th><th style={S.th}>Descripción</th>
                <th style={S.th}>Km</th><th style={S.th}>Galones</th><th style={S.th}>Suplidor</th>
                <th style={S.th}>Monto</th>
              </tr></thead>
              <tbody>
                {(d.gastos || []).map((g: any) => {
                  const t = tipoGasto(g.tipo);
                  return (
                    <tr key={g.id}>
                      <td style={S.td}>{fechaCorta(g.fecha)}</td>
                      <td style={S.td}><span style={S.chip(t.color)}>{t.icono} {t.label}</span></td>
                      <td style={S.td}>{g.descripcion || "—"}</td>
                      <td style={S.td}>{g.km != null ? fmtKm(g.km) : "—"}</td>
                      <td style={S.td}>{g.galones ?? "—"}</td>
                      <td style={S.td}>{g.suplidor || "—"}</td>
                      <td style={{ ...S.td, fontWeight: 800 }}>{dinero(g.monto)}</td>
                    </tr>
                  );
                })}
                {!d.gastos?.length && <tr><td style={S.td} colSpan={7}>Sin gastos registrados.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── FOTOS ───────────────────────────────────────────────────────────── */}
      {tab === "fotos" && (
        <div style={S.card}>
          <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>
            📷 Fotos ({d.fotos?.length || 0})
          </div>
          {(!d.fotos?.length) ? (
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Todavía no hay fotos de este vehículo. Se suben desde el chequeo diario.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
              {d.fotos.map((f: any) => (
                <a key={f.id} href={f.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                  <div style={{
                    aspectRatio: "4/3", borderRadius: 10, overflow: "hidden",
                    border: "1px solid #e5e7eb", background: `center/cover no-repeat url(${f.url})`,
                  }} />
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 5, fontWeight: 700 }}>
                    {f.angulo.replace("_", " ")}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{fechaCorta(f.fecha)}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DOCUMENTOS ──────────────────────────────────────────────────────── */}
      {tab === "docs" && (
        <TabDocumentos vehiculoId={id} documentos={d.documentos || []} puedeEditar={puedeEditar} onCambio={cargar} />
      )}

      {/* ── MANTENIMIENTO ───────────────────────────────────────────────────── */}
      {tab === "mant" && (
        <TabMantenimiento vehiculoId={id} kmActual={Number(v.km_actual || 0)}
                          mantenimientos={d.mantenimientos || []} puedeEditar={puedeEditar} onCambio={cargar} />
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Documentos
// ─────────────────────────────────────────────────────────────────────────────
function TabDocumentos({ vehiculoId, documentos, puedeEditar, onCambio }: any) {
  const TIPOS = ["MARBETE", "SEGURO", "INSPECCION", "PLACA", "CONTRATO", "GARANTIA", "OTRO"];
  const [form, setForm] = useState<any>({ tipo: "MARBETE", numero: "", compania: "", emitido: "", vence: "", monto: "", alerta_dias: 30 });
  const [abierto, setAbierto] = useState(false);

  const guardar = async () => {
    if (!form.vence) return alert("La fecha de vencimiento es lo que sirve de alerta: ponla.");
    try {
      await asaEnviar("/documentos", "POST", {
        vehiculo_id: vehiculoId, ...form,
        monto: form.monto === "" ? null : Number(form.monto),
        emitido: form.emitido || null,
        alerta_dias: Number(form.alerta_dias || 30),
      }, auditHeaders());
      setAbierto(false);
      setForm({ tipo: "MARBETE", numero: "", compania: "", emitido: "", vence: "", monto: "", alerta_dias: 30 });
      onCambio();
    } catch (e: any) { alert(e.message); }
  };

  const borrar = async (docId: number) => {
    if (!confirm("¿Quitar este documento?")) return;
    try { await asaEnviar(`/documentos/${docId}`, "DELETE", undefined, auditHeaders()); onCambio(); }
    catch (e: any) { alert(e.message); }
  };

  const hoy = hoyRD();

  return (
    <div style={S.card}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 15, flex: 1 }}>🏷️ Marbete, seguro y demás</div>
        {puedeEditar && <button onClick={() => setAbierto(!abierto)} style={S.btn}>{abierto ? "Cancelar" : "+ Agregar"}</button>}
      </div>

      {abierto && (
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            <div>
              <label style={S.label}>Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={S.input}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Número</label>
              <input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} style={S.input} /></div>
            <div><label style={S.label}>Compañía</label>
              <input value={form.compania} onChange={e => setForm({ ...form, compania: e.target.value })} style={S.input} /></div>
            <div><label style={S.label}>Emitido</label>
              <input type="date" value={form.emitido} onChange={e => setForm({ ...form, emitido: e.target.value })} style={S.input} /></div>
            <div><label style={S.label}>Vence *</label>
              <input type="date" value={form.vence} onChange={e => setForm({ ...form, vence: e.target.value })} style={S.input} /></div>
            <div><label style={S.label}>Monto</label>
              <input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} style={S.input} /></div>
            <div><label style={S.label}>Avisar con (días)</label>
              <input type="number" value={form.alerta_dias} onChange={e => setForm({ ...form, alerta_dias: e.target.value })} style={S.input} /></div>
          </div>
          <div style={{ marginTop: 12, textAlign: "right" }}>
            <button onClick={guardar} style={S.btn}>Guardar documento</button>
          </div>
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={S.th}>Tipo</th><th style={S.th}>Número</th><th style={S.th}>Compañía</th>
          <th style={S.th}>Vence</th><th style={S.th}>Situación</th><th style={S.th}>Monto</th><th style={S.th}></th>
        </tr></thead>
        <tbody>
          {documentos.map((x: any) => {
            const dias = x.vence ? Math.round((new Date(x.vence).getTime() - new Date(hoy).getTime()) / 86400000) : null;
            const color = dias == null ? "#64748b" : dias < 0 ? "#dc2626" : dias <= (x.alerta_dias || 30) ? "#f59e0b" : "#16a34a";
            return (
              <tr key={x.id}>
                <td style={S.td}><b>{x.tipo}</b></td>
                <td style={S.td}>{x.numero || "—"}</td>
                <td style={S.td}>{x.compania || "—"}</td>
                <td style={S.td}>{fechaCorta(x.vence)}</td>
                <td style={S.td}>
                  <span style={S.chip(color)}>
                    {dias == null ? "—" : dias < 0 ? `Vencido hace ${Math.abs(dias)} d` : `Faltan ${dias} d`}
                  </span>
                </td>
                <td style={S.td}>{x.monto != null ? dinero(x.monto) : "—"}</td>
                <td style={S.td}>
                  {puedeEditar && <button onClick={() => borrar(x.id)} style={{ ...S.btnGhost, color: "#dc2626" }}>Quitar</button>}
                </td>
              </tr>
            );
          })}
          {!documentos.length && (
            <tr><td style={S.td} colSpan={7}>
              Sin documentos. Agrega el marbete y el seguro para que el sistema te avise antes de que venzan.
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Mantenimiento preventivo
// ─────────────────────────────────────────────────────────────────────────────
function TabMantenimiento({ vehiculoId, kmActual, mantenimientos, puedeEditar, onCambio }: any) {
  const SUGERIDOS = [
    { tipo: "ACEITE",   etiqueta: "Cambio de aceite y filtro", intervalo_km: 5000,  intervalo_dias: 180 },
    { tipo: "GOMAS",    etiqueta: "Rotación de gomas",         intervalo_km: 10000, intervalo_dias: 365 },
    { tipo: "FRENOS",   etiqueta: "Revisión de frenos",        intervalo_km: 20000, intervalo_dias: 365 },
    { tipo: "CORREA",   etiqueta: "Correa de tiempo",          intervalo_km: 90000, intervalo_dias: null },
    { tipo: "BATERIA",  etiqueta: "Batería",                   intervalo_km: null,  intervalo_dias: 730 },
    { tipo: "FILTROS",  etiqueta: "Filtros de aire y cabina",  intervalo_km: 15000, intervalo_dias: 365 },
  ];

  const [form, setForm] = useState<any>({ tipo: "ACEITE", etiqueta: "", intervalo_km: 5000, intervalo_dias: 180, km_ultimo: "", fecha_ultimo: "", costo_ultimo: "", taller: "" });
  const [abierto, setAbierto] = useState(false);

  const escoger = (s: any) => setForm({
    ...form, tipo: s.tipo, etiqueta: s.etiqueta,
    intervalo_km: s.intervalo_km ?? "", intervalo_dias: s.intervalo_dias ?? "",
  });

  const guardar = async () => {
    try {
      await asaEnviar("/mantenimientos", "POST", {
        vehiculo_id: vehiculoId, tipo: form.tipo, etiqueta: form.etiqueta || form.tipo,
        intervalo_km: form.intervalo_km === "" ? null : Number(form.intervalo_km),
        intervalo_dias: form.intervalo_dias === "" ? null : Number(form.intervalo_dias),
        km_ultimo: form.km_ultimo === "" ? kmActual : Number(form.km_ultimo),
        fecha_ultimo: form.fecha_ultimo || hoyRD(),
        costo_ultimo: form.costo_ultimo === "" ? null : Number(form.costo_ultimo),
        taller: form.taller || null,
      }, auditHeaders());
      setAbierto(false);
      onCambio();
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div style={S.card}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 15, flex: 1 }}>🛠️ Mantenimiento preventivo</div>
        {puedeEditar && <button onClick={() => setAbierto(!abierto)} style={S.btn}>{abierto ? "Cancelar" : "+ Programar"}</button>}
      </div>

      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
        El kilometraje que entra por el parte diario es el que dispara estos avisos.
        Sin partes al día, esta pestaña no sirve de nada.
      </div>

      {abierto && (
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
            {SUGERIDOS.map(s => (
              <button key={s.tipo} onClick={() => escoger(s)} style={{
                ...S.btnGhost,
                borderColor: form.tipo === s.tipo ? "#1d4ed8" : "#e2e8f0",
                color: form.tipo === s.tipo ? "#1d4ed8" : "#334155",
              }}>{s.etiqueta}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            <div><label style={S.label}>Etiqueta</label>
              <input value={form.etiqueta} onChange={e => setForm({ ...form, etiqueta: e.target.value })} style={S.input} /></div>
            <div><label style={S.label}>Cada cuántos km</label>
              <input type="number" value={form.intervalo_km} onChange={e => setForm({ ...form, intervalo_km: e.target.value })} style={S.input} /></div>
            <div><label style={S.label}>O cada cuántos días</label>
              <input type="number" value={form.intervalo_dias} onChange={e => setForm({ ...form, intervalo_dias: e.target.value })} style={S.input} /></div>
            <div><label style={S.label}>Km del último</label>
              <input type="number" placeholder={String(kmActual)} value={form.km_ultimo}
                     onChange={e => setForm({ ...form, km_ultimo: e.target.value })} style={S.input} /></div>
            <div><label style={S.label}>Fecha del último</label>
              <input type="date" value={form.fecha_ultimo} onChange={e => setForm({ ...form, fecha_ultimo: e.target.value })} style={S.input} /></div>
            <div><label style={S.label}>Costo</label>
              <input type="number" value={form.costo_ultimo} onChange={e => setForm({ ...form, costo_ultimo: e.target.value })} style={S.input} /></div>
            <div><label style={S.label}>Taller</label>
              <input value={form.taller} onChange={e => setForm({ ...form, taller: e.target.value })} style={S.input} /></div>
          </div>
          <div style={{ marginTop: 12, textAlign: "right" }}>
            <button onClick={guardar} style={S.btn}>Guardar</button>
          </div>
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={S.th}>Mantenimiento</th><th style={S.th}>Cada</th><th style={S.th}>Último</th>
          <th style={S.th}>Próximo</th><th style={S.th}>Falta</th><th style={S.th}>Costo</th>
        </tr></thead>
        <tbody>
          {mantenimientos.map((m: any) => (
            <tr key={m.id} style={m.vencido ? { background: "#fef2f2" } : undefined}>
              <td style={S.td}><b>{m.etiqueta}</b></td>
              <td style={S.td}>
                {m.intervalo_km ? `${Number(m.intervalo_km).toLocaleString("es-DO")} km` : ""}
                {m.intervalo_km && m.intervalo_dias ? " · " : ""}
                {m.intervalo_dias ? `${m.intervalo_dias} días` : ""}
              </td>
              <td style={S.td}>
                {m.km_ultimo != null ? fmtKm(m.km_ultimo) : "—"}
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{fechaCorta(m.fecha_ultimo)}</div>
              </td>
              <td style={S.td}>
                {m.proximo_km != null ? fmtKm(m.proximo_km) : "—"}
                {m.proxima_fecha && <div style={{ fontSize: 11, color: "#94a3b8" }}>{fechaCorta(m.proxima_fecha)}</div>}
              </td>
              <td style={S.td}>
                <span style={S.chip(m.vencido ? "#dc2626" : (m.faltan_km != null && m.faltan_km < 1000) ? "#f59e0b" : "#16a34a")}>
                  {m.vencido ? "Vencido"
                    : m.faltan_km != null ? `${Number(m.faltan_km).toLocaleString("es-DO")} km`
                    : m.faltan_dias != null ? `${m.faltan_dias} días` : "—"}
                </span>
              </td>
              <td style={S.td}>{m.costo_ultimo != null ? dinero(m.costo_ultimo) : "—"}</td>
            </tr>
          ))}
          {!mantenimientos.length && (
            <tr><td style={S.td} colSpan={6}>
              Nada programado. Empieza por el cambio de aceite: es el que más se olvida y el que más caro sale.
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
