// crm-backend/routes/facturacion.js
// Montar en app.js: app.use('/facturacion', require('./routes/facturacion'))

const express = require('express');
const router = express.Router();
const { consultarRNC, limpiarCache, estadoCache } = require('../services/dgiiService');

// ─── GET /facturacion/rnc/:rnc ───────────────────────────────────────────────
// Busca un contribuyente por RNC o Cédula en la DGII
// Ejemplo: GET /facturacion/rnc/130263241
router.get('/rnc/:rnc', async (req, res) => {
  const { rnc } = req.params;

  if (!rnc) {
    return res.status(400).json({ error: true, mensaje: 'RNC requerido' });
  }

  try {
    const datos = await consultarRNC(rnc);
    return res.json({ error: false, datos });
  } catch (err) {
    return res.status(err.codigo || 500).json({
      error: true,
      mensaje: err.mensaje || 'Error consultando RNC',
    });
  }
});

// ─── DELETE /facturacion/rnc/cache ──────────────────────────────────────────
// Limpia el caché de RNCs (útil para forzar datos frescos)
// Solo accesible por admins — añade tu middleware de auth aquí si lo necesitas
router.delete('/rnc/cache', (req, res) => {
  const eliminadas = limpiarCache();
  res.json({ error: false, mensaje: `Caché limpiado. ${eliminadas} entradas eliminadas.` });
});

// ─── GET /facturacion/rnc/cache/estado ──────────────────────────────────────
// Muestra cuántas entradas hay en caché
router.get('/rnc/cache/estado', (req, res) => {
  res.json({ error: false, ...estadoCache() });
});

module.exports = router;