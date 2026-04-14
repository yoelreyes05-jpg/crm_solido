import { NextResponse } from 'next/server';

const API = "http://localhost:4000";

// ✅ PUT
export async function PUT(req: Request, { params }: any) {
  try {
    const body = await req.json();

    const res = await fetch(`${API}/inventario/${params.id}`, {
      method: "PUT",
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

// ✅ DELETE
export async function DELETE(req: Request, { params }: any) {
  try {
    const res = await fetch(`${API}/inventario/${params.id}`, {
      method: "DELETE",
    });

    const data = await res.json();

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}