"use client";

/**
 * PortalAcceso — pantalla de identificación del cliente.
 *
 * Sustituye el input de placa suelto de /cliente, que dejaba ver el estado de
 * cualquier vehículo con solo saber la placa (y de paso descargaba la base
 * completa al navegador).
 *
 * Tres caminos, en orden de fricción:
 *   1. Últimos 4 dígitos del teléfono   → instantáneo, sin correo
 *   2. Código de 6 dígitos al correo     → si no hay teléfono en ficha
 *   3. Código dictado en el mostrador    → si no hay ninguno de los dos
 *
 * El paso 1 (consultar placa) le pregunta al backend qué métodos aplican, así
 * el cliente nunca ve una opción que no puede usar.
 *
 * Uso:
 *   <PortalAcceso onEntrar={(sesion) => setSesion(sesion)} />
 */

import { useState, useRef, useEffect } from "react";
import {
  consultarPlaca, entrarConTelefono, solicitarCodigo, entrarConCodigo,
  entrarConCodigoMostrador, ErrorPortal,
  type MetodosAcceso, type Sesion,
} from "@/lib/portalCliente";

type Paso = "placa" | "metodo" | "telefono" | "codigo" | "mostrador";

export default function PortalAcceso({ onEntrar }: { onEntrar: (s: Sesion) => void }) {
  const [paso, setPaso]         = useState<Paso>("placa");
  const [placa, setPlaca]       = useState("");
  const [ultimos4, setUltimos4] = useState("");
  const [codigo, setCodigo]     = useState("");
  const [codigoMost, setCodigoMost] = useState("");

  const [metodos, setMetodos]   = useState<MetodosAcceso | null>(null);
  const [vehPreview, setVehPreview] = useState<{ marca?: string; modelo?: string; ano?: number } | null>(null);
  const [destinoCorreo, setDestinoCorreo] = useState("");

  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState("");
  const [aviso, setAviso]       = useState("");
  const [segundos, setSegundos] = useState(0); // reenvío de código

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [paso]);

  useEffect(() => {
    if (segundos <= 0) return;
    const t = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [segundos]);

  const manejar = (e: unknown) => {
    const msg = e instanceof ErrorPortal ? e.message : "Algo salió mal. Intenta de nuevo.";
    setError(msg);
    // Si el backend indica que hay que ir al mostrador, llevamos al cliente ahí
    // en vez de dejarlo atascado leyendo un error.
    if (e instanceof ErrorPortal && e.requiere === "mostrador") {
      setAviso(msg);
      setError("");
      setPaso("mostrador");
    }
  };

  // ── Paso 1: placa ─────────────────────────────────────────────────────────
  const buscarPlaca = async () => {
    if (placa.trim().length < 4) return setError("Escribe la placa completa.");
    setCargando(true); setError(""); setAviso("");
    try {
      const r = await consultarPlaca(placa);
      setMetodos(r.metodos);
      setVehPreview(r.vehiculo);
      // Si solo hay un camino disponible, saltamos la pantalla de elección.
      if (r.metodos.telefono) setPaso("telefono");
      else if (r.metodos.correo) setPaso("metodo");
      else setPaso("mostrador");
    } catch (e) { manejar(e); }
    finally { setCargando(false); }
  };

  // ── Paso 2a: teléfono ─────────────────────────────────────────────────────
  const verificarTelefono = async () => {
    if (ultimos4.length !== 4) return setError("Son los últimos 4 dígitos.");
    setCargando(true); setError("");
    try { onEntrar(await entrarConTelefono(placa, ultimos4)); }
    catch (e) { manejar(e); }
    finally { setCargando(false); }
  };

  // ── Paso 2b: código al correo ─────────────────────────────────────────────
  const pedirCodigo = async () => {
    setCargando(true); setError("");
    try {
      const r = await solicitarCodigo(placa);
      setDestinoCorreo(r.destino);
      setSegundos(60);
      setPaso("codigo");
    } catch (e) { manejar(e); }
    finally { setCargando(false); }
  };

  const verificarCodigoCorreo = async () => {
    if (codigo.length !== 6) return setError("El código son 6 dígitos.");
    setCargando(true); setError("");
    try { onEntrar(await entrarConCodigo(placa, codigo)); }
    catch (e) { manejar(e); }
    finally { setCargando(false); }
  };

  // ── Paso 3: código del mostrador ──────────────────────────────────────────
  const verificarMostrador = async () => {
    if (codigoMost.length !== 8) return setError("El código del taller son 8 dígitos.");
    setCargando(true); setError("");
    try { onEntrar(await entrarConCodigoMostrador(codigoMost, placa || undefined)); }
    catch (e) {
      if (e instanceof ErrorPortal && e.status === 300) {
        setError("Tienes varios vehículos. Escribe primero la placa del que quieres ver.");
        setPaso("placa");
      } else manejar(e);
    }
    finally { setCargando(false); }
  };

  const volver = () => {
    setError(""); setAviso("");
    setPaso(paso === "placa" ? "placa" : "placa");
  };

  const nombreVeh = vehPreview
    ? [vehPreview.marca, vehPreview.modelo, vehPreview.ano].filter(Boolean).join(" ")
    : "";

  return (
    <div className="pa-wrap">
      <style>{ESTILOS}</style>

      <div className="pa-card">
        <div className="pa-icono">🔐</div>

        {/* ── PLACA ─────────────────────────────────────────────────────── */}
        {paso === "placa" && (
          <>
            <h2 className="pa-titulo">Consulta tu vehículo</h2>
            <p className="pa-sub">
              Escribe la placa. Después te pediremos un dato para confirmar que
              el vehículo es tuyo.
            </p>
            <input
              ref={inputRef}
              value={placa}
              onChange={(e) => setPlaca(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && buscarPlaca()}
              placeholder="A123456"
              maxLength={12}
              autoCapitalize="characters"
              className="pa-input pa-input-placa"
            />
            <button className="pa-btn" disabled={cargando || placa.trim().length < 4} onClick={buscarPlaca}>
              {cargando ? "Buscando…" : "Continuar"}
            </button>
            <button className="pa-link" onClick={() => { setError(""); setPaso("mostrador"); }}>
              Tengo un código del taller
            </button>
          </>
        )}

        {/* ── ELEGIR MÉTODO ─────────────────────────────────────────────── */}
        {paso === "metodo" && metodos && (
          <>
            <h2 className="pa-titulo">¿Cómo confirmamos que eres tú?</h2>
            {nombreVeh && <p className="pa-veh">🚗 {nombreVeh}</p>}

            {metodos.telefono && (
              <button className="pa-opcion" onClick={() => setPaso("telefono")}>
                <span className="pa-opcion-emoji">📱</span>
                <span>
                  <strong>Últimos 4 de mi teléfono</strong>
                  <small>{metodos.telefono.pista} · al instante</small>
                </span>
              </button>
            )}

            {metodos.correo && (
              <button className="pa-opcion" onClick={pedirCodigo} disabled={cargando}>
                <span className="pa-opcion-emoji">✉️</span>
                <span>
                  <strong>Código por correo</strong>
                  <small>{metodos.correo.pista} · llega en segundos</small>
                </span>
              </button>
            )}

            <button className="pa-link" onClick={() => setPaso("mostrador")}>
              Ninguno funciona — tengo un código del taller
            </button>
            <button className="pa-link pa-link-tenue" onClick={volver}>← Cambiar placa</button>
          </>
        )}

        {/* ── TELÉFONO ──────────────────────────────────────────────────── */}
        {paso === "telefono" && (
          <>
            <h2 className="pa-titulo">Confirma que es tu vehículo</h2>
            {nombreVeh && <p className="pa-veh">🚗 {nombreVeh} · {placa}</p>}
            <p className="pa-sub">
              Escribe los <strong>últimos 4 dígitos</strong> del teléfono que
              dejaste en el taller{metodos?.telefono ? ` (${metodos.telefono.pista})` : ""}.
            </p>
            <input
              ref={inputRef}
              value={ultimos4}
              onChange={(e) => setUltimos4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => e.key === "Enter" && verificarTelefono()}
              placeholder="0000"
              inputMode="numeric"
              className="pa-input pa-input-codigo"
            />
            <button className="pa-btn" disabled={cargando || ultimos4.length !== 4} onClick={verificarTelefono}>
              {cargando ? "Verificando…" : "Entrar"}
            </button>

            {metodos?.correo && (
              <button className="pa-link" onClick={pedirCodigo} disabled={cargando}>
                Mejor mándame un código a {metodos.correo.pista}
              </button>
            )}
            <button className="pa-link pa-link-tenue" onClick={() => setPaso("mostrador")}>
              No recuerdo el teléfono que di
            </button>
          </>
        )}

        {/* ── CÓDIGO POR CORREO ─────────────────────────────────────────── */}
        {paso === "codigo" && (
          <>
            <h2 className="pa-titulo">Revisa tu correo</h2>
            <p className="pa-sub">
              Enviamos un código de 6 dígitos a <strong>{destinoCorreo}</strong>.
              Si no lo ves, mira en spam.
            </p>
            <input
              ref={inputRef}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && verificarCodigoCorreo()}
              placeholder="000000"
              inputMode="numeric"
              className="pa-input pa-input-codigo"
            />
            <button className="pa-btn" disabled={cargando || codigo.length !== 6} onClick={verificarCodigoCorreo}>
              {cargando ? "Verificando…" : "Entrar"}
            </button>
            <button className="pa-link" disabled={segundos > 0 || cargando} onClick={pedirCodigo}>
              {segundos > 0 ? `Reenviar en ${segundos}s` : "Reenviar código"}
            </button>
            <button className="pa-link pa-link-tenue" onClick={volver}>← Empezar de nuevo</button>
          </>
        )}

        {/* ── CÓDIGO DEL MOSTRADOR ──────────────────────────────────────── */}
        {paso === "mostrador" && (
          <>
            <h2 className="pa-titulo">Código del taller</h2>
            <p className="pa-sub">
              Pídele a la recepción que te genere un código desde tu ficha.
              Son 8 dígitos y sirven por 24 horas.
            </p>
            <input
              ref={inputRef}
              value={codigoMost}
              onChange={(e) => setCodigoMost(e.target.value.replace(/\D/g, "").slice(0, 8))}
              onKeyDown={(e) => e.key === "Enter" && verificarMostrador()}
              placeholder="00000000"
              inputMode="numeric"
              className="pa-input pa-input-codigo"
            />
            <button className="pa-btn" disabled={cargando || codigoMost.length !== 8} onClick={verificarMostrador}>
              {cargando ? "Verificando…" : "Entrar"}
            </button>
            <a className="pa-link" href="https://wa.me/18495692027?text=Hola,%20necesito%20un%20c%C3%B3digo%20para%20entrar%20al%20portal%20y%20ver%20mi%20veh%C3%ADculo."
               target="_blank" rel="noreferrer">
              Pedirlo por WhatsApp
            </a>
            <button className="pa-link pa-link-tenue" onClick={volver}>← Volver</button>
          </>
        )}

        {aviso && <div className="pa-aviso">{aviso}</div>}
        {error && <div className="pa-error">{error}</div>}

        <p className="pa-privacidad">
          Solo verás la información de tu propio vehículo.
        </p>
      </div>
    </div>
  );
}

