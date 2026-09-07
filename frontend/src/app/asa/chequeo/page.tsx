"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  API_ASA, NIVELES, ANGULOS, nivelCombustible, comprimirImagen, hoyRD,
} from "@/lib/asa";
import InstalarApp from "./InstalarApp";

// ─────────────────────────────────────────────────────────────────────────────
// 🚚 ASA — CHEQUEO DIARIO DEL CONDUCTOR
//
// Pantalla de celular, sin login. El conductor abre el enlace, toca su nombre
// y llena el parte del día.
//
// REGLA: no se escribe nada. El único teclado de toda la pantalla es el
// numérico del odómetro, y sale con el número del día anterior ya puesto para
// que solo cambie lo que hizo falta. El combustible se mueve con flechas, el
// checklist arranca todo en verde y solo se toca lo que está mal, y las
// fallas se escogen de una lista.
//
// El motivo no es estético. Un parte que exige escribir en un celular, de
// pie, con las manos sucias, a las siete de la mañana, se llena mal o no se
// llena — y entonces no hay datos de nada.
//
// Es ruta pública (ver RUTAS_PUBLICAS en app/layout.tsx): darle cuenta del
// CRM a cada conductor sería darle acceso a facturación y clientes para que
// reporte una goma baja.
// ─────────────────────────────────────────────────────────────────────────────

type Conductor = { id: number; nombre: string; cargo?: string; color?: string };
type Vehiculo = {
  id: number; codigo: string; placa: string; marca?: string; modelo?: string;
  anio?: number; color?: string; tipo?: string; km_actual?: number;
  conductor_id?: number | null; estado?: string; requiere_fotos?: boolean;
};
type Item = { codigo: string; categoria: string; etiqueta: string; icono?: string; critico?: boolean };
type Falla = {
  codigo: string; categoria: string; etiqueta: string; icono?: string;
  severidad: string; detiene_vehiculo?: boolean;
};

const BORRADOR = "asa_chequeo_borrador";

const C = {
  fondo: "#0b1220",
  panel: "#131c2e",
  panel2: "#1b2740",
  borde: "#26344f",
  texto: "#e8eefc",
  suave: "#8ea3c7",
  azul: "#3b82f6",
  verde: "#16a34a",
  rojo: "#dc2626",
  ambar: "#f59e0b",
};

