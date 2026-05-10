"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// El módulo de Diagnósticos fue unificado dentro del Hub de Órdenes (/ordenes/[id]).
// La creación de diagnósticos se realiza desde el módulo Taller (/taller/diagnostico/[id]).
export default function DiagnosticosPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/ordenes"); }, [router]);
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", color:"#6b7280", fontSize:14 }}>
      Redirigiendo a Órdenes...
    </div>
  );
}
