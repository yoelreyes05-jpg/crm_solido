/**
 * Hook para verificar permisos en tiempo de ejecución.
 * Lee el usuario del localStorage y carga la config dinámica del backend.
 * Fallback automático a PERMISOS_DEFAULT si el backend no tiene nada guardado.
 *
 * Uso:
 *   const { puede, puedeVer, puedeCrear, puedeEditar, puedeEliminar } = usePermisos("clientes");
 */
import { useEffect, useState } from "react";
import { PERMISOS_DEFAULT, type PermisosConfig, type Accion } from "@/lib/permisos";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// Caché a nivel de módulo — evita re-fetch en cada página
let _cache: PermisosConfig | null = null;
let _pending: Promise<void> | null = null;

async function fetchConfig(): Promise<void> {
  if (_pending) return _pending;
  _pending = fetch(`${API}/permisos`)
    .then(r => r.ok ? r.json() : null)
    .then((data: PermisosConfig | null) => {
      if (data && typeof data === "object" && Object.keys(data).length > 0) {
        _cache = data;
      }
    })
    .catch(() => {})
    .finally(() => { _pending = null; });
  return _pending;
}

/** Limpia la caché (llamar cuando el gerente guarda nuevos permisos) */
export function invalidarCachePermisos() {
  _cache = null;
}

export function usePermisos(modulo?: string) {
  const [usuario,  setUsuario]  = useState<any>(null);
  const [config,   setConfig]   = useState<PermisosConfig | null>(_cache);
  const [listo,    setListo]    = useState(false);

  // Cargar usuario del localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("usuario");
      if (raw) setUsuario(JSON.parse(raw));
    } catch {}
    setListo(true);
  }, []);

  // Cargar config del backend (solo para no-gerentes, con caché)
  useEffect(() => {
    if (!usuario) return;
    const rol = (usuario.rol || "").toLowerCase();
    if (rol === "gerente") return;
    if (_cache) { setConfig(_cache); return; }
    fetchConfig().then(() => { if (_cache) setConfig(_cache); });
  }, [usuario]);

  const rol = (usuario?.rol || "").toLowerCase();

  const puede = (mod: string, accion: Accion): boolean => {
    if (!listo) return true;  // mientras carga, no ocultar nada (evita flash)
    if (!usuario) return false;
    if (rol === "gerente") return true;
    const cfg = config ?? PERMISOS_DEFAULT;
    return (cfg[rol] ?? {})[mod]?.[accion] === true;
  };

  // Helpers booleanos para el módulo específico (si se pasa)
  const puedeVer      = modulo ? puede(modulo, "ver")      : false;
  const puedeCrear    = modulo ? puede(modulo, "crear")    : false;
  const puedeEditar   = modulo ? puede(modulo, "editar")   : false;
  const puedeAprobar  = modulo ? puede(modulo, "aprobar")  : false;
  const puedeEliminar = modulo ? puede(modulo, "eliminar") : false;

  return { usuario, rol, listo, puede, puedeVer, puedeCrear, puedeEditar, puedeAprobar, puedeEliminar };
}
