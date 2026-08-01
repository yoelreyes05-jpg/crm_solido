"use client";
import { useEffect, useMemo, useState } from "react";
import { API_URL as API } from "@/config";
import {
  CUARTOS_OPCIONES, VISCOSIDADES, TIPOS_ACEITE, INTERVALOS_KM,
  CILINDROS_OPCIONES, confianzaLabel,
} from "@/lib/aceite";

/**
 * Catálogo de fichas técnicas por modelo.
 *
 * Cada fila dice qué lleva un modelo: cuántos cuartos de aceite, qué
 * viscosidad, qué filtro y cada cuánto toca el cambio. Cuando se registra un
 * vehículo, el sistema busca aquí y rellena solo — así la secretaria no tiene
 * que saberlo ni inventarlo.
 *
 * La pestaña "Qué falta medir" ordena los modelos por cuántos hay en el taller,
 * para saber cuáles conviene verificar primero.
 */

type Tab = "catalogo" | "cobertura";

export default function FichasTecnicasPage() {
  const [tab, setTab]           = useState<Tab>("catalogo");
  const [fichas, setFichas]     = useState<any[]>([]);
  const [cobertura, setCobertura] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [busca, setBusca]       = useState("");
  const [editando, setEditando] = useState<any>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const [rc, rb] = await Promise.all([
        fetch(`${API}/vehiculos/spec/catalogo`),
        fetch(`${API}/vehiculos/spec/cobertura`),
      ]);
      setFichas(rc.ok ? await rc.json() : []);
      setCobertura(rb.ok ? await rb.json() : []);
    } catch { /* silencioso */ }
    setLoading(false);
  };
  useEffect(() => { cargar(); }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return fichas;
    return fichas.filter(f =>
      `${f.marca} ${f.modelo} ${f.motor || ""} ${f.filtro_aceite || ""}`.toLowerCase().includes(q));
  }, [fichas, busca]);

  const verificadas = fichas.filter(f => f.confianza === "VERIFICADO").length;
  const sinFicha    = cobertura.filter(c => String(c.estado).startsWith("SIN FICHA")).length;

  const guardar = async () => {
    if (!editando?.marca || !editando?.modelo) return alert("Marca y modelo son requeridos");
    setGuardando(true);
    try {
      const esNueva = !editando.id;
      const r = await fetch(
        esNueva ? `${API}/vehiculos/spec/catalogo` : `${API}/vehiculos/spec/catalogo/${editando.id}`,
        {
          method: esNueva ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...editando,
            cuartos:      editando.cuartos ? Number(editando.cuartos) : null,
            cilindros:    editando.cilindros ? Number(editando.cilindros) : null,
            intervalo_km: editando.intervalo_km ? Number(editando.intervalo_km) : null,
            ano_desde:    editando.ano_desde ? Number(editando.ano_desde) : null,
            ano_hasta:    editando.ano_hasta ? Number(editando.ano_hasta) : null,
          }),
        });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.mensaje || "No se pudo guardar");
      setEditando(null);
      await cargar();
    } catch (e: any) { alert(e.message); }
    setGuardando(false);
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>🛢️ Fichas técnicas por modelo</h1>
          <p style={S.subtitle}>
            Qué lleva cada modelo: aceite, cantidad, filtro e intervalo.
            Se mide una vez y sirve para todos los vehículos iguales.
          </p>
        </div>
        <button onClick={cargar} style={S.btnGhost}>🔄 Actualizar</button>
      </div>

      <div style={S.kpis}>
        <Kpi label="Fichas en catálogo"   valor={fichas.length}   color="#3b82f6" />
        <Kpi label="Verificadas por técnico" valor={verificadas}  color="#16a34a" />
        <Kpi label="Modelos sin ficha"    valor={sinFicha}        color="#dc2626" />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {([
          { k: "catalogo",  l: `📋 Catálogo (${fichas.length})` },
          { k: "cobertura", l: `🎯 Qué falta medir (${sinFicha})` },
        ] as const).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={tab === t.k ? S.tabOn : S.tabOff}>{t.l}</button>
        ))}
      </div>

      {loading ? <p style={S.empty}>Cargando…</p> : tab === "catalogo" ? (
        <div style={S.card}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <input placeholder="Buscar marca, modelo, motor o filtro…"
              value={busca} onChange={e => setBusca(e.target.value)}
              style={{ ...S.input, flex: 1, minWidth: 240, marginBottom: 0 }} />
            <button onClick={() => setEditando({ confianza: "MANUAL" })} style={S.btn}>
              ➕ Nueva ficha
            </button>
          </div>

          {filtradas.length === 0 ? (
            <p style={S.empty}>No hay fichas que coincidan.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>{["Vehículo", "Años", "Motor", "Aceite", "Filtro", "Intervalo", "Confianza", ""]
                    .map((h, i) => <th key={i} style={S.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filtradas.map(f => {
                    const c = confianzaLabel(f.confianza);
                    return (
                      <tr key={f.id}>
                        <td style={S.td}>
                          <div style={{ fontWeight: 700 }}>{f.marca} {f.modelo}</div>
                          {f.cilindros && <div style={S.mini}>{f.cilindros} cilindros</div>}
                        </td>
                        <td style={S.td}>{f.ano_desde || "?"}–{f.ano_hasta || "?"}</td>
                        <td style={S.td}>{f.motor || "—"}</td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 700 }}>{f.cuartos ? `${f.cuartos} cuartos` : "—"}</div>
                          <div style={S.mini}>
                            {[f.viscosidad, f.tipo_aceite ? String(f.tipo_aceite).toLowerCase() : null]
                              .filter(Boolean).join(" · ") || "—"}
                          </div>
                        </td>
                        <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12 }}>
                          {f.filtro_aceite || <span style={{ color: "#dc2626" }}>falta</span>}
                        </td>
                        <td style={S.td}>{f.intervalo_km ? `${Number(f.intervalo_km).toLocaleString("es-DO")} km` : "—"}</td>
                        <td style={S.td}>
                          <span style={{ ...S.badge, background: c.fondo, color: c.color }}>{c.texto}</span>
                          {f.verificado_por && <div style={S.mini}>por {f.verificado_por}</div>}
                        </td>
                        <td style={S.td}>
                          <button onClick={() => setEditando({ ...f })} style={S.btnMini}>✏️</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div style={S.card}>
          <p style={{ ...S.empty, textAlign: "left", padding: "0 0 12px" }}>
            Modelos ordenados por cuántos hay en tu taller. Los de arriba sin ficha
            son los que más te conviene medir: cada uno que verifiques ahorra
            trabajo en todos los que vengan después.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>{["Modelo", "En el taller", "Con datos", "Verificados", "Ficha del catálogo", "Estado"]
                  .map((h, i) => <th key={i} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {cobertura.map((c, i) => {
                  const falta = String(c.estado).startsWith("SIN FICHA");
                  return (
                    <tr key={i} style={{ background: falta ? "#fff5f5" : "transparent" }}>
                      <td style={{ ...S.td, fontWeight: 700 }}>{c.marca} {c.modelo}</td>
                      <td style={S.td}>{c.vehiculos_en_taller}</td>
                      <td style={S.td}>{c.con_datos}</td>
                      <td style={S.td}>{c.verificados}</td>
                      <td style={S.td}>
                        {c.cuartos_catalogo
                          ? `${c.cuartos_catalogo} cuartos${c.viscosidad_catalogo ? ` · ${c.viscosidad_catalogo}` : ""}`
                          : "—"}
                      </td>
                      <td style={{ ...S.td, fontWeight: 700, color: falta ? "#dc2626" : c.estado.includes("Verificado") ? "#16a34a" : "#a16207" }}>
                        {c.estado}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal de edición ─────────────────────────────────────────────── */}
      {editando && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setEditando(null); }}>
          <div style={S.modal}>
            <h3 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 800 }}>
              {editando.id ? "Editar ficha" : "Nueva ficha"}
            </h3>

            <div style={S.g2}>
              <div><label style={S.label}>Marca *</label>
                <input value={editando.marca || ""} onChange={e => setEditando({ ...editando, marca: e.target.value })} style={S.input} /></div>
              <div><label style={S.label}>Modelo *</label>
                <input value={editando.modelo || ""} onChange={e => setEditando({ ...editando, modelo: e.target.value })} style={S.input} /></div>
            </div>

            <div style={S.g2}>
              <div><label style={S.label}>Año desde</label>
                <input type="number" value={editando.ano_desde || ""} onChange={e => setEditando({ ...editando, ano_desde: e.target.value })} style={S.input} /></div>
              <div><label style={S.label}>Año hasta</label>
                <input type="number" value={editando.ano_hasta || ""} onChange={e => setEditando({ ...editando, ano_hasta: e.target.value })} style={S.input} /></div>
            </div>

            <div style={S.g2}>
              <div><label style={S.label}>Motor</label>
                <input value={editando.motor || ""} placeholder="Ej: 1.8L L4"
                  onChange={e => setEditando({ ...editando, motor: e.target.value })} style={S.input} /></div>
              <div><label style={S.label}>Cilindros</label>
                <select value={editando.cilindros || ""} onChange={e => setEditando({ ...editando, cilindros: e.target.value })} style={S.input}>
                  <option value="">—</option>
                  {CILINDROS_OPCIONES.map(c => <option key={c.valor} value={c.valor}>{c.label}</option>)}
                </select></div>
            </div>

            <div style={S.g2}>
              <div><label style={S.label}>Cuartos de aceite</label>
                <select value={editando.cuartos || ""} onChange={e => setEditando({ ...editando, cuartos: e.target.value })} style={S.input}>
                  <option value="">—</option>
                  {CUARTOS_OPCIONES.map(c => <option key={c} value={c}>{c} cuartos</option>)}
                </select></div>
              <div><label style={S.label}>Viscosidad</label>
                <select value={editando.viscosidad || ""} onChange={e => setEditando({ ...editando, viscosidad: e.target.value })} style={S.input}>
                  <option value="">—</option>
                  {VISCOSIDADES.map(v => <option key={v} value={v}>{v}</option>)}
                </select></div>
            </div>

            <div style={S.g2}>
              <div><label style={S.label}>Tipo de aceite</label>
                <select value={editando.tipo_aceite || ""} onChange={e => setEditando({ ...editando, tipo_aceite: e.target.value })} style={S.input}>
                  <option value="">—</option>
                  {TIPOS_ACEITE.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
                </select></div>
              <div><label style={S.label}>Cambio cada</label>
                <select value={editando.intervalo_km || ""} onChange={e => setEditando({ ...editando, intervalo_km: e.target.value })} style={S.input}>
                  <option value="">—</option>
                  {INTERVALOS_KM.map(k => <option key={k} value={k}>{k.toLocaleString("es-DO")} km</option>)}
                </select></div>
            </div>

            <label style={S.label}>Filtro de aceite</label>
            <input value={editando.filtro_aceite || ""} placeholder="Ej: 90915-YZZD3"
              onChange={e => setEditando({ ...editando, filtro_aceite: e.target.value.toUpperCase() })}
              style={{ ...S.input, fontFamily: "monospace" }} />

            <div style={S.g2}>
              <div><label style={S.label}>Filtro de aire</label>
                <input value={editando.filtro_aire || ""} onChange={e => setEditando({ ...editando, filtro_aire: e.target.value.toUpperCase() })} style={{ ...S.input, fontFamily: "monospace" }} /></div>
              <div><label style={S.label}>Filtro de cabina</label>
                <input value={editando.filtro_cabina || ""} onChange={e => setEditando({ ...editando, filtro_cabina: e.target.value.toUpperCase() })} style={{ ...S.input, fontFamily: "monospace" }} /></div>
            </div>

            <label style={S.label}>Confianza</label>
            <select value={editando.confianza || "MANUAL"} onChange={e => setEditando({ ...editando, confianza: e.target.value })} style={S.input}>
              <option value="VERIFICADO">Verificado — lo confirmó un técnico con el vehículo</option>
              <option value="MANUAL">Manual — tomado del manual del fabricante</option>
              <option value="ESTIMADO">Estimado — hay que confirmarlo</option>
            </select>

            <label style={S.label}>Notas</label>
            <textarea value={editando.notas || ""} rows={2}
              onChange={e => setEditando({ ...editando, notas: e.target.value })}
              style={{ ...S.input, resize: "vertical" }} />

            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button onClick={guardar} disabled={guardando} style={{ ...S.btn, flex: 2 }}>
                {guardando ? "Guardando…" : "💾 Guardar"}
              </button>
              <button onClick={() => setEditando(null)} style={{ ...S.btnGhost, flex: 1 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, valor, color }: { label: string; valor: number; color: string }) {
  return (
    <div style={{ ...S.card, padding: "14px 18px", flex: 1, minWidth: 170 }}>
      <div style={{ fontSize: 26, fontWeight: 900, color }}>{valor}</div>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:     { padding: 24, maxWidth: 1400, margin: "0 auto" },
  header:   { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18, flexWrap: "wrap" },
  title:    { margin: 0, fontSize: 24, fontWeight: 900, color: "#0f172a" },
  subtitle: { margin: "4px 0 0", fontSize: 13, color: "#64748b", maxWidth: 620, lineHeight: 1.5 },
  kpis:     { display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" },
  card:     { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18 },
  tabOn:    { padding: "9px 16px", borderRadius: 9, border: "none", background: "#4f46e5", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  tabOff:   { padding: "9px 16px", borderRadius: 9, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  table:    { width: "100%", borderCollapse: "collapse" },
  th:       { textAlign: "left", padding: "9px 12px", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" },
  td:       { padding: "10px 12px", fontSize: 13, color: "#0f172a", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" },
  mini:     { fontSize: 11, color: "#94a3b8" },
  badge:    { padding: "3px 9px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap", display: "inline-block" },
  empty:    { textAlign: "center", padding: 32, color: "#94a3b8", fontSize: 14 },
  input:    { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, marginBottom: 10, background: "#fff", color: "#0f172a" },
  label:    { display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 },
  g2:       { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  btn:      { padding: "10px 18px", borderRadius: 9, border: "none", background: "#4f46e5", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" },
  btnGhost: { padding: "10px 18px", borderRadius: 9, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  btnMini:  { padding: "5px 9px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 13, cursor: "pointer" },
  overlay:  { position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60 },
  modal:    { background: "#fff", borderRadius: 14, padding: 22, width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto" },
};
