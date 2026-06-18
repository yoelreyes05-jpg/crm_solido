"use client";
import { useEffect, useState, useCallback } from "react";
import { API_URL as API } from "@/config";

const fmt = (n: any) => "RD$ " + Number(n || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const C = {
  bg: "#f5f7fb", card: "#fff", border: "#e5e7eb", text: "#111827", sub: "#6b7280",
  green: "#10b981", blue: "#2563eb", amber: "#d97706", cyan: "#0891b2",
};

export default function TecnicoLavadoPage() {
  const [usuario, setUsuario] = useState<any>(null);
  const [lavados, setLavados] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [marcando, setMarcando] = useState<number | null>(null);
  const [ultima, setUltima] = useState<Date>(new Date());

  useEffect(() => {
    try { setUsuario(JSON.parse(localStorage.getItem("usuario") || "null")); } catch { /* noop */ }
  }, []);

  const cargar = useCallback(async () => {
    try {
      const [l, c, v] = await Promise.all([
        fetch(`${API}/carwash`, { cache: "no-store" }).then(r => r.json()).catch(() => []),
        fetch(`${API}/clientes`, { cache: "no-store" }).then(r => r.json()).catch(() => []),
        fetch(`${API}/vehiculos`, { cache: "no-store" }).then(r => r.json()).catch(() => []),
      ]);
      setLavados(Array.isArray(l) ? l : []);
      setClientes(Array.isArray(c) ? c : []);
      setVehiculos(Array.isArray(v) ? v : []);
      setUltima(new Date());
    } catch { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, [cargar]);

  const cliMap: any = {}; clientes.forEach(c => { cliMap[c.id] = c; });
  const vehMap: any = {}; vehiculos.forEach(v => { vehMap[v.id] = v; });

  const esGerente = (usuario?.rol || "").toLowerCase() === "gerente";
  const mios = lavados.filter(o =>
    esGerente ? true : Number(o.tecnico_asignado_id) === Number(usuario?.id)
  );
  const enProceso = mios.filter(o => o.estado === "EN_LAVADO");
  const listos = mios.filter(o => o.estado === "LISTO");

  const marcarListo = async (id: number) => {
    setMarcando(id);
    try {
      const r = await fetch(`${API}/carwash/${id}/listo`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_nombre: usuario?.nombre || "Técnico de lavado" }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); alert(e.error || "No se pudo marcar listo"); }
      else await cargar();
    } catch (e: any) { alert("Error de conexión: " + e.message); }
    setMarcando(null);
  };

  const Card = ({ o, terminado }: { o: any; terminado: boolean }) => {
    const c = cliMap[o.cliente_id]; const v = vehMap[o.vehiculo_id];
    const veh = v ? [v.marca, v.modelo, v.placa].filter(Boolean).join(" ") : "Vehículo";
    return (
      <div style={{
        background: C.card, border: `1px solid ${terminado ? "#a7f3d0" : C.border}`,
        borderLeft: `6px solid ${terminado ? C.green : C.cyan}`,
        borderRadius: 16, padding: 18, boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.text, lineHeight: 1.15 }}>{veh}</div>
            <div style={{ fontSize: 15, color: C.sub, marginTop: 2 }}>{c?.nombre || "Cliente"}</div>
            <div style={{ fontSize: 14, color: C.text, marginTop: 6 }}>
              {o.descripcion} · <b>{fmt(o.total)}</b>
            </div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{o.numero_orden || `LAV-${o.id}`}</div>
          </div>
          <span style={{
            padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap",
            background: terminado ? "#dcfce7" : "#cffafe", color: terminado ? "#166534" : "#155e75",
          }}>
            {terminado ? "✓ LISTO" : "EN LAVADO"}
          </span>
        </div>

        {terminado ? (
          <div style={{ textAlign: "center", padding: "10px", background: "#f0fdf4", borderRadius: 12, color: "#166534", fontSize: 14, fontWeight: 700 }}>
            Avisado a caja — esperando cobro
          </div>
        ) : (
          <button
            onClick={() => marcarListo(o.id)}
            disabled={marcando === o.id}
            style={{
              width: "100%", padding: "18px", borderRadius: 14, border: "none", cursor: "pointer",
              background: marcando === o.id ? "#94a3b8" : C.green, color: "#fff",
              fontSize: 20, fontWeight: 900, boxShadow: `0 4px 14px ${C.green}55`,
            }}>
            {marcando === o.id ? "Guardando..." : "✓ Marcar como LISTO"}
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: 20, background: C.bg, minHeight: "100vh", fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: C.text, margin: 0 }}>🧼 Mis Lavados</h1>
        <button onClick={cargar} style={{ background: "#e0f2fe", color: C.cyan, border: `1px solid #bae6fd`, borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          🔄 Actualizar
        </button>
      </div>
      <p style={{ fontSize: 13, color: C.sub, margin: "0 0 18px" }}>
        {usuario?.nombre ? `Hola, ${usuario.nombre}. ` : ""}
        Estos son los vehículos asignados a ti. Al terminar, toca <b>Marcar como LISTO</b>.
        <span style={{ display: "block", marginTop: 2 }}>Actualizado {ultima.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}</span>
      </p>

      {loading ? (
        <p style={{ color: C.sub, textAlign: "center", padding: 40 }}>Cargando...</p>
      ) : (
        <>
          {/* En proceso */}
          <div style={{ fontSize: 13, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            🚿 Por lavar ({enProceso.length})
          </div>
          {enProceso.length === 0 ? (
            <div style={{ textAlign: "center", padding: 36, color: C.sub, background: C.card, borderRadius: 16, border: `1px dashed ${C.border}`, marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
              No tienes vehículos pendientes de lavar.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
              {enProceso.map(o => <Card key={o.id} o={o} terminado={false} />)}
            </div>
          )}

          {/* Listos / esperando cobro */}
          {listos.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                ✓ Terminados — esperando cobro ({listos.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {listos.map(o => <Card key={o.id} o={o} terminado={true} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
