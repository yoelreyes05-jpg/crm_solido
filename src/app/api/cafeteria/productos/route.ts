import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const products = await prisma.cafeProduct.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, category, price, stock } = body;
    if (!name || price === undefined) {
      return NextResponse.json({ error: 'Nombre y precio son requeridos' }, { status: 400 });
    }
    const product = await prisma.cafeProduct.create({
      data: {
        name,
        category: category || 'BEBIDA',
        price: parseFloat(price),
        stock: parseInt(stock || '0')
      }
    });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 });
  }
}
