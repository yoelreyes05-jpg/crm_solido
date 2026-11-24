"use client";

/**
 * ClienteQR — código QR personal del cliente para entrar a la app.
 *
 * Cada cliente tiene un token (clientes.qr_token, ver
 * crm-backend/sql/migracion_v33_qr_cliente.sql). El QR es un enlace a la app:
 *     <URL_APP>?qr=<token>
 * Al escanearlo con la cámara (o con el botón "Escanear mi QR" de la app) el
 * cliente entra directo y ve su vehículo, su historial y sus planes de
 * mantenimiento, incluido el próximo cambio de aceite.
 *
 * Exporta:
 *   <ClienteQRModal clienteId abierto onCerrar />   modal controlado
 *   <BotonQRCliente clienteId clienteNombre />      botón que abre el modal
 */

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import QRCode from "qrcode";
import { API_URL as API } from "@/config";
import { auditHeaders } from "@/lib/audit";

type InfoQR = {
  cliente_id: number;
  nombre: string;
  telefono: string;
  token: string;
  url: string;
  generado_en: string | null;
  vehiculos: number;
};

const NOMBRE_TALLER = "Sólido Auto Servicio";

/** Carga una imagen y resuelve cuando está lista (o null si falla). */
function cargarImagen(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Dibuja la tarjeta (logo, nombre, QR e instrucciones) en un PNG. */
async function tarjetaPNG(info: InfoQR, qrDataUrl: string): Promise<string> {
  const W = 900, H = 1300;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;

  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  // Franja superior
  const grad = g.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, "#0f172a"); grad.addColorStop(1, "#1e3a8a");
  g.fillStyle = grad; g.fillRect(0, 0, W, 230);

  const logo = await cargarImagen("/logo.png");
  if (logo) g.drawImage(logo, 50, 35, 160, 160);
  g.fillStyle = "#ffffff";
  g.font = "800 46px Arial, sans-serif";
  g.fillText(NOMBRE_TALLER, logo ? 235 : 50, 110);
  g.fillStyle = "#c9a26b";
  g.font = "600 26px Arial, sans-serif";
  g.fillText("Tu vehículo en tu celular", logo ? 235 : 50, 158);

  g.fillStyle = "#0f172a";
  g.textAlign = "center";
  g.font = "800 50px Arial, sans-serif";
  g.fillText(info.nombre || "Cliente", W / 2, 320, W - 80);

  const qr = await cargarImagen(qrDataUrl);
  if (qr) g.drawImage(qr, (W - 640) / 2, 370, 640, 640);

  g.fillStyle = "#334155";
  g.font = "600 30px Arial, sans-serif";
  g.fillText("Escanéalo con la cámara de tu celular", W / 2, 1080);
  g.font = "400 26px Arial, sans-serif";
  g.fillStyle = "#64748b";
  g.fillText("Verás el estado de tu vehículo, tu historial", W / 2, 1130);
  g.fillText("y tu próximo cambio de aceite.", W / 2, 1168);
  g.font = "600 24px Arial, sans-serif";
  g.fillStyle = "#1e3a8a";
  g.fillText("WhatsApp 849-569-2027 · solidoautoservicio.online", W / 2, 1250);

  return c.toDataURL("image/png");
}

