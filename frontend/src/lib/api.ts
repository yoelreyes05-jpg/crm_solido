/**
 * Authenticated fetch wrapper for the CRM backend.
 * Reads the JWT token stored at "crm_token" in localStorage and
 * adds an Authorization header to every request.
 *
 * Usage:
 *   import { apiFetch } from "@/lib/api";
 *   const res = await apiFetch("/ordenes");
 *   const res = await apiFetch("/ordenes", { method: "POST", body: JSON.stringify(data) });
 */

import { API_URL as API } from "@/config";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("crm_token");
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = path.startsWith("http") ? path : `${API}${path}`;

  return fetch(url, { ...options, headers });
}

/** Convenience wrapper: fetch + parse JSON in one call */
export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}
