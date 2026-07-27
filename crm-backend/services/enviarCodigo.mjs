// crm-backend/services/enviarCodigo.mjs
// Envío del código de acceso al cliente del portal.
//
// Usa BREVO, el mismo proveedor que ya envía los correos de citas en
// server.mjs — misma API key, mismo remitente verificado, cero configuración
// nueva. (Railway bloquea los puertos SMTP salientes; por eso Brevo por API
// HTTPS y no Gmail/nodemailer.)
//
// WhatsApp queda implementado pero inactivo hasta que tengas la API empresarial
// de Meta. Cuando la tengas: pones WHATSAPP_TOKEN + WHATSAPP_PHONE_ID en
// Railway y `enviarCodigoPorWhatsApp` empieza a funcionar sin tocar nada más
// (portal_otp ya guarda el canal).

const BREVO_API_KEY   = process.env.BREVO_API_KEY || "";
const MAIL_FROM_NAME  = "Sólido Auto Servicio";
const MAIL_FROM_EMAIL =
  process.env.MAIL_FROM_EMAIL || process.env.GMAIL_USER || "solidoautoservicio@gmail.com";

const MODO_DESARROLLO = process.env.MODO_DESARROLLO === "1";

const WHATSAPP_TOKEN    = process.env.WHATSAPP_TOKEN || "";
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || "";

// ─── Plantilla ───────────────────────────────────────────────────────────────
// Sigue la línea visual de plantillaCitaCliente en server.mjs.

function plantillaCodigo({ nombre, codigo, vehiculo, minutos }) {
  const saludo = nombre ? `Hola <strong>${nombre.split(" ")[0]}</strong>,` : "Hola,";
  const carro = vehiculo
    ? `<tr><td style="padding:8px 0;color:#64748b">🚗 Vehículo</td>
         <td style="padding:8px 0;font-weight:700;text-align:right">${vehiculo}</td></tr>`
    : "";

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;background:#f5f7fb;padding:24px;border-radius:14px">
    <div style="background:#0f172a;color:#fff;text-align:center;padding:22px;border-radius:12px 12px 0 0">
      <div style="font-size:22px;font-weight:900;letter-spacing:1px">SÓLIDO AUTO SERVICIO</div>
      <div style="font-size:12px;opacity:.8;margin-top:4px">Portal del cliente</div>
    </div>

    <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px">
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px">
        ${saludo} este es tu código para ver el estado de tu vehículo.
      </p>

      <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:22px;text-align:center;margin:0 0 18px">
        <div style="font-size:11px;color:#64748b;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Tu código</div>
        <div style="font-size:38px;font-weight:900;letter-spacing:10px;color:#1e3a8a;font-family:'Courier New',monospace">${codigo}</div>
      </div>

      ${carro ? `<table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155">${carro}</table>` : ""}

      <div style="background:#fef3c7;color:#92400e;font-size:13px;padding:12px 14px;border-radius:9px;margin-top:16px;line-height:1.5">
        Vence en <strong>${minutos} minutos</strong> y solo sirve una vez.
      </div>

      <p style="color:#64748b;font-size:13px;margin-top:18px;line-height:1.6">
        Si no pediste este código, ignóralo — nadie puede entrar sin él.<br/>
        <strong>Nunca compartas este código</strong>, ni siquiera con personal del taller.
      </p>

      <p style="color:#94a3b8;font-size:12px;margin-top:16px;line-height:1.6">
        Correo automático, no respondas a esta dirección.<br/>
        ¿Dudas? Escríbenos por WhatsApp al <strong>849-569-2027</strong>.
      </p>
    </div>
  </div>`;
}

// ─── Envío ───────────────────────────────────────────────────────────────────

/**
 * Envía el código de acceso por correo vía Brevo.
 * @returns {Promise<{ok:true, proveedor:string}>}
 * @throws  si Brevo falla o no está configurado (y no estás en desarrollo).
 *          A diferencia de `enviarCorreo` en server.mjs, aquí SÍ lanzamos:
 *          si el correo no sale, el cliente se queda esperando un código que
 *          nunca llega, y hay que redirigirlo al flujo de mostrador.
 */
export async function enviarCodigoPorCorreo({ para, codigo, nombre, vehiculo, minutos = 10 }) {
  if (!BREVO_API_KEY) {
    if (MODO_DESARROLLO) {
      console.log(`\n[portal · DEV] Código para ${para}: ${codigo}  (vence en ${minutos} min)\n`);
      return { ok: true, proveedor: "consola" };
    }
    throw new Error("BREVO_API_KEY no configurada");
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: MAIL_FROM_NAME, email: MAIL_FROM_EMAIL },
      to: [{ email: para }],
      subject: `${codigo} es tu código de acceso · Sólido Auto Servicio`,
      htmlContent: plantillaCodigo({ nombre, codigo, vehiculo, minutos }),
      textContent:
        `Tu código de acceso al portal de Sólido Auto Servicio es: ${codigo}\n` +
        `Vence en ${minutos} minutos y solo sirve una vez.\n` +
        `Si no lo pediste, ignora este correo.`,
    }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${detalle.slice(0, 300)}`);
  }

  return { ok: true, proveedor: "brevo" };
}

/**
 * Envío por WhatsApp — LISTO PERO INACTIVO.
 *
 * Cuando Meta te apruebe la API empresarial:
 *   1. Crea la plantilla `codigo_acceso` en el Business Manager
 *      (categoría AUTHENTICATION, un parámetro: el código).
 *   2. Pon WHATSAPP_TOKEN y WHATSAPP_PHONE_ID en Railway.
 *   3. En portalCliente.mjs, donde dice canal:"correo", ofrece también
 *      "whatsapp" — la tabla portal_otp ya lo soporta.
 */
export async function enviarCodigoPorWhatsApp({ telefono, codigo }) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    throw new Error("WhatsApp Business API no configurada todavía");
  }

  const numero = String(telefono).replace(/\D/g, "");
  // RD: 809/829/849 son de 10 dígitos → se les antepone el código de país 1.
  const destino = numero.length === 10 ? `1${numero}` : numero;

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: destino,
        type: "template",
        template: {
          name: "codigo_acceso",
          language: { code: "es" },
          components: [
            { type: "body", parameters: [{ type: "text", text: codigo }] },
            {
              type: "button", sub_type: "url", index: "0",
              parameters: [{ type: "text", text: codigo }],
            },
          ],
        },
      }),
    }
  );

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`WhatsApp ${res.status}: ${detalle.slice(0, 300)}`);
  }
  return { ok: true, proveedor: "whatsapp" };
}

/** ¿Se puede enviar el código por correo hoy? */
export function hayCanalDeCorreo() {
  return Boolean(BREVO_API_KEY || MODO_DESARROLLO);
}

/** ¿Ya está WhatsApp disponible? Hoy: false. */
export function hayCanalDeWhatsApp() {
  return Boolean(WHATSAPP_TOKEN && WHATSAPP_PHONE_ID);
}
