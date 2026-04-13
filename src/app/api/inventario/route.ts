import { NextResponse } from 'next/server';

const API = "http://localhost:4000";

// ✅ GET INVENTARIO
export async function GET() {
  try {
    const res = await fetch(`${API}/inventario`);
    const data = await res.json();

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ POST INVENTARIO
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const res = await fetch(`${API}/inventario`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}