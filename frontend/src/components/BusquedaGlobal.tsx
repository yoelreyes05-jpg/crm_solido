"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { API_URL as API } from "@/config";

interface ResultadoBusqueda {
  clientes: Array<{ id: number; nombre: string; telefono?: string; cedula?: string }>;
  vehiculos: Array<{ id: number; marca: string; modelo: string; ano?: string; placa: string; cliente_nombre?: string }>;
  ordenes:   Array<{ id: number; numero_orden: string; estado: string; cliente_nombre: string; descripcion?: string }>;
}

const ESTADO_COLOR: Record<string, string> = {
  RECIBIDO:             "#3b82f6",
  DIAGNOSTICO:          "#f59e0b",
  ESPERANDO_APROBACION: "#f97316",
  REPARACION:           "#ef4444",
  CONTROL_CALIDAD:      "#8b5cf6",
  LISTO:                "#10b981",
  ENTREGADO:            "#6b7280",
  CANCELADA:            "#dc2626",
};

export default function BusquedaGlobal() {
  const router  = useRouter();
  const [query,     setQuery]     = useState("");
  const [resultado, setResultado] = useState<ResultadoBusqueda | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [abierto,   setAbierto]   = useState(false);
  const inputRef    = useRef<HTMLInputElement>(null);
  const wrapperRef  = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscar = useCallback(async (q: string) => {
    if (q.length < 2) { setResultado(null); setAbierto(false); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API}/busqueda?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResultado(data);
      setAbierto(true);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(v), 300);
  };

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { setAbierto(false); setQuery(""); }};
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const navegar = (ruta: string) => {
    setAbierto(false);
    setQuery("");
    setResultado(null);
    router.push(ruta);
  };

  const totalResultados = resultado
    ? resultado.clientes.length + resultado.vehiculos.length + resultado.ordenes.length
    : 0;

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      {/* INPUT */}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <span style={{
          position: "absolute", left: 10, fontSize: 15, color: "#64748b", pointerEvents: "none",
        }}>🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => { if (resultado && totalResultados > 0) setAbierto(true); }}
          placeholder="Buscar cliente, placa, OT…"
          style={{
            width: 260,
            padding: "8px 12px 8px 32px",
            background: "#0f172a",
            border: "1.5px solid #334155",
            borderRadius: 10,
            color: "#e2e8f0",
            fontSize: 13,
            outline: "none",
            transition: "border-color .2s",
          }}
          onMouseOver={e => (e.currentTarget.style.borderColor = "#3b82f6")}
          onMouseOut={e  => (e.currentTarget.style.borderColor = "#334155")}
        />
        {loading && (
          <span style={{
            position: "absolute", right: 10, fontSize: 12, color: "#64748b",
            animation: "spin 1s linear infinite",
          }}>⟳</span>
        )}
      </div>

      {/* DROPDOWN */}
      {abierto && resultado && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          width: 360,
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          zIndex: 9000,
          overflow: "hidden",
          maxHeight: 480,
          overflowY: "auto",
        }}>
          {totalResultados === 0 ? (
            <div style={{ padding: "20px 16px", textAlign: "center", color: "#64748b", fontSize: 13 }}>
              Sin resultados para <strong style={{ color: "#94a3b8" }}>"{query}"</strong>
            </div>
          ) : (
            <>
              {/* CLIENTES */}
              {resultado.clientes.length > 0 && (
                <Section titulo="👤 Clientes">
                  {resultado.clientes.map(c => (
                    <Item key={c.id} onClick={() => navegar(`/clientes`)}>
                      <div style={{ fontWeight: 600, color: "#f1f5f9", fontSize: 13 }}>{c.nombre}</div>
                      {c.telefono && <div style={{ fontSize: 12, color: "#64748b" }}>{c.telefono}{c.cedula ? ` · ${c.cedula}` : ""}</div>}
                    </Item>
                  ))}
                </Section>
              )}

              {/* VEHÍCULOS */}
              {resultado.vehiculos.length > 0 && (
                <Section titulo="🚗 Vehículos">
                  {resultado.vehiculos.map(v => (
                    <Item key={v.id} onClick={() => navegar(`/vehiculos`)}>
                      <div style={{ fontWeight: 600, color: "#f1f5f9", fontSize: 13 }}>
                        {v.marca} {v.modelo} {v.ano ? `(${v.ano})` : ""}
                        <span style={{ marginLeft: 8, background: "#0f172a", padding: "1px 7px", borderRadius: 5, fontSize: 11, color: "#38bdf8", fontFamily: "monospace" }}>
                          {v.placa}
                        </span>
                      </div>
                      {v.cliente_nombre && <div style={{ fontSize: 12, color: "#64748b" }}>{v.cliente_nombre}</div>}
                    </Item>
                  ))}
                </Section>
              )}

              {/* ÓRDENES */}
              {resultado.ordenes.length > 0 && (
                <Section titulo="🧾 Órdenes">
                  {resultado.ordenes.map(o => (
                    <Item key={o.id} onClick={() => navegar(`/ordenes/${o.id}`)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 13 }}>{o.numero_orden}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                          background: `${ESTADO_COLOR[o.estado] || "#64748b"}22`,
                          color: ESTADO_COLOR[o.estado] || "#64748b",
                        }}>{o.estado}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{o.cliente_nombre}</div>
                    </Item>
                  ))}
                </Section>
              )}
            </>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#64748b", textTransform: "uppercase" }}>
        {titulo}
      </div>
      {children}
      <div style={{ height: 1, background: "#334155", margin: "4px 0" }} />
    </div>
  );
}

function Item({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "8px 14px", cursor: "pointer",
        background: hover ? "#334155" : "transparent",
        transition: "background .15s",
      }}
    >
      {children}
    </div>
  );
}
