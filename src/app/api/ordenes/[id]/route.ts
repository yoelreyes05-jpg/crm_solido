import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const order = await prisma.workOrder.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        vehicle: { include: { client: true } },
        orderParts: { include: { part: true } },
        invoices: true
      }
    });
    if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener orden' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { description, status, technician, vehicleId } = body;
    const data: any = {};
    if (description !== undefined) data.description = description;
    if (status !== undefined) data.status = status;
    if (technician !== undefined) data.technician = technician;
    if (vehicleId !== undefined) data.vehicleId = parseInt(vehicleId);

    const order = await prisma.workOrder.update({
      where: { id: parseInt(params.id) },
      data,
      include: { vehicle: { include: { client: true } }, orderParts: { include: { part: true } } }
    });
    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar orden' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.workOrder.delete({ where: { id: parseInt(params.id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar orden' }, { status: 500 });
  }
}
