/**
 * frontend/src/lib/portalCliente.ts
 *
 * Cliente del portal (/portal/* en el backend).
 *
 * Reemplaza el patrón de cliente/page.tsx que hacía:
 *     fetch(`${API}/vehiculos`)      // TODOS los vehículos
 *     fetch(`${API}/ordenes`)        // TODAS las órdenes
 *     fetch(`${API}/diagnosticos`)   // TODOS los diagnósticos
 * y filtraba por placa en el navegador. Ahora una sola llamada autenticada
 * devuelve únicamente el vehículo de la sesión.
 *
 * El token vive en localStorage bajo "portal_token". Es distinto de
 * "crm_token" (el del personal) a propósito: son dos audiencias separadas y
 * un cliente nunca debe terminar con un token del CRM.
 */

import { API_URL as API } from "@/config";

const CLAVE_TOKEN = "portal_token";
const CLAVE_SESION = "portal_sesion";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type Vehiculo = {
  id: number;
  placa: string;
  marca?: string;
  modelo?: string;
  ano?: number;
  color?: string;
};

export type MetodosAcceso = {
  telefono: { pista: string } | null;
  correo: { pista: string } | null;
  whatsapp: { pista: string } | null;
  mostrador: boolean;
};

export type Sesion = {
  token: string;
  cliente: { nombre: string };
  vehiculo: Vehiculo;
};

export type EstadoPortal = {
  cliente: { nombre: string };
  vehiculo: Vehiculo;
  orden_actual: any | null;
  linea_tiempo: { etapa: string; fecha: string }[];
  ordenes: any[];
  diagnosticos: any[];
  cotizaciones: any[];
  cotizaciones_pendientes: any[];
  mantenimiento: any[];
  recordatorios: any[];
};

/** Error con el status HTTP y las pistas que devuelve el backend. */
export class ErrorPortal extends Error {
  status: number;
  requiere?: string;
  datos?: any;
  constructor(mensaje: string, status: number, datos?: any) {
    super(mensaje);
    this.name = "ErrorPortal";
    this.status = status;
    this.requiere = datos?.requiere;
    this.datos = datos;
  }
}

// ─── Token en localStorage ───────────────────────────────────────────────────

export function leerToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CLAVE_TOKEN);
}

export function guardarSesion(s: Sesion) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CLAVE_TOKEN, s.token);
  localStorage.setItem(
    CLAVE_SESION,
    JSON.stringify({ cliente: s.cliente, vehiculo: s.vehiculo })
  );
}

export function leerSesionGuardada(): { cliente: { nombre: string }; vehiculo: Vehiculo } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CLAVE_SESION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function borrarSesion() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CLAVE_TOKEN);
  localStorage.removeItem(CLAVE_SESION);
}

export function haySesion(): boolean {
  return Boolean(leerToken());
}

// ─── Fetch base ──────────────────────────────────────────────────────────────

