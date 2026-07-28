// frontend/worker/index.js
//
// ⚠️ ESTE ARCHIVO YA NO CONTIENE LÓGICA. No lo edites esperando que haga algo.
//
// Aquí vivían los manejadores de notificaciones push, confiando en la función
// de "custom worker" de next-pwa (que compila `worker/` hacia
// `public/worker-<hash>.js` y lo importa desde el `sw.js` generado).
//
// Esa compilación nunca ocurrió en el despliegue real: el `sw.js` publicado
// contenía `importScripts()` vacío. Consecuencia: el backend enviaba el push,
// el navegador lo recibía, y como el service worker no tenía listener de
// `push`, no aparecía nada en el teléfono. Sin error, sin log, sin pista —
// por eso costó tanto encontrarlo.
//
// La lógica está ahora en **frontend/public/push-listener.js**, un archivo
// estático que se inyecta con la opción `importScripts` de `next.config.js`.
// Workbox escribe esa línea siempre, sin depender de compilar nada.
//
// El archivo se deja vacío en lugar de borrarse porque next-pwa busca este
// directorio en cada build; si el worker personalizado volviera a compilarse,
// no debe registrar un segundo listener de `push` — eso duplicaría cada aviso
// en el teléfono del cliente.
//
// Ver: frontend/public/push-listener.js
