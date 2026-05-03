"use client";
import { useState, useEffect } from "react";
import { API_URL as API } from "@/config";

const ESTADO_INFO = {
  RECIBIDO:        { color: "#60a5fa", grad: "linear-gradient(135deg,#1e3a5f,#2563eb)", emoji: "📋", paso: 1, msg: "Tu vehículo fue recibido. Pronto será evaluado." },
  DIAGNOSTICO:     { color: "#fbbf24", grad: "linear-gradient(135deg,#451a03,#d97706)", emoji: "🔍", paso: 2, msg: "Nuestro técnico está evaluando tu vehículo." },
  REPARACION:      { color: "#f87171", grad: "linear-gradient(135deg,#450a0a,#dc2626)", emoji: "🔧", paso: 3, msg: "Tu vehículo está siendo reparado por nuestro equipo." },
  CONTROL_CALIDAD: { color: "#a78bfa", grad: "linear-gradient(135deg,#2e1065,#7c3aed)", emoji: "✅", paso: 4, msg: "Revisión final de calidad en proceso." },
  LISTO:           { color: "#34d399", grad: "linear-gradient(135deg,#022c22,#059669)", emoji: "🎉", paso: 5, msg: "¡Tu vehículo está listo! Puedes pasar a recogerlo." },
  ENTREGADO:       { color: "#94a3b8", grad: "linear-gradient(135deg,#1e293b,#475569)", emoji: "🚗", paso: 6, msg: "Vehículo entregado. ¡Gracias por tu confianza!" },
};

const PASOS       = ["RECIBIDO","DIAGNOSTICO","REPARACION","CONTROL_CALIDAD","LISTO","ENTREGADO"];
const PASOS_LABEL = ["Recibido","Diagnóstico","Reparación","C. Calidad","Listo","Entregado"];

