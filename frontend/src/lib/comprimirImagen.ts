/**
 * Comprime una foto del celular antes de guardarla.
 *
 * Una foto de celular pesa 3–6 MB y en base64 un tercio más. Con 2 o 3 fotos
 * la inspección pasaba el límite de 10 MB del servidor, la petición fallaba y
 * la inspección (fotos + lista de verificación) no se guardaba. A 1280 px y
 * calidad 0.72 cada foto queda en ~150–300 KB y se sigue viendo bien.
 *
 * La usan recepción (/recepcion) e inspección (/inspeccion/[ordenId]).
 */

export const FOTO_MAX_LADO = 1280;
export const FOTO_CALIDAD = 0.72;

/** Límite seguro del cuerpo de la petición (el servidor acepta 10 MB). */
export const LIMITE_INSPECCION_BYTES = 9 * 1024 * 1024;

export function leerComoDataURL(file: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => mal(r.error);
    r.readAsDataURL(file);
  });
}

export async function comprimirImagen(file: File, maxLado = FOTO_MAX_LADO, calidad = FOTO_CALIDAD): Promise<string> {
  const original = await leerComoDataURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = mal;
      i.src = original;
    });
    const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * escala));
    const h = Math.max(1, Math.round(img.naturalHeight * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, w, h);
    const comprimida = canvas.toDataURL("image/jpeg", calidad);
    return comprimida.length < original.length ? comprimida : original;
  } catch {
    return original; // formato que el navegador no puede dibujar: se manda tal cual
  }
}

/** Mensaje claro cuando el servidor rechaza la inspección. */
export async function errorDeRespuesta(res: Response): Promise<string> {
  if (res.status === 413) return "Las fotos pesan demasiado para el servidor. Quita alguna foto y vuelve a guardar.";
  const texto = await res.text().catch(() => "");
  try {
    const j = JSON.parse(texto);
    return j?.error || j?.mensaje || `El servidor respondió ${res.status}`;
  } catch {
    return texto?.slice(0, 160) || `El servidor respondió ${res.status}`;
  }
}