export default function ChequeoASAPage() {
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [checklist, setChecklist] = useState<Item[]>([]);
  const [catFallas, setCatFallas] = useState<Falla[]>([]);
  const [chequeosHoy, setChequeosHoy] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({});

  // ── Lo que el conductor va llenando ────────────────────────────────────────
  const [paso, setPaso]         = useState(0);
  const [conductor, setConductor] = useState<Conductor | null>(null);
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [turno, setTurno]       = useState<"SALIDA" | "ENTRADA">("SALIDA");
  const [kmTexto, setKmTexto]   = useState("");
  const [kmSugerido, setKmSug]  = useState(0);
  const [octavos, setOctavos]   = useState(4);
  // codigo -> "BIEN" | "MAL" | "NA". Lo que no está aquí, está bien.
  const [marcas, setMarcas]     = useState<Record<string, "MAL" | "NA">>({});
  const [fallas, setFallas]     = useState<string[]>([]);
  const [fotos, setFotos]       = useState<Record<string, string>>({});
  const [fallasAbiertas, setFallasAbiertas] = useState<any[]>([]);

  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_ASA}/publico/arranque`);
        const d = await r.json();
        if (d.error) throw new Error(d.mensaje);
        setConductores(d.conductores || []);
        setVehiculos(d.vehiculos || []);
        setChecklist(d.checklist || []);
        setCatFallas(d.fallas || []);
        setChequeosHoy(d.chequeos_hoy || []);
        setConfig(d.config || {});
      } catch (e: any) {
        setError(e.message || "No se pudo conectar. Revisa la señal e intenta de nuevo.");
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  // ── Borrador ───────────────────────────────────────────────────────────────
  // Un parte a medio llenar que se pierde porque entró una llamada o se fue la
  // señal es la forma más rápida de que el conductor deje de usar la pantalla.
  useEffect(() => {
    try {
      const crudo = localStorage.getItem(BORRADOR);
      if (!crudo) return;
      const b = JSON.parse(crudo);
      if (b.fecha !== hoyRD()) { localStorage.removeItem(BORRADOR); return; }
      if (b.marcas) setMarcas(b.marcas);
      if (b.fallas) setFallas(b.fallas);
      if (b.kmTexto) setKmTexto(b.kmTexto);
      if (typeof b.octavos === "number") setOctavos(b.octavos);
      if (b.turno) setTurno(b.turno);
    } catch { /* borrador ilegible: se ignora */ }
  }, []);

  useEffect(() => {
    if (!conductor && !vehiculo) return;
    try {
      localStorage.setItem(BORRADOR, JSON.stringify({
        fecha: hoyRD(), marcas, fallas, kmTexto, octavos, turno,
        conductor_id: conductor?.id, vehiculo_id: vehiculo?.id,
      }));
    } catch { /* modo privado: seguimos sin borrador */ }
  }, [marcas, fallas, kmTexto, octavos, turno, conductor, vehiculo]);

  // ── Al escoger vehículo, traer su último estado ────────────────────────────
  const escogerVehiculo = async (v: Vehiculo) => {
    setVehiculo(v);
    setPaso(2);
    try {
      const d = await fetch(`${API_ASA}/publico/vehiculo/${v.id}/estado`).then(r => r.json());
      setKmSug(Number(d.km_sugerido || 0));
      setKmTexto(String(Math.round(Number(d.km_sugerido || 0))));
      setOctavos(Number(d.combustible_anterior ?? 4));
      setFallasAbiertas(d.fallas_abiertas || []);
    } catch { /* sin señal: sigue con lo que ya tenía en pantalla */ }
  };

  const angulosPedidos = useMemo(() => {
    const req: string[] = Array.isArray(config.angulos_requeridos)
      ? config.angulos_requeridos
      : ["FRONTAL", "TRASERA", "LATERAL_IZQ", "LATERAL_DER", "TABLERO"];
    return ANGULOS.filter(a => req.includes(a.codigo));
  }, [config]);

  const itemsPorCategoria = useMemo(() => {
    const m: Record<string, Item[]> = {};
    for (const i of checklist) (m[i.categoria] ||= []).push(i);
    return m;
  }, [checklist]);

  const fallasPorCategoria = useMemo(() => {
    const m: Record<string, Falla[]> = {};
    for (const f of catFallas) (m[f.categoria] ||= []).push(f);
    return m;
  }, [catFallas]);

  const conMarca = (codigo: string) => marcas[codigo];

  /** Un toque cicla BIEN → MAL → N/A → BIEN. Sin menús ni diálogos. */
  const tocarItem = (codigo: string) => {
    setMarcas(prev => {
      const actual = prev[codigo];
      const sig = { ...prev };
      if (!actual) sig[codigo] = "MAL";
      else if (actual === "MAL") sig[codigo] = "NA";
      else delete sig[codigo];
      return sig;
    });
  };

  const tocarFalla = (codigo: string) =>
    setFallas(prev => prev.includes(codigo) ? prev.filter(c => c !== codigo) : [...prev, codigo]);

  const tomarFoto = async (angulo: string, archivo?: File | null) => {
    if (!archivo) return;
    try {
      const dataUrl = await comprimirImagen(archivo);
      setFotos(prev => ({ ...prev, [angulo]: dataUrl }));
    } catch (e: any) {
      alert(e.message || "No se pudo procesar la foto.");
    }
  };

  const itemsMalos = Object.entries(marcas).filter(([, v]) => v === "MAL");
  const hayCritico = itemsMalos.some(([c]) => checklist.find(i => i.codigo === c)?.critico);
  const fallaDetiene = fallas.some(c => catFallas.find(f => f.codigo === c)?.detiene_vehiculo);
  const kmNum = Number(kmTexto || 0);
  const kmMenor = kmSugerido > 0 && kmNum > 0 && kmNum < kmSugerido;
  const fotosFaltan = angulosPedidos.filter(a => !fotos[a.codigo]);

  const yaReportado = useMemo(
    () => chequeosHoy.find(c => c.vehiculo_id === vehiculo?.id && c.turno === turno),
    [chequeosHoy, vehiculo, turno]
  );

  // ── Guardar ────────────────────────────────────────────────────────────────
  const guardar = async () => {
    if (!conductor || !vehiculo) return;
    setGuardando(true);
    try {
      const cuerpo = {
        vehiculo_id: vehiculo.id,
        conductor_id: conductor.id,
        turno,
        km: kmTexto === "" ? null : kmNum,
        combustible_octavos: octavos,
        items_mal: Object.entries(marcas).map(([codigo, valor]) => ({ codigo, valor })),
        fallas,
        fotos: Object.entries(fotos).map(([angulo, dataUrl]) => ({ angulo, dataUrl })),
      };
      const r = await fetch(`${API_ASA}/publico/chequeo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.mensaje || "No se pudo guardar.");
      setResultado(d);
      setPaso(7);
      try { localStorage.removeItem(BORRADOR); } catch {}
    } catch (e: any) {
      alert(e.message || "No se pudo guardar. Revisa la señal e intenta otra vez.");
    } finally {
      setGuardando(false);
    }
  };

  const reiniciar = () => {
    setPaso(0); setConductor(null); setVehiculo(null); setTurno("SALIDA");
    setKmTexto(""); setKmSug(0); setOctavos(4); setMarcas({}); setFallas([]);
    setFotos({}); setResultado(null); setFallasAbiertas([]);
  };

  // ── Presentación ───────────────────────────────────────────────────────────

  const Cabecera = ({ titulo, sub }: { titulo: string; sub?: string }) => (
    <div style={{ padding: "18px 18px 8px" }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: C.texto, letterSpacing: -0.3 }}>{titulo}</div>
      {sub && <div style={{ fontSize: 14, color: C.suave, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const Barra = () => {
    const pasos = ["Tú", "Vehículo", "Km", "Combustible", "Revisión", "Fallas", "Fotos"];
    return (
      <div style={{ display: "flex", gap: 4, padding: "10px 18px 0" }}>
        {pasos.map((p, i) => (
          <div key={p} style={{
            flex: 1, height: 4, borderRadius: 99,
            background: i <= paso ? C.azul : C.borde,
            transition: "background .2s",
          }} />
        ))}
      </div>
    );
  };

  const BotonGrande = ({ children, onClick, color = C.azul, disabled = false }: any) => (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: "16px 18px", borderRadius: 14, border: "none",
      background: disabled ? "#334155" : color, color: "#fff",
      fontSize: 17, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer",
      boxShadow: disabled ? "none" : `0 6px 18px ${color}55`,
    }}>{children}</button>
  );

  const Pie = ({ children }: any) => (
    <div style={{
      position: "sticky", bottom: 0, padding: 16, background: `linear-gradient(0deg, ${C.fondo} 70%, transparent)`,
      display: "flex", gap: 10,
    }}>{children}</div>
  );

  const Atras = () => (
    <button onClick={() => setPaso(p => Math.max(0, p - 1))} style={{
      padding: "16px 20px", borderRadius: 14, border: `1px solid ${C.borde}`,
      background: C.panel, color: C.suave, fontSize: 16, fontWeight: 800, cursor: "pointer",
    }}>◀</button>
  );

  if (cargando) return (
    <div style={{ minHeight: "100vh", background: C.fondo, color: C.suave, display: "grid", placeItems: "center", fontSize: 16 }}>
      Cargando…
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: C.fondo, color: C.texto, display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div>
        <div style={{ fontSize: 44, marginBottom: 12 }}>📡</div>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Sin conexión</div>
        <div style={{ color: C.suave, marginBottom: 20 }}>{error}</div>
        <BotonGrande onClick={() => location.reload()}>Reintentar</BotonGrande>
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh", background: C.fondo, color: C.texto,
      fontFamily: "system-ui, -apple-system, Arial, sans-serif",
      maxWidth: 560, margin: "0 auto", paddingBottom: 8,
    }}>
      {/* Marca */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "14px 18px",
        borderBottom: `1px solid ${C.borde}`,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: "linear-gradient(145deg,#1d4ed8,#3b82f6)",
          display: "grid", placeItems: "center", fontSize: 18,
        }}>🚚</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: 1 }}>ASA · CHEQUEO DIARIO</div>
          <div style={{ fontSize: 11, color: C.suave }}>{new Date().toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
        {conductor && (
          <button onClick={reiniciar} style={{
            background: "transparent", border: `1px solid ${C.borde}`, color: C.suave,
            borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>Salir</button>
        )}
      </div>

      {paso < 7 && <Barra />}

      {/* Se ofrece solo al entrar. En medio del parte seria una interrupcion. */}
      {paso === 0 && <InstalarApp />}

      {/* ── PASO 0 · ¿Quién eres? ───────────────────────────────────────────── */}
      {paso === 0 && (
        <>
          <Cabecera titulo="¿Quién eres?" sub="Toca tu nombre" />
          <div style={{ padding: "0 18px", display: "grid", gap: 10 }}>
            {conductores.length === 0 && (
              <div style={{ color: C.suave, padding: 20, textAlign: "center" }}>
                No hay conductores registrados todavía. Avisa al encargado.
              </div>
            )}
            {conductores.map(e => (
              <button key={e.id} onClick={() => { setConductor(e); setPaso(1); }} style={{
                display: "flex", alignItems: "center", gap: 14, width: "100%",
                padding: "16px 18px", borderRadius: 14, border: `1px solid ${C.borde}`,
                background: C.panel, color: C.texto, cursor: "pointer", textAlign: "left",
              }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 13, flexShrink: 0,
                  background: e.color || C.azul, display: "grid", placeItems: "center",
                  fontWeight: 900, fontSize: 17, color: "#fff",
                }}>
                  {e.nombre.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>{e.nombre}</div>
                  <div style={{ fontSize: 12, color: C.suave }}>{e.cargo || "Conductor"}</div>
                </div>
                <span style={{ color: C.suave, fontSize: 18 }}>▶</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── PASO 1 · ¿Cuál vehículo? ────────────────────────────────────────── */}
      {paso === 1 && (
        <>
          <Cabecera titulo="¿Cuál vehículo?" sub={`Hola, ${conductor?.nombre.split(" ")[0]}. Toca la unidad que vas a usar.`} />
          <div style={{ padding: "0 18px", display: "grid", gap: 10 }}>
            {vehiculos.map(v => {
              const mio = v.conductor_id === conductor?.id;
              const hecho = chequeosHoy.some(c => c.vehiculo_id === v.id);
              return (
                <button key={v.id} onClick={() => escogerVehiculo(v)} style={{
                  display: "flex", alignItems: "center", gap: 14, width: "100%",
                  padding: "14px 16px", borderRadius: 14,
                  border: `1px solid ${mio ? C.azul : C.borde}`,
                  background: mio ? "#16233d" : C.panel, color: C.texto,
                  cursor: "pointer", textAlign: "left",
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 13, flexShrink: 0, background: C.panel2,
                    display: "grid", placeItems: "center", fontSize: 24,
                  }}>{v.tipo === "MOTOR" ? "🏍️" : v.tipo === "CAMION" ? "🚛" : v.tipo === "AUTOBUS" || v.tipo === "MINIBUS" ? "🚐" : "🚙"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 900, fontSize: 16 }}>{v.codigo}</span>
                      {mio && <span style={{ fontSize: 10, fontWeight: 800, color: C.azul, border: `1px solid ${C.azul}66`, borderRadius: 99, padding: "1px 7px" }}>TUYO</span>}
                      {hecho && <span style={{ fontSize: 10, fontWeight: 800, color: C.verde, border: `1px solid ${C.verde}66`, borderRadius: 99, padding: "1px 7px" }}>✓ HOY</span>}
                    </div>
                    <div style={{ fontSize: 13, color: C.suave, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.placa} · {[v.marca, v.modelo, v.anio].filter(Boolean).join(" ")}
                    </div>
                  </div>
                  <span style={{ color: C.suave, fontSize: 18 }}>▶</span>
                </button>
              );
            })}
          </div>
          <Pie><Atras /><div style={{ flex: 1 }} /></Pie>
        </>
      )}

      {/* ── PASO 2 · Turno y kilometraje ────────────────────────────────────── */}
      {paso === 2 && (
        <>
          <Cabecera titulo="Kilometraje" sub={`${vehiculo?.codigo} · ${vehiculo?.placa}`} />

          {yaReportado && (
            <div style={{
              margin: "0 18px 12px", padding: 12, borderRadius: 12,
              background: "#3b2a08", border: `1px solid ${C.ambar}55`, color: "#fde68a", fontSize: 13,
            }}>
              Este vehículo ya tiene el parte de <b>{turno === "SALIDA" ? "salida" : "entrada"}</b> de hoy
              ({yaReportado.conductor_nombre}). Si sigues, lo reemplazas.
            </div>
          )}

          <div style={{ padding: "0 18px 12px", display: "flex", gap: 10 }}>
            {(["SALIDA", "ENTRADA"] as const).map(t => (
              <button key={t} onClick={() => setTurno(t)} style={{
                flex: 1, padding: "14px 10px", borderRadius: 13, cursor: "pointer",
                border: `1px solid ${turno === t ? C.azul : C.borde}`,
                background: turno === t ? "#16233d" : C.panel,
                color: turno === t ? C.texto : C.suave, fontWeight: 800, fontSize: 15,
              }}>
                {t === "SALIDA" ? "🌅 Salida" : "🌙 Entrada"}
              </button>
            ))}
          </div>

          <div style={{ padding: "0 18px" }}>
            <div style={{
              background: C.panel, border: `1px solid ${kmMenor ? C.ambar : C.borde}`,
              borderRadius: 16, padding: "18px", textAlign: "center", marginBottom: 12,
            }}>
              <div style={{ fontSize: 12, color: C.suave, fontWeight: 700, letterSpacing: 1 }}>ODÓMETRO</div>
              <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: -1, margin: "6px 0", fontVariantNumeric: "tabular-nums" }}>
                {kmTexto === "" ? "0" : Number(kmTexto).toLocaleString("es-DO")}
              </div>
              <div style={{ fontSize: 12, color: kmMenor ? "#fbbf24" : C.suave }}>
                {kmMenor
                  ? `⚠️ Menor que el último registrado (${kmSugerido.toLocaleString("es-DO")}). Revísalo.`
                  : `Último registrado: ${kmSugerido.toLocaleString("es-DO")} km`}
              </div>
            </div>

            {/* Teclado numérico propio: el del sistema tapa media pantalla y
                trae letras que aquí no sirven. */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {["1","2","3","4","5","6","7","8","9","C","0","⌫"].map(t => (
                <button key={t} onClick={() => {
                  if (t === "C") setKmTexto("");
                  else if (t === "⌫") setKmTexto(s => s.slice(0, -1));
                  else setKmTexto(s => (s === "0" ? t : (s + t).slice(0, 8)));
                }} style={{
                  padding: "18px 0", borderRadius: 13, border: `1px solid ${C.borde}`,
                  background: t === "C" || t === "⌫" ? C.panel2 : C.panel,
                  color: C.texto, fontSize: 22, fontWeight: 800, cursor: "pointer",
                }}>{t}</button>
              ))}
            </div>
          </div>

          <Pie>
            <Atras />
            <div style={{ flex: 1 }}>
              <BotonGrande onClick={() => setPaso(3)} disabled={kmTexto === ""}>Siguiente</BotonGrande>
            </div>
          </Pie>
        </>
      )}

      {/* ── PASO 3 · Combustible con flechas ────────────────────────────────── */}
      {paso === 3 && (() => {
        const n = nivelCombustible(octavos);
        return (
          <>
            <Cabecera titulo="Combustible" sub="Mueve la aguja hasta donde la ves en el tablero" />
            <div style={{ padding: "0 18px" }}>
              <div style={{
                background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 16,
                padding: "22px 18px", textAlign: "center",
              }}>
                <div style={{ fontSize: 54, fontWeight: 900, color: n.color, lineHeight: 1 }}>{n.label}</div>
                <div style={{ fontSize: 15, color: C.suave, marginTop: 6, marginBottom: 18 }}>{n.texto}</div>

                {/* Barra de tanque */}
                <div style={{
                  height: 26, borderRadius: 99, background: C.panel2,
                  border: `1px solid ${C.borde}`, overflow: "hidden", position: "relative", marginBottom: 6,
                }}>
                  <div style={{
                    width: `${(octavos / 8) * 100}%`, height: "100%",
                    background: `linear-gradient(90deg, ${n.color}aa, ${n.color})`,
                    transition: "width .18s ease",
                  }} />
                  {[1,2,3,4,5,6,7].map(i => (
                    <div key={i} style={{
                      position: "absolute", left: `${(i / 8) * 100}%`, top: 0, bottom: 0,
                      width: 1, background: "#0b122055",
                    }} />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.suave, fontWeight: 700, marginBottom: 20 }}>
                  <span>E</span><span>¼</span><span>½</span><span>¾</span><span>F</span>
                </div>

                {/* Las flechas */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
                  <button onClick={() => setOctavos(o => Math.max(0, o - 1))} disabled={octavos === 0} style={{
                    width: 78, height: 68, borderRadius: 16, cursor: octavos === 0 ? "not-allowed" : "pointer",
                    border: `1px solid ${C.borde}`, background: octavos === 0 ? "#182136" : C.panel2,
                    color: octavos === 0 ? "#475569" : C.texto, fontSize: 30, fontWeight: 900,
                  }}>◀</button>
                  <div style={{ width: 76, fontSize: 13, color: C.suave, fontWeight: 700 }}>
                    {octavos}/8
                  </div>
                  <button onClick={() => setOctavos(o => Math.min(8, o + 1))} disabled={octavos === 8} style={{
                    width: 78, height: 68, borderRadius: 16, cursor: octavos === 8 ? "not-allowed" : "pointer",
                    border: `1px solid ${C.borde}`, background: octavos === 8 ? "#182136" : C.panel2,
                    color: octavos === 8 ? "#475569" : C.texto, fontSize: 30, fontWeight: 900,
                  }}>▶</button>
                </div>
              </div>

              {/* Atajos por si prefiere tocar directo */}
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                {[0, 2, 4, 6, 8].map(v => (
                  <button key={v} onClick={() => setOctavos(v)} style={{
                    flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer",
                    border: `1px solid ${octavos === v ? NIVELES[v].color : C.borde}`,
                    background: octavos === v ? NIVELES[v].color + "22" : C.panel,
                    color: octavos === v ? NIVELES[v].color : C.suave, fontWeight: 800, fontSize: 14,
                  }}>{NIVELES[v].label}</button>
                ))}
              </div>
            </div>
            <Pie>
              <Atras />
              <div style={{ flex: 1 }}><BotonGrande onClick={() => setPaso(4)}>Siguiente</BotonGrande></div>
            </Pie>
          </>
        );
      })()}

      {/* ── PASO 4 · Checklist ──────────────────────────────────────────────── */}
      {paso === 4 && (
        <>
          <Cabecera
            titulo="Revisión"
            sub="Todo está en verde. Toca solo lo que esté mal."
          />
          <div style={{ padding: "0 18px" }}>
            {Object.entries(itemsPorCategoria).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.suave, letterSpacing: 1, marginBottom: 8 }}>{cat}</div>
                <div style={{ display: "grid", gap: 7 }}>
                  {items.map(i => {
                    const m = conMarca(i.codigo);
                    const color = m === "MAL" ? C.rojo : m === "NA" ? "#64748b" : C.verde;
                    return (
                      <button key={i.codigo} onClick={() => tocarItem(i.codigo)} style={{
                        display: "flex", alignItems: "center", gap: 12, width: "100%",
                        padding: "13px 14px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                        border: `1px solid ${m ? color + "66" : C.borde}`,
                        background: m ? color + "1a" : C.panel, color: C.texto,
                      }}>
                        <span style={{ fontSize: 20, width: 26, textAlign: "center" }}>{i.icono || "•"}</span>
                        <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>
                          {i.etiqueta}
                          {i.critico && <span style={{ color: C.ambar, marginLeft: 6, fontSize: 12 }}>★</span>}
                        </span>
                        <span style={{
                          fontSize: 12, fontWeight: 900, color, border: `1px solid ${color}66`,
                          borderRadius: 99, padding: "4px 11px", whiteSpace: "nowrap",
                        }}>
                          {m === "MAL" ? "MAL" : m === "NA" ? "N/A" : "BIEN"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 12, color: C.suave, paddingBottom: 8 }}>
              ★ = si sale mal, el vehículo no debe salir. Toca otra vez para poner N/A (no aplica) y una tercera para volver a BIEN.
            </div>
          </div>
          <Pie>
            <Atras />
            <div style={{ flex: 1 }}>
              <BotonGrande onClick={() => setPaso(5)} color={itemsMalos.length ? C.ambar : C.azul}>
                {itemsMalos.length ? `Siguiente (${itemsMalos.length} con problema)` : "Todo bien · Siguiente"}
              </BotonGrande>
            </div>
          </Pie>
        </>
      )}

      {/* ── PASO 5 · Fallas ─────────────────────────────────────────────────── */}
      {paso === 5 && (
        <>
          <Cabecera titulo="¿Le pasa algo?" sub="Escoge lo que estés notando. Si no le pasa nada, sigue de largo." />

          {fallasAbiertas.length > 0 && (
            <div style={{
              margin: "0 18px 14px", padding: 12, borderRadius: 12,
              background: "#2a1414", border: `1px solid ${C.rojo}55`, fontSize: 13,
            }}>
              <div style={{ fontWeight: 800, marginBottom: 6, color: "#fca5a5" }}>Ya reportado y sin resolver:</div>
              <div style={{ color: "#fecaca" }}>
                {fallasAbiertas.map(f => f.falla_etiqueta).join(" · ")}
              </div>
            </div>
          )}

          <div style={{ padding: "0 18px" }}>
            {Object.entries(fallasPorCategoria).map(([cat, lista]) => (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.suave, letterSpacing: 1, marginBottom: 8 }}>{cat}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {lista.map(f => {
                    const sel = fallas.includes(f.codigo);
                    const color = f.severidad === "GRAVE" ? C.rojo : f.severidad === "MODERADA" ? C.ambar : "#0ea5e9";
                    return (
                      <button key={f.codigo} onClick={() => tocarFalla(f.codigo)} style={{
                        padding: "11px 14px", borderRadius: 12, cursor: "pointer",
                        border: `1px solid ${sel ? color : C.borde}`,
                        background: sel ? color + "26" : C.panel,
                        color: sel ? C.texto : "#c3d0e8", fontSize: 14, fontWeight: 700,
                        display: "flex", alignItems: "center", gap: 7,
                      }}>
                        <span style={{ fontSize: 16 }}>{f.icono || "•"}</span>
                        {f.etiqueta}
                        {f.detiene_vehiculo && <span style={{ color: C.rojo, fontSize: 12 }}>⛔</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 12, color: C.suave, paddingBottom: 8 }}>
              ⛔ = con eso el vehículo no debe salir a la calle.
            </div>
          </div>

          <Pie>
            <Atras />
            <div style={{ flex: 1 }}>
              <BotonGrande onClick={() => setPaso(6)} color={fallas.length ? C.ambar : C.azul}>
                {fallas.length ? `Siguiente (${fallas.length})` : "No le pasa nada · Siguiente"}
              </BotonGrande>
            </div>
          </Pie>
        </>
      )}

      {/* ── PASO 6 · Fotos ──────────────────────────────────────────────────── */}
      {paso === 6 && (
        <>
          <Cabecera titulo="Fotos del vehículo" sub="Toca cada recuadro y toma la foto. Se guardan comprimidas." />
          <div style={{ padding: "0 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {angulosPedidos.map(a => (
              <div key={a.codigo}>
                <input
                  ref={el => { fileRefs.current[a.codigo] = el; }}
                  type="file" accept="image/*" capture="environment"
                  style={{ display: "none" }}
                  onChange={e => tomarFoto(a.codigo, e.target.files?.[0])}
                />
                <button onClick={() => fileRefs.current[a.codigo]?.click()} style={{
                  width: "100%", aspectRatio: "4/3", borderRadius: 14, cursor: "pointer",
                  border: `1px solid ${fotos[a.codigo] ? C.verde : C.borde}`,
                  background: fotos[a.codigo] ? `center/cover no-repeat url(${fotos[a.codigo]})` : C.panel,
                  color: C.texto, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 6, padding: 0, overflow: "hidden",
                  position: "relative",
                }}>
                  {!fotos[a.codigo] && (
                    <>
                      <span style={{ fontSize: 28 }}>{a.icono}</span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{a.label}</span>
                      <span style={{ fontSize: 11, color: C.suave }}>📷 Tocar</span>
                    </>
                  )}
                  {fotos[a.codigo] && (
                    <span style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      background: "#0b1220cc", padding: "6px 8px", fontSize: 12, fontWeight: 800,
                    }}>✓ {a.label}</span>
                  )}
                </button>
              </div>
            ))}
          </div>

          {fotosFaltan.length > 0 && (
            <div style={{
              margin: "14px 18px 0", padding: 12, borderRadius: 12,
              background: "#3b2a08", border: `1px solid ${C.ambar}55`, color: "#fde68a", fontSize: 13,
            }}>
              Faltan {fotosFaltan.length}: {fotosFaltan.map(a => a.label).join(", ")}.
              Puedes guardar igual — al encargado le queda marcado que este parte va sin fotos.
            </div>
          )}

          <Pie>
            <Atras />
            <div style={{ flex: 1 }}>
              <BotonGrande onClick={guardar} disabled={guardando} color={C.verde}>
                {guardando ? "Guardando…" : "Guardar chequeo"}
              </BotonGrande>
            </div>
          </Pie>
        </>
      )}

      {/* ── PASO 7 · Listo ──────────────────────────────────────────────────── */}
      {paso === 7 && resultado && (
        <div style={{ padding: "28px 18px", textAlign: "center" }}>
          <div style={{ fontSize: 58 }}>{resultado.apto_circular ? "✅" : "⚠️"}</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 10 }}>
            {resultado.apto_circular ? "Chequeo guardado" : "Guardado, pero atención"}
          </div>
          <div style={{ color: C.suave, marginTop: 8, fontSize: 15, lineHeight: 1.5 }}>
            {resultado.mensaje}
          </div>

          <div style={{
            marginTop: 22, background: C.panel, border: `1px solid ${C.borde}`,
            borderRadius: 14, padding: 16, textAlign: "left", display: "grid", gap: 10,
          }}>
            {[
              ["Vehículo", `${vehiculo?.codigo} · ${vehiculo?.placa}`],
              ["Turno", turno === "SALIDA" ? "Salida" : "Entrada"],
              ["Kilometraje", `${Number(kmTexto || 0).toLocaleString("es-DO")} km`],
              ["Recorrido", resultado.chequeo?.km_recorrido != null ? `${Number(resultado.chequeo.km_recorrido).toLocaleString("es-DO")} km` : "—"],
              ["Combustible", nivelCombustible(octavos).label],
              ["Puntos con problema", String(itemsMalos.length)],
              ["Fallas reportadas", String(fallas.length)],
              ["Fotos", `${resultado.fotos_guardadas} subidas`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: C.suave }}>{k}</span>
                <span style={{ fontWeight: 800 }}>{v}</span>
              </div>
            ))}
          </div>

          {resultado.km_sospechoso && (
            <div style={{
              marginTop: 12, padding: 12, borderRadius: 12, fontSize: 13,
              background: "#3b2a08", border: `1px solid ${C.ambar}55`, color: "#fde68a",
            }}>
              El kilometraje quedó marcado para revisión porque salió menor que el anterior
              ({Number(resultado.km_anterior).toLocaleString("es-DO")} km).
            </div>
          )}

          {resultado.fotos_fallidas?.length > 0 && (
            <div style={{
              marginTop: 12, padding: 12, borderRadius: 12, fontSize: 13,
              background: "#2a1414", border: `1px solid ${C.rojo}55`, color: "#fecaca",
            }}>
              No subieron {resultado.fotos_fallidas.length} foto(s). El resto del parte sí quedó guardado.
            </div>
          )}

          <div style={{ marginTop: 22 }}>
            <BotonGrande onClick={reiniciar}>Hacer otro chequeo</BotonGrande>
          </div>
        </div>
      )}
    </div>
  );
}
