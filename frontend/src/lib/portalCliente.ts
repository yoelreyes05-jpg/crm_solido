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

  // Sin timeout, si el backend deja una petición colgada el usuario se queda
  // mirando "cargando" indefinidamente.
  const control = new AbortController();
  const cronometro = setTimeout(() => control.abort(), 20000);

  let res: Response;
  try {
    res = await fetch(`${API}/portal${ruta}`, {
      ...opciones,
      headers,
      signal: control.signal,
    });
  } catch (e: any) {
    // `fetch` solo rechaza por red, CORS o abort — nunca por un status de error.
    // Distinguir los casos importa: decirle "revisa tu wifi" a alguien cuyo
    // wifi está bien lo manda a buscar donde no es.
    if (e?.name === "AbortError") {
      throw new ErrorPortal(
        "El servidor está tardando demasiado. Intenta de nuevo en un momento.",
        0
      );
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new ErrorPortal("Parece que no tienes internet. Revisa tu conexión.", 0);
    }
    throw new ErrorPortal(
      "No pudimos comunicarnos con el servidor. Si el problema sigue, avísale al taller.",
      0
    );
  } finally {
    clearTimeout(cronometro);
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

// ─── Notificaciones push (PWA) ───────────────────────────────────────────────

export type Preferencias = { correo: boolean; push: boolean; whatsapp: boolean };

/** La clave pública VAPID del servidor. Sin ella no se puede suscribir. */
export function clavePush() {
  return pedir<{ clave: string; disponible: boolean }>("/push/clave", {}, false);
}

export function cargarPreferencias() {
  return pedir<{ preferencias: Preferencias; dispositivos: number }>("/preferencias");
}

export function guardarPreferencias(cambios: Partial<Preferencias>) {
  return pedir<{ preferencias: Partial<Preferencias> }>("/preferencias", {
    method: "PATCH",
    body: JSON.stringify(cambios),
  });
}

export function enviarPushDePrueba() {
  return pedir<{ enviados: number }>("/push/prueba", { method: "POST" });
}

/** VAPID viaja en base64url; `applicationServerKey` exige un Uint8Array. */
function base64UrlABytes(base64: string): Uint8Array {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const bin = window.atob(normal);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** ¿Este navegador soporta notificaciones push? (iOS solo desde la PWA instalada) */
export function soportaPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export type MotivoPush = "sin-soporte" | "denegado" | "sin-clave" | "error";

/**
 * Resultado de activar el push.
 *
 * Es un tipo plano con `motivo` opcional y no una unión discriminada a
 * propósito: el proyecto compila con `"strict": false`, y sin `strictNullChecks`
 * TypeScript no estrecha uniones por un discriminante booleano — leer `r.motivo`
 * tras un `if (r.ok)` rompía el build en Vercel.
 */
export type ResultadoPush = { ok: boolean; motivo?: MotivoPush; detalle?: string };

/**
 * Pide permiso y registra el dispositivo.
 * Devuelve el motivo del fallo en vez de lanzar, para poder mostrarle al
 * cliente algo mejor que "error".
 */
export async function activarPush(): Promise<ResultadoPush> {
  if (!soportaPush()) return { ok: false, motivo: "sin-soporte" };

  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return { ok: false, motivo: "denegado" };

    const { clave, disponible } = await clavePush();
    if (!clave || !disponible) return { ok: false, motivo: "sin-clave" };

    const registro = await navigator.serviceWorker.ready;

    // Si ya había una suscripción con otra clave (rotaste VAPID), hay que
    // darla de baja primero o `subscribe` falla.
    const previa = await registro.pushManager.getSubscription();
    if (previa) await previa.unsubscribe().catch(() => {});

    const suscripcion = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlABytes(clave) as BufferSource,
    });

    await pedir("/push/suscribir", {
      method: "POST",
      body: JSON.stringify({ suscripcion: suscripcion.toJSON() }),
    });

    return { ok: true };
  } catch (e: any) {
    return { ok: false, motivo: "error", detalle: e?.message };
  }
}

/** Da de baja este dispositivo. */
export async function desactivarPush() {
  if (!soportaPush()) return;
  try {
    const registro = await navigator.serviceWorker.ready;
    const suscripcion = await registro.pushManager.getSubscription();
    if (suscripcion) {
      await pedir("/push/baja", {
        method: "POST",
        body: JSON.stringify({ endpoint: suscripcion.endpoint }),
      }).catch(() => {});
      await suscripcion.unsubscribe();
    }
  } catch {}
  await guardarPreferencias({ push: false }).catch(() => {});
}

/** ¿Este dispositivo concreto ya está suscrito? */
export async function dispositivoSuscrito(): Promise<boolean> {
  if (!soportaPush() || Notification.permission !== "granted") return false;
  try {
    const registro = await navigator.serviceWorker.ready;
    return Boolean(await registro.pushManager.getSubscription());
  } catch {
    return false;
  }
}

/**
 * El service worker avisa cuando el navegador rota las claves de suscripción.
 * Sin esto el cliente deja de recibir avisos en silencio.
 */
export function escucharResuscripcion() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return () => {};

  const alMensaje = (ev: MessageEvent) => {
    if (ev.data?.tipo !== "resuscribir-push" || !ev.data?.suscripcion) return;
    pedir("/push/suscribir", {
      method: "POST",
      body: JSON.stringify({ suscripcion: ev.data.suscripcion }),
    }).catch(() => {});
  };

  navigator.serviceWorker.addEventListener("message", alMensaje);
  return () => navigator.serviceWorker.removeEventListener("message", alMensaje);
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
