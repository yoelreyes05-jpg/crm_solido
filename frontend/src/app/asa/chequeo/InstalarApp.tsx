"use client";
import React, { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// 📲 INSTALAR EL CHEQUEO EN EL CELULAR
//
// El conductor no debe tener que buscar el enlace de WhatsApp cada mañana. Con
// esto le queda un icono propio en la pantalla de inicio y la pantalla abre a
// pantalla completa, sin barra de navegador.
//
// Android y Chrome dan un evento (`beforeinstallprompt`) que permite mostrar un
// boton y disparar el instalador. iOS NO lo da: ahi la unica via es que el
// usuario toque Compartir → "Añadir a pantalla de inicio", asi que en iPhone se
// muestran las instrucciones en vez del boton. Distinguirlos importa — un boton
// que en iPhone no hace nada es peor que no ponerlo.
// ─────────────────────────────────────────────────────────────────────────────

const OCULTO = "asa_instalar_oculto";

type Prompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const C = {
  panel:  "#131c2e",
  panel2: "#1b2740",
  borde:  "#26344f",
  texto:  "#e8eefc",
  suave:  "#8ea3c7",
  teal:   "#0f766e",
};

/** ¿Ya se está viendo como app instalada? Entonces no hay nada que ofrecer. */
function yaInstalada() {
  if (typeof window === "undefined") return true;
  const comoApp = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosApp = (window.navigator as any).standalone === true;
  return !!(comoApp || iosApp);
}

function esIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ se presenta como Mac; el touch es lo que lo delata.
  return /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
}

export default function InstalarApp() {
  const [prompt, setPrompt]   = useState<Prompt | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos]         = useState(false);
  const [comoIOS, setComoIOS] = useState(false);

  useEffect(() => {
    if (yaInstalada()) return;
    try { if (localStorage.getItem(OCULTO) === "1") return; } catch {}

    if (esIOS()) { setIos(true); setVisible(true); return; }

    const alPoder = (e: Event) => {
      // Sin esto Chrome muestra su propia barrita, que el conductor ignora.
      e.preventDefault();
      setPrompt(e as Prompt);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", alPoder);

    const alInstalar = () => setVisible(false);
    window.addEventListener("appinstalled", alInstalar);

    return () => {
      window.removeEventListener("beforeinstallprompt", alPoder);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  const instalar = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setVisible(false);
    setPrompt(null);
  };

  const noMostrarMas = () => {
    try { localStorage.setItem(OCULTO, "1"); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      margin: "12px 18px 0", padding: 14, borderRadius: 14,
      background: `linear-gradient(135deg, ${C.panel2}, ${C.panel})`,
      border: `1px solid ${C.borde}`, display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ fontSize: 26, flexShrink: 0 }}>📲</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: C.texto }}>
          Instala el chequeo en tu celular
        </div>
        <div style={{ fontSize: 12, color: C.suave, marginTop: 3, lineHeight: 1.5 }}>
          {ios
            ? <>Toca <b>Compartir</b> abajo, y luego <b>“Añadir a pantalla de inicio”</b>.</>
            : "Te queda el icono en la pantalla de inicio y no tienes que buscar el enlace."}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {!ios && (
            <button onClick={instalar} style={{
              padding: "9px 16px", borderRadius: 10, border: "none", cursor: "pointer",
              background: C.teal, color: "#fff", fontSize: 13, fontWeight: 800,
            }}>Instalar</button>
          )}
          {ios && (
            <button onClick={() => setComoIOS(v => !v)} style={{
              padding: "9px 16px", borderRadius: 10, cursor: "pointer",
              border: `1px solid ${C.borde}`, background: "transparent",
              color: C.texto, fontSize: 13, fontWeight: 800,
            }}>{comoIOS ? "Ocultar pasos" : "Ver cómo"}</button>
          )}
          <button onClick={noMostrarMas} style={{
            padding: "9px 14px", borderRadius: 10, cursor: "pointer",
            border: `1px solid ${C.borde}`, background: "transparent",
            color: C.suave, fontSize: 13, fontWeight: 700,
          }}>Ahora no</button>
        </div>

        {comoIOS && (
          <ol style={{ margin: "12px 0 0", paddingLeft: 20, fontSize: 12, color: C.suave, lineHeight: 1.9 }}>
            <li>Toca el botón <b>Compartir</b> ⬆️ (abajo en Safari).</li>
            <li>Baja y escoge <b>Añadir a pantalla de inicio</b>.</li>
            <li>Toca <b>Añadir</b>. Listo — te queda el icono con el camión.</li>
          </ol>
        )}
      </div>
    </div>
  );
}
