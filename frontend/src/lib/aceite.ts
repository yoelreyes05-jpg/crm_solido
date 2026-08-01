// ─────────────────────────────────────────────────────────────────────────────
// Opciones de aceite — Sólido Auto Servicio
//
// Estas listas existen para que NADIE teclee un valor inventado. La secretaria
// no tiene por qué saber cuántos cuartos lleva un motor, y el cliente tampoco:
// se elige de una lista cerrada y el sistema hace el resto.
//
// Se comparte entre la ficha del vehículo, la pantalla del técnico y el panel
// de catálogo, para que las tres hablen exactamente el mismo idioma.
// ─────────────────────────────────────────────────────────────────────────────

/** Cuartos de aceite, de 2.5 a 12.0 en pasos de 0.1 (con filtro incluido). */
export const CUARTOS_OPCIONES: string[] = Array.from(
  { length: Math.round((12.0 - 2.5) / 0.1) + 1 },
  (_, i) => (2.5 + i * 0.1).toFixed(1)
);

/** Viscosidades que se ven en el mercado dominicano. */
export const VISCOSIDADES: string[] = [
  "0W-8", "0W-16", "0W-20", "0W-30", "0W-40",
  "5W-20", "5W-30", "5W-40", "5W-50",
  "10W-30", "10W-40", "10W-60",
  "15W-40", "20W-50",
];

export const TIPOS_ACEITE: { valor: string; label: string; intervalo: number }[] = [
  { valor: "MINERAL",       label: "Mineral",       intervalo: 3000 },
  { valor: "SEMISINTETICO", label: "Semisintético", intervalo: 5000 },
  { valor: "SINTETICO",     label: "Sintético",     intervalo: 8000 },
];

/** Intervalos de cambio ofrecidos, en kilómetros. */
export const INTERVALOS_KM: number[] = [3000, 4000, 5000, 6000, 7500, 8000, 10000, 12000, 15000];

export const CILINDROS_OPCIONES: { valor: number; label: string }[] = [
  { valor: 3,  label: "3 cilindros" },
  { valor: 4,  label: "4 cilindros" },
  { valor: 5,  label: "5 cilindros" },
  { valor: 6,  label: "6 cilindros (V6)" },
  { valor: 8,  label: "8 cilindros (V8)" },
  { valor: 10, label: "10 cilindros" },
  { valor: 12, label: "12 cilindros" },
];

/** Etiqueta del nivel de confianza de una ficha técnica. */
export function confianzaLabel(c?: string): { texto: string; color: string; fondo: string } {
  switch (c) {
    case "VERIFICADO":
      return { texto: "✅ Verificado por el taller", color: "#16a34a", fondo: "#dcfce7" };
    case "MANUAL":
      return { texto: "📘 Según manual del fabricante", color: "#2563eb", fondo: "#dbeafe" };
    default:
      return { texto: "⚠️ Estimado — falta verificar", color: "#a16207", fondo: "#fef3c7" };
  }
}
