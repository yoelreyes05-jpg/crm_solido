"use client";

/**
 * EscanerQR — lee un código QR con la cámara trasera del celular.
 *
 * Usa BarcodeDetector cuando el navegador lo trae (Chrome en Android) y jsQR
 * como respaldo (Safari en iPhone no tiene BarcodeDetector). Necesita HTTPS,
 * que en producción ya hay.
 */

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

export default function EscanerQR({
  onLeido,
  onCerrar,
}: {
  onLeido: (texto: string) => void;
  onCerrar: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let vivo = true;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const Detector = (window as any).BarcodeDetector;
    let detector: any = null;
    try { if (Detector) detector = new Detector({ formats: ["qr_code"] }); } catch { detector = null; }

    let ultimo = 0;
    const leer = async (t: number) => {
      if (!vivo) return;
      const v = videoRef.current;
      // ~8 lecturas por segundo es suficiente y no calienta el teléfono.
      if (v && v.readyState >= 2 && t - ultimo > 120) {
        ultimo = t;
        try {
          let texto: string | null = null;
          if (detector) {
            const r = await detector.detect(v);
            texto = r?.[0]?.rawValue || null;
          } else if (ctx) {
            const w = v.videoWidth, h = v.videoHeight;
            const escala = Math.min(1, 640 / Math.max(w, h));
            canvas.width = Math.round(w * escala);
            canvas.height = Math.round(h * escala);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            texto = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data || null;
          }
          if (texto) {
            vivo = false;
            if (navigator.vibrate) navigator.vibrate(80);
            onLeido(texto);
            return;
          }
        } catch {
          /* cuadro ilegible: se intenta con el siguiente */
        }
      }
      raf = requestAnimationFrame(leer);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Este navegador no permite usar la cámara. Escanea el QR con la app de cámara del celular.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!vivo) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
        raf = requestAnimationFrame(leer);
      } catch (e: any) {
        setError(
          e?.name === "NotAllowedError"
            ? "No diste permiso para usar la cámara. Actívalo en la configuración del navegador o escanea el QR con la app de cámara."
            : "No se pudo abrir la cámara. Escanea el QR con la app de cámara del celular."
        );
      }
    })();

    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onLeido]);

  return (
    <div className="eq-wrap">
      <style>{ESTILOS}</style>
      {error ? (
        <div className="eq-error">{error}</div>
      ) : (
        <div className="eq-visor">
          <video ref={videoRef} playsInline muted className="eq-video" />
          <div className="eq-marco" />
        </div>
      )}
      <p className="eq-ayuda">Apunta la cámara al código QR que te dio el taller.</p>
      <button className="eq-cancelar" onClick={onCerrar}>Cancelar</button>
    </div>
  );
}

const ESTILOS = `
  .eq-wrap { text-align:center; }
  .eq-visor {
    position:relative; width:100%; aspect-ratio:1/1; border-radius:18px;
    overflow:hidden; background:#000; margin-bottom:12px;
  }
  .eq-video { width:100%; height:100%; object-fit:cover; display:block; }
  .eq-marco {
    position:absolute; inset:16%; border:3px solid rgba(96,165,250,.95);
    border-radius:16px; box-shadow:0 0 0 999px rgba(0,0,0,.35);
    animation:eq-pulso 1.6s ease-in-out infinite;
  }
  @keyframes eq-pulso { 50% { border-color:rgba(147,197,253,.45); } }
  .eq-ayuda { font-size:13px; color:#94a3b8; margin:0 0 10px; }
  .eq-cancelar {
    background:none; border:none; color:#60a5fa; font-size:13px; cursor:pointer; padding:6px;
  }
  .eq-error {
    padding:14px; border-radius:12px; font-size:13px; line-height:1.55; text-align:left;
    background:rgba(217,119,6,.12); border:1px solid rgba(251,191,36,.3); color:#fcd34d; margin-bottom:12px;
  }
`;
