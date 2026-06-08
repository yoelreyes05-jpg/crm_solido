/**
 * useEmpresa() — Hook que carga los datos de la empresa desde el backend.
 *
 * Lee las claves guardadas en config_sistema (via GET /config) y las mapea
 * al objeto EMPRESA que usan facturación, ventas, cafetería y contabilidad.
 *
 * Los valores de Configuración se actualizan en tiempo real: cada vez que
 * el componente monta, trae los datos frescos desde el servidor.
 */

import { useState, useEffect } from "react";
import { API_URL as API } from "@/config";

export interface EmpresaData {
  nombre:    string;
  rnc:       string;
  telefono:  string;
  email:     string;
  direccion: string;
  logo:      string;
  whatsapp:  string;   // número limpio para wa.me (ej: "18495692027")
  cargando:  boolean;
}

/** Valores por defecto mientras carga o si falla el backend */
const DEFAULTS: EmpresaData = {
  nombre:   "SÓLIDO AUTO SERVICIO SRL",
  rnc:      "",
  telefono: "849-569-2027",
  email:    "",
  direccion: "",
  logo:     "/logo.png",
  whatsapp: "18495692027",
  cargando: true,
};

/** Caché en memoria para no recargar en cada render */
let _cache: EmpresaData | null = null;
let _promise: Promise<EmpresaData> | null = null;

async function fetchEmpresa(): Promise<EmpresaData> {
  if (_cache) return _cache;
  if (!_promise) {
    _promise = fetch(`${API}/config`)
      .then(r => r.json())
      .then((rows: Array<{ clave: string; valor: string }>) => {
        const m: Record<string, string> = {};
        (rows || []).forEach(r => { m[r.clave] = r.valor ?? ""; });

        const telefono = m["telefono_empresa"] || DEFAULTS.telefono;
        const wa = (m["whatsapp_numero"] || telefono).replace(/\D/g, "");

        _cache = {
          nombre:    m["nombre_empresa"]    || DEFAULTS.nombre,
          rnc:       m["rnc_empresa"]       || DEFAULTS.rnc,
          telefono,
          email:     m["email_empresa"]     || DEFAULTS.email,
          direccion: m["direccion_empresa"] || DEFAULTS.direccion,
          logo:      m["logo_empresa"]      || DEFAULTS.logo,
          whatsapp:  wa,
          cargando:  false,
        };
        return _cache;
      })
      .catch(() => ({ ...DEFAULTS, cargando: false }));
  }
  return _promise;
}

/** Invalida la caché. Llama esto después de guardar en Configuración. */
export function invalidarCacheEmpresa() {
  _cache   = null;
  _promise = null;
}

/** Hook React. Devuelve el objeto empresa listo para usar en JSX. */
export function useEmpresa(): EmpresaData {
  const [empresa, setEmpresa] = useState<EmpresaData>(DEFAULTS);

  useEffect(() => {
    let activo = true;
    fetchEmpresa().then(d => { if (activo) setEmpresa(d); });
    return () => { activo = false; };
  }, []);

  return empresa;
}

/**
 * Versión síncrona (para funciones fuera de componentes, como generarHTML).
 * Devuelve la caché si existe, o los defaults si todavía no se ha cargado.
 */
export function getEmpresaSync(): Omit<EmpresaData, "cargando"> {
  const d = _cache || DEFAULTS;
  return {
    nombre:    d.nombre,
    rnc:       d.rnc,
    telefono:  d.telefono,
    email:     d.email,
    direccion: d.direccion,
    logo:      d.logo,
    whatsapp:  d.whatsapp,
  };
}
