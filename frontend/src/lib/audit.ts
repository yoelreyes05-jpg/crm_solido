/**
 * Auditoría — identifica al usuario actual ante el backend.
 *
 * Devuelve el header "x-usuario" con { id, nombre, rol } leído del
 * localStorage. El backend (usuarioDesdeReq en server.mjs) lo usa para
 * registrar quién ejecutó cada acción sensible en la tabla log_acciones.
 *
 * Uso:
 *   import { auditHeaders } from "@/lib/audit";
 *   fetch(`${API}/facturas/${id}`, { method: "DELETE", headers: auditHeaders() });
 *   fetch(`${API}/usuarios`, { method: "POST", headers: { "Content-Type": "application/json", ...auditHeaders() }, body });
 */
export function auditHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("usuario");
    if (!raw) return {};
    const u = JSON.parse(raw);
    return {
      "x-usuario": encodeURIComponent(
        JSON.stringify({ id: u.id ?? null, nombre: u.nombre || "Sistema", rol: u.rol || null })
      ),
    };
  } catch {
    return {};
  }
}
