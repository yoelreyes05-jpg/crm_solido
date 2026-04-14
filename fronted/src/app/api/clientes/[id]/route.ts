import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        vehicles: { include: { workOrders: { orderBy: { createdAt: 'desc' } } } }
      }
    });
    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    return NextResponse.json(client);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener cliente' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { name, cedula, phone, email, address } = body;
    if (!name || !phone) {
      return NextResponse.json({ error: 'Nombre y teléfono son requeridos' }, { status: 400 });
    }
    const client = await prisma.client.update({
      where: { id: parseInt(params.id) },
      data: { name, cedula: cedula || null, phone, email: email || null, address: address || null }
    });
    return NextResponse.json(client);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'La cédula ya está registrada' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.client.delete({ where: { id: parseInt(params.id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar cliente. Puede tener registros asociados.' }, { status: 500 });
  }
}
