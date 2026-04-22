/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // ── CRÍTICO para Vercel ──
  buildExcludes: [/middleware-manifest\.json$/],
  publicExcludes: ['!robots.txt', '!sitemap.xml'],
  // Evita que next-pwa intente cachear rutas protegidas
  runtimeCaching: [
    {
      // Archivos estáticos — cache first
      urlPattern: /^https:\/\/crm-solido\.vercel\.app\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      // Imágenes — cache first
      urlPattern: /^https:\/\/crm-solido\.vercel\.app\/.*\.(png|jpg|jpeg|svg|ico)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      // Página /cliente — network first
      urlPattern: /^https:\/\/crm-solido\.vercel\.app\/cliente.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'cliente-page',
        expiration: { maxEntries: 10, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
  ],
});

const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

module.exports = withPWA(nextConfig);