"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";

import { usePermisos } from "@/lib/usePermisos";
import { auditHeaders } from "@/lib/audit";
import { S, ANGULOS, asaGet, asaEnviar } from "@/lib/asa";

// ─────────────────────────────────────────────────────────────────────────────
// ⚙️ ASA — CONFIGURACIÓN
//
// Conductores, checklist, catálogo de fallas y ajustes del módulo.
//
// El catálogo se edita desde aquí a propósito: la lista de fallas tiene que
// poder cambiar el mismo día en que un conductor dice "es que a esta le pasa
// otra cosa". Si cambiarla exige una migración, la lista se congela y todo
// termina cayendo en "Otro".
// ─────────────────────────────────────────────────────────────────────────────

const PESTANAS = [
  { id: "empleados",  label: "Conductores",  icono: "👥" },
  { id: "checklist",  label: "Checklist",    icono: "✅" },
  { id: "fallas",     label: "Fallas",       icono: "🔧" },
  { id: "ajustes",    label: "Ajustes",      icono: "⚙️" },
];

export default function ConfigASAPage() {
  const { puedeVer, puedeEditar } = usePermisos("asa");
  const [tab, setTab] = useState("empleados");

  if (!puedeVer) return <div style={{ padding: 40 }}>No tienes acceso al módulo ASA.</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1300 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>⚙️ Configuración de ASA</h1>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 2 }}>
            Conductores, checklist, catálogo de fallas y ajustes
          </div>
        </div>
        <Link href="/asa" style={{ ...S.btnGhost, textDecoration: "none", padding: "10px 14px" }}>← Tablero</Link>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {PESTANAS.map(p => (
          <button key={p.id} onClick={() => setTab(p.id)} style={{
            padding: "9px 15px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 700,
            border: `1px solid ${tab === p.id ? "#1d4ed8" : "#e2e8f0"}`,
            background: tab === p.id ? "#eff6ff" : "#fff", color: tab === p.id ? "#1d4ed8" : "#475569",
          }}>{p.icono} {p.label}</button>
        ))}
      </div>

      {tab === "empleados" && <Empleados puedeEditar={puedeEditar} />}
      {tab === "checklist" && <Catalogo recurso="checklist" titulo="Puntos del checklist" puedeEditar={puedeEditar} />}
      {tab === "fallas"    && <Catalogo recurso="catalogo-fallas" titulo="Catálogo de fallas" puedeEditar={puedeEditar} conSeveridad />}
      {tab === "ajustes"   && <Ajustes puedeEditar={puedeEditar} />}
    </div>
  );
}


