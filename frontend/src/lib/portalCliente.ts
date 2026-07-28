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

    // El 503 significa "el portal no está bien instalado", no un fallo del
    // cliente. Se muestra la acción concreta para que quien lo vea sepa qué
    // pedirle al taller en vez de reintentar en vano.
    const mensaje =
      res.status === 503 && cuerpo?.accion_requerida
        ? `${cuerpo.mensaje} (${cuerpo.accion_requerida})`
        : cuerpo?.mensaje || `Error ${res.status}`;

    throw new ErrorPortal(mensaje, res.status, cuerpo);
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

/**
 * Detalle de un servicio del historial.
 *
 * Las órdenes todavía abiertas no están en `vehiculo_historial`: el backend las
 * devuelve con id `orden_<n>` y su expediente vive en otra ruta. Perder esta
 * distinción dejaba el detalle y la impresión en blanco para el servicio en
 * curso, que es justo el que el cliente quiere ver.
 */
export function cargarDetalleHistorial(h: any) {
  const esOrdenActiva = typeof h?.id === "string" && h.id.startsWith("orden_");
  const ruta = esOrdenActiva
    ? `/historial/orden/${h._orden_id ?? String(h.id).replace("orden_", "")}`
    : `/historial/${h?.id ?? h}`;
  return pedir<any>(ruta);
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

// ─── Citas ───────────────────────────────────────────────────────────────────

export type Cita = {
  id: number;
  fecha: string;          // YYYY-MM-DD
  hora: string;           // HH:MM
  tipo_servicio?: string;
  descripcion?: string;
  estado: "PENDIENTE" | "CONFIRMADA" | "COMPLETADA" | "CANCELADA" | "NO_ASISTIO";
  origen?: string;
  notas?: string;
  created_at?: string;
};

export type OpcionesCita = {
  fecha?: string;
  cerrado?: boolean;
  tipos: string[];
  fecha_min: string;
  fecha_max: string;
  horas: { hora: string; disponible: boolean }[];
};

/** Las citas del cliente: próximas y pasadas. */
export function cargarCitas() {
  return pedir<{ proximas: Cita[]; pasadas: Cita[] }>("/citas");
}

/**
 * Qué horas quedan libres ese día.
 * Sin fecha devuelve solo el rango de fechas válido y los tipos de servicio.
 */
export function opcionesCita(fecha?: string) {
  return pedir<OpcionesCita>(`/citas/opciones${fecha ? `?fecha=${fecha}` : ""}`);
}

export function agendarCita(datos: {
  fecha: string;
  hora: string;
  tipo_servicio: string;
  descripcion: string;
}) {
  return pedir<{ cita: Cita; mensaje: string }>("/citas", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function cancelarCita(id: number, motivo?: string) {
  return pedir<{ mensaje: string }>(`/citas/${id}/cancelar`, {
    method: "POST",
    body: JSON.stringify({ motivo: motivo || "" }),
  });
}

/** Etiqueta legible del tipo de servicio, que en base viaja en MAYUSCULAS_CON_GUION. */
export const ETIQUETA_SERVICIO: Record<string, string> = {
  MANTENIMIENTO:      "Mantenimiento / cambio de aceite",
  DIAGNOSTICO:        "Diagnóstico computarizado",
  FRENOS:             "Frenos",
  SUSPENSION:         "Suspensión y dirección",
  ELECTRICO:          "Sistema eléctrico",
  AIRE_ACONDICIONADO: "Aire acondicionado",
  ALINEACION:         "Alineación y balanceo",
  MOTOR:              "Motor y transmisión",
  CARWASH:            "Car wash",
  OTRO:               "Otro",
};

const DIAS_ES  = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/**
 * "2026-08-03" → "lunes 3 de agosto".
 *
 * Se parte el string a mano en vez de usar `new Date("2026-08-03")`: ese
 * constructor lo interpreta como UTC y en República Dominicana (UTC-4) la
 * fecha se muestra un día antes.
 */
export function fechaBonita(iso: string): string {
  const [a, m, d] = String(iso || "").split("-").map(Number);
  if (!a || !m || !d) return String(iso || "");
  return `${DIAS_ES[new Date(a, m - 1, d).getDay()]} ${d} de ${MESES_ES[m - 1]}`;
}

/** "14:30" → "2:30 PM". */
export function horaBonita(hora: string): string {
  const [h, m = "00"] = String(hora || "").split(":");
  const n = Number(h);
  if (Number.isNaN(n)) return String(hora || "");
  const h12 = n % 12 === 0 ? 12 : n % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${n >= 12 ? "PM" : "AM"}`;
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

  // 1. Primero el servidor. Pedir permiso antes sería un error: el navegador
  //    solo muestra ese diálogo una vez, y si luego falla por falta de llaves
  //    VAPID el usuario habría gastado el permiso a cambio de nada.
  let clave: string;
  try {
    const r = await clavePush();
    if (!r?.clave || !r.disponible) {
      return {
        ok: false,
        motivo: "sin-clave",
        detalle: "El servidor no tiene configuradas las llaves VAPID.",
      };
    }
    clave = r.clave;
  } catch (e: any) {
    return {
      ok: false,
      motivo: "sin-clave",
      detalle:
        e?.status === 503
          ? "Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en Railway, o falta instalar el paquete web-push."
          : e?.message || "No se pudo consultar la configuración de notificaciones.",
    };
  }

  // 2. El service worker tiene que estar activo antes de suscribirse.
  let registro: ServiceWorkerRegistration;
  try {
    registro = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, rechazar) =>
        setTimeout(() => rechazar(new Error("timeout")), 10000)
      ),
    ]);
  } catch {
    return {
      ok: false,
      motivo: "error",
      detalle:
        "El service worker no está activo. Recarga la página; si es la primera visita, " +
        "puede tardar unos segundos en instalarse.",
    };
  }

  // 3. Ahora sí, el permiso.
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return { ok: false, motivo: "denegado" };

    // Si ya había una suscripción con otra clave (rotaste VAPID), hay que
    // darla de baja primero o `subscribe` falla con InvalidStateError.
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
    return { ok: false, motivo: "error", detalle: e?.message || String(e) };
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
  // Si el secreto no está configurado, el backend responde 403 y el mensaje
  // resultante ("No autorizado") no dice qué hay que arreglar. Mejor cortar
  // aquí con una instrucción concreta.
  if (!secretoAdmin) {
    throw new ErrorPortal(
      "Falta la variable NEXT_PUBLIC_PORTAL_ADMIN_SECRET en el frontend (Vercel). " +
        "Debe tener el mismo valor que PORTAL_ADMIN_SECRET en Railway.",
      0
    );
  }

  const control = new AbortController();
  const cronometro = setTimeout(() => control.abort(), 20000);

  let res: Response;
  try {
    res = await fetch(`${API}/portal/admin/codigo-mostrador`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-portal-admin": secretoAdmin },
      body: JSON.stringify({ cliente_id: clienteId, generado_por: generadoPor }),
      signal: control.signal,
    });
  } catch (e: any) {
    // `fetch` solo rechaza por red, CORS o abort. La causa más común aquí es
    // que la cabecera `x-portal-admin` no esté permitida en el CORS del
    // backend: el navegador bloquea el preflight y esto parece un fallo de red.
    if (e?.name === "AbortError") {
      throw new ErrorPortal("El servidor tardó demasiado en responder.", 0);
    }
    throw new ErrorPortal(
      "No se pudo contactar al servidor. Si acabas de desplegar, verifica que " +
        "'x-portal-admin' esté en allowedHeaders del CORS en server.mjs.",
      0
    );
  } finally {
    clearTimeout(cronometro);
  }

  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ErrorPortal(
      cuerpo?.detalle_tecnico || cuerpo?.mensaje || `Error ${res.status}`,
      res.status,
      cuerpo
    );
  }
  return cuerpo as {
    codigo: string;
    cliente: string;
    vence_en_horas: number;
    instruccion: string;
  };
}