const ESTILOS = `
  .pa-wrap {
    display:flex; align-items:center; justify-content:center;
    min-height:70vh; padding:24px 18px;
  }
  .pa-card {
    width:100%; max-width:400px; text-align:center;
    background:rgba(15,23,42,.7); border:1px solid rgba(255,255,255,.07);
    border-radius:22px; padding:32px 24px 24px;
    backdrop-filter:blur(12px);
  }
  .pa-icono { font-size:34px; margin-bottom:10px; }
  .pa-titulo {
    font-family:'Syne',sans-serif; font-size:20px; font-weight:800;
    color:#f1f5f9; margin:0 0 8px; letter-spacing:.3px;
  }
  .pa-sub { font-size:13.5px; color:#94a3b8; line-height:1.65; margin:0 0 20px; }
  .pa-sub strong, .pa-veh strong { color:#cbd5e1; }
  .pa-veh {
    font-size:13px; color:#93c5fd; margin:0 0 16px;
    background:rgba(59,130,246,.1); border-radius:10px; padding:8px 12px;
  }

  .pa-input {
    width:100%; padding:16px; margin-bottom:14px;
    background:#0b1220; border:2px solid rgba(255,255,255,.09); border-radius:14px;
    color:#e2e8f0; font-size:22px; text-align:center; outline:none;
    transition:border-color .15s, box-shadow .15s;
  }
  .pa-input:focus { border-color:#3b82f6; box-shadow:0 0 0 4px rgba(59,130,246,.12); }
  .pa-input::placeholder { color:#334155; }
  .pa-input-placa  { font-weight:800; letter-spacing:5px; font-family:monospace; }
  .pa-input-codigo { font-weight:800; letter-spacing:12px; font-family:monospace; }

  .pa-btn {
    width:100%; padding:15px; border:none; border-radius:14px;
    background:linear-gradient(135deg,#1d4ed8,#3b82f6); color:#fff;
    font-size:15px; font-weight:700; cursor:pointer;
    transition:transform .12s, opacity .12s;
  }
  .pa-btn:hover:not(:disabled) { transform:translateY(-1px); }
  .pa-btn:disabled { opacity:.4; cursor:not-allowed; }

  .pa-opcion {
    display:flex; align-items:center; gap:14px; width:100%; text-align:left;
    padding:14px 16px; margin-bottom:10px; cursor:pointer;
    background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08);
    border-radius:14px; color:#e2e8f0; transition:background .15s, border-color .15s;
  }
  .pa-opcion:hover:not(:disabled) { background:rgba(59,130,246,.1); border-color:rgba(59,130,246,.4); }
  .pa-opcion:disabled { opacity:.5; cursor:not-allowed; }
  .pa-opcion-emoji { font-size:22px; }
  .pa-opcion strong { display:block; font-size:14px; font-weight:600; }
  .pa-opcion small  { display:block; font-size:12px; color:#64748b; margin-top:2px; }

  .pa-link {
    display:block; width:100%; margin-top:12px; padding:6px;
    background:none; border:none; cursor:pointer;
    color:#60a5fa; font-size:13px; text-decoration:none;
  }
  .pa-link:hover:not(:disabled) { text-decoration:underline; }
  .pa-link:disabled { color:#475569; cursor:not-allowed; }
  .pa-link-tenue { color:#64748b; font-size:12.5px; }

  .pa-error, .pa-aviso {
    margin-top:16px; padding:12px 14px; border-radius:12px;
    font-size:13px; line-height:1.55; text-align:left;
  }
  .pa-error { background:rgba(220,38,38,.12); border:1px solid rgba(248,113,113,.3); color:#fca5a5; }
  .pa-aviso { background:rgba(217,119,6,.12); border:1px solid rgba(251,191,36,.3); color:#fcd34d; }

  .pa-privacidad {
    margin:20px 0 0; font-size:11.5px; color:#475569; line-height:1.5;
  }
`;
