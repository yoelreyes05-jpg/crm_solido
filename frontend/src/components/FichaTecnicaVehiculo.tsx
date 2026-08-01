"use client";
import { useEffect, useState } from "react";
import { API_URL as API } from "@/config";
import {
  CUARTOS_OPCIONES, VISCOSIDADES, TIPOS_ACEITE, INTERVALOS_KM, confianzaLabel,
} from "@/lib/aceite";

/**
 * Ficha técnica del vehículo — captura por el técnico.
 *
 * El problema que resuelve: al registrar el vehículo nadie sabe qué filtro de
 * aceite lleva. Se sabe cuando el técnico lo tiene en la mano. Este componente
 * le permite anotarlo al terminar el trabajo, y con un clic ese dato queda
 * guardado para TODOS los vehículos del mismo modelo que entren después.
 *
 * Se mide una vez. Sirve para siempre.
 */

interface Props {
  vehiculoId: number;
  /** Se muestra en el encabezado, ej. "Toyota Corolla 2018". */
  vehiculoLabel?: string;
  /** Usuario que verifica (queda registrado en la ficha). */
  usuario?: string;
  /** Se llama al guardar, por si la pantalla padre quiere refrescar. */
  onGuardado?: (r: any) => void;
  /** Modo compacto para incrustarlo dentro de otra pantalla. */
  compacto?: boolean;
}

