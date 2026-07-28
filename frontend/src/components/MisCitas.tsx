"use client";

/**
 * MisCitas — agendar y ver citas desde la app del cliente.
 *
 * Hasta ahora agendar solo se podía desde el sitio web, con un formulario que
 * pedía nombre, correo, placa y modelo — datos que la app YA conoce, porque el
 * cliente entró con su placa. Repetírselos es pedirle que se identifique dos
 * veces.
 *
 * Aquí la cita se crea contra `POST /portal/citas`, que la guarda con el
 * `cliente_id` y el `vehiculo_id` de la sesión. La diferencia práctica: la cita
 * entra al CRM ya vinculada a su ficha (no como una "cita web suelta" que la
 * secretaria tiene que emparejar a mano) y las notificaciones push le llegan
 * sin trabajo extra.
 *
 * Uso: <MisCitas />  dentro de una sesión activa del portal.
 */

import { useState, useEffect } from "react";
import {
  cargarCitas, opcionesCita, agendarCita, cancelarCita,
  fechaBonita, horaBonita, ETIQUETA_SERVICIO,
  type Cita, type OpcionesCita,
} from "@/lib/portalCliente";

const SERVICIOS = [
  "MANTENIMIENTO", "DIAGNOSTICO", "FRENOS", "SUSPENSION",
  "ELECTRICO", "AIRE_ACONDICIONADO", "ALINEACION", "MOTOR", "CARWASH", "OTRO",
];

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE:  "#f59e0b",
  CONFIRMADA: "#10b981",
  COMPLETADA: "#64748b",
  CANCELADA:  "#ef4444",
  NO_ASISTIO: "#ef4444",
};

const TEXTO_ESTADO: Record<string, string> = {
  PENDIENTE:  "Pendiente de confirmación",
  CONFIRMADA: "Confirmada",
  COMPLETADA: "Completada",
  CANCELADA:  "Cancelada",
  NO_ASISTIO: "No asististe",
};

const DIAS_CORTO  = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun",
                     "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * "2026-08-03" → "lun 3 ago", para que quepa en un botón.
 *
 * Se parte el string a mano en vez de usar `new Date("2026-08-03")`: ese
 * constructor lo interpreta como UTC y en UTC-4 muestra el día anterior.
 */
function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return `${DIAS_CORTO[new Date(a, m - 1, d).getDay()]} ${d} ${MESES_CORTO[m - 1]}`;
}

/** Los próximos N días hábiles como atajos, para no obligar a usar el datepicker. */
function diasSugeridos(min: string, cantidad = 5): string[] {
  const [a, m, d] = min.split("-").map(Number);
  const base = new Date(a, m - 1, d);
  const out: string[] = [];
  for (let i = 1; out.length < cantidad && i < 15; i++) {
    const f = new Date(base.getTime() + i * 86400_000);
    if (f.getDay() === 0) continue; // domingo: no se toman citas de taller
    out.push(
      `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`
    );
  }
  return out;
}

