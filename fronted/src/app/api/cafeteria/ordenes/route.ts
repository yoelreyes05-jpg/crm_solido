import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

const ITBIS_RATE = 0.18;

export async function GET() {
  try {
    const orders = await prisma.cafeOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: true } } }
    });
    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener ventas de cafetería' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, method } = body;
    // items: [{ productId, quantity }]
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Debe incluir al menos un producto' }, { status: 400 });
    }

    // Validate stock
    for (const item of items) {
      const product = await prisma.cafeProduct.findUnique({ where: { id: parseInt(item.productId) } });
      if (!product) return NextResponse.json({ error: `Producto no encontrado` }, { status: 404 });
      if (product.stock < parseInt(item.quantity)) {
        return NextResponse.json({ error: `Stock insuficiente para ${product.name}` }, { status: 400 });
      }
    }

    const productsData = await Promise.all(items.map(async (item: any) => {
      const product = await prisma.cafeProduct.findUnique({ where: { id: parseInt(item.productId) } });
      return { productId: product!.id, quantity: parseInt(item.quantity), unitPrice: product!.price };
    }));

    const subtotal = productsData.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const itbis = subtotal * ITBIS_RATE;
    const total = subtotal + itbis;

    const order = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const item of productsData) {
        await tx.cafeProduct.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } }
        });
      }
      return tx.cafeOrder.create({
        data: {
          subtotal,
          itbis,
          total,
          method: method || 'EFECTIVO',
          items: {
            create: productsData.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            }))
          }
        },
        include: { items: { include: { product: true } } }
      });
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error al procesar venta' }, { status: 500 });
  }
}
