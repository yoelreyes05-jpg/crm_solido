"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { API_URL as API } from "@/config";
import { usePermisos } from "@/lib/usePermisos";
import { auditHeaders } from "@/lib/audit";

// ─────────────────────────────────────────────────────────────────────────────
// 🔧 TARIFARIO DE MANO DE OBRA
// Catálogo de operaciones del taller: qué se hace, cuánto tiempo lleva y
// cuánto cuesta según el tipo de vehículo.
//
// El mismo trabajo no vale igual en un Corolla que en una Silverado diésel,
// por eso cada operación tiene 4 precios (segmentos A/B/C/D).
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n: any) =>
  "RD$ " + Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const SEGMENTOS = [
  { clave: "A", campo: "precio_seg_a", label: "Sedán 4 cil.",     emoji: "🚗", color: "#0ea5e9" },
  { clave: "B", campo: "precio_seg_b", label: "SUV / Crossover",  emoji: "🚙", color: "#16a34a" },
  { clave: "C", campo: "precio_seg_c", label: "V6 / Camioneta",   emoji: "🛻", color: "#d97706" },
  { clave: "D", campo: "precio_seg_d", label: "Diésel / Europeo", emoji: "🚐", color: "#7c3aed" },
];

const CAT_EMOJI: Record<string, string> = {
  "DIAGNOSTICO": "🔍", "ELECTRICO": "⚡", "MOTOR Y ENCENDIDO": "⚙️",
  "COMBUSTIBLE": "⛽", "MANTENIMIENTO": "🛢️", "SUSPENSION Y DIRECCION": "🔩",
  "FRENOS": "🛑", "AIRE ACONDICIONADO": "❄️", "TRANSMISION": "🔗",
};

