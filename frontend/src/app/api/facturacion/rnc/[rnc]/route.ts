// frontend/src/app/api/facturacion/rnc/[rnc]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL
  || 'https://crm-automotriz-3wde-production.up.railway.app';

export async function GET(
  request: NextRequest,
  { params }: { params: { rnc: string } }
) {
  const { rnc } = params;

  if (!rnc) {
    return NextResponse.json({ error: true, mensaje: 'RNC requerido' }, { status: 400 });
  }

  try {
    const respuesta = await fetch(`${BACKEND}/facturacion/rnc/${rnc}`, {
      headers: { 'Content-Type': 'application/json' },
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
