/* frontend/public/push-listener.js
 *
 * Manejadores de notificaciones push del service worker.
 *
 * ── Por qué este archivo existe ─────────────────────────────────────────────
 *
 * Estos manejadores estaban en `frontend/worker/index.js`, confiando en la
 * función de "custom worker" de next-pwa. No funcionó: el `sw.js` desplegado
 * contiene `importScripts()` — vacío — o sea que el worker personalizado nunca
 * se compiló ni se incluyó.
 *
 * El resultado era el peor posible de diagnosticar: el backend enviaba el push
 * correctamente, el navegador lo recibía, y como el service worker no tenía
 * ningún listener de `push`, no pasaba nada. Ni notificación, ni error, ni
 * nada en los logs. Todo "funcionaba" y aun así al cliente no le llegaba nada.
 *
 * Este archivo es estático: se sirve tal cual desde /push-listener.js y se
 * inyecta en el service worker con la opción `importScripts` de next.config.js,
 * que workbox escribe siempre, sin depender de que se compile nada. Si mañana
 * next-pwa cambia, esto sigue funcionando.
 *
 * ⚠️ No usar sintaxis moderna que requiera transpilación: este archivo NO pasa
 * por webpack. JavaScript plano, como está.
 */

/* eslint-disable no-undef */

// Guarda contra doble registro: si alguna vez el worker personalizado de
// next-pwa vuelve a compilarse, los dos archivos definirían el mismo listener
// y cada aviso aparecería duplicado en el teléfono.
if (!self.__solidoPushListo) {
  self.__solidoPushListo = true;

  // ── Llega una notificación del servidor ───────────────────────────────────
  self.addEventListener("push", function (event) {
    var datos = {};

    try {
      datos = event.data ? event.data.json() : {};
    } catch (e) {
      // Si el payload no es JSON, se muestra como texto en vez de perderlo.
      datos = {
        titulo: "Sólido Auto Servicio",
        cuerpo: event.data ? event.data.text() : "",
      };
    }

    var titulo = datos.titulo || "Sólido Auto Servicio";

    var opciones = {
      body: datos.cuerpo || "",
      icon: "/logo-192x192.png",
      badge: "/logo-192x192.png",
      // `tag` agrupa: si llegan dos avisos de la misma orden o cita, el nuevo
      // reemplaza al anterior en vez de apilarse en la bandeja.
      tag: datos.etiqueta || "solido",
      renotify: true,
      // Se queda en pantalla hasta que el cliente la toque. Para "tu vehículo
      // está listo" eso importa: es el aviso que no puede pasar desapercibido.
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { url: datos.url || "/cliente" },
      actions: [{ action: "abrir", title: "Ver" }],
    };

    event.waitUntil(self.registration.showNotification(titulo, opciones));
  });

  // ── El cliente toca la notificación ───────────────────────────────────────
  self.addEventListener("notificationclick", function (event) {
    event.notification.close();

    var destino =
      (event.notification.data && event.notification.data.url) || "/cliente";

    event.waitUntil(
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then(function (ventanas) {
          // Si la app ya está abierta, se enfoca y se navega ahí mismo en vez
          // de abrir una segunda pestaña encima.
          for (var i = 0; i < ventanas.length; i++) {
            var ventana = ventanas[i];
            if (ventana.url.indexOf("/cliente") !== -1 && "focus" in ventana) {
              if (ventana.navigate) {
                ventana.navigate(destino).catch(function () {});
              }
              return ventana.focus();
            }
          }
          if (self.clients.openWindow) return self.clients.openWindow(destino);
        })
    );
  });

  // ── El navegador rotó las claves de la suscripción ────────────────────────
  // Pasa cada cierto tiempo. Si no se re-registra, el cliente deja de recibir
  // avisos en silencio y nadie se entera hasta que reclama.
  self.addEventListener("pushsubscriptionchange", function (event) {
    event.waitUntil(
      (function () {
        var opciones = event.oldSubscription
          ? {
              userVisibleOnly: true,
              applicationServerKey:
                event.oldSubscription.options.applicationServerKey,
            }
          : { userVisibleOnly: true };

        return self.registration.pushManager
          .subscribe(opciones)
          .then(function (nueva) {
            // El token del portal vive en localStorage, al que un service
            // worker no tiene acceso. Se le pide a la pestaña abierta que
            // haga ella la llamada al backend.
            return self.clients
              .matchAll({ type: "window", includeUncontrolled: true })
              .then(function (ventanas) {
                for (var i = 0; i < ventanas.length; i++) {
                  ventanas[i].postMessage({
                    tipo: "resuscribir-push",
                    suscripcion: nueva.toJSON(),
                  });
                }
              });
          })
          .catch(function () {
            // Sin pestaña abierta no se puede renovar ahora. El componente
            // ActivarNotificaciones lo reintenta la próxima vez que el cliente
            // entre a la app.
          });
      })()
    );
  });
}
