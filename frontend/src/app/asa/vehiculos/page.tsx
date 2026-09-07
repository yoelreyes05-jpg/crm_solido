"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { usePermisos } from "@/lib/usePermisos";
import { auditHeaders } from "@/lib/audit";
import {
  S, dinero, km as fmtKm, fechaCorta, COLOR_ESTADO_VEH, asaGet, asaEnviar,
} from "@/lib/asa";

// ─────────────────────────────────────────────────────────────────────────────
// 🚗 ASA — VEHÍCULOS DE LA FLOTA
//
// Alta, edición y asignación de conductor.
//
// `km_inicial` es el único campo con truco: es el odómetro con el que la
// unidad entró a la flota, y es la línea base contra la que se cuentan los
// kilómetros recorridos y el costo por km. Ponerlo mal (ej. en 0 con una
// camioneta de 180,000 km) infla el recorrido y deja el costo por km en
// centavos, que es peor que no tener el dato.
// ─────────────────────────────────────────────────────────────────────────────

const TIPOS = ["AUTO", "CAMIONETA", "JEEPETA", "CAMION", "MINIBUS", "AUTOBUS", "MOTOR", "FURGONETA", "OTRO"];
const COMBUSTIBLES = ["GASOLINA", "GASOIL", "GLP", "GNV", "HIBRIDO", "ELECTRICO"];
const ESTADOS = ["ACTIVO", "EN_TALLER", "FUERA_SERVICIO", "VENDIDO"];

const vacio = {
  codigo: "", placa: "", marca: "", modelo: "", anio: "", color: "", chasis: "",
  tipo: "CAMIONETA", combustible: "GASOLINA", capacidad_tanque: "",
  km_inicial: "", km_actual: "", conductor_id: "", departamento: "",
  estado: "ACTIVO", requiere_chequeo: true, requiere_fotos: true,
  fecha_adquisicion: "", costo_adquisicion: "", notas: "",
};

