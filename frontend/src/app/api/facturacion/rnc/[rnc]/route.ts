// frontend/src/app/api/facturacion/rnc/[rnc]/route.ts
// Proxy entre el frontend Next.js y el crm-backend Express
// Ejemplo: GET /api/facturacion/rnc/130263241

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'https://crm-automotriz-3wde-production.up.railway.app/facturacion/rnc/:rnc';

export async function GET(
  request: NextRequest,
  { params }: { params: { rnc: string } }
) {
  const { rnc } = params;

  if (!rnc) {
    return NextResponse.json({ error: true, mensaje: 'RNC requerido' }, { status: 400 });
  }

  try {
    const respuesta = await fetch(`${BACKEND_URL}/facturacion/rnc/${rnc}`, {
      headers: { 'Content-Type': 'application/json' },
      // Next.js no cachea fetch por defecto en route handlers, pero lo dejamos explícito:
      cache: 'no-store',
    });

    const datos = await respuesta.json();

    return NextResponse.json(datos, { status: respuesta.status });

  } catch (error) {
    console.error('[API RNC] Error conectando al backend:', error);
    return NextResponse.json(
      { error: true, mensaje: 'No se pudo conectar con el servidor' },
      { status: 503 }
    );
  }
}