async function pedir<T = any>(
  ruta: string,
  opciones: RequestInit = {},
  conToken = true
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opciones.headers as Record<string, string>) || {}),
  };

  if (conToken) {
    const token = leerToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API}/portal${ruta}`, { ...opciones, headers });
  } catch {
    throw new ErrorPortal("Sin conexión. Revisa tus datos o el wifi.", 0);
  }

  let cuerpo: any = null;
  try {
    cuerpo = await res.json();
  } catch {
    /* respuesta sin JSON */
  }

  if (!res.ok) {
    // 401 con token = la sesión murió. Limpiamos para que la app pida acceso.
    if (res.status === 401 && conToken && leerToken()) borrarSesion();
    throw new ErrorPortal(
      cuerpo?.mensaje || `Error ${res.status}`,
      res.status,
      cuerpo
    );
  }

  return cuerpo as T;
}

// ─── Acceso ──────────────────────────────────────────────────────────────────

/** Paso 1: qué métodos de verificación aplican a esta placa. */
export function consultarPlaca(placa: string) {
  return pedir<{ vehiculo: Partial<Vehiculo>; metodos: MetodosAcceso }>(
    "/acceso/placa",
    { method: "POST", body: JSON.stringify({ placa }) },
    false
  );
}

/** Nivel 1: placa + últimos 4 dígitos del teléfono. Sin correo de por medio. */
export async function entrarConTelefono(placa: string, ultimos4: string) {
  const s = await pedir<Sesion>(
    "/acceso/telefono",
    { method: "POST", body: JSON.stringify({ placa, ultimos4 }) },
    false
  );
  guardarSesion(s);
  return s;
}

/** Nivel 2a: pedir código de 6 dígitos al correo registrado. */
export function solicitarCodigo(placa: string) {
  return pedir<{ enviado: boolean; destino: string; vence_en_minutos: number }>(
    "/acceso/solicitar-codigo",
    { method: "POST", body: JSON.stringify({ placa }) },
    false
  );
}

/** Nivel 2b: verificar ese código. */
export async function entrarConCodigo(placa: string, codigo: string) {
  const s = await pedir<Sesion>(
    "/acceso/verificar-codigo",
    { method: "POST", body: JSON.stringify({ placa, codigo }) },
    false
  );
  guardarSesion(s);
  return s;
}

/** Nivel 3: código de 8 dígitos dictado en el mostrador. */
export async function entrarConCodigoMostrador(codigo: string, placa?: string) {
  const s = await pedir<Sesion>(
    "/acceso/mostrador",
    { method: "POST", body: JSON.stringify({ codigo, placa }) },
    false
  );
  guardarSesion(s);
  return s;
}

// ─── Datos ───────────────────────────────────────────────────────────────────

/** Una sola llamada: vehículo, orden abierta, línea de tiempo, cotizaciones. */
export function cargarEstado() {
  return pedir<EstadoPortal>("/estado");
}

export function cargarHistorial() {
  return pedir<{ historial: any[] }>("/historial");
}

export function cargarDetalleHistorial(id: number | string) {
  return pedir<any>(`/historial/${id}`);
}

export function cargarCotizacion(id: number | string) {
  return pedir<{ cotizacion: any }>(`/cotizaciones/${id}`);
}

/** Aprobar o rechazar una cotización desde el celular. */
export function responderCotizacion(
  id: number | string,
  aprobar: boolean,
  extra: { firma?: string; motivo?: string } = {}
) {
  return pedir<{ aprobado: boolean; mensaje: string }>(
    `/cotizaciones/${id}/responder`,
    { method: "POST", body: JSON.stringify({ aprobar, ...extra }) }
  );
}

/** Revalida el token al abrir la app. Devuelve null si ya no sirve. */
export async function revalidarSesion() {
  if (!leerToken()) return null;
  try {
    return await pedir<{ cliente: { nombre: string }; vehiculo: Vehiculo; nivel: string }>("/sesion");
  } catch {
    return null;
  }
}

export async function salir() {
  try {
    await pedir("/salir", { method: "POST" });
  } catch {
    /* si el token ya murió, da igual */
  }
  borrarSesion();
}

// ─── Uso interno del CRM (secretaria) ────────────────────────────────────────

/**
 * Genera el código de mostrador para un cliente.
 * Requiere el secreto de administración; se pasa desde el componente del CRM.
 */
export async function generarCodigoMostrador(
  clienteId: number,
  secretoAdmin: string,
  generadoPor?: string
) {
  const res = await fetch(`${API}/portal/admin/codigo-mostrador`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-portal-admin": secretoAdmin },
    body: JSON.stringify({ cliente_id: clienteId, generado_por: generadoPor }),
  });
  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) throw new ErrorPortal(cuerpo?.mensaje || `Error ${res.status}`, res.status, cuerpo);
  return cuerpo as {
    codigo: string;
    cliente: string;
    vence_en_horas: number;
    instruccion: string;
  };
}
