import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { name, contact, phone, email } = body;
    const supplier = await prisma.supplier.update({
      where: { id: parseInt(params.id) },
      data: { name, contact: contact || null, phone: phone || null, email: email || null }
    });
    return NextResponse.json(supplier);
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar suplidor' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.supplier.delete({ where: { id: parseInt(params.id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar suplidor' }, { status: 500 });
  }
}
