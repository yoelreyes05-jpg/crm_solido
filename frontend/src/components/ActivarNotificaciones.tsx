"use client";

/**
 * ActivarNotificaciones — tarjeta en el portal del cliente.
 *
 * Cierra el hueco real: hoy el cliente solo se entera del estado de su vehículo
 * si entra al portal a mirar. Con esto recibe el aviso en el teléfono como
 * cualquier otra app, sin depender de la API de WhatsApp.
 *
 * El push es el único canal que no depende de nada externo: no necesita correo
 * en ficha ni aprobación de Meta.
 *
 * Uso: <ActivarNotificaciones />  (dentro de una sesión activa del portal)
 */

import { useState, useEffect } from "react";
import {
  soportaPush, activarPush, desactivarPush, dispositivoSuscrito,
  cargarPreferencias, guardarPreferencias, enviarPushDePrueba,
  escucharResuscripcion,
} from "@/lib/portalCliente";

/** iOS solo permite push si la PWA está instalada en la pantalla de inicio. */
function esIOSSinInstalar() {
  if (typeof window === "undefined") return false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const instalada =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
  return ios && !instalada;
}

export default function ActivarNotificaciones() {
  const [suscrito, setSuscrito]   = useState(false);
  const [correo, setCorreo]       = useState(true);
  const [cargando, setCargando]   = useState(false);
  const [listo, setListo]         = useState(false);
  const [mensaje, setMensaje]     = useState("");
  const [abierto, setAbierto]     = useState(false);

  const soporta   = soportaPush();
  const iosPend   = esIOSSinInstalar();
  const denegado  = typeof window !== "undefined" && "Notification" in window
    && Notification.permission === "denied";

  useEffect(() => {
    const dejarDeEscuchar = escucharResuscripcion();
    (async () => {
      setSuscrito(await dispositivoSuscrito());
      try {
        const { preferencias } = await cargarPreferencias();
        setCorreo(preferencias.correo !== false);
      } catch {}
      setListo(true);
    })();
    return dejarDeEscuchar;
  }, []);

  const alternarPush = async () => {
    setCargando(true); setMensaje("");
    try {
      if (suscrito) {
        await desactivarPush();
        setSuscrito(false);
        setMensaje("Notificaciones desactivadas en este dispositivo.");
      } else {
        const r = await activarPush();
        if (r.ok) {
          setSuscrito(true);
          setMensaje("¡Listo! Te avisaremos aquí cuando tu vehículo cambie de estado.");
          enviarPushDePrueba().catch(() => {});
        } else {
          // Se incluye `detalle` a propósito: sin él, "no se pudieron activar"
          // deja al cliente y al taller sin saber qué falta.
          const base =
            r.motivo === "denegado"
              ? "Bloqueaste las notificaciones. Actívalas desde los ajustes del navegador para este sitio."
              : r.motivo === "sin-clave"
              ? "Las notificaciones aún no están habilitadas en el servidor. Avísale al taller."
              : r.motivo === "sin-soporte"
              ? "Tu navegador no soporta notificaciones."
              : "No se pudieron activar.";
          setMensaje(r.detalle ? `${base} (${r.detalle})` : base);
        }
      }
    } finally {
      setCargando(false);
    }
  };

  const alternarCorreo = async () => {
    const nuevo = !correo;
    setCorreo(nuevo);
    try {
      await guardarPreferencias({ correo: nuevo });
      setMensaje(nuevo ? "Recibirás avisos por correo." : "Ya no recibirás correos.");
    } catch {
      setCorreo(!nuevo);
      setMensaje("No se pudo guardar. Intenta de nuevo.");
    }
  };

  if (!listo) return null;

  return (
    <div className="notif-card fade-up">
      <button className="notif-cabecera" onClick={() => setAbierto((v) => !v)}>
        <span className="notif-emoji">{suscrito ? "🔔" : "🔕"}</span>
        <span className="notif-texto">
          <strong>Avisos de tu vehículo</strong>
          <small>
            {suscrito
              ? "Activados en este dispositivo"
              : iosPend
              ? "Instala la app para activarlos"
              : "Actívalos y te avisamos al instante"}
          </small>
        </span>
        <span className={`notif-flecha ${abierto ? "abierta" : ""}`}>▾</span>
      </button>

      {abierto && (
        <div className="notif-cuerpo">
          {/* ── PUSH ── */}
          {iosPend ? (
            <div className="notif-nota">
              En iPhone las notificaciones solo funcionan con la app instalada.
              Toca <strong>Compartir</strong> → <strong>Añadir a pantalla de inicio</strong>,
              abre la app desde ahí y vuelve a esta pantalla.
            </div>
          ) : !soporta ? (
            <div className="notif-nota">
              Tu navegador no soporta notificaciones. Puedes seguir recibiendo
              los avisos por correo.
            </div>
          ) : denegado && !suscrito ? (
            <div className="notif-nota">
              Las notificaciones están bloqueadas para este sitio. Actívalas en
              los ajustes del navegador (candado en la barra de dirección) y
              vuelve aquí.
            </div>
          ) : (
            <label className="notif-fila">
              <span>
                <strong>Notificación en el teléfono</strong>
                <small>Cuando entre a diagnóstico, cuando esté listo, etc.</small>
              </span>
              <button
                className={`notif-switch ${suscrito ? "on" : ""}`}
                onClick={alternarPush}
                disabled={cargando}
                aria-label="Activar notificaciones push"
              >
                <span />
              </button>
            </label>
          )}

          {/* ── CORREO ── */}
          <label className="notif-fila">
            <span>
              <strong>Correo electrónico</strong>
              <small>El mismo aviso, a tu correo registrado.</small>
            </span>
            <button
              className={`notif-switch ${correo ? "on" : ""}`}
              onClick={alternarCorreo}
              aria-label="Activar avisos por correo"
            >
              <span />
            </button>
          </label>

          {mensaje && <div className="notif-mensaje">{mensaje}</div>}

          {suscrito && (
            <button
              className="notif-prueba"
              onClick={async () => {
                setMensaje("");
                try {
                  await enviarPushDePrueba();
                  setMensaje("Enviada. Debería aparecer en unos segundos.");
                } catch {
                  setMensaje("No se pudo enviar la prueba.");
                }
              }}
            >
              Enviar notificación de prueba
            </button>
          )}
        </div>
      )}

      {/* <style> plano y no styled-jsx, igual que en cliente/page.tsx.
          Las clases llevan prefijo `notif-` porque estas reglas son globales. */}
      <style>{`
        .notif-card {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 18px;
          margin-bottom: 16px;
          overflow: hidden;
        }
        .notif-cabecera {
          display: flex; align-items: center; gap: 14px; width: 100%;
          padding: 16px 18px; background: none; border: none; cursor: pointer;
          text-align: left; color: #e2e8f0;
        }
        .notif-emoji { font-size: 22px; flex: none; }
        .notif-texto { flex: 1; }
        .notif-texto strong { display: block; font-size: 14px; font-weight: 600; }
        .notif-texto small { display: block; font-size: 12px; color: #64748b; margin-top: 2px; }
        .notif-flecha {
          color: #64748b; font-size: 14px; transition: transform 0.2s;
        }
        .notif-flecha.abierta { transform: rotate(180deg); }

        .notif-cuerpo {
          padding: 0 18px 18px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .notif-fila {
          display: flex; align-items: center; justify-content: space-between;
          gap: 14px; padding: 14px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        .notif-fila:last-of-type { border-bottom: none; }
        .notif-fila strong { display: block; font-size: 13.5px; color: #e2e8f0; font-weight: 600; }
        .notif-fila small { display: block; font-size: 11.5px; color: #64748b; margin-top: 3px; line-height: 1.45; }

        .notif-switch {
          flex: none; width: 46px; height: 26px; border-radius: 13px; padding: 3px;
          background: rgba(255, 255, 255, 0.1); border: none; cursor: pointer;
          transition: background 0.2s;
        }
        .notif-switch:disabled { opacity: 0.5; cursor: not-allowed; }
        .notif-switch span {
          display: block; width: 20px; height: 20px; border-radius: 50%;
          background: #94a3b8; transition: transform 0.2s, background 0.2s;
        }
        .notif-switch.on { background: rgba(16, 185, 129, 0.35); }
        .notif-switch.on span { transform: translateX(20px); background: #34d399; }

        .notif-nota {
          font-size: 12.5px; color: #fcd34d; line-height: 1.6;
          background: rgba(217, 119, 6, 0.12);
          border: 1px solid rgba(251, 191, 36, 0.25);
          border-radius: 10px; padding: 12px 14px; margin: 14px 0 0;
        }
        .notif-mensaje {
          font-size: 12.5px; color: #93c5fd; line-height: 1.55;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 10px; padding: 10px 12px; margin-top: 12px;
        }
        .notif-prueba {
          width: 100%; margin-top: 12px; padding: 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px; color: #94a3b8; font-size: 12.5px; cursor: pointer;
        }
        .notif-prueba:hover { background: rgba(255, 255, 255, 0.07); }
      `}</style>
    </div>
  );
}
