"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MODULOS_SISTEMA,
  GRUPOS_MODULOS,
  PERMISOS_DEFAULT,
  type Accion,
  type PermisoModulo,
  type PermisosConfig,
} from "@/lib/permisos";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const ROLES_EDITABLES = ["secretaria", "tecnico", "almacen", "cafeteria"] as const;
type RolEditable = (typeof ROLES_EDITABLES)[number];

const ROL_META: Record<string, { label: string; icon: string; color: string; bg: string; border: string; desc: string }> = {
  gerente:    { label: "Gerente",    icon: "👑", color: "#92400e", bg: "#fef3c7", border: "#fbbf24", desc: "Acceso total al sistema" },
  secretaria: { label: "Secretaria", icon: "💼", color: "#1e40af", bg: "#eff6ff", border: "#60a5fa", desc: "Clientes, órdenes, facturación" },
  tecnico:    { label: "Técnico",    icon: "🔧", color: "#065f46", bg: "#ecfdf5", border: "#34d399", desc: "Taller y diagnósticos" },
  almacen:    { label: "Almacén",    icon: "📦", color: "#7c3aed", bg: "#f5f3ff", border: "#a78bfa", desc: "Inventario y suplidores" },
  cafeteria:  { label: "Cafetería",  icon: "☕", color: "#9f3a20", bg: "#fff7ed", border: "#fb923c", desc: "Módulo de cafetería" },
};

const ACCION_META: { key: Accion; label: string; icon: string; activeColor: string; activeBg: string }[] = [
  { key: "ver",      label: "Ver",      icon: "👁",  activeColor: "#1d4ed8", activeBg: "#dbeafe" },
  { key: "crear",    label: "Crear",    icon: "➕",  activeColor: "#065f46", activeBg: "#d1fae5" },
  { key: "editar",   label: "Editar",   icon: "✏️", activeColor: "#92400e", activeBg: "#fef3c7" },
  { key: "aprobar",  label: "Aprobar",  icon: "✅",  activeColor: "#5b21b6", activeBg: "#ede9fe" },
  { key: "eliminar", label: "Eliminar", icon: "🗑",  activeColor: "#991b1b", activeBg: "#fee2e2" },
];