export default function MisCitas() {
  const [abierto, setAbierto]     = useState(false);
  const [proximas, setProximas]   = useState<Cita[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [form, setForm]           = useState(false);

  const [opciones, setOpciones]   = useState<OpcionesCita | null>(null);
  const [fecha, setFecha]         = useState("");
  const [hora, setHora]           = useState("");
  const [tipo, setTipo]           = useState("MANTENIMIENTO");
  const [motivo, setMotivo]       = useState("");

  const [buscandoHoras, setBuscandoHoras] = useState(false);
  const [enviando, setEnviando]   = useState(false);
  const [mensaje, setMensaje]     = useState("");
  const [error, setError]         = useState("");

  // ── Carga inicial ──
  useEffect(() => {
    (async () => {
      try {
        const r = await cargarCitas();
        setProximas(r.proximas || []);
        // Si ya tiene una cita, la tarjeta se abre sola: es información que
        // quiere ver, no algo que tenga que ir a buscar.
        if ((r.proximas || []).length) setAbierto(true);
      } catch {
        /* sin citas o portal a medio instalar: la tarjeta igual sirve */
      }
      try {
        setOpciones(await opcionesCita());
      } catch {}
      setCargando(false);
    })();
  }, []);

  // ── Al elegir fecha, traer las horas libres de ese día ──
  useEffect(() => {
    if (!fecha) return;
    let vigente = true;
    setBuscandoHoras(true);
    setHora("");
    opcionesCita(fecha)
      .then((o) => { if (vigente) setOpciones(o); })
      .catch(() => {})
      .finally(() => { if (vigente) setBuscandoHoras(false); });
    return () => { vigente = false; };
  }, [fecha]);

  const refrescar = async () => {
    try {
      const r = await cargarCitas();
      setProximas(r.proximas || []);
    } catch {}
  };

  const enviar = async () => {
    setError(""); setMensaje("");
    if (!fecha)  return setError("Elige el día.");
    if (!hora)   return setError("Elige la hora.");
    if (motivo.trim().length < 3) return setError("Cuéntanos brevemente qué necesita tu vehículo.");

    setEnviando(true);
    try {
      const r = await agendarCita({ fecha, hora, tipo_servicio: tipo, descripcion: motivo.trim() });
      setMensaje(r.mensaje || "Cita agendada.");
      setForm(false);
      setFecha(""); setHora(""); setMotivo("");
      await refrescar();
    } catch (e: any) {
      // El backend manda mensajes accionables ("esa hora ya se llenó",
      // "ya tienes una cita ese día"); se muestran tal cual en vez de un
      // genérico que obligue al cliente a adivinar.
      setError(e?.message || "No se pudo agendar. Intenta de nuevo.");
      if (fecha) opcionesCita(fecha).then(setOpciones).catch(() => {});
    } finally {
      setEnviando(false);
    }
  };

  const anular = async (c: Cita) => {
    if (!confirm(`¿Cancelar tu cita del ${fechaBonita(c.fecha)} a las ${horaBonita(c.hora)}?`)) return;
    setError(""); setMensaje("");
    try {
      const r = await cancelarCita(c.id);
      setMensaje(r.mensaje || "Cita cancelada.");
      await refrescar();
    } catch (e: any) {
      setError(e?.message || "No se pudo cancelar.");
    }
  };

  if (cargando) return null;

  const horasLibres = (opciones?.horas || []).filter((h) => h.disponible);
  const sugeridos = opciones?.fecha_min ? diasSugeridos(opciones.fecha_min) : [];

  return (
    <div className="cita-card fade-up">
      <button className="cita-cabecera" onClick={() => setAbierto((v) => !v)}>
        <span className="cita-emoji">📅</span>
        <span className="cita-texto">
          <strong>Mis citas</strong>
          <small>
            {proximas.length
              ? `${proximas.length} cita${proximas.length > 1 ? "s" : ""} próxima${proximas.length > 1 ? "s" : ""}`
              : "Agenda tu próxima visita al taller"}
          </small>
        </span>
        <span className={`cita-flecha ${abierto ? "abierta" : ""}`}>▾</span>
      </button>

      {abierto && (
        <div className="cita-cuerpo">
          {/* ── Citas próximas ── */}
          {proximas.map((c) => (
            <div key={c.id} className="cita-item" style={{ borderLeftColor: COLOR_ESTADO[c.estado] || "#64748b" }}>
              <div className="cita-item-fecha">
                <strong>{fechaBonita(c.fecha)}</strong>
                <span>{horaBonita(c.hora)}</span>
              </div>
              <div className="cita-item-detalle">
                {ETIQUETA_SERVICIO[c.tipo_servicio || ""] || c.tipo_servicio || "Servicio"}
                {c.descripcion ? ` — ${c.descripcion}` : ""}
              </div>
              <div className="cita-item-pie">
                <span className="cita-chip" style={{ color: COLOR_ESTADO[c.estado], borderColor: COLOR_ESTADO[c.estado] }}>
                  {TEXTO_ESTADO[c.estado] || c.estado}
                </span>
                <button className="cita-cancelar" onClick={() => anular(c)}>Cancelar</button>
              </div>
            </div>
          ))}

          {!proximas.length && !form && (
            <div className="cita-vacio">
              No tienes citas próximas. Agenda una y te confirmamos por aquí mismo.
            </div>
          )}

          {mensaje && <div className="cita-ok">{mensaje}</div>}
          {error && !form && <div className="cita-error">{error}</div>}

          {/* ── Formulario ── */}
          {!form ? (
            <button className="cita-btn-principal" onClick={() => { setForm(true); setMensaje(""); setError(""); }}>
              + Agendar una cita
            </button>
          ) : (
            <div className="cita-form">
              {/* Día */}
              <label className="cita-label">¿Qué día?</label>
              <div className="cita-sugeridos">
                {sugeridos.map((f) => (
                  <button
                    key={f}
                    className={`cita-pill ${fecha === f ? "activa" : ""}`}
                    onClick={() => setFecha(f)}
                  >
                    {fechaCorta(f)}
                  </button>
                ))}
              </div>
              <input
                type="date"
                className="cita-input"
                value={fecha}
                min={opciones?.fecha_min}
                max={opciones?.fecha_max}
                onChange={(e) => setFecha(e.target.value)}
              />

              {/* Hora */}
              {fecha && (
                <>
                  <label className="cita-label">¿A qué hora?</label>
                  {buscandoHoras ? (
                    <div className="cita-nota">Buscando horas disponibles…</div>
                  ) : opciones?.cerrado ? (
                    <div className="cita-nota">
                      Los domingos no tomamos citas de taller. Elige otro día.
                    </div>
                  ) : !horasLibres.length ? (
                    <div className="cita-nota">
                      Ese día ya está lleno. Prueba con otra fecha.
                    </div>
                  ) : (
                    <div className="cita-horas">
                      {horasLibres.map((h) => (
                        <button
                          key={h.hora}
                          className={`cita-pill ${hora === h.hora ? "activa" : ""}`}
                          onClick={() => setHora(h.hora)}
                        >
                          {horaBonita(h.hora)}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Servicio */}
              <label className="cita-label">¿Qué necesita tu vehículo?</label>
              <select className="cita-input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {SERVICIOS.map((s) => (
                  <option key={s} value={s}>{ETIQUETA_SERVICIO[s] || s}</option>
                ))}
              </select>

              <textarea
                className="cita-input cita-textarea"
                placeholder="Cuéntanos brevemente: por ejemplo, «hace un ruido al frenar»"
                value={motivo}
                maxLength={400}
                onChange={(e) => setMotivo(e.target.value)}
              />

              {error && <div className="cita-error">{error}</div>}

              <div className="cita-acciones">
                <button className="cita-btn-sec" onClick={() => { setForm(false); setError(""); }}>
                  Cancelar
                </button>
                <button className="cita-btn-principal" onClick={enviar} disabled={enviando}>
                  {enviando ? "Agendando…" : "Confirmar cita"}
                </button>
              </div>

              <div className="cita-pie">
                Tu cita queda <strong>pendiente de confirmación</strong>. Te avisamos
                por notificación y correo en cuanto el taller la confirme, y te
                recordamos el día anterior y una hora antes.
              </div>
            </div>
          )}
        </div>
      )}

      {/* <style> plano y no styled-jsx, igual que en cliente/page.tsx y
          ActivarNotificaciones. Las clases llevan prefijo `cita-` porque estas
          reglas son globales. */}
      <style>{`
        .cita-card {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 18px;
          margin-bottom: 16px;
          overflow: hidden;
        }
        .cita-cabecera {
          display: flex; align-items: center; gap: 14px; width: 100%;
          padding: 16px 18px; background: none; border: none; cursor: pointer;
          text-align: left; color: #e2e8f0;
        }
        .cita-emoji { font-size: 22px; flex: none; }
        .cita-texto { flex: 1; }
        .cita-texto strong { display: block; font-size: 14px; font-weight: 600; }
        .cita-texto small { display: block; font-size: 12px; color: #64748b; margin-top: 2px; }
        .cita-flecha { color: #64748b; font-size: 14px; transition: transform 0.2s; }
        .cita-flecha.abierta { transform: rotate(180deg); }

        .cita-cuerpo {
          padding: 4px 18px 18px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .cita-item {
          background: rgba(255, 255, 255, 0.03);
          border-left: 3px solid #64748b;
          border-radius: 0 10px 10px 0;
          padding: 12px 14px; margin-top: 12px;
        }
        .cita-item-fecha {
          display: flex; justify-content: space-between; align-items: baseline;
          color: #e2e8f0; font-size: 14px;
        }
        .cita-item-fecha strong { text-transform: capitalize; font-weight: 700; }
        .cita-item-fecha span { color: #94a3b8; font-size: 13px; }
        .cita-item-detalle {
          color: #94a3b8; font-size: 12.5px; line-height: 1.5; margin-top: 5px;
        }
        .cita-item-pie {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 10px; gap: 10px;
        }
        .cita-chip {
          font-size: 11px; font-weight: 700; padding: 3px 9px;
          border: 1px solid currentColor; border-radius: 20px;
        }
        .cita-cancelar {
          background: none; border: none; color: #64748b;
          font-size: 12px; cursor: pointer; text-decoration: underline;
        }
        .cita-cancelar:hover { color: #f87171; }

        .cita-vacio {
          color: #64748b; font-size: 12.5px; line-height: 1.6;
          padding: 12px 0 4px;
        }

        .cita-btn-principal {
          width: 100%; margin-top: 14px; padding: 13px;
          background: linear-gradient(135deg, #1d4ed8, #3b82f6);
          border: none; border-radius: 11px;
          color: #fff; font-size: 14px; font-weight: 700; cursor: pointer;
          box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
        }
        .cita-btn-principal:disabled { opacity: 0.6; cursor: not-allowed; }
        .cita-btn-sec {
          flex: none; padding: 13px 18px; margin-top: 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 11px; color: #94a3b8; font-size: 14px; cursor: pointer;
        }
        .cita-acciones { display: flex; gap: 10px; }
        .cita-acciones .cita-btn-principal { flex: 1; }

        .cita-form { margin-top: 8px; }
        .cita-label {
          display: block; color: #94a3b8; font-size: 12px;
          font-weight: 600; margin: 16px 0 8px;
        }
        .cita-input {
          width: 100%; box-sizing: border-box; padding: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px; color: #e2e8f0; font-size: 14px;
          font-family: inherit;
        }
        .cita-textarea { min-height: 76px; resize: vertical; margin-top: 10px; }
        .cita-input:focus { outline: none; border-color: rgba(59, 130, 246, 0.5); }

        .cita-sugeridos, .cita-horas {
          display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 10px;
        }
        .cita-pill {
          padding: 8px 12px; border-radius: 9px; cursor: pointer;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8; font-size: 12.5px; text-transform: capitalize;
        }
        .cita-pill.activa {
          background: rgba(59, 130, 246, 0.18);
          border-color: rgba(59, 130, 246, 0.5);
          color: #bfdbfe; font-weight: 700;
        }

        .cita-nota {
          font-size: 12.5px; color: #fcd34d; line-height: 1.6;
          background: rgba(217, 119, 6, 0.12);
          border: 1px solid rgba(251, 191, 36, 0.25);
          border-radius: 10px; padding: 11px 13px;
        }
        .cita-ok {
          font-size: 12.5px; color: #6ee7b7; line-height: 1.55;
          background: rgba(16, 185, 129, 0.12);
          border-radius: 10px; padding: 11px 13px; margin-top: 12px;
        }
        .cita-error {
          font-size: 12.5px; color: #fca5a5; line-height: 1.55;
          background: rgba(239, 68, 68, 0.12);
          border-radius: 10px; padding: 11px 13px; margin-top: 12px;
        }
        .cita-pie {
          color: #64748b; font-size: 11.5px; line-height: 1.6; margin-top: 14px;
        }
      `}</style>
    </div>
  );
}
