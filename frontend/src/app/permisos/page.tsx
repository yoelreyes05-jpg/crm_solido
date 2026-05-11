"use client";

import { useEffect, useState, useCallback } from "react";
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

// ── Roles editables (el gerente siempre tiene TODO) ───────────────────────────
const ROLES_EDITABLES = ["secretaria", "tecnico", "almacen", "cafeteria"] as const;
type RolEditable = (typeof ROLES_EDITABLES)[number];

const LABEL_ROL: Record<string, string> = {
  secretaria: "Secretaria",
  tecnico:    "Técnico",
  almacen:    "Almacén",
  cafeteria:  "Cafetería",
};

const ACCIONES: { key: Accion; label: string; color: string }[] = [
  { key: "ver",      label: "Ver",      color: "bg-blue-100   text-blue-800"   },
  { key: "crear",    label: "Crear",    color: "bg-green-100  text-green-800"  },
  { key: "editar",   label: "Editar",   color: "bg-yellow-100 text-yellow-800" },
  { key: "aprobar",  label: "Aprobar",  color: "bg-purple-100 text-purple-800" },
  { key: "eliminar", label: "Eliminar", color: "bg-red-100    text-red-800"    },
];

const NADA: PermisoModulo = { ver: false, crear: false, editar: false, aprobar: false, eliminar: false };

function defaultConfig(): PermisosConfig {
  return JSON.parse(JSON.stringify(PERMISOS_DEFAULT));
}

// ── Componente de fila de módulo ──────────────────────────────────────────────
function FilaModulo({
  moduloKey,
  label,
  descripcion,
  permisos,
  onChange,
}: {
  moduloKey: string;
  label: string;
  descripcion: string;
  permisos: PermisoModulo;
  onChange: (key: Accion, val: boolean) => void;
}) {
  const tieneAlgo = Object.values(permisos).some(Boolean);

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-3 pl-4 pr-2 w-48">
        <div className="font-medium text-gray-900 text-sm">{label}</div>
        <div className="text-xs text-gray-400 mt-0.5 leading-tight">{descripcion}</div>
      </td>
      {ACCIONES.map(({ key, label: aLabel, color }) => (
        <td key={key} className="py-3 px-2 text-center">
          <label className="inline-flex flex-col items-center gap-1 cursor-pointer group">
            <input
              type="checkbox"
              checked={permisos[key]}
              onChange={(e) => onChange(key, e.target.checked)}
              className="w-4 h-4 accent-indigo-600 cursor-pointer"
            />
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full hidden sm:inline-block ${
                permisos[key] ? color : "bg-gray-100 text-gray-400"
              }`}
            >
              {aLabel}
            </span>
          </label>
        </td>
      ))}
      <td className="py-3 px-2 text-center">
        <button
          onClick={() =>
            ACCIONES.forEach(({ key }) => onChange(key, !tieneAlgo))
          }
          className={`text-xs px-2 py-1 rounded border transition-colors ${
            tieneAlgo
              ? "border-red-200 text-red-600 hover:bg-red-50"
              : "border-green-200 text-green-600 hover:bg-green-50"
          }`}
        >
          {tieneAlgo ? "Ninguno" : "Todo"}
        </button>
      </td>
    </tr>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function PermisosPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ rol?: string; role?: string } | null>(null);
  const [config, setConfig] = useState<PermisosConfig>(defaultConfig);
  const [rolActivo, setRolActivo] = useState<RolEditable>("secretaria");
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  // Verificar sesión y rol
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

  // Cargar permisos desde el backend
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch(`${API}/permisos`);
      if (r.ok) {
        const data = await r.json();
        if (data && typeof data === "object") {
          // Merge con defaults para que roles no guardados tengan sus valores
          const merged: PermisosConfig = defaultConfig();
          for (const rol of Object.keys(data)) {
            merged[rol] = data[rol];
          }
          setConfig(merged);
        }
      }
    } catch {
      // Usa defaults si el backend no responde
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (usuario) cargar();
  }, [usuario, cargar]);

  // Cambiar un permiso individual
  function cambiarPermiso(modulo: string, accion: Accion, valor: boolean) {
    setConfig((prev) => ({
      ...prev,
      [rolActivo]: {
        ...prev[rolActivo],
        [modulo]: {
          ...(prev[rolActivo]?.[modulo] ?? { ...NADA }),
          [accion]: valor,
        },
      },
    }));
  }

  // Guardar en el backend
  async function guardar() {
    setGuardando(true);
    try {
      const r = await fetch(`${API}/permisos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (r.ok) {
        showToast("Permisos guardados correctamente", "ok");
      } else {
        const e = await r.json().catch(() => ({}));
        showToast(e.error || "Error al guardar", "err");
      }
    } catch {
      showToast("Error de conexión con el servidor", "err");
    } finally {
      setGuardando(false);
    }
  }

  // Resetear rol activo a defaults
  function resetear() {
    if (!confirm(`¿Restablecer los permisos de ${LABEL_ROL[rolActivo]} a los valores por defecto?`)) return;
    setConfig((prev) => ({
      ...prev,
      [rolActivo]: JSON.parse(JSON.stringify(PERMISOS_DEFAULT[rolActivo] ?? {})),
    }));
  }

  function showToast(msg: string, tipo: "ok" | "err") {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  }

  if (!usuario || cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 animate-pulse text-lg">Cargando permisos…</div>
      </div>
    );
  }

  const permisosRol = config[rolActivo] ?? {};

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
            toast.tipo === "ok" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.tipo === "ok" ? "✅ " : "❌ "}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🔐 Permisos de Roles</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configura qué acciones puede hacer cada rol en cada módulo del sistema.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetear}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            ↺ Restablecer
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm"
          >
            {guardando ? "Guardando…" : "💾 Guardar cambios"}
          </button>
        </div>
      </div>

      {/* Tabs de roles */}
      <div className="flex flex-wrap gap-2 mb-6">
        {ROLES_EDITABLES.map((rol) => (
          <button
            key={rol}
            onClick={() => setRolActivo(rol)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              rolActivo === rol
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"
            }`}
          >
            {LABEL_ROL[rol]}
          </button>
        ))}
        {/* Gerente — solo lectura */}
        <span className="px-4 py-2 rounded-full text-sm font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 cursor-default">
          👑 Gerente (acceso total)
        </span>
      </div>

      {/* Tabla por grupos */}
      <div className="space-y-6">
        {GRUPOS_MODULOS.map((grupo) => {
          const modulos = MODULOS_SISTEMA.filter((m) => m.grupo === grupo);
          return (
            <div key={grupo} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
                <span className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                  {grupo}
                </span>
                <span className="text-xs text-gray-400">({modulos.length} módulos)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="py-2 pl-4 pr-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-48">
                        Módulo
                      </th>
                      {ACCIONES.map(({ key, label }) => (
                        <th
                          key={key}
                          className="py-2 px-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wide"
                        >
                          {label}
                        </th>
                      ))}
                      <th className="py-2 px-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
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

      {/* Nota al pie */}
      <p className="mt-6 text-xs text-gray-400 text-center">
        Los cambios surten efecto al guardar. El rol <strong>Gerente</strong> siempre tiene acceso
        completo y no puede ser modificado.
      </p>
    </div>
  );
}
