"use client";
import React, { useEffect, useState } from "react";

import { S, asaGet } from "@/lib/asa";

// ─────────────────────────────────────────────────────────────────────────────
// 🗑️ CONFIRMAR UN BORRADO DEFINITIVO
//
// Antes de preguntar, cuenta lo que se va a perder y lo pone en pantalla. Un
// "¿estás seguro?" no frena a nadie; "vas a borrar 340 partes, 52 gastos y 180
// fotos" sí.
//
// Y para que el clic no pueda ser un accidente, hay que escribir el nombre de
// lo que se borra. Es el único sitio del módulo donde se obliga a teclear, y
// es a propósito: aquí la fricción es la función.
// ─────────────────────────────────────────────────────────────────────────────

const ETIQUETAS: Record<string, string> = {
  chequeos:            "partes diarios",
  gastos:              "gastos registrados",
  fotos:               "fotos",
  fallas:              "fallas reportadas",
  documentos:          "documentos (marbete, seguro…)",
  mantenimientos:      "mantenimientos programados",
  asignaciones:        "asignaciones en el historial",
  vehiculos_asignados: "vehículos que tiene asignados",
};

export default function ConfirmarBorradoASA({
  titulo, nombre, ruta, aviso, onCerrar, onConfirmar,
}: {
  titulo: string;
  /** Lo que el usuario tiene que escribir para confirmar (código o nombre). */
  nombre: string;
  /** Ruta del endpoint de dependencias, ej. "/vehiculos/3/dependencias". */
  ruta: string;
  aviso?: React.ReactNode;
  onCerrar: () => void;
  onConfirmar: () => Promise<void> | void;
}) {
  const [dep, setDep]           = useState<Record<string, number> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto]       = useState("");
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    asaGet<any>(ruta)
      .then(d => setDep(d.dependencias || {}))
      // Si no se pudo contar, no se bloquea el borrado: se avisa que se está
      // decidiendo a ciegas, que es peor pero sigue siendo decisión del usuario.
      .catch(() => setDep(null))
      .finally(() => setCargando(false));
  }, [ruta]);

  const conDatos = dep ? Object.entries(dep).filter(([, n]) => Number(n) > 0) : [];
  const puede = texto.trim().toLowerCase() === nombre.trim().toLowerCase();

  return (
    <div onClick={onCerrar} style={{
      position: "fixed", inset: 0, background: "#0f172acc", zIndex: 300,
      display: "grid", placeItems: "center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 480,
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 24 }}>🗑️</span>
          <h2 style={{ margin: 0, fontSize: 19, color: "#b91c1c" }}>{titulo}</h2>
        </div>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 0 }}>
          Esto <b>no se puede deshacer</b>. Si solo quieres que deje de aparecer en las
          pantallas, usa <b>Dar de baja</b> — se guarda todo y se puede reactivar.
        </p>

        {aviso && (
          <div style={{
            background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e",
            borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 14, lineHeight: 1.5,
          }}>{aviso}</div>
        )}

        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#991b1b", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
            Se borra también
          </div>
          {cargando ? (
            <div style={{ fontSize: 13, color: "#7f1d1d" }}>Contando…</div>
          ) : dep === null ? (
            <div style={{ fontSize: 13, color: "#7f1d1d" }}>
              No se pudo contar el historial. Estarías borrando sin saber cuánto se pierde.
            </div>
          ) : conDatos.length === 0 ? (
            <div style={{ fontSize: 13, color: "#166534" }}>
              Nada. No tiene historial asociado — se puede borrar sin perder información.
            </div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#7f1d1d", lineHeight: 1.8 }}>
              {conDatos.map(([k, n]) => (
                <li key={k}><b>{n}</b> {ETIQUETAS[k] || k.replace(/_/g, " ")}</li>
              ))}
            </ul>
          )}
        </div>

        <label style={S.label}>
          Escribe <b style={{ color: "#0f172a" }}>{nombre}</b> para confirmar
        </label>
        <input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder={nombre}
          autoFocus
          style={{ ...S.input, borderColor: puede ? "#16a34a" : "#e2e8f0" }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button onClick={onCerrar} style={S.btnGhost}>Cancelar</button>
          <button
            disabled={!puede || borrando}
            onClick={async () => { setBorrando(true); try { await onConfirmar(); } finally { setBorrando(false); } }}
            style={{
              ...S.btn,
              background: puede ? "#dc2626" : "#cbd5e1",
              cursor: puede && !borrando ? "pointer" : "not-allowed",
            }}
          >
            {borrando ? "Borrando…" : "Borrar definitivamente"}
          </button>
        </div>
      </div>
    </div>
  );
}
