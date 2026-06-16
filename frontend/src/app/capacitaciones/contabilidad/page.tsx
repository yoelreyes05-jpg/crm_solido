"use client";
import Link from "next/link";
import ModuloContable from "@/components/ModuloContable";

export default function CapacitacionContabilidadPage() {
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>📊 Contabilidad — Capacitación</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>Caja chica, cuentas por cobrar y por pagar — independiente del taller</p>
        </div>
        <Link href="/capacitaciones" style={{ textDecoration: "none", background: "#f1f5f9", color: "#334155", border: "1px solid #e2e8f0", borderRadius: 9, padding: "9px 16px", fontWeight: 700, fontSize: 13 }}>
          ← Volver a Capacitaciones
        </Link>
      </div>

      <ModuloContable
        apiBase="/capacitacion/contabilidad"
        theme="light"
        titulo="Contabilidad de Capacitación"
        usuario="Capacitación"
        nombreEntidad="Alumno / Empresa"
        nombreSuplidor="Proveedor / Instructor"
      />
    </div>
  );
}
