// frontend/src/lib/asa.ts
// ─────────────────────────────────────────────────────────────────────────────
// Piezas compartidas del módulo ASA (flota y transportación).
//
// Todo lo que aparece en más de una pantalla vive aquí: el formato de dinero,
// la lectura del combustible en octavos, los colores por estado y el
// compresor de fotos. Repetirlo por página es como terminan dos pantallas
// mostrando "1/2 tanque" y "50%" para el mismo dato.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { API_URL as API } from "@/config";

export const API_ASA = `${API}/asa`;

// ── Formato ──────────────────────────────────────────────────────────────────

export const dinero = (n: any) =>
  "RD$ " + Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const km = (n: any) =>
  Number(n || 0).toLocaleString("es-DO", { maximumFractionDigits: 0 }) + " km";

export const fechaCorta = (f?: string | null) => {
  if (!f) return "—";
  const [a, m, d] = String(f).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

/** Hoy en RD (UTC-4), no la del navegador si está en otro huso. */
export const hoyRD = () =>
  new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);

// ── Combustible en octavos ───────────────────────────────────────────────────
//
// La aguja del tablero no dice porcentajes: dice E, 1/4, 1/2, 3/4, F. El
// conductor reporta lo que ve, no una conversión mental.

export const NIVELES = [
  { v: 0, label: "E",   texto: "Vacío",        color: "#dc2626" },
  { v: 1, label: "1/8", texto: "Casi vacío",   color: "#ea580c" },
  { v: 2, label: "1/4", texto: "Un cuarto",    color: "#f59e0b" },
  { v: 3, label: "3/8", texto: "Bajo mitad",   color: "#eab308" },
  { v: 4, label: "1/2", texto: "Mitad",        color: "#84cc16" },
  { v: 5, label: "5/8", texto: "Pasa mitad",   color: "#65a30d" },
  { v: 6, label: "3/4", texto: "Tres cuartos", color: "#22c55e" },
  { v: 7, label: "7/8", texto: "Casi lleno",   color: "#16a34a" },
  { v: 8, label: "F",   texto: "Lleno",        color: "#15803d" },
];

export const nivelCombustible = (octavos: any) =>
  NIVELES[Math.max(0, Math.min(8, Number(octavos ?? 4)))] ?? NIVELES[4];

// ── Catálogos de presentación ────────────────────────────────────────────────

export const ANGULOS = [
  { codigo: "FRONTAL",     label: "Frente",         icono: "🚘" },
  { codigo: "TRASERA",     label: "Atrás",          icono: "🚗" },
  { codigo: "LATERAL_IZQ", label: "Lado izquierdo", icono: "⬅️" },
  { codigo: "LATERAL_DER", label: "Lado derecho",   icono: "➡️" },
  { codigo: "TABLERO",     label: "Tablero",        icono: "📟" },
  { codigo: "INTERIOR",    label: "Interior",       icono: "💺" },
  { codigo: "DANO",        label: "Daño",           icono: "💥" },
];

export const TIPOS_GASTO = [
  { codigo: "COMBUSTIBLE",   label: "Combustible",   icono: "⛽", color: "#f59e0b" },
  { codigo: "MANTENIMIENTO", label: "Mantenimiento", icono: "🛠️", color: "#0ea5e9" },
  { codigo: "REPARACION",    label: "Reparación",    icono: "🔧", color: "#dc2626" },
  { codigo: "GOMAS",         label: "Gomas",         icono: "🛞", color: "#6366f1" },
  { codigo: "DOCUMENTOS",    label: "Marbete / docs", icono: "🏷️", color: "#8b5cf6" },
  { codigo: "SEGURO",        label: "Seguro",        icono: "🛡️", color: "#7c3aed" },
  { codigo: "PEAJE",         label: "Peaje",         icono: "🛣️", color: "#64748b" },
  { codigo: "PARQUEO",       label: "Parqueo",       icono: "🅿️", color: "#475569" },
  { codigo: "MULTA",         label: "Multa",         icono: "🚨", color: "#b91c1c" },
  { codigo: "LAVADO",        label: "Lavado",        icono: "🚿", color: "#06b6d4" },
  { codigo: "ACCESORIOS",    label: "Accesorios",    icono: "🎒", color: "#0d9488" },
  { codigo: "OTRO",          label: "Otro",          icono: "📦", color: "#6b7280" },
];

