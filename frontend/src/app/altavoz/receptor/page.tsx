"use client";
/**
 * Receptor de altavoz — pantalla para dejar abierta en la PC del taller.
 *
 * Sondea la cola de anuncios y los locuta por las bocinas con la voz del
 * navegador (Web Speech API). No requiere comprar equipo de audio en red.
 *
 * Detalles que importan:
 *
 * - Los navegadores bloquean el audio hasta que el usuario interactúa con la
 *   página. Por eso arranca en pausa con un botón grande: sin ese clic inicial
 *   el sondeo correría y los anuncios se marcarían como reproducidos sin que
 *   sonara nada — el peor fallo posible aquí.
 *
 * - Sondeo cada 4 s en vez de websocket: si la PC pierde el wifi o se
 *   reinicia, al volver locuta lo que quedó pendiente en lugar de perderlo.
 *
 * - El anuncio se marca REPRODUCIDO al terminar de hablar, no al recibirlo.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { API_URL as API } from "@/config";

const INTERVALO_MS = 4000;
const PAUSA_ENTRE_REPETICIONES_MS = 900;

type Anuncio = {
  id: number;
  mensaje: string;
  tipo: string;
  destinatario?: string | null;
  repeticiones: number;
  usuario_nombre?: string | null;
  created_at: string;
};

export default function ReceptorAltavoz() {
  const [activo, setActivo]       = useState(false);
  const [hablando, setHablando]   = useState<Anuncio | null>(null);
  const [historial, setHistorial] = useState<Anuncio[]>([]);
  const [enCola, setEnCola]       = useState(0);
  const [error, setError]         = useState("");
  const [soportado, setSoportado] = useState(true);
  const [volumen, setVolumen]     = useState(1);

  // `ocupado` evita que un sondeo entre mientras se está locutando: sin él,
  // dos anuncios se pisarían y el segundo se marcaría como sonado sin oírse.
  const ocupado = useRef(false);
  const activoRef = useRef(false);
  const volumenRef = useRef(1);

  useEffect(() => { activoRef.current = activo; }, [activo]);
  useEffect(() => { volumenRef.current = volumen; }, [volumen]);

  useEffect(() => {
    if (typeof window !== "undefined" && !("speechSynthesis" in window)) {
      setSoportado(false);
    }
  }, []);

  /** Locuta un texto y resuelve cuando termina (o si falla). */
  const decir = useCallback((texto: string): Promise<void> => {
    return new Promise(resolve => {
      try {
        const u = new SpeechSynthesisUtterance(texto);
        u.lang = "es-DO";
        u.rate = 0.92;   // algo más lento: en un taller con ruido se entiende mejor
        u.pitch = 1;
        u.volume = volumenRef.current;

        // Preferir una voz en español si el sistema tiene alguna instalada.
        const voces = window.speechSynthesis.getVoices();
        const es = voces.find(v => v.lang?.toLowerCase().startsWith("es"));
        if (es) u.voice = es;

        u.onend = () => resolve();
        u.onerror = () => resolve();   // no bloquear la cola si una falla
        window.speechSynthesis.speak(u);
      } catch {
        resolve();
      }
    });
  }, []);

  const marcarReproducido = useCallback(async (id: number) => {
    try {
      await fetch(`${API}/seguridad/altavoz/${id}/reproducido`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receptor: "PC taller" }),
      });
    } catch { /* se reintentará: sigue PENDIENTE en la cola */ }
  }, []);

  const revisarCola = useCallback(async () => {
    if (!activoRef.current || ocupado.current) return;
    try {
      const r = await fetch(`${API}/seguridad/altavoz/cola`, { cache: "no-store" });
      const d = await r.json();
      if (d.error) return;

      const cola: Anuncio[] = d.anuncios || [];
      setEnCola(cola.length);
      setError("");
      if (cola.length === 0) return;

      ocupado.current = true;
      const a = cola[0];
      setHablando(a);

      // Un preaviso corto hace que la gente levante la cabeza antes de que
      // empiece el mensaje; si no, se pierde la primera mitad de la frase.
      await decir(a.tipo === "EMERGENCIA" ? "Atención. Atención." : "Atención.");

      for (let i = 0; i < (a.repeticiones || 1); i++) {
        await decir(a.mensaje);
        if (i < (a.repeticiones || 1) - 1) {
          await new Promise(res => setTimeout(res, PAUSA_ENTRE_REPETICIONES_MS));
        }
      }

      await marcarReproducido(a.id);
      setHistorial(h => [a, ...h].slice(0, 20));
      setHablando(null);
      ocupado.current = false;
    } catch {
      setError("Sin conexión con el servidor. Reintentando…");
      ocupado.current = false;
    }
  }, [decir, marcarReproducido]);

  useEffect(() => {
    if (!activo) return;
    revisarCola();
    const t = setInterval(revisarCola, INTERVALO_MS);
    return () => clearInterval(t);
  }, [activo, revisarCola]);

  // Al encender: la primera locución tiene que salir del clic del usuario,
  // porque es lo que desbloquea el audio en el navegador.
  const encender = async () => {
    setActivo(true);
    await decir("Altavoz del taller activado.");
  };

  const apagar = () => {
    setActivo(false);
    ocupado.current = false;
    try { window.speechSynthesis.cancel(); } catch {}
    setHablando(null);
  };

  const C = {
    bg: "#0f172a", card: "#1e293b", border: "#334155",
    text: "#e2e8f0", muted: "#94a3b8", green: "#10b981", red: "#ef4444", blue: "#3b82f6",
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text,
      fontFamily: "system-ui, sans-serif", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24, textAlign: "center",
    }}>

      <div style={{ fontSize: 13, color: C.muted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
        Sólido Auto Servicio
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 6px" }}>📢 Altavoz del Taller</h1>
      <p style={{ color: C.muted, fontSize: 14, margin: "0 0 28px", maxWidth: 460, lineHeight: 1.6 }}>
        Deja esta pantalla abierta en la computadora conectada a las bocinas.
        Los llamados del CRM sonarán aquí.
      </p>

      {!soportado && (
        <div style={{ background: C.red + "22", border: `1px solid ${C.red}55`, color: C.red, borderRadius: 10, padding: "12px 16px", fontSize: 13, maxWidth: 460, marginBottom: 20, lineHeight: 1.5 }}>
          Este navegador no puede reproducir voz. Usa Chrome o Edge en la PC del taller.
        </div>
      )}

      {/* Indicador grande: se tiene que ver de lejos si está encendido o no */}
      <div style={{
        width: 200, height: 200, borderRadius: "50%",
        background: hablando ? C.blue + "22" : activo ? C.green + "18" : C.card,
        border: `3px solid ${hablando ? C.blue : activo ? C.green : C.border}`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        marginBottom: 26, transition: "all .25s",
        animation: hablando ? "pulso 1.1s ease-in-out infinite" : "none",
      }}>
        <div style={{ fontSize: 54 }}>{hablando ? "🔊" : activo ? "👂" : "🔇"}</div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, color: hablando ? C.blue : activo ? C.green : C.muted }}>
          {hablando ? "Anunciando" : activo ? "Escuchando" : "Apagado"}
        </div>
      </div>

      {hablando && (
        <div style={{ background: C.card, border: `1px solid ${C.blue}55`, borderRadius: 12, padding: "16px 20px", maxWidth: 520, marginBottom: 20 }}>
          <div style={{ fontSize: 17, lineHeight: 1.5 }}>{hablando.mensaje}</div>
          {hablando.usuario_nombre && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Enviado por {hablando.usuario_nombre}</div>
          )}
        </div>
      )}

      {!activo ? (
        <button onClick={encender} disabled={!soportado}
          style={{
            background: C.green, color: "#fff", border: "none", borderRadius: 14,
            padding: "18px 44px", fontSize: 18, fontWeight: 800,
            cursor: soportado ? "pointer" : "not-allowed", opacity: soportado ? 1 : .5,
          }}>
          ▶ Activar altavoz
        </button>
      ) : (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={apagar}
            style={{ background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 12, padding: "13px 26px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            ⏸ Pausar
          </button>
          <button onClick={() => decir("Prueba de sonido del altavoz del taller.")}
            style={{ background: C.card, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 12, padding: "13px 20px", fontSize: 14, cursor: "pointer" }}>
            🔈 Probar sonido
          </button>
          <label style={{ fontSize: 13, color: C.muted, display: "flex", alignItems: "center", gap: 8 }}>
            Volumen
            <input type="range" min={0} max={1} step={0.1} value={volumen}
              onChange={e => setVolumen(Number(e.target.value))} style={{ width: 100 }} />
          </label>
        </div>
      )}

      <div style={{ marginTop: 24, fontSize: 13, color: C.muted, minHeight: 20 }}>
        {error
          ? <span style={{ color: C.red }}>{error}</span>
          : activo
            ? (enCola > 0 ? `${enCola} anuncio${enCola > 1 ? "s" : ""} en cola` : "Sin anuncios pendientes")
            : "El altavoz está pausado — los llamados no sonarán"}
      </div>

      {historial.length > 0 && (
        <div style={{ marginTop: 32, width: "100%", maxWidth: 520, textAlign: "left" }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Anunciados en esta sesión
          </div>
          {historial.map((a, i) => (
            <div key={`${a.id}-${i}`} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}44`, fontSize: 13, color: C.muted }}>
              {a.mensaje}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulso {
          0%,100% { transform: scale(1);    }
          50%     { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
