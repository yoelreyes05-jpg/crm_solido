import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const body = await req.json()

  const cliente = await prisma.client.create({
    data: {
      name: body.name,
      phone: body.phone,
      email: body.email
    }
  })

  return NextResponse.json(cliente)
}