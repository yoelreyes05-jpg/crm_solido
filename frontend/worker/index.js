// frontend/worker/index.js
//
// Service worker personalizado para las notificaciones push de la PWA.
//
// next-pwa compila automáticamente todo lo que esté en la carpeta `worker/`
// hacia `public/worker-<hash>.js` y lo importa desde el `sw.js` generado. Por
// eso NO hay que editar `public/sw.js` a mano: ese archivo se regenera en cada
// build y cualquier cambio manual se pierde.
//
// Requiere `next-pwa` >= 5.6 (ya está en package.json).

// ── Llega una notificación del servidor ──────────────────────────────────────
self.addEventListener("push", (event) => {
  let datos = {};

  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    // Si el payload no es JSON, lo mostramos como texto plano en vez de perderlo.
    datos = { titulo: "Sólido Auto Servicio", cuerpo: event.data ? event.data.text() : "" };
  }

  const titulo = datos.titulo || "Sólido Auto Servicio";

  const opciones = {
    body: datos.cuerpo || "",
    icon: "/logo-192x192.png",
    badge: "/logo-192x192.png",
    // `tag` agrupa: si llegan dos avisos de la misma orden, el nuevo reemplaza
    // al anterior en vez de apilarse en la bandeja.
    tag: datos.etiqueta || "solido",
    renotify: true,
    // Se queda en pantalla hasta que el cliente la toque. Para "tu vehículo
    // está listo" eso importa: es el aviso que no puede pasar desapercibido.
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { url: datos.url || "/cliente" },
    actions: [{ action: "abrir", title: "Ver estado" }],
  };

  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

// ── El cliente toca la notificación ──────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const destino = (event.notification.data && event.notification.data.url) || "/cliente";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((ventanas) => {
        // Si la PWA ya está abierta, la enfocamos y navegamos ahí mismo en vez
        // de abrir una segunda pestaña.
        for (const ventana of ventanas) {
          if (ventana.url.includes("/cliente") && "focus" in ventana) {
            ventana.navigate(destino).catch(() => {});
            return ventana.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(destino);
      })
  );
});

// ── El navegador rotó las claves de la suscripción ───────────────────────────
// Pasa cada cierto tiempo. Si no se re-registra, el cliente deja de recibir
// avisos en silencio y nadie se entera hasta que reclama.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const nueva = await self.registration.pushManager.subscribe(
          event.oldSubscription
            ? {
                userVisibleOnly: true,
                applicationServerKey: event.oldSubscription.options.applicationServerKey,
              }
            : { userVisibleOnly: true }
        );

        // El token del portal vive en localStorage, al que un service worker no
        // tiene acceso. Se lo pedimos a la pestaña abierta.
        const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const ventana of ventanas) {
          ventana.postMessage({ tipo: "resuscribir-push", suscripcion: nueva.toJSON() });
        }
      } catch (e) {
        // Sin pestaña abierta no se puede renovar ahora; el componente
        // ActivarNotificaciones lo reintenta la próxima vez que el cliente entre.
      }
    })()
  );
});