export default function FichaTecnicaVehiculo({
  vehiculoId, vehiculoLabel, usuario, onGuardado, compacto,
}: Props) {
  const [cargando, setCargando]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [veh, setVeh]             = useState<any>(null);
  const [msg, setMsg]             = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const [form, setForm] = useState({
    cuartos: "", viscosidad: "", tipo_aceite: "",
    intervalo_km: "", filtro_aceite: "", notas: "",
  });
  // Si está activo, lo capturado queda como ficha del modelo completo.
  const [propagar, setPropagar] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCargando(true);
      try {
        const r = await fetch(`${API}/vehiculos/${vehiculoId}`);
        const v = r.ok ? await r.json() : null;
        if (cancelado || !v) { setCargando(false); return; }
        setVeh(v);

        // Precargar con lo que ya se sepa del vehículo…
        let base = {
          cuartos:       v.cuartos_aceite ? String(v.cuartos_aceite) : "",
          viscosidad:    v.viscosidad || "",
          tipo_aceite:   v.tipo_aceite || "",
          intervalo_km:  "",
          filtro_aceite: "",
          notas:         v.spec_notas || "",
        };

        // …y completar lo que falte desde el catálogo del modelo.
        if (v.marca && v.modelo) {
          const q = new URLSearchParams({
            marca: v.marca, modelo: v.modelo,
            ...(v.ano ? { ano: String(v.ano) } : {}),
            ...(v.motor ? { motor: v.motor } : {}),
            ...(v.cilindros ? { cilindros: String(v.cilindros) } : {}),
          });
          const rs = await fetch(`${API}/vehiculos/spec/sugerir?${q}`);
          if (rs.ok) {
            const s = await rs.json();
            if (s && !cancelado) {
              base = {
                cuartos:       base.cuartos       || (s.cuartos ? String(s.cuartos) : ""),
                viscosidad:    base.viscosidad    || (s.viscosidad || ""),
                tipo_aceite:   base.tipo_aceite   || (s.tipo_aceite || ""),
                intervalo_km:  base.intervalo_km  || (s.intervalo_km ? String(s.intervalo_km) : ""),
                filtro_aceite: base.filtro_aceite || (s.filtro_aceite || ""),
                notas:         base.notas,
              };
            }
          }
        }
        if (!cancelado) setForm(base);
      } catch { /* si falla, el técnico llena a mano */ }
      if (!cancelado) setCargando(false);
    })();
    return () => { cancelado = true; };
  }, [vehiculoId]);

  const guardar = async () => {
    if (!form.cuartos) { setMsg({ tipo: "error", texto: "Selecciona cuántos cuartos lleva." }); return; }
    setGuardando(true); setMsg(null);
    try {
      const r = await fetch(`${API}/vehiculos/${vehiculoId}/spec`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(usuario ? { "x-usuario": encodeURIComponent(JSON.stringify({ nombre: usuario })) } : {}) },
        body: JSON.stringify({
          cuartos:       Number(form.cuartos),
          viscosidad:    form.viscosidad || null,
          tipo_aceite:   form.tipo_aceite || null,
          intervalo_km:  form.intervalo_km ? Number(form.intervalo_km) : null,
          filtro_aceite: form.filtro_aceite || null,
          notas:         form.notas || null,
          propagar,
        }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.mensaje || "No se pudo guardar");
      setMsg({ tipo: "ok", texto: d.mensaje || "Ficha guardada." });
      onGuardado?.(d);
    } catch (e: any) {
      setMsg({ tipo: "error", texto: e.message || "Error al guardar" });
    }
    setGuardando(false);
  };

  if (cargando) return <div style={S.wrap}><p style={S.hint}>Cargando ficha técnica…</p></div>;

  const conf = confianzaLabel(veh?.spec_confianza);

  return (
    <div style={{ ...S.wrap, ...(compacto ? { padding: 12 } : {}) }}>
      <div style={S.head}>
        <div>
          <h3 style={S.titulo}>🛢️ Ficha técnica del vehículo</h3>
          {vehiculoLabel && <p style={S.sub}>{vehiculoLabel}</p>}
        </div>
        <span style={{ ...S.badge, background: conf.fondo, color: conf.color }}>{conf.texto}</span>
      </div>

      <p style={S.hint}>
        Anota lo que verificaste con el vehículo delante. Al guardar, estos datos
        quedan en su ficha y aparecen en el historial impreso.
      </p>

      <div style={S.grid2}>
        <div>
          <label style={S.label}>Cuartos de aceite *</label>
          <select value={form.cuartos} onChange={e => setForm({ ...form, cuartos: e.target.value })} style={S.input}>
            <option value="">— Seleccionar —</option>
            {CUARTOS_OPCIONES.map(c => <option key={c} value={c}>{c} cuartos</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Viscosidad</label>
          <select value={form.viscosidad} onChange={e => setForm({ ...form, viscosidad: e.target.value })} style={S.input}>
            <option value="">— Seleccionar —</option>
            {VISCOSIDADES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <div style={S.grid2}>
        <div>
          <label style={S.label}>Tipo de aceite</label>
          <select value={form.tipo_aceite}
            onChange={e => {
              const t = e.target.value;
              const def = TIPOS_ACEITE.find(x => x.valor === t);
              // El intervalo se sugiere solo según el tipo de aceite
              setForm(f => ({ ...f, tipo_aceite: t, intervalo_km: f.intervalo_km || (def ? String(def.intervalo) : "") }));
            }}
            style={S.input}>
            <option value="">— Seleccionar —</option>
            {TIPOS_ACEITE.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Cambio cada</label>
          <select value={form.intervalo_km} onChange={e => setForm({ ...form, intervalo_km: e.target.value })} style={S.input}>
            <option value="">— Seleccionar —</option>
            {INTERVALOS_KM.map(k => <option key={k} value={k}>{k.toLocaleString("es-DO")} km</option>)}
          </select>
        </div>
      </div>

      <label style={S.label}>Filtro de aceite</label>
      <input value={form.filtro_aceite}
        onChange={e => setForm({ ...form, filtro_aceite: e.target.value.toUpperCase() })}
        placeholder="Número de parte, ej: 90915-YZZD3"
        style={{ ...S.input, fontFamily: "monospace", letterSpacing: 0.5 }} />
      <p style={S.hintMini}>
        Este es el dato que no se sabe al registrar el vehículo. Al anotarlo aquí,
        el próximo del mismo modelo lo trae solo.
      </p>

      <label style={S.label}>Notas</label>
      <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
        rows={2} placeholder="Ej: motor cambiado, el dueño prefiere sintético…"
        style={{ ...S.input, resize: "vertical" }} />

      <label style={S.check}>
        <input type="checkbox" checked={propagar} onChange={e => setPropagar(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: "#16a34a" }} />
        <span>
          <strong>Guardar para todos los {veh?.marca} {veh?.modelo}</strong>
          <br />
          <span style={{ fontSize: 11, color: "#64748b" }}>
            Desmárcalo solo si este vehículo es distinto al resto (motor cambiado, por ejemplo).
          </span>
        </span>
      </label>

      {msg && (
        <div style={{
          ...S.msg,
          background: msg.tipo === "ok" ? "#dcfce7" : "#fee2e2",
          color:      msg.tipo === "ok" ? "#166534" : "#991b1b",
        }}>
          {msg.tipo === "ok" ? "✅ " : "⚠️ "}{msg.texto}
        </div>
      )}

      <button onClick={guardar} disabled={guardando} style={{ ...S.btn, opacity: guardando ? 0.6 : 1 }}>
        {guardando ? "Guardando…" : "💾 Guardar ficha técnica"}
      </button>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap:   { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 },
  head:   { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
  titulo: { margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" },
  sub:    { margin: "2px 0 0", fontSize: 12, color: "#64748b" },
  badge:  { padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" },
  hint:   { fontSize: 12, color: "#64748b", margin: "8px 0 12px", lineHeight: 1.5 },
  hintMini: { fontSize: 11, color: "#64748b", margin: "-4px 0 10px", lineHeight: 1.4 },
  grid2:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  label:  { display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 },
  input:  { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid #cbd5e1",
            fontSize: 13, marginBottom: 10, background: "#fff", color: "#0f172a" },
  check:  { display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13, color: "#0f172a",
            background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 9,
            padding: "10px 12px", margin: "4px 0 12px", cursor: "pointer" },
  msg:    { borderRadius: 8, padding: "9px 12px", fontSize: 12.5, marginBottom: 10, lineHeight: 1.5 },
  btn:    { width: "100%", padding: "11px 16px", borderRadius: 9, border: "none",
            background: "#16a34a", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" },
};
