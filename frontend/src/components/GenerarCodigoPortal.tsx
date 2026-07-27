"use client";

/**
 * GenerarCodigoPortal — botón para la ficha del cliente en el CRM.
 *
 * El camino de mostrador no es un caso borde: todo cliente sin teléfono ni
 * correo en ficha depende de él. Corre la consulta de diagnóstico al final de
 * sql/portal_cliente.sql para saber cuántos son en tu base — si el número es
 * alto, este botón es la vía principal de acceso al portal, no el respaldo.
 *
 * La secretaria lo presiona, se le muestra el código en pantalla grande, y se
 * lo dicta al cliente. Vive 24 horas y es de un solo uso.
 *
 * Uso en clientes/[id] o en la ficha:
 *   <GenerarCodigoPortal clienteId={cliente.id} clienteNombre={cliente.nombre} />
 */

import { useState } from "react";
import type { CSSProperties } from "react";
import { generarCodigoMostrador, ErrorPortal } from "@/lib/portalCliente";

const SECRETO_ADMIN = process.env.NEXT_PUBLIC_PORTAL_ADMIN_SECRET || "";

function usuarioActual(): string {
  if (typeof window === "undefined") return "";
  try {
    const u = JSON.parse(localStorage.getItem("usuario") || "{}");
    return u?.nombre || u?.email || "";
  } catch {
    return "";
  }
}

