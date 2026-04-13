import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { partId, quantity } = body;
    if (!partId || !quantity) {
      return NextResponse.json({ error: 'Repuesto y cantidad son requeridos' }, { status: 400 });
    }
    const part = await prisma.part.findUnique({ where: { id: parseInt(partId) } });
    if (!part) return NextResponse.json({ error: 'Repuesto no encontrado' }, { status: 404 });
    if (part.stock < parseInt(quantity)) {
      return NextResponse.json({ error: `Stock insuficiente. Disponible: ${part.stock}` }, { status: 400 });
    }

    const [orderPart] = await prisma.$transaction([
      prisma.orderPart.create({
        data: {
          workOrderId: parseInt(params.id),
          partId: parseInt(partId),
          quantity: parseInt(quantity),
          unitPrice: part.price
        },
        include: { part: true }
      }),
      prisma.part.update({
        where: { id: parseInt(partId) },
        data: { stock: { decrement: parseInt(quantity) } }
      })
    ]);
    return NextResponse.json(orderPart, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error al agregar repuesto' }, { status: 500 });
  }
}