export default function VehiculosASAPage() {
  const { puedeVer, puedeCrear, puedeEditar, puedeEliminar } = usePermisos("asa");

  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [conductores, setConductores] = useState<any[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [busqueda, setBusqueda]   = useState("");
  const [form, setForm]           = useState<any>(vacio);
  const [editId, setEditId]       = useState<number | null>(null);
  const [abierto, setAbierto]     = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [asignando, setAsignando] = useState<any>(null);

  const cargar = async () => {
    setCargando(true);
    try {
      const [v, e] = await Promise.all([
        asaGet<any>("/vehiculos"),
        asaGet<any>("/conductores"),
      ]);
      setVehiculos(v.vehiculos || []);
      setConductores(e.conductores || []);
    } catch { /* la tabla queda vacía y el aviso lo da el dashboard */ }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return vehiculos;
    return vehiculos.filter(v =>
      `${v.codigo} ${v.placa} ${v.marca} ${v.modelo} ${v.asa_flota_conductores?.nombre || ""}`.toLowerCase().includes(q));
  }, [vehiculos, busqueda]);

  const abrirNuevo = () => { setForm(vacio); setEditId(null); setAbierto(true); };

  const abrirEdicion = (v: any) => {
    setForm({
      ...vacio, ...v,
      anio: v.anio ?? "", capacidad_tanque: v.capacidad_tanque ?? "",
      km_inicial: v.km_inicial ?? "", km_actual: v.km_actual ?? "",
      conductor_id: v.conductor_id ?? "", costo_adquisicion: v.costo_adquisicion ?? "",
      fecha_adquisicion: v.fecha_adquisicion ?? "",
    });
    setEditId(v.id);
    setAbierto(true);
  };

  const guardar = async () => {
    if (!form.codigo.trim() || !form.placa.trim())
      return alert("El código y la placa son obligatorios.");
    setGuardando(true);
    try {
      const cuerpo: any = {
        ...form,
        anio: form.anio === "" ? null : Number(form.anio),
        capacidad_tanque: form.capacidad_tanque === "" ? null : Number(form.capacidad_tanque),
        km_inicial: form.km_inicial === "" ? null : Number(form.km_inicial),
        km_actual: form.km_actual === "" ? 0 : Number(form.km_actual),
        conductor_id: form.conductor_id === "" ? null : Number(form.conductor_id),
        costo_adquisicion: form.costo_adquisicion === "" ? null : Number(form.costo_adquisicion),
        fecha_adquisicion: form.fecha_adquisicion || null,
      };
      delete cuerpo.asa_flota_conductores; delete cuerpo.resumen;
      if (editId) await asaEnviar(`/vehiculos/${editId}`, "PATCH", cuerpo, auditHeaders());
      else await asaEnviar("/vehiculos", "POST", cuerpo, auditHeaders());
      setAbierto(false);
      cargar();
    } catch (e: any) { alert(e.message); }
    finally { setGuardando(false); }
  };

  const eliminar = async (v: any) => {
    if (!confirm(`¿Sacar ${v.codigo} (${v.placa}) de la flota?\n\nNo se borra nada: el historial de chequeos y gastos queda guardado, la unidad solo deja de aparecer.`)) return;
    try { await asaEnviar(`/vehiculos/${v.id}`, "DELETE", undefined, auditHeaders()); cargar(); }
    catch (e: any) { alert(e.message); }
  };

  const asignar = async (conductor_id: number, km_entrega: string) => {
    try {
      await asaEnviar("/asignaciones", "POST", {
        vehiculo_id: asignando.id, conductor_id,
        km_entrega: km_entrega === "" ? null : Number(km_entrega),
      }, auditHeaders());
      setAsignando(null);
      cargar();
    } catch (e: any) { alert(e.message); }
  };

  if (!puedeVer) return <div style={{ padding: 40 }}>No tienes acceso al módulo ASA.</div>;

  const campo = (label: string, key: string, tipo = "text", opciones?: string[]) => (
    <div>
      <label style={S.label}>{label}</label>
      {opciones ? (
        <select value={form[key] ?? ""} onChange={e => setForm({ ...form, [key]: e.target.value })} style={S.input}>
          {opciones.map(o => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
        </select>
      ) : (
        <input type={tipo} value={form[key] ?? ""} onChange={e => setForm({ ...form, [key]: e.target.value })} style={S.input} />
      )}
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1500 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>🚗 Vehículos de la flota</h1>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 2 }}>{vehiculos.length} unidades registradas</div>
        </div>
        <input placeholder="Buscar por código, placa, marca o conductor…" value={busqueda}
               onChange={e => setBusqueda(e.target.value)} style={{ ...S.input, width: 320 }} />
        <Link href="/asa" style={{ ...S.btnGhost, textDecoration: "none", padding: "10px 14px" }}>← Tablero</Link>
        {puedeCrear && <button onClick={abrirNuevo} style={S.btn}>+ Agregar vehículo</button>}
      </div>

      {cargando ? <div style={{ color: "#64748b" }}>Cargando…</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(330px,1fr))", gap: 14 }}>
          {visibles.map(v => {
            const r = v.resumen || {};
            return (
              <div key={v.id} style={{ ...S.card, marginBottom: 0, padding: 0, overflow: "hidden" }}>
                <div style={{
                  padding: "14px 16px", borderBottom: "1px solid #f1f5f9",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 11, background: "#f1f5f9",
                    display: "grid", placeItems: "center", fontSize: 22, flexShrink: 0,
                  }}>{v.tipo === "MOTOR" ? "🏍️" : v.tipo === "CAMION" ? "🚛" : v.tipo === "AUTOBUS" || v.tipo === "MINIBUS" ? "🚐" : "🚙"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/asa/vehiculos/${v.id}`} style={{ fontWeight: 900, fontSize: 16, color: "#0f172a", textDecoration: "none" }}>
                      {v.codigo}
                    </Link>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {v.placa} · {[v.marca, v.modelo, v.anio].filter(Boolean).join(" ")}
                    </div>
                  </div>
                  <span style={S.chip(COLOR_ESTADO_VEH[v.estado] || "#64748b")}>{v.estado.replace("_", " ")}</span>
                </div>

                <div style={{ padding: "12px 16px", display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#64748b" }}>Conductor</span>
                    <b>{v.asa_flota_conductores?.nombre || <span style={{ color: "#cbd5e1" }}>sin asignar</span>}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#64748b" }}>Kilometraje</span>
                    <b>{fmtKm(v.km_actual)}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#64748b" }}>Gastado</span>
                    <b>{dinero(r.total_gastado)}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#64748b" }}>Costo por km</span>
                    <b style={{ color: "#7c3aed" }}>{r.costo_por_km != null ? dinero(r.costo_por_km) : "—"}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#64748b" }}>Último parte</span>
                    <b>{fechaCorta(r.ultimo_chequeo)}</b>
                  </div>
                  {r.fallas_abiertas > 0 && (
                    <div style={{ marginTop: 2 }}>
                      <span style={S.chip("#dc2626")}>🔧 {r.fallas_abiertas} falla(s) abierta(s)</span>
                    </div>
                  )}
                </div>

                <div style={{ padding: "10px 16px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={`/asa/vehiculos/${v.id}`} style={{ ...S.btnGhost, textDecoration: "none" }}>Ver ficha</Link>
                  {puedeEditar && <button onClick={() => abrirEdicion(v)} style={S.btnGhost}>Editar</button>}
                  {puedeEditar && <button onClick={() => setAsignando(v)} style={S.btnGhost}>Asignar</button>}
                  {puedeEliminar && <button onClick={() => eliminar(v)} style={{ ...S.btnGhost, color: "#dc2626" }}>Sacar</button>}
                </div>
              </div>
            );
          })}
          {!visibles.length && (
            <div style={{ ...S.card, gridColumn: "1/-1", textAlign: "center", color: "#64748b" }}>
              No hay vehículos todavía. Agrega el primero con el botón de arriba.
            </div>
          )}
        </div>
      )}

      {/* Alta / edición */}
      {abierto && (
        <div onClick={() => setAbierto(false)} style={{
          position: "fixed", inset: 0, background: "#0f172a99", zIndex: 200,
          display: "grid", placeItems: "center", padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 16, padding: 24, width: "100%",
            maxWidth: 760, maxHeight: "90vh", overflowY: "auto",
          }}>
            <h2 style={{ marginTop: 0, fontSize: 19 }}>{editId ? "Editar vehículo" : "Nuevo vehículo"}</h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
              {campo("Código *", "codigo")}
              {campo("Placa *", "placa")}
              {campo("Marca", "marca")}
              {campo("Modelo", "modelo")}
              {campo("Año", "anio", "number")}
              {campo("Color", "color")}
              {campo("Tipo", "tipo", "text", TIPOS)}
              {campo("Combustible", "combustible", "text", COMBUSTIBLES)}
              {campo("Capacidad del tanque (gal)", "capacidad_tanque", "number")}
              {campo("Chasis", "chasis")}
              {campo("Estado", "estado", "text", ESTADOS)}
              {campo("Departamento", "departamento")}
              <div>
                <label style={S.label}>Conductor asignado</label>
                <select value={form.conductor_id ?? ""} onChange={e => setForm({ ...form, conductor_id: e.target.value })} style={S.input}>
                  <option value="">— sin asignar —</option>
                  {conductores.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              {campo("Km al entrar a la flota", "km_inicial", "number")}
              {campo("Km actual", "km_actual", "number")}
              {campo("Fecha de adquisición", "fecha_adquisicion", "date")}
              {campo("Costo de adquisición", "costo_adquisicion", "number")}
            </div>

            <div style={{
              marginTop: 12, padding: 12, background: "#f8fafc", borderRadius: 10,
              fontSize: 12, color: "#475569", lineHeight: 1.5,
            }}>
              <b>Km al entrar a la flota</b> es la línea base del costo por kilómetro. Si la unidad
              ya venía usada, pon aquí el odómetro del día que entró — no cero.
            </div>

            <div style={{ display: "flex", gap: 18, marginTop: 14, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" checked={!!form.requiere_chequeo}
                       onChange={e => setForm({ ...form, requiere_chequeo: e.target.checked })} />
                Exigir parte diario
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" checked={!!form.requiere_fotos}
                       onChange={e => setForm({ ...form, requiere_fotos: e.target.checked })} />
                Exigir fotos
              </label>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={S.label}>Notas</label>
              <textarea value={form.notas ?? ""} onChange={e => setForm({ ...form, notas: e.target.value })}
                        style={{ ...S.input, minHeight: 70, resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setAbierto(false)} style={S.btnGhost}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={S.btn}>
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asignación */}
      {asignando && (
        <ModalAsignar vehiculo={asignando} conductores={conductores}
                      onCerrar={() => setAsignando(null)} onAsignar={asignar} />
      )}
    </div>
  );
}

function ModalAsignar({ vehiculo, conductores, onCerrar, onAsignar }: any) {
  const [conductorId, setConductorId] = useState<string>("");
  const [kmEntrega, setKmEntrega]   = useState<string>(String(Math.round(Number(vehiculo.km_actual || 0))));

  return (
    <div onClick={onCerrar} style={{
      position: "fixed", inset: 0, background: "#0f172a99", zIndex: 200,
      display: "grid", placeItems: "center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Asignar {vehiculo.codigo}</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 0 }}>
          Se cierra la asignación anterior con el kilometraje de entrega, y queda el registro de
          quién tenía la unidad hasta hoy.
        </p>

        <label style={S.label}>Conductor</label>
        <select value={conductorId} onChange={e => setConductorId(e.target.value)} style={S.input}>
          <option value="">— escoger —</option>
          {conductores.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>

        <div style={{ marginTop: 12 }}>
          <label style={S.label}>Kilometraje de entrega</label>
          <input type="number" value={kmEntrega} onChange={e => setKmEntrega(e.target.value)} style={S.input} />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button onClick={onCerrar} style={S.btnGhost}>Cancelar</button>
          <button onClick={() => conductorId ? onAsignar(Number(conductorId), kmEntrega) : alert("Escoge un conductor.")}
                  style={S.btn}>Asignar</button>
        </div>
      </div>
    </div>
  );
}
