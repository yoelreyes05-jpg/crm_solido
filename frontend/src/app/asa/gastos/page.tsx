"use client";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { usePermisos } from "@/lib/usePermisos";
import { auditHeaders } from "@/lib/audit";
import {
  S, dinero, km as fmtKm, fechaCorta, hoyRD, TIPOS_GASTO, tipoGasto, asaGet, asaEnviar,
} from "@/lib/asa";

// ─────────────────────────────────────────────────────────────────────────────
// 💰 ASA — GASTOS DE LA FLOTA
//
// Todo lo que se le mete a un vehículo entra por aquí. El tipo COMBUSTIBLE
// pide además galones y kilometraje: son los dos datos que hacen posible el
// rendimiento y el costo por kilómetro. Sin ellos el módulo solo suma dinero,
// que es lo que ya hace cualquier libreta.
// ─────────────────────────────────────────────────────────────────────────────

const vacio = {
  vehiculo_id: "", tipo: "COMBUSTIBLE", fecha: hoyRD(), descripcion: "",
  monto: "", galones: "", km: "", tanque_lleno: true,
  suplidor: "", ncf: "", metodo_pago: "EFECTIVO", empleado_id: "", notas: "",
};

// `useSearchParams` obliga a un límite de Suspense o `next build` falla al
// prerenderizar la ruta. El parámetro `?vehiculo=` es lo que hace que el botón
// "Registrar gasto" de la ficha llegue aquí con la unidad ya escogida.
export default function GastosASAPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#64748b" }}>Cargando…</div>}>
      <GastosASA />
    </Suspense>
  );
}