const S = {
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 20, marginBottom: 16 } as React.CSSProperties,
  input: { display: "block", padding: "10px 12px", width: "100%", borderRadius: 9, border: "1px solid #e2e8f0", fontSize: 14, background: "#fafafa", color: "#111827", boxSizing: "border-box" } as React.CSSProperties,
  label: { fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 4, display: "block" } as React.CSSProperties,
  btn: { padding: "10px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: "#0f766e", color: "#fff" } as React.CSSProperties,
  btnGhost: { padding: "7px 12px", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer", fontWeight: 700, fontSize: 12, background: "#fff", color: "#334155" } as React.CSSProperties,
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#64748b", background: "#f8fafc", textTransform: "uppercase" as const, letterSpacing: 0.4, whiteSpace: "nowrap" as const },
  td: { padding: "10px 12px", fontSize: 13, color: "#111827", borderBottom: "1px solid #eef2f7" },
};

// Parser de CSV que respeta las comillas dobles: "Prueba: bateria, alternador"
// no se debe partir por la coma de adentro.
function parsearCSV(texto: string): Record<string, string>[] {
  const limpio = texto.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const filas: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let enComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (enComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') { campo += '"'; i++; }   // "" = comilla literal
        else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
  if (!filas.length) return [];
  const cab = filas[0].map(h => h.trim().toLowerCase());
  return filas.slice(1)
    .filter(f => f.some(v => String(v).trim() !== ""))
    .map(f => Object.fromEntries(cab.map((h, i) => [h, (f[i] ?? "").trim()])));
}

const vacio = {
  codigo: "", nombre: "", categoria: "", horas_estandar: "",
  precio_seg_a: "", precio_seg_b: "", precio_seg_c: "", precio_seg_d: "",
  itbis: "18", notas: "",
};

export default function TarifarioPage() {
  const { listo, puedeVer, puedeCrear, puedeEditar, puedeEliminar } = usePermisos("tarifario");

  const [ops, setOps]             = useState<any[]>([]);
  const [categorias, setCats]     = useState<string[]>([]);
  const [aviso, setAviso]         = useState<string | null>(null);
  const [cargando, setCargando]   = useState(true);
  const [busqueda, setBusqueda]   = useState("");
  const [catFiltro, setCatFiltro] = useState("TODAS");
  const [form, setForm]           = useState<any>(vacio);
  const [editId, setEditId]       = useState<any>(null);
  const [guardando, setGuardando] = useState(false);
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = async () => {
    setCargando(true);
    try {
      const d = await fetch(`${API}/mano-obra`).then(r => r.json());
      setOps(Array.isArray(d.operaciones) ? d.operaciones : []);
      setCats(Array.isArray(d.categorias) ? d.categorias : []);
      setAviso(d.aviso || null);
    } catch { setAviso("No se pudo conectar con el servidor"); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return ops.filter(o => {
      if (catFiltro !== "TODAS" && o.categoria !== catFiltro) return false;
      if (!q) return true;
      return `${o.codigo} ${o.nombre} ${o.categoria} ${o.notas || ""}`.toLowerCase().includes(q);
    });
  }, [ops, busqueda, catFiltro]);

  const guardar = async () => {
    if (!form.codigo.trim() || !form.nombre.trim())
      return alert("El código y el nombre son obligatorios");
    setGuardando(true);
    try {
      const body = {
        ...form,
        horas_estandar: form.horas_estandar === "" ? null : Number(form.horas_estandar),
        precio_seg_a: Number(form.precio_seg_a || 0),
        precio_seg_b: Number(form.precio_seg_b || 0),
        precio_seg_c: Number(form.precio_seg_c || 0),
        precio_seg_d: Number(form.precio_seg_d || 0),
        itbis: Number(form.itbis || 18),
      };
      const r = await fetch(editId ? `${API}/mano-obra/${editId}` : `${API}/mano-obra`, {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...auditHeaders() },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.error) return alert("Error: " + d.error);
      setForm(vacio); setEditId(null); cargar();
    } catch { alert("Error de conexión"); }
    finally { setGuardando(false); }
  };

  const editar = (o: any) => {
    setEditId(o.id);
    setForm({
      codigo: o.codigo || "", nombre: o.nombre || "", categoria: o.categoria || "",
      horas_estandar: o.horas_estandar != null ? String(o.horas_estandar) : "",
      precio_seg_a: String(o.precio_seg_a ?? ""), precio_seg_b: String(o.precio_seg_b ?? ""),
      precio_seg_c: String(o.precio_seg_c ?? ""), precio_seg_d: String(o.precio_seg_d ?? ""),
      itbis: String(o.itbis ?? 18), notas: o.notas || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const eliminar = async (o: any) => {
    if (!confirm(`¿Quitar "${o.nombre}" del tarifario?\n\nSe desactiva: deja de aparecer al facturar, pero las facturas viejas no cambian.`)) return;
    const r = await fetch(`${API}/mano-obra/${o.id}`, { method: "DELETE", headers: auditHeaders() });
    const d = await r.json();
    if (d.error) return alert("Error: " + d.error);
    cargar();
  };

  // ── Importar CSV ────────────────────────────────────────────────────────────
  const importarCSV = async (file: File) => {
    setImportando(true);
    try {
      const texto = await file.text();
      const filas = parsearCSV(texto);
      if (!filas.length) { alert("El archivo está vacío o no se pudo leer"); return; }
      if (!("codigo" in filas[0]) || !("nombre" in filas[0])) {
        alert("El CSV debe tener al menos las columnas 'codigo' y 'nombre'.\n\n"
          + "Columnas encontradas: " + Object.keys(filas[0]).join(", "));
        return;
      }
      if (!confirm(`Se leyeron ${filas.length} operaciones.\n\n`
        + "Los códigos que ya existen se ACTUALIZAN y los nuevos se CREAN.\n"
        + "No se borra nada. ¿Continuar?")) return;

      const r = await fetch(`${API}/mano-obra/importar`, {
        method: "POST", headers: { "Content-Type": "application/json", ...auditHeaders() },
        body: JSON.stringify({ filas }),
      });
      const d = await r.json();
      if (d.error) return alert("Error: " + d.error + (d.errores?.length ? "\n\n" + d.errores.join("\n") : ""));
      alert(`✅ Importación lista\n\n`
        + `${d.creados} operaciones nuevas\n${d.actualizados} actualizadas\n`
        + (d.errores?.length ? `\n⚠️ Avisos:\n${d.errores.slice(0, 10).join("\n")}` : ""));
      cargar();
    } catch (e: any) { alert("No se pudo leer el archivo: " + e.message); }
    finally { setImportando(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const exportarCSV = () => {
    const cab = ["codigo", "nombre", "categoria", "tipo", "unidad", "horas_estandar",
      "precio_seg_a_sedan", "precio_seg_b_suv", "precio_seg_c_v6_camioneta",
      "precio_seg_d_diesel_europeo", "itbis", "notas"];
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lineas = [cab.join(",")].concat(ops.map(o => [
      o.codigo, o.nombre, o.categoria, o.tipo, o.unidad, o.horas_estandar,
      o.precio_seg_a, o.precio_seg_b, o.precio_seg_c, o.precio_seg_d, o.itbis, o.notas,
    ].map(esc).join(",")));
    const blob = new Blob(["﻿" + lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tarifario_mano_obra_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (listo && !puedeVer) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#111827" }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <h2>Sin acceso al Tarifario</h2>
        <p style={{ color: "#64748b" }}>Pide al gerente que te asigne permisos desde /permisos.</p>
      </div>
    );
  }

  const promedioHoras = ops.length
    ? ops.reduce((a, o) => a + Number(o.horas_estandar || 0), 0) / ops.length : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fb", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ fontSize: 34 }}>🔧</div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#111827", margin: 0 }}>
            Tarifario de Mano de Obra
          </h1>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            Precio de cada operación según el tipo de vehículo — se usa al facturar y al cotizar
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 13, color: "#64748b" }}>
          <b style={{ color: "#0f766e", fontSize: 18 }}>{ops.length}</b> operaciones
          {promedioHoras > 0 && (
            <div style={{ fontSize: 11 }}>promedio {promedioHoras.toFixed(1)} h por trabajo</div>
          )}
        </div>
      </div>

      {aviso && (
        <div style={{ ...S.card, background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e" }}>
          ⚠️ {aviso}
        </div>
      )}

      {/* ── Barra de herramientas ───────────────────────────────────────────── */}
      <div style={{ ...S.card, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="🔍 Buscar operación, código o categoría…" value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ ...S.input, maxWidth: 320, marginBottom: 0 }} />
        <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)}
          style={{ ...S.input, maxWidth: 240, marginBottom: 0 }}>
          <option value="TODAS">Todas las categorías ({ops.length})</option>
          {categorias.map(c => (
            <option key={c} value={c}>
              {CAT_EMOJI[c] || "•"} {c} ({ops.filter(o => o.categoria === c).length})
            </option>
          ))}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={exportarCSV} style={S.btnGhost} title="Descargar el tarifario en Excel/CSV">
            📤 Exportar CSV
          </button>
          {puedeEditar && (
            <>
              <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) importarCSV(f); }} />
              <button onClick={() => fileRef.current?.click()} disabled={importando}
                style={{ ...S.btn, opacity: importando ? 0.6 : 1 }}
                title="Subir un CSV para actualizar precios en masa">
                {importando ? "Importando…" : "📥 Importar CSV"}
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 330px", gap: 16, alignItems: "start" }}>
        {/* ── Tabla ────────────────────────────────────────────────────────── */}
        <div style={{ ...S.card, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={S.th}>Código</th>
                <th style={S.th}>Operación</th>
                <th style={{ ...S.th, textAlign: "center" }}>Horas</th>
                {SEGMENTOS.map(s => (
                  <th key={s.clave} style={{ ...S.th, textAlign: "right", color: s.color }}>
                    {s.emoji} {s.label}
                  </th>
                ))}
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(o => (
                <tr key={o.id}>
                  <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {o.codigo}
                  </td>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600 }}>{o.nombre}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {CAT_EMOJI[o.categoria] || "•"} {o.categoria}
                      {o.notas ? ` · ${o.notas}` : ""}
                    </div>
                  </td>
                  <td style={{ ...S.td, textAlign: "center", color: "#64748b", whiteSpace: "nowrap" }}>
                    {o.horas_estandar != null ? `${Number(o.horas_estandar)} h` : "—"}
                  </td>
                  {SEGMENTOS.map(s => (
                    <td key={s.clave} style={{ ...S.td, textAlign: "right", fontWeight: 700,
                      color: s.color, whiteSpace: "nowrap" }}>
                      {fmt(o[s.campo])}
                    </td>
                  ))}
                  <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                    {puedeEditar && <button onClick={() => editar(o)} style={S.btnGhost} title="Editar">✏️</button>}{" "}
                    {puedeEliminar && <button onClick={() => eliminar(o)} style={{ ...S.btnGhost, color: "#ef4444" }} title="Quitar del tarifario">🗑️</button>}
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr><td style={{ ...S.td, textAlign: "center", color: "#94a3b8", padding: 32 }} colSpan={8}>
                  {cargando ? "Cargando…"
                    : ops.length === 0 ? "Tarifario vacío — corre la migración v27 o importa el CSV."
                    : "Ninguna operación coincide con la búsqueda."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Alta / edición ───────────────────────────────────────────────── */}
        <div>
          <div style={S.card}>
            <h3 style={{ color: "#111827", fontWeight: 800, marginBottom: 12 }}>
              {editId ? "✏️ Editar operación" : "➕ Nueva operación"}
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={S.label}>Código *</label>
                <input value={form.codigo} placeholder="MO-F08"
                  onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                  style={{ ...S.input, marginBottom: 8, fontFamily: "monospace" }} />
              </div>
              <div>
                <label style={S.label}>Horas estándar</label>
                <input type="number" step="0.25" value={form.horas_estandar} placeholder="1.5"
                  onChange={e => setForm({ ...form, horas_estandar: e.target.value })}
                  style={{ ...S.input, marginBottom: 8 }} />
              </div>
            </div>

            <label style={S.label}>Nombre de la operación *</label>
            <input value={form.nombre} placeholder="Cambio de pastillas delanteras"
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              style={{ ...S.input, marginBottom: 8 }} />

            <label style={S.label}>Categoría</label>
            <input value={form.categoria} placeholder="FRENOS" list="cats-tarifario"
              onChange={e => setForm({ ...form, categoria: e.target.value.toUpperCase() })}
              style={{ ...S.input, marginBottom: 10 }} />
            <datalist id="cats-tarifario">
              {categorias.map(c => <option key={c} value={c} />)}
            </datalist>

            <div style={{ fontSize: 11, fontWeight: 800, color: "#0f766e", textTransform: "uppercase",
              letterSpacing: 0.5, marginBottom: 6 }}>
              Precio por tipo de vehículo
            </div>
            {SEGMENTOS.map(s => (
              <div key={s.clave} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, fontSize: 12, color: "#334155" }}>
                  {s.emoji} {s.label}
                </div>
                <input type="number" value={(form as any)[s.campo]} placeholder="0"
                  onChange={e => setForm({ ...form, [s.campo]: e.target.value })}
                  style={{ ...S.input, width: 110, marginBottom: 0, textAlign: "right",
                    fontWeight: 700, color: s.color }} />
              </div>
            ))}

            <label style={{ ...S.label, marginTop: 10 }}>Notas internas</label>
            <textarea value={form.notas} rows={2} placeholder="No incluye el gas refrigerante"
              onChange={e => setForm({ ...form, notas: e.target.value })}
              style={{ ...S.input, marginBottom: 10 }} />

            <button onClick={guardar} disabled={guardando || (!puedeCrear && !editId)}
              style={{ ...S.btn, width: "100%", opacity: guardando || (!puedeCrear && !editId) ? 0.55 : 1 }}>
              {guardando ? "Guardando…" : editId ? "💾 Guardar cambios" : "➕ Agregar al tarifario"}
            </button>
            {editId && (
              <button onClick={() => { setEditId(null); setForm(vacio); }}
                style={{ ...S.btnGhost, width: "100%", marginTop: 8 }}>Cancelar</button>
            )}
          </div>

          {/* Guía de segmentos */}
          <div style={{ ...S.card, background: "#f0fdfa", border: "1px solid #99f6e4" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f766e", marginBottom: 8 }}>
              ℹ️ Cómo se elige el precio
            </div>
            <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.6 }}>
              Al facturar o cotizar, el sistema propone el segmento según el vehículo
              (cilindraje, marca y carrocería) y tú lo puedes cambiar con un clic.
            </div>
            <div style={{ marginTop: 10 }}>
              {SEGMENTOS.map(s => (
                <div key={s.clave} style={{ fontSize: 12, color: "#334155", padding: "3px 0" }}>
                  <b style={{ color: s.color }}>{s.emoji} {s.clave}</b> — {s.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
