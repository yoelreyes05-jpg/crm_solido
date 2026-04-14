import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        client: true,
        workOrders: { orderBy: { createdAt: 'desc' }, include: { orderParts: { include: { part: true } } } }
      }
    });
    if (!vehicle) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });
    return NextResponse.json(vehicle);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener vehículo' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { brand, model, year, color, plate, clientId } = body;
    const vehicle = await prisma.vehicle.update({
      where: { id: parseInt(params.id) },
      data: { brand, model, year: parseInt(year), color: color || null, plate: plate.toUpperCase(), clientId: parseInt(clientId) }
    });
    return NextResponse.json(vehicle);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'La placa ya está registrada' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Error al actualizar vehículo' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.vehicle.delete({ where: { id: parseInt(params.id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar vehículo' }, { status: 500 });
  }
}
