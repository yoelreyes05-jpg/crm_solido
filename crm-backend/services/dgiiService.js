// crm-backend/services/dgiiService.js
// Consulta RNC/Cédula contra la DGII usando API pública de Dominican Technology
// con caché en memoria para evitar llamadas repetidas al mismo RNC

const axios = require('axios');

// ─── Caché en memoria ────────────────────────────────────────────────────────
// Guarda resultados por 24 horas para no consultar el mismo RNC repetidamente
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

function obtenerDelCache(rnc) {
  const entrada = cache.get(rnc);
  if (!entrada) return null;
  if (Date.now() - entrada.timestamp > CACHE_TTL_MS) {
    cache.delete(rnc);
    return null;
  }
  return entrada.data;
}

function guardarEnCache(rnc, data) {
  cache.set(rnc, { data, timestamp: Date.now() });
}

// ─── Validación básica de formato ────────────────────────────────────────────
function validarFormatoRNC(rnc) {
  const limpio = rnc.replace(/[-\s]/g, '');
  // RNC empresarial: 9 dígitos | Cédula personal: 11 dígitos
  if (!/^\d{9}$/.test(limpio) && !/^\d{11}$/.test(limpio)) {
    return { valido: false, limpio, mensaje: 'El RNC debe tener 9 dígitos o la cédula 11 dígitos' };
  }
  return { valido: true, limpio };
}

// ─── Consulta principal ──────────────────────────────────────────────────────
async function consultarRNC(rnc) {
  const { valido, limpio, mensaje } = validarFormatoRNC(rnc);

  if (!valido) {
    throw { codigo: 400, mensaje };
  }

  // Revisar caché primero
  const enCache = obtenerDelCache(limpio);
  if (enCache) {
    console.log(`[DGII] Cache hit para RNC: ${limpio}`);
    return { ...enCache, fuente: 'cache' };
  }

  try {
    console.log(`[DGII] Consultando RNC: ${limpio}`);

    const respuesta = await axios.get(
      `https://api-dgii.dominicantechnology.com/api/v1/rnc/${limpio}`,
      {
        timeout: 8000, // 8 segundos máximo
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CRM-TallerMecanico/1.0',
        },
      }
    );

    const datos = respuesta.data?.data || respuesta.data;

    // Normalizar respuesta al formato que usa tu CRM
    const resultado = {
      rnc: limpio,
      razonSocial: datos.razon_social || datos.nombre || null,
      nombreComercial: datos.nombre_comercial || null,
      estado: datos.estado || null,               // ACTIVO / SUSPENDIDO / etc.
      actividad: datos.actividad_economica || null,
      categoria: datos.categoria || null,
      regimen: datos.regimen_pagos || null,
      tipo: limpio.length === 11 ? 'CEDULA' : 'RNC',
      fuente: 'dgii',
    };

    guardarEnCache(limpio, resultado);
    return resultado;

  } catch (error) {

    // RNC no existe en DGII
    if (error.response?.status === 404) {
      throw { codigo: 404, mensaje: `El RNC/Cédula ${limpio} no está registrado en la DGII` };
    }

    // Timeout o DGII no responde — intentar fallback con MegaPlus
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      console.warn('[DGII] Timeout en Dominican Technology, intentando fallback MegaPlus...');
      return await consultarRNCFallback(limpio);
    }

    // Error de red general
    if (error.request) {
      throw { codigo: 503, mensaje: 'No se pudo conectar con el servicio de la DGII. Intente de nuevo.' };
    }

    // Re-lanzar errores propios (400, 404)
    if (error.codigo) throw error;

    throw { codigo: 500, mensaje: 'Error inesperado consultando la DGII' };
  }
}

// ─── Fallback: MegaPlus API ──────────────────────────────────────────────────
async function consultarRNCFallback(limpio) {
  try {
    const respuesta = await axios.get(
      `https://rnc.megaplus.com.do/api/rnc/${limpio}`,
      { timeout: 8000, headers: { 'Accept': 'application/json' } }
    );

    const datos = respuesta.data;

    if (datos.error) {
      throw { codigo: 404, mensaje: `El RNC/Cédula ${limpio} no está registrado en la DGII` };
    }

    const resultado = {
      rnc: limpio,
      razonSocial: datos.razon_social || null,
      nombreComercial: datos.nombre_comercial || null,
      estado: datos.estado || null,
      actividad: datos.actividad || null,
      categoria: datos.categoria || null,
      regimen: null,
      tipo: limpio.length === 11 ? 'CEDULA' : 'RNC',
      fuente: 'megaplus-fallback',
    };

    guardarEnCache(limpio, resultado);
    return resultado;

  } catch (error) {
    if (error.codigo) throw error;
    throw { codigo: 503, mensaje: 'Todos los servicios DGII están no disponibles. Intente más tarde.' };
  }
}

// ─── Limpiar caché manualmente (opcional, para admin) ────────────────────────
function limpiarCache() {
  const antes = cache.size;
  cache.clear();
  console.log(`[DGII] Caché limpiado. ${antes} entradas eliminadas.`);
  return antes;
}

function estadoCache() {
  return { entradas: cache.size, ttl_horas: CACHE_TTL_MS / 3600000 };
}

module.exports = { consultarRNC, limpiarCache, estadoCache };