// ── Conductores ──────────────────────────────────────────────────────────────
function Empleados({ puedeEditar }: any) {
  const vacio = { nombre: "", cedula: "", telefono: "", cargo: "Conductor", licencia_numero: "", licencia_categoria: "", licencia_vence: "", color: "#3b82f6", orden: 0 };
  const [lista, setLista] = useState<any[]>([]);
  const [form, setForm]   = useState<any>(vacio);
  const [editId, setEdit] = useState<number | null>(null);

  const cargar = async () => {
    try { setLista((await asaGet<any>("/empleados")).empleados || []); } catch {}
  };
  useEffect(() => { cargar(); }, []);

  const guardar = async () => {
    if (!form.nombre.trim()) return alert("El nombre es obligatorio.");
    try {
      const cuerpo = { ...form, orden: Number(form.orden || 0), licencia_vence: form.licencia_vence || null };
      if (editId) await asaEnviar(`/empleados/${editId}`, "PATCH", cuerpo, auditHeaders());
      else await asaEnviar("/empleados", "POST", cuerpo, auditHeaders());
      setForm(vacio); setEdit(null); cargar();
    } catch (e: any) { alert(e.message); }
  };

  const quitar = async (id: number) => {
    if (!confirm("¿Dar de baja a este conductor? Sus partes anteriores quedan guardados.")) return;
    try { await asaEnviar(`/empleados/${id}`, "DELETE", undefined, auditHeaders()); cargar(); }
    catch (e: any) { alert(e.message); }
  };

  return (
    <>
      {puedeEditar && (
        <div style={S.card}>
          <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>
            {editId ? "Editar conductor" : "Agregar conductor"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            {[
              ["Nombre *", "nombre", "text"],
              ["Cédula", "cedula", "text"],
              ["Teléfono", "telefono", "text"],
              ["Cargo", "cargo", "text"],
              ["Licencia N°", "licencia_numero", "text"],
              ["Categoría", "licencia_categoria", "text"],
              ["Licencia vence", "licencia_vence", "date"],
              ["Orden en pantalla", "orden", "number"],
            ].map(([label, key, tipo]: any) => (
              <div key={key}>
                <label style={S.label}>{label}</label>
                <input type={tipo} value={form[key] ?? ""} onChange={e => setForm({ ...form, [key]: e.target.value })} style={S.input} />
              </div>
            ))}
            <div>
              <label style={S.label}>Color del botón</label>
              <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                     style={{ ...S.input, padding: 4, height: 40 }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
            {editId && <button onClick={() => { setForm(vacio); setEdit(null); }} style={S.btnGhost}>Cancelar</button>}
            <button onClick={guardar} style={S.btn}>{editId ? "Guardar cambios" : "Agregar"}</button>
          </div>
        </div>
      )}

      <div style={S.card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={S.th}></th><th style={S.th}>Nombre</th><th style={S.th}>Cargo</th>
            <th style={S.th}>Teléfono</th><th style={S.th}>Licencia</th><th style={S.th}>Vence</th><th style={S.th}></th>
          </tr></thead>
          <tbody>
            {lista.map(e => (
              <tr key={e.id}>
                <td style={S.td}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, background: e.color || "#3b82f6",
                    color: "#fff", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 12,
                  }}>{e.nombre.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}</div>
                </td>
                <td style={S.td}><b>{e.nombre}</b></td>
                <td style={S.td}>{e.cargo || "—"}</td>
                <td style={S.td}>{e.telefono || "—"}</td>
                <td style={S.td}>{e.licencia_numero || "—"} {e.licencia_categoria ? `(${e.licencia_categoria})` : ""}</td>
                <td style={S.td}>{e.licencia_vence || "—"}</td>
                <td style={S.td}>
                  {puedeEditar && <>
                    <button onClick={() => { setForm({ ...vacio, ...e, licencia_vence: e.licencia_vence || "" }); setEdit(e.id); }} style={S.btnGhost}>Editar</button>{" "}
                    <button onClick={() => quitar(e.id)} style={{ ...S.btnGhost, color: "#dc2626" }}>Baja</button>
                  </>}
                </td>
              </tr>
            ))}
            {!lista.length && (
              <tr><td style={S.td} colSpan={7}>
                No hay conductores. Agrégalos aquí: son los nombres que aparecen en la pantalla de chequeo.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}


// ── Catálogos (checklist y fallas) ───────────────────────────────────────────
function Catalogo({ recurso, titulo, puedeEditar, conSeveridad = false }: any) {
  const vacio: any = {
    codigo: "", categoria: "", etiqueta: "", icono: "",
    critico: false, severidad: "MODERADA", detiene_vehiculo: false, orden: 999,
  };
  const [lista, setLista] = useState<any[]>([]);
  const [form, setForm]   = useState<any>(vacio);
  const [editId, setEdit] = useState<number | null>(null);

  const clave = recurso === "checklist" ? "checklist" : "catalogo-fallas";

  const cargar = async () => {
    try {
      const d: any = await asaGet<any>(`/${clave}`);
      setLista(d[clave] || []);
    } catch {}
  };
  useEffect(() => { cargar(); }, [recurso]);

  const guardar = async () => {
    if (!form.codigo.trim() || !form.etiqueta.trim() || !form.categoria.trim())
      return alert("Código, categoría y etiqueta son obligatorios.");
    try {
      const cuerpo = conSeveridad
        ? { codigo: form.codigo, categoria: form.categoria.toUpperCase(), etiqueta: form.etiqueta, icono: form.icono, severidad: form.severidad, detiene_vehiculo: !!form.detiene_vehiculo, orden: Number(form.orden || 999) }
        : { codigo: form.codigo, categoria: form.categoria.toUpperCase(), etiqueta: form.etiqueta, icono: form.icono, critico: !!form.critico, orden: Number(form.orden || 999) };
      if (editId) await asaEnviar(`/${clave}/${editId}`, "PATCH", cuerpo, auditHeaders());
      else await asaEnviar(`/${clave}`, "POST", cuerpo, auditHeaders());
      setForm(vacio); setEdit(null); cargar();
    } catch (e: any) { alert(e.message); }
  };

  const quitar = async (id: number) => {
    if (!confirm("¿Quitar del catálogo? Los reportes viejos que lo usan se conservan.")) return;
    try { await asaEnviar(`/${clave}/${id}`, "DELETE", undefined, auditHeaders()); cargar(); }
    catch (e: any) { alert(e.message); }
  };

  return (
    <>
      {puedeEditar && (
        <div style={S.card}>
          <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 4 }}>{editId ? "Editar" : "Agregar"} — {titulo}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
            Escríbelo como lo diría el conductor, no como lo diría un mecánico.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
            <div><label style={S.label}>Código *</label>
              <input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value.toLowerCase().replace(/\s+/g, "_") })} style={S.input} /></div>
            <div><label style={S.label}>Categoría *</label>
              <input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} style={S.input} /></div>
            <div style={{ gridColumn: "span 2" }}><label style={S.label}>Etiqueta *</label>
              <input value={form.etiqueta} onChange={e => setForm({ ...form, etiqueta: e.target.value })} style={S.input} /></div>
            <div><label style={S.label}>Icono</label>
              <input value={form.icono} onChange={e => setForm({ ...form, icono: e.target.value })} style={S.input} placeholder="🛞" /></div>
            <div><label style={S.label}>Orden</label>
              <input type="number" value={form.orden} onChange={e => setForm({ ...form, orden: e.target.value })} style={S.input} /></div>
            {conSeveridad && (
              <div><label style={S.label}>Severidad</label>
                <select value={form.severidad} onChange={e => setForm({ ...form, severidad: e.target.value })} style={S.input}>
                  <option value="LEVE">Leve</option><option value="MODERADA">Moderada</option><option value="GRAVE">Grave</option>
                </select></div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
            {conSeveridad ? (
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" checked={!!form.detiene_vehiculo}
                       onChange={e => setForm({ ...form, detiene_vehiculo: e.target.checked })} />
                Con esto el vehículo no debe salir
              </label>
            ) : (
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" checked={!!form.critico}
                       onChange={e => setForm({ ...form, critico: e.target.checked })} />
                Crítico (si sale mal, el vehículo no debe salir)
              </label>
            )}
            <div style={{ flex: 1 }} />
            {editId && <button onClick={() => { setForm(vacio); setEdit(null); }} style={S.btnGhost}>Cancelar</button>}
            <button onClick={guardar} style={S.btn}>{editId ? "Guardar" : "Agregar"}</button>
          </div>
        </div>
      )}

      <div style={S.card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={S.th}>Orden</th><th style={S.th}>Categoría</th><th style={S.th}>Etiqueta</th>
            <th style={S.th}>Código</th>
            <th style={S.th}>{conSeveridad ? "Severidad" : "Crítico"}</th>
            <th style={S.th}>Detiene</th><th style={S.th}></th>
          </tr></thead>
          <tbody>
            {lista.map(x => (
              <tr key={x.id}>
                <td style={S.td}>{x.orden}</td>
                <td style={S.td}>{x.categoria}</td>
                <td style={S.td}>{x.icono} <b>{x.etiqueta}</b></td>
                <td style={S.td}><code style={{ fontSize: 11, color: "#64748b" }}>{x.codigo}</code></td>
                <td style={S.td}>
                  {conSeveridad
                    ? <span style={S.chip(x.severidad === "GRAVE" ? "#dc2626" : x.severidad === "MODERADA" ? "#f59e0b" : "#0ea5e9")}>{x.severidad}</span>
                    : (x.critico ? <span style={S.chip("#f59e0b")}>★ Crítico</span> : "—")}
                </td>
                <td style={S.td}>{(conSeveridad ? x.detiene_vehiculo : x.critico) ? "⛔" : "—"}</td>
                <td style={S.td}>
                  {puedeEditar && <>
                    <button onClick={() => { setForm({ ...vacio, ...x }); setEdit(x.id); }} style={S.btnGhost}>Editar</button>{" "}
                    <button onClick={() => quitar(x.id)} style={{ ...S.btnGhost, color: "#dc2626" }}>Quitar</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}


// ── Ajustes del módulo ───────────────────────────────────────────────────────
function Ajustes({ puedeEditar }: any) {
  const [cfg, setCfg] = useState<any>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    asaGet<any>("/config").then(d => setCfg(d.config || {})).catch(() => setCfg({}));
  }, []);

  const guardar = async () => {
    setGuardando(true);
    try {
      await asaEnviar("/config", "PUT", cfg, auditHeaders());
      alert("Ajustes guardados.");
    } catch (e: any) { alert(e.message); }
    finally { setGuardando(false); }
  };

  if (!cfg) return <div style={{ color: "#64748b" }}>Cargando…</div>;

  const angulos: string[] = Array.isArray(cfg.angulos_requeridos) ? cfg.angulos_requeridos : [];

  return (
    <div style={S.card}>
      <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 14 }}>Ajustes del módulo</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
        <div>
          <label style={S.label}>Hora límite del parte</label>
          <input type="time" value={cfg.hora_limite_chequeo || "09:00"}
                 onChange={e => setCfg({ ...cfg, hora_limite_chequeo: e.target.value })} style={S.input} />
        </div>
        <div>
          <label style={S.label}>Avisar documentos con (días)</label>
          <input type="number" value={cfg.alerta_documentos_dias ?? 30}
                 onChange={e => setCfg({ ...cfg, alerta_documentos_dias: Number(e.target.value) })} style={S.input} />
        </div>
        <div>
          <label style={S.label}>Precio de referencia del galón</label>
          <input type="number" value={cfg.precio_galon_referencia ?? 290}
                 onChange={e => setCfg({ ...cfg, precio_galon_referencia: Number(e.target.value) })} style={S.input} />
        </div>
        <div>
          <label style={S.label}>Frecuencia de fotos</label>
          <select value={cfg.frecuencia_fotos || "DIARIA"}
                  onChange={e => setCfg({ ...cfg, frecuencia_fotos: e.target.value })} style={S.input}>
            <option value="DIARIA">Diaria</option>
            <option value="SEMANAL">Semanal</option>
            <option value="LIBRE">Cuando el conductor quiera</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <label style={S.label}>Fotos que se piden en el chequeo</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          {ANGULOS.map(a => {
            const sel = angulos.includes(a.codigo);
            return (
              <button key={a.codigo} onClick={() => setCfg({
                ...cfg,
                angulos_requeridos: sel ? angulos.filter(x => x !== a.codigo) : [...angulos, a.codigo],
              })} style={{
                padding: "9px 13px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700,
                border: `1px solid ${sel ? "#1d4ed8" : "#e2e8f0"}`,
                background: sel ? "#eff6ff" : "#fff", color: sel ? "#1d4ed8" : "#475569",
              }}>{a.icono} {a.label}</button>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
          Cuantos más ángulos pidas, más completo el registro y más tarda el conductor.
          Cinco es el punto donde todavía lo llenan todos los días.
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, fontSize: 13, fontWeight: 600 }}>
        <input type="checkbox" checked={cfg.exigir_fotos !== false}
               onChange={e => setCfg({ ...cfg, exigir_fotos: e.target.checked })} />
        Marcar el parte como incompleto si faltan fotos
      </label>

      {puedeEditar && (
        <div style={{ marginTop: 20, textAlign: "right" }}>
          <button onClick={guardar} disabled={guardando} style={S.btn}>
            {guardando ? "Guardando…" : "Guardar ajustes"}
          </button>
        </div>
      )}
    </div>
  );
}
