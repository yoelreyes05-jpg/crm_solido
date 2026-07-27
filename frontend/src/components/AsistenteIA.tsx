"use client";
import { useState, useRef, useEffect } from "react";
import { API_URL as API } from "@/config";

interface Mensaje {
  rol: "user" | "asistente";
  texto: string;
  cargando?: boolean;
}

export default function AsistenteIA() {
  const [abierto,   setAbierto]   = useState(false);
  const [pregunta,  setPregunta]  = useState("");
  const [mensajes,  setMensajes]  = useState<Mensaje[]>([
    { rol: "asistente", texto: "Hola 👋 Soy tu asistente de Sólido Auto Servicio. Tengo acceso en tiempo real a:\n\n🚗 Vehículos · 👤 Clientes · 📋 Órdenes · 📅 Citas · 🧾 Facturas · 📦 Inventario · 🏭 Suplidores · 💰 Contabilidad · 🚿 Car Wash · ☕ Cafetería · 🎓 Cursos · 💎 Planes/Membresías · 📊 Historial\n\n¿Qué necesitas?" },
  ]);
  const [cargando,  setCargando]  = useState(false);
  const endRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (abierto) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [abierto, mensajes]);

  const historialParaAPI = () =>
    mensajes
      .filter(m => !m.cargando)
      .slice(-8)
      .map(m => ({ role: m.rol === "user" ? "user" : "assistant", content: m.texto }));

  const enviar = async () => {
    const texto = pregunta.trim();
    if (!texto || cargando) return;
    setPregunta("");
    setMensajes(prev => [...prev, { rol: "user", texto }, { rol: "asistente", texto: "...", cargando: true }]);
    setCargando(true);
    try {
      const res = await fetch(`${API}/api/ia/asistente`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pregunta: texto, historial: historialParaAPI() }),
      });
      const data = await res.json();
      const respuesta = data.respuesta || data.error || "No pude obtener una respuesta.";
      setMensajes(prev => [
        ...prev.filter(m => !m.cargando),
        { rol: "asistente", texto: respuesta },
      ]);
    } catch {
      setMensajes(prev => [
        ...prev.filter(m => !m.cargando),
        { rol: "asistente", texto: "❌ Error de conexión. Verifica que el servidor esté activo." },
      ]);
    } finally {
      setCargando(false);
    }
  };

  const limpiar = () =>
    setMensajes([{ rol: "asistente", texto: "Conversación reiniciada. ¿En qué te puedo ayudar?" }]);

  const sugerencias = [
    "¿Cómo va el taller hoy?",
    "¿Qué citas hay hoy?",
    "¿Quién viene mañana?",
    "¿Cuánto vendimos hoy por canal?",
    "¿Cuánto facturamos este mes?",
    "¿Cuántos miembros tienen los planes?",
    "¿Qué repuestos tienen stock bajo?",
    "Historial del vehículo placa ABC123",
    "¿Cuánto nos deben los clientes?",
  ];

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setAbierto(v => !v)}
        title="Asistente IA"
        style={{
          position:     "fixed",
          bottom:       24,
          right:        24,
          width:        52,
          height:       52,
          borderRadius: "50%",
          background:   abierto ? "#374151" : "linear-gradient(135deg,#1d4ed8,#6366f1)",
          color:        "#fff",
          border:       "none",
          cursor:       "pointer",
          fontSize:     22,
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          boxShadow:    "0 4px 20px rgba(99,102,241,0.5)",
          zIndex:       9999,
          transition:   "all 0.2s",
        }}
      >
        {abierto ? "✕" : "🤖"}
      </button>

      {/* Panel de chat */}
      {abierto && (
        <div style={{
          position:     "fixed",
          bottom:       88,
          right:        24,
          width:        380,
          maxHeight:    560,
          background:   "#0f172a",
          borderRadius: 16,
          border:       "1px solid #1e293b",
          boxShadow:    "0 20px 60px rgba(0,0,0,0.5)",
          display:      "flex",
          flexDirection:"column",
          zIndex:       9998,
          overflow:     "hidden",
        }}>

          {/* Header */}
          <div style={{
            padding:      "14px 18px",
            background:   "linear-gradient(135deg,#1d4ed8,#6366f1)",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "space-between",
            flexShrink:   0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#fff" }}>Asistente Sólido</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>Con acceso a tu base de datos</div>
              </div>
            </div>
            <button onClick={limpiar} title="Nueva conversación"
              style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8,
                color: "#fff", fontSize: 12, padding: "5px 10px", cursor: "pointer", fontWeight: 700 }}>
              🗑 Limpiar
            </button>
          </div>

          {/* Mensajes */}
          <div style={{
            flex:       1,
            overflowY:  "auto",
            padding:    "14px 16px",
            display:    "flex",
            flexDirection: "column",
            gap:        10,
          }}>
            {mensajes.map((m, i) => (
              <div key={i} style={{
                display:   "flex",
                justifyContent: m.rol === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth:     "82%",
                  padding:      "10px 14px",
                  borderRadius: m.rol === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background:   m.rol === "user" ? "#1d4ed8" : "#1e293b",
                  color:        "#f1f5f9",
                  fontSize:     13,
                  lineHeight:   1.5,
                  whiteSpace:   "pre-wrap",
                  wordBreak:    "break-word",
                }}>
                  {m.cargando
                    ? <span style={{ opacity: 0.6 }}>⏳ Consultando...</span>
                    : m.texto}
                </div>
              </div>
            ))}

            {/* Sugerencias rápidas — solo al inicio */}
            {mensajes.length === 1 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {sugerencias.map(s => (
                  <button key={s} onClick={() => { setPregunta(s); inputRef.current?.focus(); }}
                    style={{
                      background: "#1e293b", color: "#94a3b8", border: "1px solid #334155",
                      borderRadius: 20, padding: "5px 12px", fontSize: 11, cursor: "pointer",
                      fontWeight: 600, transition: "all 0.15s",
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{
            padding:    "10px 14px",
            borderTop:  "1px solid #1e293b",
            display:    "flex",
            gap:        8,
            flexShrink: 0,
            background: "#0f172a",
          }}>
            <input
              ref={inputRef}
              value={pregunta}
              onChange={e => setPregunta(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && enviar()}
              placeholder="Ej: ¿Cómo va el taller? ¿Cuánto facturamos?"
              disabled={cargando}
              style={{
                flex:         1,
                background:   "#1e293b",
                border:       "1px solid #334155",
                borderRadius: 10,
                color:        "#f1f5f9",
                padding:      "10px 14px",
                fontSize:     13,
                outline:      "none",
              }}
            />
            <button
              onClick={enviar}
              disabled={cargando || !pregunta.trim()}
              style={{
                background:   cargando || !pregunta.trim() ? "#334155" : "#1d4ed8",
                color:        "#fff",
                border:       "none",
                borderRadius: 10,
                padding:      "10px 14px",
                cursor:       cargando || !pregunta.trim() ? "not-allowed" : "pointer",
                fontWeight:   800,
                fontSize:     15,
                transition:   "background 0.15s",
              }}
            >
              {cargando ? "⏳" : "➤"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
