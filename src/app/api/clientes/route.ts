import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        vehicles: { include: { _count: { select: { workOrders: true } } } },
        _count: { select: { vehicles: true } }
      }
    });
    return NextResponse.json(clients);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, cedula, phone, email, address } = body;
    if (!name || !phone) {
      return NextResponse.json({ error: 'Nombre y teléfono son requeridos' }, { status: 400 });
    }
    const client = await prisma.client.create({
      data: { name, cedula: cedula || null, phone, email: email || null, address: address || null }
    });
    return NextResponse.json(client, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'La cédula ya está registrada' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 });
  }
}