const GRUPO_META: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  "Taller":    { color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe", icon: "🔧" },
  "Clientes":  { color: "#5b21b6", bg: "#f5f3ff", border: "#ddd6fe", icon: "👤" },
  "Almacén":   { color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0", icon: "📦" },
  "Finanzas":  { color: "#92400e", bg: "#fffbeb", border: "#fde68a", icon: "💰" },
  "Servicios": { color: "#9f3a20", bg: "#fff7ed", border: "#fed7aa", icon: "☕" },
  "Admin":     { color: "#374151", bg: "#f9fafb", border: "#e5e7eb", icon: "⚙️" },
};

const NADA: PermisoModulo = { ver: false, crear: false, editar: false, aprobar: false, eliminar: false };

function defaultConfig(): PermisosConfig {
  return JSON.parse(JSON.stringify(PERMISOS_DEFAULT));
}

function contarPermisos(permisosRol: Record<string, PermisoModulo>) {
  let activos = 0;
  const total = MODULOS_SISTEMA.length * 5;
  for (const m of MODULOS_SISTEMA) {
    const p = permisosRol[m.key];
    if (p) activos += Object.values(p).filter(Boolean).length;
  }
  return { activos, total };
}

function CeldaPermiso({ tiene }: { tiene: boolean }) {
  return (
    <td className="py-2 px-3 text-center border-b border-gray-50">
      {tiene
        ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600 text-xs font-bold">✓</span>
        : <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-50 text-gray-300 text-xs">—</span>
      }
    </td>
  );
}

function FilaModulo({
  moduloKey, label, descripcion, permisos, onChange,
}: {
  moduloKey: string; label: string; descripcion: string;
  permisos: PermisoModulo; onChange: (key: Accion, val: boolean) => void;
}) {
  const todoActivo = Object.values(permisos).every(Boolean);

  return (
    <tr className="border-b border-gray-50 hover:bg-slate-50/60 transition-colors">
      <td className="py-3 pl-5 pr-3 w-52">
        <div className="font-semibold text-gray-800 text-sm leading-tight">{label}</div>
        <div className="text-[11px] text-gray-400 mt-0.5 leading-snug">{descripcion}</div>
      </td>
      {ACCION_META.map(({ key, label: aLabel, icon, activeColor, activeBg }) => (
        <td key={key} className="py-3 px-2 text-center">
          <label className="inline-flex flex-col items-center gap-1 cursor-pointer">
            <div
              onClick={() => onChange(key, !permisos[key])}
              style={permisos[key]
                ? { background: activeBg, border: `2px solid ${activeColor}`, color: activeColor }
                : { background: "#f1f5f9", border: "2px solid #e2e8f0", color: "#94a3b8" }
              }
              className="w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all duration-150 hover:scale-105 select-none cursor-pointer"
            >
              {icon}
            </div>
            <span
              style={permisos[key] ? { color: activeColor, background: activeBg } : { color: "#9ca3af", background: "#f1f5f9" }}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            >
              {aLabel}
            </span>
          </label>
        </td>
      ))}
      <td className="py-3 pr-4 text-center">
        <button
          onClick={() => ACCION_META.forEach(({ key }) => onChange(key, !todoActivo))}
          className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold border transition-all ${
            todoActivo
              ? "border-red-200 text-red-500 bg-red-50 hover:bg-red-100"
              : "border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
          }`}
        >
          {todoActivo ? "Quitar" : "Todo"}
        </button>
      </td>
    </tr>
  );
}

export default function PermisosPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ rol?: string; role?: string } | null>(null);
  const [config, setConfig] = useState<PermisosConfig>(defaultConfig);
  const [rolActivo, setRolActivo] = useState<RolEditable>("secretaria");
  const [vistaActiva, setVistaActiva] = useState<"editor" | "matriz">("editor");
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" | "info" } | null>(null);
  const [copiarDe, setCopiarDe] = useState<string>("");

  useEffect(() => {
    const raw = sessionStorage.getItem("usuario") || localStorage.getItem("usuario");
    if (!raw) { router.push("/login"); return; }
    const u = JSON.parse(raw);
    const rol = (u.rol || u.role || "").toLowerCase();
    if (rol !== "gerente" && rol !== "admin") {
      router.push("/dashboard");
      return;
    }
    setUsuario(u);
  }, [router]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch(`${API}/permisos`);
      if (r.ok) {
        const data = await r.json();
        if (data && typeof data === "object") {
          const merged: PermisosConfig = defaultConfig();
          for (const rol of Object.keys(data)) merged[rol] = data[rol];
          setConfig(merged);
        }
      }
    } catch { /* usa defaults */ } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { if (usuario) cargar(); }, [usuario, cargar]);

  function cambiarPermiso(modulo: string, accion: Accion, valor: boolean) {
    setConfig((prev) => ({
      ...prev,
      [rolActivo]: {
        ...prev[rolActivo],
        [modulo]: { ...(prev[rolActivo]?.[modulo] ?? { ...NADA }), [accion]: valor },
      },
    }));
  }

  async function guardar() {
    setGuardando(true);
    try {
      const r = await fetch(`${API}/permisos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (r.ok) showToast("Permisos guardados correctamente", "ok");
      else {
        const e = await r.json().catch(() => ({}));
        showToast(e.error || "Error al guardar", "err");
      }
    } catch {
      showToast("Error de conexión con el servidor", "err");
    } finally {
      setGuardando(false);
    }
  }

  function resetear() {
    if (!confirm(`¿Restablecer los permisos de ${ROL_META[rolActivo]?.label} a los valores por defecto?`)) return;
    setConfig((prev) => ({
      ...prev,
      [rolActivo]: JSON.parse(JSON.stringify(PERMISOS_DEFAULT[rolActivo] ?? {})),
    }));
    showToast("Permisos restablecidos al valor por defecto", "info");
  }

  function copiarPermisos() {
    if (!copiarDe || copiarDe === rolActivo) return;
    if (!confirm(`¿Copiar los permisos de ${ROL_META[copiarDe]?.label} a ${ROL_META[rolActivo]?.label}?`)) return;
    setConfig((prev) => ({
      ...prev,
      [rolActivo]: JSON.parse(JSON.stringify(prev[copiarDe] ?? {})),
    }));
    showToast(`Permisos copiados de ${ROL_META[copiarDe]?.label}`, "info");
    setCopiarDe("");
  }

  function showToast(msg: string, tipo: "ok" | "err" | "info") {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  }

  if (!usuario || cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <div className="text-gray-500 font-medium">Cargando permisos…</div>
        </div>
      </div>
    );
  }

  const permisosRol = config[rolActivo] ?? {};
  const { activos: activosRol, total: totalRol } = contarPermisos(permisosRol);
  const porcentaje = Math.round((activosRol / totalRol) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-2xl shadow-2xl text-white text-sm font-semibold transition-all ${
          toast.tipo === "ok" ? "bg-emerald-600" : toast.tipo === "err" ? "bg-red-600" : "bg-indigo-600"
        }`}>
          <span className="text-base">{toast.tipo === "ok" ? "✅" : toast.tipo === "err" ? "❌" : "ℹ️"}</span>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-indigo-200">
                🔐
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Control de Permisos</h1>
                <p className="text-sm text-gray-500 mt-0.5">Define el acceso de cada rol a los módulos del sistema</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Copiar desde */}
              <div className="flex items-center gap-1.5">
                <select
                  value={copiarDe}
                  onChange={e => setCopiarDe(e.target.value)}
                  className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
                >
                  <option value="">📋 Copiar desde…</option>
                  {["secretaria", "tecnico", "almacen", "cafeteria"].filter(r => r !== rolActivo).map(r => (
                    <option key={r} value={r}>{ROL_META[r]?.icon} {ROL_META[r]?.label}</option>
                  ))}
                </select>
                {copiarDe && (
                  <button onClick={copiarPermisos}
                    className="text-xs px-3 py-2 bg-violet-50 text-violet-700 border border-violet-200 rounded-xl font-semibold hover:bg-violet-100 transition-colors">
                    Aplicar
                  </button>
                )}
              </div>
              <button
                onClick={resetear}
                className="px-3.5 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors font-medium"
              >
                ↺ Restablecer
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="px-5 py-2 text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 transition-all shadow-md shadow-indigo-200"
              >
                {guardando ? "⏳ Guardando…" : "💾 Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-7">

        {/* Tarjetas de roles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-7">
          {/* Gerente — solo lectura */}
          <div className="rounded-2xl p-4 border-2 cursor-default"
            style={{ background: ROL_META.gerente.bg, borderColor: ROL_META.gerente.border }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{ROL_META.gerente.icon}</span>
              <span className="font-bold text-sm" style={{ color: ROL_META.gerente.color }}>Gerente</span>
            </div>
            <div className="text-[11px] text-gray-500 mb-2 leading-tight">{ROL_META.gerente.desc}</div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#fde68a", color: ROL_META.gerente.color }}>
              Acceso total
            </span>
          </div>

          {/* Roles editables */}
          {ROLES_EDITABLES.map((rol) => {
            const meta = ROL_META[rol];
            const { activos, total } = contarPermisos(config[rol] ?? {});
            const pct = Math.round((activos / total) * 100);
            const isActive = rolActivo === rol && vistaActiva === "editor";
            return (
              <button
                key={rol}
                onClick={() => { setRolActivo(rol); setVistaActiva("editor"); }}
                className="relative rounded-2xl p-4 border-2 transition-all text-left hover:shadow-md hover:-translate-y-0.5"
                style={{
                  background: isActive ? meta.bg : "#ffffff",
                  borderColor: isActive ? meta.border : "#e5e7eb",
                  boxShadow: isActive ? `0 4px 20px ${meta.border}80` : undefined,
                }}
              >
                {isActive && (
                  <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full"
                    style={{ background: meta.border }} />
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{meta.icon}</span>
                  <span className="font-bold text-sm" style={{ color: isActive ? meta.color : "#374151" }}>
                    {meta.label}
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 mb-2.5 leading-tight">{meta.desc}</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: meta.border }} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-400">{pct}%</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-1">{activos}/{total} permisos</div>
              </button>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
          <button
            onClick={() => setVistaActiva("editor")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              vistaActiva === "editor" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            ✏️ Editor
          </button>
          <button
            onClick={() => setVistaActiva("matriz")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              vistaActiva === "matriz" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            📊 Matriz de Roles
          </button>
        </div>

        {/* ══ EDITOR ══ */}
        {vistaActiva === "editor" && (
          <>
            {/* Indicador rol activo */}
            <div className="flex items-center justify-between mb-5 px-4 py-3 rounded-2xl border"
              style={{ background: ROL_META[rolActivo]?.bg, borderColor: ROL_META[rolActivo]?.border }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{ROL_META[rolActivo]?.icon}</span>
                <div>
                  <div className="font-bold text-gray-800">
                    Editando: <span style={{ color: ROL_META[rolActivo]?.color }}>{ROL_META[rolActivo]?.label}</span>
                  </div>
                  <div className="text-xs text-gray-500">{ROL_META[rolActivo]?.desc}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black" style={{ color: ROL_META[rolActivo]?.color }}>
                  {porcentaje}%
                </div>
                <div className="text-xs text-gray-400">{activosRol}/{totalRol} activos</div>
              </div>
            </div>

            <div className="space-y-5">
              {GRUPOS_MODULOS.map((grupo) => {
                const gm = GRUPO_META[grupo] ?? GRUPO_META["Admin"];
                const modulos = MODULOS_SISTEMA.filter((m) => m.grupo === grupo);
                const activosGrupo = modulos.reduce((acc, m) => {
                  const p = permisosRol[m.key];
                  return acc + (p ? Object.values(p).filter(Boolean).length : 0);
                }, 0);
                const totalGrupo = modulos.length * 5;

                return (
                  <div key={grupo} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b"
                      style={{ background: gm.bg, borderColor: gm.border }}>
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{gm.icon}</span>
                        <span className="font-bold text-sm" style={{ color: gm.color }}>{grupo}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: gm.border + "50", color: gm.color }}>
                          {modulos.length} módulos
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-white/60 rounded-full overflow-hidden">
                          <div className="h-full rounded-full"
                            style={{ width: `${Math.round((activosGrupo / totalGrupo) * 100)}%`, background: gm.color }} />
                        </div>
                        <span className="text-xs font-semibold" style={{ color: gm.color }}>
                          {activosGrupo}/{totalGrupo}
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px]">
                        <thead>
                          <tr className="border-b border-gray-50">
                            <th className="py-2.5 pl-5 pr-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider w-52">
                              Módulo
                            </th>
                            {ACCION_META.map(({ key, label, icon }) => (
                              <th key={key} className="py-2.5 px-2 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                {icon} {label}
                              </th>
                            ))}
                            <th className="py-2.5 pr-4 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                              Rápido
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {modulos.map((m) => (
                            <FilaModulo
                              key={m.key}
                              moduloKey={m.key}
                              label={m.label}
                              descripcion={m.descripcion}
                              permisos={permisosRol[m.key] ?? { ...NADA }}
                              onChange={(accion, valor) => cambiarPermiso(m.key, accion, valor)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ══ MATRIZ ══ */}
        {vistaActiva === "matriz" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
              <h2 className="font-bold text-gray-800 text-base">📊 Matriz de Permisos por Rol</h2>
              <p className="text-xs text-gray-400 mt-0.5">Vista de acceso (Ver) por módulo y rol — todos los roles de un vistazo</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-3 pl-6 pr-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wide w-48">Módulo</th>
                    <th className="py-3 px-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-lg">👑</span>
                        <span className="text-[11px] font-bold text-amber-700">Gerente</span>
                      </div>
                    </th>
                    {ROLES_EDITABLES.map(rol => (
                      <th key={rol} className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-lg">{ROL_META[rol].icon}</span>
                          <span className="text-[11px] font-bold" style={{ color: ROL_META[rol].color }}>
                            {ROL_META[rol].label}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {GRUPOS_MODULOS.map((grupo) => {
                    const gm = GRUPO_META[grupo] ?? GRUPO_META["Admin"];
                    const modulos = MODULOS_SISTEMA.filter((m) => m.grupo === grupo);
                    return (
                      <React.Fragment key={grupo}>
                        <tr>
                          <td colSpan={6} className="py-1.5 pl-5 text-[11px] font-bold uppercase tracking-wider border-b"
                            style={{ background: gm.bg, color: gm.color, borderColor: gm.border }}>
                            {gm.icon} {grupo}
                          </td>
                        </tr>
                        {modulos.map((m) => (
                          <tr key={m.key} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-2.5 pl-6 pr-4 border-b border-gray-50">
                              <div className="font-semibold text-gray-700 text-sm">{m.label}</div>
                              <div className="text-[10px] text-gray-400">{m.descripcion}</div>
                            </td>
                            <td className="py-2 px-3 text-center border-b border-gray-50">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-600 text-xs font-bold">✓</span>
                            </td>
                            {ROLES_EDITABLES.map(rol => (
                              <CeldaPermiso key={rol} tiene={config[rol]?.[m.key]?.ver ?? false} />
                            ))}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Resumen */}
            <div className="px-6 py-4 border-t border-gray-100 bg-slate-50/50">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl border bg-amber-50 border-amber-100">
                  <span className="text-lg">👑</span>
                  <span className="text-xs font-bold text-amber-700">Gerente</span>
                  <span className="text-[10px] text-gray-400">Acceso total</span>
                </div>
                {ROLES_EDITABLES.map(rol => {
                  const { activos, total } = contarPermisos(config[rol] ?? {});
                  const pct = Math.round((activos / total) * 100);
                  const meta = ROL_META[rol];
                  return (
                    <div key={rol} className="flex flex-col items-center gap-1 p-3 rounded-xl border"
                      style={{ background: meta.bg, borderColor: meta.border }}>
                      <span className="text-lg">{meta.icon}</span>
                      <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.label}</span>
                      <div className="w-full h-1.5 bg-white/70 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.border }} />
                      </div>
                      <span className="text-[10px] text-gray-400">{activos}/{total} · {pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <p className="mt-6 text-xs text-gray-400 text-center">
          Los cambios surten efecto al guardar. El rol <strong className="text-gray-600">Gerente</strong> siempre tiene acceso completo y no puede ser modificado.
        </p>
      </div>
    </div>
  );
}
