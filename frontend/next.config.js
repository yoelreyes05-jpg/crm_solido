/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',         // Donde se generarán los archivos del Service Worker
  register: true,         // Registra el service worker automáticamente
  skipWaiting: true,      // Activa el nuevo service worker de inmediato
  disable: process.env.NODE_ENV === 'development' // Desactivar en desarrollo para evitar caché molesto
});

const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  // Aquí puedes agregar otras configuraciones de Next.js si las necesitas
};

module.exports = withPWA(nextConfig);