export function ClienteQRModal({
  clienteId,
  abierto,
  onCerrar,
  titulo = "📱 Código QR del cliente",
  aviso,
}: {
  clienteId: number | string;
  abierto: boolean;
  onCerrar: () => void;
  titulo?: string;
  aviso?: string;
}) {
  const [info, setInfo] = useState<InfoQR | null>(null);
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cargar = async (regenerar = false) => {
    setCargando(true); setError(""); setCopiado(false);
    try {
      const res = await fetch(
        `${API}/clientes/${clienteId}/qr${regenerar ? "/regenerar" : ""}`,
        { method: regenerar ? "POST" : "GET", headers: { "Content-Type": "application/json", ...auditHeaders() } }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);
      const nuevo: InfoQR = regenerar && info ? { ...info, ...data } : data;
      setInfo(nuevo);
      setQr(await QRCode.toDataURL(nuevo.url, {
        width: 640, margin: 1, errorCorrectionLevel: "M",
        color: { dark: "#0f172a", light: "#ffffff" },
      }));
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el QR.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (abierto) cargar();
    else { setInfo(null); setQr(""); setError(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, clienteId]);

  if (!abierto) return null;

  const nombreArchivo = `QR-${(info?.nombre || "cliente").replace(/[^\wáéíóúñÁÉÍÓÚÑ]+/g, "-")}.png`;

  const descargar = async () => {
    if (!info || !qr) return;
    const a = document.createElement("a");
    a.href = await tarjetaPNG(info, qr);
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const imprimir = async () => {
    if (!info || !qr) return;
    const png = await tarjetaPNG(info, qr);
    const w = window.open("", "_blank", "width=520,height=760");
    if (!w) return alert("Permite las ventanas emergentes para imprimir.");
    w.document.write(`<!doctype html><html><head><title>${nombreArchivo}</title>
      <style>@page{margin:10mm}body{margin:0;display:flex;justify-content:center}
      img{width:85mm;height:auto;border:1px dashed #cbd5e1}</style></head>
      <body><img src="${png}" onload="setTimeout(()=>{window.print()},200)"/></body></html>`);
    w.document.close();
  };

  const whatsapp = () => {
    if (!info) return;
    const tel = (info.telefono || "").replace(/\D/g, "");
    const num = tel.length === 10 ? `1${tel}` : tel;
    const texto =
      `Hola ${info.nombre?.split(" ")[0] || ""} 👋, este es tu acceso personal a la app de *${NOMBRE_TALLER}*.\n\n` +
      `Ábrelo para ver el estado de tu vehículo, tu historial y tu próximo cambio de aceite:\n${info.url}\n\n` +
      `Guárdalo: es solo para ti.`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(texto)}`, "_blank");
  };

  const copiar = async () => {
    if (!info) return;
    try { await navigator.clipboard.writeText(info.url); setCopiado(true); } catch { prompt("Copia el enlace:", info.url); }
  };

  const regenerar = () => {
    if (!confirm("¿Generar un QR nuevo? El QR anterior dejará de funcionar y el cliente tendrá que escanear el nuevo.")) return;
    cargar(true);
  };

  return (
    <div style={S.overlay} onClick={onCerrar}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.cabecera}>
          <h2 style={S.titulo}>{titulo}</h2>
          <button onClick={onCerrar} style={S.cerrar} aria-label="Cerrar">✕</button>
        </div>

        {aviso && <div style={S.ok}>{aviso}</div>}

        {cargando && !qr && <p style={S.tenue}>Generando QR…</p>}
        {error && <div style={S.error}>{error}</div>}

        {info && qr && (
          <>
            <div style={S.tarjeta}>
              <div style={S.nombre}>{info.nombre}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Código QR del cliente" style={S.qr} />
              <div style={S.instr}>
                Escanéalo con la cámara del celular para ver el vehículo, el historial
                y el próximo cambio de aceite.
              </div>
            </div>

            {info.vehiculos === 0 && (
              <div style={S.aviso}>
                Este cliente todavía no tiene vehículo registrado. El QR ya es suyo, pero
                mostrará datos cuando le registres un vehículo.
              </div>
            )}

            <div style={S.botones}>
              <button onClick={imprimir} style={S.btn("#0f172a")}>🖨️ Imprimir</button>
              <button onClick={descargar} style={S.btn("#1d4ed8")}>⬇️ Descargar</button>
              <button onClick={whatsapp} style={S.btn("#16a34a")} disabled={!info.telefono}
                title={info.telefono ? "" : "El cliente no tiene teléfono en ficha"}>
                💬 WhatsApp
              </button>
              <button onClick={copiar} style={S.btn("#475569")}>{copiado ? "✅ Copiado" : "🔗 Copiar enlace"}</button>
            </div>

            <button onClick={regenerar} style={S.link} disabled={cargando}>
              🔄 Generar QR nuevo (invalida el anterior)
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function BotonQRCliente({
  clienteId,
  estiloBoton,
  etiqueta = "QR",
}: {
  clienteId: number | string;
  clienteNombre?: string;
  estiloBoton?: CSSProperties;
  etiqueta?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button onClick={() => setAbierto(true)} style={estiloBoton} title="Código QR para la app del cliente">
        📱 {etiqueta}
      </button>
      <ClienteQRModal clienteId={clienteId} abierto={abierto} onCerrar={() => setAbierto(false)} />
    </>
  );
}

const S = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
  } as CSSProperties,
  modal: {
    background: "#fff", borderRadius: 16, padding: 22, width: "100%", maxWidth: 420,
    maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,.25)",
  } as CSSProperties,
  cabecera: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } as CSSProperties,
  titulo: { margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" } as CSSProperties,
  cerrar: { background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" } as CSSProperties,
  tarjeta: {
    border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, textAlign: "center", background: "#f8fafc",
  } as CSSProperties,
  nombre: { fontWeight: 800, fontSize: 17, color: "#0f172a", marginBottom: 8 } as CSSProperties,
  qr: { width: "100%", maxWidth: 260, height: "auto", display: "block", margin: "0 auto", borderRadius: 8 } as CSSProperties,
  instr: { fontSize: 12.5, color: "#475569", marginTop: 10, lineHeight: 1.5 } as CSSProperties,
  botones: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 } as CSSProperties,
  btn: (bg: string): CSSProperties => ({
    padding: "11px 10px", border: "none", borderRadius: 10, background: bg, color: "#fff",
    fontWeight: 700, fontSize: 13.5, cursor: "pointer",
  }),
  link: {
    display: "block", width: "100%", marginTop: 12, background: "none", border: "none",
    color: "#b45309", fontSize: 12.5, cursor: "pointer",
  } as CSSProperties,
  tenue: { color: "#64748b", fontSize: 14, textAlign: "center" } as CSSProperties,
  error: {
    background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c",
    borderRadius: 10, padding: 12, fontSize: 13.5, marginBottom: 10,
  } as CSSProperties,
  aviso: {
    background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e",
    borderRadius: 10, padding: 10, fontSize: 12.5, marginTop: 10, lineHeight: 1.45,
  } as CSSProperties,
  ok: {
    background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46",
    borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 12, fontWeight: 600,
  } as CSSProperties,
};
