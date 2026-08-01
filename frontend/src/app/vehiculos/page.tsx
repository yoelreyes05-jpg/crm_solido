"use client";
import { useEffect, useState } from "react";
import { CUARTOS_OPCIONES, VISCOSIDADES, CILINDROS_OPCIONES } from "@/lib/aceite";
import { API_URL as API } from "@/config";
import { decodificarVIN as decodeVIN, registrarConsultaVIN } from "@/lib/vin";
import { usePermisos } from "@/lib/usePermisos";

export default function Vehiculos() {
  const { puedeCrear, puedeEditar, puedeEliminar } = usePermisos("vehiculos");
  const [clientes, setClientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [catalogo, setCatalogo] = useState({});
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const [form, setForm] = useState({
    cliente_id: "", marca: "", modelo: "", ano: "", placa: "", color: "",
    vin: "", motor: "", combustible: "",
    // Datos que alimentan los planes de mantenimiento y las alertas por uso.
    // Se piden AQUI, al registrar el vehiculo, para que la inspeccion ya los
    // tenga listos y nadie tenga que teclearlos dos veces.
    cilindros: "", tipo_aceite: "", km_actual: "",
    cuartos_aceite: "", viscosidad: ""
  });
  // Lo que el catálogo sabe de este modelo (ver migracion_v25)
  const [spec, setSpec] = useState<any>(null);
  const [buscandoSpec, setBuscandoSpec] = useState(false);
  const [editVehiculo, setEditVehiculo] = useState<any>(null);
  const [editForm, setEditForm] = useState({ marca: "", modelo: "", ano: "", placa: "", color: "", cliente_id: "", vin: "", motor: "", combustible: "", cilindros: "", tipo_aceite: "", km_actual: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [decodandoVIN, setDecodandoVIN] = useState(false);
  const [vinEstado, setVinEstado] = useState<"ok"|"error"|"">("");

  const getClientes = async () => {
    try { const r = await fetch(`${API}/clientes`); setClientes(await r.json()); } catch { setClientes([]); }
  };

  const getVehiculos = async () => {
    try { const r = await fetch(`${API}/vehiculos`); const d = await r.json(); setVehiculos(Array.isArray(d) ? d : []); } catch { setVehiculos([]); }
  };

  const getCatalogo = async () => {
    try { const r = await fetch(`${API}/vehiculos/catalogo`); setCatalogo(await r.json()); } catch { setCatalogo({}); }
  };

  useEffect(() => { getClientes(); getVehiculos(); getCatalogo(); }, []);

  // ── Autocompletar qué lleva este vehículo ─────────────────────────────────
  // En cuanto hay marca y modelo, el sistema busca en el catálogo cuántos
  // cuartos de aceite lleva, qué viscosidad y cada cuánto toca el cambio.
  // Así nadie —ni el cliente ni la secretaria— tiene que saberlo de memoria.
  useEffect(() => {
    if (!form.marca || !form.modelo) { setSpec(null); return; }
    let cancelado = false;
    setBuscandoSpec(true);
    const q = new URLSearchParams({
      marca: form.marca, modelo: form.modelo,
      ...(form.ano ? { ano: form.ano } : {}),
      ...(form.motor ? { motor: form.motor } : {}),
      ...(form.cilindros ? { cilindros: form.cilindros } : {}),
    });
    fetch(`${API}/vehiculos/spec/sugerir?${q}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelado || !d) return;
        setSpec(d);
        // Se rellenan solo los campos que el usuario no haya tocado.
        setForm(f => ({
          ...f,
          cilindros:      f.cilindros      || (d.cilindros ? String(d.cilindros) : ""),
          tipo_aceite:    f.tipo_aceite    || (d.tipo_aceite || ""),
          cuartos_aceite: f.cuartos_aceite || (d.cuartos ? String(d.cuartos) : ""),
          viscosidad:     f.viscosidad     || (d.viscosidad || ""),
        }));
      })
      .catch(() => { if (!cancelado) setSpec(null); })
      .finally(() => { if (!cancelado) setBuscandoSpec(false); });
    return () => { cancelado = true; };
  }, [form.marca, form.modelo, form.ano, form.motor]);

  const handleMarcaChange = (marca) => setForm({ ...form, marca, modelo: "" });

  const decodificarVIN = async (vin: string) => {
    const limpio = vin.trim().toUpperCase();
    if (limpio.length !== 17) return;
    setDecodandoVIN(true);
    setVinEstado("");
    try {
      const data = await decodeVIN(limpio);
      setForm(f => ({
        ...f,
        vin:         limpio,
        marca:       data.marca       || f.marca,
        modelo:      data.modelo      || f.modelo,
        ano:         data.ano         || f.ano,
        motor:       data.motor       || f.motor,
        combustible: data.combustible || f.combustible,
      }));
      setVinEstado("ok");
      // Registrar en historial VIN
      registrarConsultaVIN(API, data, "vehiculos");
    } catch { setVinEstado("error"); }
    finally { setDecodandoVIN(false); }
  };

  const validar = () => {
    if (!form.cliente_id) return "Selecciona un cliente";
    if (!form.marca) return "Selecciona una marca";
    if (!form.modelo) return "Selecciona un modelo";
    if (!form.ano) return "Selecciona el año";
    if (!form.placa.trim()) return "Ingresa la placa";
    if (form.km_actual !== "" && (Number(form.km_actual) < 0 || Number(form.km_actual) > 2000000))
      return "El kilometraje no parece válido";
    return null;
  };

  // El motor viene del decodificador de VIN como texto ("3.5L V6", "1.5L L4").
  // De ahí se saca el cilindraje sin que nadie lo teclee.
  const cilindrosDesdeMotor = (motor: string): string => {
    const m = String(motor || "").toUpperCase();
    const hit = m.match(/\b[VLIH]-?(\d{1,2})\b/) || m.match(/(\d{1,2})\s*CIL/);
    if (!hit) return "";
    const n = Number(hit[1]);
    return [3, 4, 5, 6, 8, 10, 12].includes(n) ? String(n) : "";
  };

  const crearVehiculo = async () => {
    const error = validar();
    if (error) return alert(error);
    setLoading(true);
    try {
      const res = await fetch(`${API}/vehiculos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id:  Number(form.cliente_id),
          marca:       form.marca,
          modelo:      form.modelo,
          ano:         Number(form.ano),
          placa:       form.placa.toUpperCase().trim(),
          color:       form.color,
          vin:         form.vin.trim().toUpperCase() || null,
          motor:       form.motor || null,
          combustible: form.combustible || null,
          cilindros:      form.cilindros ? Number(form.cilindros) : null,
          tipo_aceite:    form.tipo_aceite || null,
          cuartos_aceite: form.cuartos_aceite ? Number(form.cuartos_aceite) : null,
          viscosidad:     form.viscosidad || null,
          spec_id:        spec?.spec_id ?? null,
          spec_confianza: spec?.confianza || "ESTIMADO",
          // El backend crea la primera lectura de odómetro con este valor.
          km_actual:   form.km_actual !== "" ? Number(form.km_actual) : null,
        })
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      // El backend avisa si algún dato no se pudo guardar por falta de una
      // migración, en vez de fallar en silencio.
      alert(data.aviso
        ? `✅ Vehículo registrado.\n\n⚠️ ${data.aviso}`
        : "✅ Vehículo registrado correctamente");
      setForm({ cliente_id: "", marca: "", modelo: "", ano: "", placa: "", color: "", vin: "", motor: "", combustible: "", cilindros: "", tipo_aceite: "", km_actual: "", cuartos_aceite: "", viscosidad: "" });
      setSpec(null);
      setVinEstado("");
      await getVehiculos();
    } catch { alert("Error al guardar"); }
    finally { setLoading(false); }
  };

  const eliminarVehiculo = async (id, info) => {
    if (!confirm(`¿Eliminar el vehículo "${info}"?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`${API}/vehiculos/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) return alert("Error: " + data.error);
      await getVehiculos();
    } catch { alert("Error al eliminar"); }
  };

  const abrirEdicion = (v: any) => {
    setEditVehiculo(v);
    setEditForm({ marca: v.marca, modelo: v.modelo, ano: String(v.ano), placa: v.placa, color: v.color || "", cliente_id: String(v.cliente_id || ""), vin: v.vin || "", motor: v.motor || "", combustible: v.combustible || "", cilindros: v.cilindros ? String(v.cilindros) : "", tipo_aceite: v.tipo_aceite || "", km_actual: "" });
  };

  const guardarEdicion = async () => {
    if (!editVehiculo) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`${API}/vehiculos/${editVehiculo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          ano: Number(editForm.ano),
          cliente_id: Number(editForm.cliente_id),
          placa: editForm.placa.toUpperCase().trim(),
          cilindros: editForm.cilindros ? Number(editForm.cilindros) : null,
          tipo_aceite: editForm.tipo_aceite || null,
          // Solo se manda si la escribieron: es una lectura nueva de odómetro,
          // no un campo del vehículo que se sobreescriba en cada edición.
          km_actual: editForm.km_actual !== "" ? Number(editForm.km_actual) : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) return alert("Error: " + data.error);
      setEditVehiculo(null);
      await getVehiculos();
    } catch { alert("Error al actualizar"); }
    setSavingEdit(false);
  };

  const modelosDisponibles = form.marca ? (catalogo[form.marca] || []) : [];

  const vehiculosFiltrados = vehiculos.filter(v =>
    !busqueda ||
    v.cliente_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    v.marca?.toLowerCase().includes(busqueda.toLowerCase()) ||
    v.modelo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    v.placa?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={container}>
      <h1 style={title}>🚗 Vehículos</h1>

      <div style={grid}>
        {/* FORMULARIO — solo si puede crear */}
        {puedeCrear && <div style={card}>
          <h2 style={cardTitle}>➕ Registrar Vehículo</h2>

          {/* ── VIN Decoder ── */}
          <div style={{ background: "#0f172a", border: "1px solid #1e3a5f", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
            <label style={{ ...label, color: "#93c5fd", marginBottom: 6 }}>🔍 Decodificar VIN (opcional)</label>
            <p style={{ fontSize: 11, color: "#64748b", marginTop: -4, marginBottom: 10 }}>
              Ingresa el VIN de 17 caracteres para autocompletar marca, modelo, año, motor y combustible.
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={form.vin}
                onChange={e => { setForm(f => ({ ...f, vin: e.target.value.toUpperCase() })); setVinEstado(""); }}
                onBlur={e => decodificarVIN(e.target.value)}
                placeholder="Ej: 1HGBH41JXMN109186"
                maxLength={17}
                style={{ ...input, flex: 1, marginBottom: 0, fontFamily: "monospace", letterSpacing: 1,
                  borderColor: vinEstado === "ok" ? "#16a34a" : vinEstado === "error" ? "#dc2626" : "#1e3a5f" }}
              />
              <button
                type="button"
                onClick={() => decodificarVIN(form.vin)}
                disabled={decodandoVIN || form.vin.length !== 17}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: vinEstado === "ok" ? "#16a34a" : vinEstado === "error" ? "#dc2626" : "#2563eb",
                  color: "#fff", fontSize: 13, whiteSpace: "nowrap",
                  opacity: (decodandoVIN || form.vin.length !== 17) ? 0.5 : 1 }}
              >
                {decodandoVIN ? "⏳ Consultando..." : vinEstado === "ok" ? "✅ Decodificado" : vinEstado === "error" ? "❌ No encontrado" : "🔍 Decodificar"}
              </button>
            </div>
            {vinEstado === "ok" && (
              <p style={{ fontSize: 11, color: "#4ade80", marginTop: 6 }}>
                ✅ Datos completados automáticamente desde NHTSA
                {form.motor && ` · Motor: ${form.motor}`}
                {form.combustible && ` · ${form.combustible}`}
              </p>
            )}
            {vinEstado === "error" && (
              <p style={{ fontSize: 11, color: "#f87171", marginTop: 6 }}>VIN no reconocido. Completa los datos manualmente.</p>
            )}
          </div>

          <label style={label}>Cliente *</label>
          <select value={form.cliente_id}
            onChange={e => setForm({ ...form, cliente_id: e.target.value })} style={input}>
            <option value="">— Seleccionar cliente —</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>

          <label style={label}>Marca *</label>
          {vinEstado === "ok" ? (
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <input
                value={form.marca}
                onChange={e => setForm(f => ({ ...f, marca: e.target.value }))}
                style={{ ...input, marginBottom: 0, flex: 1, background: "#f0fdf4", borderColor: "#86efac" }}
              />
              <button type="button" onClick={() => { setVinEstado(""); setForm(f => ({ ...f, marca: "", modelo: "" })); }}
                style={{ padding: "8px 10px", background: "#f1f5f9", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#555", whiteSpace: "nowrap" }}>
                📋 Usar lista
              </button>
            </div>
          ) : (
            <select value={form.marca} onChange={e => handleMarcaChange(e.target.value)} style={input}>
              <option value="">— Seleccionar marca —</option>
              {Object.keys(catalogo).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}

          <label style={label}>Modelo *</label>
          {vinEstado === "ok" ? (
            <input
              value={form.modelo}
              onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}
              style={{ ...input, background: "#f0fdf4", borderColor: "#86efac" }}
            />
          ) : (
            <>
              <select value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })}
                style={input} disabled={!form.marca}>
                <option value="">— Seleccionar modelo —</option>
                {modelosDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {form.marca === "OTRO" && (
                <input placeholder="Escribe el modelo" value={form.modelo === "Personalizado" ? "" : form.modelo}
                  onChange={e => setForm({ ...form, modelo: e.target.value })} style={input} />
              )}
            </>
          )}

          <label style={label}>Año *</label>
          <select value={form.ano} onChange={e => setForm({ ...form, ano: e.target.value })} style={input}>
            <option value="">— Seleccionar año —</option>
            {Array.from({ length: 36 }, (_, i) => 2025 - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <label style={label}>Placa *</label>
          <input placeholder="Ej: A123456" value={form.placa}
            onChange={e => setForm({ ...form, placa: e.target.value.toUpperCase() })} style={input} />

          <label style={label}>Color</label>
          <input placeholder="Ej: Rojo, Negro, Blanco..." value={form.color}
            onChange={e => setForm({ ...form, color: e.target.value })} style={input} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={label}>Motor</label>
              <input placeholder="Ej: 1.5L L4" value={form.motor}
                onChange={e => {
                  const motor = e.target.value;
                  // Si el cilindraje aún está vacío, se deduce del texto del
                  // motor. Si ya lo eligieron a mano, no se pisa.
                  const auto = cilindrosDesdeMotor(motor);
                  setForm(f => ({ ...f, motor, cilindros: f.cilindros || auto }));
                }}
                style={{ ...input, marginBottom: 0 }} />
            </div>
            <div>
              <label style={label}>Combustible</label>
              <select value={form.combustible} onChange={e => setForm({ ...form, combustible: e.target.value })}
                style={{ ...input, marginBottom: 0 }}>
                <option value="">— Seleccionar —</option>
                <option>Gasolina</option>
                <option>Diesel</option>
                <option>Eléctrico</option>
                <option>Híbrido</option>
                <option>Híbrido Enchufable</option>
                <option>Gas Natural</option>
              </select>
            </div>
          </div>
          <div style={{ height: 10 }} />

          {/* ── Mantenimiento: cilindraje, aceite y kilometraje ──────────────
              Estos tres datos se piden al REGISTRAR el vehículo. Con ellos el
              sistema calcula solo el precio de la membresía, cuántos cuartos
              de aceite lleva, y cuándo le toca el próximo cambio. La hoja de
              inspección ya no tiene que pedir el kilometraje en blanco. */}
          <div style={{ background: "#0b2545", border: "1px solid #1e3a5f", borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <label style={{ ...label, color: "#93c5fd", marginBottom: 6 }}>🔧 Datos de mantenimiento</label>
            <p style={{ fontSize: 11, color: "#93c5fd", marginTop: 0, marginBottom: 10 }}>
              Con esto se calcula el plan de mantenimiento y las alertas por kilometraje.
            </p>

            {/* Lo que el catálogo ya sabe de este modelo. El cliente no tiene
                que saber qué aceite usa: el sistema lo sabe por él. */}
            {buscandoSpec && (
              <p style={{ fontSize: 11, color: "#93c5fd", marginBottom: 10 }}>⏳ Buscando especificaciones del modelo…</p>
            )}
            {spec && !buscandoSpec && (
              <div style={{
                background: spec.confianza === "VERIFICADO" ? "#052e16" : "#422006",
                border: `1px solid ${spec.confianza === "VERIFICADO" ? "#16a34a" : "#a16207"}`,
                borderRadius: 8, padding: "9px 11px", marginBottom: 10, fontSize: 12,
              }}>
                <div style={{ fontWeight: 700, color: spec.confianza === "VERIFICADO" ? "#4ade80" : "#fbbf24", marginBottom: 4 }}>
                  {spec.confianza === "VERIFICADO" ? "✅ Ficha verificada por tu taller"
                    : spec.confianza === "MANUAL" ? "📘 Según el manual del fabricante"
                    : "⚠️ Estimado — un técnico debe confirmarlo"}
                </div>
                <div style={{ color: "#d1d5db", lineHeight: 1.6 }}>
                  {spec.cuartos && <>Lleva <strong>{spec.cuartos} cuartos</strong>{spec.viscosidad ? <> de <strong>{spec.viscosidad}</strong></> : null}<br /></>}
                  {spec.intervalo_km && <>Cambio cada <strong>{Number(spec.intervalo_km).toLocaleString("es-DO")} km</strong><br /></>}
                  {spec.filtro_aceite && <>Filtro: <strong>{spec.filtro_aceite}</strong><br /></>}
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>{spec.origen}</span>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={label}>Cilindros</label>
                <select value={form.cilindros}
                  onChange={e => setForm({ ...form, cilindros: e.target.value })}
                  style={{ ...input, marginBottom: 0 }}>
                  <option value="">— Seleccionar —</option>
                  {CILINDROS_OPCIONES.map(c => (
                    <option key={c.valor} value={c.valor}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>Tipo de aceite</label>
                <select value={form.tipo_aceite}
                  onChange={e => setForm({ ...form, tipo_aceite: e.target.value })}
                  style={{ ...input, marginBottom: 0 }}>
                  <option value="">— Seleccionar —</option>
                  <option value="MINERAL">Mineral (cada 3,000 km)</option>
                  <option value="SEMISINTETICO">Semisintético (cada 5,000 km)</option>
                  <option value="SINTETICO">Sintético (cada 8,000 km)</option>
                </select>
              </div>
            </div>

            <div style={{ height: 10 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={label}>Cuartos de aceite</label>
                {/* Lista cerrada: la secretaria elige, no teclea. */}
                <select value={form.cuartos_aceite}
                  onChange={e => setForm({ ...form, cuartos_aceite: e.target.value })}
                  style={{ ...input, marginBottom: 0 }}>
                  <option value="">— Seleccionar —</option>
                  {CUARTOS_OPCIONES.map(c => (
                    <option key={c} value={c}>{c} cuartos</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>Viscosidad</label>
                <select value={form.viscosidad}
                  onChange={e => setForm({ ...form, viscosidad: e.target.value })}
                  style={{ ...input, marginBottom: 0 }}>
                  <option value="">— Seleccionar —</option>
                  {VISCOSIDADES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            <div style={{ height: 10 }} />
            <label style={label}>Kilometraje actual</label>
            <input type="number" min={0} placeholder="Ej: 87500" value={form.km_actual}
              onChange={e => setForm({ ...form, km_actual: e.target.value })}
              style={{ ...input, marginBottom: 0 }} />
            <p style={{ fontSize: 11, color: "#93c5fd", marginTop: 6, marginBottom: 0 }}>
              Se guarda como la primera lectura del odómetro. A partir de aquí el
              sistema estima cuánto rueda al mes y avisa cuándo toca el aceite.
            </p>
          </div>

          <button onClick={crearVehiculo} disabled={loading} style={btnPrimary}>
            {loading ? "Guardando..." : "💾 Guardar Vehículo"}
          </button>
        </div>}

        {/* LISTA */}
        <div style={card}>
          <h2 style={cardTitle}>📋 Lista de Vehículos ({vehiculosFiltrados.length})</h2>

          <input placeholder="Buscar por cliente, marca, modelo o placa..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ ...input, marginBottom: 16 }} />

          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  {["Cliente", "Marca", "Modelo", "Año", "Placa", "Motor", "Kilometraje", "Aceite", ""].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vehiculosFiltrados.length === 0 ? (
                  <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#aaa" }}>Sin vehículos</td></tr>
                ) : vehiculosFiltrados.map(v => (
                  <tr key={v.id}>
                    <td style={{ ...td, fontWeight: 700 }}>{v.cliente_nombre}</td>
                    <td style={td}>{v.marca}</td>
                    <td style={td}>{v.modelo}</td>
                    <td style={td}>{v.ano}</td>
                    <td style={td}>
                      <span style={{ background: "#1e3a5f", color: "#fff", padding: "3px 10px", borderRadius: 6, fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>
                        {v.placa}
                      </span>
                    </td>
                    <td style={{ ...td, fontSize: 12 }}>
                      {v.motor || "—"}
                      {v.cilindros ? <div style={{ fontSize: 10, color: "#64748b" }}>{v.cilindros} cil.</div> : null}
                    </td>
                    {/* Kilometraje: viene de vehiculos.km_actual, que el trigger
                        mantiene al día con la última lectura del odómetro. */}
                    <td style={{ ...td, fontSize: 12 }}>
                      {v.km_actual != null ? (
                        <>
                          <div style={{ fontWeight: 700 }}>{Number(v.km_actual).toLocaleString("es-DO")} km</div>
                          {v.km_actual_fecha && (
                            <div style={{ fontSize: 10, color: "#64748b" }}>
                              {new Date(v.km_actual_fecha).toLocaleDateString("es-DO")}
                            </div>
                          )}
                        </>
                      ) : <span style={{ color: "#94a3b8" }}>—</span>}
                    </td>
                    <td style={{ ...td, fontSize: 12 }}>
                      {v.cuartos_aceite ? (
                        <>
                          <div style={{ fontWeight: 700 }}>{v.cuartos_aceite} cuartos</div>
                          <div style={{ fontSize: 10, color: "#64748b" }}>
                            {v.viscosidad || "—"}
                            {v.spec_confianza === "VERIFICADO" ? " ✓" : ""}
                          </div>
                        </>
                      ) : <span style={{ color: "#94a3b8" }}>—</span>}
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {puedeEditar && (
                          <button onClick={() => abrirEdicion(v)}
                            style={{ padding: "6px 12px", background: "#dbeafe", color: "#1d4ed8", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                            ✏️ Editar
                          </button>
                        )}
                        {puedeEliminar && (
                          <button onClick={() => eliminarVehiculo(v.id, `${v.marca} ${v.modelo} (${v.placa})`)}
                            style={{ padding: "6px 12px", background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                            🗑️ Borrar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── MODAL EDITAR VEHÍCULO ── */}
      {editVehiculo && puedeEditar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 480, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 18 }}>✏️ Editar: {editVehiculo.marca} {editVehiculo.modelo} — {editVehiculo.placa}</h3>

            <label style={label}>Cliente</label>
            <select value={editForm.cliente_id} onChange={e => setEditForm(f => ({ ...f, cliente_id: e.target.value }))} style={input}>
              <option value="">— Sin cliente —</option>
              {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>

            <label style={label}>Marca</label>
            <select value={editForm.marca} onChange={e => setEditForm(f => ({ ...f, marca: e.target.value, modelo: "" }))} style={input}>
              <option value="">— Seleccionar —</option>
              {Object.keys(catalogo).map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            <label style={label}>Modelo</label>
            <select value={editForm.modelo} onChange={e => setEditForm(f => ({ ...f, modelo: e.target.value }))} style={input}
              disabled={!editForm.marca}>
              <option value="">— Seleccionar —</option>
              {(catalogo[editForm.marca] || []).map((m: string) => <option key={m} value={m}>{m}</option>)}
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={label}>Año</label>
                <select value={editForm.ano} onChange={e => setEditForm(f => ({ ...f, ano: e.target.value }))} style={{ ...input, marginBottom: 0 }}>
                  {Array.from({ length: 36 }, (_, i) => 2025 - i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Color</label>
                <input value={editForm.color} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))} style={{ ...input, marginBottom: 0 }} placeholder="Color" />
              </div>
            </div>

            <label style={{ ...label, marginTop: 12 }}>Placa</label>
            <input value={editForm.placa} onChange={e => setEditForm(f => ({ ...f, placa: e.target.value.toUpperCase() }))} style={input} />

            <label style={label}>VIN</label>
            <input value={editForm.vin} onChange={e => setEditForm(f => ({ ...f, vin: e.target.value.toUpperCase() }))}
              placeholder="17 caracteres" maxLength={17}
              style={{ ...input, fontFamily: "monospace", letterSpacing: 1 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={label}>Motor</label>
                <input value={editForm.motor} onChange={e => setEditForm(f => ({ ...f, motor: e.target.value }))}
                  placeholder="Ej: 1.5L L4" style={{ ...input, marginBottom: 0 }} />
              </div>
              <div>
                <label style={label}>Combustible</label>
                <select value={editForm.combustible} onChange={e => setEditForm(f => ({ ...f, combustible: e.target.value }))}
                  style={{ ...input, marginBottom: 0 }}>
                  <option value="">—</option>
                  <option>Gasolina</option><option>Diesel</option>
                  <option>Eléctrico</option><option>Híbrido</option>
                  <option>Híbrido Enchufable</option><option>Gas Natural</option>
                </select>
              </div>
            </div>

            {/* ── Mantenimiento ─────────────────────────────────────────── */}
            <div style={{ borderTop: "1px solid #1e3a5f", marginTop: 14, paddingTop: 12 }}>
              <label style={{ ...label, color: "#93c5fd", marginBottom: 8 }}>🔧 Datos de mantenimiento</label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={label}>Cilindros</label>
                  <select value={editForm.cilindros}
                    onChange={e => setEditForm(f => ({ ...f, cilindros: e.target.value }))}
                    style={{ ...input, marginBottom: 0 }}>
                    <option value="">—</option>
                    <option value="3">3</option><option value="4">4</option>
                    <option value="5">5</option><option value="6">6 (V6)</option>
                    <option value="8">8 (V8)</option><option value="10">10</option>
                    <option value="12">12</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Tipo de aceite</label>
                  <select value={editForm.tipo_aceite}
                    onChange={e => setEditForm(f => ({ ...f, tipo_aceite: e.target.value }))}
                    style={{ ...input, marginBottom: 0 }}>
                    <option value="">—</option>
                    <option value="MINERAL">Mineral</option>
                    <option value="SEMISINTETICO">Semisintético</option>
                    <option value="SINTETICO">Sintético</option>
                  </select>
                </div>
              </div>

              <div style={{ height: 10 }} />
              <label style={label}>
                Kilometraje
                {editVehiculo?.km_actual != null && (
                  <span style={{ fontWeight: 400, color: "#93c5fd" }}>
                    {" "}— actual: <strong>{Number(editVehiculo.km_actual).toLocaleString("es-DO")} km</strong>
                    {editVehiculo.km_actual_fecha && ` (${new Date(editVehiculo.km_actual_fecha).toLocaleDateString("es-DO")})`}
                  </span>
                )}
              </label>
              <input type="number" min={0}
                placeholder={editVehiculo?.km_actual != null ? "Nueva lectura (dejar vacío si no cambió)" : "Ej: 87500"}
                value={editForm.km_actual}
                onChange={e => setEditForm(f => ({ ...f, km_actual: e.target.value }))}
                style={{ ...input, marginBottom: 0 }} />
              <p style={{ fontSize: 11, color: "#93c5fd", marginTop: 6, marginBottom: 0 }}>
                Agrega una lectura nueva al historial. No borra las anteriores.
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={guardarEdicion} disabled={savingEdit}
                style={{ ...btnPrimary, flex: 2, background: "#2563eb" }}>
                {savingEdit ? "Guardando..." : "💾 Guardar cambios"}
              </button>
              <button onClick={() => setEditVehiculo(null)}
                style={{ ...btnPrimary, flex: 1, background: "#6b7280" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const container: React.CSSProperties = { padding: "24px", background: "#f5f7fb", minHeight: "100vh" };
const title: React.CSSProperties = { fontSize: 28, fontWeight: "bold", marginBottom: 22 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px" };
const card: React.CSSProperties = { background: "#fff", padding: "22px", borderRadius: "15px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" };
const cardTitle: React.CSSProperties = { marginBottom: "16px", fontSize: 19, fontWeight: 700 };
const label: React.CSSProperties = { display: "block", fontSize: 14, fontWeight: 600, marginBottom: 5, color: "#444" };
const input: React.CSSProperties = { display: "block", marginBottom: "14px", padding: "13px", width: "100%", borderRadius: "8px", border: "1px solid #ddd", boxSizing: "border-box", fontSize: 15 };
const btnPrimary: React.CSSProperties = { padding: "14px", background: "#111827", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", width: "100%", fontWeight: 700, fontSize: 15 };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const th: React.CSSProperties = { textAlign: "left", padding: "12px 14px", background: "#f1f5f9", fontSize: 14, fontWeight: 700 };
const td: React.CSSProperties = { padding: "12px 14px", borderBottom: "1px solid #eee", fontSize: 14 };