function GastosASA() {
  const { puedeVer, puedeCrear, puedeEliminar } = usePermisos("asa");
  const qs = useSearchParams();

  const [gastos, setGastos]       = useState<any[]>([]);
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [form, setForm]           = useState<any>(vacio);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando]   = useState(true);

  const hoy = hoyRD();
  const [desde, setDesde] = useState(hoy.slice(0, 8) + "01");
  const [hasta, setHasta] = useState(hoy);
  const [filtroVeh, setFiltroVeh]   = useState(qs?.get("vehiculo") || "");
  const [filtroTipo, setFiltroTipo] = useState("");

  const cargar = async () => {
    setCargando(true);
    try {
      const p = new URLSearchParams({ desde, hasta });
      if (filtroVeh) p.set("vehiculo_id", filtroVeh);
      if (filtroTipo) p.set("tipo", filtroTipo);
      const [g, v, e] = await Promise.all([
        asaGet<any>(`/gastos?${p.toString()}`),
        asaGet<any>("/vehiculos"),
        asaGet<any>("/empleados"),
      ]);
      setGastos(g.gastos || []);
      setVehiculos(v.vehiculos || []);
      setEmpleados(e.empleados || []);
    } catch { /* silencio: la pantalla muestra la lista vacía */ }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, [desde, hasta, filtroVeh, filtroTipo]);

  useEffect(() => {
    const v = qs?.get("vehiculo");
    if (v) setForm((f: any) => ({ ...f, vehiculo_id: v }));
  }, [qs]);

  // El precio por galón se calcula solo: es división, no un dato que alguien
  // deba teclear (y equivocarse).
  const precioGalon = useMemo(() => {
    const m = Number(form.monto || 0), g = Number(form.galones || 0);
    return g > 0 && m > 0 ? Math.round((m / g) * 100) / 100 : null;
  }, [form.monto, form.galones]);

  const esCombustible = form.tipo === "COMBUSTIBLE";

  const guardar = async () => {
    if (!form.vehiculo_id) return alert("Escoge el vehículo.");
    if (!form.monto) return alert("Falta el monto.");
    setGuardando(true);
    try {
      await asaEnviar("/gastos", "POST", {
        vehiculo_id: Number(form.vehiculo_id),
        empleado_id: form.empleado_id === "" ? null : Number(form.empleado_id),
        tipo: form.tipo, fecha: form.fecha,
        descripcion: form.descripcion || null,
        monto: Number(form.monto),
        galones: form.galones === "" ? null : Number(form.galones),
        precio_galon: precioGalon,
        km: form.km === "" ? null : Number(form.km),
        tanque_lleno: !!form.tanque_lleno,
        suplidor: form.suplidor || null,
        ncf: form.ncf || null,
        metodo_pago: form.metodo_pago,
        notas: form.notas || null,
      }, auditHeaders());
      setForm({ ...vacio, vehiculo_id: form.vehiculo_id, tipo: form.tipo });
      cargar();
    } catch (e: any) { alert(e.message); }
    finally { setGuardando(false); }
  };

  const borrar = async (id: number) => {
    if (!confirm("¿Borrar este gasto? Cambia los totales y el costo por km.")) return;
    try { await asaEnviar(`/gastos/${id}`, "DELETE", undefined, auditHeaders()); cargar(); }
    catch (e: any) { alert(e.message); }
  };

  const total = gastos.reduce((s, g) => s + Number(g.monto || 0), 0);
  const galones = gastos.reduce((s, g) => s + Number(g.galones || 0), 0);
  const nombreVeh = (id: number) => {
    const v = vehiculos.find(x => x.id === id);
    return v ? `${v.codigo} · ${v.placa}` : `#${id}`;
  };

  if (!puedeVer) return <div style={{ padding: 40 }}>No tienes acceso al módulo ASA.</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1500 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>💰 Gastos de la flota</h1>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 2 }}>
            {gastos.length} movimientos · {dinero(total)} · {galones.toFixed(1)} galones
          </div>
        </div>
        <Link href="/asa" style={{ ...S.btnGhost, textDecoration: "none", padding: "10px 14px" }}>← Tablero</Link>
      </div>

      {/* Registro */}
      {puedeCrear && (
        <div style={S.card}>
          <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 14 }}>Registrar gasto</div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
            {TIPOS_GASTO.map(t => (
              <button key={t.codigo} onClick={() => setForm({ ...form, tipo: t.codigo })} style={{
                padding: "9px 13px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700,
                border: `1px solid ${form.tipo === t.codigo ? t.color : "#e2e8f0"}`,
                background: form.tipo === t.codigo ? t.color + "1a" : "#fff",
                color: form.tipo === t.codigo ? t.color : "#475569",
              }}>{t.icono} {t.label}</button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
            <div>
              <label style={S.label}>Vehículo *</label>
              <select value={form.vehiculo_id} onChange={e => setForm({ ...form, vehiculo_id: e.target.value })} style={S.input}>
                <option value="">— escoger —</option>
                {vehiculos.map(v => <option key={v.id} value={v.id}>{v.codigo} · {v.placa}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={S.input} /></div>
            <div><label style={S.label}>Monto *</label>
              <input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} style={S.input} /></div>

            {esCombustible && (
              <>
                <div><label style={S.label}>Galones</label>
                  <input type="number" step="0.01" value={form.galones}
                         onChange={e => setForm({ ...form, galones: e.target.value })} style={S.input} /></div>
                <div><label style={S.label}>Kilometraje al tanquear</label>
                  <input type="number" value={form.km} onChange={e => setForm({ ...form, km: e.target.value })} style={S.input} /></div>
                <div>
                  <label style={S.label}>Precio por galón</label>
                  <div style={{ ...S.input, background: "#f1f5f9", fontWeight: 800, color: "#0f766e" }}>
                    {precioGalon != null ? dinero(precioGalon) : "—"}
                  </div>
                </div>
              </>
            )}

            <div>
              <label style={S.label}>Conductor</label>
              <select value={form.empleado_id} onChange={e => setForm({ ...form, empleado_id: e.target.value })} style={S.input}>
                <option value="">— ninguno —</option>
                {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Suplidor</label>
              <input value={form.suplidor} onChange={e => setForm({ ...form, suplidor: e.target.value })} style={S.input} /></div>
            <div><label style={S.label}>NCF</label>
              <input value={form.ncf} onChange={e => setForm({ ...form, ncf: e.target.value })} style={S.input} /></div>
            <div>
              <label style={S.label}>Pago</label>
              <select value={form.metodo_pago} onChange={e => setForm({ ...form, metodo_pago: e.target.value })} style={S.input}>
                {["EFECTIVO", "TARJETA", "TRANSFERENCIA", "CREDITO", "CHEQUE"].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={S.label}>Descripción</label>
              <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} style={S.input} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
            {esCombustible && (
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" checked={!!form.tanque_lleno}
                       onChange={e => setForm({ ...form, tanque_lleno: e.target.checked })} />
                Tanque lleno
                <span style={{ color: "#94a3b8", fontWeight: 400 }}>
                  (solo los tanqueos llenos entran al cálculo de km/galón)
                </span>
              </label>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={guardar} disabled={guardando} style={S.btn}>
              {guardando ? "Guardando…" : "Registrar gasto"}
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ ...S.card, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div><label style={S.label}>Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ ...S.input, width: 150 }} /></div>
        <div><label style={S.label}>Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ ...S.input, width: 150 }} /></div>
        <div><label style={S.label}>Vehículo</label>
          <select value={filtroVeh} onChange={e => setFiltroVeh(e.target.value)} style={{ ...S.input, width: 200 }}>
            <option value="">Todos</option>
            {vehiculos.map(v => <option key={v.id} value={v.id}>{v.codigo} · {v.placa}</option>)}
          </select></div>
        <div><label style={S.label}>Tipo</label>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ ...S.input, width: 180 }}>
            <option value="">Todos</option>
            {TIPOS_GASTO.map(t => <option key={t.codigo} value={t.codigo}>{t.label}</option>)}
          </select></div>
      </div>

      {/* Lista */}
      <div style={S.card}>
        {cargando ? <div style={{ color: "#64748b" }}>Cargando…</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={S.th}>Fecha</th><th style={S.th}>Vehículo</th><th style={S.th}>Tipo</th>
                <th style={S.th}>Descripción</th><th style={S.th}>Km</th><th style={S.th}>Galones</th>
                <th style={S.th}>RD$/gal</th><th style={S.th}>Suplidor</th><th style={S.th}>Monto</th><th style={S.th}></th>
              </tr></thead>
              <tbody>
                {gastos.map(g => {
                  const t = tipoGasto(g.tipo);
                  return (
                    <tr key={g.id}>
                      <td style={S.td}>{fechaCorta(g.fecha)}</td>
                      <td style={S.td}>{nombreVeh(g.vehiculo_id)}</td>
                      <td style={S.td}><span style={S.chip(t.color)}>{t.icono} {t.label}</span></td>
                      <td style={S.td}>{g.descripcion || "—"}</td>
                      <td style={S.td}>{g.km != null ? fmtKm(g.km) : "—"}</td>
                      <td style={S.td}>{g.galones ?? "—"}</td>
                      <td style={S.td}>{g.precio_galon != null ? dinero(g.precio_galon) : "—"}</td>
                      <td style={S.td}>{g.suplidor || "—"}</td>
                      <td style={{ ...S.td, fontWeight: 800 }}>{dinero(g.monto)}</td>
                      <td style={S.td}>
                        {puedeEliminar && <button onClick={() => borrar(g.id)} style={{ ...S.btnGhost, color: "#dc2626" }}>×</button>}
                      </td>
                    </tr>
                  );
                })}
                {!gastos.length && <tr><td style={S.td} colSpan={10}>Sin gastos en este rango.</td></tr>}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ ...S.td, fontWeight: 900 }} colSpan={5}>Total</td>
                  <td style={{ ...S.td, fontWeight: 900 }}>{galones.toFixed(1)}</td>
                  <td style={S.td}></td><td style={S.td}></td>
                  <td style={{ ...S.td, fontWeight: 900, fontSize: 15 }}>{dinero(total)}</td>
                  <td style={S.td}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
