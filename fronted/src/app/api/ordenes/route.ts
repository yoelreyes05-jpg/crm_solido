import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const orders = await prisma.workOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        vehicle: { include: { client: true } },
        orderParts: { include: { part: true } }
      }
    });
    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener órdenes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { description, vehicleId, technician } = body;
    if (!description || !vehicleId) {
      return NextResponse.json({ error: 'Descripción y vehículo son requeridos' }, { status: 400 });
    }
    const order = await prisma.workOrder.create({
      data: {
        description,
        vehicleId: parseInt(vehicleId),
        technician: technician || null
      },
      include: { vehicle: { include: { client: true } } }
    });
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error al crear orden' }, { status: 500 });
  }
}