export const tipoGasto = (c: string) =>
  TIPOS_GASTO.find(t => t.codigo === c) ?? { codigo: c, label: c, icono: "📦", color: "#6b7280" };

export const COLOR_SEVERIDAD: Record<string, string> = {
  LEVE: "#0ea5e9", MODERADA: "#f59e0b", GRAVE: "#dc2626",
};

export const COLOR_ESTADO_VEH: Record<string, string> = {
  ACTIVO: "#16a34a", EN_TALLER: "#f59e0b", FUERA_SERVICIO: "#dc2626", VENDIDO: "#6b7280",
};

export const COLOR_ESTADO_FALLA: Record<string, string> = {
  ABIERTA: "#dc2626", EN_REVISION: "#f59e0b", EN_TALLER: "#0ea5e9",
  RESUELTA: "#16a34a", DESCARTADA: "#6b7280",
};

// ── Estilos compartidos ──────────────────────────────────────────────────────

export const S = {
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 20, marginBottom: 16 } as React.CSSProperties,
  input: { display: "block", padding: "10px 12px", width: "100%", borderRadius: 9, border: "1px solid #e2e8f0", fontSize: 14, background: "#fafafa", color: "#111827", boxSizing: "border-box" } as React.CSSProperties,
  label: { fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 4, display: "block" } as React.CSSProperties,
  btn: { padding: "10px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: "#1d4ed8", color: "#fff" } as React.CSSProperties,
  btnGhost: { padding: "7px 12px", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer", fontWeight: 700, fontSize: 12, background: "#fff", color: "#334155" } as React.CSSProperties,
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#64748b", background: "#f8fafc", textTransform: "uppercase" as const, letterSpacing: 0.4, whiteSpace: "nowrap" as const },
  td: { padding: "10px 12px", fontSize: 13, color: "#111827", borderBottom: "1px solid #eef2f7" },
  chip: (color: string): React.CSSProperties => ({
    display: "inline-block", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 800,
    background: color + "1a", color, border: `1px solid ${color}44`, whiteSpace: "nowrap",
  }),
};

// ── Fotos ────────────────────────────────────────────────────────────────────

/**
 * Reduce la foto antes de subirla.
 *
 * Una foto de celular pesa 3–5MB. Cinco por vehículo por día revientan tanto
 * el límite del body parser como el plan de datos del conductor, que casi
 * siempre está en la calle. A 1280px de lado largo y calidad 0.72 la placa y
 * cualquier golpe se siguen viendo, y el archivo baja a unos 150KB.
 */
export function comprimirImagen(archivo: File, ladoMax = 1280, calidad = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error("No se pudo leer la foto."));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("La foto está dañada."));
      img.onload = () => {
        const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
        const w = Math.round(img.width * escala);
        const h = Math.round(img.height * escala);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("El navegador no pudo procesar la foto."));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", calidad));
      };
      img.src = String(lector.result);
    };
    lector.readAsDataURL(archivo);
  });
}

// ── Llamadas ─────────────────────────────────────────────────────────────────

export async function asaGet<T = any>(ruta: string): Promise<T> {
  const r = await fetch(`${API_ASA}${ruta}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d?.error) throw new Error(d?.mensaje || `Error ${r.status}`);
  return d as T;
}

export async function asaEnviar<T = any>(
  ruta: string, metodo: "POST" | "PATCH" | "PUT" | "DELETE", cuerpo?: any, cabeceras: Record<string, string> = {}
): Promise<T> {
  const r = await fetch(`${API_ASA}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...cabeceras },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d?.error) throw new Error(d?.mensaje || `Error ${r.status}`);
  return d as T;
}
