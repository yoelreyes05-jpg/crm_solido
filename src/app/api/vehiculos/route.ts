import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        client: true,
        _count: { select: { workOrders: true } }
      }
    });
    return NextResponse.json(vehicles);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener vehículos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brand, model, year, color, plate, clientId } = body;
    if (!brand || !model || !year || !plate || !clientId) {
      return NextResponse.json({ error: 'Marca, modelo, año, placa y cliente son requeridos' }, { status: 400 });
    }
    const vehicle = await prisma.vehicle.create({
      data: { brand, model, year: parseInt(year), color: color || null, plate: plate.toUpperCase(), clientId: parseInt(clientId) },
      include: { client: true }
    });
    return NextResponse.json(vehicle, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'La placa ya está registrada' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Error al crear vehículo' }, { status: 500 });
  }
}