export default function ClienteApp() {
  const [placa, setPlaca]                   = useState("");
  const [resultado, setResultado]           = useState<any>(null);
  const [repuestos, setRepuestos]           = useState<any[]>([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");
  const [tab, setTab]                       = useState("estado");
  const [instalable, setInstalable]         = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showRepuestos, setShowRepuestos]   = useState(false);
  const [loadingRepuestos, setLoadingRepuestos] = useState(false);
  const [repuestoAbierto, setRepuestoAbierto]   = useState<number | null>(null);
  const [esIOS, setEsIOS]                   = useState(false);

  // ── REPUESTOS — búsqueda + paginación ──
  const [repuestoSearch, setRepuestoSearch] = useState("");
  const [repuestosPage, setRepuestosPage]   = useState(1);
  const PAGE_SIZE = 15;

  // ── CAFETERÍA ──
  const [showCafe, setShowCafe]             = useState(false);
  const [cafe, setCafe]                     = useState<any[]>([]);
  const [loadingCafe, setLoadingCafe]       = useState(false);
  const [cafeAbierto, setCafeAbierto]       = useState<number | null>(null);
  const [cafeSearch, setCafeSearch]         = useState("");
  const [cafePage, setCafePage]             = useState(1);

  // ── HISTORIAL PERMANENTE ──
  const [historialPerm, setHistorialPerm]   = useState<any[]>([]);
  const [histDetalle, setHistDetalle]       = useState<any>(null);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setEsIOS(ios);

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => console.log('SW registrado:', reg.scope))
          .catch(err => console.error('SW error:', err));
      });
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstalable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const verRepuestos = async () => {
    const nuevoEstado = !showRepuestos;
    setShowRepuestos(nuevoEstado);
    setRepuestoAbierto(null);
    if (!nuevoEstado || repuestos.length > 0) return;
    setLoadingRepuestos(true);
    try {
      const res  = await fetch(`${API}/inventario`);
      const data = await res.json();
      setRepuestos(data || []);
    } catch {}
    finally { setLoadingRepuestos(false); }
  };

  const verCafe = async () => {
    const nuevo = !showCafe;
    setShowCafe(nuevo);
    setCafeAbierto(null);
    if (!nuevo || cafe.length > 0) return;
    setLoadingCafe(true);
    try {
      const res  = await fetch(`${API}/cafeteria/productos`);
      const data = await res.json();
      setCafe(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoadingCafe(false); }
  };

  const instalarApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalable(false);
    setDeferredPrompt(null);
  };

  const buscar = async () => {
    if (!placa.trim()) return setError("Ingresa la placa de tu vehículo");
    setLoading(true); setError(""); setResultado(null); setHistorialPerm([]); setHistDetalle(null);
    try {
      const placaNorm = placa.trim().toUpperCase();
      const [vRes, oRes, dRes, hRes] = await Promise.all([
        fetch(`${API}/vehiculos`),
        fetch(`${API}/ordenes`),
        fetch(`${API}/diagnosticos`),
        fetch(`${API}/vehiculo-historial/placa/${encodeURIComponent(placaNorm)}`),
      ]);
      const vehiculos    = await vRes.json();
      const ordenes      = await oRes.json();
      const diagnosticos = await dRes.json();
      const histData     = await hRes.json();

      const vehiculo = vehiculos.find((v: any) =>
        v.placa?.toUpperCase() === placaNorm
      );
      if (!vehiculo && (!histData.found)) {
        setError("No encontramos un vehículo con esa placa. Verifica e intenta de nuevo.");
        return;
      }

      if (histData.found) setHistorialPerm(histData.historial || []);

      if (vehiculo) {
        const ordenesVehiculo = ordenes
          .filter((o: any) => o.vehiculo_id === vehiculo.id || o.vehiculo_info?.includes(vehiculo.placa))
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const diagVehiculo = diagnosticos
          .filter((d: any) => d.vehiculo_id === vehiculo.id)
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setResultado({ vehiculo, ordenes: ordenesVehiculo, diagnosticos: diagVehiculo });
      } else if (histData.found) {
        // Vehículo eliminado del sistema activo pero existe historial
        setResultado({
          vehiculo: { ...histData.vehiculo, id: null },
          ordenes: [], diagnosticos: []
        });
      }
    } catch {
      setError("Error de conexión. Intenta más tarde.");
    } finally {
      setLoading(false);
    }
  };

  const ultimaOrden = resultado?.ordenes?.[0];
  const estadoInfo  = ultimaOrden ? (ESTADO_INFO[ultimaOrden.estado as keyof typeof ESTADO_INFO] || ESTADO_INFO.RECIBIDO) : null;
  const pasoActual  = estadoInfo ? estadoInfo.paso : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080c14; }

        .sas-root {
          max-width: 480px; margin: 0 auto; min-height: 100vh;
          background: #080c14; font-family: 'DM Sans', sans-serif;
          color: #e2e8f0; position: relative; overflow-x: hidden;
        }
        .sas-root::before {
          content:''; position:fixed; inset:0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events:none; z-index:0; opacity:.4;
        }
        .sas-content { position:relative; z-index:1; }

        .sas-header {
          background: linear-gradient(170deg, #0f172a 0%, #1e293b 100%);
          padding: 36px 24px 28px; text-align: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          position: relative; overflow: hidden;
        }
        .sas-header::after {
          content:''; position:absolute; width:280px; height:280px; border-radius:50%;
          background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%);
          top:-80px; left:50%; transform:translateX(-50%); pointer-events:none;
        }
        .sas-logo {
          width:80px; height:80px; object-fit:contain; border-radius:20px;
          box-shadow: 0 0 30px rgba(59,130,246,0.3); margin-bottom:14px;
        }
        .sas-title {
          font-family:'Syne',sans-serif; font-size:20px; font-weight:800; letter-spacing:2px;
          background: linear-gradient(135deg,#fff 30%,#93c5fd);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }
        .sas-subtitle { font-size:12px; color:#64748b; margin-top:6px; letter-spacing:.5px; }

        .btn-install {
          margin-top:16px; padding:10px 22px;
          background:linear-gradient(135deg,#1d4ed8,#3b82f6);
          color:#fff; border:none; border-radius:100px;
          font-family:'DM Sans',sans-serif; font-weight:600; font-size:13px;
          cursor:pointer; box-shadow:0 4px 15px rgba(59,130,246,0.3);
          display:block; margin-left:auto; margin-right:auto;
        }
        .ios-hint {
          margin-top:12px; padding:10px 16px;
          background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2);
          border-radius:12px; font-size:12px; color:#93c5fd; line-height:1.7;
        }
        .sas-hint { font-size:11px; color:#334155; margin-top:10px; }

        .quick-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:14px; }
        .btn-quick {
          padding:15px 10px; border-radius:16px; border:none;
          font-family:'DM Sans',sans-serif; font-weight:700; font-size:13px;
          cursor:pointer; transition:transform .15s;
        }
        .btn-quick:active { transform:scale(.97); }
        .btn-repuestos { background:linear-gradient(135deg,#1e3a5f,#2563eb); color:#fff; box-shadow:0 4px 14px rgba(37,99,235,.3); }
        .btn-cafe      { background:linear-gradient(135deg,#7c2d12,#ea580c); color:#fff; box-shadow:0 4px 14px rgba(234,88,12,.3); }
        .btn-wa-q      { background:linear-gradient(135deg,#14532d,#16a34a); color:#fff; box-shadow:0 4px 14px rgba(22,163,74,.3); }

        .card {
          background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.07);
          border-radius:20px; padding:20px; backdrop-filter:blur(12px); margin-bottom:12px;
        }
        .card-title {
          font-family:'Syne',sans-serif; font-size:16px; font-weight:700;
          color:#f1f5f9; margin-bottom:14px; letter-spacing:.5px;
        }

        /* ACORDEÓN */
        .prod-accordion { display:flex; flex-direction:column; gap:6px; }
        .prod-item { border-radius:14px; border:1px solid rgba(255,255,255,0.07); overflow:hidden; transition:border-color .2s; }
        .prod-item.open { border-color:rgba(52,211,153,0.3); }
        .prod-item-header {
          display:flex; justify-content:space-between; align-items:center;
          padding:13px 16px; cursor:pointer; background:rgba(255,255,255,0.03);
          transition:background .15s; user-select:none;
        }
        .prod-item-header:active { background:rgba(255,255,255,0.07); }
        .prod-item-name { font-weight:600; font-size:14px; color:#e2e8f0; display:flex; align-items:center; gap:8px; }
        .prod-item-arrow { font-size:11px; color:#475569; transition:transform .25s; }
        .prod-item-arrow.open { transform:rotate(180deg); color:#34d399; }
        .prod-item-body {
          max-height:0; overflow:hidden; transition:max-height .3s ease, padding .3s ease;
          padding:0 16px; background:rgba(0,0,0,0.2);
        }
        .prod-item-body.open { max-height:120px; padding:12px 16px 14px; }
        .prod-price-big { font-family:'Syne',sans-serif; font-weight:800; font-size:22px; color:#34d399; margin-bottom:4px; }
        .prod-stock-badge { font-size:11px; font-weight:700; padding:3px 10px; border-radius:100px; }
        .stock-ok { background:rgba(52,211,153,0.15); color:#34d399; }
        .stock-no { background:rgba(248,113,113,0.15); color:#f87171; }
        .loading-dots { font-size:13px; color:#475569; text-align:center; padding:12px; }

        /* SEARCH ACORDEÓN */
        .search-acord {
          display:flex; align-items:center; gap:8px;
          background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
          border-radius:12px; padding:10px 14px; margin-bottom:12px;
        }
        .search-acord input {
          flex:1; background:transparent; border:none; outline:none;
          color:#e2e8f0; font-family:'DM Sans',sans-serif; font-size:14px;
        }
        .search-acord input::placeholder { color:#475569; }
        .search-acord span { font-size:16px; flex-shrink:0; }
        .btn-ver-mas {
          width:100%; margin-top:10px; padding:12px;
          background:rgba(59,130,246,0.12); border:1px solid rgba(59,130,246,0.25);
          border-radius:12px; color:#93c5fd; font-family:'DM Sans',sans-serif;
          font-weight:700; font-size:13px; cursor:pointer; transition:background .15s;
        }
        .btn-ver-mas:active { background:rgba(59,130,246,0.2); }
        .result-count { font-size:11px; color:#475569; margin-bottom:8px; text-align:right; }

        /* BUSCADOR */
        .search-intro { font-size:14px; color:#334155; line-height:1.7; margin-bottom:20px; }
        .field-label { font-size:12px; font-weight:600; color:#64748b; letter-spacing:.8px; text-transform:uppercase; display:block; margin-bottom:10px; }
        .input-placa {
          display:block; width:100%; padding:18px;
          font-family:'Syne',sans-serif; font-size:28px; font-weight:800;
          text-align:center; letter-spacing:8px; text-transform:uppercase;
          background:rgba(255,255,255,0.04); border:2px solid rgba(255,255,255,0.1);
          border-radius:14px; color:#fff; margin-bottom:16px;
          transition:border-color .2s, box-shadow .2s; outline:none;
        }
        .input-placa:focus { border-color:#3b82f6; box-shadow:0 0 0 4px rgba(59,130,246,0.12); }
        .input-placa::placeholder { color:#334155; letter-spacing:4px; }
        .error-banner {
          background:rgba(220,38,38,0.1); border:1px solid rgba(220,38,38,0.3);
          color:#fca5a5; padding:13px 16px; border-radius:12px;
          font-size:13px; font-weight:500; margin-bottom:14px;
        }
        .btn-buscar {
          width:100%; padding:17px; border:none; border-radius:14px;
          font-family:'Syne',sans-serif; font-weight:800; font-size:16px; letter-spacing:.5px;
          cursor:pointer; transition:opacity .2s, transform .15s;
          background:linear-gradient(135deg,#1d4ed8,#3b82f6);
          color:#fff; box-shadow:0 6px 20px rgba(59,130,246,0.35);
        }
        .btn-buscar:disabled { opacity:.4; cursor:not-allowed; }
        .btn-buscar:not(:disabled):active { transform:scale(.98); }

        /* RESULTADO */
        .btn-volver {
          margin-bottom:14px; padding:10px 20px;
          background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
          border-radius:100px; cursor:pointer; font-weight:600; font-size:13px; color:#94a3b8;
        }
        .car-card {
          background:linear-gradient(135deg,#0f1729 0%,#1e3a5f 100%);
          border:1px solid rgba(59,130,246,0.2); border-radius:22px; padding:22px;
          margin-bottom:12px; position:relative; overflow:hidden;
        }
        .car-card::before {
          content:''; position:absolute; right:-30px; top:-30px;
          width:160px; height:160px; border-radius:50%;
          background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);
        }
        .car-main { display:flex; gap:16px; align-items:center; position:relative; }
        .car-emoji { font-size:52px; }
        .car-marca { font-family:'Syne',sans-serif; font-size:22px; font-weight:800; color:#fff; }
        .car-meta  { font-size:13px; color:#64748b; margin-top:4px; }
        .placa-badge {
          margin-top:12px; display:inline-block;
          background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.15);
          padding:8px 20px; border-radius:10px;
          font-family:'Syne',sans-serif; font-weight:900; font-size:20px;
          letter-spacing:5px; color:#93c5fd;
        }

        /* ESTADO */
        .estado-card { border-radius:22px; padding:22px; margin-bottom:12px; overflow:hidden; }
        .estado-top-label { font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:14px; }
        .estado-row { display:flex; align-items:center; gap:16px; margin-bottom:20px; }
        .estado-emoji { font-size:48px; }
        .estado-name { font-family:'Syne',sans-serif; font-size:22px; font-weight:800; color:#fff; }
        .estado-msg  { font-size:13px; color:rgba(255,255,255,0.6); margin-top:4px; line-height:1.6; }

        .progress-wrap { display:flex; justify-content:space-between; gap:4px; }
        .prog-step { display:flex; flex-direction:column; align-items:center; flex:1; }
        .prog-dot {
          width:28px; height:28px; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          font-size:11px; font-weight:800;
        }
        .prog-dot-done   { background:rgba(255,255,255,0.2); color:#fff; }
        .prog-dot-active { background:#fff; color:#111; box-shadow:0 0 12px rgba(255,255,255,0.4); }
        .prog-dot-future { background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.25); }
        .prog-label { font-size:8px; margin-top:5px; text-align:center; font-weight:600; white-space:nowrap; }
        .prog-label-on  { color:rgba(255,255,255,0.85); }
        .prog-label-off { color:rgba(255,255,255,0.2); }

        .tabs-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; }
        .tab-btn {
          padding:13px 8px; border-radius:14px; border:1px solid rgba(255,255,255,0.07);
          font-family:'DM Sans',sans-serif; font-weight:700; font-size:13px; cursor:pointer; transition:all .2s;
        }
        .tab-active   { background:linear-gradient(135deg,#1d4ed8,#3b82f6); color:#fff; border-color:transparent; box-shadow:0 4px 14px rgba(59,130,246,.3); }
        .tab-inactive { background:rgba(255,255,255,0.04); color:#64748b; }

        .orden-card {
          border-radius:18px; padding:18px; margin-bottom:10px;
          background:rgba(15,23,42,0.95); border:1px solid rgba(255,255,255,0.07); border-left:4px solid;
        }
        .orden-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
        .orden-id    { font-family:'Syne',sans-serif; font-weight:800; font-size:15px; color:#f1f5f9; }
        .orden-badge { padding:4px 14px; border-radius:100px; font-size:11px; font-weight:700; }
        .orden-desc  { font-size:13px; color:#64748b; line-height:1.6; }
        .btn-wa-card {
          margin-top:14px; width:100%; padding:12px;
          background:linear-gradient(135deg,#14532d,#16a34a);
          color:#fff; border:none; border-radius:12px;
          font-family:'DM Sans',sans-serif; font-weight:700; font-size:13px;
          cursor:pointer; box-shadow:0 4px 14px rgba(22,163,74,.25);
        }

        .diag-card {
          border-radius:18px; padding:18px; margin-bottom:10px;
          background:rgba(15,23,42,0.95); border:1px solid rgba(255,255,255,0.07);
        }
        .diag-tipo { font-family:'Syne',sans-serif; font-weight:700; font-size:14px; color:#e2e8f0; margin-bottom:6px; }
        .diag-obs  { font-size:13px; color:#64748b; line-height:1.6; }

        /* ── HISTORIAL PERMANENTE ── */
        .hist-timeline { position:relative; padding-left:20px; }
        .hist-timeline::before {
          content:''; position:absolute; left:7px; top:0; bottom:0;
          width:2px; background:rgba(255,255,255,0.07); border-radius:2px;
        }
        .hist-item {
          position:relative; margin-bottom:14px; cursor:pointer;
          background:rgba(15,23,42,0.95); border:1px solid rgba(255,255,255,0.07);
          border-radius:18px; padding:16px 16px 14px;
          transition: border-color .2s, transform .15s;
        }
        .hist-item:active { transform:scale(.98); }
        .hist-item.open { border-color:rgba(52,211,153,0.3); }
        .hist-item::before {
          content:''; position:absolute; left:-16px; top:18px;
          width:14px; height:14px; border-radius:50%;
          background:linear-gradient(135deg,#1d4ed8,#3b82f6);
          box-shadow:0 0 8px rgba(59,130,246,0.5); border:2px solid #080c14;
        }
        .hist-servicio { font-family:'Syne',sans-serif; font-weight:700; font-size:14px; color:#e2e8f0; margin-bottom:4px; }
        .hist-meta { font-size:12px; color:#475569; margin-bottom:8px; }
        .hist-cost { font-family:'Syne',sans-serif; font-weight:800; font-size:18px; color:#34d399; }
        .hist-badge {
          display:inline-block; padding:2px 10px; border-radius:100px;
          font-size:11px; font-weight:700; background:rgba(52,211,153,0.12); color:#34d399; margin-left:8px;
        }
        .hist-body { margin-top:12px; border-top:1px solid rgba(255,255,255,0.06); padding-top:12px; }
        .hist-section { margin-bottom:10px; }
        .hist-section-title { font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#475569; margin-bottom:6px; }
        .hist-section-text { font-size:13px; color:#94a3b8; line-height:1.7; white-space:pre-wrap; }
        .hist-falla { background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.2); border-radius:10px; padding:10px 12px; margin-bottom:8px; }
        .hist-falla-title { font-size:10px; font-weight:700; color:#fbbf24; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
        .hist-falla-text { font-size:13px; color:#fde68a; line-height:1.6; }
        .hist-costos { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
        .hist-costo-box { background:rgba(255,255,255,0.04); border-radius:10px; padding:10px; text-align:center; }
        .hist-costo-label { font-size:10px; color:#475569; text-transform:uppercase; letter-spacing:.8px; margin-bottom:4px; }
        .hist-costo-val { font-family:'Syne',sans-serif; font-weight:700; font-size:14px; color:#e2e8f0; }
        .hist-ncf { font-size:11px; color:#475569; margin-top:8px; }

        .hist-empty { text-align:center; padding:28px 16px; color:#334155; }
        .hist-empty-icon { font-size:36px; margin-bottom:10px; }
        .hist-empty-txt { font-size:14px; font-weight:600; color:#475569; }
        .hist-empty-sub { font-size:12px; color:#1e293b; margin-top:6px; }

        .wa-float {
          position:fixed; bottom:22px; right:22px;
          background:linear-gradient(135deg,#15803d,#22c55e);
          color:#fff; width:58px; height:58px; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          font-size:26px; text-decoration:none;
          box-shadow:0 6px 24px rgba(34,197,94,.45);
          z-index:999; transition:transform .15s;
        }
        .wa-float:active { transform:scale(.93); }

        .footer { text-align:center; padding:30px 0 80px; color:#1e293b; font-size:12px; }
        .footer-brand { font-family:'Syne',sans-serif; font-weight:700; font-size:14px; color:#334155; margin:6px 0 2px; }

        @keyframes fadeUp { from{ opacity:0; transform:translateY(16px); } to{ opacity:1; transform:translateY(0); } }
        .fade-up  { animation:fadeUp .4s ease both; }
        .delay-1  { animation-delay:.05s; }
        .delay-2  { animation-delay:.10s; }
        .delay-3  { animation-delay:.15s; }
      `}</style>

      <div className="sas-root">
        <div className="sas-content">

          {/* ── HEADER ── */}
          <div className="sas-header">
            <img
              src="/logo-192x192.png"
              alt="Logo Sólido"
              className="sas-logo"
              onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }}
            />
            <div className="sas-title">SÓLIDO AUTO SERVICIO & CAFE</div>
            <div className="sas-subtitle">Portal del Cliente · 809-712-2027</div>

            {instalable && (
              <button onClick={instalarApp} className="btn-install">
                📲 Instalar App
              </button>
            )}
            {!instalable && esIOS && (
              <div className="ios-hint">
                🍎 iPhone/iPad: toca <strong>Compartir</strong> → <strong>Agregar a inicio</strong>
              </div>
            )}
            {!instalable && !esIOS && (
              <div className="sas-hint">📲 Menú del navegador → Agregar a pantalla de inicio</div>
            )}
          </div>

          {/* ── BODY ── */}
          <div style={{ padding:"16px" }}>

            {/* ── ACCIONES RÁPIDAS (3 botones) ── */}
            <div className="quick-grid fade-up">
              <button onClick={verRepuestos} className="btn-quick btn-repuestos">
                🔩 {showRepuestos ? "Ocultar" : "Repuestos"}
              </button>
              <button onClick={verCafe} className="btn-quick btn-cafe">
                ☕ {showCafe ? "Ocultar" : "Menú Café"}
              </button>
              <button
                onClick={() => window.open("https://wa.me/18097122027","_blank")}
                className="btn-quick btn-wa-q"
              >
                💬 WhatsApp
              </button>
            </div>

            {/* ── ACORDEÓN REPUESTOS ── */}
            {showRepuestos && (
              <div className="card fade-up">
                <div className="card-title">🔩 Repuestos Disponibles</div>
                {loadingRepuestos ? (
                  <div className="loading-dots">Cargando repuestos...</div>
                ) : repuestos.length === 0 ? (
                  <div className="loading-dots">Sin repuestos disponibles.</div>
                ) : (() => {
                  const filtrados = repuestos.filter((p: any) =>
                    !repuestoSearch || p.name?.toLowerCase().includes(repuestoSearch.toLowerCase())
                  );
                  const visibles = filtrados.slice(0, repuestosPage * PAGE_SIZE);
                  const hayMas   = visibles.length < filtrados.length;
                  return (
                    <>
                      <div className="search-acord">
                        <span>🔍</span>
                        <input
                          value={repuestoSearch}
                          onChange={e => { setRepuestoSearch(e.target.value); setRepuestosPage(1); }}
                          placeholder="Buscar repuesto por nombre..."
                        />
                        {repuestoSearch && (
                          <span style={{ cursor:"pointer", fontSize:13, color:"#64748b" }}
                            onClick={() => { setRepuestoSearch(""); setRepuestosPage(1); }}>✕</span>
                        )}
                      </div>
                      <div className="result-count">
                        {repuestoSearch ? `${filtrados.length} resultado${filtrados.length !== 1 ? "s" : ""}` : `${repuestos.length} artículos`}
                        {" · "}mostrando {Math.min(visibles.length, filtrados.length)}
                      </div>
                      <div className="prod-accordion">
                        {visibles.map((p: any) => {
                          const abierto  = repuestoAbierto === p.id;
                          const hayStock = Number(p.stock) > 0;
                          return (
                            <div key={p.id} className={`prod-item ${abierto ? "open" : ""}`}>
                              <div className="prod-item-header"
                                onClick={() => setRepuestoAbierto(abierto ? null : p.id)}>
                                <span className="prod-item-name">
                                  <span style={{ fontSize:16 }}>{hayStock ? "🟢" : "🔴"}</span>
                                  {p.name}
                                </span>
                                <span className={`prod-item-arrow ${abierto ? "open" : ""}`}>▼</span>
                              </div>
                              <div className={`prod-item-body ${abierto ? "open" : ""}`}>
                                <div className="prod-price-big">
                                  RD$ {Number(p.price).toLocaleString("es-DO", { minimumFractionDigits:2, maximumFractionDigits:2 })}
                                </div>
                                <span className={`prod-stock-badge ${hayStock ? "stock-ok" : "stock-no"}`}>
                                  {hayStock ? `✓ Disponible (${p.stock})` : "Sin stock"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {hayMas && (
                        <button className="btn-ver-mas"
                          onClick={() => setRepuestosPage(pg => pg + 1)}>
                          ⬇️ Ver más ({filtrados.length - visibles.length} restantes)
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* ── ACORDEÓN MENÚ CAFETERÍA ── */}
            {showCafe && (
              <div className="card fade-up">
                <div className="card-title">☕ MENÚ DE EXPERIENCIAS</div>
                {loadingCafe ? (
                  <div className="loading-dots">Cargando menú...</div>
                ) : cafe.length === 0 ? (
                  <div className="loading-dots">Sin productos en el menú.</div>
                ) : (() => {
                  const filtrados = cafe.filter((p: any) =>
                    !cafeSearch || p.nombre?.toLowerCase().includes(cafeSearch.toLowerCase()) ||
                    p.categoria?.toLowerCase().includes(cafeSearch.toLowerCase())
                  );
                  const visibles = filtrados.slice(0, cafePage * PAGE_SIZE);
                  const hayMas   = visibles.length < filtrados.length;
                  return (
                    <>
                      <div className="search-acord">
                        <span>🔍</span>
                        <input
                          value={cafeSearch}
                          onChange={e => { setCafeSearch(e.target.value); setCafePage(1); }}
                          placeholder="Buscar producto o categoría..."
                        />
                        {cafeSearch && (
                          <span style={{ cursor:"pointer", fontSize:13, color:"#64748b" }}
                            onClick={() => { setCafeSearch(""); setCafePage(1); }}>✕</span>
                        )}
                      </div>
                      <div className="result-count">
                        {cafeSearch ? `${filtrados.length} resultado${filtrados.length !== 1 ? "s" : ""}` : `${cafe.length} productos`}
                        {" · "}mostrando {Math.min(visibles.length, filtrados.length)}
                      </div>
                      <div className="prod-accordion">
                        {visibles.map((p: any) => {
                          const abierto  = cafeAbierto === p.id;
                          const hayStock = Number(p.stock) > 0;
                          return (
                            <div key={p.id} className={`prod-item ${abierto ? "open" : ""}`}>
                              <div className="prod-item-header"
                                onClick={() => setCafeAbierto(abierto ? null : p.id)}>
                                <span className="prod-item-name">
                                  <span style={{ fontSize:16 }}>{hayStock ? "🟢" : "🔴"}</span>
                                  {p.nombre}
                                  {p.categoria && (
                                    <span style={{ fontSize:11, color:"#475569", fontWeight:400 }}>
                                      · {p.categoria}
                                    </span>
                                  )}
                                </span>
                                <span className={`prod-item-arrow ${abierto ? "open" : ""}`}>▼</span>
                              </div>
                              <div className={`prod-item-body ${abierto ? "open" : ""}`}>
                                <div className="prod-price-big">
                                  RD$ {Number(p.precio).toLocaleString("es-DO", { minimumFractionDigits:2, maximumFractionDigits:2 })}
                                </div>
                                <span className={`prod-stock-badge ${hayStock ? "stock-ok" : "stock-no"}`}>
                                  {hayStock ? `✓ Disponible (${p.stock})` : "Sin stock"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {hayMas && (
                        <button className="btn-ver-mas"
                          onClick={() => setCafePage(pg => pg + 1)}>
                          ⬇️ Ver más ({filtrados.length - visibles.length} restantes)
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* ── BUSCADOR ── */}
            {!resultado && (
              <div className="card fade-up delay-1">
                <div className="card-title">🔎 Consulta tu Vehículo</div>
                <p className="search-intro">
                  Ingresa la placa de tu vehículo para ver su estado en tiempo real.
                </p>
                <label className="field-label">Placa del vehículo</label>
                <input
                  value={placa}
                  onChange={e => setPlaca(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && buscar()}
                  placeholder="A123456"
                  maxLength={10}
                  className="input-placa"
                />
                {error && <div className="error-banner">⚠️ {error}</div>}
                <button
                  onClick={buscar}
                  disabled={loading || !placa.trim()}
                  className="btn-buscar"
                >
                  {loading ? "⏳ Buscando..." : "🔍 Consultar Estado"}
                </button>
              </div>
            )}

            {/* ── RESULTADO ── */}
            {resultado && (
              <div>
                <button
                  onClick={() => { setResultado(null); setPlaca(""); }}
                  className="btn-volver"
                >
                  ← Nueva consulta
                </button>

                {/* VEHÍCULO */}
                <div className="car-card fade-up">
                  <div className="car-main">
                    <span className="car-emoji">🚗</span>
                    <div>
                      <div className="car-marca">
                        {resultado.vehiculo.marca} {resultado.vehiculo.modelo}
                      </div>
                      <div className="car-meta">
                        Año {resultado.vehiculo.ano}
                        {resultado.vehiculo.color ? ` · ${resultado.vehiculo.color}` : ""}
                      </div>
                      <div className="placa-badge">{resultado.vehiculo.placa}</div>
                    </div>
                  </div>
                </div>

                {/* ESTADO */}
                {ultimaOrden && estadoInfo && (
                  <div className="estado-card fade-up delay-1" style={{ background: estadoInfo.grad }}>
                    <div className="estado-top-label">Estado Actual</div>
                    <div className="estado-row">
                      <span className="estado-emoji">{estadoInfo.emoji}</span>
                      <div>
                        <div className="estado-name">{ultimaOrden.estado.replace("_"," ")}</div>
                        <div className="estado-msg">{estadoInfo.msg}</div>
                      </div>
                    </div>
                    <div className="progress-wrap">
                      {PASOS.map((paso, i) => {
                        const alcanzado = i < pasoActual;
                        const actual    = i === pasoActual - 1;
                        return (
                          <div key={paso} className="prog-step">
                            <div className={`prog-dot ${actual ? "prog-dot-active" : alcanzado ? "prog-dot-done" : "prog-dot-future"}`}>
                              {alcanzado || actual ? "✓" : i + 1}
                            </div>
                            <div className={`prog-label ${alcanzado || actual ? "prog-label-on" : "prog-label-off"}`}>
                              {PASOS_LABEL[i]}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TABS */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }} className="fade-up delay-2">
                  {[
                    { key:"estado",    label:`📋 Servicios (${resultado.ordenes.length})` },
                    { key:"historial", label:`🔬 Diagnósticos (${resultado.diagnosticos.length})` },
                    { key:"histperm",  label:`📚 Historial (${historialPerm.length})` },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => { setTab(t.key); setHistDetalle(null); }}
                      className={`tab-btn ${tab === t.key ? "tab-active" : "tab-inactive"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* ÓRDENES */}
                {tab === "estado" && (
                  <div className="fade-up delay-3">
                    {resultado.ordenes.length === 0 ? (
                      <div className="card" style={{ textAlign:"center", color:"#475569", padding:28 }}>
                        <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
                        Sin órdenes activas registradas.
                      </div>
                    ) : resultado.ordenes.map((o: any) => {
                      const info = (ESTADO_INFO as any)[o.estado] || ESTADO_INFO.RECIBIDO;
                      return (
                        <div key={o.id} className="orden-card" style={{ borderLeftColor: info.color }}>
                          <div className="orden-header">
                            <span className="orden-id">Orden #{o.id}</span>
                            <span className="orden-badge" style={{ background:`${info.color}22`, color:info.color }}>
                              {o.estado.replace("_"," ")}
                            </span>
                          </div>
                          <div className="orden-desc">{o.descripcion}</div>
                          <button
                            onClick={() => {
                              const msg = `Hola, quiero info de mi vehículo (${resultado.vehiculo.placa}), orden #${o.id}`;
                              window.open(`https://wa.me/18097122027?text=${encodeURIComponent(msg)}`,"_blank");
                            }}
                            className="btn-wa-card"
                          >
                            💬 Consultar por WhatsApp
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* DIAGNÓSTICOS */}
                {tab === "historial" && (
                  <div className="fade-up delay-3">
                    {resultado.diagnosticos.length === 0 ? (
                      <div className="card" style={{ textAlign:"center", color:"#475569", padding:28 }}>
                        <div style={{ fontSize:32, marginBottom:8 }}>🔬</div>
                        Sin diagnósticos registrados.
                      </div>
                    ) : resultado.diagnosticos.map((d: any) => (
                      <div key={d.id} className="diag-card">
                        <div className="diag-tipo">{d.tipo_servicio}</div>
                        <div className="diag-obs">{d.observaciones}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── HISTORIAL PERMANENTE ── */}
                {tab === "histperm" && (
                  <div className="fade-up delay-3">
                    {histDetalle ? (
                      /* ── DETALLE DE UN SERVICIO ── */
                      <div>
                        <button
                          onClick={() => setHistDetalle(null)}
                          className="btn-volver"
                          style={{ marginBottom:14, width:"100%" }}
                        >
                          ← Volver al historial
                        </button>

                        <div className="card" style={{ background:"linear-gradient(135deg,#0f1729,#1e3a5f)", border:"1px solid rgba(59,130,246,0.2)", marginBottom:10 }}>
                          <div style={{ fontSize:10, color:"#64748b", fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", marginBottom:6 }}>
                            {histDetalle.fecha_servicio ? new Date(histDetalle.fecha_servicio).toLocaleDateString("es-DO",{year:"numeric",month:"long",day:"numeric"}) : "—"}
                          </div>
                          <div style={{ fontFamily:"Syne,sans-serif", fontSize:20, fontWeight:800, color:"#fff" }}>
                            {histDetalle.tipo_servicio}
                          </div>
                          {histDetalle.tecnico_nombre && (
                            <div style={{ fontSize:13, color:"#64748b", marginTop:4 }}>
                              👨‍🔧 {histDetalle.tecnico_nombre}
                            </div>
                          )}
                        </div>

                        {(histDetalle.inspeccion_mecanica || histDetalle.inspeccion_electrica || histDetalle.inspeccion_electronica) && (
                          <div className="card" style={{ marginBottom:10 }}>
                            <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>🔍 Inspección Técnica</div>
                            {histDetalle.inspeccion_mecanica && (
                              <div className="hist-section">
                                <div className="hist-section-title">🔧 Mecánica</div>
                                <div className="hist-section-text">{histDetalle.inspeccion_mecanica}</div>
                              </div>
                            )}
                            {histDetalle.inspeccion_electrica && (
                              <div className="hist-section">
                                <div className="hist-section-title">⚡ Eléctrica</div>
                                <div className="hist-section-text">{histDetalle.inspeccion_electrica}</div>
                              </div>
                            )}
                            {histDetalle.inspeccion_electronica && (
                              <div className="hist-section">
                                <div className="hist-section-title">💻 Scanner</div>
                                <div className="hist-section-text">{histDetalle.inspeccion_electronica}</div>
                              </div>
                            )}
                          </div>
                        )}

                        {(histDetalle.codigos_falla || histDetalle.fallas_identificadas) && (
                          <div className="hist-falla" style={{ marginBottom:10 }}>
                            <div className="hist-falla-title">⚠️ Fallas Identificadas</div>
                            {histDetalle.codigos_falla && <div className="hist-falla-text" style={{ marginBottom:4 }}>Códigos: {histDetalle.codigos_falla}</div>}
                            {histDetalle.fallas_identificadas && <div className="hist-falla-text">{histDetalle.fallas_identificadas}</div>}
                          </div>
                        )}

                        {histDetalle.trabajos_realizados && (
                          <div className="card" style={{ marginBottom:10 }}>
                            <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>🛠️ Trabajos Realizados</div>
                            <div className="hist-section-text">{histDetalle.trabajos_realizados}</div>
                          </div>
                        )}

                        {histDetalle.observaciones && (
                          <div className="card" style={{ marginBottom:10 }}>
                            <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>📝 Observaciones</div>
                            <div className="hist-section-text">{histDetalle.observaciones}</div>
                          </div>
                        )}

                        {histDetalle.costo_total > 0 && (
                          <div className="card">
                            <div className="hist-section-title" style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>💰 Costos del Servicio</div>
                            <div className="hist-costos">
                              <div className="hist-costo-box">
                                <div className="hist-costo-label">Mano de Obra</div>
                                <div className="hist-costo-val">RD$ {Number(histDetalle.costo_mano_obra||0).toLocaleString("es-DO",{minimumFractionDigits:2})}</div>
                              </div>
                              <div className="hist-costo-box">
                                <div className="hist-costo-label">Repuestos</div>
                                <div className="hist-costo-val">RD$ {Number(histDetalle.costo_repuestos||0).toLocaleString("es-DO",{minimumFractionDigits:2})}</div>
                              </div>
                            </div>
                            <div style={{ textAlign:"center", marginTop:12, fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:22, color:"#34d399" }}>
                              Total: RD$ {Number(histDetalle.costo_total).toLocaleString("es-DO",{minimumFractionDigits:2})}
                            </div>
                            {histDetalle.ncf && <div className="hist-ncf">🧾 NCF: {histDetalle.ncf}</div>}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ── LISTA TIMELINE ── */
                      historialPerm.length === 0 ? (
                        <div className="card">
                          <div className="hist-empty">
                            <div className="hist-empty-icon">📚</div>
                            <div className="hist-empty-txt">Sin historial permanente</div>
                            <div className="hist-empty-sub">El historial se genera automáticamente cuando se completa un servicio.</div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize:12, color:"#475569", marginBottom:14, paddingLeft:4, fontWeight:600 }}>
                            {historialPerm.length} servicio{historialPerm.length !== 1 ? "s" : ""} registrado{historialPerm.length !== 1 ? "s" : ""}
                          </div>
                          <div className="hist-timeline">
                            {historialPerm.map((h: any, idx: number) => {
                              const abierto = histDetalle?.id === h.id;
                              return (
                                <div
                                  key={h.id}
                                  className={`hist-item ${abierto ? "open" : ""}`}
                                  onClick={() => setHistDetalle(h)}
                                >
                                  <div className="hist-servicio">{h.tipo_servicio || "Servicio"}</div>
                                  <div className="hist-meta">
                                    {h.fecha_servicio ? new Date(h.fecha_servicio).toLocaleDateString("es-DO",{year:"numeric",month:"short",day:"numeric"}) : "—"}
                                    {h.tecnico_nombre && ` · ${h.tecnico_nombre}`}
                                    {idx === 0 && <span className="hist-badge">Más reciente</span>}
                                  </div>
                                  {h.costo_total > 0 && (
                                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                      <span className="hist-cost">RD$ {Number(h.costo_total).toLocaleString("es-DO",{minimumFractionDigits:2})}</span>
                                      <span style={{ fontSize:11, color:"#475569", fontWeight:600 }}>Ver detalle →</span>
                                    </div>
                                  )}
                                  {!h.costo_total && (
                                    <div style={{ fontSize:11, color:"#475569", fontWeight:600, textAlign:"right" }}>Ver detalle →</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            <footer className="footer">
              <div style={{ fontSize:22 }}>🔧</div>
              <div className="footer-brand">Sólido Auto Servicio</div>
              <div>809-712-2027</div>
            </footer>
          </div>
        </div>

        {/* BOTÓN FLOTANTE WHATSAPP */}
        <a href="https://wa.me/18097122027" target="_blank" className="wa-float">💬</a>
      </div>
    </>
  );
}