export default function GenerarCodigoPortal({
  clienteId,
  clienteNombre,
  telefono,
  estiloBoton,
  etiqueta,
}: {
  clienteId: number;
  clienteNombre?: string;
  telefono?: string;
  /** Para que el botón encaje con los estilos en línea de la tabla de clientes. */
  estiloBoton?: CSSProperties;
  etiqueta?: string;
}) {
  const [abierto, setAbierto]   = useState(false);
  const [codigo, setCodigo]     = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState("");
  const [copiado, setCopiado]   = useState(false);

  const generar = async () => {
    setCargando(true); setError(""); setCodigo("");
    try {
      const r = await generarCodigoMostrador(clienteId, SECRETO_ADMIN, usuarioActual());
      setCodigo(r.codigo);
      setAbierto(true);
    } catch (e) {
      setError(
        e instanceof ErrorPortal
          ? e.status === 403
            ? "No autorizado. Falta NEXT_PUBLIC_PORTAL_ADMIN_SECRET en el frontend o no coincide con la del backend."
            : e.message
          : "No se pudo generar el código."
      );
      setAbierto(true);
    } finally {
      setCargando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {}
  };

  const mensajeWhatsApp =
    `Hola${clienteNombre ? ` ${clienteNombre.split(" ")[0]}` : ""}, tu código para ver el estado ` +
    `de tu vehículo en línea es: ${codigo}\n\n` +
    `Entra a solidoautoservicio.com/cliente y toca «Tengo un código del taller».\n` +
    `El código vence en 24 horas. — Sólido Auto Servicio`;

  const telLimpio = String(telefono || "").replace(/\D/g, "");
  const enlaceWa = telLimpio
    ? `https://wa.me/${telLimpio.length === 10 ? "1" + telLimpio : telLimpio}?text=${encodeURIComponent(mensajeWhatsApp)}`
    : "";

  return (
    <>
      <button
        className={estiloBoton ? undefined : "gcp-boton"}
        style={estiloBoton}
        onClick={generar}
        disabled={cargando}
        title="Genera un código de 8 dígitos para que el cliente entre al portal desde su celular"
      >
        🔑 {cargando ? "Generando…" : etiqueta || "Código de acceso al portal"}
      </button>

      {abierto && (
        <div className="gcp-fondo" onClick={() => setAbierto(false)}>
          <div className="gcp-modal" onClick={(e) => e.stopPropagation()}>
            <button className="gcp-cerrar" onClick={() => setAbierto(false)}>×</button>

            {error ? (
              <>
                <div className="gcp-emoji">⚠️</div>
                <h3 className="gcp-titulo">No se pudo generar</h3>
                <p className="gcp-error">{error}</p>
              </>
            ) : (
              <>
                <div className="gcp-emoji">🔑</div>
                <h3 className="gcp-titulo">Código para {clienteNombre || "el cliente"}</h3>
                <p className="gcp-sub">Díctaselo. Vence en 24 horas y solo sirve una vez.</p>

                <div className="gcp-codigo" onClick={copiar} title="Clic para copiar">
                  {codigo.slice(0, 4)} {codigo.slice(4)}
                </div>

                <div className="gcp-pasos">
                  <div className="gcp-paso"><span>1</span> Entrar a <strong>solidoautoservicio.com/cliente</strong></div>
                  <div className="gcp-paso"><span>2</span> Tocar <strong>«Tengo un código del taller»</strong></div>
                  <div className="gcp-paso"><span>3</span> Escribir los 8 dígitos</div>
                </div>

                <div className="gcp-acciones">
                  <button className="gcp-accion" onClick={copiar}>
                    {copiado ? "✓ Copiado" : "📋 Copiar"}
                  </button>
                  {enlaceWa && (
                    <a className="gcp-accion gcp-wa" href={enlaceWa} target="_blank" rel="noreferrer">
                      💬 Enviar por WhatsApp
                    </a>
                  )}
                </div>

                <p className="gcp-nota">
                  Si generas otro código para este cliente, el anterior deja de servir.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* <style> plano y no styled-jsx: es el patrón que ya usa cliente/page.tsx
          y no depende de tipos adicionales. Por eso todas las clases llevan
          prefijo `gcp-`, ya que estas reglas son globales. */}
      <style>{`
        .gcp-boton {
          padding: 10px 16px; border: 1px solid #cbd5e1; border-radius: 10px;
          background: #fff; color: #334155; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: background .15s, border-color .15s;
        }
        .gcp-boton:hover:not(:disabled) { background: #f1f5f9; border-color: #94a3b8; }
        .gcp-boton:disabled { opacity: .6; cursor: not-allowed; }

        .gcp-fondo {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(15,23,42,.6); backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .gcp-modal {
          position: relative; width: 100%; max-width: 380px; text-align: center;
          background: #fff; border-radius: 20px; padding: 32px 26px 24px;
          box-shadow: 0 20px 50px rgba(0,0,0,.25);
        }
        .gcp-cerrar {
          position: absolute; top: 12px; right: 16px;
          background: none; border: none; font-size: 26px; line-height: 1;
          color: #94a3b8; cursor: pointer;
        }
        .gcp-emoji { font-size: 30px; margin-bottom: 8px; }
        .gcp-titulo { margin: 0 0 4px; font-size: 17px; font-weight: 700; color: #0f172a; }
        .gcp-sub { margin: 0 0 18px; font-size: 13px; color: #64748b; line-height: 1.5; }
        .gcp-error {
          margin: 0; padding: 12px; border-radius: 10px; font-size: 13px;
          background: #fef2f2; color: #b91c1c; text-align: left; line-height: 1.55;
        }

        .gcp-codigo {
          font-family: 'Courier New', monospace; font-size: 40px; font-weight: 800;
          letter-spacing: 6px; color: #1e3a8a; cursor: pointer;
          background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 14px;
          padding: 20px 10px; margin-bottom: 18px; user-select: all;
        }
        .gcp-codigo:hover { background: #f1f5f9; }

        .gcp-pasos { text-align: left; margin-bottom: 18px; }
        .gcp-paso {
          display: flex; align-items: center; gap: 10px;
          font-size: 12.5px; color: #475569; margin-bottom: 8px; line-height: 1.5;
        }
        .gcp-paso span {
          flex: none; width: 20px; height: 20px; border-radius: 50%;
          background: #1e3a8a; color: #fff; font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }

        .gcp-acciones { display: flex; gap: 8px; }
        .gcp-accion {
          flex: 1; padding: 11px; border: 1px solid #e2e8f0; border-radius: 10px;
          background: #f8fafc; color: #334155; font-size: 13px; font-weight: 600;
          cursor: pointer; text-decoration: none; text-align: center;
        }
        .gcp-accion:hover { background: #f1f5f9; }
        .gcp-wa { background: #dcfce7; border-color: #86efac; color: #166534; }
        .gcp-wa:hover { background: #bbf7d0; }

        .gcp-nota { margin: 14px 0 0; font-size: 11.5px; color: #94a3b8; line-height: 1.5; }
      `}</style>
    </>
  );
}
